import { LOG_LLM_ID_UNHANDLED_ERROR } from '../src/config/constants.js';
import { describe, test, beforeEach, expect, jest } from '@jest/globals';

let app;
let expressMock;
let sendProxyError;
let errorHandler;
let consoleLoggerInstance;

beforeEach(() => {
  jest.resetModules();

  app = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    listen: jest.fn((p, cb) => cb && cb()),
  };

  expressMock = jest.fn(() => app);
  expressMock.json = jest.fn(() => 'json-mw');
  jest.doMock('express', () => ({
    __esModule: true,
    default: expressMock,
    json: expressMock.json,
  }));

  jest.doMock('cors', () => ({
    __esModule: true,
    default: jest.fn(() => 'cors-mw'),
  }));

  sendProxyError = jest.fn();
  jest.doMock('../src/utils/responseUtils.js', () => ({
    __esModule: true,
    sendProxyError,
  }));

  const ConsoleLogger = jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }));
  jest.doMock('../src/consoleLogger.js', () => ({
    __esModule: true,
    ConsoleLogger,
  }));
});

const loadServer = async () => {
  await import('../src/core/server.js');
  await new Promise((r) => setTimeout(r, 0));
  const loggerCtor = (await import('../src/consoleLogger.js')).ConsoleLogger;
  consoleLoggerInstance = loggerCtor.mock.results[0].value;
  errorHandler = app.use.mock.calls.find(
    (c) => typeof c[0] === 'function' && c[0].length === 4
  )[0];
};

describe('global error handler', () => {
  test('delegates to next if headers already sent', async () => {
    await loadServer();
    const err = new Error('boom');
    const req = { originalUrl: '/foo', method: 'GET' };
    const res = { headersSent: true };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(consoleLoggerInstance.warn).toHaveBeenCalledWith(
      "Global Error Handler: Headers already sent for this request. Delegating to Express's default error handler.",
      {
        originalErrorMessage: err.message,
        requestOriginalUrl: req.originalUrl,
        requestMethod: req.method,
      }
    );
    expect(next).toHaveBeenCalledWith(err);
    expect(sendProxyError).not.toHaveBeenCalled();
  });

  test('sends proxy error with custom status code when present', async () => {
    await loadServer();
    const err = new Error('bad');
    err.status = 418;
    const req = { originalUrl: '/foo', method: 'POST' };
    const res = { headersSent: false };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      418,
      'internal_proxy_unhandled_error',
      'An unexpected internal server error occurred in the proxy.',
      { originalErrorMessage: err.message },
      LOG_LLM_ID_UNHANDLED_ERROR,
      consoleLoggerInstance
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('defaults to 500 when provided status code is invalid', async () => {
    await loadServer();
    const err = new Error('bad');
    err.status = 900; // outside valid range
    const req = { originalUrl: '/foo', method: 'POST' };
    const res = { headersSent: false };
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(sendProxyError).toHaveBeenCalledWith(
      res,
      500,
      'internal_proxy_unhandled_error',
      'An unexpected internal server error occurred in the proxy.',
      { originalErrorMessage: err.message },
      LOG_LLM_ID_UNHANDLED_ERROR,
      consoleLoggerInstance
    );
    expect(next).not.toHaveBeenCalled();
  });
});
