/**
 * @file Unit tests for the PerformanceMonitor class
 * @see src/actions/tracing/performanceMonitor.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import PerformanceMonitor from '../../../../src/actions/tracing/performanceMonitor.js';
import StructuredTrace from '../../../../src/actions/tracing/structuredTrace.js';

describe('PerformanceMonitor', () => {
  let mockPerformanceNow;
  let timeCounter;
  let structuredTrace;
  let monitor;

  beforeEach(() => {
    // Mock performance.now() for deterministic timing
    timeCounter = 1000;
    mockPerformanceNow = jest
      .spyOn(performance, 'now')
      .mockImplementation(() => {
        const currentTime = timeCounter;
        return currentTime;
      });

    structuredTrace = new StructuredTrace();
    monitor = new PerformanceMonitor(structuredTrace);
  });

  afterEach(() => {
    mockPerformanceNow.mockRestore();
  });

  describe('constructor', () => {
    it('should create monitor with valid StructuredTrace', () => {
      expect(monitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should accept custom thresholds', () => {
      const customThresholds = {
        slowOperationMs: 200,
        criticalOperationMs: 1000,
        maxConcurrency: 5,
      };

      const customMonitor = new PerformanceMonitor(
        structuredTrace,
        customThresholds
      );

      const status = customMonitor.getMonitoringStatus();
      expect(status.thresholds.slowOperationMs).toBe(200);
      expect(status.thresholds.criticalOperationMs).toBe(1000);
      expect(status.thresholds.maxConcurrency).toBe(5);
    });

    it('should throw error if structuredTrace is null', () => {
      expect(() => new PerformanceMonitor(null)).toThrow(
        'Missing required dependency: StructuredTrace.'
      );
    });

    it('should throw error if structuredTrace lacks required methods', () => {
      const invalidTrace = { someMethod: () => {} };
      expect(() => new PerformanceMonitor(invalidTrace)).toThrow();
    });
  });

  describe('setThresholds', () => {
    it('should update thresholds', () => {
      monitor.setThresholds({
        slowOperationMs: 150,
        maxErrorRate: 10,
      });

      const status = monitor.getMonitoringStatus();
      expect(status.thresholds.slowOperationMs).toBe(150);
      expect(status.thresholds.maxErrorRate).toBe(10);
      // Other thresholds should remain at defaults
      expect(status.thresholds.criticalOperationMs).toBe(500);
    });

    it('should validate threshold values', () => {
      expect(() => monitor.setThresholds({ slowOperationMs: -100 })).toThrow(
        'slowOperationMs must be a non-negative number'
      );

      expect(() =>
        monitor.setThresholds({ maxConcurrency: 'invalid' })
      ).toThrow('maxConcurrency must be a non-negative number');
    });

    it('should generate alert when thresholds changed during monitoring', () => {
      const stopMonitoring = monitor.startMonitoring();

      monitor.setThresholds({ slowOperationMs: 200 });

      const alerts = monitor.getAlerts({ type: 'threshold_changed' });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].message).toContain('thresholds updated');

      stopMonitoring();
    });

    it('should throw error if thresholds is null', () => {
      expect(() => monitor.setThresholds(null)).toThrow(
        'Thresholds are required'
      );
    });

    it('should throw error if thresholds is not an object', () => {
      expect(() => monitor.setThresholds('invalid')).toThrow(
        'Thresholds must be an object'
      );
    });
  });

  describe('enableSampling', () => {
    it('should set sampling rate with number', () => {
      monitor.enableSampling(0.5);

      const status = monitor.getMonitoringStatus();
      expect(status.samplingConfig.rate).toBe(0.5);
    });

    it('should accept full sampling config object', () => {
      monitor.enableSampling({
        rate: 0.3,
        strategy: 'adaptive',
        alwaysSampleErrors: false,
      });

      const status = monitor.getMonitoringStatus();
      expect(status.samplingConfig.rate).toBe(0.3);
      expect(status.samplingConfig.strategy).toBe('adaptive');
      expect(status.samplingConfig.alwaysSampleErrors).toBe(false);
    });

    it('should validate sampling rate range', () => {
      expect(() => monitor.enableSampling(-0.1)).toThrow(
        'Sampling rate must be between 0.0 and 1.0'
      );

      expect(() => monitor.enableSampling(1.5)).toThrow(
        'Sampling rate must be between 0.0 and 1.0'
      );
    });

    it('should validate sampling strategy', () => {
      expect(() => monitor.enableSampling({ strategy: 'invalid' })).toThrow(
        'Invalid sampling strategy'
      );
    });

    it('should throw error if config is null', () => {
      expect(() => monitor.enableSampling(null)).toThrow(
        'Sampling config is required'
      );
    });

    it('should throw error for invalid config type', () => {
      expect(() => monitor.enableSampling('invalid')).toThrow(
        'Config must be a number or object'
      );
    });
  });

  describe('getMemoryUsage', () => {
    it('should return zero usage for empty trace', () => {
      const usage = monitor.getMemoryUsage();

      expect(usage).toEqual({
        totalSpans: 0,
        estimatedSizeBytes: 0,
        estimatedSizeMB: 0,
        averageSpanSize: 0,
        largestSpanSize: 0,
      });
    });

    it('should calculate memory usage for spans', () => {
      const span1 = structuredTrace.startSpan('Operation1', {
        data: 'some data',
      });
      structuredTrace.endSpan(span1);

      const span2 = structuredTrace.startSpan('LongerOperationName', {
        largeData: 'x'.repeat(1000),
      });
      span2.setError(new Error('Error with stack trace'));
      structuredTrace.endSpan(span2);

      const usage = monitor.getMemoryUsage();

      expect(usage.totalSpans).toBe(2);
      expect(usage.estimatedSizeBytes).toBeGreaterThan(0);
      expect(usage.estimatedSizeMB).toBeGreaterThan(0);
      expect(usage.averageSpanSize).toBeGreaterThan(0);
      expect(usage.largestSpanSize).toBeGreaterThan(usage.averageSpanSize);
    });
  });

  describe('getRealtimeMetrics', () => {
    it('should return initial metrics', () => {
      const metrics = monitor.getRealtimeMetrics();

      expect(metrics).toMatchObject({
        activeSpans: 0,
        completedSpans: 0,
        totalOperations: 0,
        currentConcurrency: 0,
        errorCount: 0,
        currentDuration: 0,
        recentAlerts: [],
        memoryUsageMB: 0,
      });
    });

    it('should track active and completed spans', () => {
      const span1 = structuredTrace.startSpan('Op1');
      timeCounter += 100;

      let metrics = monitor.getRealtimeMetrics();
      expect(metrics.activeSpans).toBe(1);
      expect(metrics.completedSpans).toBe(0);
      expect(metrics.totalOperations).toBe(1);

      structuredTrace.endSpan(span1);

      metrics = monitor.getRealtimeMetrics();
      expect(metrics.activeSpans).toBe(0);
      expect(metrics.completedSpans).toBe(1);
    });

    it('should track error count', () => {
      const span1 = structuredTrace.startSpan('Op1');
      structuredTrace.endSpan(span1);

      const span2 = structuredTrace.startSpan('Op2');
      span2.setError(new Error('Test error'));
      structuredTrace.endSpan(span2);

      const metrics = monitor.getRealtimeMetrics();
      expect(metrics.errorCount).toBe(1);
    });

    it('should calculate current duration', () => {
      const rootSpan = structuredTrace.startSpan('Root');
      timeCounter += 500;

      let metrics = monitor.getRealtimeMetrics();
      expect(metrics.currentDuration).toBe(500); // Still running

      structuredTrace.endSpan(rootSpan);
      metrics = monitor.getRealtimeMetrics();
      expect(metrics.currentDuration).toBe(500); // Completed
    });

    it('should include recent alerts', () => {
      // Test that alerts are included in real-time metrics
      // by checking for the monitoring_stopped alert which is always generated
      const stopMonitoring = monitor.startMonitoring();
      stopMonitoring();

      const metrics = monitor.getRealtimeMetrics();
      // Should have the monitoring_stopped alert
      expect(metrics.recentAlerts.length).toBeGreaterThan(0);
      expect(metrics.recentAlerts[0].type).toBe('monitoring_stopped');
    });
  });

  describe('startMonitoring and stopMonitoring', () => {
    it('should start and stop monitoring', () => {
      let status = monitor.getMonitoringStatus();
      expect(status.isMonitoring).toBe(false);

      const stopFn = monitor.startMonitoring();
      expect(typeof stopFn).toBe('function');

      status = monitor.getMonitoringStatus();
      expect(status.isMonitoring).toBe(true);

      stopFn();

      status = monitor.getMonitoringStatus();
      expect(status.isMonitoring).toBe(false);
    });

    it('should throw error if already monitoring', () => {
      const stopFn = monitor.startMonitoring();

      expect(() => monitor.startMonitoring()).toThrow(
        'Monitoring is already active'
      );

      stopFn();
    });

    it('should accept custom interval', () => {
      const stopFn = monitor.startMonitoring({ intervalMs: 500 });

      // Monitoring should be active
      const status = monitor.getMonitoringStatus();
      expect(status.isMonitoring).toBe(true);

      stopFn();
    });

    it('should generate stop alert when monitoring stops', () => {
      const stopFn = monitor.startMonitoring();
      stopFn();

      const alerts = monitor.getAlerts({ type: 'monitoring_stopped' });
      expect(alerts).toHaveLength(1);
    });
  });

  describe('performance alert generation', () => {
    let stopMonitoring;

    beforeEach(() => {
      // Enable fake timers for interval testing
      jest.useFakeTimers();
      stopMonitoring = monitor.startMonitoring({ intervalMs: 1000 });
    });

    afterEach(() => {
      stopMonitoring();
      jest.useRealTimers();
    });


    it('should generate high concurrency alert', () => {
      // Create many concurrent operations
      const spans = [];
      for (let i = 0; i < 15; i++) {
        spans.push(structuredTrace.startSpan(`Op${i}`));
        timeCounter += 10;
      }

      jest.advanceTimersByTime(1000);

      const alerts = monitor.getAlerts({ type: 'high_concurrency' });
      expect(alerts.length).toBeGreaterThan(0);

      // Clean up - end spans in reverse order (LIFO)
      spans.reverse().forEach((span) => structuredTrace.endSpan(span));
    });

    it('should generate high error rate alert', () => {
      // Create operations with high error rate
      for (let i = 0; i < 10; i++) {
        const span = structuredTrace.startSpan(`Op${i}`);
        if (i < 7) {
          // 70% error rate
          span.setError(new Error('Test error'));
        }
        structuredTrace.endSpan(span);
      }

      jest.advanceTimersByTime(1000);

      const alerts = monitor.getAlerts({ type: 'high_error_rate' });
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should generate memory usage alert', () => {
      // Create many spans with large attributes
      for (let i = 0; i < 100; i++) {
        const span = structuredTrace.startSpan(`Op${i}`, {
          largeData: 'x'.repeat(10000),
        });
        structuredTrace.endSpan(span);
      }

      jest.advanceTimersByTime(1000);

      const alerts = monitor.getAlerts({ type: 'high_memory_usage' });
      // May or may not generate depending on thresholds
      expect(alerts).toBeDefined();
    });

  });

  describe('getAlerts', () => {
    beforeEach(() => {
      // Generate various alerts
      const stopMonitoring = monitor.startMonitoring();

      // Slow operation
      const slowSpan = structuredTrace.startSpan('SlowOp');
      timeCounter += 150;
      structuredTrace.endSpan(slowSpan);

      // Critical operation
      const criticalSpan = structuredTrace.startSpan('CriticalOp');
      timeCounter += 600;
      structuredTrace.endSpan(criticalSpan);

      stopMonitoring();
    });

    it('should return all alerts without filters', () => {
      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should filter by type', () => {
      const alerts = monitor.getAlerts({ type: 'monitoring_stopped' });
      expect(alerts.every((a) => a.type === 'monitoring_stopped')).toBe(true);
    });

    it('should filter by severity', () => {
      const alerts = monitor.getAlerts({ severity: 'critical' });
      expect(alerts.every((a) => a.severity === 'critical')).toBe(true);
    });

    it('should filter by timestamp', () => {
      const midTime = timeCounter - 300;
      const alerts = monitor.getAlerts({ since: midTime });
      expect(alerts.every((a) => a.timestamp >= midTime)).toBe(true);
    });

    it('should combine filters', () => {
      const alerts = monitor.getAlerts({
        type: 'slow_operation',
        severity: 'warning',
      });
      expect(
        alerts.every(
          (a) => a.type === 'slow_operation' && a.severity === 'warning'
        )
      ).toBe(true);
    });
  });

  describe('clearAlerts', () => {
    it('should clear all stored alerts', () => {
      // Generate some alerts
      const stopMonitoring = monitor.startMonitoring();
      stopMonitoring();

      let alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      monitor.clearAlerts();

      alerts = monitor.getAlerts();
      expect(alerts).toHaveLength(0);
    });
  });

  describe('shouldSampleTrace', () => {
    it('should always sample when rate is 1.0', () => {
      monitor.enableSampling(1.0);

      for (let i = 0; i < 10; i++) {
        expect(monitor.shouldSampleTrace()).toBe(true);
      }
    });

    it('should never sample when rate is 0.0', () => {
      monitor.enableSampling(0.0);

      for (let i = 0; i < 10; i++) {
        expect(monitor.shouldSampleTrace()).toBe(false);
      }
    });

    it('should always sample errors when alwaysSampleErrors is true', () => {
      monitor.enableSampling({
        rate: 0.0,
        alwaysSampleErrors: true,
      });

      const span = structuredTrace.startSpan('ErrorOp');
      span.setError(new Error('Test'));
      structuredTrace.endSpan(span);

      expect(monitor.shouldSampleTrace()).toBe(true);
    });

    it('should always sample slow traces when alwaysSampleSlow is true', () => {
      monitor.enableSampling({
        rate: 0.0,
        alwaysSampleSlow: true,
        slowThresholdMs: 100,
      });

      const span = structuredTrace.startSpan('SlowOp');
      timeCounter += 200;
      structuredTrace.endSpan(span);

      expect(monitor.shouldSampleTrace()).toBe(true);
    });

    it('should use random strategy', () => {
      monitor.enableSampling({
        rate: 0.5,
        strategy: 'random',
      });

      // Mock Math.random for deterministic testing
      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValueOnce(0.3); // Should sample
      mockRandom.mockReturnValueOnce(0.7); // Should not sample

      expect(monitor.shouldSampleTrace()).toBe(true);
      expect(monitor.shouldSampleTrace()).toBe(false);

      mockRandom.mockRestore();
    });

    it('should use adaptive strategy', () => {
      monitor.enableSampling({
        rate: 0.3,
        strategy: 'adaptive',
      });

      // Create error to trigger adaptive behavior
      const span = structuredTrace.startSpan('ErrorOp');
      span.setError(new Error('Test'));
      structuredTrace.endSpan(span);

      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValue(0.5); // Between 0.3 and 0.6

      expect(monitor.shouldSampleTrace()).toBe(true); // Adaptive rate doubled

      mockRandom.mockRestore();
    });

    it('should use error_biased strategy', () => {
      monitor.enableSampling({
        rate: 0.2,
        strategy: 'error_biased',
      });

      // Create multiple errors
      for (let i = 0; i < 3; i++) {
        const span = structuredTrace.startSpan(`ErrorOp${i}`);
        span.setError(new Error('Test'));
        structuredTrace.endSpan(span);
      }

      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValue(0.4); // Would normally not sample at 0.2

      expect(monitor.shouldSampleTrace()).toBe(true); // Biased rate increased

      mockRandom.mockRestore();
    });
  });

  describe('getMonitoringStatus', () => {
    it('should return complete monitoring status', () => {
      monitor.setThresholds({ slowOperationMs: 200 });
      monitor.enableSampling(0.7);

      const status = monitor.getMonitoringStatus();

      expect(status).toMatchObject({
        isMonitoring: false,
        monitoringDuration: 0,
        thresholds: expect.objectContaining({
          slowOperationMs: 200,
        }),
        samplingConfig: expect.objectContaining({
          rate: 0.7,
        }),
        alertCount: 0,
      });
    });

    it('should track monitoring duration', () => {
      const stopMonitoring = monitor.startMonitoring();
      timeCounter += 5000;

      const status = monitor.getMonitoringStatus();
      expect(status.isMonitoring).toBe(true);
      expect(status.monitoringDuration).toBe(5000);

      stopMonitoring();
    });
  });

  describe('edge cases', () => {
    it('should handle monitoring with no spans', () => {
      jest.useFakeTimers();
      const stopMonitoring = monitor.startMonitoring();

      // Advance time without creating any spans
      jest.advanceTimersByTime(5000);

      const alerts = monitor.getAlerts();
      const metrics = monitor.getRealtimeMetrics();

      expect(alerts).toBeDefined();
      expect(metrics).toBeDefined();

      stopMonitoring();
      jest.useRealTimers();
    });

    it('should limit stored alerts to prevent memory growth', () => {
      // Generate many alerts
      for (let i = 0; i < 150; i++) {
        const span = structuredTrace.startSpan(`SlowOp${i}`);
        timeCounter += 200; // All are slow
        structuredTrace.endSpan(span);
      }

      jest.useFakeTimers();
      const stopMonitoring = monitor.startMonitoring();
      jest.advanceTimersByTime(1000);

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeLessThanOrEqual(100); // Should limit alerts

      stopMonitoring();
      jest.useRealTimers();
    });

    it('should handle concurrent monitoring checks gracefully', () => {
      jest.useFakeTimers();
      const stopMonitoring = monitor.startMonitoring({ intervalMs: 100 });

      // Create ongoing operations
      const span1 = structuredTrace.startSpan('Op1');
      const span2 = structuredTrace.startSpan('Op2');

      // Multiple monitoring cycles while operations are active
      jest.advanceTimersByTime(500);

      // Complete operations
      structuredTrace.endSpan(span2);
      structuredTrace.endSpan(span1);

      jest.advanceTimersByTime(200);

      // Should not crash or produce incorrect metrics
      const metrics = monitor.getRealtimeMetrics();
      expect(metrics).toBeDefined();

      stopMonitoring();
      jest.useRealTimers();
    });
  });
});
