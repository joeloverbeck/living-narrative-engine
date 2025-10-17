/**
 * @file security-middleware-helmet-rejection.integration.test.js
 * @description Integration tests focusing on error propagation and nonce generation
 *              paths in the enhanced security middleware stack that were previously
 *              undercovered by the broader suite.
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

describe('Security middleware targeted coverage', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    jest.dontMock('helmet');
  });

  it('propagates explicit helmet callback errors through the middleware chain', async () => {
    jest.resetModules();

    jest.doMock('helmet', () => {
      return () => (_req, _res, next) => {
        next(new Error('helmet-mock-error'));
      };
    });

    const { createSecurityMiddleware } = await import(
      '../../src/middleware/security.js'
    );

    const app = express();
    let capturedError = null;

    app.use(createSecurityMiddleware());
    app.get('/secure-endpoint', (_req, res) => {
      res.json({ ok: true });
    });
    app.use((error, _req, res, _next) => {
      capturedError = error;
      res.status(500).json({ error: error.message });
    });

    const response = await request(app).get('/secure-endpoint');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'helmet-mock-error' });
    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError?.message).toBe('helmet-mock-error');
  });

  it('generates CSP nonces with the requested length and shares them across request/response', async () => {
    jest.resetModules();

    const { createCSPNonceMiddleware } = await import(
      '../../src/middleware/security.js'
    );

    const app = express();
    app.use(createCSPNonceMiddleware({ nonceLength: 31 }));
    app.get('/nonce', (req, res) => {
      res.json({
        nonce: req.cspNonce,
        localsNonce: res.locals.cspNonce,
      });
    });

    const response = await request(app).get('/nonce');

    expect(response.status).toBe(200);
    expect(response.body.nonce).toHaveLength(31);
    expect(response.body.localsNonce).toBe(response.body.nonce);
    expect(response.headers['x-csp-nonce']).toHaveLength(31);
  });
});
