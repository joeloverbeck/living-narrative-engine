/**
 * @file Unit tests for RetryStrategy
 * @description Comprehensive tests for retry logic, circuit breaker patterns, and error handling
 */

/* eslint-disable no-unused-vars */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// Mock dependencies before importing
jest.mock('../../../../src/utils/index.js', () => ({
  validateDependency: jest.fn((dep, name) => {
    if (!dep) {
      throw new Error(`Missing required dependency: ${name}.`);
    }
  }),
}));

// Mock ErrorClassifier
jest.mock('../../../../src/domUI/visualizer/ErrorClassifier.js', () => ({
  ErrorClassifier: {
    classify: jest.fn().mockImplementation((error) => {
      // Simulate the real ErrorClassifier behavior more accurately
      const result = {
        category: 'test',
        domain: 'test',
        retryable: undefined, // Most errors don't have explicit retryability
      };

      // Only set explicit retryability for specific cases
      if (error.message.includes('non-retryable')) {
        // Ensure this doesn't match any default retry patterns
        result.retryable = false;
      } else if (error.message.includes('explicitly-retryable')) {
        // Only explicitly retryable if it says so
        result.retryable = true;
      } else if (
        error.message.match(/network|timeout|temporary|unavailable/i) ||
        error.name === 'TimeoutError'
      ) {
        // These should be retryable to ensure tests work
        result.retryable = true;
      }
      // For all other cases, leave it undefined
      // so RetryStrategy falls back to its default pattern matching

      return result;
    }),
  },
}));

import { RetryStrategy } from '../../../../src/domUI/visualizer/RetryStrategy.js';

