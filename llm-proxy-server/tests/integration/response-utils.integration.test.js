/**
 * @file response-utils.integration.test.js
 * @description Integration tests exercising sendProxyError with real Express response objects.
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { sendProxyError } from '../../src/utils/responseUtils.js';

/**
 * @returns {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}} minimal logger capturing invocations.
 */
function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('responseUtils integration', () => {
  it('sends structured JSON errors when headers remain writable', async () => {
    const logger = createTestLogger();
    const app = express();

    app.get('/json-error', (req, res) => {
      sendProxyError(
        res,
        503,
        'llm-response',
        'LLM returned invalid payload',
        {
          targetUrl: 'https://llm.example.com',
          llmApiStatusCode: 502,
        },
        'test-llm-id',
        logger
      );
    });

    const response = await request(app).get('/json-error');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: true,
      message: 'LLM returned invalid payload',
      stage: 'llm-response',
      details: {
        targetUrl: 'https://llm.example.com',
        llmApiStatusCode: 502,
      },
      originalStatusCode: 503,
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Sending error to client'),
      expect.objectContaining({
        errorDetailsSentToClient: {
          targetUrl: 'https://llm.example.com',
          llmApiStatusCode: 502,
        },
      })
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs a warning without altering the response when headers already sent', async () => {
    const logger = createTestLogger();
    const app = express();

    app.get('/headers-sent', (req, res) => {
      res.status(200);
      res.write('partial-body');

      sendProxyError(
        res,
        500,
        'post-write-stage',
        'Attempted to signal error after streaming body',
        { targetUrl: 'https://llm.example.com/stream' },
        'streaming-llm',
        logger
      );

      res.end();
    });

    const response = await request(app).get('/headers-sent');

    expect(response.status).toBe(200);
    expect(response.text).toBe('partial-body');

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Sending error to client'),
      expect.objectContaining({
        errorDetailsSentToClient: { targetUrl: 'https://llm.example.com/stream' },
      })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Attempted to send error response, but headers were already sent'),
      expect.objectContaining({
        errorDetailsNotSentDueToHeaders: { targetUrl: 'https://llm.example.com/stream' },
      })
    );
  });

  it('falls back to a plain text response when JSON serialization fails', async () => {
    const logger = createTestLogger();
    const app = express();

    app.get('/json-failure', (req, res) => {
      res.json = () => {
        throw new Error('Forced JSON serialization failure');
      };

      sendProxyError(
        res,
        502,
        'llm-forwarding',
        'Unable to reach upstream service',
        { targetUrl: 'https://llm.example.com/failure' },
        'fallback-llm',
        logger
      );
    });

    const response = await request(app).get('/json-failure');

    expect(response.status).toBe(500);
    expect(response.text).toBe(
      'Internal Server Error: Failed to format and send detailed error response.'
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL - Failed to send original error response'),
      expect.objectContaining({
        originalErrorIntendedForClient: expect.objectContaining({
          stage: 'llm-forwarding',
          originalStatusCode: 502,
        }),
      })
    );
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL - Failed even to send last-ditch plain text error'),
      expect.anything()
    );
  });

  it('skips fallback logic when the response stream was already committed', async () => {
    const logger = createTestLogger();
    const app = express();

    app.get('/json-committed', (req, res) => {
      res.json = () => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.write('{"partial":');
        throw new Error('Stream interrupted mid-flight');
      };

      sendProxyError(
        res,
        502,
        'streaming-forward',
        'Connection dropped while streaming response',
        { targetUrl: 'https://llm.example.com/streaming' },
        'stream-llm',
        logger
      );

      res.end('"truncated"}');
    });

    const response = await request(app).get('/json-committed');

    expect(response.status).toBe(502);
    expect(response.text).toBe('{"partial":"truncated"}');

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL - Failed to send original error response'),
      expect.objectContaining({
        originalErrorIntendedForClient: expect.objectContaining({
          stage: 'streaming-forward',
          originalStatusCode: 502,
        }),
      })
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs the last-ditch failure when even the plain text fallback cannot be delivered', async () => {
    const logger = createTestLogger();
    const app = express();

    app.get('/fallback-failure', (req, res) => {
      res.json = () => {
        throw new Error('Primary JSON pipeline unavailable');
      };

      res.send = () => {
        throw new Error('Underlying socket closed');
      };

      sendProxyError(
        res,
        504,
        'llm-timeout',
        'LLM timed out before responding',
        { targetUrl: 'https://llm.example.com/timeout' },
        'timeout-llm',
        logger
      );

      if (!res.headersSent) {
        res.status(500).end('route finalized after cascading failure');
      }
    });

    const response = await request(app).get('/fallback-failure');

    expect(response.status).toBe(500);
    expect(response.text).toBe('route finalized after cascading failure');

    const errorMessages = logger.error.mock.calls.map(([message]) => message);
    expect(
      errorMessages.some((message) =>
        message.includes('CRITICAL - Failed even to send last-ditch plain text error')
      )
    ).toBe(true);
  });
});
