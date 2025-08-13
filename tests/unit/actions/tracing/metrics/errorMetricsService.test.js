import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ErrorMetricsService } from '../../../../../src/actions/tracing/metrics/errorMetricsService.js';
import {
  TraceErrorType,
  TraceErrorSeverity,
} from '../../../../../src/actions/tracing/errors/traceErrorHandler.js';
import { createMockLogger } from '../../../../common/mockFactories/loggerMocks.js';

describe('ErrorMetricsService', () => {
  let metricsService;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    metricsService = new ErrorMetricsService({
      logger: mockLogger,
    });
  });

  describe('Constructor', () => {
    it('should create service with valid logger', () => {
      expect(metricsService).toBeInstanceOf(ErrorMetricsService);
    });

    it('should create service with invalid logger (fallback)', () => {
      // ensureValidLogger provides a fallback, so this won't throw
      const service = new ErrorMetricsService({
        logger: null,
      });
      expect(service).toBeInstanceOf(ErrorMetricsService);
    });
  });

  describe('recordError', () => {
    it('should record error with type and severity', () => {
      metricsService.recordError(
        TraceErrorType.VALIDATION,
        TraceErrorSeverity.LOW
      );

      const metrics = metricsService.getMetrics();

      expect(metrics.totalErrors).toBe(1);
      expect(metrics.errorsByType[TraceErrorType.VALIDATION]).toBe(1);
      expect(metrics.errorsBySeverity[TraceErrorSeverity.LOW]).toBe(1);
    });

    it('should accumulate multiple errors', () => {
      metricsService.recordError(
        TraceErrorType.VALIDATION,
        TraceErrorSeverity.LOW
      );
      metricsService.recordError(
        TraceErrorType.NETWORK,
        TraceErrorSeverity.MEDIUM
      );
      metricsService.recordError(
        TraceErrorType.VALIDATION,
        TraceErrorSeverity.MEDIUM
      );

      const metrics = metricsService.getMetrics();

      expect(metrics.totalErrors).toBe(3);
      expect(metrics.errorsByType[TraceErrorType.VALIDATION]).toBe(2);
      expect(metrics.errorsByType[TraceErrorType.NETWORK]).toBe(1);
      expect(metrics.errorsBySeverity[TraceErrorSeverity.LOW]).toBe(1);
      expect(metrics.errorsBySeverity[TraceErrorSeverity.MEDIUM]).toBe(2);
    });

    it('should handle all error types', () => {
      Object.values(TraceErrorType).forEach((type) => {
        metricsService.recordError(type, TraceErrorSeverity.LOW);
      });

      const metrics = metricsService.getMetrics();

      expect(metrics.totalErrors).toBe(Object.keys(TraceErrorType).length);
      Object.values(TraceErrorType).forEach((type) => {
        expect(metrics.errorsByType[type]).toBe(1);
      });
    });

    it('should handle all severity levels', () => {
      Object.values(TraceErrorSeverity).forEach((severity) => {
        metricsService.recordError(TraceErrorType.UNKNOWN, severity);
      });

      const metrics = metricsService.getMetrics();

      expect(metrics.totalErrors).toBe(Object.keys(TraceErrorSeverity).length);
      Object.values(TraceErrorSeverity).forEach((severity) => {
        expect(metrics.errorsBySeverity[severity]).toBe(1);
      });
    });
  });

  describe('getMetrics', () => {
    it('should return empty metrics initially', () => {
      const metrics = metricsService.getMetrics();

      expect(metrics).toEqual({
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        timeSinceReset: expect.any(Number),
      });
    });

    it('should return correct aggregated metrics', () => {
      // Record various errors
      metricsService.recordError(
        TraceErrorType.VALIDATION,
        TraceErrorSeverity.LOW
      );
      metricsService.recordError(
        TraceErrorType.VALIDATION,
        TraceErrorSeverity.MEDIUM
      );
      metricsService.recordError(
        TraceErrorType.NETWORK,
        TraceErrorSeverity.HIGH
      );
      metricsService.recordError(
        TraceErrorType.MEMORY,
        TraceErrorSeverity.CRITICAL
      );

      const metrics = metricsService.getMetrics();

      expect(metrics.totalErrors).toBe(4);
      expect(metrics.errorsByType).toEqual({
        [TraceErrorType.VALIDATION]: 2,
        [TraceErrorType.NETWORK]: 1,
        [TraceErrorType.MEMORY]: 1,
      });
      expect(metrics.errorsBySeverity).toEqual({
        [TraceErrorSeverity.LOW]: 1,
        [TraceErrorSeverity.MEDIUM]: 1,
        [TraceErrorSeverity.HIGH]: 1,
        [TraceErrorSeverity.CRITICAL]: 1,
      });
    });

    it('should include time since reset', () => {
      const startTime = Date.now();
      const metrics = metricsService.getMetrics();

      expect(metrics.timeSinceReset).toBeGreaterThanOrEqual(0);
      expect(metrics.timeSinceReset).toBeLessThan(100); // Should be very small
    });
  });

  describe('resetMetrics', () => {
    it('should clear all metrics', () => {
      // Record some errors
      metricsService.recordError(
        TraceErrorType.VALIDATION,
        TraceErrorSeverity.LOW
      );
      metricsService.recordError(
        TraceErrorType.NETWORK,
        TraceErrorSeverity.MEDIUM
      );

      // Reset
      metricsService.resetMetrics();

      const metrics = metricsService.getMetrics();

      expect(metrics.totalErrors).toBe(0);
      expect(metrics.errorsByType).toEqual({});
      expect(metrics.errorsBySeverity).toEqual({});
    });

    it('should log reset action', () => {
      metricsService.resetMetrics();

      expect(mockLogger.info).toHaveBeenCalledWith('Error metrics reset');
    });

    it('should reset time tracking', () => {
      // Record an error
      metricsService.recordError(
        TraceErrorType.VALIDATION,
        TraceErrorSeverity.LOW
      );

      // Wait a bit
      const delay = 50;
      jest.advanceTimersByTime(delay);

      // Reset
      metricsService.resetMetrics();

      const metrics = metricsService.getMetrics();

      // Time since reset should be very small after reset
      expect(metrics.timeSinceReset).toBeLessThan(10);
    });
  });

  describe('getErrorRate', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return 0 when no errors recorded', () => {
      const rate = metricsService.getErrorRate();
      expect(rate).toBe(0);
    });

    it('should calculate error rate per minute', () => {
      // Record 10 errors
      for (let i = 0; i < 10; i++) {
        metricsService.recordError(
          TraceErrorType.UNKNOWN,
          TraceErrorSeverity.LOW
        );
      }

      // Advance time by 30 seconds (0.5 minutes)
      jest.advanceTimersByTime(30000);

      // 10 errors in 0.5 minutes = 20 errors per minute
      const rate = metricsService.getErrorRate();
      expect(rate).toBeCloseTo(20, 1);
    });

    it('should use specified time window', () => {
      // Record 6 errors
      for (let i = 0; i < 6; i++) {
        metricsService.recordError(
          TraceErrorType.UNKNOWN,
          TraceErrorSeverity.LOW
        );
      }

      // Advance time by 2 minutes
      jest.advanceTimersByTime(120000);

      // Calculate rate for 2 minute window
      // 6 errors in 2 minutes = 3 errors per minute
      const rate = metricsService.getErrorRate(120000);
      expect(rate).toBeCloseTo(3, 1);
    });

    it('should use effective window when time since reset is less', () => {
      // Record 5 errors immediately
      for (let i = 0; i < 5; i++) {
        metricsService.recordError(
          TraceErrorType.UNKNOWN,
          TraceErrorSeverity.LOW
        );
      }

      // Only 1 second has passed since creation
      jest.advanceTimersByTime(1000);

      // Request rate for 5 minute window, but only 1 second has passed
      // 5 errors in 1 second = 300 errors per minute
      const rate = metricsService.getErrorRate(300000);
      expect(rate).toBeCloseTo(300, 1);
    });

    it('should return 0 when time window is 0', () => {
      // Record some errors
      metricsService.recordError(
        TraceErrorType.UNKNOWN,
        TraceErrorSeverity.LOW
      );

      // Don't advance time
      const rate = metricsService.getErrorRate(0);
      expect(rate).toBe(0);
    });

    it('should calculate rate after reset', () => {
      // Record 10 errors
      for (let i = 0; i < 10; i++) {
        metricsService.recordError(
          TraceErrorType.UNKNOWN,
          TraceErrorSeverity.LOW
        );
      }

      // Advance time
      jest.advanceTimersByTime(60000);

      // Reset metrics
      metricsService.resetMetrics();

      // Record 5 new errors
      for (let i = 0; i < 5; i++) {
        metricsService.recordError(
          TraceErrorType.UNKNOWN,
          TraceErrorSeverity.LOW
        );
      }

      // Advance time by 30 seconds after reset
      jest.advanceTimersByTime(30000);

      // Should only count errors after reset
      // 5 errors in 30 seconds = 10 errors per minute
      const rate = metricsService.getErrorRate();
      expect(rate).toBeCloseTo(10, 1);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle rapid error recording', () => {
      // Record 100 errors rapidly
      for (let i = 0; i < 100; i++) {
        const types = Object.values(TraceErrorType);
        const severities = Object.values(TraceErrorSeverity);
        const type = types[i % types.length];
        const severity = severities[i % severities.length];

        metricsService.recordError(type, severity);
      }

      const metrics = metricsService.getMetrics();
      expect(metrics.totalErrors).toBe(100);
    });

    it('should maintain accuracy with multiple resets', () => {
      // First batch
      metricsService.recordError(
        TraceErrorType.VALIDATION,
        TraceErrorSeverity.LOW
      );
      metricsService.recordError(
        TraceErrorType.NETWORK,
        TraceErrorSeverity.MEDIUM
      );

      metricsService.resetMetrics();

      // Second batch
      metricsService.recordError(
        TraceErrorType.MEMORY,
        TraceErrorSeverity.CRITICAL
      );

      const metrics = metricsService.getMetrics();

      expect(metrics.totalErrors).toBe(1);
      expect(metrics.errorsByType).toEqual({
        [TraceErrorType.MEMORY]: 1,
      });
      expect(metrics.errorsBySeverity).toEqual({
        [TraceErrorSeverity.CRITICAL]: 1,
      });
    });
  });
});
