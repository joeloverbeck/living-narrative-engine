import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

const ORIGINAL_ENV = { ...process.env };

const overrideRequestIdentity = (req) => {
  delete req.headers['x-forwarded-for'];
  delete req.headers['x-real-ip'];
  delete req.headers['x-client-ip'];
  delete req.headers['forwarded'];
  delete req.headers['forwarded-for'];
  delete req.headers['x-forwarded'];
  delete req.headers['user-agent'];

  Reflect.deleteProperty(req, 'connection');
  Object.defineProperty(req, 'connection', {
    configurable: true,
    value: { remoteAddress: undefined },
  });

  Reflect.deleteProperty(req, 'socket');
  Object.defineProperty(req, 'socket', {
    configurable: true,
    value: { remoteAddress: undefined },
  });

  Reflect.deleteProperty(req, 'ip');
  Object.defineProperty(req, 'ip', {
    configurable: true,
    get() {
      return undefined;
    },
  });
};

describe('rate limiting global fallback integration coverage', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'production' };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('falls back to the global rate limit key when request identity data is unavailable', async () => {
    const { createApiRateLimiter } = await import(
      '../../src/middleware/rateLimiting.js'
    );

    const app = express();
    app.get(
      '/global-fallback',
      (req, _res, next) => {
        overrideRequestIdentity(req);
        next();
      },
      createApiRateLimiter({ trustProxy: true }),
      (_req, res) => {
        res.status(200).json({ ok: true });
      }
    );

    const agent = request(app);

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const response = await agent.get('/global-fallback').unset('User-Agent');
      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    }

    const blocked = await agent.get('/global-fallback').unset('User-Agent');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(blocked.body.error.details.clientId).toBe('global');
    expect(blocked.headers['ratelimit-remaining']).toBe('0');
  });
});
