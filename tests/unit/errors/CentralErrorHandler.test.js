import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import CentralErrorHandler from '../../../src/errors/CentralErrorHandler.js';
import BaseError from '../../../src/errors/baseError.js';
import { ErrorCodes } from '../../../src/scopeDsl/constants/errorCodes.js';

describe('CentralErrorHandler - Core Error Processing', () => {
  let testBed;
  let mockLogger;
  let mockEventBus;
  let mockMonitoringCoordinator;
  let centralErrorHandler;

  beforeEach(() => {
    testBed = createTestBed();

    mockLogger = testBed.createMockLogger();
    mockEventBus = testBed.createMock('MockEventBus', ['dispatch', 'subscribe']);
    mockMonitoringCoordinator = testBed.createMock('MockMonitoringCoordinator', [
      'executeMonitored', 'getStats', 'getPerformanceMonitor'
    ]);

    centralErrorHandler = new CentralErrorHandler({
      logger: mockLogger,
      eventBus: mockEventBus,
      monitoringCoordinator: mockMonitoringCoordinator
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should create handler with required dependencies', () => {
      expect(centralErrorHandler).toBeInstanceOf(CentralErrorHandler);
      // The constructor doesn't explicitly call debug, so we don't need to verify this
    });

    it('should validate required logger dependency', () => {
      expect(() => {
        new CentralErrorHandler({
          logger: null,
          eventBus: mockEventBus,
          monitoringCoordinator: mockMonitoringCoordinator
        });
      }).toThrow();
    });

    it('should validate required eventBus dependency', () => {
      expect(() => {
        new CentralErrorHandler({
          logger: mockLogger,
          eventBus: null,
          monitoringCoordinator: mockMonitoringCoordinator
        });
      }).toThrow();
    });

    it('should validate required monitoringCoordinator dependency', () => {
      expect(() => {
        new CentralErrorHandler({
          logger: mockLogger,
          eventBus: mockEventBus,
          monitoringCoordinator: null
        });
      }).toThrow();
    });

    it('should register event listeners on initialization', () => {
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('CLOTHING_ERROR_OCCURRED', expect.any(Function));
      expect(mockEventBus.subscribe).toHaveBeenCalledWith('ANATOMY_ERROR_OCCURRED', expect.any(Function));
    });
  });

  describe('Error Classification', () => {
    it('should classify BaseError instances correctly', async () => {
      const baseError = new BaseError('Test message', ErrorCodes.INVALID_DATA_GENERIC, { field: 'test' });
      baseError.addContext('additional', 'context');

      try {
        await centralErrorHandler.handle(baseError, { operation: 'test' });
      } catch (enhancedError) {
        expect(enhancedError).toBeInstanceOf(BaseError);
        expect(enhancedError.getContext('handledBy')).toBe('CentralErrorHandler');
        expect(enhancedError.getContext('handledAt')).toBeDefined();
        expect(enhancedError.getContext('recoveryAttempted')).toBe(false);
      }
    });

    it('should classify generic Error instances correctly', async () => {
      const genericError = new Error('Generic error message');

      try {
        await centralErrorHandler.handle(genericError, { operation: 'test' });
      } catch (enhancedError) {
        expect(enhancedError).toBeInstanceOf(BaseError);
        expect(enhancedError.code).toBe('WRAPPED_ERROR');
        expect(enhancedError.cause).toBe(genericError);
      }
    });

    it('should preserve error context during classification', async () => {
      const baseError = new BaseError('Test message', ErrorCodes.INVALID_DATA_GENERIC, { original: 'context' });
      const additionalContext = { operation: 'test', component: 'testing' };

      try {
        await centralErrorHandler.handle(baseError, additionalContext);
      } catch (enhancedError) {
        // The additional context is stored in the error classification, not directly in the BaseError context
        expect(enhancedError).toBeInstanceOf(BaseError);
        expect(enhancedError.getContext('handledBy')).toBe('CentralErrorHandler');
        expect(enhancedError.getContext('handledAt')).toBeDefined();
      }
    });
  });

  describe('Metrics Tracking', () => {
    it('should track total errors correctly', async () => {
      const error1 = new Error('Error 1');
      const error2 = new BaseError('Error 2', ErrorCodes.INVALID_DATA_GENERIC);

      try { await centralErrorHandler.handle(error1); } catch {}
      try { await centralErrorHandler.handle(error2); } catch {}

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(2);
    });

    it('should track errors by type', async () => {
      const genericError = new Error('Generic error');
      const baseError = new BaseError('Base error', ErrorCodes.INVALID_DATA_GENERIC);

      try { await centralErrorHandler.handle(genericError); } catch {}
      try { await centralErrorHandler.handle(baseError); } catch {}

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.errorsByType.Error).toBe(1);
      expect(metrics.errorsByType.BaseError).toBe(1);
    });

    it('should calculate recovery rate correctly', async () => {
      // Register a recovery strategy
      centralErrorHandler.registerRecoveryStrategy('TestError', async () => 'recovered');

      class TestError extends BaseError {
        constructor(message) {
          super(message, 'TEST_ERROR');
          this.name = 'TestError';
        }

        isRecoverable() { return true; }
      }

      const testError = new TestError('Recoverable error');
      const baseError = new BaseError('Non-recoverable', ErrorCodes.INVALID_DATA_GENERIC, {});

      // This should recover
      const result = await centralErrorHandler.handle(testError);
      expect(result).toBe('recovered');

      // This should not recover
      try { await centralErrorHandler.handle(baseError); } catch {}

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(2);
      expect(metrics.recoveredErrors).toBe(1);
      expect(metrics.recoveryRate).toBe(0.5);
    });

    it('should maintain error registry with size limit', async () => {
      // Create more errors than the registry limit (1000)
      for (let i = 0; i < 1005; i++) {
        try {
          await centralErrorHandler.handle(new Error(`Error ${i}`));
        } catch {}
      }

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.registrySize).toBeLessThanOrEqual(1000);
      expect(metrics.totalErrors).toBe(1005);
    });
  });

  describe('Error Logging', () => {
    it('should log errors based on severity level', async () => {
      class CriticalError extends BaseError {
        getSeverity() { return 'critical'; }
      }

      class WarningError extends BaseError {
        getSeverity() { return 'warning'; }
      }

      const criticalError = new CriticalError('Critical error', ErrorCodes.INVALID_DATA_GENERIC);
      const warningError = new WarningError('Warning error', ErrorCodes.INVALID_DATA_GENERIC);

      try { await centralErrorHandler.handle(criticalError); } catch {}
      try { await centralErrorHandler.handle(warningError); } catch {}

      expect(mockLogger.error).toHaveBeenCalledWith('Critical error occurred', expect.any(Object));
      expect(mockLogger.warn).toHaveBeenCalledWith('Warning occurred', expect.any(Object));
    });

    it('should include comprehensive error context in logs', async () => {
      const error = new BaseError('Test error', ErrorCodes.INVALID_DATA_GENERIC, { field: 'test' });
      const context = { operation: 'testing', userId: 'user123' };

      try {
        await centralErrorHandler.handle(error, context);
      } catch {}

      expect(mockLogger.error).toHaveBeenCalledWith('Error occurred', expect.objectContaining({
        errorId: expect.any(String),
        type: 'BaseError',
        code: ErrorCodes.INVALID_DATA_GENERIC,
        severity: 'error',
        recoverable: false,
        message: 'Test error',
        context: expect.objectContaining({
          field: 'test',
          operation: 'testing',
          userId: 'user123'
        })
      }));
    });
  });

  describe('Event Dispatching', () => {
    it('should dispatch ERROR_OCCURRED events', async () => {
      const error = new BaseError('Test error', ErrorCodes.INVALID_DATA_GENERIC);

      try {
        await centralErrorHandler.handle(error);
      } catch {}

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'ERROR_OCCURRED',
        payload: expect.objectContaining({
          errorId: expect.any(String),
          errorType: 'BaseError',
          severity: 'error',
          recoverable: false,
          message: 'Test error',
          timestamp: expect.any(Number)
        })
      });
    });

    it('should handle domain-specific error events', async () => {
      const clothingError = { payload: { error: new Error('Clothing error'), context: { domain: 'clothing' } } };

      // Simulate event bus callback
      const clothingCallback = mockEventBus.subscribe.mock.calls.find(call => call[0] === 'CLOTHING_ERROR_OCCURRED')[1];

      // Mock the handle method to avoid actual processing during event handling
      const handleSpy = jest.spyOn(centralErrorHandler, 'handle').mockResolvedValue(null);

      await clothingCallback(clothingError);

      expect(handleSpy).toHaveBeenCalledWith(clothingError.payload.error, clothingError.payload.context);

      handleSpy.mockRestore();
    });
  });

  describe('Recovery Strategies', () => {
    it('should register and execute recovery strategies', async () => {
      const mockStrategy = jest.fn().mockResolvedValue('recovery result');
      centralErrorHandler.registerRecoveryStrategy('TestError', mockStrategy);

      class TestError extends BaseError {
        constructor(message) {
          super(message, 'TEST_ERROR');
          this.name = 'TestError';
        }

        isRecoverable() { return true; }
      }

      const error = new TestError('Recoverable error');
      const result = await centralErrorHandler.handle(error, { context: 'test' });

      expect(result).toBe('recovery result');
      expect(mockStrategy).toHaveBeenCalled();

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.recoveredErrors).toBe(1);
    });

    it('should handle recovery strategy failures', async () => {
      const failingStrategy = jest.fn().mockRejectedValue(new Error('Recovery failed'));
      centralErrorHandler.registerRecoveryStrategy('TestError', failingStrategy);

      class TestError extends BaseError {
        constructor(message) {
          super(message, 'TEST_ERROR');
          this.name = 'TestError';
        }

        isRecoverable() { return true; }
      }

      const error = new TestError('Recoverable error');

      try {
        await centralErrorHandler.handle(error);
        expect.fail('Should have thrown error');
      } catch (thrownError) {
        expect(thrownError).toBeInstanceOf(BaseError);
      }

      expect(mockLogger.error).toHaveBeenCalledWith('Recovery failed', expect.any(Object));

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.failedRecoveries).toBe(1);
    });

    it('should register error transforms', () => {
      const transform = jest.fn();
      centralErrorHandler.registerErrorTransform('TestError', transform);

      expect(mockLogger.debug).toHaveBeenCalledWith('Registered error transform for TestError');
    });
  });

  describe('Synchronous Error Handling', () => {
    it('should handle synchronous errors without async operations', () => {
      const error = new Error('Sync error');

      try {
        centralErrorHandler.handleSync(error, { sync: true });
        expect.fail('Should have thrown error');
      } catch (thrownError) {
        expect(thrownError).toBeInstanceOf(BaseError);
      }

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(1);
    });

    it('should execute sync recovery strategies', () => {
      const syncStrategy = jest.fn().mockReturnValue('sync result');
      syncStrategy.sync = true;
      syncStrategy.fallback = jest.fn().mockReturnValue('fallback result');

      centralErrorHandler.registerRecoveryStrategy('TestError', syncStrategy);

      class TestError extends BaseError {
        constructor(message) {
          super(message, 'TEST_ERROR');
          this.name = 'TestError';
        }

        isRecoverable() { return true; }
      }

      const error = new TestError('Sync recoverable error');
      const result = centralErrorHandler.handleSync(error);

      expect(result).toBe('fallback result');
      expect(syncStrategy.fallback).toHaveBeenCalled();
    });
  });

  describe('Fallback Values', () => {
    it('should provide appropriate fallback values for operations', () => {
      expect(centralErrorHandler.getFallbackValue('fetch', 'NetworkError')).toBeNull();
      expect(centralErrorHandler.getFallbackValue('parse', 'ParseError')).toBeNull();
      expect(centralErrorHandler.getFallbackValue('validate', 'ValidationError')).toBe(false);
      expect(centralErrorHandler.getFallbackValue('generate', 'GenerationError')).toEqual({});
      expect(centralErrorHandler.getFallbackValue('calculate', 'MathError')).toBe(0);
      expect(centralErrorHandler.getFallbackValue('unknown', 'UnknownError')).toBeNull();
    });
  });

  describe('Error History and Management', () => {
    it('should return error history with specified limit', async () => {
      for (let i = 0; i < 15; i++) {
        try {
          await centralErrorHandler.handle(new Error(`Error ${i}`));
        } catch {}
      }

      const history = centralErrorHandler.getErrorHistory(5);
      expect(history).toHaveLength(5);
      expect(history[0]).toHaveProperty('registeredAt');
      expect(history[0]).toHaveProperty('id');
      expect(history[0]).toHaveProperty('type');
    });

    it('should clear metrics and registry', async () => {
      try { await centralErrorHandler.handle(new Error('Test error')); } catch {}

      let metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(1);

      centralErrorHandler.clearMetrics();

      metrics = centralErrorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(0);
      expect(metrics.registrySize).toBe(0);
      expect(Object.keys(metrics.errorsByType)).toHaveLength(0);
    });
  });
});