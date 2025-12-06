/**
 * @file error-formatter-non-object-details.integration.test.js
 * @description Integration tests verifying errorFormatter utilities handle non-object detail payloads.
 */

import { beforeAll, afterEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  sanitizeErrorForClient,
  createSecureHttpErrorResponse,
} from '../../src/utils/errorFormatter.js';

const ORIGINAL_ENV = { ...process.env };

/**
 * Builds an express application that routes various non-object detail payloads
 * through the error formatting helpers without mocking their dependencies.
 * @returns {import('express').Express}
 */
const buildNonObjectDetailsApp = () => {
  const app = express();

  app.get('/non-object-details', (req, res) => {
    const variant = req.query.variant || 'string';

    const rawError =
      variant === 'number' ? 42 : new Error(`non-object variant: ${variant}`);
    const sanitized = sanitizeErrorForClient(rawError, 'non_object_details');

    let detailPayload;
    switch (variant) {
      case 'null':
        detailPayload = null;
        break;
      case 'number':
        detailPayload = 101;
        break;
      default:
        detailPayload = 'raw-text-detail';
        break;
    }

    const originalError =
      rawError instanceof Error
        ? rawError
        : new Error(`non-error payload: ${rawError}`);

    const secureResponse = createSecureHttpErrorResponse(
      502,
      sanitized.stage,
      sanitized.message,
      detailPayload,
      originalError
    );

    res.status(502).json({
      variant,
      secure: secureResponse.error,
      sanitized,
      detailType: detailPayload === null ? 'null' : typeof detailPayload,
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

describe('Error formatter integration - non-object detail payloads', () => {
  it('preserves fallback metadata when detail payload is a string in production', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildNonObjectDetailsApp();

    const response = await request(app)
      .get('/non-object-details')
      .query({ variant: 'string' })
      .expect(502);

    expect(response.body.detailType).toBe('string');
    expect(response.body.secure.message).toBe('Internal server error occurred');
    expect(response.body.secure.details).toEqual({
      originalErrorMessage: 'Internal error occurred',
    });
    expect(response.body.sanitized.details).toEqual({
      originalErrorMessage: 'Internal error occurred',
      errorName: 'Error',
    });
  });

  it('handles null detail payloads without attempting to filter fields', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildNonObjectDetailsApp();

    const response = await request(app)
      .get('/non-object-details')
      .query({ variant: 'null' })
      .expect(502);

    expect(response.body.detailType).toBe('null');
    expect(response.body.secure.details).toEqual({
      originalErrorMessage: 'Internal error occurred',
    });
    expect(response.body.sanitized.details).toEqual({
      originalErrorMessage: 'Internal error occurred',
      errorName: 'Error',
    });
  });

  it('produces consistent messaging when the raw error is not an Error instance', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildNonObjectDetailsApp();

    const response = await request(app)
      .get('/non-object-details')
      .query({ variant: 'number' })
      .expect(502);

    expect(response.body.detailType).toBe('number');
    expect(response.body.secure.message).toBe('Unknown error occurred');
    expect(response.body.secure.details).toEqual({
      originalErrorMessage: 'Internal error occurred',
    });
    expect(response.body.sanitized.message).toBe('Unknown error occurred');
    expect(response.body.sanitized.details).toEqual({
      originalErrorMessage: 'Internal error occurred',
      errorName: 'Error',
    });
  });
});
