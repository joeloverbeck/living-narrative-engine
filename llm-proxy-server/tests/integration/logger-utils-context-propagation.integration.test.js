import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import {
  createSecureLogger,
  ensureValidLogger,
} from '../../src/utils/loggerUtils.js';
import { RetryManager } from '../../src/utils/proxyApiUtils.js';

/**
 * Integration coverage focusing on logger utilities collaborating with the
 * RetryManager implementation. These scenarios exercise branches that were
 * previously only validated by unit tests by ensuring that the secure logger
 * and default fallback logger behave correctly when real modules use them.
 */
describe('logger utilities context propagation with RetryManager', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  });

  test('createSecureLogger forwards undefined contexts from RetryManager without sanitization', async () => {
    const captured = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };

    const baseLogger = {
      debug: (message, context) => captured.debug.push({ message, context }),
      info: (message, context) => captured.info.push({ message, context }),
      warn: (message, context) => captured.warn.push({ message, context }),
      error: (message, context) => captured.error.push({ message, context }),
    };

    const secureLogger = createSecureLogger(baseLogger);
    const payload = { ok: true };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    });

    const retryManager = new RetryManager(
      'https://example.com/resource',
      { method: 'GET' },
      1,
      25,
      100,
      secureLogger
    );

    const result = await retryManager.executeWithRetry();
    expect(result).toEqual(payload);

    expect(captured.debug.length).toBeGreaterThanOrEqual(2);
    expect(captured.info.length).toBeGreaterThanOrEqual(1);

    expect(captured.debug.some((entry) => entry.context === undefined)).toBe(
      true
    );
    expect(captured.info.some((entry) => entry.context === undefined)).toBe(
      true
    );
    expect(captured.warn.every((entry) => entry.context === undefined)).toBe(
      true
    );
    expect(captured.error.every((entry) => entry.context === undefined)).toBe(
      true
    );
  });

  test('ensureValidLogger default fallback cooperates with RetryManager logging', async () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const fallbackLogger = ensureValidLogger();

      const payload = { ok: true };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
      });

      const retryManager = new RetryManager(
        'https://example.com/fallback',
        { method: 'POST', body: JSON.stringify({ value: 1 }) },
        1,
        10,
        20,
        fallbackLogger
      );

      const result = await retryManager.executeWithRetry();
      expect(result).toEqual(payload);

      expect(
        debugSpy.mock.calls.some(
          ([prefix, message]) =>
            prefix === 'FallbackLogger: ' &&
            typeof message === 'string' &&
            message.includes('Initiating request sequence')
        )
      ).toBe(true);

      expect(
        debugSpy.mock.calls.some(
          ([prefix, message]) =>
            prefix === 'FallbackLogger: ' &&
            typeof message === 'string' &&
            message.includes('Request successful')
        )
      ).toBe(true);

      expect(
        infoSpy.mock.calls.some(
          ([prefix, message]) =>
            prefix === 'FallbackLogger: ' &&
            typeof message === 'string' &&
            message.includes('Successfully fetched and parsed JSON')
        )
      ).toBe(true);

      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      debugSpy.mockRestore();
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
