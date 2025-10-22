import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createApiRateLimiter } from '../../src/middleware/rateLimiting.js';

/**
 * Builds an express application that exposes the generated rate-limiting key
 * for inspection. This allows the tests to assert the behaviour of
 * {@link generateRateLimitKey} and {@link extractRealClientIP} using the real
 * middleware stack rather than re-implementing the logic.
 *
 * @param {(req: import('express').Request) => void} mutate - mutates the
 *   request object before the limiter executes.
 * @returns {import('express').Express}
 */
const buildAppWithProbe = (mutate) => {
  const app = express();

  app.use((req, _res, next) => {
    mutate(req);
    next();
  });

  const limiter = createApiRateLimiter({ trustProxy: true });
  app.use(limiter);

  app.get('/probe', (req, res) => {
    res.json({
      key: req.rateLimit?.key ?? null,
    });
  });

  return app;
};

describe('rate limiting guard rails for malformed request objects', () => {
  it('falls back to the global limiter key when headers are null and no network identifiers are available', async () => {
    const app = buildAppWithProbe((req) => {
      Object.defineProperty(req, 'headers', {
        configurable: true,
        get() {
          return Object.create(null);
        },
      });

      Object.defineProperty(req, 'ip', {
        configurable: true,
        get() {
          return undefined;
        },
      });

      Object.defineProperty(req, 'connection', {
        configurable: true,
        get() {
          return { remoteAddress: undefined };
        },
      });
    });

    const response = await request(app).get('/probe');

    expect(response.status).toBe(200);
    expect(response.body.key).toBe('global:unknown');
  });

  it('recovers to the direct connection key when headers are strings but the socket exposes an address', async () => {
    const app = buildAppWithProbe((req) => {
      Object.defineProperty(req, 'headers', {
        configurable: true,
        get() {
          return 'totally-invalid';
        },
      });

      Object.defineProperty(req, 'ip', {
        configurable: true,
        get() {
          return undefined;
        },
      });

      Object.defineProperty(req, 'connection', {
        configurable: true,
        get() {
          return { remoteAddress: '203.0.113.9' };
        },
      });
    });

    const response = await request(app).get('/probe');

    expect(response.status).toBe(200);
    expect(response.body.key).toBe('ip:203.0.113.9');
  });
});
