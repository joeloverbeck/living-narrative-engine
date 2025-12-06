import { describe, it, expect, jest, afterEach } from '@jest/globals';
import http from 'node:http';

import { RetryManager } from '../../src/utils/proxyApiUtils.js';

jest.setTimeout(15000);

/**
 * Creates a logger stub compatible with ILogger interface.
 * @returns {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}}
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Starts an HTTP server for the provided request handler and returns
 * the base URL that can be used for fetch calls.
 * @param {(req: http.IncomingMessage, res: http.ServerResponse) => void} handler
 * @returns {Promise<{ server: http.Server, baseUrl: string }>}
 */
async function startServer(handler) {
  const server = http.createServer(handler);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const addressInfo = server.address();
  if (!addressInfo || typeof addressInfo === 'string') {
    throw new Error('Unable to determine server address');
  }

  const baseUrl = `http://127.0.0.1:${addressInfo.port}`;
  return { server, baseUrl };
}

let activeServer = null;
let randomSpy = null;

afterEach(async () => {
  if (activeServer) {
    await new Promise((resolve) => activeServer.close(resolve));
    activeServer = null;
  }

  if (randomSpy) {
    randomSpy.mockRestore();
    randomSpy = null;
  }

  jest.restoreAllMocks();
});

const defaultRequestOptions = {
  method: 'GET',
  headers: { Accept: 'application/json' },
};

describe('RetryManager integration behaviour', () => {
  it('successfully returns JSON payload on first attempt', async () => {
    const { server, baseUrl } = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'ready' }));
    });
    activeServer = server;

    const logger = createLogger();
    const retryManager = new RetryManager(
      `${baseUrl}/status`,
      defaultRequestOptions,
      3,
      10,
      20,
      logger
    );

    const payload = await retryManager.executeWithRetry();

    expect(payload).toEqual({ message: 'ready' });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Successfully fetched and parsed JSON')
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Request successful')
    );
  });

  it('retries retryable HTTP failures and succeeds after subsequent attempt', async () => {
    let invocation = 0;
    const { server, baseUrl } = await startServer((_req, res) => {
      invocation += 1;
      if (invocation === 1) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'temporary outage' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: 'recovered' }));
      }
    });
    activeServer = server;

    const logger = createLogger();
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const retryManager = new RetryManager(
      `${baseUrl}/flaky`,
      defaultRequestOptions,
      4,
      5,
      15,
      logger
    );

    const payload = await retryManager.executeWithRetry();

    expect(payload).toEqual({ data: 'recovered' });
    expect(invocation).toBe(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Retrying in')
    );
  });

  it('throws an error for non-retryable HTTP status after error body parsing attempts', async () => {
    const { server, baseUrl } = await startServer((_req, res) => {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('bad input provided');
    });
    activeServer = server;

    const logger = createLogger();

    const retryManager = new RetryManager(
      `${baseUrl}/bad-request`,
      defaultRequestOptions,
      2,
      5,
      10,
      logger
    );

    await expect(retryManager.executeWithRetry()).rejects.toThrow(
      /status 400:/
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to read error response body as JSON or text'
      )
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('status 400')
    );
  });

  it('propagates persistent network failures after exhausting retries', async () => {
    const logger = createLogger();
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      throw new TypeError('failed to fetch');
    });

    const retryManager = new RetryManager(
      'http://nonexistent.invalid/network',
      defaultRequestOptions,
      2,
      5,
      10,
      logger
    );

    let caughtError;
    try {
      await retryManager.executeWithRetry();
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError.message).toMatch(/persistent network error/);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('network error')
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('persistent network error'),
      expect.objectContaining({
        originalErrorMessage: expect.any(String),
      })
    );
  });

  it('reports unexpected errors when success response contains invalid JSON', async () => {
    const { server, baseUrl } = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('this is not valid json');
    });
    activeServer = server;

    const logger = createLogger();

    const retryManager = new RetryManager(
      `${baseUrl}/invalid-json`,
      defaultRequestOptions,
      2,
      5,
      10,
      logger
    );

    await expect(retryManager.executeWithRetry()).rejects.toThrow(
      /Unexpected error: .*Unexpected token/
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Unexpected error'),
      expect.objectContaining({
        originalErrorMessage: expect.stringContaining('Unexpected token'),
        originalErrorName: 'SyntaxError',
      })
    );
  });
});