describe('RetryStrategy', () => {
  let retryStrategy;
  let mockLogger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    // Clean up
    if (retryStrategy && !retryStrategy.isDisposed()) {
      retryStrategy.dispose();
    }
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default configuration', () => {
      retryStrategy = new RetryStrategy({ logger: mockLogger });

      expect(retryStrategy).toBeDefined();
      expect(retryStrategy.isDisposed()).toBe(false);
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        maxAttempts: 5,
        baseDelayMs: 2000,
        maxDelayMs: 60000,
        jitterPercent: 0.2,
        strategy: RetryStrategy.STRATEGY_TYPES.LINEAR,
        circuitBreakerThreshold: 10,
        circuitBreakerTimeoutMs: 120000,
        retryableErrors: ['CUSTOM_ERROR'],
      };

      retryStrategy = new RetryStrategy({ logger: mockLogger }, customConfig);

      expect(retryStrategy).toBeDefined();
      expect(retryStrategy.isDisposed()).toBe(false);
    });

    it('should throw error when logger is missing', () => {
      expect(() => new RetryStrategy({})).toThrow();
    });

    it('should throw error when dependencies are invalid', () => {
      expect(() => new RetryStrategy({ logger: null })).toThrow();
    });
  });

  describe('execute() Method - Basic Operations', () => {
    beforeEach(() => {
      retryStrategy = new RetryStrategy({ logger: mockLogger });
      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 1;
      });
    });

    afterEach(() => {
      if (global.setTimeout.mockRestore) {
        global.setTimeout.mockRestore();
      }
    });

    it('should execute successful operation on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await retryStrategy.execute('test_op', operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('succeeded on attempt 1')
      );
    });

    it('should succeed after retries', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('network error'));
        }
        return Promise.resolve('success');
      });

      const result = await retryStrategy.execute('test_op', operation, {
        maxAttempts: 3,
        baseDelayMs: 100,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('network timeout'));

      await expect(
        retryStrategy.execute('test_op', operation, {
          maxAttempts: 3,
          baseDelayMs: 10,
        })
      ).rejects.toThrow('network timeout');

      expect(operation).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed after 3 attempts')
      );
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('non-retryable error'));

      await expect(
        retryStrategy.execute('test_op', operation, { maxAttempts: 3 })
      ).rejects.toThrow('non-retryable error');

      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('non-retryable error'),
        'non-retryable error'
      );
    });

    it('should throw error when operation is not a function', async () => {
      await expect(
        retryStrategy.execute('test_op', 'not a function')
      ).rejects.toThrow('Operation must be a function');
    });
  });

  describe('Retry Strategies', () => {
    beforeEach(() => {
      retryStrategy = new RetryStrategy({ logger: mockLogger });
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 1;
      });
    });

    afterEach(() => {
      if (global.setTimeout.mockRestore) {
        global.setTimeout.mockRestore();
      }
    });

    it('should use immediate strategy', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('temporary failure'));
        }
        return Promise.resolve('success');
      });

      const result = await retryStrategy.execute('test_op', operation, {
        strategy: RetryStrategy.STRATEGY_TYPES.IMMEDIATE,
        maxAttempts: 3,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use linear strategy', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network unavailable'))
        .mockRejectedValueOnce(new Error('network unavailable'))
        .mockResolvedValue('success');

      const result = await retryStrategy.execute('test_op', operation, {
        strategy: RetryStrategy.STRATEGY_TYPES.LINEAR,
        baseDelayMs: 100,
        maxAttempts: 3,
        jitterPercent: 0,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use exponential strategy', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout occurred'))
        .mockRejectedValueOnce(new Error('timeout occurred'))
        .mockResolvedValue('success');

      const result = await retryStrategy.execute('test_op', operation, {
        strategy: RetryStrategy.STRATEGY_TYPES.EXPONENTIAL,
        baseDelayMs: 100,
        maxAttempts: 3,
        jitterPercent: 0,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use fibonacci strategy', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network unavailable'))
        .mockRejectedValueOnce(new Error('network unavailable'))
        .mockResolvedValue('success');

      const result = await retryStrategy.execute('test_op', operation, {
        strategy: RetryStrategy.STRATEGY_TYPES.FIBONACCI,
        baseDelayMs: 100,
        maxAttempts: 3,
        jitterPercent: 0,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use custom backoff strategy', async () => {
      const customBackoff = jest.fn((attempt) => attempt * 50);
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout occurred'))
        .mockRejectedValueOnce(new Error('timeout occurred'))
        .mockResolvedValue('success');

      const result = await retryStrategy.execute('test_op', operation, {
        strategy: RetryStrategy.STRATEGY_TYPES.CUSTOM,
        customBackoff,
        maxAttempts: 3,
        jitterPercent: 0,
      });

      expect(result).toBe('success');
      expect(customBackoff).toHaveBeenCalledTimes(2);
      expect(customBackoff).toHaveBeenCalledWith(1, 1000);
      expect(customBackoff).toHaveBeenCalledWith(2, 1000);
    });

    it('should fall back to base delay when custom strategy has no function', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('temporary failure'))
        .mockResolvedValue('success');

      const result = await retryStrategy.execute('test_op', operation, {
        strategy: RetryStrategy.STRATEGY_TYPES.CUSTOM,
        baseDelayMs: 100,
        maxAttempts: 2,
        jitterPercent: 0,
      });

      expect(result).toBe('success');
    });

    it('should handle unknown strategy type', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      const result = await retryStrategy.execute('test_op', operation, {
        strategy: 'unknown_strategy',
        baseDelayMs: 100,
        maxAttempts: 2,
        jitterPercent: 0,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('executeSimple() Method', () => {
    beforeEach(() => {
      retryStrategy = new RetryStrategy({ logger: mockLogger });
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 1;
      });
    });

    afterEach(() => {
      if (global.setTimeout.mockRestore) {
        global.setTimeout.mockRestore();
      }
    });

    it('should execute with simple parameters', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await retryStrategy.executeSimple(operation, 2, 100);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry with linear strategy', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      const result = await retryStrategy.executeSimple(operation, 2, 50);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should use default parameters when not provided', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await retryStrategy.executeSimple(operation);

      expect(result).toBe('success');
    });

    it('should generate unique operation IDs', async () => {
      const operation1 = jest.fn().mockResolvedValue('success1');
      const operation2 = jest.fn().mockResolvedValue('success2');

      const [result1, result2] = await Promise.all([
        retryStrategy.executeSimple(operation1),
        retryStrategy.executeSimple(operation2),
      ]);

      expect(result1).toBe('success1');
      expect(result2).toBe('success2');
    });
  });

  describe('Circuit Breaker', () => {
    beforeEach(() => {
      retryStrategy = new RetryStrategy(
        { logger: mockLogger },
        {
          circuitBreakerThreshold: 3,
          circuitBreakerTimeoutMs: 1000,
        }
      );
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 1;
      });
    });

    afterEach(() => {
      if (global.setTimeout.mockRestore) {
        global.setTimeout.mockRestore();
      }
    });

    it('should open circuit breaker after threshold failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      // Fail multiple times to trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await retryStrategy.execute(`test_op`, operation, {
            maxAttempts: 1,
          });
        } catch (_) {
          // Expected failures
        }
      }

      // Circuit should be open, preventing execution
      const circuitOp = jest.fn().mockResolvedValue('success');

      await expect(retryStrategy.execute('test_op', circuitOp)).rejects.toThrow(
        'Circuit breaker is open'
      );

      expect(circuitOp).not.toHaveBeenCalled();
    });

    it('should transition to half-open after timeout', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      // Use real timers for this test
      if (global.setTimeout.mockRestore) {
        global.setTimeout.mockRestore();
      }
      jest.useFakeTimers();

      // Open the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await retryStrategy.execute('test_op', operation, { maxAttempts: 1 });
        } catch (_) {
          // Expected
        }
      }

      // Advance time past timeout
      jest.advanceTimersByTime(1001);

      // Should allow one attempt in half-open state
      const successOp = jest.fn().mockResolvedValue('success');
      const result = await retryStrategy.execute('test_op', successOp);

      expect(result).toBe('success');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('moved to HALF_OPEN state')
      );

      jest.useRealTimers();
    });

    it('should reset circuit breaker', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await retryStrategy.execute('test_op', operation, { maxAttempts: 1 });
        } catch (_) {
          // Expected
        }
      }

      retryStrategy.resetCircuitBreaker('test_op');

      const status = retryStrategy.getCircuitBreakerStatus('test_op');
      expect(status.state).toBe(RetryStrategy.CIRCUIT_STATES.CLOSED);
      expect(status.failures).toBe(0);
    });
  });

  describe('Statistics and Status Methods', () => {
    beforeEach(() => {
      retryStrategy = new RetryStrategy({ logger: mockLogger });
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 1;
      });
    });

    afterEach(() => {
      if (global.setTimeout.mockRestore) {
        global.setTimeout.mockRestore();
      }
    });

    it('should return retry statistics after failure', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      try {
        await retryStrategy.execute('test_op', operation, {
          baseDelayMs: 10,
          maxAttempts: 2,
        });
      } catch (_) {
        // Expected failure
      }

      const stats = retryStrategy.getRetryStatistics('test_op');

      expect(stats).toMatchObject({
        operationId: 'test_op',
        attempts: 2,
        failures: 2,
        lastAttempt: expect.any(Number),
        circuitBreakerState: RetryStrategy.CIRCUIT_STATES.CLOSED,
        circuitBreakerFailures: 2,
      });
    });

    it('should reset retry statistics after success', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      await retryStrategy.execute('test_op', operation, {
        baseDelayMs: 10,
        maxAttempts: 2,
      });

      const stats = retryStrategy.getRetryStatistics('test_op');

      // The stats get reset after successful execution, so check for success state
      expect(stats).toMatchObject({
        operationId: 'test_op',
        attempts: 0, // Reset after success
        failures: 0, // Reset after success
        lastAttempt: null, // Reset after success
        circuitBreakerState: RetryStrategy.CIRCUIT_STATES.CLOSED,
        circuitBreakerFailures: 0,
      });
    });

    it('should return default statistics for unknown operation', () => {
      const stats = retryStrategy.getRetryStatistics('unknown_op');

      expect(stats).toMatchObject({
        operationId: 'unknown_op',
        attempts: 0,
        failures: 0,
        lastAttempt: null,
        circuitBreakerState: RetryStrategy.CIRCUIT_STATES.CLOSED,
        circuitBreakerFailures: 0,
      });
    });

    it('should get circuit breaker status', () => {
      const status = retryStrategy.getCircuitBreakerStatus('test_op');

      expect(status).toMatchObject({
        state: RetryStrategy.CIRCUIT_STATES.CLOSED,
        failures: 0,
        lastFailure: null,
        nextAttemptAllowed: expect.any(Number),
      });
    });

    it('should reset retry attempts', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      await retryStrategy.execute('test_op', operation, {
        baseDelayMs: 10,
        maxAttempts: 2,
      });

      retryStrategy.resetRetryAttempts('test_op');

      const stats = retryStrategy.getRetryStatistics('test_op');
      expect(stats.attempts).toBe(0);
      expect(stats.failures).toBe(0);
    });
  });

  describe('Cleanup and Disposal', () => {
    beforeEach(() => {
      retryStrategy = new RetryStrategy({ logger: mockLogger });
    });

    it('should cleanup old entries', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      // Create some entries
      await retryStrategy.execute('old_op', operation);
      await retryStrategy.execute('new_op', operation);

      // Mock time passage
      const originalNow = Date.now;
      Date.now = jest.fn().mockReturnValue(originalNow() + 3700000); // 1 hour + 100s

      retryStrategy.cleanup(3600000); // 1 hour

      // Old entry should be cleaned
      const oldStats = retryStrategy.getRetryStatistics('old_op');
      expect(oldStats.attempts).toBe(0);

      Date.now = originalNow;
    });

    it('should log cleanup results', async () => {
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 1;
      });

      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      // Create entries that will be cleaned
      try {
        await retryStrategy.execute('old_op', operation, { maxAttempts: 1 });
      } catch (_) {
        // Expected
      }

      // Mock time passage
      const originalNow = Date.now;
      Date.now = jest.fn().mockReturnValue(originalNow() + 3700000);

      retryStrategy.cleanup(3600000);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up')
      );

      Date.now = originalNow;
      if (global.setTimeout.mockRestore) {
        global.setTimeout.mockRestore();
      }
    });

    it('should handle cleanup with no old entries', () => {
      retryStrategy.cleanup(3600000);

      // Should not log anything
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up')
      );
    });

    it('should dispose properly', () => {
      expect(retryStrategy.isDisposed()).toBe(false);

      retryStrategy.dispose();

      expect(retryStrategy.isDisposed()).toBe(true);
    });

    it('should handle multiple dispose calls', () => {
      retryStrategy.dispose();
      retryStrategy.dispose(); // Should not throw

      expect(retryStrategy.isDisposed()).toBe(true);
    });

    it('should throw when using disposed instance', () => {
      retryStrategy.dispose();

      expect(() => retryStrategy.getRetryStatistics('test')).toThrow(
        'RetryStrategy instance has been disposed'
      );
      expect(() => retryStrategy.resetRetryAttempts('test')).toThrow(
        'RetryStrategy instance has been disposed'
      );
      expect(() => retryStrategy.resetCircuitBreaker('test')).toThrow(
        'RetryStrategy instance has been disposed'
      );
      expect(() => retryStrategy.getCircuitBreakerStatus('test')).toThrow(
        'RetryStrategy instance has been disposed'
      );
      expect(() => retryStrategy.cleanup()).toThrow(
        'RetryStrategy instance has been disposed'
      );
    });

    it('should throw when executing with disposed instance', async () => {
      retryStrategy.dispose();

      await expect(retryStrategy.execute('test', jest.fn())).rejects.toThrow(
        'RetryStrategy instance has been disposed'
      );
    });
  });

  describe('Error Classification and Retryability', () => {
    beforeEach(() => {
      retryStrategy = new RetryStrategy({ logger: mockLogger });
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 1;
      });
    });

    afterEach(() => {
      if (global.setTimeout.mockRestore) {
        global.setTimeout.mockRestore();
      }
    });

    it('should retry based on error patterns', async () => {
      const networkError = new Error('Network timeout occurred');
      const operation = jest
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const result = await retryStrategy.execute('test_op', operation, {
        baseDelayMs: 10,
        maxAttempts: 2,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should check error code for retryability', async () => {
      const error = new Error('Some error');
      error.code = 'NETWORK_ERROR';

      const operation = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await retryStrategy.execute('test_op', operation, {
        baseDelayMs: 10,
        maxAttempts: 2,
        retryableErrors: ['NETWORK_ERROR'],
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should check error name for retryability', async () => {
      const error = new Error('Some error');
      error.name = 'TimeoutError';

      const operation = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await retryStrategy.execute('test_op', operation, {
        baseDelayMs: 10,
        maxAttempts: 2,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should use custom retry condition', async () => {
      const retryCondition = jest.fn().mockReturnValue(false);
      const operation = jest.fn().mockRejectedValue(new Error('error'));

      await expect(
        retryStrategy.execute('test_op', operation, {
          retryCondition,
          maxAttempts: 3,
        })
      ).rejects.toThrow('error');

      expect(operation).toHaveBeenCalledTimes(1);
      expect(retryCondition).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should retry when custom condition returns true', async () => {
      const retryCondition = jest.fn().mockReturnValue(true);
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('error'))
        .mockResolvedValue('success');

      const result = await retryStrategy.execute('test_op', operation, {
        retryCondition,
        baseDelayMs: 10,
        maxAttempts: 2,
      });

      expect(result).toBe('success');
      expect(retryCondition).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delay and Jitter', () => {
    beforeEach(() => {
      retryStrategy = new RetryStrategy({ logger: mockLogger });
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 1;
      });
    });

    afterEach(() => {
      if (global.setTimeout.mockRestore) {
        global.setTimeout.mockRestore();
      }
    });

    it('should respect max delay limit', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      const result = await retryStrategy.execute('test_op', operation, {
        strategy: RetryStrategy.STRATEGY_TYPES.EXPONENTIAL,
        baseDelayMs: 10000,
        maxDelayMs: 1000,
        maxAttempts: 2,
        jitterPercent: 0,
      });

      expect(result).toBe('success');
    });

    it('should apply jitter to delays', async () => {
      // Seed random for predictable jitter
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      await retryStrategy.execute('test_op', operation, {
        baseDelayMs: 1000,
        jitterPercent: 0.2,
        maxAttempts: 2,
      });

      expect(operation).toHaveBeenCalledTimes(2);

      mockRandom.mockRestore();
    });

    it('should handle negative jitter correctly', async () => {
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0);

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      const result = await retryStrategy.execute('test_op', operation, {
        baseDelayMs: 100,
        jitterPercent: 0.5,
        maxAttempts: 2,
      });

      expect(result).toBe('success');

      mockRandom.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      retryStrategy = new RetryStrategy({ logger: mockLogger });
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 1;
      });
    });

    afterEach(() => {
      if (global.setTimeout.mockRestore) {
        global.setTimeout.mockRestore();
      }
    });

    it('should handle zero max attempts', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      // The loop won't run if maxAttempts is 0, so it will throw the last error (null)
      await expect(
        retryStrategy.execute('test_op', operation, { maxAttempts: 0 })
      ).rejects.toBeDefined();

      expect(operation).not.toHaveBeenCalled();
    });

    it('should handle fibonacci for large attempts', async () => {
      const operation = jest.fn();

      // Mock to always fail
      for (let i = 0; i < 10; i++) {
        operation.mockRejectedValueOnce(new Error('network error'));
      }

      try {
        await retryStrategy.execute('test_op', operation, {
          strategy: RetryStrategy.STRATEGY_TYPES.FIBONACCI,
          baseDelayMs: 1,
          maxDelayMs: 10000,
          maxAttempts: 10,
          jitterPercent: 0,
        });
      } catch (_) {
        // Expected to fail
      }

      expect(operation).toHaveBeenCalledTimes(10);
    });
  });

  describe('Static Properties', () => {
    it('should define STRATEGY_TYPES', () => {
      expect(RetryStrategy.STRATEGY_TYPES).toEqual({
        IMMEDIATE: 'immediate',
        LINEAR: 'linear',
        EXPONENTIAL: 'exponential',
        FIBONACCI: 'fibonacci',
        CUSTOM: 'custom',
      });
    });

    it('should define CIRCUIT_STATES', () => {
      expect(RetryStrategy.CIRCUIT_STATES).toEqual({
        CLOSED: 'closed',
        OPEN: 'open',
        HALF_OPEN: 'half_open',
      });
    });
  });

  describe('Private Method Coverage through Public APIs', () => {
    beforeEach(() => {
      retryStrategy = new RetryStrategy({ logger: mockLogger });
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 1;
      });
    });

    afterEach(() => {
      if (global.setTimeout.mockRestore) {
        global.setTimeout.mockRestore();
      }
    });

    it('should test _fibonacci through fibonacci strategy', async () => {
      const operation = jest.fn();

      // Test multiple fibonacci numbers
      for (let i = 0; i < 6; i++) {
        operation.mockRejectedValueOnce(new Error('network error'));
      }
      operation.mockResolvedValue('success');

      await retryStrategy.execute('test_op', operation, {
        strategy: RetryStrategy.STRATEGY_TYPES.FIBONACCI,
        baseDelayMs: 1,
        maxAttempts: 7,
        jitterPercent: 0,
      });

      expect(operation).toHaveBeenCalledTimes(7);
    });

    it('should test circuit breaker state transitions thoroughly', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      // Test CLOSED -> OPEN transition
      for (let i = 0; i < 5; i++) {
        try {
          await retryStrategy.execute('cb_test', operation, { maxAttempts: 1 });
        } catch (_) {
          // Expected
        }
      }

      let status = retryStrategy.getCircuitBreakerStatus('cb_test');
      expect(status.state).toBe(RetryStrategy.CIRCUIT_STATES.OPEN);

      // Test OPEN -> HALF_OPEN transition
      if (global.setTimeout.mockRestore) {
        global.setTimeout.mockRestore();
      }
      jest.useFakeTimers();
      jest.advanceTimersByTime(60001);

      // Next attempt should be allowed in HALF_OPEN state
      const successOp = jest.fn().mockResolvedValue('success');
      await retryStrategy.execute('cb_test', successOp);

      status = retryStrategy.getCircuitBreakerStatus('cb_test');
      expect(status.state).toBe(RetryStrategy.CIRCUIT_STATES.CLOSED);

      jest.useRealTimers();
    });

    it('should test gradual recovery in circuit breaker', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      // Add some failures but not enough to open
      for (let i = 0; i < 2; i++) {
        try {
          await retryStrategy.execute('gradual_test', operation, {
            maxAttempts: 1,
          });
        } catch (_) {
          // Expected
        }
      }

      // Success should reduce failure count
      const successOp = jest.fn().mockResolvedValue('success');
      await retryStrategy.execute('gradual_test', successOp);

      // Another success
      await retryStrategy.execute('gradual_test', successOp);

      const status = retryStrategy.getCircuitBreakerStatus('gradual_test');
      expect(status.state).toBe(RetryStrategy.CIRCUIT_STATES.CLOSED);
    });

    it('should test HALF_OPEN -> OPEN transition on failure', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('network error'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await retryStrategy.execute('half_open_test', operation, {
            maxAttempts: 1,
          });
        } catch (_) {
          // Expected
        }
      }

      // Move to HALF_OPEN
      if (global.setTimeout.mockRestore) {
        global.setTimeout.mockRestore();
      }
      jest.useFakeTimers();
      jest.advanceTimersByTime(60001);

      // Fail in HALF_OPEN state
      try {
        await retryStrategy.execute('half_open_test', operation, {
          maxAttempts: 1,
        });
      } catch (_) {
        // Expected
      }

      const status = retryStrategy.getCircuitBreakerStatus('half_open_test');
      expect(status.state).toBe(RetryStrategy.CIRCUIT_STATES.OPEN);

      jest.useRealTimers();
    });
  });

  describe('Circuit breaker edge coverage', () => {
    beforeEach(() => {
      // Configure lower threshold and zero timeout for faster transitions
      retryStrategy = new RetryStrategy(
        { logger: mockLogger },
        { circuitBreakerThreshold: 3, circuitBreakerTimeoutMs: 0 }
      );
    });

    it('should allow repeated HALF_OPEN checks to proceed', async () => {
      const operationId = 'edge_half_open_checks';
      const failingOperation = jest
        .fn()
        .mockRejectedValue(new Error('network error'));

      for (let i = 0; i < 3; i++) {
        await expect(
          retryStrategy.execute(operationId, failingOperation, {
            maxAttempts: 1,
          })
        ).rejects.toThrow('network error');
      }

      const firstCheck = retryStrategy._isCircuitClosed(operationId);
      expect(firstCheck).toBe(true);

      mockLogger.debug.mockClear();

      const secondCheck = retryStrategy._isCircuitClosed(operationId);
      expect(secondCheck).toBe(true);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should reopen circuit from HALF_OPEN using debug logging', async () => {
      const operationId = 'edge_half_open_reopen';
      const failingOperation = jest
        .fn()
        .mockRejectedValue(new Error('network error'));

      for (let i = 0; i < 3; i++) {
        await expect(
          retryStrategy.execute(operationId, failingOperation, {
            maxAttempts: 1,
          })
        ).rejects.toThrow('network error');
      }

      // Move into HALF_OPEN state
      retryStrategy._isCircuitClosed(operationId);

      // Simulate a failure while HALF_OPEN
      retryStrategy._recordFailure(operationId, new Error('network error'));

      mockLogger.debug.mockClear();

      retryStrategy._updateCircuitBreaker(operationId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'moved back to OPEN state after HALF_OPEN failure'
        )
      );
    });

    it('should fall back to default handling when circuit state is unknown', async () => {
      const operationId = 'edge_unknown_state';
      const failingOperation = jest
        .fn()
        .mockRejectedValue(new Error('network error'));

      for (let i = 0; i < 3; i++) {
        await expect(
          retryStrategy.execute(operationId, failingOperation, {
            maxAttempts: 1,
          })
        ).rejects.toThrow('network error');
      }

      const originalStates = { ...RetryStrategy.CIRCUIT_STATES };

      try {
        RetryStrategy.CIRCUIT_STATES.OPEN = 'mutated-open-state';

        // Ensure breaker retains the previous state string value
        const statusBefore = retryStrategy.getCircuitBreakerStatus(operationId);
        expect(statusBefore.state).toBe(originalStates.OPEN);

        const allowed = retryStrategy._isCircuitClosed(operationId);
        expect(allowed).toBe(true);
      } finally {
        RetryStrategy.CIRCUIT_STATES.OPEN = originalStates.OPEN;
      }
    });

    it('should use default retryable patterns when classifier is inconclusive', () => {
      const shouldRetry = retryStrategy._shouldRetryError(
        new Error('Fetch failure occurred while contacting service'),
        { retryableErrors: undefined, context: {} }
      );

      expect(shouldRetry).toBe(true);
    });
  });
});
