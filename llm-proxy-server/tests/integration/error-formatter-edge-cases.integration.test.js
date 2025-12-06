import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  sanitizeErrorForClient,
  createSecureErrorDetails,
  createSecureHttpErrorResponse,
  formatErrorForLogging,
} from '../../src/utils/errorFormatter.js';

const ORIGINAL_ENV = { ...process.env };

/**
 * Builds an express app that exercises the production error formatting stack
 * across edge cases that were previously uncovered by integration tests.
 * The middleware intentionally invokes the formatting utilities with a
 * variety of inputs so that we can verify their interaction in realistic
 * HTTP error handling flows.
 * @returns {import('express').Express}
 */
function buildEdgeCaseApp() {
  const app = express();

  app.get('/string-production-default', (_req, _res, next) => {
    next('string pipeline failure');
  });

  app.get('/number-production', (_req, _res, next) => {
    next(4042);
  });

  app.get('/null-details', (_req, _res, next) => {
    const err = new Error('formatter should bail gracefully');
    next(err);
  });

  app.get('/format-no-context', (_req, _res, next) => {
    next(new Error('log without context'));
  });

  app.use((err, req, res, _next) => {
    const sanitized = sanitizeErrorForClient(err, 'edge_case_stage', null);

    let secureDetailsPayload;
    let httpErrorPayload;
    let logPayload;

    if (req.path === '/string-production-default') {
      secureDetailsPayload = createSecureErrorDetails(
        sanitized.message,
        sanitized.stage
      );
      httpErrorPayload = createSecureHttpErrorResponse(
        500,
        sanitized.stage,
        sanitized.message
      );
      logPayload = formatErrorForLogging(
        err instanceof Error ? err : new Error(String(err)),
        {
          token: 'prod-token',
          password: 'super-secret',
        }
      );
    } else if (req.path === '/number-production') {
      secureDetailsPayload = createSecureErrorDetails(
        sanitized.message,
        sanitized.stage
      );
      httpErrorPayload = createSecureHttpErrorResponse(
        500,
        sanitized.stage,
        sanitized.message
      );
      logPayload = formatErrorForLogging(
        err instanceof Error ? err : new Error(String(err)),
        {
          authorization: 'Bearer secret',
        }
      );
    } else if (req.path === '/null-details') {
      try {
        secureDetailsPayload = createSecureErrorDetails(
          sanitized.message,
          sanitized.stage,
          null,
          err instanceof Error ? err : null
        );
      } catch (formattingError) {
        secureDetailsPayload = {
          formattingFailed: true,
          reason: formattingError.message,
        };
      }

      try {
        httpErrorPayload = createSecureHttpErrorResponse(
          500,
          sanitized.stage,
          sanitized.message,
          null
        );
      } catch (formattingError) {
        httpErrorPayload = {
          error: {
            message: 'Formatter rejected details payload',
            details: formattingError.message,
            code: 'formatting_failure',
          },
        };
      }

      logPayload = formatErrorForLogging(
        err instanceof Error ? err : new Error(String(err)),
        {
          apiKey: 'sk-prod-should-mask',
        }
      );
    } else {
      secureDetailsPayload = createSecureErrorDetails(
        sanitized.message,
        sanitized.stage,
        { hint: 'logging-only' },
        err instanceof Error ? err : null
      );
      httpErrorPayload = createSecureHttpErrorResponse(
        500,
        sanitized.stage,
        sanitized.message,
        { hint: 'logging-only' },
        err instanceof Error ? err : null
      );
      logPayload = formatErrorForLogging(
        err instanceof Error ? err : new Error(String(err))
      );
    }

    res.status(500).json({
      sanitized,
      secureDetails: secureDetailsPayload,
      httpError: httpErrorPayload,
      logPayload,
    });
  });

  return app;
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('error formatter edge-case integration', () => {
  it('uses production-safe defaults for string errors without overrides', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildEdgeCaseApp();

    const response = await request(app).get('/string-production-default');

    expect(response.status).toBe(500);
    expect(response.body.sanitized).toEqual({
      message: 'Internal server error occurred',
      stage: 'edge_case_stage',
      details: {
        originalErrorMessage: 'Internal error occurred',
        errorName: 'Error',
      },
    });
    expect(response.body.secureDetails).toEqual({
      message: 'Internal server error occurred',
      stage: 'edge_case_stage',
      details: {
        originalErrorMessage: 'Internal error occurred',
      },
    });
    expect(response.body.httpError.error).toEqual({
      message: 'Internal server error occurred',
      code: 'edge_case_stage',
      details: {
        originalErrorMessage: 'Internal error occurred',
      },
    });
    expect(response.body.logPayload).toMatchObject({
      message: 'string pipeline failure',
      name: 'Error',
    });
    expect(response.body.logPayload).not.toHaveProperty('token');
    expect(response.body.logPayload).not.toHaveProperty('password');
  });

  it('treats non-error values as internal failures in production', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildEdgeCaseApp();

    const response = await request(app).get('/number-production');

    expect(response.status).toBe(500);
    expect(response.body.sanitized).toEqual({
      message: 'Unknown error occurred',
      stage: 'edge_case_stage',
      details: {
        originalErrorMessage: 'Internal error occurred',
        errorName: 'Error',
      },
    });
    expect(response.body.secureDetails.details).toEqual({
      originalErrorMessage: 'Internal error occurred',
    });
    expect(response.body.httpError.error.details).toEqual({
      originalErrorMessage: 'Internal error occurred',
    });
  });

  it('captures formatter failures when detail payloads are not objects', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildEdgeCaseApp();

    const response = await request(app).get('/null-details');

    expect(response.status).toBe(500);
    expect(response.body.secureDetails).toEqual({
      message: 'Internal server error occurred',
      stage: 'edge_case_stage',
      details: {
        originalErrorMessage: 'Internal error occurred',
      },
    });
    expect(response.body.httpError.error).toEqual({
      message: 'Internal server error occurred',
      code: 'edge_case_stage',
      details: {
        originalErrorMessage: 'Internal error occurred',
      },
    });
    expect(response.body.logPayload).not.toHaveProperty('apiKey');
  });

  it('supports logging without supplemental context when debugging locally', async () => {
    process.env.NODE_ENV = 'development';
    const app = buildEdgeCaseApp();

    const response = await request(app).get('/format-no-context');

    expect(response.status).toBe(500);
    expect(response.body.logPayload).toMatchObject({
      message: 'log without context',
      name: 'Error',
    });
    expect(response.body.logPayload).toHaveProperty('stack');
    expect(response.body.secureDetails.details).toEqual({
      hint: 'logging-only',
      originalErrorMessage: 'log without context',
    });
    expect(response.body.httpError.error.details).toEqual({
      hint: 'logging-only',
      originalErrorMessage: 'log without context',
    });
  });
});
