import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import CentralErrorHandler from '../../../src/errors/CentralErrorHandler.js';
import MonitoringCoordinator from '../../../src/entities/monitoring/MonitoringCoordinator.js';
import BaseError from '../../../src/errors/baseError.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

describe('CentralErrorHandler - Integration Tests', () => {
  let testBed;
  let mockLogger;
  let mockEventBus;
  let monitoringCoordinator;
  let centralErrorHandler;

  beforeEach(() => {
    testBed = createTestBed();

    mockLogger = testBed.createMockLogger();
    mockEventBus = testBed.createMock('MockEventBus', [
      'dispatch',
      'subscribe',
    ]);

    // Create real MonitoringCoordinator instance
    monitoringCoordinator = new MonitoringCoordinator({
      logger: mockLogger,
      enabled: true,
      checkInterval: 1000,
    });

    centralErrorHandler = new CentralErrorHandler({
      logger: mockLogger,
      eventBus: mockEventBus,
      monitoringCoordinator,
    });
  });

  afterEach(() => {
    if (monitoringCoordinator) {
      monitoringCoordinator.close();
    }
    testBed.cleanup();
  });

  describe('MonitoringCoordinator Integration', () => {
    it('should integrate with real MonitoringCoordinator', () => {
      expect(centralErrorHandler).toBeInstanceOf(CentralErrorHandler);
      expect(monitoringCoordinator).toBeInstanceOf(MonitoringCoordinator);

      // Verify MonitoringCoordinator has required methods
      expect(typeof monitoringCoordinator.executeMonitored).toBe('function');
      expect(typeof monitoringCoordinator.getStats).toBe('function');
      expect(typeof monitoringCoordinator.getPerformanceMonitor).toBe(
        'function'
      );
    });

    it('should coordinate with MonitoringCoordinator for error tracking', async () => {
      const error = new BaseError(
        'Integration test error',
        ErrorCodes.INVALID_DATA_GENERIC
      );

      try {
        await centralErrorHandler.handle(error, { integration: true });
      } catch (enhancedError) {
        expect(enhancedError).toBeInstanceOf(BaseError);
        expect(enhancedError.getContext('handledBy')).toBe(
          'CentralErrorHandler'
        );
      }

      // Verify metrics are tracked
      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.errorsByType.BaseError).toBe(1);

      // Verify MonitoringCoordinator is functioning
      const monitoringStats = monitoringCoordinator.getStats();
      expect(monitoringStats).toHaveProperty('performance');
      expect(monitoringStats).toHaveProperty('enabled');
    });

    it('should handle errors with MonitoringCoordinator circuit breaker integration', async () => {
      // Get circuit breaker for error handling operations
      const circuitBreaker = monitoringCoordinator.getCircuitBreaker(
        'errorHandling',
        {
          failureThreshold: 2,
          resetTimeout: 100,
        }
      );

      expect(circuitBreaker).toBeDefined();

      // Create a recoverable error that will succeed on recovery
      const mockStrategy = jest
        .fn()
        .mockResolvedValue('recovered successfully');
      centralErrorHandler.registerRecoveryStrategy(
        'RecoverableError',
        mockStrategy
      );

      class RecoverableError extends BaseError {
        isRecoverable() {
          return true;
        }
        constructor(message) {
          super(message, 'RECOVERABLE_ERROR');
          this.name = 'RecoverableError';
        }
      }

      const error = new RecoverableError('Test recoverable error');

      // Should successfully recover
      const result = await centralErrorHandler.handle(error);
      expect(result).toBe('recovered successfully');

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.recoveredErrors).toBe(1);
    });
  });

  describe('Error Flow Integration', () => {
    it('should handle complete error flow from classification to event dispatch', async () => {
      const error = new BaseError(
        'Complete flow test',
        ErrorCodes.INVALID_DATA_GENERIC,
        {
          component: 'test',
          operation: 'integration',
        }
      );

      const eventPromise = new Promise((resolve) => {
        mockEventBus.dispatch.mockImplementation((event) => {
          if (event.type === 'ERROR_OCCURRED') {
            resolve(event);
          }
        });
      });

      try {
        await centralErrorHandler.handle(error, { flowTest: true });
      } catch (enhancedError) {
        expect(enhancedError).toBeInstanceOf(BaseError);
      }

      // Wait for event dispatch
      const dispatchedEvent = await eventPromise;

      expect(dispatchedEvent).toEqual({
        type: 'ERROR_OCCURRED',
        payload: expect.objectContaining({
          errorId: expect.any(String),
          errorType: 'BaseError',
          severity: 'error',
          recoverable: false,
          message: 'Complete flow test',
          timestamp: expect.any(Number),
        }),
      });

      // Verify logging occurred
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error occurred',
        expect.objectContaining({
          errorId: expect.any(String),
          type: 'BaseError',
          code: ErrorCodes.INVALID_DATA_GENERIC,
          message: 'Complete flow test',
        })
      );

      // Verify metrics were updated
      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.errorsByType.BaseError).toBe(1);
    });

    it('should handle domain error event integration', async () => {
      const clothingError = new Error('Clothing system error');
      const clothingContext = { domain: 'clothing', operation: 'getClothing' };

      // Create a promise to capture the handled error
      const handlePromise = new Promise((resolve, reject) => {
        const originalHandle =
          centralErrorHandler.handle.bind(centralErrorHandler);
        jest
          .spyOn(centralErrorHandler, 'handle')
          .mockImplementation(async (error, context) => {
            try {
              await originalHandle(error, context);
            } catch (handledError) {
              resolve(handledError);
            }
          });
      });

      // Simulate domain error event
      const clothingCallback = mockEventBus.subscribe.mock.calls.find(
        (call) => call[0] === 'CLOTHING_ERROR_OCCURRED'
      )[1];
      await clothingCallback({
        payload: {
          error: clothingError,
          context: clothingContext,
        },
      });

      const handledError = await handlePromise;
      expect(handledError).toBeInstanceOf(BaseError);
      expect(handledError.cause).toBe(clothingError);

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(1);
    });
  });

  describe('Recovery Strategy Integration', () => {
    it('should execute complex recovery strategies with real dependencies', async () => {
      let recoveryAttempted = false;

      // Register a complex recovery strategy that simulates real recovery logic
      centralErrorHandler.registerRecoveryStrategy(
        'ComplexError',
        async (errorInfo) => {
          recoveryAttempted = true;

          // Simulate recovery using MonitoringCoordinator
          return await monitoringCoordinator.executeMonitored(
            'errorRecovery',
            async () => {
              // Simulate some recovery work
              await new Promise((resolve) => setTimeout(resolve, 10));
              return {
                recovered: true,
                fallbackData: { status: 'recovered', timestamp: Date.now() },
                originalError: errorInfo.type,
              };
            },
            { context: 'error recovery operation' }
          );
        }
      );

      class ComplexError extends BaseError {
        isRecoverable() {
          return true;
        }
        constructor(message) {
          super(message, 'COMPLEX_ERROR');
          this.name = 'ComplexError';
        }
      }

      const error = new ComplexError('Complex recoverable error');
      const result = await centralErrorHandler.handle(error, {
        integration: true,
      });

      expect(recoveryAttempted).toBe(true);
      expect(result).toEqual({
        recovered: true,
        fallbackData: expect.objectContaining({ status: 'recovered' }),
        originalError: 'ComplexError',
      });

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.recoveredErrors).toBe(1);
      expect(metrics.recoveryRate).toBe(1);

      // Verify MonitoringCoordinator tracked the recovery operation
      const monitoringStats = monitoringCoordinator.getStats();
      expect(monitoringStats.performance.totalOperations).toBeGreaterThan(0);
    });

    it('should handle recovery failures gracefully with monitoring integration', async () => {
      // Register a recovery strategy that fails
      centralErrorHandler.registerRecoveryStrategy('FailingError', async () => {
        throw new Error('Recovery failed');
      });

      class FailingError extends BaseError {
        isRecoverable() {
          return true;
        }
        constructor(message) {
          super(message, 'FAILING_ERROR');
          this.name = 'FailingError';
        }
      }

      const error = new FailingError('Error with failing recovery');

      try {
        await centralErrorHandler.handle(error);
        expect.fail('Should have thrown error');
      } catch (thrownError) {
        expect(thrownError).toBeInstanceOf(BaseError);
      }

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.failedRecoveries).toBe(1);
      expect(metrics.recoveryRate).toBe(0);

      // Verify recovery failure was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Recovery failed',
        expect.objectContaining({
          originalError: expect.any(Object),
          recoveryError: 'Recovery failed',
        })
      );
    });
  });

  describe('Performance Integration', () => {
    it('should maintain performance under load with real monitoring', async () => {
      const startTime = Date.now();
      const errorCount = 50;
      const errors = [];

      // Generate multiple errors to test performance
      for (let i = 0; i < errorCount; i++) {
        const error = new BaseError(
          `Load test error ${i}`,
          ErrorCodes.INVALID_DATA_GENERIC,
          {
            iteration: i,
            loadTest: true,
          }
        );
        errors.push(error);
      }

      // Process errors in parallel
      const results = await Promise.allSettled(
        errors.map((error) => centralErrorHandler.handle(error).catch((e) => e))
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Verify all errors were processed
      expect(results).toHaveLength(errorCount);
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
        expect(result.value).toBeInstanceOf(BaseError);
      });

      // Verify performance metrics
      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(errorCount);
      expect(metrics.errorsByType.BaseError).toBe(errorCount);

      // Ensure reasonable processing time (should be much less than 1 second for 50 errors)
      expect(processingTime).toBeLessThan(1000);

      // Verify MonitoringCoordinator is still functioning
      const monitoringStats = monitoringCoordinator.getStats();
      expect(monitoringStats.enabled).toBe(true);
    });
  });

  describe('Error Context Integration', () => {
    it('should preserve and enhance error context through complete flow', async () => {
      const originalContext = {
        userId: 'user123',
        sessionId: 'session456',
        operation: 'dataProcessing',
        component: 'dataValidator',
      };

      const error = new BaseError(
        'Context preservation test',
        ErrorCodes.INVALID_DATA_GENERIC,
        {
          field: 'email',
          value: 'invalid-email',
        }
      );

      try {
        await centralErrorHandler.handle(error, originalContext);
      } catch (enhancedError) {
        // Verify error was enhanced by CentralErrorHandler
        expect(enhancedError).toBeInstanceOf(BaseError);
        expect(enhancedError.getContext('handledBy')).toBe(
          'CentralErrorHandler'
        );
        expect(enhancedError.getContext('handledAt')).toBeDefined();
        expect(enhancedError.getContext('recoveryAttempted')).toBe(false);

        // Verify original BaseError context is preserved
        expect(enhancedError.getContext('field')).toBe('email');
        expect(enhancedError.getContext('value')).toBe('invalid-email');

        // Context from handle() call is stored in the error classification system
        // but not directly merged into the BaseError context
      }
    });
  });
});
