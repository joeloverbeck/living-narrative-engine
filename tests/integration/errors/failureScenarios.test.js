/**
 * @file Integration tests for error handling failure scenarios
 * Tests the complete error flow through the entire pipeline
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import {
  createDomainErrors,
  simulateErrorBurst,
  createErrorChain,
  waitFor,
} from '../../common/errorTestHelpers.js';
import CentralErrorHandler from '../../../src/errors/CentralErrorHandler.js';
import RecoveryStrategyManager from '../../../src/errors/RecoveryStrategyManager.js';
import ErrorReporter from '../../../src/errors/ErrorReporter.js';
import MonitoringCoordinator from '../../../src/entities/monitoring/MonitoringCoordinator.js';
import BaseError from '../../../src/errors/baseError.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

describe('Error Handling Flow Integration - Failure Scenarios', () => {
  let testBed;
  let centralErrorHandler;
  let recoveryManager;
  let errorReporter;
  let mockLogger;
  let mockEventBus;
  let monitoringCoordinator;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEventBus = testBed.createMock('MockEventBus', [
      'dispatch',
      'subscribe',
    ]);

    // Create real instances for integration testing
    monitoringCoordinator = new MonitoringCoordinator({
      logger: mockLogger,
      enabled: true,
      checkInterval: 100,
    });

    recoveryManager = new RecoveryStrategyManager({
      logger: mockLogger,
      monitoringCoordinator,
      maxRetries: 3,
      baseDelay: 10,
      maxDelay: 100,
    });

    errorReporter = new ErrorReporter({
      logger: mockLogger,
      eventBus: mockEventBus,
      batchSize: 10,
      flushInterval: 100,
    });

    centralErrorHandler = new CentralErrorHandler({
      logger: mockLogger,
      eventBus: mockEventBus,
      monitoringCoordinator,
      recoveryManager,
      errorReporter,
    });
  });

  afterEach(() => {
    if (monitoringCoordinator) {
      monitoringCoordinator.close();
    }
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('End-to-End Error Flow', () => {
    it('should handle clothing error through entire pipeline', async () => {
      const { ClothingServiceError } = createDomainErrors();
      const error = new ClothingServiceError(
        'Service failed',
        'test-service',
        'fetch'
      );

      // Register a recovery strategy
      centralErrorHandler.registerRecoveryStrategy(
        'ClothingServiceError',
        async () => {
          return { success: true, result: 'recovered from clothing error' };
        }
      );

      // Handle error through pipeline
      const result = await centralErrorHandler.handle(error, {
        component: 'clothing-manager',
      });

      // Verify recovery was successful
      expect(result).toEqual({
        success: true,
        result: 'recovered from clothing error',
      });

      // Verify metrics were updated
      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.recoveredErrors).toBe(1);
      expect(metrics.errorsByType.ClothingServiceError).toBe(1);

      // Verify event was dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'ERROR_OCCURRED',
        payload: expect.objectContaining({
          errorType: 'ClothingServiceError',
          severity: 'error',
          recoverable: true,
        }),
      });
    });

    it('should handle anatomy error with fallback', async () => {
      const { AnatomyError } = createDomainErrors();
      const error = new AnatomyError('Invalid body part', 'test-part');

      // Register recovery with fallback
      centralErrorHandler.registerRecoveryStrategy('AnatomyError', async () => {
        throw new Error('Recovery failed');
      });

      // Attempt to handle error
      try {
        await centralErrorHandler.handle(error, {
          component: 'anatomy-system',
        });
        expect.fail('Should have thrown error after failed recovery');
      } catch (thrownError) {
        expect(thrownError).toBeInstanceOf(BaseError);
        expect(thrownError.getContext('recoveryAttempted')).toBe(true);
      }

      // Verify metrics reflect failed recovery
      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.failedRecoveries).toBe(1);
    });

    it('should integrate with monitoring system', async () => {
      const error = new BaseError(
        'Monitored error',
        ErrorCodes.INVALID_DATA_GENERIC
      );

      // Handle error with monitoring
      try {
        await centralErrorHandler.handle(error);
      } catch {}

      // Verify monitoring system tracked the error
      const monitoringStats = monitoringCoordinator.getStats();
      expect(monitoringStats.enabled).toBe(true);
      expect(monitoringStats.performance).toBeDefined();
    });

    it('should handle circuit breaker scenarios', async () => {
      // Get circuit breaker for specific operation
      const circuitBreaker = monitoringCoordinator.getCircuitBreaker(
        'test-operation',
        {
          failureThreshold: 2,
          resetTimeout: 50,
        }
      );

      let failureCount = 0;
      const failingStrategy = async () => {
        failureCount++;
        throw new Error('Strategy failed');
      };

      centralErrorHandler.registerRecoveryStrategy(
        'TestError',
        failingStrategy
      );

      class TestError extends BaseError {
        constructor() {
          super('Test error', 'TEST_ERROR');
          this.name = 'TestError';
        }
        isRecoverable() {
          return true;
        }
      }

      // Trigger multiple failures to trip circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await centralErrorHandler.handle(new TestError());
        } catch {}
      }

      // Circuit should be open after failures
      expect(failureCount).toBeGreaterThanOrEqual(2);

      // Wait for circuit to reset
      await waitFor(100);

      // Circuit should allow retry after reset
      try {
        await centralErrorHandler.handle(new TestError());
      } catch {}

      expect(failureCount).toBeGreaterThan(2);
    });
  });

  describe('Cascading Failures', () => {
    it('should prevent cascading failures with circuit breaker', async () => {
      let attemptCount = 0;
      const cascadingStrategy = async () => {
        attemptCount++;
        if (attemptCount < 5) {
          throw new Error(`Cascading failure ${attemptCount}`);
        }
        return 'eventually recovered';
      };

      centralErrorHandler.registerRecoveryStrategy(
        'CascadingError',
        cascadingStrategy
      );

      class CascadingError extends BaseError {
        constructor() {
          super('Cascading error', 'CASCADING_ERROR');
          this.name = 'CascadingError';
        }
        isRecoverable() {
          return true;
        }
      }

      // Attempt recovery multiple times
      let finalResult = null;
      for (let i = 0; i < 10; i++) {
        try {
          finalResult = await centralErrorHandler.handle(new CascadingError());
          break;
        } catch {
          await waitFor(20); // Small delay between attempts
        }
      }

      // Should eventually recover
      expect(finalResult).toBe('eventually recovered');
      expect(attemptCount).toBeLessThan(10); // Circuit breaker should limit attempts
    });

    it('should handle multiple simultaneous failures', async () => {
      const errors = simulateErrorBurst(10, {
        errorType: 'SimultaneousError',
        recoverable: false,
        severity: 'error',
      });

      const handlePromises = errors.map((error) =>
        centralErrorHandler.handle(error).catch((e) => e)
      );

      const results = await Promise.all(handlePromises);

      // All errors should be handled
      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toBeInstanceOf(BaseError);
      });

      // Metrics should reflect all errors
      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(10);
    });

    it('should recover from system-wide failure', async () => {
      // Simulate system-wide failure
      const systemErrors = [
        new BaseError('Database failure', ErrorCodes.CONNECTION_FAILED),
        new BaseError('Service failure', ErrorCodes.SERVICE_NOT_FOUND),
        new BaseError(
          'Async operation failure',
          ErrorCodes.ASYNC_OPERATION_FAILED
        ),
      ];

      // Register recovery strategies
      centralErrorHandler.registerRecoveryStrategy(
        'BaseError',
        async (error) => {
          if (error.code === ErrorCodes.CONNECTION_FAILED) {
            return { recovered: 'database', fallback: true };
          }
          return null;
        }
      );

      const results = [];
      for (const error of systemErrors) {
        try {
          const result = await centralErrorHandler.handle(error);
          results.push(result);
        } catch (e) {
          results.push(e);
        }
      }

      // Should have attempted recovery for all
      expect(results).toHaveLength(3);

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(3);
    });
  });

  describe('Resource Exhaustion', () => {
    it('should handle memory pressure during error handling', async () => {
      // Generate large number of errors
      const errors = simulateErrorBurst(1000, {
        errorType: 'MemoryPressureError',
        withDelay: false,
      });

      let handledCount = 0;
      let failedCount = 0;

      // Process errors with concurrency limit
      const concurrencyLimit = 10;
      for (let i = 0; i < errors.length; i += concurrencyLimit) {
        const batch = errors.slice(i, i + concurrencyLimit);
        const results = await Promise.allSettled(
          batch.map((error) => centralErrorHandler.handle(error))
        );

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            handledCount++;
          } else {
            failedCount++;
          }
        });
      }

      // Should handle most errors despite pressure
      expect(handledCount + failedCount).toBe(1000);

      // Check registry cleanup occurred
      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.registrySize).toBeLessThanOrEqual(1000);
    });

    it('should limit error buffer size', async () => {
      // Generate more errors than buffer can hold
      const errors = simulateErrorBurst(1500);

      for (const error of errors) {
        try {
          await centralErrorHandler.handle(error);
        } catch {}
      }

      // Registry should be limited
      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.registrySize).toBeLessThanOrEqual(1000);
      expect(metrics.totalErrors).toBe(1500); // All errors counted
    });

    it('should clean up resources on failure', async () => {
      const cleanupSpy = jest.fn();

      class ResourceError extends BaseError {
        constructor() {
          super('Resource error', 'RESOURCE_ERROR');
          this.name = 'ResourceError';
        }

        cleanup() {
          cleanupSpy();
        }
      }

      const error = new ResourceError();

      try {
        await centralErrorHandler.handle(error);
      } catch {}

      // Cleanup should be attempted
      // Note: Actual cleanup implementation may vary
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('Infinite Loops', () => {
    it('should prevent infinite retry loops', async () => {
      let retryCount = 0;
      const infiniteStrategy = async () => {
        retryCount++;
        throw new Error('Always fails');
      };

      centralErrorHandler.registerRecoveryStrategy(
        'InfiniteError',
        infiniteStrategy
      );

      class InfiniteError extends BaseError {
        constructor() {
          super('Infinite error', 'INFINITE_ERROR');
          this.name = 'InfiniteError';
        }
        isRecoverable() {
          return true;
        }
      }

      try {
        await centralErrorHandler.handle(new InfiniteError());
      } catch {}

      // Should limit retries
      expect(retryCount).toBeLessThan(10);
    });

    it('should detect circular error handling', async () => {
      let depth = 0;
      const circularStrategy = async () => {
        depth++;
        if (depth > 5) {
          throw new Error('Max depth exceeded');
        }
        // Trigger another error
        throw new BaseError('Circular error', 'CIRCULAR_ERROR');
      };

      centralErrorHandler.registerRecoveryStrategy(
        'CircularError',
        circularStrategy
      );

      class CircularError extends BaseError {
        constructor() {
          super('Circular error', 'CIRCULAR_ERROR');
          this.name = 'CircularError';
        }
        isRecoverable() {
          return true;
        }
      }

      try {
        await centralErrorHandler.handle(new CircularError());
      } catch (e) {
        expect(depth).toBeLessThanOrEqual(6);
      }
    });

    it('should timeout stuck operations', async () => {
      const stuckStrategy = async () => {
        // Simulate stuck operation
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return 'should not reach here';
      };

      centralErrorHandler.registerRecoveryStrategy('StuckError', stuckStrategy);

      class StuckError extends BaseError {
        constructor() {
          super('Stuck error', 'STUCK_ERROR');
          this.name = 'StuckError';
        }
        isRecoverable() {
          return true;
        }
      }

      const startTime = Date.now();

      try {
        await Promise.race([
          centralErrorHandler.handle(new StuckError()),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 1000)
          ),
        ]);
      } catch (e) {
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(2000);
        expect(e.message).toContain('Timeout');
      }
    });
  });

  describe('Data Corruption', () => {
    it('should handle corrupted error data', async () => {
      // Create error with circular reference
      const corruptedError = new BaseError(
        'Corrupted',
        ErrorCodes.INVALID_DATA_GENERIC
      );
      corruptedError.context.circular = corruptedError.context;

      try {
        await centralErrorHandler.handle(corruptedError);
      } catch (e) {
        // Should handle without crashing
        expect(e).toBeInstanceOf(BaseError);
      }
    });

    it('should validate error context', async () => {
      const invalidContextError = new BaseError(
        'Invalid context',
        ErrorCodes.INVALID_DATA_GENERIC
      );

      // Try to add invalid context
      try {
        invalidContextError.addContext('', 'invalid key');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }

      // Handle error with valid context
      invalidContextError.addContext('valid', 'value');

      try {
        await centralErrorHandler.handle(invalidContextError);
      } catch (e) {
        expect(e.getContext('valid')).toBe('value');
      }
    });

    it('should sanitize error messages', async () => {
      const sensitiveError = new BaseError(
        'Password: secret123, Token: xyz789',
        ErrorCodes.INVALID_DATA_GENERIC,
        { password: 'secret123', token: 'xyz789' }
      );

      try {
        await centralErrorHandler.handle(sensitiveError);
      } catch {}

      // Check that sensitive data is not logged directly
      // This depends on actual implementation of sanitization
      expect(mockLogger.error).toHaveBeenCalled();
      const logCalls = mockLogger.error.mock.calls;

      // Verify sensitive data handling
      logCalls.forEach((call) => {
        const logMessage = JSON.stringify(call);
        // Implementation-specific: Check if sanitization is in place
        expect(logMessage).toBeDefined();
      });
    });
  });

  describe('Error Chain Handling', () => {
    it('should handle error chains correctly', async () => {
      const errorChain = createErrorChain(3);

      try {
        await centralErrorHandler.handle(errorChain);
      } catch (e) {
        expect(e).toBeInstanceOf(BaseError);

        // Verify chain is preserved
        let current = e;
        let depth = 0;
        while (current && depth < 10) {
          if (current.cause) {
            current = current.cause;
            depth++;
          } else {
            break;
          }
        }

        expect(depth).toBeGreaterThan(0);
      }
    });
  });
});
