import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { RetryManager } from '../../../../../src/actions/tracing/resilience/retryManager.js';

describe('RetryManager', () => {
  let retryManager;
  let mockOperation;

  beforeEach(() => {
    retryManager = new RetryManager();
    mockOperation = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Successful operations', () => {
    it('should return result on first successful attempt', async () => {
      mockOperation.mockResolvedValue('success');

      const resultPromise = retryManager.retry(mockOperation);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should return result after retry on second attempt', async () => {
      mockOperation
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('success');

      const resultPromise = retryManager.retry(mockOperation, {
        maxAttempts: 3,
        delay: 100,
      });

      // Run all timers to completion
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Failed operations', () => {
    it('should throw error after max attempts reached', async () => {
      const error = new Error('Operation failed');
      mockOperation.mockRejectedValue(error);

      const resultPromise = retryManager.retry(mockOperation, {
        maxAttempts: 3,
        delay: 100,
      });

      // Catch the rejection to prevent unhandled rejection warning
      const caughtError = resultPromise.catch((e) => e);

      // Run all timers to completion
      await jest.runAllTimersAsync();

      // Verify the error was thrown
      const thrownError = await caughtError;
      expect(thrownError.message).toBe('Operation failed');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should throw the last error encountered', async () => {
      mockOperation
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'));

      const resultPromise = retryManager.retry(mockOperation, {
        maxAttempts: 3,
        delay: 100,
      });

      // Catch the rejection to prevent unhandled rejection warning
      const caughtError = resultPromise.catch((e) => e);

      // Run all timers to completion
      await jest.runAllTimersAsync();

      // Verify the last error was thrown
      const thrownError = await caughtError;
      expect(thrownError.message).toBe('Error 3');
    });
  });

  describe('Exponential backoff', () => {
    it('should apply exponential backoff when enabled', async () => {
      mockOperation.mockRejectedValue(new Error('Failed'));

      const delays = [];
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((fn, delay) => {
        delays.push(delay);
        return originalSetTimeout(fn, delay);
      });

      const resultPromise = retryManager.retry(mockOperation, {
        maxAttempts: 4,
        delay: 100,
        exponentialBackoff: true,
        jitter: false, // Disable jitter for predictable delays
      });

      // Immediately catch the rejection to prevent unhandled rejection
      const catchPromise = resultPromise.catch(() => {});

      await jest.runAllTimersAsync();
      await catchPromise;

      // Delays should be: 100 (2^0), 200 (2^1), 400 (2^2) for exponential backoff
      expect(delays).toEqual([100, 200, 400]);

      global.setTimeout = originalSetTimeout;
    });

    it('should use constant delay when exponential backoff disabled', async () => {
      mockOperation.mockRejectedValue(new Error('Failed'));

      const delays = [];
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((fn, delay) => {
        delays.push(delay);
        return originalSetTimeout(fn, delay);
      });

      const resultPromise = retryManager.retry(mockOperation, {
        maxAttempts: 4,
        delay: 100,
        exponentialBackoff: false,
        jitter: false,
      });

      // Immediately catch the rejection
      const catchPromise = resultPromise.catch(() => {});

      await jest.runAllTimersAsync();
      await catchPromise;

      // Delays should be constant: 100, 100, 100
      expect(delays).toEqual([100, 100, 100]);

      global.setTimeout = originalSetTimeout;
    });

    it('should respect maxDelay limit', async () => {
      mockOperation.mockRejectedValue(new Error('Failed'));

      const delays = [];
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((fn, delay) => {
        delays.push(delay);
        return originalSetTimeout(fn, delay);
      });

      const resultPromise = retryManager.retry(mockOperation, {
        maxAttempts: 6,
        delay: 1000,
        exponentialBackoff: true,
        maxDelay: 5000,
        jitter: false,
      });

      // Immediately catch the rejection
      const catchPromise = resultPromise.catch(() => {});

      await jest.runAllTimersAsync();
      await catchPromise;

      // Delays: 1000, 2000, 4000, 5000 (capped), 5000 (capped)
      expect(delays).toEqual([1000, 2000, 4000, 5000, 5000]);
      delays.forEach((delay) => {
        expect(delay).toBeLessThanOrEqual(5000);
      });

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Jitter', () => {
    it('should apply jitter when enabled', async () => {
      mockOperation.mockRejectedValue(new Error('Failed'));

      const delays = [];
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((fn, delay) => {
        delays.push(delay);
        return originalSetTimeout(fn, delay);
      });

      const resultPromise = retryManager.retry(mockOperation, {
        maxAttempts: 3,
        delay: 1000,
        exponentialBackoff: false,
        jitter: true,
      });

      // Immediately catch the rejection
      const catchPromise = resultPromise.catch(() => {});

      await jest.runAllTimersAsync();
      await catchPromise;

      // With jitter, delays should be between 500 and 1000 (50% to 100% of base)
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(500);
        expect(delay).toBeLessThanOrEqual(1000);
      });

      global.setTimeout = originalSetTimeout;
    });

    it('should not apply jitter when disabled', async () => {
      mockOperation.mockRejectedValue(new Error('Failed'));

      const delays = [];
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((fn, delay) => {
        delays.push(delay);
        return originalSetTimeout(fn, delay);
      });

      const resultPromise = retryManager.retry(mockOperation, {
        maxAttempts: 3,
        delay: 1000,
        exponentialBackoff: false,
        jitter: false,
      });

      // Immediately catch the rejection
      const catchPromise = resultPromise.catch(() => {});

      await jest.runAllTimersAsync();
      await catchPromise;

      // Without jitter, delays should be exactly 1000
      delays.forEach((delay) => {
        expect(delay).toBe(1000);
      });

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('Default options', () => {
    it('should use default options when not specified', async () => {
      mockOperation.mockRejectedValue(new Error('Failed'));

      const resultPromise = retryManager.retry(mockOperation);

      // Catch the rejection to prevent unhandled rejection warning
      const caughtError = resultPromise.catch((e) => e);

      // Run all timers to completion
      await jest.runAllTimersAsync();

      // Verify the error was thrown
      const thrownError = await caughtError;
      expect(thrownError.message).toBe('Failed');
      // Default maxAttempts is 3
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge cases', () => {
    it('should throw when configured with zero maxAttempts', async () => {
      const promise = retryManager.retry(mockOperation, { maxAttempts: 0 });

      await expect(promise).rejects.toBeUndefined();
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should handle maxAttempts of 1', async () => {
      mockOperation.mockRejectedValue(new Error('Failed'));

      const resultPromise = retryManager.retry(mockOperation, {
        maxAttempts: 1,
      });

      // Immediately attach rejection handler
      const expectPromise =
        await expect(resultPromise).rejects.toThrow('Failed');

      await jest.runAllTimersAsync();

      await expectPromise;
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should handle synchronous operations', async () => {
      mockOperation.mockReturnValue('sync-success');

      const result = await retryManager.retry(mockOperation);

      expect(result).toBe('sync-success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed sync/async failures', async () => {
      mockOperation
        .mockImplementationOnce(() => {
          throw new Error('Sync error');
        })
        .mockRejectedValueOnce(new Error('Async error'))
        .mockResolvedValueOnce('success');

      const resultPromise = retryManager.retry(mockOperation, {
        maxAttempts: 3,
        delay: 100,
      });

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Timer handling', () => {
    it('should unref timers when supported by the environment', async () => {
      const unref = jest.fn();
      const timer = { unref };

      const setTimeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((callback, ms) => {
          callback();
          return timer;
        });

      mockOperation
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('success');

      const result = await retryManager.retry(mockOperation, {
        delay: 10,
        jitter: false,
      });

      expect(result).toBe('success');
      expect(unref).toHaveBeenCalledTimes(1);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10);

      setTimeoutSpy.mockRestore();
    });
  });
});
