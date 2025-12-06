/**
 * @file Unit tests for BaseFacade abstract class
 * @description Tests resilience patterns, caching, and event handling functionality
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import BaseFacade from '../../../../src/shared/facades/BaseFacade.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';
import { createTestBed } from '../../../common/testBed.js';

// Test implementation of BaseFacade for testing purposes
class TestFacade extends BaseFacade {
  constructor(deps) {
    super(deps);
  }

  // Expose protected methods for testing
  async testExecuteWithResilience(operationName, operation, fallback, options) {
    return await this.executeWithResilience(
      operationName,
      operation,
      fallback,
      options
    );
  }

  async testCacheableOperation(cacheKey, operation, options) {
    return await this.cacheableOperation(cacheKey, operation, options);
  }

  testDispatchEvent(eventType, payload) {
    return this.dispatchEvent(eventType, payload);
  }

  testLogOperation(level, message, metadata) {
    return this.logOperation(level, message, metadata);
  }

  async testInvalidateCache(keyOrPattern, isPattern) {
    return await this.invalidateCache(keyOrPattern, isPattern);
  }
}

describe('BaseFacade', () => {
  let testBed;
  let facade;
  let mockLogger;
  let mockEventBus;
  let mockCache;
  let mockCircuitBreaker;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEventBus = testBed.createMock('eventBus', ['dispatch', 'subscribe']);
    mockCache = testBed.createMock('cache', [
      'get',
      'set',
      'invalidate',
      'invalidateByPattern',
    ]);
    mockCircuitBreaker = testBed.createMock('circuitBreaker', ['execute']);

    // Set default implementation for circuit breaker to pass through operations
    mockCircuitBreaker.execute.mockImplementation(
      async (name, op) => await op()
    );

    facade = new TestFacade({
      logger: mockLogger,
      eventBus: mockEventBus,
      unifiedCache: mockCache,
      circuitBreaker: mockCircuitBreaker,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(() => {
        new TestFacade({
          logger: mockLogger,
          eventBus: mockEventBus,
          unifiedCache: mockCache,
        });
      }).not.toThrow();
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new TestFacade({
          eventBus: mockEventBus,
          unifiedCache: mockCache,
        });
      }).toThrow();
    });

    it('should throw error if eventBus is missing', () => {
      expect(() => {
        new TestFacade({
          logger: mockLogger,
          unifiedCache: mockCache,
        });
      }).toThrow();
    });

    it('should throw error if unifiedCache is missing', () => {
      expect(() => {
        new TestFacade({
          logger: mockLogger,
          eventBus: mockEventBus,
        });
      }).toThrow();
    });

    it('should work without circuitBreaker (optional)', () => {
      expect(() => {
        new TestFacade({
          logger: mockLogger,
          eventBus: mockEventBus,
          unifiedCache: mockCache,
        });
      }).not.toThrow();
    });
  });

  describe('executeWithResilience', () => {
    it('should execute operation successfully', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await facade.testExecuteWithResilience(
        'testOp',
        operation
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Starting resilient operation: testOp'),
        expect.any(Object)
      );
    });

    it('should use circuit breaker when available', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await facade.testExecuteWithResilience(
        'testOp',
        operation
      );

      expect(result).toBe('success');
      expect(mockCircuitBreaker.execute).toHaveBeenCalledWith(
        'testOp',
        expect.any(Function)
      );
    });

    it('should execute directly when circuit breaker is not available', async () => {
      const facadeWithoutCB = new TestFacade({
        logger: mockLogger,
        eventBus: mockEventBus,
        unifiedCache: mockCache,
      });
      const operation = jest.fn().mockResolvedValue('success');

      const result = await facadeWithoutCB.testExecuteWithResilience(
        'testOp',
        operation
      );

      expect(result).toBe('success');
    });

    it('should use fallback when operation fails', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('Operation failed'));
      const fallback = jest.fn().mockResolvedValue('fallback result');

      const result = await facade.testExecuteWithResilience(
        'testOp',
        operation,
        fallback
      );

      expect(result).toBe('fallback result');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(fallback).toHaveBeenCalledWith(expect.any(Error));
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Using fallback for operation: testOp'),
        expect.any(Object)
      );
    });

    it('should throw error when operation fails and no fallback', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('Operation failed'));

      await expect(
        facade.testExecuteWithResilience('testOp', operation)
      ).rejects.toThrow('Operation failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Resilient operation failed: testOp'),
        expect.any(Object)
      );
    });

    it('should dispatch error event when operation fails', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('Operation failed'));

      await expect(
        facade.testExecuteWithResilience('testOp', operation)
      ).rejects.toThrow();

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'FACADE_OPERATION_ERROR',
        payload: {
          operationName: 'testOp',
          error: 'Operation failed',
          timestamp: expect.any(Number),
        },
        timestamp: expect.any(Number),
        source: 'TestFacade',
      });
    });

    it('should handle operation timeout', async () => {
      const operation = jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 2000))
        );

      await expect(
        facade.testExecuteWithResilience('testOp', operation, null, {
          timeout: 100,
        })
      ).rejects.toThrow(/timed out/);
    });

    it('should retry failed operations', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success');

      const result = await facade.testExecuteWithResilience(
        'testOp',
        operation,
        null,
        { retries: 2 }
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2); // Two retry warnings
    });

    it('should validate operation parameter', async () => {
      await expect(
        facade.testExecuteWithResilience('testOp', null)
      ).rejects.toThrow(InvalidArgumentError);

      await expect(
        facade.testExecuteWithResilience('testOp', 'not a function')
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should validate operation name', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      await expect(
        facade.testExecuteWithResilience('', operation)
      ).rejects.toThrow();

      await expect(
        facade.testExecuteWithResilience(null, operation)
      ).rejects.toThrow();
    });
  });

  describe('cacheableOperation', () => {
    it('should return cached result when available', async () => {
      mockCache.get.mockResolvedValue('cached result');
      const operation = jest.fn().mockResolvedValue('fresh result');

      const result = await facade.testCacheableOperation('test-key', operation);

      expect(result).toBe('cached result');
      expect(operation).not.toHaveBeenCalled();
      expect(mockCache.get).toHaveBeenCalledWith('test-key');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache hit for key: test-key'),
        expect.any(Object)
      );
    });

    it('should execute operation when cache miss', async () => {
      mockCache.get.mockResolvedValue(undefined);
      const operation = jest.fn().mockResolvedValue('fresh result');

      const result = await facade.testCacheableOperation('test-key', operation);

      expect(result).toBe('fresh result');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        'test-key',
        'fresh result',
        {}
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache miss for key: test-key'),
        expect.any(Object)
      );
    });

    it('should force refresh when forceRefresh option is true', async () => {
      mockCache.get.mockResolvedValue('cached result');
      const operation = jest.fn().mockResolvedValue('fresh result');

      const result = await facade.testCacheableOperation(
        'test-key',
        operation,
        { forceRefresh: true }
      );

      expect(result).toBe('fresh result');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockCache.get).not.toHaveBeenCalled();
    });

    it('should use custom TTL when provided', async () => {
      mockCache.get.mockResolvedValue(undefined);
      const operation = jest.fn().mockResolvedValue('result');

      await facade.testCacheableOperation('test-key', operation, { ttl: 3600 });

      expect(mockCache.set).toHaveBeenCalledWith('test-key', 'result', {
        ttl: 3600,
      });
    });

    it('should validate cache key parameter', async () => {
      const operation = jest.fn().mockResolvedValue('result');

      await expect(
        facade.testCacheableOperation('', operation)
      ).rejects.toThrow();

      await expect(
        facade.testCacheableOperation(null, operation)
      ).rejects.toThrow();
    });

    it('should validate operation parameter', async () => {
      await expect(
        facade.testCacheableOperation('test-key', null)
      ).rejects.toThrow(InvalidArgumentError);

      await expect(
        facade.testCacheableOperation('test-key', 'not a function')
      ).rejects.toThrow(InvalidArgumentError);
    });

    it('should handle cache errors gracefully', async () => {
      mockCache.get.mockRejectedValue(new Error('Cache error'));
      const operation = jest.fn().mockResolvedValue('result');

      await expect(
        facade.testCacheableOperation('test-key', operation)
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cacheable operation failed for key: test-key'),
        expect.any(Object)
      );
    });
  });

  describe('dispatchEvent', () => {
    it('should dispatch event with proper structure', () => {
      const payload = { data: 'test' };

      facade.testDispatchEvent('TEST_EVENT', payload);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'TEST_EVENT',
        payload,
        timestamp: expect.any(Number),
        source: 'TestFacade',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Dispatched event: TEST_EVENT'),
        expect.any(Object)
      );
    });

    it('should handle empty payload', () => {
      facade.testDispatchEvent('TEST_EVENT');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'TEST_EVENT',
        payload: {},
        timestamp: expect.any(Number),
        source: 'TestFacade',
      });
    });

    it('should handle null payload', () => {
      facade.testDispatchEvent('TEST_EVENT', null);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'TEST_EVENT',
        payload: {},
        timestamp: expect.any(Number),
        source: 'TestFacade',
      });
    });

    it('should validate event type parameter', () => {
      expect(() =>
        facade.testDispatchEvent('', { data: 'test' })
      ).not.toThrow(); // Should just not dispatch

      expect(() =>
        facade.testDispatchEvent(null, { data: 'test' })
      ).not.toThrow(); // Should just not dispatch
    });

    it('should handle event bus errors gracefully', () => {
      mockEventBus.dispatch.mockImplementation(() => {
        throw new Error('Event bus error');
      });

      expect(() =>
        facade.testDispatchEvent('TEST_EVENT', { data: 'test' })
      ).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to dispatch event: TEST_EVENT'),
        expect.any(Object)
      );
    });
  });

  describe('logOperation', () => {
    it('should log with proper metadata structure', () => {
      facade.testLogOperation('info', 'Test message', { extra: 'data' });

      expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
        facade: 'TestFacade',
        timestamp: expect.any(String),
        extra: 'data',
      });
    });

    it('should handle different log levels', () => {
      facade.testLogOperation('debug', 'Debug message');
      facade.testLogOperation('warn', 'Warning message');
      facade.testLogOperation('error', 'Error message');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Debug message',
        expect.any(Object)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Warning message',
        expect.any(Object)
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error message',
        expect.any(Object)
      );
    });

    it('should handle logger failures gracefully', () => {
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logger error');
      });

      expect(() =>
        facade.testLogOperation('info', 'Test message')
      ).not.toThrow();
    });

    it('should handle missing logger methods', () => {
      // BaseFacade requires all logger methods, so partial logger should throw
      const partialLogger = { info: mockLogger.info };

      expect(
        () =>
          new TestFacade({
            logger: partialLogger,
            eventBus: mockEventBus,
            unifiedCache: mockCache,
          })
      ).toThrow('Invalid or missing method');
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate specific cache key', async () => {
      await facade.testInvalidateCache('test-key');

      expect(mockCache.invalidate).toHaveBeenCalledWith('test-key');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Invalidated cache: test-key'),
        expect.any(Object)
      );
    });

    it('should invalidate by pattern when supported', async () => {
      await facade.testInvalidateCache('test-*', true);

      expect(mockCache.invalidateByPattern).toHaveBeenCalledWith('test-*');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Invalidated cache: test-*'),
        expect.objectContaining({ isPattern: true })
      );
    });

    it('should handle pattern invalidation when not supported', async () => {
      // Remove the pattern method to simulate unsupported cache
      delete mockCache.invalidateByPattern;

      await facade.testInvalidateCache('test-*', true);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Cache does not support pattern invalidation: test-*'
        ),
        expect.any(Object)
      );
    });

    it('should validate cache key parameter', async () => {
      // InvalidateCache catches and logs errors internally, doesn't throw them
      await expect(facade.testInvalidateCache('')).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cache invalidation failed'),
        expect.any(Object)
      );

      // Reset mock for next test
      mockLogger.error.mockClear();

      await expect(facade.testInvalidateCache(null)).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cache invalidation failed'),
        expect.any(Object)
      );
    });

    it('should handle cache invalidation errors', async () => {
      mockCache.invalidate.mockRejectedValue(new Error('Cache error'));

      await facade.testInvalidateCache('test-key');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cache invalidation failed: test-key'),
        expect.any(Object)
      );
    });
  });

  describe('Integration', () => {
    it('should work together in complex scenarios', async () => {
      // Setup: cache miss, operation with retry, success on second attempt
      mockCache.get.mockResolvedValue(undefined);
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce('success');

      const result = await facade.testCacheableOperation(
        'complex-key',
        async () => {
          return await facade.testExecuteWithResilience(
            'complexOp',
            operation,
            null,
            { retries: 1 }
          );
        }
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(mockCache.set).toHaveBeenCalledWith('complex-key', 'success', {});

      // Verify logging occurred
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache miss for key: complex-key'),
        expect.any(Object)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Operation attempt 1 failed, retrying'),
        expect.any(Object)
      );
    });
  });
});
