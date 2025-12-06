import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createTimeoutMiddleware,
  createSizeLimitConfig,
} from '../../src/middleware/timeout.js';
import { createRequestTrackingMiddleware } from '../../src/middleware/requestTracking.js';
import { SECURITY_MAX_REQUEST_SIZE_BYTES } from '../../src/config/constants.js';

describe('timeout middleware integration without explicit logger dependencies', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('sends a structured timeout response when handlers never complete and no logger is provided', async () => {
    const app = express();

    app.use(createRequestTrackingMiddleware());
    app.use(createTimeoutMiddleware(30));

    app.get('/no-logger-timeout', (_req, res) => {
      setTimeout(() => {
        try {
          res.status(200).json({ eventually: true });
        } catch (_error) {
          // The timeout middleware will already have finalized the response.
        }
      }, 90);
    });

    const response = await request(app).get('/no-logger-timeout');

    expect(response.status).toBe(503);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.body).toMatchObject({
      error: true,
      message: 'Request timeout - the server took too long to respond.',
      stage: 'request_timeout',
      details: {
        timeoutMs: 30,
        method: 'GET',
        path: '/no-logger-timeout',
      },
      originalStatusCode: 503,
    });
  });

  it('allows downstream handlers to finish after grace period even when headers were already sent without a logger', async () => {
    const app = express();

    app.use(createRequestTrackingMiddleware());
    app.use(createTimeoutMiddleware(20, { gracePeriod: 40 }));

    app.get('/partial-stream', (_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'text/plain' });
        if (typeof res.flushHeaders === 'function') {
          res.flushHeaders();
        }
        res.write('partial-');
      }, 5);

      setTimeout(() => {
        try {
          res.end('complete');
        } catch (_error) {
          // If the timeout middleware closed the connection, ignore the error.
        }
      }, 120);
    });

    const response = await request(app).get('/partial-stream');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeDefined();
    expect(response.text).toBe('partial-complete');
  });
});

describe('size limit configuration with exotic unit strings', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('falls back to byte interpretation for unknown units while enforcing security ceilings', async () => {
    const app = express();
    const config = createSizeLimitConfig({
      jsonLimit: '42parsecs',
      enforceMaxLimit: true,
    });

    app.use(express.json(config.json));
    app.post('/exotic-limit', (req, res) => {
      res.status(200).json({ payloadLength: JSON.stringify(req.body).length });
    });

    const okResponse = await request(app)
      .post('/exotic-limit')
      .set('content-type', 'application/json')
      .send({ data: 'ok' });
    expect(okResponse.status).toBe(200);

    const oversizedPayload = 'x'.repeat(SECURITY_MAX_REQUEST_SIZE_BYTES + 1024);
    const blockedResponse = await request(app)
      .post('/exotic-limit')
      .set('content-type', 'application/json')
      .send({ data: oversizedPayload });

    expect(blockedResponse.status).toBe(413);
  });
});
