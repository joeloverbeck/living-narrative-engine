/**
 * @file logger-utils-sanitization.integration.test.js
 * @description Integration coverage for logger utility fallbacks and secure logging wrappers.
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { sendProxyError } from '../../src/utils/responseUtils.js';
import { getEnhancedConsoleLogger } from '../../src/logging/enhancedConsoleLogger.js';

describe('logger utilities integration coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back to console-based logger when sendProxyError receives an invalid logger', async () => {
    const app = express();

    app.get('/fallback', (_req, res) => {
      const invalidLogger = { info: () => {} };

      sendProxyError(
        res,
        500,
        'fallback-stage',
        'fallback message',
        { apiKey: 'sk-live-secret' },
        'llm-fallback',
        invalidLogger
      );
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    const response = await request(app).get('/fallback').expect(500);

    expect(response.body).toEqual({
      error: true,
      message: 'fallback message',
      stage: 'fallback-stage',
      details: { apiKey: 'sk-live-secret' },
      originalStatusCode: 500,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'sendProxyError: ',
      'An invalid logger instance was provided. Falling back to console logging with prefix "sendProxyError".'
    );

    const fallbackErrorCall = errorSpy.mock.calls.find(
      (call) => call[0] === 'sendProxyError: '
    );
    expect(fallbackErrorCall).toBeDefined();
    expect(fallbackErrorCall[1]).toContain(
      'LLM Proxy Server: Sending error to client.'
    );
    expect(fallbackErrorCall[2]).toEqual({
      errorDetailsSentToClient: { apiKey: 'sk-live-secret' },
    });
  });

  it('sanitizes sensitive fields when using secure enhanced logger with sendProxyError', async () => {
    const app = express();
    const enhancedLogger = getEnhancedConsoleLogger();
    const secureLogger = enhancedLogger.createSecure();

    const infoSpy = jest.spyOn(enhancedLogger, 'info');
    const errorSpy = jest.spyOn(enhancedLogger, 'error');

    app.get('/secure', (_req, res) => {
      secureLogger.info('pre-flight', {
        apiKey: 'sk-test-api-key',
        nested: { token: 'inner-secret' },
      });

      sendProxyError(
        res,
        502,
        'secure-stage',
        'secure message',
        {
          apiKey: 'sk-secret-key',
          nested: { token: 'should-hide' },
        },
        'llm-secure',
        secureLogger
      );
    });

    const response = await request(app).get('/secure').expect(502);

    expect(response.body).toEqual({
      error: true,
      message: 'secure message',
      stage: 'secure-stage',
      details: {
        apiKey: 'sk-secret-key',
        nested: { token: 'should-hide' },
      },
      originalStatusCode: 502,
    });

    const infoCall = infoSpy.mock.calls.find(
      ([message]) => message === 'pre-flight'
    );
    expect(infoCall).toBeDefined();
    expect(infoCall[1]).toEqual({
      apiKey: 'sk-t***********',
      nested: { token: 'inne********' },
    });

    const errorCall = errorSpy.mock.calls.find(([message]) =>
      message.includes('LLM Proxy Server: Sending error to client')
    );
    expect(errorCall).toBeDefined();
    expect(errorCall[1]).toEqual({
      errorDetailsSentToClient: {
        apiKey: 'sk-s*********',
        nested: { token: 'shou*******' },
      },
    });
  });
});
