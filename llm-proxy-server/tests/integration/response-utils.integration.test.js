/**
 * @file response-utils.integration.test.js
 * @description Integration tests exercising sendProxyError end-to-end with Express responses and real logger fallbacks.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { sendProxyError } from '../../src/utils/responseUtils.js';

const createTestLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('Response utils integration', () => {
  let app;

  beforeEach(() => {
    app = express();
  });

  afterEach(() => {
    app = null;
  });

  it('sends structured JSON errors using the console fallback logger when none is provided', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    app.get('/standard-error', (_req, res) => {
      sendProxyError(
        res,
        422,
        'validation_stage',
        'Invalid payload',
        { field: 'prompt', reason: 'missing', secret: 'abc123' },
        'llm-standard',
        null
      );
    });

    const response = await request(app).get('/standard-error');

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: true,
      message: 'Invalid payload',
      stage: 'validation_stage',
      details: { field: 'prompt', reason: 'missing', secret: 'abc123' },
      originalStatusCode: 422,
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'sendProxyError: ',
      expect.stringContaining('LLM Proxy Server: Sending error to client. LLM ID for log: llm-standard'),
      { errorDetailsSentToClient: { field: 'prompt', reason: 'missing', secret: 'abc123' } }
    );
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('logs a warning and leaves the original response intact when headers were already sent', async () => {
    const logger = createTestLogger();

    app.get('/headers-sent', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.write('partial response');

      sendProxyError(
        res,
        503,
        'late_pipeline_stage',
        'Unable to revise response',
        { attempt: 'late-stage' },
        'llm-late',
        logger
      );

      res.end();
    });

    const response = await request(app).get('/headers-sent');

    expect(response.status).toBe(200);
    expect(response.text).toBe('partial response');

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('LLM Proxy Server: Sending error to client. LLM ID for log: llm-late'),
      { errorDetailsSentToClient: { attempt: 'late-stage' } }
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Attempted to send error response, but headers were already sent. LLM ID for log: llm-late'),
      { errorDetailsNotSentDueToHeaders: { attempt: 'late-stage' } }
    );
  });

  it('falls back to plain text when JSON serialization fails and logs the chained failures', async () => {
    const logger = createTestLogger();

    app.get('/json-failure', (_req, res) => {
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      const originalStatus = res.status.bind(res);

      const jsonFailure = new Error('json formatting broke');
      res.json = () => {
        throw jsonFailure;
      };

      const fallbackSendFailure = new Error('send failed');
      res.send = () => {
        throw fallbackSendFailure;
      };

      res.status = (code) => {
        originalStatus(code);
        return res;
      };

      sendProxyError(
        res,
        502,
        'downstream_failure',
        'Downstream service failure',
        { token: 'secret-123' },
        'llm-down',
        logger
      );

      // Complete the HTTP response so SuperTest can finish once error handling paths run.
      originalStatus(500);
      originalSend('ultimate fallback');
    });

    const response = await request(app).get('/json-failure');

    expect(response.status).toBe(500);
    expect(response.text).toBe('ultimate fallback');

    expect(logger.error).toHaveBeenCalledTimes(3);
    expect(logger.error.mock.calls[0][0]).toContain('LLM Proxy Server: Sending error to client. LLM ID for log: llm-down');
    expect(logger.error.mock.calls[1][0]).toContain('CRITICAL - Failed to send original error response to client. LLM ID for log: llm-down');
    expect(logger.error.mock.calls[1][1]).toMatchObject({
      failureToSendDetails: { name: 'Error', stack: expect.any(String) },
    });
    expect(logger.error.mock.calls[2][0]).toContain('CRITICAL - Failed even to send last-ditch plain text error. LLM ID for log: llm-down');
  });
});
