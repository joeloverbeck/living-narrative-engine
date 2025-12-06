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

describe('request tracking response guard conflict scenarios', () => {
  it('blocks secondary success responses after an error commitment and records diagnostics', async () => {
    const { logger, entries } = createTestLogger();
    const app = express();
    app.use(express.json());
    app.use(createRequestTrackingMiddleware({ logger }));

    let firstAttempt = null;
    let secondAttempt = null;
    let statusAfterFinish = null;
    let transitions = [];

    app.post('/error-then-success', (req, res) => {
      const guard = createResponseGuard(req, res, logger);

      res.on('finish', () => {
        statusAfterFinish = guard.canSendResponse();
        secondAttempt = guard.sendSuccess(200, { ok: true });
        transitions = req.stateTransitions.map(({ from, to, metadata }) => ({
          from,
          to,
          metadata,
        }));
      });

      firstAttempt = guard.sendError(
        502,
        'controller.failure',
        'Upstream failed',
        {
          upstream: 'primary-llm',
        }
      );
    });

    const response = await request(app)
      .post('/error-then-success')
      .send({ payload: 'data' });
    await waitFor();

    expect(firstAttempt).toBe(true);
    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({
      error: true,
      message: 'Upstream failed',
      stage: 'controller.failure',
      originalStatusCode: 502,
    });
    expect(response.body.details).toMatchObject({
      upstream: 'primary-llm',
      requestId: expect.any(String),
    });

    expect(secondAttempt).toBe(false);
    expect(statusAfterFinish).toEqual({
      canSend: false,
      committed: true,
      source: 'error',
      headersSent: true,
      requestId: expect.any(String),
    });
    expect(statusAfterFinish.requestId).toBe(response.headers['x-request-id']);

    expect(transitions.map((transition) => transition.to)).toEqual([
      REQUEST_STATE.PROCESSING,
      REQUEST_STATE.RESPONDING,
      REQUEST_STATE.ERROR,
    ]);
    expect(transitions[2].metadata).toMatchObject({
      stage: 'controller.failure',
      statusCode: 502,
    });

    expect(entries.warn).toHaveLength(2);
    expect(entries.warn[0]).toEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          "Response already committed to 'error'"
        ),
        metadata: expect.objectContaining({
          requestId: statusAfterFinish.requestId,
          existingSource: 'error',
          attemptedSource: 'success',
        }),
      })
    );
    expect(entries.warn[1]).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Cannot send success response'),
        metadata: expect.objectContaining({
          requestId: statusAfterFinish.requestId,
          statusCode: 200,
          blockedBy: 'error',
        }),
      })
    );
    expect(entries.error).toHaveLength(0);
  });
});
