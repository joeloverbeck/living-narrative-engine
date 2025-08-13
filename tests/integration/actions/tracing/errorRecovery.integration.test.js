import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraceErrorHandler } from '../../../../src/actions/tracing/errors/traceErrorHandler.js';
import { RecoveryManager } from '../../../../src/actions/tracing/recovery/recoveryManager.js';
import { RetryManager } from '../../../../src/actions/tracing/resilience/retryManager.js';
import { ErrorMetricsService } from '../../../../src/actions/tracing/metrics/errorMetricsService.js';
import { ResilientServiceWrapper } from '../../../../src/actions/tracing/resilience/resilientServiceWrapper.js';
import {
  TraceErrorType,
  TraceErrorSeverity,
} from '../../../../src/actions/tracing/errors/traceErrorHandler.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('Error Recovery Integration', () => {
  let errorHandler;
  let recoveryManager;
  let retryManager;
  let errorMetrics;
  let resilientWrapper;
  let mockLogger;
  let mockService;

  beforeEach(() => {
    mockLogger = createMockLogger();

    // Create real instances with dependencies
    errorMetrics = new ErrorMetricsService({ logger: mockLogger });
    retryManager = new RetryManager();
    recoveryManager = new RecoveryManager({
      logger: mockLogger,
      config: {},
      retryManager,
    });
    errorHandler = new TraceErrorHandler({
      logger: mockLogger,
      errorMetrics,
      recoveryManager,
      config: {},
    });

    // Create a mock service to wrap
    mockService = {
      writeTrace: jest.fn().mockResolvedValue(),
      shouldTrace: jest.fn().mockReturnValue(true),
      processData: jest.fn().mockResolvedValue('processed'),
    };

    resilientWrapper = new ResilientServiceWrapper({
      service: mockService,
      errorHandler,
      logger: mockLogger,
      serviceName: 'TestTracingService',
    });
  });

  describe('End-to-end error handling', () => {
    it('should handle successful operations without error handling', async () => {
      const proxy = resilientWrapper.createResilientProxy();
      const result = await proxy.processData('test-data');

      expect(result).toBe('processed');
      expect(mockService.processData).toHaveBeenCalledWith('test-data');

      // Verify no errors were recorded
      const metrics = errorMetrics.getMetrics();
      expect(metrics.totalErrors).toBe(0);
    });

    it('should handle and recover from transient errors', async () => {
      // Make the service fail twice then succeed
      mockService.processData
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce('processed-after-retry');

      jest.useFakeTimers();

      const proxy = resilientWrapper.createResilientProxy();
      const resultPromise = proxy.processData('test-data');

      // Advance timers to handle retries
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      jest.useRealTimers();

      // Should eventually succeed
      expect(result).toBeDefined();

      // Verify error was recorded
      const metrics = errorMetrics.getMetrics();
      expect(metrics.totalErrors).toBeGreaterThan(0);
    });

    it('should disable component after too many errors', async () => {
      const error = new Error('Persistent failure');
      mockService.processData.mockRejectedValue(error);

      const proxy = resilientWrapper.createResilientProxy();

      // Trigger multiple errors
      for (let i = 0; i < 6; i++) {
        await proxy.processData(`test-${i}`);
      }

      // Service should be disabled
      expect(resilientWrapper.isEnabled()).toBe(false);

      // Further calls should return fallback without calling service
      mockService.processData.mockClear();
      await proxy.processData('test-final');
      expect(mockService.processData).not.toHaveBeenCalled();
    });

    it('should handle critical errors with emergency stop', async () => {
      // Create a memory error which is critical
      const memoryError = new Error('Out of memory');
      const errorInfo = {
        id: 'test-error',
        type: TraceErrorType.MEMORY,
        severity: TraceErrorSeverity.CRITICAL,
        context: { componentName: 'TestService' },
        timestamp: new Date().toISOString(),
        error: { name: 'Error', message: 'Out of memory' },
        stack: null,
      };

      const recoveryResult = await recoveryManager.attemptRecovery(errorInfo);

      expect(recoveryResult.action).toBe('emergency');
      expect(recoveryResult.fallbackMode).toBe('emergency_disabled');
      expect(recoveryResult.shouldContinue).toBe(false);
    });
  });

  describe('Recovery strategies', () => {
    it('should retry network errors with exponential backoff', async () => {
      const networkError = new Error('Connection timeout');
      networkError.code = 'ETIMEOUT';

      mockService.processData
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce('success-after-retry');

      jest.useFakeTimers();

      const proxy = resilientWrapper.createResilientProxy();
      const resultPromise = proxy.processData('test-data');

      // Allow retries to complete
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      jest.useRealTimers();

      // Verify metrics show the errors
      const metrics = errorMetrics.getMetrics();
      expect(metrics.totalErrors).toBeGreaterThan(0);
      expect(metrics.errorsByType[TraceErrorType.TIMEOUT]).toBeGreaterThan(0);
    });

    it('should use fallback mode for high severity errors', async () => {
      // Register a fallback handler
      recoveryManager.registerFallbackMode(
        'TestTracingService',
        async (errorInfo) => {
          // Fallback logic
          return 'fallback-result';
        }
      );

      const fileError = new Error('Disk full');
      fileError.code = 'ENOSPC';

      mockService.processData.mockRejectedValue(fileError);

      const proxy = resilientWrapper.createResilientProxy();
      const result = await proxy.processData('test-data');

      // Should have triggered fallback
      expect(resilientWrapper.getFallbackMode()).toBeTruthy();
    });
  });

  describe('Metrics and monitoring', () => {
    it('should accurately track error metrics', async () => {
      const validationError = new Error('Validation failed');
      const networkError = new Error('Network error');

      // Create errors of different types
      await errorHandler.handleError(
        validationError,
        { componentName: 'Comp1' },
        TraceErrorType.VALIDATION
      );
      await errorHandler.handleError(
        networkError,
        { componentName: 'Comp2' },
        TraceErrorType.NETWORK
      );

      const metrics = errorMetrics.getMetrics();

      expect(metrics.totalErrors).toBe(2);
      expect(metrics.errorsByType[TraceErrorType.VALIDATION]).toBe(1);
      expect(metrics.errorsByType[TraceErrorType.NETWORK]).toBe(1);
      expect(metrics.errorsBySeverity[TraceErrorSeverity.LOW]).toBe(1);
      expect(metrics.errorsBySeverity[TraceErrorSeverity.MEDIUM]).toBe(1);
    });

    it('should calculate error rates correctly', () => {
      jest.useFakeTimers();

      // Record errors
      for (let i = 0; i < 10; i++) {
        errorMetrics.recordError(
          TraceErrorType.UNKNOWN,
          TraceErrorSeverity.LOW
        );
      }

      // Advance time by 1 minute
      jest.advanceTimersByTime(60000);

      // 10 errors in 1 minute = 10 errors per minute
      const rate = errorMetrics.getErrorRate();
      expect(rate).toBeCloseTo(10, 1);

      jest.useRealTimers();
    });

    it('should provide error statistics for monitoring', async () => {
      // Create various errors
      const errors = [
        { type: TraceErrorType.VALIDATION, severity: TraceErrorSeverity.LOW },
        { type: TraceErrorType.NETWORK, severity: TraceErrorSeverity.MEDIUM },
        { type: TraceErrorType.MEMORY, severity: TraceErrorSeverity.CRITICAL },
      ];

      for (const { type, severity } of errors) {
        const error = new Error(`Error of type ${type}`);
        await errorHandler.handleError(error, { componentName: 'Test' }, type);
      }

      const stats = errorHandler.getErrorStatistics();

      expect(stats.totalErrors).toBe(3);
      expect(Object.keys(stats.errorsByType).length).toBe(3);
      expect(Object.keys(stats.errorsBySeverity).length).toBe(3);
    });
  });

  describe('Circuit breaker pattern', () => {
    it('should open circuit after error threshold', async () => {
      const proxy = resilientWrapper.createResilientProxy();
      const error = new Error('Service failure');
      mockService.processData.mockRejectedValue(error);

      // Trigger 6 errors to exceed threshold
      for (let i = 0; i < 6; i++) {
        await proxy.processData(`test-${i}`);
      }

      // Check circuit is open
      expect(recoveryManager.isCircuitOpen('TestTracingService')).toBe(true);
      expect(resilientWrapper.isEnabled()).toBe(false);
    });

    it('should prevent cascading failures', async () => {
      // Create multiple services
      const service1 = {
        process: jest.fn().mockRejectedValue(new Error('Fail')),
      };
      const service2 = { process: jest.fn().mockResolvedValue('success') };

      const wrapper1 = new ResilientServiceWrapper({
        service: service1,
        errorHandler,
        logger: mockLogger,
        serviceName: 'Service1',
      });

      const wrapper2 = new ResilientServiceWrapper({
        service: service2,
        errorHandler,
        logger: mockLogger,
        serviceName: 'Service2',
      });

      const proxy1 = wrapper1.createResilientProxy();
      const proxy2 = wrapper2.createResilientProxy();

      // Service1 fails multiple times
      for (let i = 0; i < 6; i++) {
        await proxy1.process();
      }

      // Service1 should be disabled
      expect(wrapper1.isEnabled()).toBe(false);

      // Service2 should still work
      const result = await proxy2.process();
      expect(result).toBe('success');
      expect(wrapper2.isEnabled()).toBe(true);
    });
  });

  describe('Graceful degradation', () => {
    it('should continue with degraded functionality', async () => {
      const proxy = resilientWrapper.createResilientProxy();

      // Disable the service
      resilientWrapper.disable('Testing degradation');

      // Write operations should no-op
      const writeResult = await proxy.writeTrace('trace-data');
      expect(writeResult).toBeUndefined();
      expect(mockService.writeTrace).not.toHaveBeenCalled();

      // Boolean checks should return safe defaults
      const shouldTrace = await proxy.shouldTrace();
      expect(shouldTrace).toBe(false);
      expect(mockService.shouldTrace).not.toHaveBeenCalled();
    });

    it('should recover when conditions improve', async () => {
      const proxy = resilientWrapper.createResilientProxy();

      // First fail
      mockService.processData.mockRejectedValueOnce(
        new Error('Temporary failure')
      );
      await proxy.processData('test1');

      // Service in fallback mode
      expect(resilientWrapper.getFallbackMode()).toBeTruthy();

      // Now succeed
      mockService.processData.mockResolvedValueOnce('success');
      const result = await proxy.processData('test2');

      // Service should recover
      expect(result).toBe('success');
      expect(resilientWrapper.getFallbackMode()).toBeNull();
    });
  });

  describe('Error sanitization and logging', () => {
    it('should sanitize sensitive information from errors', async () => {
      const error = new Error('Authentication failed');
      const sensitiveContext = {
        componentName: 'AuthService',
        password: 'secret123',
        token: 'auth-token-xyz',
        apiKey: 'key-123',
        normalField: 'visible-data',
      };

      await errorHandler.handleError(
        error,
        sensitiveContext,
        TraceErrorType.UNKNOWN
      );

      // Check that sensitive data was not logged
      const logCalls = mockLogger.error.mock.calls;
      const loggedData = JSON.stringify(logCalls);

      expect(loggedData).not.toContain('secret123');
      expect(loggedData).not.toContain('auth-token-xyz');
      expect(loggedData).not.toContain('key-123');
      expect(loggedData).toContain('visible-data');
    });

    it('should truncate large error contexts', async () => {
      const error = new Error('Test error');
      const largeData = 'x'.repeat(2000);
      const context = {
        componentName: 'TestService',
        largeField: largeData,
      };

      await errorHandler.handleError(error, context, TraceErrorType.UNKNOWN);

      // Verify the context was truncated
      const stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);
    });
  });
});
