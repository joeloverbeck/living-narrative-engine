/**
 * @file error-formatter-production-default-message.integration.test.js
 * @description Ensures production-safe messaging defaults are applied when
 *              sanitizeErrorForClient is invoked without a custom message.
 */

import { describe, it, beforeAll, afterEach, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  sanitizeErrorForClient,
  createSecureHttpErrorResponse,
  formatErrorForLogging,
} from '../../src/utils/errorFormatter.js';

const ORIGINAL_ENV = { ...process.env };

describe('Error formatter production default message integration', () => {
  beforeAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('uses the built-in production messaging when no override is supplied', async () => {
    process.env.NODE_ENV = 'production';

    const app = express();

    app.get('/default-message', (_req, _res, next) => {
      next(new Error('Sensitive failure token=abc123'));
    });

    app.use((err, req, res, _next) => {
      const sanitized = sanitizeErrorForClient(err, 'default_stage');
      const secureResponse = createSecureHttpErrorResponse(
        500,
        sanitized.stage,
        sanitized.message,
        {
          hint: 'safe-info',
          apiKey: req.header('x-api-key') || 'missing',
          token: req.header('x-token') || 'missing',
        },
        err
      );

      const logPayload = formatErrorForLogging(err, {
        token: req.header('x-token') || 'missing',
        correlationId: 'default-branch-integration',
      });

      res.status(500).json({
        ...secureResponse,
        sanitizedDetails: sanitized.details,
        logPayload,
      });
    });

    const response = await request(app)
      .get('/default-message')
      .set('x-api-key', 'sk-live-override')
      .set('x-token', 'live-token-999')
      .expect(500);

    expect(response.body.error.message).toBe('Internal server error occurred');
    expect(response.body.error.details).toEqual({
      hint: 'safe-info',
      originalErrorMessage: 'Internal error occurred',
    });
    expect(response.body.sanitizedDetails).toEqual({
      originalErrorMessage: 'Internal error occurred',
      errorName: 'Error',
    });
    expect(response.body.logPayload).toMatchObject({
      message: 'Sensitive failure token=abc123',
      name: 'Error',
      correlationId: 'default-branch-integration',
    });
    expect(response.body.logPayload).not.toHaveProperty('token');
  });
});
