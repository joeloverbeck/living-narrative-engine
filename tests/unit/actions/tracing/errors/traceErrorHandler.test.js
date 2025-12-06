import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  TraceErrorHandler,
  TraceErrorType,
  TraceErrorSeverity,
} from '../../../../../src/actions/tracing/errors/traceErrorHandler.js';
import { createMockLogger } from '../../../../common/mockFactories/loggerMocks.js';

describe('TraceErrorHandler', () => {
  let errorHandler;
  let mockLogger;
  let mockErrorMetrics;
  let mockRecoveryManager;
  let mockConfig;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockErrorMetrics = {
      recordError: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
      }),
      getErrorRate: jest.fn().mockReturnValue(0), // Added missing required method
    };
    mockRecoveryManager = {
      attemptRecovery: jest.fn().mockResolvedValue({
        action: 'continue',
        shouldContinue: true,
        fallbackMode: null,
      }),
      registerFallbackMode: jest.fn(), // Added missing required method
      isCircuitOpen: jest.fn().mockReturnValue(false), // Added missing required method
    };
    mockConfig = {};

    errorHandler = new TraceErrorHandler({
      logger: mockLogger,
      errorMetrics: mockErrorMetrics,
      recoveryManager: mockRecoveryManager,
      config: mockConfig,
    });
  });

  describe('Constructor', () => {
    it('should create handler with valid dependencies', () => {
      expect(errorHandler).toBeInstanceOf(TraceErrorHandler);
    });

    it('should create handler even with invalid logger (fallback)', () => {
      // ensureValidLogger provides a fallback, so this won't throw
      const handler = new TraceErrorHandler({
        logger: {},
        errorMetrics: mockErrorMetrics,
        recoveryManager: mockRecoveryManager,
      });
      expect(handler).toBeInstanceOf(TraceErrorHandler);
    });

    it('should throw if errorMetrics is missing', () => {
      expect(() => {
        new TraceErrorHandler({
          logger: mockLogger,
          errorMetrics: null,
          recoveryManager: mockRecoveryManager,
        });
      }).toThrow();
    });
  });

  describe('handleError', () => {
    it('should handle error and return recovery result', async () => {
      const error = new Error('Test error');
      const context = { componentName: 'TestComponent' };
      const errorType = TraceErrorType.VALIDATION;

      const result = await errorHandler.handleError(error, context, errorType);

      expect(result).toMatchObject({
        errorId: expect.stringMatching(/^trace-error-/),
        handled: true,
        severity: TraceErrorSeverity.LOW,
        recoveryAction: 'continue',
        shouldContinue: true,
        fallbackMode: null,
      });

      expect(mockErrorMetrics.recordError).toHaveBeenCalledWith(
        errorType,
        TraceErrorSeverity.LOW
      );
      expect(mockRecoveryManager.attemptRecovery).toHaveBeenCalled();
    });

    it('should classify configuration errors as medium severity', async () => {
      const error = new Error('Config error');
      const context = {};
      const errorType = TraceErrorType.CONFIGURATION;

      const result = await errorHandler.handleError(error, context, errorType);

      expect(result.severity).toBe(TraceErrorSeverity.MEDIUM);
    });

    it('should classify memory errors as critical', async () => {
      const error = new Error('Out of memory');
      const context = {};
      const errorType = TraceErrorType.MEMORY;

      const result = await errorHandler.handleError(error, context, errorType);

      expect(result.severity).toBe(TraceErrorSeverity.CRITICAL);
    });

    it('should sanitize error context', async () => {
      const error = new Error('Test error');
      const context = {
        componentName: 'TestComponent',
        password: 'secret123',
        token: 'auth-token',
        key: 'api-key',
        secret: 'secret-value',
        normalField: 'normal-value',
      };

      await errorHandler.handleError(error, context, TraceErrorType.UNKNOWN);

      const recoveryCall = mockRecoveryManager.attemptRecovery.mock.calls[0][0];
      expect(recoveryCall.context).not.toHaveProperty('password');
      expect(recoveryCall.context).not.toHaveProperty('token');
      expect(recoveryCall.context).not.toHaveProperty('key');
      expect(recoveryCall.context).not.toHaveProperty('secret');
      expect(recoveryCall.context).toHaveProperty('normalField');
    });

    it('should truncate large context fields', async () => {
      const error = new Error('Test error');
      const largeString = 'a'.repeat(2000);
      const context = {
        largeField: largeString,
      };

      await errorHandler.handleError(error, context, TraceErrorType.UNKNOWN);

      const recoveryCall = mockRecoveryManager.attemptRecovery.mock.calls[0][0];
      expect(recoveryCall.context.largeField).toHaveLength(1014); // 1000 + '...[truncated]'
      expect(recoveryCall.context.largeField).toContain('[truncated]');
    });

    it('should provide default error information when error is null', async () => {
      await errorHandler.handleError(null, { componentName: 'NullComponent' });

      const recoveryCall = mockRecoveryManager.attemptRecovery.mock.calls[0][0];
      expect(recoveryCall.error).toEqual({
        name: 'UnknownError',
        message: 'No error information provided',
        code: undefined,
      });
    });
  });

  describe('shouldDisableComponent', () => {
    it('should return false for component with no errors', () => {
      const result = errorHandler.shouldDisableComponent('TestComponent');
      expect(result).toBe(false);
    });

    it('should return true if more than 5 errors in 5 minutes', async () => {
      const error = new Error('Test error');
      const context = { componentName: 'TestComponent' };

      // Create 6 errors
      for (let i = 0; i < 6; i++) {
        await errorHandler.handleError(error, context, TraceErrorType.UNKNOWN);
      }

      const result = errorHandler.shouldDisableComponent('TestComponent');
      expect(result).toBe(true);
    });

    it('should return true if any critical errors', async () => {
      const error = new Error('Critical error');
      const context = { componentName: 'TestComponent' };

      await errorHandler.handleError(error, context, TraceErrorType.MEMORY);

      const result = errorHandler.shouldDisableComponent('TestComponent');
      expect(result).toBe(true);
    });

    it('should only consider recent errors', async () => {
      const error = new Error('Test error');
      const context = { componentName: 'TestComponent' };

      // Create 3 recent errors
      for (let i = 0; i < 3; i++) {
        await errorHandler.handleError(error, context, TraceErrorType.UNKNOWN);
      }

      // Should not be disabled with only 3 errors
      const result = errorHandler.shouldDisableComponent('TestComponent');
      expect(result).toBe(false);
    });
  });

  describe('getErrorStatistics', () => {
    it('should return empty statistics initially', () => {
      const stats = errorHandler.getErrorStatistics();

      expect(stats).toEqual({
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        recentErrors: 0,
      });
    });

    it('should track error statistics', async () => {
      const error1 = new Error('Validation error');
      const error2 = new Error('Network error');

      await errorHandler.handleError(
        error1,
        { componentName: 'Comp1' },
        TraceErrorType.VALIDATION
      );
      await errorHandler.handleError(
        error2,
        { componentName: 'Comp2' },
        TraceErrorType.NETWORK
      );

      const stats = errorHandler.getErrorStatistics();

      expect(stats.totalErrors).toBe(2);
      expect(stats.errorsByType[TraceErrorType.VALIDATION]).toBe(1);
      expect(stats.errorsByType[TraceErrorType.NETWORK]).toBe(1);
      expect(stats.errorsBySeverity[TraceErrorSeverity.LOW]).toBe(1);
      expect(stats.errorsBySeverity[TraceErrorSeverity.MEDIUM]).toBe(1);
      expect(stats.recentErrors).toBe(2);
    });

    it('should retain only the most recent 50 errors per component', async () => {
      const error = new Error('Repeated error');
      const componentName = 'OverflowComponent';

      for (let i = 0; i < 60; i++) {
        await errorHandler.handleError(
          error,
          { componentName },
          TraceErrorType.UNKNOWN
        );
      }

      const stats = errorHandler.getErrorStatistics();

      expect(stats.totalErrors).toBe(50);
      expect(errorHandler.shouldDisableComponent(componentName)).toBe(true);
    });

    it('should remove the oldest component history when exceeding the global limit', async () => {
      const error = new Error('Component error');

      for (let i = 0; i < 101; i++) {
        await errorHandler.handleError(
          error,
          { componentName: `Component-${i}` },
          TraceErrorType.UNKNOWN
        );
      }

      const stats = errorHandler.getErrorStatistics();

      expect(stats.totalErrors).toBe(100);
      expect(stats.errorsByType[TraceErrorType.UNKNOWN]).toBe(100);
    });
  });

  describe('Error severity classification', () => {
    it('should classify file system errors based on error code', async () => {
      const enospcError = new Error('No space left');
      enospcError.code = 'ENOSPC';
      const result1 = await errorHandler.handleError(
        enospcError,
        {},
        TraceErrorType.FILE_SYSTEM
      );
      expect(result1.severity).toBe(TraceErrorSeverity.HIGH);

      const eaccesError = new Error('Access denied');
      eaccesError.code = 'EACCES';
      const result2 = await errorHandler.handleError(
        eaccesError,
        {},
        TraceErrorType.FILE_SYSTEM
      );
      expect(result2.severity).toBe(TraceErrorSeverity.HIGH);

      const otherError = new Error('File error');
      const result3 = await errorHandler.handleError(
        otherError,
        {},
        TraceErrorType.FILE_SYSTEM
      );
      expect(result3.severity).toBe(TraceErrorSeverity.MEDIUM);
    });
  });

  describe('Error logging', () => {
    it('should log low severity errors as warnings', async () => {
      const error = new Error('Validation error');
      await errorHandler.handleError(error, {}, TraceErrorType.VALIDATION);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should log medium severity errors as errors', async () => {
      const error = new Error('Network error');
      await errorHandler.handleError(error, {}, TraceErrorType.NETWORK);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log critical errors as errors', async () => {
      const error = new Error('Memory error');
      await errorHandler.handleError(error, {}, TraceErrorType.MEMORY);

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
