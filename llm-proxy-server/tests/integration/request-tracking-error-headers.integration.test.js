import express from 'express';
import request from 'supertest';

import {
  createRequestTrackingMiddleware,
  createResponseGuard,
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

describe('request tracking guard header commitment resilience', () => {
  it('logs and blocks error responses once headers were already sent', async () => {
    const { logger, entries } = createCapturingLogger();
    const app = express();
    app.use(createRequestTrackingMiddleware({ logger }));

    let guardResult = null;
    let capturedRequestId = null;
    let postAttemptStatus = null;

    app.get('/error-after-headers', (req, res) => {
      const guard = createResponseGuard(req, res, logger);

      res.write('partial-stream');
      capturedRequestId = req.requestId;

      guardResult = guard.sendError(502, 'llm.failure', 'stream failure', {
        upstream: 'partial-provider',
      });
      postAttemptStatus = guard.canSendResponse();

      res.end();
    });

    const response = await request(app).get('/error-after-headers');
    await waitFor();

    expect(response.status).toBe(200);
    expect(response.text).toBe('partial-stream');
    expect(guardResult).toBe(false);
    expect(postAttemptStatus).toEqual({
      canSend: false,
      committed: true,
      source: 'error',
      headersSent: true,
      requestId: capturedRequestId,
    });

    expect(
      entries.debug.find((entry) =>
        entry.message.includes("Response committed to 'error'")
      )
    ).toBeDefined();

    expect(entries.error).toContainEqual(
      expect.objectContaining({
        message: `Request ${capturedRequestId}: Headers already sent, cannot send error response`,
        metadata: expect.objectContaining({
          requestId: capturedRequestId,
          stage: 'llm.failure',
        }),
      })
    );

    expect(entries.warn).toEqual([]);
  });
});
