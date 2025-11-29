import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { RetryManager } from '../../../src/utils/httpRetryManager.js';

/**
 * Integration tests for the shared RetryManager used by HTTP utilities.
 * These tests exercise the retry behavior with deterministic timing to
 * closely mirror how the manager behaves in production flows.
 */
describe('RetryManager HTTP integration behavior', () => {
  /** @type {{info: jest.Mock, warn: jest.Mock, error: jest.Mock, debug: jest.Mock}} */
  let logger;

  const advanceTimers = async (ms) => {
    await Promise.resolve();
    if (typeof jest.advanceTimersByTimeAsync === 'function') {
      await jest.advanceTimersByTimeAsync(ms);
    } else {
      jest.advanceTimersByTime(ms);
    }
    await Promise.resolve();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('calculates deterministic jittered delays and respects max caps', () => {
    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.5).mockReturnValueOnce(0);

    const cappedDelay = RetryManager.calculateRetryDelay(4, 100, 500);
    expect(cappedDelay).toBe(500);

    const jitteredDelay = RetryManager.calculateRetryDelay(2, 100, 1000);
    expect(jitteredDelay).toBe(160);

    expect(randomSpy).toHaveBeenCalledTimes(2);
  });

  it('retries network errors with exponential backoff and resolves when the next attempt succeeds', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const manager = new RetryManager(3, 100, 500, logger);
    const attemptFn = jest.fn(async (attempt) => {
      if (attempt === 1) {
        throw new TypeError('Failed to fetch resource');
      }
      return { status: 200, body: 'ok' };
    });
    const responseHandler = jest.fn(async (result) => ({
      retry: false,
      data: result,
    }));

    const resultPromise = manager.perform(attemptFn, responseHandler);

    await advanceTimers(100);

    const result = await resultPromise;

    expect(result).toEqual({ status: 200, body: 'ok' });
    expect(attemptFn).toHaveBeenCalledTimes(2);
    expect(responseHandler).toHaveBeenCalledWith(
      { status: 200, body: 'ok' },
      2
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toContain(
      'RetryManager: Attempt 1/3 failed with network error: Failed to fetch resource. Retrying in 100ms...'
    );
  });

  it('continues retrying when response handlers request another attempt', async () => {
    const manager = new RetryManager(2, 50, 500, logger);
    const attemptFn = jest.fn(async (attempt) => ({ attempt }));
    const responseHandler = jest.fn(async (result, attempt) => {
      if (attempt === 1) {
        return { retry: true };
      }
      return {
        retry: false,
        data: { resolvedAttempt: attempt, payload: result },
      };
    });

    const result = await manager.perform(attemptFn, responseHandler);

    expect(result).toEqual({ resolvedAttempt: 2, payload: { attempt: 2 } });
    expect(attemptFn).toHaveBeenCalledTimes(2);
    expect(responseHandler).toHaveBeenNthCalledWith(1, { attempt: 1 }, 1);
    expect(responseHandler).toHaveBeenNthCalledWith(2, { attempt: 2 }, 2);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('throws the original error when the failure is not a network error', async () => {
    const manager = new RetryManager(2, 20, 200, logger);
    const attemptFn = jest.fn(async () => {
      throw new Error('server exploded');
    });

    await expect(
      manager.perform(attemptFn, async () => ({ retry: false }))
    ).rejects.toThrow('server exploded');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('throws after exhausting retries when network errors persist', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const manager = new RetryManager(2, 20, 200, logger);
    const attemptFn = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });

    const resultPromise = manager.perform(attemptFn, async () => ({
      retry: false,
    }));
    const rejectionExpectation = await expect(resultPromise).rejects.toThrow(
      'Network request failed'
    );

    await advanceTimers(20);

    await rejectionExpectation;
    expect(attemptFn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('surfaces a descriptive error when every response requires another retry', async () => {
    const manager = new RetryManager(2, 10, 100, logger);
    const attemptFn = jest.fn(async (attempt) => `attempt-${attempt}`);
    const responseHandler = jest.fn(async () => ({ retry: true }));

    await expect(manager.perform(attemptFn, responseHandler)).rejects.toThrow(
      'RetryManager: Failed after 2 attempts with no successful result.'
    );
    expect(attemptFn).toHaveBeenCalledTimes(2);
    expect(responseHandler).toHaveBeenCalledTimes(2);
  });
});
