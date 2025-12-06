/**
 * @file security-config-validator-missing-headers.integration.test.js
 * @description Exercises the security configuration validator in scenarios where
 *              downstream middleware tamper with required headers after the main
 *              security middleware has executed. This ensures we cover the branch
 *              that emits warnings about missing protections while still flowing
 *              through the real Express stack.
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
  createSecurityConfigValidator,
  createSecurityMiddleware,
} from '../../src/middleware/security.js';

describe('Security config validator missing headers resilience - integration', () => {
  let app;
  let logger;

  beforeEach(() => {
    app = express();
    logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    app.use((req, _res, next) => {
      req.correlationId = 'integration-correlation-id';
      next();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('emits a warning when required headers are removed after the security middleware runs', async () => {
    app.use(createSecurityMiddleware());

    app.use((_req, res, next) => {
      res.removeHeader('Strict-Transport-Security');
      res.removeHeader('Content-Security-Policy');
      next();
    });

    app.use(createSecurityConfigValidator({ logger }));

    app.get('/tampered-security', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get('/tampered-security').expect(200);

    expect(response.headers['content-security-policy']).toBeUndefined();
    expect(response.headers['strict-transport-security']).toBeUndefined();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Missing required security headers',
      expect.objectContaining({
        missingHeaders: expect.arrayContaining([
          'Content-Security-Policy',
          'Strict-Transport-Security',
        ]),
        url: '/tampered-security',
        method: 'GET',
        correlationId: 'integration-correlation-id',
      })
    );

    expect(logger.error).not.toHaveBeenCalled();
  });
});
