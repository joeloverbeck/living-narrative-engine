import { describe, expect, it, jest } from '@jest/globals';
import http from 'node:http';

import { RetryManager } from '../../src/utils/proxyApiUtils.js';

/**
 * Starts an HTTP server that aborts the response body mid-stream to
 * force fetch() to surface a terminated body error when callers attempt
 * to read the payload. This exercises the deepest error handling paths
 * inside the RetryManager's error parsing logic.
 *
 * @returns {Promise<{ port: number, close: () => Promise<void> }>} helper utilities
 */
async function createTerminatingServer() {
  const server = http.createServer((req, res) => {
    // Intentionally send an incomplete JSON payload and then abort the socket
    // so that response.json() fails and response.text() also rejects.
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Content-Length': '32',
    });
    res.write('{"error":"truncated_payload"');
    setTimeout(() => {
      res.destroy(new Error('intentional abort'));
    }, 5);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine server address');
  }

  return {
    port: address.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
}

function createLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

describe('RetryManager integration coverage for terminated responses', () => {
  it('logs fallback diagnostics when both JSON and text parsing of an error response fail', async () => {
    const server = await createTerminatingServer();
    const logger = createLogger();
    const targetUrl = `http://127.0.0.1:${server.port}/abort`;

    try {
      const retryManager = new RetryManager(
        targetUrl,
        { method: 'GET' },
        1,
        10,
        50,
        logger
      );

      await expect(retryManager.executeWithRetry()).rejects.toThrow(
        /failed after 1 attempt\(s\) with status 500/i
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to read error response body as JSON or text'
        )
      );
      const warnMessage = logger.warn.mock.calls[0]?.[0];
      expect(warnMessage).toContain(targetUrl);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('RetryManager: API request to')
      );
    } finally {
      await server.close();
    }
  });
});
