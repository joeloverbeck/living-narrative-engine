/**
 * @file error-formatter.integration.test.js
 * @description Integration tests validating secure error formatting across HTTP flows
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

/**
 * Creates an express app that converts thrown errors into secure responses
 * using the error formatter utilities. The app simulates a portion of the
 * proxy server's error handling pipeline without mocking the modules under test.
 * @returns {import('express').Express}
 */
const createTestApp = () => {
  const app = express();

  app.get('/simulate-error', (req, _res, next) => {
    const { type } = req.query;

    if (type === 'string') {
      return next('string failure occurred');
    }

    if (type === 'number') {
      return next(42);
    }

    const errorMessage =
      req.query.message || 'Sensitive failure occurred: password=top-secret';

    return next(new Error(errorMessage));
  });

  // Error handling middleware that exercises multiple branches of the formatter
  app.use((err, req, res, _next) => {
    const sanitized = sanitizeErrorForClient(
      err,
      'integration_failure',
      req.query.overrideMessage || null
    );

    const detailsArgument =
      req.query.minimal === 'true'
        ? undefined
        : {
            llmId: 'test-llm',
            hint: 'safe-info',
            apiKey: req.header('x-api-key') || 'missing',
            password: 'super-secret',
            secret: 'do-not-share',
          };

    const securePayload = createSecureHttpErrorResponse(
      500,
      sanitized.stage,
      sanitized.message,
      detailsArgument,
      err instanceof Error ? err : null
    );

    const logPayload = formatErrorForLogging(
      err instanceof Error ? err : new Error(String(err)),
      {
        apiKey: req.header('x-api-key') || 'missing',
        token: req.header('x-token') || 'integration-token',
        context: 'integration-test',
      }
    );

    res.status(500).json({
      ...securePayload,
      sanitizedDetails: sanitized.details,
      logPayload,
    });
  });

  return app;
};

beforeAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('Error formatter integration', () => {
  it('sanitizes sensitive details in production when services throw errors', async () => {
    process.env.NODE_ENV = 'production';
    const app = createTestApp();

    const response = await request(app)
      .get('/simulate-error')
      .set('x-api-key', 'sk-prod-12345')
      .set('x-token', 'prod-token-6789')
      .expect(500);

    expect(response.body.error.message).toBe('Internal server error occurred');
    expect(response.body.error.code).toBe('integration_failure');
    expect(response.body.error.details).toEqual({
      llmId: 'test-llm',
      hint: 'safe-info',
      originalErrorMessage: 'Internal error occurred',
    });

    expect(response.body.sanitizedDetails).toEqual({
      originalErrorMessage: 'Internal error occurred',
      errorName: 'Error',
    });

    expect(response.body.logPayload).toMatchObject({
      message: 'Sensitive failure occurred: password=top-secret',
      name: 'Error',
      context: 'integration-test',
    });
    expect(response.body.logPayload).not.toHaveProperty('apiKey');
    expect(response.body.logPayload).not.toHaveProperty('token');
    expect(response.body.logPayload).not.toHaveProperty('stack');
  });

  it('exposes full diagnostics in development environments', async () => {
    process.env.NODE_ENV = 'development';
    const app = createTestApp();

    const response = await request(app)
      .get('/simulate-error')
      .set('x-api-key', 'sk-dev-4444')
      .set('x-token', 'dev-token-5555')
      .expect(500);

    expect(response.body.error.message).toBe(
      'Sensitive failure occurred: password=top-secret'
    );
    expect(response.body.error.details).toEqual({
      llmId: 'test-llm',
      hint: 'safe-info',
      apiKey: 'sk-dev-4444',
      password: 'super-secret',
      secret: 'do-not-share',
      originalErrorMessage: 'Sensitive failure occurred: password=top-secret',
    });

    expect(response.body.sanitizedDetails).toEqual({
      originalErrorMessage: 'Sensitive failure occurred: password=top-secret',
      errorName: 'Error',
    });

    expect(response.body.logPayload).toMatchObject({
      message: 'Sensitive failure occurred: password=top-secret',
      name: 'Error',
      apiKey: 'sk-dev-4444',
      token: 'dev-token-5555',
      context: 'integration-test',
    });
    expect(response.body.logPayload).toHaveProperty('stack');
  });

  it('allows custom production messaging for string-based failures', async () => {
    process.env.NODE_ENV = 'production';
    const app = createTestApp();

    const response = await request(app)
      .get('/simulate-error')
      .query({ type: 'string', overrideMessage: 'Please try again later' })
      .set('x-api-key', 'sk-prod-2222')
      .expect(500);

    expect(response.body.error.message).toBe('Please try again later');
    expect(response.body.error.details).toEqual({
      llmId: 'test-llm',
      hint: 'safe-info',
      originalErrorMessage: 'Internal error occurred',
    });

    expect(response.body.sanitizedDetails).toEqual({
      originalErrorMessage: 'Internal error occurred',
      errorName: 'Error',
    });

    expect(response.body.logPayload).toMatchObject({
      message: 'string failure occurred',
      name: 'Error',
    });
    expect(response.body.logPayload).not.toHaveProperty('apiKey');
  });

  it('falls back to unknown error handling for non-string values', async () => {
    process.env.NODE_ENV = 'development';
    const app = createTestApp();

    const response = await request(app)
      .get('/simulate-error')
      .query({ type: 'number' })
      .set('x-api-key', 'sk-dev-0000')
      .expect(500);

    expect(response.body.error.message).toBe('Unknown error occurred');
    expect(response.body.error.details).toEqual({
      llmId: 'test-llm',
      hint: 'safe-info',
      apiKey: 'sk-dev-0000',
      password: 'super-secret',
      secret: 'do-not-share',
      originalErrorMessage: 'Unknown error occurred',
    });

    expect(response.body.sanitizedDetails).toEqual({
      originalErrorMessage: 'Unknown error',
      errorName: 'Error',
    });

    expect(response.body.logPayload).toMatchObject({
      message: '42',
      apiKey: 'sk-dev-0000',
      token: 'integration-token',
    });
    expect(response.body.logPayload).toHaveProperty('stack');
  });

  it('handles missing detail payloads gracefully', async () => {
    process.env.NODE_ENV = 'production';
    const app = createTestApp();

    const response = await request(app)
      .get('/simulate-error')
      .query({ minimal: 'true' })
      .expect(500);

    expect(response.body.error.message).toBe('Internal server error occurred');
    expect(response.body.error.details).toEqual({
      originalErrorMessage: 'Internal error occurred',
    });
    expect(response.body.sanitizedDetails).toEqual({
      originalErrorMessage: 'Internal error occurred',
      errorName: 'Error',
    });
    expect(response.body.logPayload).toMatchObject({
      message: 'Sensitive failure occurred: password=top-secret',
      name: 'Error',
      context: 'integration-test',
    });
    expect(response.body.logPayload).not.toHaveProperty('apiKey');
  });

  it('returns original string messages in development mode', async () => {
    process.env.NODE_ENV = 'development';
    const app = createTestApp();

    const response = await request(app)
      .get('/simulate-error')
      .query({ type: 'string' })
      .expect(500);

    expect(response.body.error.message).toBe('string failure occurred');
    expect(response.body.sanitizedDetails).toEqual({
      originalErrorMessage: 'string failure occurred',
      errorName: 'Error',
    });
  });
});
