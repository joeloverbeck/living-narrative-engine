import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createApiRateLimiter } from '../../src/middleware/rateLimiting.js';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  return app;
};

describe('rate limiting integration resilience for malformed inputs', () => {
  it('falls back to the global identifier when upstream injects a function-like request wrapper', async () => {
    const limiter = createApiRateLimiter({ trustProxy: true });
    const app = buildApp();

    app.get(
      '/global-fallback',
      (req, res, next) => {
        const proxyRequest = function proxyRequestWrapper() {};
        Object.setPrototypeOf(proxyRequest, req);
        proxyRequest.headers = { ...req.headers };
        proxyRequest.connection = req.connection;
        proxyRequest.socket = req.socket;

        limiter(proxyRequest, res, (err) => {
          if (proxyRequest.rateLimit) {
            req.rateLimit = proxyRequest.rateLimit;
          }

          if (err) {
            next(err);
            return;
          }

          next();
        });
      },
      (req, res) => {
        res.status(200).json({
          key: req.rateLimit?.key ?? null,
          clientId: req.rateLimit?.key ? req.rateLimit.key.split(':')[0] : null,
        });
      }
    );

    const response = await request(app).get('/global-fallback');

    expect(response.status).toBe(200);
    expect(response.body.clientId).toBe('global');
    expect(response.body.key).toBe('global:unknown');
  });

  it('ignores proxy headers whose trim method returns non-strings and continues with direct IP data', async () => {
    const limiter = createApiRateLimiter({ trustProxy: true });
    const app = buildApp();

    app.get(
      '/non-string-proxy',
      (req, res, next) => {
        req.headers = {
          ...req.headers,
          'x-real-ip': {
            trim() {
              return 42;
            },
          },
          'x-client-ip': {
            trim() {
              return null;
            },
          },
        };

        Object.defineProperty(req, 'ip', {
          configurable: true,
          get() {
            return '203.0.113.88';
          },
        });

        limiter(req, res, (err) => {
          if (err) {
            next(err);
            return;
          }

          next();
        });
      },
      (req, res) => {
        res.status(200).json({
          key: req.rateLimit?.key ?? null,
        });
      }
    );

    const response = await request(app).get('/non-string-proxy');

    expect(response.status).toBe(200);
    expect(response.body.key).toBe('ip:203.0.113.88');
  });
});
