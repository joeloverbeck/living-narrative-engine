import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createCSPNonceMiddleware,
  createSecurityConfigValidator,
  createSecurityMiddleware,
} from '../../src/middleware/security.js';

/**
 * Utility to build an express app with the provided middlewares and handler.
 * @param {Array<import('express').RequestHandler>} middlewares
 * @param {import('express').RequestHandler} handler
 * @returns {import('express').Express}
 */
function buildApp(middlewares, handler) {
  const app = express();
  app.use(express.json());
  middlewares.forEach((middleware) => app.use(middleware));
  app.get('/test', handler);
  return app;
}

describe('security middleware integration hardening', () => {
  let originalDateNow;

  beforeEach(() => {
    originalDateNow = Date.now;
    Date.now = jest.fn(() => 1700000000000);
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  it('propagates CSP nonces through request context and response headers', async () => {
    const handler = (req, res) => {
      res.json({
        requestNonce: req.cspNonce,
        localsNonce: res.locals.cspNonce,
      });
    };
    const app = buildApp([createSecurityMiddleware()], handler);

    const response = await request(app).get('/test');

    expect(response.status).toBe(200);
    expect(response.body.requestNonce).toHaveLength(16);
    expect(response.body.localsNonce).toBe(response.body.requestNonce);
    expect(response.headers['x-csp-nonce']).toBe(response.body.requestNonce);
    expect(response.headers['content-security-policy']).toContain(
      `'nonce-${response.body.requestNonce}'`
    );
    expect(response.headers['x-security-applied']).toBeDefined();
  });

  it('omits nonce support and relaxes CSP when disabled explicitly', async () => {
    const handler = (req, res) => {
      res.json({
        requestNonce: req.cspNonce,
        localsNonce: res.locals.cspNonce,
      });
    };
    const app = buildApp(
      [createSecurityMiddleware({ enableNonce: false, strictCSP: false })],
      handler
    );

    const response = await request(app).get('/test');

    expect(response.status).toBe(200);
    expect(response.body.requestNonce).toBeNull();
    expect(response.body.localsNonce).toBeNull();
    expect(response.headers['x-csp-nonce']).toBeUndefined();
    const cspHeader = response.headers['content-security-policy'];
    expect(cspHeader).not.toContain('nonce-');
    expect(cspHeader).toContain("'unsafe-inline'");
  });

  it('generates configurable CSP nonces through the standalone middleware', async () => {
    const handler = (req, res) => {
      res.json({
        requestNonce: req.cspNonce,
        localsNonce: res.locals.cspNonce,
      });
    };
    const app = buildApp(
      [createCSPNonceMiddleware({ nonceLength: 24 })],
      handler
    );

    const response = await request(app).get('/test');

    expect(response.status).toBe(200);
    expect(response.body.requestNonce).toHaveLength(24);
    expect(response.body.localsNonce).toBe(response.body.requestNonce);
    expect(response.headers['x-csp-nonce']).toBe(response.body.requestNonce);
  });

  it('reports missing security headers after responses finish', async () => {
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    const handler = (req, res) => {
      res.removeHeader('X-Frame-Options');
      res.json({ ok: true });
    };
    const app = buildApp(
      [createSecurityMiddleware(), createSecurityConfigValidator({ logger })],
      handler
    );

    const response = await request(app).get('/test');

    expect(response.status).toBe(200);
    expect(logger.warn).toHaveBeenCalledWith(
      'Missing required security headers',
      expect.objectContaining({
        missingHeaders: expect.arrayContaining(['X-Frame-Options']),
        method: 'GET',
        url: '/test',
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('continues processing when header validation throws during finish hooks', async () => {
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    const handler = (req, res) => {
      const originalGetHeader = res.getHeader.bind(res);
      res.getHeader = (header) => {
        if (header === 'X-Content-Type-Options') {
          throw new Error('inspection failed');
        }
        return originalGetHeader(header);
      };
      res.json({ ok: true });
    };

    const app = buildApp([createSecurityConfigValidator({ logger })], handler);

    const response = await request(app).get('/test');

    expect(response.status).toBe(200);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Error checking security headers',
      expect.objectContaining({
        error: 'inspection failed',
        method: 'GET',
        url: '/test',
      })
    );
  });
});
