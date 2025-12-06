import { describe, it, expect, jest, afterEach } from '@jest/globals';

import { RetryManager } from '../../src/utils/proxyApiUtils.js';

jest.setTimeout(20000);

const patternsToCover = [
  'network request failed',
  'dns lookup failed',
  'socket hang up',
  'ECONNREFUSED',
  'ECONRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
];

function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

let randomSpy = null;
let fetchSpy = null;

afterEach(() => {
  if (randomSpy) {
    randomSpy.mockRestore();
    randomSpy = null;
  }

  if (fetchSpy) {
    fetchSpy.mockRestore();
    fetchSpy = null;
  }

  jest.restoreAllMocks();
});

describe('proxyApiUtils RetryManager additional network coverage', () => {
  it('falls back to reading text error bodies and defaults GET labels when method is omitted', async () => {
    const logger = createLogger();
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    const failingResponse = new Response(
      'upstream temporary failure: plain text payload',
      {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      }
    );
    jest.spyOn(failingResponse, 'json').mockImplementation(async () => {
      throw new SyntaxError('synthetic json failure');
    });

    const recoveryPayload = { recovered: true };
    const recoveryResponse = new Response(JSON.stringify(recoveryPayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(failingResponse)
      .mockResolvedValueOnce(recoveryResponse);

    const retryManager = new RetryManager(
      'http://integration.test/unstable-endpoint',
      { headers: { Accept: 'application/json' } },
      3,
      1,
      1,
      logger
    );

    const result = await retryManager.executeWithRetry();
    expect(result).toEqual(recoveryPayload);

    const debugMessages = logger.debug.mock.calls.map(([message]) => message);
    expect(
      debugMessages.some((message) => message.includes('Fetching GET'))
    ).toBe(true);
    expect(
      debugMessages.some(
        (message) =>
          message.includes('Error response body (Text):') &&
          message.includes('plain text payload')
      )
    ).toBe(true);
  });

  it('treats extended TypeError network signatures as persistent network errors', async () => {
    for (const pattern of patternsToCover) {
      const logger = createLogger();
      fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockImplementationOnce(async () => {
          throw new TypeError(pattern);
        });

      const retryManager = new RetryManager(
        'http://unreachable.integration.test/resource',
        {},
        1,
        5,
        10,
        logger
      );

      await expect(retryManager.executeWithRetry()).rejects.toThrow(
        /persistent network error: /i
      );

      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
      const [, errorContext] = logger.error.mock.calls.at(-1);
      expect(errorContext.originalErrorMessage.toLowerCase()).toContain(
        pattern.toLowerCase()
      );

      fetchSpy.mockRestore();
      fetchSpy = null;
    }
  });
});
