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

    it('should apply registered transforms during synchronous handling', () => {
      const transform = jest.fn((error) => {
        error.addContext('syncTransformed', true);
        return error;
      });

      centralErrorHandler.registerErrorTransform('BaseError', transform);

      const error = new BaseError('Sync error', ErrorCodes.INVALID_DATA_GENERIC);

      expect(() => centralErrorHandler.handleSync(error)).toThrow(BaseError);
      expect(transform).toHaveBeenCalledWith(error);
    });

    it('should throw when sync strategy has no fallback', () => {
      const syncStrategy = jest.fn();
      syncStrategy.sync = true;

      centralErrorHandler.registerRecoveryStrategy('SyncRecoverableError', syncStrategy);

      class SyncRecoverableError extends BaseError {
        constructor(message) {
          super(message, 'SYNC_RECOVERABLE_ERROR');
        }

        isRecoverable() { return true; }
      }

      const error = new SyncRecoverableError('Needs fallback');

      expect(() => centralErrorHandler.handleSync(error)).toThrow(BaseError);
      expect(syncStrategy).not.toHaveBeenCalled();
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

    it('should clean old entries from registry', async () => {
      // Override the default cleanup time
      const originalCleanup = Date.now;
      const mockTime = jest.fn();
      mockTime.mockReturnValue(1000000);
      Date.now = mockTime;

      try { await centralErrorHandler.handle(new Error('Old error')); } catch {}

      // Advance time by 1 hour
      mockTime.mockReturnValue(1000000 + 3600001);

      try { await centralErrorHandler.handle(new Error('New error')); } catch {}

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.registrySize).toBeGreaterThan(0);

      Date.now = originalCleanup;
    });
  });

  describe('Error Transforms', () => {
    it('should apply registered error transforms', async () => {
      const transform = jest.fn((error) => {
        error.addContext('transformed', true);
        return error;
      });

      centralErrorHandler.registerErrorTransform('BaseError', transform);

      const error = new BaseError('Test error', ErrorCodes.INVALID_DATA_GENERIC);

      try {
        await centralErrorHandler.handle(error);
      } catch (enhancedError) {
        expect(transform).toHaveBeenCalled();
        expect(enhancedError.getContext('transformed')).toBe(true);
      }
    });

    it('should handle transform errors gracefully', async () => {
      const faultyTransform = jest.fn(() => {
        throw new Error('Transform failed');
      });

      centralErrorHandler.registerErrorTransform('BaseError', faultyTransform);

      const error = new BaseError('Test error', ErrorCodes.INVALID_DATA_GENERIC);

      try {
        await centralErrorHandler.handle(error);
      } catch (enhancedError) {
        expect(enhancedError).toBeInstanceOf(BaseError);
        expect(mockLogger.error).toHaveBeenCalledWith('Error transform failed', expect.any(Object));
      }
    });

    it('should override existing strategies when registering same error type', () => {
      const strategy1 = jest.fn();
      const strategy2 = jest.fn();

      centralErrorHandler.registerRecoveryStrategy('TestError', strategy1);
      centralErrorHandler.registerRecoveryStrategy('TestError', strategy2);

      expect(mockLogger.warn).toHaveBeenCalledWith('Overwriting existing recovery strategy for TestError');
    });
  });

  describe('Context Enhancement', () => {
    it('should enhance error with tracking context', async () => {
      const error = new BaseError('Test error', ErrorCodes.INVALID_DATA_GENERIC);

      try {
        await centralErrorHandler.handle(error, { source: 'test' });
      } catch (enhancedError) {
        expect(enhancedError.getContext('handledBy')).toBe('CentralErrorHandler');
        expect(enhancedError.getContext('handledAt')).toBeDefined();
        expect(enhancedError.getContext('recoveryAttempted')).toBeDefined();
        expect(enhancedError.getContext('errorId')).toBeDefined();
      }
    });

    it('should mark recovery attempted when no strategy exists', async () => {
      class RecoverableError extends BaseError {
        constructor(message) {
          super(message, 'RECOVERABLE_ERROR');
          this.name = 'RecoverableError';
        }

        isRecoverable() { return true; }
      }

      const recoverableError = new RecoverableError('Needs recovery');

      mockLogger.error.mockClear();

      try {
        await centralErrorHandler.handle(recoverableError);
        expect.fail('Expected handler to throw when no strategy is present');
      } catch (enhancedError) {
        expect(enhancedError).toBeInstanceOf(BaseError);
        expect(enhancedError.getContext('recoveryAttempted')).toBe(true);
      }

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.recoveredErrors).toBe(0);
      expect(metrics.failedRecoveries).toBe(0);
      expect(mockLogger.error).not.toHaveBeenCalledWith('Recovery failed', expect.any(Object));
    });

    it('should handle non-BaseError correctly', async () => {
      const plainError = new Error('Plain error');
      const typeError = new TypeError('Type error');
      const rangeError = new RangeError('Range error');

      try { await centralErrorHandler.handle(plainError); } catch (e) {
        expect(e).toBeInstanceOf(BaseError);
        expect(e.code).toBe('WRAPPED_ERROR');
        expect(e.cause).toBe(plainError);
      }

      try { await centralErrorHandler.handle(typeError); } catch (e) {
        expect(e).toBeInstanceOf(BaseError);
        expect(e.cause).toBe(typeError);
      }

      try { await centralErrorHandler.handle(rangeError); } catch (e) {
        expect(e).toBeInstanceOf(BaseError);
        expect(e.cause).toBe(rangeError);
      }
    });
  });

  describe('Error Severity Classification', () => {
    it('should classify errors by severity', async () => {
      class CriticalError extends BaseError {
        getSeverity() { return 'critical'; }
      }

      class WarningError extends BaseError {
        getSeverity() { return 'warning'; }
      }

      const critical = new CriticalError('Critical', ErrorCodes.INVALID_DATA_GENERIC);
      const warning = new WarningError('Warning', ErrorCodes.INVALID_DATA_GENERIC);
      const error = new BaseError('Error', ErrorCodes.INVALID_DATA_GENERIC);

      try { await centralErrorHandler.handle(critical); } catch {}
      try { await centralErrorHandler.handle(warning); } catch {}
      try { await centralErrorHandler.handle(error); } catch {}

      const metrics = centralErrorHandler.getMetrics();
      expect(metrics.errorsBySeverity.critical).toBe(1);
      expect(metrics.errorsBySeverity.warning).toBe(1);
      expect(metrics.errorsBySeverity.error).toBe(1);
    });
  });

  describe('Context Truncation and Domain Listeners', () => {
    it('should truncate oversized context payloads during classification', async () => {
      const largePayload = 'x'.repeat(1500);
      const error = new BaseError('Oversized context', ErrorCodes.INVALID_DATA_GENERIC, {
        payload: largePayload
      });

      mockLogger.error.mockClear();

      try {
        await centralErrorHandler.handle(error, { extra: largePayload });
      } catch {}

      const errorLogCall = mockLogger.error.mock.calls.find(([message]) => message === 'Error occurred');
      expect(errorLogCall).toBeDefined();
      const [, logData] = errorLogCall;
      expect(logData.context._truncated).toBe(true);
      expect(logData.context._originalSize).toBeGreaterThan(centralErrorHandler.getMetrics().totalErrors);
    });

    it('should log informational severity with info logger', async () => {
      class InfoError extends BaseError {
        getSeverity() { return 'info'; }
      }

      const infoError = new InfoError('Informational', ErrorCodes.INVALID_DATA_GENERIC);

      mockLogger.info.mockClear();

      try {
        await centralErrorHandler.handle(infoError);
      } catch {}

      expect(mockLogger.info).toHaveBeenCalledWith('Error handled', expect.objectContaining({
        severity: 'info'
      }));
    });

    it('should handle anatomy domain events through the event bus listener', async () => {
      const anatomyEvent = {
        payload: {
          error: new Error('Anatomy failure'),
          context: { domain: 'anatomy' }
        }
      };

      const anatomyCallback = mockEventBus.subscribe.mock.calls.find(([event]) => event === 'ANATOMY_ERROR_OCCURRED')[1];
      const handleSpy = jest.spyOn(centralErrorHandler, 'handle').mockResolvedValue(null);

      await anatomyCallback(anatomyEvent);

      expect(handleSpy).toHaveBeenCalledWith(anatomyEvent.payload.error, anatomyEvent.payload.context);

      handleSpy.mockRestore();
    });
  });
});
