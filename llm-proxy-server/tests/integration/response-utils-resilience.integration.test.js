/**
 * @file response-utils-resilience.integration.test.js
 * @description Integration tests for sendProxyError focusing on Express response behavior
 *              when interacting with real response objects and logger utilities.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { sendProxyError } from '../../src/utils/responseUtils.js';

function createTestLogger() {
  const calls = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  calls.isDebugEnabled = true;
  return calls;
}

describe('sendProxyError Express integration', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it('emits structured JSON error responses with logging metadata', async () => {
    const logger = createTestLogger();

    app.get('/structured-error', (_req, res) => {
      sendProxyError(
        res,
        418,
        'llm_proxy_stage_teapot',
        'Upstream service reported a failure.',
        { reason: 'integration-structured', llmId: 'llm-teapot' },
        'llm-teapot',
        logger
      );
    });

    const response = await request(app).get('/structured-error');

    expect(response.status).toBe(418);
    expect(response.body).toEqual({
      error: true,
      message: 'Upstream service reported a failure.',
      stage: 'llm_proxy_stage_teapot',
      details: { reason: 'integration-structured', llmId: 'llm-teapot' },
      originalStatusCode: 418,
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Sending error to client'),
      expect.objectContaining({
        errorDetailsSentToClient: {
          reason: 'integration-structured',
          llmId: 'llm-teapot',
        },
      })
    );
  });

  it('logs a warning without altering responses when headers have already been sent', async () => {
    const logger = createTestLogger();

    app.get('/headers-sent', (_req, res) => {
      res.write('partial-response');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      sendProxyError(
        res,
        500,
        'post_headers_stage',
        'Secondary failure after write.',
        { reason: 'headers-already-sent' },
        'llm-headers',
        logger
      );

      res.end();
    });

    const response = await request(app).get('/headers-sent');

    expect(response.status).toBe(200);
    expect(response.text).toBe('partial-response');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('headers were already sent'),
      expect.objectContaining({
        errorDetailsNotSentDueToHeaders: { reason: 'headers-already-sent' },
      })
    );
  });

  it('falls back to plain text delivery when JSON serialization fails', async () => {
    const logger = createTestLogger();

    app.get('/fallback-text', (_req, res) => {
      res.json = () => {
        throw new Error('Simulated serialization failure');
      };

      sendProxyError(
        res,
        502,
        'llm_provider_unreachable',
        'Unable to reach provider.',
        { targetUrl: 'https://example.invalid' },
        'llm-fallback',
        logger
      );
    });

    const response = await request(app).get('/fallback-text');

    expect(response.status).toBe(500);
    expect(response.text).toContain('Internal Server Error');

    const criticalLog = logger.error.mock.calls.find(([message]) =>
      message.includes('CRITICAL - Failed to send original error response')
    );
    expect(criticalLog).toBeDefined();
    expect(criticalLog[1]).toEqual(
      expect.objectContaining({
        originalErrorIntendedForClient: expect.objectContaining({
          stage: 'llm_provider_unreachable',
        }),
      })
    );
  });
});
