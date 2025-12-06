import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { sendProxyError } from '../../src/utils/responseUtils.js';

/**
 * Creates a lightweight logger interface implementation backed by Jest spies.
 * This mirrors the contract expected by sendProxyError while letting tests
 * assert on log side effects produced during error handling.
 *
 * @returns {{ debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock }}
 */
function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Builds an Express app instance that defers route registration to each test.
 * Each test attaches its own route handlers to exercise sendProxyError in
 * different operational states using real Express responses.
 *
 * @returns {import('express').Express}
 */
function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  return app;
}

describe('sendProxyError integration behaviours', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delivers structured JSON error responses when downstream handling fails', async () => {
    const logger = createTestLogger();
    const errorDetails = { attemptedFile: 'config.json', llmId: 'demo-llm' };

    app.get('/standard-failure', (req, res) => {
      sendProxyError(
        res,
        502,
        'llm_request_failed',
        'Unable to reach upstream LLM provider',
        errorDetails,
        'demo-llm',
        logger
      );
    });

    const response = await request(app).get('/standard-failure');

    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({
      error: true,
      message: 'Unable to reach upstream LLM provider',
      stage: 'llm_request_failed',
      details: errorDetails,
      originalStatusCode: 502,
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Sending error to client'),
      { errorDetailsSentToClient: errorDetails }
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs a warning without altering the response when headers already went out', async () => {
    const logger = createTestLogger();

    app.get('/late-error', (req, res) => {
      res.status(200).send('already-finished');
      sendProxyError(
        res,
        500,
        'post_response_failure',
        'Attempted to send error after response ended',
        { retryable: false },
        'llm-late',
        logger
      );
    });

    const response = await request(app).get('/late-error');

    expect(response.status).toBe(200);
    expect(response.text).toBe('already-finished');

    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('headers were already sent'),
      expect.objectContaining({
        errorDetailsNotSentDueToHeaders: { retryable: false },
      })
    );
  });

  it('falls back to a last-ditch plain text response when JSON serialization fails', async () => {
    const logger = createTestLogger();

    app.get('/json-failure', (req, res) => {
      // Simulate an underlying serializer failure before headers are flushed.
      const originalJson = res.json.bind(res);
      jest.spyOn(res, 'json').mockImplementation(() => {
        throw new Error('serializer exploded');
      });

      sendProxyError(
        res,
        503,
        'response_serialization_failure',
        'Failed to prepare JSON payload',
        undefined,
        'llm-json',
        logger
      );

      // Restore the original json method so any later fallbacks reuse core Express logic.
      res.json = originalJson;
    });

    const response = await request(app).get('/json-failure');

    expect(response.status).toBe(500);
    expect(response.text).toContain(
      'Internal Server Error: Failed to format and send detailed error response.'
    );

    // Two error logs should have been emitted: initial send + catch block.
    expect(logger.error).toHaveBeenCalledTimes(2);
    const secondErrorCall = logger.error.mock.calls[1];
    expect(secondErrorCall[0]).toContain(
      'Failed to send original error response'
    );
    expect(secondErrorCall[1]).toMatchObject({
      originalErrorIntendedForClient: expect.objectContaining({
        message: 'Failed to prepare JSON payload',
      }),
    });
  });

  it('falls back to console-based logging when no logger is supplied', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    app.get('/fallback-logger', (req, res) => {
      sendProxyError(
        res,
        418,
        'missing_logger',
        'No logger was supplied for this operation',
        null,
        undefined,
        null
      );
    });

    const response = await request(app).get('/fallback-logger');

    expect(response.status).toBe(418);
    expect(response.body).toMatchObject({
      error: true,
      message: 'No logger was supplied for this operation',
      stage: 'missing_logger',
      details: {},
      originalStatusCode: 418,
    });

    expect(errorSpy).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('does not attempt the plain text fallback when headers were committed during JSON failure', async () => {
    const logger = createTestLogger();

    app.get('/json-headers-sent', (req, res) => {
      const originalEnd = res.end.bind(res);

      jest.spyOn(res, 'json').mockImplementation(() => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.write('{"partial":');
        throw new Error('stream interrupted after headers');
      });

      sendProxyError(
        res,
        502,
        'streaming_forwarding',
        'Failed while relaying streamed response',
        { targetUrl: 'https://llm.example.com/stream' },
        'llm-stream',
        logger
      );

      if (!res.writableEnded) {
        originalEnd('"recovered"}');
      }
    });

    const response = await request(app).get('/json-headers-sent');

    expect(response.status).toBe(502);
    expect(response.text).toBe('{"partial":"recovered"}');

    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('records a critical log when both JSON and fallback plain text sends fail', async () => {
    const logger = createTestLogger();

    app.get('/double-failure', (req, res) => {
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      jest.spyOn(res, 'json').mockImplementation(() => {
        throw new Error('json failure');
      });
      jest.spyOn(res, 'send').mockImplementation(() => {
        throw new Error('send failure');
      });

      sendProxyError(
        res,
        500,
        'double_failure',
        'Every transport mechanism failed',
        { escalationLevel: 'critical' },
        'llm-double',
        logger
      );

      // Recover the response so the HTTP client receives a terminal payload.
      res.json = originalJson;
      res.send = originalSend;
      if (!res.headersSent) {
        res.status(599).send('manual recovery response');
      }
    });

    const response = await request(app).get('/double-failure');

    expect(response.status).toBe(599);
    expect(response.text).toBe('manual recovery response');

    expect(logger.error).toHaveBeenCalledTimes(3);
    const criticalLog = logger.error.mock.calls.find((call) =>
      call[0].includes(
        'CRITICAL - Failed even to send last-ditch plain text error'
      )
    );
    expect(criticalLog).toBeDefined();
    expect(criticalLog[1]).toMatchObject({
      lastDitchSendErrorDetails: expect.objectContaining({ name: 'Error' }),
    });
  });
});
