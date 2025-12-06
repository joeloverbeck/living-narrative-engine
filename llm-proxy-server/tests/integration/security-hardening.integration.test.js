/**
 * @file security-hardening.integration.test.js
 * @description Integration tests validating the enhanced security middleware
 *              stack, CSP nonce utilities, and security header validation.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createCSPNonceMiddleware,
  createSecurityConfigValidator,
  createSecurityMiddleware,
} from '../../src/middleware/security.js';

describe('Security hardening integration', () => {
  let app;

  beforeEach(() => {
    app = express();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('applies CSP nonces and enhanced security headers', async () => {
    app.use(createSecurityMiddleware());

    app.get('/secure-endpoint', (req, res) => {
      res.json({
        nonce: req.cspNonce,
        localsNonce: res.locals.cspNonce,
      });
    });

    const response = await request(app).get('/secure-endpoint').expect(200);

    expect(response.body.nonce).toMatch(/^[0-9a-f]{16}$/);
    expect(response.body.localsNonce).toBe(response.body.nonce);
    expect(response.headers['x-csp-nonce']).toBe(response.body.nonce);

    const cspHeader = response.headers['content-security-policy'];
    expect(cspHeader).toContain(
      `script-src 'self' 'nonce-${response.body.nonce}'`
    );
    expect(cspHeader).toContain(
      `style-src 'self' 'nonce-${response.body.nonce}'`
    );

    expect(response.headers['permissions-policy']).toContain('geolocation=()');
    expect(response.headers['expect-ct']).toBe('max-age=86400, enforce');
    expect(response.headers['x-security-applied']).toBeDefined();
  });

  test('supports disabling nonces while keeping CSP flexible', async () => {
    app.use(createSecurityMiddleware({ enableNonce: false, strictCSP: false }));

    app.get('/legacy-endpoint', (req, res) => {
      res.json({ nonce: req.cspNonce, localsNonce: res.locals.cspNonce });
    });

    const response = await request(app).get('/legacy-endpoint').expect(200);

    expect(response.body).toEqual({ nonce: null, localsNonce: null });
    expect(response.headers).not.toHaveProperty('x-csp-nonce');

    const cspHeader = response.headers['content-security-policy'];
    expect(cspHeader).not.toContain("'nonce-");
    expect(cspHeader).toContain("style-src 'self' 'unsafe-inline'");
  });

  test('reports missing security headers through the validator middleware', async () => {
    const warnings = [];
    const logger = {
      warn: jest.fn((message, context) => warnings.push({ message, context })),
      error: jest.fn(),
    };

    app.use(createSecurityMiddleware());
    app.use(createSecurityConfigValidator({ logger }));

    app.get('/misconfigured-endpoint', (req, res) => {
      // Simulate downstream middleware removing critical headers
      res.removeHeader('Strict-Transport-Security');
      res.removeHeader('Content-Security-Policy');
      res.json({ ok: true });
    });

    await request(app).get('/misconfigured-endpoint').expect(200);

    expect(logger.warn).toHaveBeenCalledWith(
      'Missing required security headers',
      expect.objectContaining({
        missingHeaders: expect.arrayContaining([
          'Strict-Transport-Security',
          'Content-Security-Policy',
        ]),
      })
    );

    expect(
      warnings.some(({ context }) =>
        context.missingHeaders.includes('X-Content-Type-Options')
      )
    ).toBe(false);
  });

  test('generates standalone CSP nonce middleware values with custom length', async () => {
    app.use(createCSPNonceMiddleware({ nonceLength: 32 }));

    app.get('/nonce-only', (req, res) => {
      res.json({
        nonce: req.cspNonce,
        localsNonce: res.locals.cspNonce,
        headerNonce: res.get('X-CSP-Nonce'),
      });
    });

    const response = await request(app).get('/nonce-only').expect(200);

    expect(response.body.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(response.body.localsNonce).toBe(response.body.nonce);
    expect(response.body.headerNonce).toBe(response.body.nonce);
  });
});
