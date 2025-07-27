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
        'Missing required dependency: IStructuredTrace.'
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

    it('should validate individual threshold fields', () => {
      // Test each numeric field validation
      const fields = [
        'slowOperationMs',
        'criticalOperationMs',
        'maxConcurrency',
        'maxTotalDurationMs',
        'maxErrorRate',
        'maxMemoryUsageMB',
      ];

      fields.forEach((field) => {
        expect(() => monitor.setThresholds({ [field]: -1 })).toThrow(
          `${field} must be a non-negative number`
        );
        expect(() => monitor.setThresholds({ [field]: 'invalid' })).toThrow(
          `${field} must be a non-negative number`
        );
      });
    });

    it('should handle undefined threshold values', () => {
      // First get the original defaults
      const originalStatus = monitor.getMonitoringStatus();
      const originalSlowMs = originalStatus.thresholds.slowOperationMs;

      const partialThresholds = {
        slowOperationMs: undefined,
        maxErrorRate: 15,
      };

      monitor.setThresholds(partialThresholds);

      const status = monitor.getMonitoringStatus();
      // undefined values are treated as valid updates (setting to undefined)
      expect(status.thresholds.slowOperationMs).toBe(undefined);
      expect(status.thresholds.maxErrorRate).toBe(15); // updated
      // Other thresholds should remain at defaults
      expect(status.thresholds.criticalOperationMs).toBe(500);
    });

    it('should preserve unspecified thresholds', () => {
      // Set initial thresholds
      monitor.setThresholds({
        slowOperationMs: 150,
        maxErrorRate: 10,
        maxConcurrency: 20,
      });

      // Update only some thresholds
      monitor.setThresholds({
        slowOperationMs: 200,
      });

      const status = monitor.getMonitoringStatus();
      expect(status.thresholds.slowOperationMs).toBe(200); // updated
      expect(status.thresholds.maxErrorRate).toBe(10); // preserved
      expect(status.thresholds.maxConcurrency).toBe(20); // preserved
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

    it('should validate sampling rate in config object', () => {
      expect(() => monitor.enableSampling({ rate: -0.5 })).toThrow(
        'Sampling rate must be between 0.0 and 1.0'
      );

      expect(() => monitor.enableSampling({ rate: 1.5 })).toThrow(
        'Sampling rate must be between 0.0 and 1.0'
      );

      expect(() => monitor.enableSampling({ rate: 'invalid' })).toThrow(
        'Sampling rate must be between 0.0 and 1.0'
      );
    });

    it('should handle boolean config type', () => {
      expect(() => monitor.enableSampling(true)).toThrow(
        'Config must be a number or object'
      );

      expect(() => monitor.enableSampling(false)).toThrow(
        'Config must be a number or object'
      );
    });

    it('should preserve existing sampling config when partially updating', () => {
      // Set initial config
      monitor.enableSampling({
        rate: 0.5,
        strategy: 'adaptive',
        alwaysSampleErrors: false,
        alwaysSampleSlow: false,
        slowThresholdMs: 500,
      });

      // Update only strategy
      monitor.enableSampling({ strategy: 'error_biased' });

      const status = monitor.getMonitoringStatus();
      expect(status.samplingConfig.rate).toBe(0.5); // preserved
      expect(status.samplingConfig.strategy).toBe('error_biased'); // updated
      expect(status.samplingConfig.alwaysSampleErrors).toBe(false); // preserved
      expect(status.samplingConfig.alwaysSampleSlow).toBe(false); // preserved
      expect(status.samplingConfig.slowThresholdMs).toBe(500); // preserved
    });

    it('should accept all valid sampling strategies', () => {
      const strategies = ['random', 'adaptive', 'error_biased'];

      strategies.forEach((strategy) => {
        monitor.enableSampling({ strategy });
        const status = monitor.getMonitoringStatus();
        expect(status.samplingConfig.strategy).toBe(strategy);
      });
    });

    it('should handle array as invalid config type', () => {
      expect(() => monitor.enableSampling([])).toThrow(
        'Config must be a number or object'
      );
    });

    it('should validate undefined rate in config object', () => {
      // Should not throw when rate is undefined (preserves existing)
      expect(() =>
        monitor.enableSampling({ rate: undefined, strategy: 'adaptive' })
      ).not.toThrow();
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

    it('should handle spans without errors correctly', () => {
      const span = structuredTrace.startSpan('SimpleOp', {
        simpleData: 'test',
      });
      structuredTrace.endSpan(span);

      const usage = monitor.getMemoryUsage();
      expect(usage.totalSpans).toBe(1);
      expect(usage.estimatedSizeBytes).toBeGreaterThan(200); // Base overhead
    });

    it('should handle error without stack trace', () => {
      const span = structuredTrace.startSpan('ErrorOp');
      const error = new Error('Simple error');
      delete error.stack; // Remove stack trace
      span.setError(error);
      structuredTrace.endSpan(span);

      const usage = monitor.getMemoryUsage();
      expect(usage.totalSpans).toBe(1);
      expect(usage.estimatedSizeBytes).toBeGreaterThan(0);
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

    it('should calculate duration for completed root span', () => {
      const rootSpan = structuredTrace.startSpan('Root');
      timeCounter += 750;
      structuredTrace.endSpan(rootSpan);

      const metrics = monitor.getRealtimeMetrics();
      expect(metrics.currentDuration).toBe(750);
    });

    it('should handle no root span', () => {
      // Create a new StructuredTrace for this test to ensure clean state
      const isolatedTrace = new StructuredTrace();
      const isolatedMonitor = new PerformanceMonitor(isolatedTrace);

      // The trace has no spans at all, so no root span
      const metrics = isolatedMonitor.getRealtimeMetrics();
      expect(metrics.currentDuration).toBe(0);
    });

    it('should limit recent alerts to 5', () => {
      // Generate more than 5 alerts
      for (let i = 0; i < 10; i++) {
        const span = structuredTrace.startSpan(`SlowOp${i}`);
        timeCounter += 200;
        structuredTrace.endSpan(span);
      }

      jest.useFakeTimers();
      const stopMonitoring = monitor.startMonitoring();
      jest.advanceTimersByTime(1000);
      stopMonitoring();
      jest.useRealTimers();

      const metrics = monitor.getRealtimeMetrics();
      expect(metrics.recentAlerts.length).toBeLessThanOrEqual(5);
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
    });

    afterEach(() => {
      if (stopMonitoring) {
        stopMonitoring();
      }
      jest.useRealTimers();
    });

    it('should generate high concurrency alert', () => {
      // Create many concurrent operations
      const spans = [];
      for (let i = 0; i < 15; i++) {
        spans.push(structuredTrace.startSpan(`Op${i}`));
        timeCounter += 10;
      }

      // Start monitoring after creating concurrent spans
      stopMonitoring = monitor.startMonitoring({ intervalMs: 1000 });

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

      // Start monitoring after creating error spans
      stopMonitoring = monitor.startMonitoring({ intervalMs: 1000 });

      jest.advanceTimersByTime(1000);

      const alerts = monitor.getAlerts({ type: 'high_error_rate' });
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe('critical');
    });

    it('should generate memory usage alert', () => {
      // Set a low memory threshold to ensure alert generation
      monitor.setThresholds({ maxMemoryUsageMB: 0.1 }); // Very low threshold

      // Create spans with large attributes to exceed memory threshold
      for (let i = 0; i < 10; i++) {
        const span = structuredTrace.startSpan(`Op${i}`, {
          largeData: 'x'.repeat(10000),
        });
        structuredTrace.endSpan(span);
      }

      // Start monitoring after creating large spans
      stopMonitoring = monitor.startMonitoring({ intervalMs: 1000 });

      jest.advanceTimersByTime(1000);

      const alerts = monitor.getAlerts({ type: 'high_memory_usage' });
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe('warning');
      expect(alerts[0].value).toBeGreaterThan(0.1);
    });

    it('should only check recent spans for slow operations', () => {
      // Create old operation (more than 5 seconds ago)
      const oldSpan = structuredTrace.startSpan('OldOp');
      timeCounter += 200;
      structuredTrace.endSpan(oldSpan);

      // Advance time beyond 5 second window
      timeCounter += 6000;

      // Clear existing alerts
      monitor.clearAlerts();

      // Start monitoring AFTER creating the old span
      stopMonitoring = monitor.startMonitoring({ intervalMs: 1000 });

      // Trigger monitoring check
      jest.advanceTimersByTime(1000);

      // Should not generate alert for old operation
      const alerts = monitor.getAlerts({ type: 'slow_operation' });
      expect(alerts).toHaveLength(0);
    });

    it('should handle monitoring check when not monitoring', () => {
      // Reset monitor and manually trigger performMonitoringCheck
      // This tests the early return when not monitoring
      const newMonitor = new PerformanceMonitor(structuredTrace);

      // Create some operations that would normally trigger alerts
      const span = structuredTrace.startSpan('SlowOp');
      timeCounter += 600;
      structuredTrace.endSpan(span);

      // Start and immediately stop monitoring to test the check
      const stop = newMonitor.startMonitoring({ intervalMs: 100 });
      stop();

      // Force a monitoring check after stopping
      jest.advanceTimersByTime(100);

      // Should only have the monitoring_stopped alert, no performance alerts
      const alerts = newMonitor.getAlerts();
      const perfAlerts = alerts.filter((a) => a.type !== 'monitoring_stopped');
      expect(perfAlerts).toHaveLength(0);
    });

    it('should calculate concurrent spans correctly', () => {
      // Create overlapping spans
      const span1 = structuredTrace.startSpan('Op1');
      timeCounter += 100;
      const span2 = structuredTrace.startSpan('Op2');
      timeCounter += 100;
      const span3 = structuredTrace.startSpan('Op3');

      // At this point, all 3 are concurrent
      const metrics = monitor.getRealtimeMetrics();
      expect(metrics.currentConcurrency).toBe(3);

      // End one span
      structuredTrace.endSpan(span3);
      timeCounter += 100;

      // Now only 2 are concurrent
      const metrics2 = monitor.getRealtimeMetrics();
      expect(metrics2.currentConcurrency).toBe(2);

      // Clean up
      structuredTrace.endSpan(span2);
      structuredTrace.endSpan(span1);
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

    it('should handle default strategy case', () => {
      // Use reflection to modify the private samplingConfig to test default case
      const newMonitor = new PerformanceMonitor(structuredTrace);

      // Enable sampling with a valid config first
      newMonitor.enableSampling({
        rate: 0.5,
        strategy: 'random',
      });

      // Access the private field through reflection (for testing purposes)
      // This will trigger the default case in the switch statement
      const privateFields = Object.getOwnPropertySymbols(newMonitor).filter(
        (sym) => sym.toString().includes('samplingConfig')
      );
      if (privateFields.length > 0) {
        newMonitor[privateFields[0]].strategy = 'unknown';
      }

      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValueOnce(0.3); // Should sample
      mockRandom.mockReturnValueOnce(0.7); // Should not sample

      expect(newMonitor.shouldSampleTrace()).toBe(true);
      expect(newMonitor.shouldSampleTrace()).toBe(false);

      mockRandom.mockRestore();
    });

    it('should not always sample slow traces when alwaysSampleSlow is false', () => {
      monitor.enableSampling({
        rate: 0.0,
        alwaysSampleSlow: false,
        slowThresholdMs: 100,
      });

      const span = structuredTrace.startSpan('SlowOp');
      timeCounter += 200;
      structuredTrace.endSpan(span);

      expect(monitor.shouldSampleTrace()).toBe(false);
    });

    it('should handle root span without duration in slow sampling', () => {
      monitor.enableSampling({
        rate: 0.0,
        alwaysSampleSlow: true,
        slowThresholdMs: 100,
      });

      // Create root span but don't end it (no duration)
      structuredTrace.startSpan('RootOp');

      // Should not sample because root span has no duration
      expect(monitor.shouldSampleTrace()).toBe(false);
    });

    it('should sample with adaptive strategy when no errors or slow ops', () => {
      monitor.enableSampling({
        rate: 0.5,
        strategy: 'adaptive',
      });

      // Create fast, successful operation
      const span = structuredTrace.startSpan('FastOp');
      timeCounter += 50;
      structuredTrace.endSpan(span);

      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValue(0.4); // Below 0.5

      expect(monitor.shouldSampleTrace()).toBe(true);

      mockRandom.mockRestore();
    });

    it('should cap error_biased rate at 1.0', () => {
      monitor.enableSampling({
        rate: 0.8,
        strategy: 'error_biased',
      });

      // Create many errors to push rate above 1.0
      for (let i = 0; i < 5; i++) {
        const span = structuredTrace.startSpan(`ErrorOp${i}`);
        span.setError(new Error('Test'));
        structuredTrace.endSpan(span);
      }

      // Even with very high random value, should sample due to capped rate
      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValue(0.99);

      expect(monitor.shouldSampleTrace()).toBe(true);

      mockRandom.mockRestore();
    });

    it('should use error_biased strategy with no errors', () => {
      monitor.enableSampling({
        rate: 0.5,
        strategy: 'error_biased',
      });

      // Create successful operations (no errors)
      const span1 = structuredTrace.startSpan('SuccessOp1');
      structuredTrace.endSpan(span1);
      const span2 = structuredTrace.startSpan('SuccessOp2');
      structuredTrace.endSpan(span2);

      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValueOnce(0.4); // Should sample (below 0.5)
      mockRandom.mockReturnValueOnce(0.6); // Should not sample (above 0.5)

      expect(monitor.shouldSampleTrace()).toBe(true);
      expect(monitor.shouldSampleTrace()).toBe(false);

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

    it('should handle getRecentAlerts with more alerts than requested', () => {
      // Generate exactly 10 alerts
      for (let i = 0; i < 10; i++) {
        const span = structuredTrace.startSpan(`SlowOp${i}`);
        timeCounter += 200;
        structuredTrace.endSpan(span);
      }

      jest.useFakeTimers();
      const stopMonitoring = monitor.startMonitoring();
      jest.advanceTimersByTime(1000);
      stopMonitoring();
      jest.useRealTimers();

      const metrics = monitor.getRealtimeMetrics();
      // Should return only 5 recent alerts
      expect(metrics.recentAlerts.length).toBe(5);
    });

    it('should handle monitoring status when duration is 0', () => {
      const status = monitor.getMonitoringStatus();
      expect(status.monitoringDuration).toBe(0);
      expect(status.isMonitoring).toBe(false);
    });

    it('should calculate memory usage with very long operation names', () => {
      const longName = 'VeryLongOperationName'.repeat(50);
      const span = structuredTrace.startSpan(longName, {
        data: 'test',
      });
      structuredTrace.endSpan(span);

      const usage = monitor.getMemoryUsage();
      expect(usage.estimatedSizeBytes).toBeGreaterThan(longName.length * 2);
    });

    it('should handle error rate calculation with zero operations', () => {
      jest.useFakeTimers();
      const stopMonitoring = monitor.startMonitoring();

      // Trigger monitoring check with no operations
      jest.advanceTimersByTime(1000);

      const alerts = monitor.getAlerts({ type: 'high_error_rate' });
      expect(alerts).toHaveLength(0);

      stopMonitoring();
      jest.useRealTimers();
    });

    it('should handle getAlerts with empty results', () => {
      const alerts = monitor.getAlerts({ type: 'non_existent_type' });
      expect(alerts).toEqual([]);
    });

    it('should properly sort alerts by timestamp', () => {
      // Generate alerts at different times
      const span1 = structuredTrace.startSpan('SlowOp1');
      timeCounter += 200;
      structuredTrace.endSpan(span1);

      timeCounter += 1000;

      const span2 = structuredTrace.startSpan('SlowOp2');
      timeCounter += 200;
      structuredTrace.endSpan(span2);

      jest.useFakeTimers();
      const stopMonitoring = monitor.startMonitoring();
      jest.advanceTimersByTime(1000);
      stopMonitoring();
      jest.useRealTimers();

      const alerts = monitor.getAlerts();
      // Most recent should be first
      for (let i = 1; i < alerts.length; i++) {
        expect(alerts[i - 1].timestamp).toBeGreaterThanOrEqual(
          alerts[i].timestamp
        );
      }
    });
  });
});
