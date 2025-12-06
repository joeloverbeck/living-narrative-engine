/**
 * @file proxy-api-utils.integration.test.js
 * @description Integration tests exercising the RetryManager against real HTTP
 *              interactions to ensure retry, error parsing, and network
 *              resilience behaviors behave correctly without mocking fetch.
 */

import { jest } from '@jest/globals';
import http from 'node:http';
import net from 'node:net';

import { RetryManager } from '../../src/utils/proxyApiUtils.js';

/**
 * Creates a deterministic in-memory logger that records messages for later
 * assertions while still fulfilling the ILogger contract expected by the
 * application modules.
 * @returns {{ logger: import('../../src/interfaces/coreServices.js').ILogger, records: Record<string, Array<unknown[]>> }}
 */
function createRecordingLogger() {
  const records = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  /**
   * @param {keyof typeof records} level
   * @returns {(message: string, context?: Record<string, unknown>) => void}
   */
  function record(level) {
    return (message, context) => {
      records[level].push([message, context]);
    };
  }

  return {
    logger: {
      debug: record('debug'),
      info: record('info'),
      warn: record('warn'),
      error: record('error'),
    },
    records,
  };
}

/**
 * Starts a temporary HTTP server that executes a sequence of handlers across
 * requests. Once the sequence is exhausted the final handler continues to be
 * used so that retries after success are stable.
 * @param {Array<(req: http.IncomingMessage, res: http.ServerResponse, attempt: number) => void>} handlers
 * @returns {Promise<{ url: string, close: () => Promise<void>, getAttemptCount: () => number }>}
 */
async function startSequencedServer(handlers) {
  let attempt = 0;
  const server = http.createServer((req, res) => {
    attempt += 1;
    const index = Math.min(attempt - 1, handlers.length - 1);
    handlers[index](req, res, attempt);
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const address = /** @type {{ port: number }} */ (server.address());
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    getAttemptCount: () => attempt,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/**
 * Finds an available port and immediately releases it so subsequent fetch calls
 * fail with a deterministic ECONNREFUSED error.
 * @returns {Promise<number>}
 */
async function getClosedPort() {
  return await new Promise((resolve, reject) => {
    const tempServer = net.createServer();
    tempServer.unref();
    tempServer.once('error', reject);
    tempServer.listen(0, () => {
      const address = /** @type {{ port: number }} */ (tempServer.address());
      const port = address.port;
      tempServer.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
          return;
        }
        resolve(port);
      });
    });
  });
}

describe('RetryManager integration with real HTTP interactions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries retryable HTTP failures and returns the successful JSON payload', async () => {
    const failingBody = { error: 'service unavailable' };
    const successfulBody = { message: 'ok' };

    const server = await startSequencedServer([
      (req, res) => {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(failingBody));
      },
      (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(successfulBody));
      },
    ]);

    try {
      const { logger, records } = createRecordingLogger();
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const retryManager = new RetryManager(
        `${server.url}/retry-success`,
        { method: 'GET' },
        3,
        10,
        30,
        logger
      );

      const result = await retryManager.executeWithRetry();

      expect(result).toEqual(successfulBody);
      expect(server.getAttemptCount()).toBe(2);

      const warnMessages = records.warn.map(([message]) => message);
      expect(warnMessages.some((msg) => msg.includes('Attempt 1/3'))).toBe(
        true
      );
    } finally {
      await server.close();
    }
  });

  it('surfaces non-retryable HTTP errors after parsing text fallback bodies', async () => {
    const server = await startSequencedServer([
      (req, res) => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('not allowed');
      },
    ]);

    try {
      const { logger, records } = createRecordingLogger();
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const retryManager = new RetryManager(
        `${server.url}/non-retryable`,
        { method: 'POST' },
        3,
        5,
        10,
        logger
      );

      await expect(retryManager.executeWithRetry()).rejects.toThrow(
        /status 400: status: 400, statustext: bad request/i
      );

      expect(server.getAttemptCount()).toBe(1);

      const debugMessages = records.debug.map(([message]) => message);
      expect(
        debugMessages.some((msg) =>
          msg.includes('Failed to parse error body as JSON')
        )
      ).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('retries network failures until max attempts and includes diagnostics in the final error', async () => {
    const port = await getClosedPort();
    const { logger, records } = createRecordingLogger();
    jest.spyOn(Math, 'random').mockReturnValue(0.25);

    const originalFetch = global.fetch;
    // Wrap the native fetch so we can normalize the error message produced by undici
    // into a form recognized by RetryManager's network heuristics.
    global.fetch = async (...args) => {
      try {
        return await originalFetch(...args);
      } catch (error) {
        throw new TypeError('Failed to fetch');
      }
    };

    try {
      const retryManager = new RetryManager(
        `http://127.0.0.1:${port}/network-error`,
        { method: 'GET' },
        3,
        10,
        20,
        logger
      );

      await expect(retryManager.executeWithRetry()).rejects.toThrow(
        /persistent network error/i
      );

      expect(records.warn).toHaveLength(2);
      const errorMessages = records.error.map(([message]) => message);
      expect(errorMessages[0]).toMatch(/persistent network error/i);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
