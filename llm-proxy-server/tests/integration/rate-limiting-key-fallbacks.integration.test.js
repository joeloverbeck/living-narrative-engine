import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createApiRateLimiter } from '../../src/middleware/rateLimiting.js';

/**
 * Utility to build an express app that exposes the underlying rate limiting key
 * selected for each incoming request. This allows the tests to verify the
 * complete fallback order implemented inside {@link generateRateLimitKey} using
 * real Express requests rather than mocks.
 *
 * @param {ReturnType<typeof createApiRateLimiter>} limiter - Configured limiter middleware.
 * @param {(req: import('express').Request, res: import('express').Response) => void} [mutate]
 *   Optional mutator that can adjust the request object before the limiter runs.
 * @returns {import('express').Express}
 */
const buildApp = (limiter, mutate = () => {}) => {
  const app = express();
  app.use((req, res, next) => {
    mutate(req, res);
    next();
  });

  app.use(limiter);

  app.get('/probe', (req, res) => {
    res.json({
      key: req.rateLimit?.key ?? null,
      clientId: req.rateLimit?.key ? req.rateLimit.key.split(':')[0] : null,
    });
  });

  return app;
};

describe('rate limiting key fallback integration', () => {
  it('uses direct connection information when proxy trust is disabled', async () => {
    const app = buildApp(createApiRateLimiter({ trustProxy: false }));

    const response = await request(app).get('/probe');

    expect(response.status).toBe(200);
    expect(response.body.clientId).toBe('direct');
    expect(response.body.key).toContain('direct:');
  });

  it('ignores malformed proxy headers and falls back to the real connection IP', async () => {
    const app = buildApp(createApiRateLimiter({ trustProxy: true }));

    const response = await request(app)
      .get('/probe')
      .set('X-Forwarded-For', 'not-an-ip-address');

    expect(response.status).toBe(200);
    expect(response.body.clientId).toBe('ip');
    expect(response.body.key).toContain('127.0.0.1');
  });

  it('hashes the user agent when no network information is available', async () => {
    const app = buildApp(createApiRateLimiter({ trustProxy: false }), (req) => {
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

    const response = await request(app)
      .get('/probe')
      .set('User-Agent', 'RateLimiter/1.0');

    expect(response.status).toBe(200);
    expect(response.body.clientId).toBe('ua');
    expect(response.body.key.startsWith('ua:')).toBe(true);
  });

  it('falls back to the global key when no identifying data is available', async () => {
    const app = buildApp(createApiRateLimiter({ trustProxy: false }), (req) => {
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

    const response = await request(app).get('/probe').set('User-Agent', '');

    expect(response.status).toBe(200);
    expect(response.body.key).toBe('global:unknown');
  });
});
