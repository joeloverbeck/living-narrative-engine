/**
 * @file validation-middleware.integration.test.js
 * @description Integration tests covering validation middleware behavior with real Express pipelines
 */

import { describe, it, beforeEach, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  validateLlmRequest,
  validateRequestHeaders,
  handleValidationErrors,
  validateDebugLogRequest,
} from '../../src/middleware/validation.js';

const buildApp = () => {
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
        sanitizedContentType: req.headers['content-type'],
        sanitizedCustomHeader: req.headers['x-trace-id'],
        payload: req.body.targetPayload,
      });
    }
  );

  app.post(
    '/proxy/llm/header-check',
    ...validateRequestHeaders(),
    handleValidationErrors,
    (_req, res) => res.status(204).send()
  );

  app.post(
    '/debug/logs',
    express.json(),
    ...validateRequestHeaders(),
    ...validateDebugLogRequest(),
    handleValidationErrors,
    (_req, res) => res.status(202).json({ accepted: true })
  );

  return app;
};

describe('Validation middleware integration', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  it('accepts a valid LLM proxy request and sanitizes headers safely', async () => {
    const longValue = 'x'.repeat(1100);

    const response = await request(app)
      .post('/proxy/llm')
      .set('content-type', 'application/json')
      .set('x-trace-id', 'trace-identifier')
      .send({
        llmId: 'openai-gpt-4o',
        targetPayload: { prompt: 'Hello world' },
        targetHeaders: {
          __proto__: 'bad-news',
          Constructor: 'blocked',
          'Valid-Header': 'value',
          'X-New\nLine': 'should-skip',
          'X-Custom(Header)': 'custom-value',
          'Spacing Header': 'spaces',
          'Long-Header': longValue,
          Numeric: 123,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.payload).toEqual({ prompt: 'Hello world' });

    const sanitizedHeaders = response.body.sanitizedHeaders;
    expect(sanitizedHeaders).toEqual(
      expect.objectContaining({
        'Valid-Header': 'value',
        'X-CustomHeader': 'custom-value',
        SpacingHeader: 'spaces',
        'Long-Header': 'x'.repeat(1000),
        Numeric: '123',
      })
    );
    expect(Object.keys(sanitizedHeaders)).not.toContain('__proto__');
    expect(Object.keys(sanitizedHeaders)).not.toContain('Constructor');
    expect(Object.keys(sanitizedHeaders)).not.toContain('X-NewLine');

    expect(response.body.sanitizedCustomHeader).toBe('trace-identifier');
    expect(response.body.sanitizedContentType).toBe('application/json');
  });

  it('rejects invalid LLM proxy payloads with aggregated validation details', async () => {
    const response = await request(app)
      .post('/proxy/llm')
      .set('content-type', 'application/json')
      .send({
        llmId: 'bad id!',
        targetHeaders: 'not-an-object',
        unexpected: true,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Client request validation failed.');
    expect(response.body.details.validationErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'targetPayload' }),
        expect.objectContaining({ field: 'llmId' }),
        expect.objectContaining({ field: 'targetHeaders' }),
        expect.objectContaining({ message: 'Unexpected fields: unexpected' }),
      ])
    );
  });

  it('enforces JSON content-type headers for proxy routes', async () => {
    const response = await request(app)
      .post('/proxy/llm/header-check')
      .set('content-type', 'text/plain')
      .send('raw-body');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: 'Content-Type must be application/json',
      stage: 'request_validation',
    });
  });

  it('accepts well-formed debug log submissions', async () => {
    const response = await request(app)
      .post('/debug/logs')
      .set('content-type', 'application/json')
      .send({
        logs: [
          {
            level: 'info',
            message: 'startup complete',
            timestamp: new Date().toISOString(),
            category: 'lifecycle',
            metadata: { apiKey: 'sk-1234567890' },
          },
          {
            level: 'error',
            message: 'failure to reach upstream',
            timestamp: new Date().toISOString(),
            source: 'llm-proxy',
            sessionId: '550e8400-e29b-41d4-a716-446655440000',
          },
        ],
      });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ accepted: true });
  });

  it('provides precise validation errors for malformed debug log payloads', async () => {
    const response = await request(app)
      .post('/debug/logs')
      .set('content-type', 'application/json')
      .send({
        logs: [
          {
            level: 'verbose',
            timestamp: 'not-a-date',
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Client request validation failed.');
    expect(response.body.details.validationErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'logs[0].level' }),
        expect.objectContaining({ field: 'logs[0].message' }),
        expect.objectContaining({ field: 'logs[0].timestamp' }),
      ])
    );
  });
});
