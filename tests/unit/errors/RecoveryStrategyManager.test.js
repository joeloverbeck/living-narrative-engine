import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import RecoveryStrategyManager from '../../../src/errors/RecoveryStrategyManager.js';
import BaseError from '../../../src/errors/baseError.js';
import * as errorHandlingConfig from '../../../src/config/errorHandling.config.js';

describe('RecoveryStrategyManager - Core Recovery Logic', () => {
  let testBed;
  let mockLogger;
  let mockMonitoringCoordinator;
  let mockCircuitBreaker;
  let recoveryManager;

  beforeEach(() => {
    testBed = createTestBed();

    mockLogger = testBed.createMockLogger();
    mockCircuitBreaker = testBed.createMock('MockCircuitBreaker', ['execute', 'executeSync']);
    mockMonitoringCoordinator = testBed.createMock('MockMonitoringCoordinator', ['getCircuitBreaker']);
    mockMonitoringCoordinator.getCircuitBreaker.mockReturnValue(mockCircuitBreaker);

    // Default circuit breaker behavior - execute the function it receives
    mockCircuitBreaker.execute.mockImplementation(async (fn) => await fn());

    recoveryManager = new RecoveryStrategyManager({
      logger: mockLogger,
      monitoringCoordinator: mockMonitoringCoordinator
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should create manager with required dependencies', () => {
      expect(recoveryManager).toBeInstanceOf(RecoveryStrategyManager);
    });

    it('should validate required logger dependency', () => {
      expect(() => {
        new RecoveryStrategyManager({
          logger: null,
          monitoringCoordinator: mockMonitoringCoordinator
        });
      }).toThrow();
    });

    it('should work without monitoringCoordinator', () => {
      const manager = new RecoveryStrategyManager({
        logger: mockLogger
      });
      expect(manager).toBeInstanceOf(RecoveryStrategyManager);
    });

    it('should validate monitoringCoordinator interface when provided', () => {
      expect(() => {
        new RecoveryStrategyManager({
          logger: mockLogger,
          monitoringCoordinator: { invalidInterface: true }
        });
      }).toThrow();
    });
  });

  describe('Strategy Registration', () => {
    it('should register custom strategy', () => {
      const strategy = {
        maxRetries: 5,
        backoff: 'linear',
        timeout: 3000
      };

      recoveryManager.registerStrategy('TestError', strategy);

      expect(mockLogger.debug).toHaveBeenCalledWith('Registered recovery strategy for TestError');
    });

    it('should use default values for missing strategy properties', () => {
      const partialStrategy = {
        maxRetries: 2
      };

      recoveryManager.registerStrategy('PartialError', partialStrategy);

      expect(mockLogger.debug).toHaveBeenCalledWith('Registered recovery strategy for PartialError');
    });

    it('should register fallback values', () => {
      recoveryManager.registerFallback('testOperation', 'fallback-value');

      expect(mockLogger.debug).toHaveBeenCalledWith('Registered fallback for testOperation');
    });

    it('should register fallback functions', () => {
      const fallbackFn = jest.fn().mockReturnValue('dynamic-fallback');
      recoveryManager.registerFallback('dynamicOperation', fallbackFn);

      expect(mockLogger.debug).toHaveBeenCalledWith('Registered fallback for dynamicOperation');
    });
  });

  describe('executeWithRecovery - Basic Operation', () => {
    it('should execute successful operation without retry', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'testOp'
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith('Operation testOp succeeded on attempt 1');
    });

    it('should handle operation failure without circuit breaker', async () => {
      const error = new Error('Test failure');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        recoveryManager.executeWithRecovery(operation, {
          operationName: 'failOp',
          useCircuitBreaker: false,
          useFallback: false,
          maxRetries: 1
        })
      ).rejects.toThrow('Test failure');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should execute with circuit breaker when enabled', async () => {
      const operation = jest.fn().mockResolvedValue('cb-success');
      mockCircuitBreaker.execute.mockImplementation(async (fn) => await fn());

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'cbOp',
        useCircuitBreaker: true
      });

      expect(result).toBe('cb-success');
      expect(mockMonitoringCoordinator.getCircuitBreaker).toHaveBeenCalledWith('cbOp', {});
      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });

    it('should disable circuit breaker when monitoringCoordinator is null', async () => {
      const managerWithoutMonitoring = new RecoveryStrategyManager({
        logger: mockLogger
      });

      const operation = jest.fn().mockResolvedValue('no-cb-success');

      const result = await managerWithoutMonitoring.executeWithRecovery(operation, {
        operationName: 'noCbOp',
        useCircuitBreaker: true
      });

      expect(result).toBe('no-cb-success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on retriable errors', async () => {
      const error = new Error('ECONNREFUSED');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('retry-success');

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'retryOp',
        maxRetries: 3,
        useCircuitBreaker: false
      });

      expect(result).toBe('retry-success');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(mockLogger.debug).toHaveBeenCalledWith('Operation retryOp succeeded on attempt 3');
    });

    it('should not retry on non-retriable errors', async () => {
      class ValidationError extends Error {
        constructor(message) {
          super(message);
          this.name = 'ValidationError';
        }
      }
      const error = new ValidationError('Invalid input');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        recoveryManager.executeWithRecovery(operation, {
          operationName: 'validationOp',
          maxRetries: 3,
          useCircuitBreaker: false,
          useFallback: false
        })
      ).rejects.toThrow('Invalid input');

      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith('Non-retriable error for validationOp', {
        error: 'Invalid input'
      });
    });

    it('should respect BaseError recoverable property', async () => {
      // Create a custom recoverable error class
      class RecoverableTestError extends BaseError {
        isRecoverable() {
          return true;
        }
      }

      // Create a custom non-recoverable error class
      class NonRecoverableTestError extends BaseError {
        isRecoverable() {
          return false;
        }
      }

      const recoverableError = new RecoverableTestError('Recoverable error', 'TEST_ERROR', {});
      const nonRecoverableError = new NonRecoverableTestError('Non-recoverable error', 'FATAL_ERROR', {});

      const retriableOperation = jest.fn()
        .mockRejectedValueOnce(recoverableError)
        .mockResolvedValue('recovered');

      const nonRetriableOperation = jest.fn()
        .mockRejectedValue(nonRecoverableError);

      // Test recoverable error
      const result = await recoveryManager.executeWithRecovery(retriableOperation, {
        operationName: 'recoverableOp',
        maxRetries: 2,
        useCircuitBreaker: false
      });
      expect(result).toBe('recovered');

      // Test non-recoverable error
      await expect(
        recoveryManager.executeWithRecovery(nonRetriableOperation, {
          operationName: 'nonRecoverableOp',
          maxRetries: 2,
          useCircuitBreaker: false,
          useFallback: false
        })
      ).rejects.toThrow('Non-recoverable error');

      expect(retriableOperation).toHaveBeenCalledTimes(2);
      expect(nonRetriableOperation).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and fail', async () => {
      const error = new Error('ETIMEDOUT');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        recoveryManager.executeWithRecovery(operation, {
          operationName: 'exhaustOp',
          maxRetries: 2,
          useCircuitBreaker: false,
          useFallback: false
        })
      ).rejects.toThrow('ETIMEDOUT');

      expect(operation).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledWith('All retry attempts failed for exhaustOp', {
        attempts: 2,
        lastError: 'ETIMEDOUT'
      });
    });
  });

  describe('Backoff Strategies', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should use exponential backoff', async () => {
      const error = new Error('ECONNREFUSED');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('backoff-success');

      const promise = recoveryManager.executeWithRecovery(operation, {
        operationName: 'exponentialOp',
        maxRetries: 3,
        backoff: 'exponential',
        useCircuitBreaker: false
      });

      // Fast forward through retry delays
      await jest.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('backoff-success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use linear backoff', async () => {
      const error = new Error('timeout');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('linear-success');

      const promise = recoveryManager.executeWithRecovery(operation, {
        operationName: 'linearOp',
        maxRetries: 2,
        backoff: 'linear',
        useCircuitBreaker: false
      });

      await jest.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('linear-success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should use constant backoff', async () => {
      const error = new Error('ENOTFOUND');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('constant-success');

      const promise = recoveryManager.executeWithRecovery(operation, {
        operationName: 'constantOp',
        maxRetries: 2,
        backoff: 'constant',
        useCircuitBreaker: false
      });

      await jest.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('constant-success');
    });

    it('should default to exponential backoff when strategy is unknown', async () => {
      const error = new Error('ETIMEDOUT');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('default-backoff-success');

      const promise = recoveryManager.executeWithRecovery(operation, {
        operationName: 'unknownBackoffOp',
        maxRetries: 2,
        backoff: 'mystery',
        useCircuitBreaker: false
      });

      await jest.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('default-backoff-success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout slow operations', async () => {
      // Use a real timer test with a very short timeout
      const slowOperation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 100)); // 100ms operation
      });

      await expect(
        recoveryManager.executeWithRecovery(slowOperation, {
          operationName: 'slowOp',
          timeout: 50, // 50ms timeout
          useCircuitBreaker: false,
          useFallback: false
        })
      ).rejects.toThrow('Operation timed out after 50ms');
    }, 1000);

    it('should complete fast operations within timeout', async () => {
      const fastOperation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve('fast'), 10));
      });

      const result = await recoveryManager.executeWithRecovery(fastOperation, {
        operationName: 'fastOp',
        timeout: 100,
        useCircuitBreaker: false
      });

      expect(result).toBe('fast');
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should use registered fallback value', async () => {
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      recoveryManager.registerFallback('fallbackOp', 'fallback-value');

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'fallbackOp',
        maxRetries: 1,
        useCircuitBreaker: false,
        useFallback: true
      });

      expect(result).toBe('fallback-value');
      expect(mockLogger.info).toHaveBeenCalledWith('Executing fallback for fallbackOp');
    });

    it('should use registered fallback function', async () => {
      const error = new Error('Dynamic failure');
      const operation = jest.fn().mockRejectedValue(error);
      const fallbackFn = jest.fn().mockReturnValue('dynamic-result');

      recoveryManager.registerFallback('dynamicFallbackOp', fallbackFn);

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'dynamicFallbackOp',
        maxRetries: 1,
        useCircuitBreaker: false,
        useFallback: true
      });

      expect(result).toBe('dynamic-result');
      expect(fallbackFn).toHaveBeenCalledWith(error);
    });

    it('should use strategy-specific fallback', async () => {
      const error = new Error('Strategy failure');
      const operation = jest.fn().mockRejectedValue(error);
      const strategyFallback = jest.fn().mockResolvedValue('strategy-fallback');

      recoveryManager.registerStrategy('StrategyError', {
        fallback: strategyFallback
      });

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'strategyFallbackOp',
        errorType: 'StrategyError',
        maxRetries: 1,
        useCircuitBreaker: false,
        useFallback: true
      });

      expect(result).toBe('strategy-fallback');
      expect(strategyFallback).toHaveBeenCalledWith(error, 'strategyFallbackOp');
    });

    it('should use generic fallback for fetch operations', async () => {
      const error = new Error('Fetch failed');
      const operation = jest.fn().mockRejectedValue(error);

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'fetchData',
        maxRetries: 1,
        useCircuitBreaker: false,
        useFallback: true
      });

      expect(result).toBeNull();
    });

    it('should use generic fallback for list operations', async () => {
      const error = new Error('List failed');
      const operation = jest.fn().mockRejectedValue(error);

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'listItems',
        maxRetries: 1,
        useCircuitBreaker: false,
        useFallback: true
      });

      expect(result).toEqual([]);
    });

    it('should use generic fallback for count operations', async () => {
      const error = new Error('Count failed');
      const operation = jest.fn().mockRejectedValue(error);

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'countItems',
        maxRetries: 1,
        useCircuitBreaker: false,
        useFallback: true
      });

      expect(result).toBe(0);
    });

    it('should use generic fallback for validate operations', async () => {
      const error = new Error('Validation failed');
      const operation = jest.fn().mockRejectedValue(error);

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'validateInput',
        maxRetries: 1,
        useCircuitBreaker: false,
        useFallback: true
      });

      expect(result).toBe(false);
    });

    it('should use generic fallback for generate operations', async () => {
      const error = new Error('Generation failed');
      const operation = jest.fn().mockRejectedValue(error);

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'generateReport',
        maxRetries: 1,
        useCircuitBreaker: false,
        useFallback: true
      });

      expect(result).toEqual({});
    });

    it('should handle fallback function errors gracefully', async () => {
      const error = new Error('Original failure');
      const operation = jest.fn().mockRejectedValue(error);
      const fallbackError = new Error('Fallback failed');
      const strategyFallback = jest.fn().mockRejectedValue(fallbackError);

      recoveryManager.registerStrategy('FailingFallbackError', {
        fallback: strategyFallback
      });

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'failingFallbackOp',
        errorType: 'FailingFallbackError',
        maxRetries: 1,
        useCircuitBreaker: false,
        useFallback: true
      });

      expect(result).toBeNull(); // Should fall back to generic fallback
      expect(mockLogger.error).toHaveBeenCalledWith('Fallback failed for failingFallbackOp', {
        error: 'Fallback failed'
      });
    });

    it('should use default configuration fallback when strategy has none', async () => {
      const error = new Error('Strategy missing fallback');
      const operation = jest.fn().mockRejectedValue(error);
      const fallbackSpy = jest.spyOn(errorHandlingConfig, 'getFallbackValue');
      fallbackSpy.mockReturnValue('config-fallback');

      mockLogger.warn.mockClear();
      recoveryManager.registerStrategy('DefaultFallbackError', {});

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'render',
        errorType: 'DefaultFallbackError',
        maxRetries: 1,
        useCircuitBreaker: false,
        useFallback: true
      });

      expect(result).toBe('config-fallback');
      expect(mockLogger.warn).toHaveBeenCalledWith('Using default fallback for render');
      expect(fallbackSpy).toHaveBeenCalledWith(null, 'render');
    });
  });

  describe('Caching', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should cache successful results', async () => {
      const operation = jest.fn().mockResolvedValue('cached-result');

      // First call
      const result1 = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'cacheOp',
        cacheResult: true,
        useCircuitBreaker: false
      });

      // Second call within cache window
      const result2 = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'cacheOp',
        cacheResult: true,
        useCircuitBreaker: false
      });

      expect(result1).toBe('cached-result');
      expect(result2).toBe('cached-result');
      expect(operation).toHaveBeenCalledTimes(1); // Only called once due to cache
      expect(mockLogger.debug).toHaveBeenCalledWith('Returning cached result for cacheOp');
    });

    it('should expire cache after timeout', async () => {
      const operation = jest.fn()
        .mockResolvedValueOnce('first-result')
        .mockResolvedValueOnce('second-result');

      // First call
      const result1 = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'expireOp',
        cacheResult: true,
        useCircuitBreaker: false
      });

      // Fast forward beyond cache expiry (1 minute)
      jest.advanceTimersByTime(61000);

      // Second call after cache expiry
      const result2 = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'expireOp',
        cacheResult: true,
        useCircuitBreaker: false
      });

      expect(result1).toBe('first-result');
      expect(result2).toBe('second-result');
      expect(operation).toHaveBeenCalledTimes(2); // Called twice due to cache expiry
    });

    it('should clear cache manually', () => {
      recoveryManager.clearCache();
      expect(mockLogger.debug).toHaveBeenCalledWith('Recovery strategy cache cleared');
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should fall back when circuit breaker fails', async () => {
      const error = new Error('Circuit breaker open');
      const operation = jest.fn().mockResolvedValue('should-not-execute');

      mockCircuitBreaker.execute.mockRejectedValue(error);
      recoveryManager.registerFallback('cbFailOp', 'cb-fallback');

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'cbFailOp',
        useCircuitBreaker: true,
        useFallback: true
      });

      expect(result).toBe('cb-fallback');
      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Executing fallback for cbFailOp');
    });

    it('should throw error when circuit breaker fails and no fallback', async () => {
      const error = new Error('Circuit breaker failure');
      mockCircuitBreaker.execute.mockRejectedValue(error);

      await expect(
        recoveryManager.executeWithRecovery(() => 'should-not-execute', {
          operationName: 'cbNoFallbackOp',
          useCircuitBreaker: true,
          useFallback: false
        })
      ).rejects.toThrow('Circuit breaker failure');
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should provide metrics', () => {
      recoveryManager.registerStrategy('TestError', { maxRetries: 2 });
      recoveryManager.registerFallback('testOp', 'fallback');

      const metrics = recoveryManager.getMetrics();

      expect(metrics).toEqual({
        registeredStrategies: 1,
        registeredFallbacks: 1,
        cacheSize: 0,
        circuitBreakers: 0
      });
    });

    it('should track cache size in metrics', async () => {
      const operation = jest.fn().mockResolvedValue('metric-result');

      await recoveryManager.executeWithRecovery(operation, {
        operationName: 'metricOp',
        cacheResult: true,
        useCircuitBreaker: false
      });

      const metrics = recoveryManager.getMetrics();
      expect(metrics.cacheSize).toBe(1);
    });
  });

  describe('Error Classification Edge Cases', () => {
    it('should handle error codes for non-retriable classification', async () => {
      const error = new Error('Test error');
      error.code = 'INVALID_ARGUMENT';
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        recoveryManager.executeWithRecovery(operation, {
          operationName: 'codeOp',
          maxRetries: 3,
          useCircuitBreaker: false,
          useFallback: false
        })
      ).rejects.toThrow('Test error');

      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith('Non-retriable error for codeOp', {
        error: 'Test error'
      });
    });

    it('should classify unknown errors as retriable', async () => {
      const error = new Error('Unknown error type');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('unknown-recovery');

      const result = await recoveryManager.executeWithRecovery(operation, {
        operationName: 'unknownOp',
        maxRetries: 2,
        useCircuitBreaker: false
      });

      expect(result).toBe('unknown-recovery');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});