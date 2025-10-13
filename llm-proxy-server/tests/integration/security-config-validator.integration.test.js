/**
 * @file security-config-validator.integration.test.js
 * @description Integration tests targeting the security configuration validator middleware
 *              to exercise scenarios not covered by the broader security hardening suite.
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

describe('Security configuration validator middleware - integration', () => {
  let app;
  let logger;

  beforeEach(() => {
    app = express();
    logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('does not emit warnings when all required security headers remain intact', async () => {
    app.use(createSecurityMiddleware());
    app.use(createSecurityConfigValidator({ logger }));

    app.get('/secure', (req, res) => {
      res.json({ ok: true, nonce: req.cspNonce });
    });

    await request(app).get('/secure').expect(200);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('logs an error when header inspection fails after the response completes', async () => {
    app.use(createSecurityMiddleware());
    app.use(createSecurityConfigValidator({ logger }));

    app.get('/inspection-error', (req, res) => {
      const originalGetHeader = res.getHeader.bind(res);

      res.getHeader = (name) => {
        if (res.headersSent) {
          throw new Error('Simulated header access failure');
        }

        return originalGetHeader(name);
      };

      res.json({ ok: true, nonce: req.cspNonce });
    });

    await request(app).get('/inspection-error').expect(200);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Error checking security headers',
      expect.objectContaining({
        error: 'Simulated header access failure',
        method: 'GET',
        url: '/inspection-error',
      })
    );
  });
});
