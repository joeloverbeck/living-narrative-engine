/**
 * @file error-formatter-minimal-details.integration.test.js
 * @description Exercises error formatter interactions when upstream services return
 *              minimal or pre-sanitized detail payloads so we can validate the
 *              fallback logic that was previously uncovered in integration coverage.
 */

import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  createSecureErrorDetails,
  createSecureHttpErrorResponse,
  formatErrorForLogging,
  sanitizeErrorForClient,
} from '../../src/utils/errorFormatter.js';

const ORIGINAL_ENV = { ...process.env };

/**
 * Builds an express application that pipes thrown errors through the error
 * formatter utilities. The goal is to reproduce how the proxy server would
 * handle string-based provider failures that arrive without native Error
 * instances or detail payloads. We also exercise flows where upstream
 * components already populate an `originalErrorMessage` so we can ensure the
 * formatter preserves caller supplied diagnostics.
 * @returns {import('express').Express}
 */
function buildMinimalFormatterApp() {
  const app = express();

  app.get('/string-minimal', (_req, _res, next) => {
    next('Sensitive provider error: token=abc123');
  });

  app.get('/details-preserved', (req, _res, next) => {
    req.detailPayload = {
      originalErrorMessage: 'external provider failure',
      hint: 'integration-check',
      token: 'should-be-removed',
    };
    next('Upstream failure');
  });

  app.use((err, req, res, _next) => {
    const sanitized = sanitizeErrorForClient(
      err,
      'error_formatter_minimal',
      req.query.overrideMessage || null
    );

    const detailsPayload = req.detailPayload;

    const httpPayload = createSecureHttpErrorResponse(
      502,
      sanitized.stage,
      sanitized.message,
      detailsPayload,
      err instanceof Error ? err : null
    );

    const secureDetails = createSecureErrorDetails(
      sanitized.message,
      sanitized.stage,
      detailsPayload,
      err instanceof Error ? err : null
    );

    const logPayload = formatErrorForLogging(
      err instanceof Error ? err : new Error(String(err)),
      {
        token: 'log-token-should-hide',
        stackTrace: 'not-for-clients',
        correlationId: 'corr-12345',
      }
    );

    res.status(502).json({
      sanitized,
      httpPayload,
      secureDetails,
      logPayload,
    });
  });

  return app;
}

beforeAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('error formatter minimal detail integration coverage', () => {
  it('populates fallback error details when providers omit structured payloads', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildMinimalFormatterApp();

    const response = await request(app).get('/string-minimal').expect(502);

    expect(response.body.sanitized).toEqual({
      message: 'Internal server error occurred',
      stage: 'error_formatter_minimal',
      details: {
        originalErrorMessage: 'Internal error occurred',
        errorName: 'Error',
      },
    });

    expect(response.body.httpPayload.error).toEqual({
      message: 'Internal server error occurred',
      code: 'error_formatter_minimal',
      details: {
        originalErrorMessage: 'Internal error occurred',
      },
    });

    expect(response.body.secureDetails).toEqual({
      message: 'Internal server error occurred',
      stage: 'error_formatter_minimal',
      details: {
        originalErrorMessage: 'Internal error occurred',
      },
    });

    expect(response.body.logPayload).toEqual({
      message: 'Sensitive provider error: token=abc123',
      name: 'Error',
      correlationId: 'corr-12345',
    });
  });

  it('preserves caller supplied diagnostics when already present', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildMinimalFormatterApp();

    const response = await request(app).get('/details-preserved').expect(502);

    expect(response.body.sanitized).toEqual({
      message: 'Internal server error occurred',
      stage: 'error_formatter_minimal',
      details: {
        originalErrorMessage: 'Internal error occurred',
        errorName: 'Error',
      },
    });

    expect(response.body.secureDetails).toEqual({
      message: 'Internal server error occurred',
      stage: 'error_formatter_minimal',
      details: {
        originalErrorMessage: 'external provider failure',
        hint: 'integration-check',
      },
    });

    expect(response.body.httpPayload.error).toEqual({
      message: 'Internal server error occurred',
      code: 'error_formatter_minimal',
      details: {
        originalErrorMessage: 'external provider failure',
        hint: 'integration-check',
      },
    });

    expect(response.body.logPayload).toEqual({
      message: 'Upstream failure',
      name: 'Error',
      correlationId: 'corr-12345',
    });
  });
});
