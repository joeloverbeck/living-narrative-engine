/**
 * @file validation-hardening.integration.test.js
 * @description Additional integration coverage for the validation middleware, exercising
 *              sanitation edge cases, debug log guard rails, and URL safety protection.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  handleValidationErrors,
  isUrlSafe,
  validateDebugLogRequest,
  validateLlmRequest,
  validateRequestHeaders,
} from '../../src/middleware/validation.js';

const buildApp = () => {
  const app = express();

  app.post(
    '/proxy/llm/hardening',
    express.json({ limit: '2mb' }),
    ...validateRequestHeaders(),
    ...validateLlmRequest(),
    handleValidationErrors,
    (req, res) => {
      const { targetHeaders, targetPayload } = req.body;
      const { targetUrl } = targetPayload;
      res.status(200).json({
        sanitizedHeaders: targetHeaders,
        urlSafety:
          typeof targetUrl === 'undefined' ? undefined : isUrlSafe(targetUrl),
      });
    }
  );

  app.post(
    '/debug/logs',
    express.json({ limit: '3mb' }),
    ...validateRequestHeaders(),
    ...validateDebugLogRequest(),
    handleValidationErrors,
    (_req, res) => res.status(202).json({ accepted: true })
  );

  app.post(
    '/proxy/llm/url-safety',
    express.json({ limit: '2mb' }),
    ...validateRequestHeaders(),
    handleValidationErrors,
    (req, res) => {
      const { urls = [] } = req.body;
      const results = urls.map((value) => ({ value, safe: isUrlSafe(value) }));
      res.json({ results });
    }
  );

  return app;
};

describe('Validation middleware hardening integration', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  it('omits headers that become dangerous after sanitization and evaluates URL safety', async () => {
    const response = await request(app)
      .post('/proxy/llm/hardening')
      .set('content-type', 'application/json')
      .send({
        llmId: 'openai-gpt-4o',
        targetPayload: { prompt: 'trace', targetUrl: 'https://example.com' },
        targetHeaders: {
          'Constructor ': 'should-be-ignored',
          'X-Safe-Header': 'value',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.urlSafety).toBe(true);
    expect(response.body.sanitizedHeaders).toEqual(
      expect.objectContaining({ 'X-Safe-Header': 'value' })
    );
    expect(Object.keys(response.body.sanitizedHeaders)).not.toContain(
      'Constructor'
    );
  });

  it('rejects empty target payloads with a specific validation message', async () => {
    const response = await request(app)
      .post('/proxy/llm/hardening')
      .set('content-type', 'application/json')
      .send({
        llmId: 'anthropic-claude-3',
        targetPayload: {},
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('targetPayload cannot be empty');
  });

  it('rejects debug log batches when the logs array is empty or exceeds the limit', async () => {
    const emptyResponse = await request(app)
      .post('/debug/logs')
      .set('content-type', 'application/json')
      .send({ logs: [] });

    expect(emptyResponse.status).toBe(400);
    expect(emptyResponse.body.message).toBe('logs array cannot be empty');

    const oversizedLogs = Array.from({ length: 5001 }, (_, index) => ({
      level: 'info',
      message: `event-${index}`,
      timestamp: new Date().toISOString(),
    }));

    const oversizedResponse = await request(app)
      .post('/debug/logs')
      .set('content-type', 'application/json')
      .send({ logs: oversizedLogs });

    expect(oversizedResponse.status).toBe(400);
    expect(oversizedResponse.body.details.validationErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'logs array cannot contain more than 5000 entries',
        }),
      ])
    );
  });

  it('guards against oversized metadata payloads in debug log submissions', async () => {
    const response = await request(app)
      .post('/debug/logs')
      .set('content-type', 'application/json')
      .send({
        logs: [
          {
            level: 'info',
            message: 'bulk upload',
            timestamp: new Date().toISOString(),
            metadata: { blob: 'a'.repeat(60000) },
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.details.validationErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'metadata object is too large (max 50KB when serialized)',
        }),
      ])
    );
  });

  it('blocks unexpected root fields on debug log requests', async () => {
    const response = await request(app)
      .post('/debug/logs')
      .set('content-type', 'application/json')
      .send({
        logs: [
          {
            level: 'warn',
            message: 'overshared payload',
            timestamp: new Date().toISOString(),
          },
        ],
        extraneous: true,
      });

    expect(response.status).toBe(400);
    expect(response.body.details.validationErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Unexpected fields in request body: extraneous',
        }),
      ])
    );
  });

  it('evaluates URL safety across protocol, host, IPv4, and IPv6 edge cases', async () => {
    const urls = [
      null,
      'notaurl',
      'ftp://example.com/resource',
      'https://localhost/diagnostics',
      'https://[::1]/loopback',
      'https://[fd00::1]/internal',
      'https://[2001:4860:4860::8888]/public',
      'https://999.0.0.1',
      'https://10.0.0.1',
      'https://172.20.5.6',
      'https://192.168.1.1',
      'https://169.254.1.1',
      'https://127.0.0.1',
      'https://0.0.0.0',
      'https://225.0.0.1',
      'https://245.0.0.1',
      'https://example.com/api',
    ];

    const response = await request(app)
      .post('/proxy/llm/url-safety')
      .set('content-type', 'application/json')
      .send({ urls });

    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([
      { value: null, safe: false },
      { value: 'notaurl', safe: false },
      { value: 'ftp://example.com/resource', safe: false },
      { value: 'https://localhost/diagnostics', safe: false },
      { value: 'https://[::1]/loopback', safe: false },
      { value: 'https://[fd00::1]/internal', safe: false },
      { value: 'https://[2001:4860:4860::8888]/public', safe: true },
      { value: 'https://999.0.0.1', safe: false },
      { value: 'https://10.0.0.1', safe: false },
      { value: 'https://172.20.5.6', safe: false },
      { value: 'https://192.168.1.1', safe: false },
      { value: 'https://169.254.1.1', safe: false },
      { value: 'https://127.0.0.1', safe: false },
      { value: 'https://0.0.0.0', safe: false },
      { value: 'https://225.0.0.1', safe: false },
      { value: 'https://245.0.0.1', safe: false },
      { value: 'https://example.com/api', safe: true },
    ]);
  });
});
