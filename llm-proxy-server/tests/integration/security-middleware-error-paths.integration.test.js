/**
 * @file security-middleware-error-paths.integration.test.js
 * @description Integration tests covering error propagation and logging paths for the
 *              enhanced security middleware stack when underlying HTTP primitives fail.
 */

import { afterEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createSecurityConfigValidator,
  createSecurityMiddleware,
} from '../../src/middleware/security.js';

describe('Security middleware error handling integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('propagates helmet failures to the downstream error handler', async () => {
    const app = express();
    const capturedErrors = [];

    app.use((req, res, next) => {
      const originalSetHeader = res.setHeader.bind(res);
      let hasThrown = false;

      res.setHeader = (name, value) => {
        if (!hasThrown && name === 'Content-Security-Policy') {
          hasThrown = true;
          throw new Error('helmet-set-header-failure');
        }
        return originalSetHeader(name, value);
      };

      next();
    });

    app.use(createSecurityMiddleware());

    app.get('/secure-endpoint', (_req, res) => {
      res.json({ ok: true });
    });

    app.use((error, _req, res, _next) => {
      capturedErrors.push(error);
      res.status(500).json({ error: error.message });
    });

    const response = await request(app).get('/secure-endpoint');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'helmet-set-header-failure' });
    expect(capturedErrors).toHaveLength(1);
    expect(capturedErrors[0]).toBeInstanceOf(Error);
    expect(capturedErrors[0].message).toBe('helmet-set-header-failure');
  });

  test('logs validator errors when response header inspection fails', async () => {
    const app = express();
    const errorLogs = [];
    const logger = {
      warn: jest.fn(),
      error: jest.fn((message, context) => {
        errorLogs.push({ message, context });
      }),
    };

    app.use(createSecurityMiddleware());
    app.use(createSecurityConfigValidator({ logger }));

    app.get('/validator-error', (_req, res) => {
      const originalGetHeader = res.getHeader.bind(res);
      res.getHeader = (name) => {
        if (name === 'Content-Security-Policy') {
          throw new Error('header-read-failure');
        }
        return originalGetHeader(name);
      };

      res.json({ ok: true });
    });

    const response = await request(app).get('/validator-error');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });

    expect(logger.error).toHaveBeenCalledWith(
      'Error checking security headers',
      expect.objectContaining({
        error: 'header-read-failure',
        method: 'GET',
        url: '/validator-error',
      })
    );

    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].message).toBe('Error checking security headers');
    expect(errorLogs[0].context).toEqual(
      expect.objectContaining({ error: 'header-read-failure' })
    );
    expect(logger.warn).not.toHaveBeenCalledWith(
      'Missing required security headers',
      expect.anything()
    );
  });
});
