/**
 * @file proxy-api-utils-fallback-behaviors.integration.test.js
 * @description Additional integration coverage for RetryManager focusing on
 *              error body fallbacks and network error heuristics that were not
 *              previously exercised by other integration suites.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { RetryManager } from '../../src/utils/proxyApiUtils.js';

function createRecordingLogger() {
  const records = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  const record = (level) => (message, context) => {
    records[level].push([message, context]);
  };

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

describe('RetryManager fallback behaviours', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses text fallback when JSON parsing fails without consuming the body', async () => {
    const { logger, records } = createRecordingLogger();

    global.fetch = async () => {
      const response = new Response('plain text failure payload', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'content-type': 'application/json' },
      });

      response.json = async () => {
        throw new SyntaxError('Simulated JSON parsing failure');
      };

      return response;
    };

    const retryManager = new RetryManager(
      'http://integration.test/fallback-text',
      { method: 'GET' },
      1,
      5,
      10,
      logger
    );

    await expect(retryManager.executeWithRetry()).rejects.toThrow(
      /plain text failure payload/i
    );

    const debugMessages = records.debug.map(([message]) => message);
    expect(
      debugMessages.some((message) =>
        message.includes(
          'Error response body (Text): plain text failure payload'
        )
      )
    ).toBe(true);
  });

  it('treats multiple network error signatures as retryable conditions', async () => {
    const networkMessages = [
      'Failed to Fetch',
      'NETWORK request failed',
      'DNS lookup failed',
      'socket hang up',
      'ECONNREFUSED',
      'econreset',
      'ENOTFOUND',
      'ETIMEDOUT',
    ];

    const { logger, records } = createRecordingLogger();

    for (const message of networkMessages) {
      global.fetch = async () => {
        throw new TypeError(message);
      };

      const retryManager = new RetryManager(
        `http://integration.test/network-${message.toLowerCase()}`,
        { method: 'GET' },
        1,
        5,
        10,
        logger
      );

      await expect(retryManager.executeWithRetry()).rejects.toThrow(
        /persistent network error/i
      );
    }

    expect(records.error.length).toBe(networkMessages.length);
    for (const [errorMessage] of records.error) {
      expect(errorMessage).toMatch(/persistent network error/i);
    }
  });
});
