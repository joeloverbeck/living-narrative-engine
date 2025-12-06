/**
 * @file security-middleware-defaults.integration.test.js
 * @description Additional integration coverage for the security middleware utilities
 *              focusing on default fallbacks that were previously only exercised in
 *              unit tests. These scenarios ensure the nonce helper and configuration
 *              validator interact correctly with Express without custom loggers.
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

describe('Security middleware default behaviours - integration', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('CSP nonce middleware works with security middleware for both default and custom lengths', async () => {
    const app = express();

    // Apply the core security middleware without automatic nonce generation so that
    // the standalone CSP middleware is solely responsible for nonce handling.
    app.use(createSecurityMiddleware({ enableNonce: false }));

    app.get('/nonce-default', createCSPNonceMiddleware(), (req, res) => {
      res.json({
        nonce: req.cspNonce,
        headerNonce: res.get('X-CSP-Nonce'),
        storedNonce: res.locals.cspNonce,
      });
    });

    app.get(
      '/nonce-custom',
      createCSPNonceMiddleware({ nonceLength: 24 }),
      (req, res) => {
        res.json({
          nonce: req.cspNonce,
          headerNonce: res.get('X-CSP-Nonce'),
          storedNonce: res.locals.cspNonce,
        });
      }
    );

    const defaultResponse = await request(app)
      .get('/nonce-default')
      .expect(200);
    expect(defaultResponse.body.nonce).toHaveLength(16);
    expect(defaultResponse.body.headerNonce).toEqual(
      defaultResponse.body.nonce
    );
    expect(defaultResponse.body.storedNonce).toEqual(
      defaultResponse.body.nonce
    );
    expect(defaultResponse.headers['x-csp-nonce']).toEqual(
      defaultResponse.body.nonce
    );

    const customResponse = await request(app).get('/nonce-custom').expect(200);
    expect(customResponse.body.nonce).toHaveLength(24);
    expect(customResponse.body.headerNonce).toEqual(customResponse.body.nonce);
    expect(customResponse.body.storedNonce).toEqual(customResponse.body.nonce);
    expect(customResponse.headers['x-csp-nonce']).toEqual(
      customResponse.body.nonce
    );
  });

  test('security config validator falls back to console logging when headers are missing', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const app = express();
    app.use(createSecurityMiddleware());

    // Strip a couple of headers after helmet has already set them up to force the warning branch.
    app.use((_req, res, next) => {
      res.removeHeader('Strict-Transport-Security');
      res.removeHeader('Content-Security-Policy');
      next();
    });

    app.use(createSecurityConfigValidator());

    app.get('/validator-default', (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).get('/validator-default').expect(200);

    expect(warnSpy).toHaveBeenCalledWith(
      'Missing required security headers',
      expect.objectContaining({
        missingHeaders: expect.arrayContaining([
          'Content-Security-Policy',
          'Strict-Transport-Security',
        ]),
        url: '/validator-default',
        method: 'GET',
      })
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('security config validator default logger records inspection failures', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const app = express();
    app.use(createSecurityMiddleware());
    app.use(createSecurityConfigValidator());

    app.get('/validator-error', (req, res) => {
      const originalGetHeader = res.getHeader.bind(res);

      res.getHeader = (name) => {
        if (res.headersSent && name === 'Content-Security-Policy') {
          throw new Error('post-response header access failure');
        }

        return originalGetHeader(name);
      };

      res.json({ ok: true, nonce: req.cspNonce });
    });

    await request(app).get('/validator-error').expect(200);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Error checking security headers',
      expect.objectContaining({
        error: 'post-response header access failure',
        method: 'GET',
        url: '/validator-error',
      })
    );
  });
});
