import express from 'express';
import request from 'supertest';
import {
  createRequestTrackingMiddleware,
  createResponseGuard,
  REQUEST_STATE,
} from '../../src/middleware/requestTracking.js';

const waitFor = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

const createTestLogger = () => {
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

describe('request tracking middleware + response guard integration', () => {
  it('propagates tracking metadata through a successful response lifecycle', async () => {
    const { logger, entries } = createTestLogger();
    const app = express();
    app.use(express.json());
    app.use(createRequestTrackingMiddleware({ logger }));

    let transitionsCapture = [];
    let commitSourceAfter = null;
    let requestIdAtFinish = null;
    let statusBeforeCommit = null;

    app.post('/success', (req, res) => {
      const guard = createResponseGuard(req, res, logger);
      statusBeforeCommit = guard.canSendResponse();

      res.on('finish', () => {
        transitionsCapture = req.stateTransitions.map((transition) => ({
          from: transition.from,
          to: transition.to,
          metadata: transition.metadata,
        }));
        commitSourceAfter = res.getCommitmentSource();
        requestIdAtFinish = req.requestId;
      });

      guard.sendSuccess(201, {
        ok: true,
        statusBefore: statusBeforeCommit,
        requestId: req.requestId,
      });
    });

    const response = await request(app)
      .post('/success')
      .send({ payload: 'data' });
    await waitFor();

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ ok: true });
    expect(response.headers['x-request-id']).toBeDefined();

    expect(statusBeforeCommit).toEqual({
      canSend: true,
      committed: false,
      source: null,
      headersSent: false,
      requestId: expect.any(String),
    });
    expect(statusBeforeCommit.requestId).toBe(requestIdAtFinish);
    expect(response.body.requestId).toBe(requestIdAtFinish);
    expect(response.headers['x-request-id']).toBe(requestIdAtFinish);

    expect(commitSourceAfter).toBe('success');
    const fromStates = transitionsCapture.map((t) => t.from);
    const toStates = transitionsCapture.map((t) => t.to);
    expect(fromStates.slice(0, 3)).toEqual([
      REQUEST_STATE.PENDING,
      REQUEST_STATE.PROCESSING,
      REQUEST_STATE.RESPONDING,
    ]);
    expect(toStates.slice(0, 3)).toEqual([
      REQUEST_STATE.PROCESSING,
      REQUEST_STATE.RESPONDING,
      REQUEST_STATE.COMPLETED,
    ]);
    expect(toStates).toContain(REQUEST_STATE.COMPLETED);
    expect(transitionsCapture[1].metadata).toMatchObject({ source: 'success' });
    expect(
      transitionsCapture.find(
        (transition) => transition.metadata?.method === 'json'
      )
    ).toBeDefined();

    expect(entries.warn).toHaveLength(0);
    expect(entries.error).toHaveLength(0);
  });

  it('commits timeout responses and transitions requests into an error state', async () => {
    const { logger, entries } = createTestLogger();
    const app = express();
    app.use(express.json());
    app.use(createRequestTrackingMiddleware({ logger }));

    let transitionsCapture = [];
    let commitSourceAfter = null;
    let requestIdAtFinish = null;

    app.post('/timeout', (req, res) => {
      const guard = createResponseGuard(req, res, logger);

      res.on('finish', () => {
        transitionsCapture = req.stateTransitions.map((transition) => ({
          from: transition.from,
          to: transition.to,
          metadata: transition.metadata,
        }));
        commitSourceAfter = res.getCommitmentSource();
        requestIdAtFinish = req.requestId;
      });

      guard.sendError(504, 'llm.timeout', 'Gateway timeout', {
        attempt: 1,
        upstream: 'primary-llm',
      });
    });

    const response = await request(app)
      .post('/timeout')
      .send({ payload: 'data' });
    await waitFor();

    expect(response.status).toBe(504);
    expect(response.body).toMatchObject({
      error: true,
      stage: 'llm.timeout',
      message: 'Gateway timeout',
      originalStatusCode: 504,
    });
    expect(response.body.details).toMatchObject({
      attempt: 1,
      upstream: 'primary-llm',
      requestId: requestIdAtFinish,
    });

    expect(commitSourceAfter).toBe('timeout');
    expect(transitionsCapture.map((t) => t.to)).toEqual([
      REQUEST_STATE.PROCESSING,
      REQUEST_STATE.RESPONDING,
      REQUEST_STATE.ERROR,
    ]);
    expect(transitionsCapture[2].metadata).toMatchObject({
      stage: 'llm.timeout',
      statusCode: 504,
    });

    expect(entries.warn).toHaveLength(0);
    expect(entries.error).toHaveLength(0);
  });

  it('prevents late error commitments once a success response has been sent', async () => {
    const { logger, entries } = createTestLogger();
    const app = express();
    app.use(express.json());
    app.use(createRequestTrackingMiddleware({ logger }));

    let secondAttemptResult = null;
    let postCommitStatus = null;

    app.post('/double-commit', (req, res) => {
      const guard = createResponseGuard(req, res, logger);

      res.on('finish', () => {
        postCommitStatus = guard.canSendResponse();
        secondAttemptResult = guard.sendError(
          500,
          'llm.failure',
          'late failure'
        );
      });

      guard.sendSuccess(200, {
        ok: true,
        requestId: req.requestId,
      });
    });

    const response = await request(app)
      .post('/double-commit')
      .send({ payload: 'data' });
    await waitFor();

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);

    expect(postCommitStatus).toEqual({
      canSend: false,
      committed: true,
      source: 'success',
      headersSent: true,
      requestId: expect.any(String),
    });
    expect(secondAttemptResult).toBe(false);
    expect(entries.warn).not.toHaveLength(0);
    expect(entries.warn[0].message).toContain('Response already committed');
    expect(entries.warn[0].metadata).toMatchObject({
      existingSource: 'success',
    });
  });

  it('blocks guard responses after headers have been flushed to the client', async () => {
    const { logger, entries } = createTestLogger();
    const app = express();
    app.use(createRequestTrackingMiddleware({ logger }));

    let guardResult = null;

    app.get('/headers-sent', (req, res) => {
      const guard = createResponseGuard(req, res, logger);

      res.write('partial-stream');
      guardResult = guard.sendSuccess(200, { ok: false });
      res.end();
    });

    const response = await request(app).get('/headers-sent');
    await waitFor();

    expect(response.status).toBe(200);
    expect(response.text).toBe('partial-stream');
    expect(guardResult).toBe(false);
    expect(entries.error).not.toHaveLength(0);
    expect(entries.error[0].message).toContain('Headers already sent');
  });
});
