import express from 'express';
import request from 'supertest';
import {
  createRequestTrackingMiddleware,
  createResponseGuard,
  REQUEST_STATE,
} from '../../src/middleware/requestTracking.js';

const waitFor = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

const createCapturingLogger = () => {
  const entries = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  return {
    logger: {
      debug: (message, metadata) => entries.debug.push({ message, metadata }),
      info: (message, metadata) => entries.info.push({ message, metadata }),
      warn: (message, metadata) => entries.warn.push({ message, metadata }),
      error: (message, metadata) => entries.error.push({ message, metadata }),
    },
    entries,
  };
};

describe('request tracking response guard conflict coverage (integration)', () => {
  it('prevents sending a success payload after an error commit and records diagnostics', async () => {
    const { logger, entries } = createCapturingLogger();
    const app = express();
    app.use(express.json());
    app.use(createRequestTrackingMiddleware({ logger }));

    let firstAttemptResult = null;
    let secondAttemptResult = null;
    let recordedTransitions = [];
    let finalCommitSource = null;
    let requestIdAtFinish = null;

    app.post('/error-before-success', (req, res) => {
      const guard = createResponseGuard(req, res, logger);

      res.on('finish', () => {
        recordedTransitions = req.stateTransitions.map((transition) => ({
          from: transition.from,
          to: transition.to,
          metadata: transition.metadata,
        }));
        finalCommitSource = res.getCommitmentSource();
        requestIdAtFinish = req.requestId;
      });

      firstAttemptResult = guard.sendError(
        502,
        'llm.upstream.failure',
        'Upstream failure',
        {
          target: 'primary',
          attempt: 1,
        }
      );

      secondAttemptResult = guard.sendSuccess(200, {
        ok: true,
        requestIdEcho: req.requestId,
      });
    });

    const response = await request(app)
      .post('/error-before-success')
      .send({ payload: 'data' });
    await waitFor();

    expect(firstAttemptResult).toBe(true);
    expect(secondAttemptResult).toBe(false);

    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({
      error: true,
      stage: 'llm.upstream.failure',
      message: 'Upstream failure',
      originalStatusCode: 502,
    });
    expect(response.body.details).toMatchObject({
      target: 'primary',
      attempt: 1,
      requestId: requestIdAtFinish,
    });
    expect(response.headers['x-request-id']).toBe(requestIdAtFinish);

    expect(finalCommitSource).toBe('error');
    expect(recordedTransitions.map((transition) => transition.to)).toEqual([
      REQUEST_STATE.PROCESSING,
      REQUEST_STATE.RESPONDING,
      REQUEST_STATE.ERROR,
    ]);

    expect(entries.warn).not.toHaveLength(0);
    const guardWarning = entries.warn.find((entry) =>
      entry.message.includes('Cannot send success response')
    );
    expect(guardWarning).toBeDefined();
    expect(guardWarning?.metadata).toMatchObject({
      blockedBy: 'error',
      statusCode: 200,
    });
  });

  it('refuses to send structured error payloads once headers have already been sent', async () => {
    const { logger, entries } = createCapturingLogger();
    const app = express();
    app.use(createRequestTrackingMiddleware({ logger }));

    let guardAttemptResult = null;
    let finalCommitSource = null;
    let recordedTransitions = [];

    app.get('/streaming-error', (req, res) => {
      const guard = createResponseGuard(req, res, logger);

      res.on('finish', () => {
        recordedTransitions = req.stateTransitions.map((transition) => ({
          from: transition.from,
          to: transition.to,
          metadata: transition.metadata,
        }));
        finalCommitSource = res.getCommitmentSource();
      });

      res.write('partial-chunk');
      guardAttemptResult = guard.sendError(
        503,
        'llm.stream.failure',
        'Stream failure detected',
        {
          chunk: 'initial',
        }
      );
      res.end();
    });

    const response = await request(app).get('/streaming-error');
    await waitFor();

    expect(guardAttemptResult).toBe(false);
    expect(finalCommitSource).toBe('error');

    expect(response.status).toBe(200);
    expect(response.text).toBe('partial-chunk');

    expect(entries.error).not.toHaveLength(0);
    expect(entries.error[0].message).toContain(
      'Headers already sent, cannot send error response'
    );
    expect(entries.error[0].metadata).toMatchObject({
      requestId: expect.any(String),
      stage: 'llm.stream.failure',
    });

    expect(recordedTransitions.map((transition) => transition.to)).toEqual([
      REQUEST_STATE.PROCESSING,
      REQUEST_STATE.RESPONDING,
      REQUEST_STATE.COMPLETED,
    ]);
  });
});
