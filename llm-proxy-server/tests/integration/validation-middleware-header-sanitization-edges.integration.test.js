/**
 * @file validation-middleware-header-sanitization-edges.integration.test.js
 * @description Exercises sanitizeHeaders integration paths in the validation middleware where
 *              header names collapse after cleaning or exceed configured length limits. Uses a
 *              real Express pipeline to verify the middleware interaction rather than unit-level
 *              isolation.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  handleValidationErrors,
  validateLlmRequest,
  validateRequestHeaders,
} from '../../src/middleware/validation.js';

const createApp = () => {
  const app = express();

  app.post(
    '/proxy/llm',
    express.json(),
    ...validateRequestHeaders(),
    ...validateLlmRequest(),
    handleValidationErrors,
    (req, res) => {
      res.status(200).json({
        sanitizedHeaders: req.body.targetHeaders,
      });
    }
  );

  return app;
};

describe('Validation middleware header sanitization edge cases (integration)', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  it('omits headers whose identifiers collapse or exceed limits while preserving safe entries', async () => {
    const oversizedHeaderName = `X-${'A'.repeat(150)}`;
    const disguisedConstructor = '***Constructor***';
    const newlineValueHeader = 'Value-Newline';

    const response = await request(app)
      .post('/proxy/llm')
      .set('content-type', 'application/json')
      .send({
        llmId: 'anthropic-claude-3-haiku',
        targetPayload: { prompt: 'Edge coverage scenario' },
        targetHeaders: {
          '***': 'only punctuation should be removed',
          [oversizedHeaderName]: 'oversized header name',
          [disguisedConstructor]:
            'should be treated as dangerous after cleaning',
          [newlineValueHeader]: 'value with\nnewline',
          'Safe-Header': 'safe-value',
          'Spacing-Allowed': 'preserved',
        },
      });

    expect(response.status).toBe(200);

    const sanitized = response.body.sanitizedHeaders;
    const sanitizedKeys = Object.keys(sanitized);

    expect(sanitized).toEqual(
      expect.objectContaining({
        'Safe-Header': 'safe-value',
        'Spacing-Allowed': 'preserved',
      })
    );

    expect(sanitizedKeys.some((key) => key.length === 0)).toBe(false);
    expect(oversizedHeaderName in sanitized).toBe(false);
    expect('Constructor' in sanitized).toBe(false);
    expect(newlineValueHeader in sanitized).toBe(false);
    expect('***' in sanitized).toBe(false);
  });
});
