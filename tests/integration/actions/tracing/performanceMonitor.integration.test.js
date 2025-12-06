/**
 * @file Integration tests for PerformanceMonitor coordinating with StructuredTrace
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import StructuredTrace from '../../../../src/actions/tracing/structuredTrace.js';
import PerformanceMonitor from '../../../../src/actions/tracing/performanceMonitor.js';

const createMonitor = (trace, overrides = {}) =>
  new PerformanceMonitor(trace, {
    slowOperationMs: 50,
    criticalOperationMs: 150,
    maxConcurrency: 1,
    maxTotalDurationMs: 200,
    maxErrorRate: 5,
    maxMemoryUsageMB: 0.00001,
    recentWindowMs: 1000,
    ...overrides,
  });

describe('PerformanceMonitor integration', () => {
  let structuredTrace;
  let monitor;
  let now;
  let performanceSpy;

  const advanceTime = (ms) => {
    now += ms;
  };

  const createError = (message) => {
    const error = new Error(message);
    error.stack = `${message}\n stack`; // deterministic stack size for memory estimation
    return error;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    now = 0;
    performanceSpy = jest
      .spyOn(performance, 'now')
      .mockImplementation(() => now);
    structuredTrace = new StructuredTrace();
    monitor = createMonitor(structuredTrace);
  });

  afterEach(() => {
    jest.useRealTimers();
    if (performanceSpy) {
      performanceSpy.mockRestore();
    }
    jest.restoreAllMocks();
  });

  it('monitors real spans and emits alerts for threshold breaches', () => {
    const emptyUsage = monitor.getMemoryUsage();
    expect(emptyUsage.totalSpans).toBe(0);
    expect(emptyUsage.estimatedSizeMB).toBe(0);

    const root = structuredTrace.startSpan('RootOperation');
    root.setAttribute('requestId', 'req-123');
    advanceTime(10);

    const slowSpan = structuredTrace.startSpan('SlowOperation');
    slowSpan.setAttribute('payload', 'y'.repeat(400));
    advanceTime(200);
    slowSpan.setError(createError('slow failure'));
    structuredTrace.endSpan(slowSpan);

    const moderateSpan = structuredTrace.startSpan('ModerateOperation');
    advanceTime(80);
    structuredTrace.endSpan(moderateSpan);

    const fastSpan = structuredTrace.startSpan('FastOperation');
    advanceTime(10);
    structuredTrace.endSpan(fastSpan);

    const ongoingSpan = structuredTrace.startSpan('OngoingOperation');
    ongoingSpan.setAttribute('payload', 'z'.repeat(2000));

    monitor.enableSampling({
      rate: 0.5,
      strategy: 'random',
      alwaysSampleErrors: true,
      alwaysSampleSlow: true,
      slowThresholdMs: 100,
    });

    const stopMonitoring = monitor.startMonitoring({ intervalMs: 50 });

    advanceTime(600);
    jest.advanceTimersByTime(50);

    const alerts = monitor.getAlerts();
    expect(alerts.map((alert) => alert.type)).toEqual(
      expect.arrayContaining([
        'critical_operation',
        'slow_operation',
        'high_concurrency',
        'long_trace',
        'high_error_rate',
        'high_memory_usage',
      ])
    );

    const metrics = monitor.getRealtimeMetrics();
    expect(metrics.totalOperations).toBe(structuredTrace.getSpans().length);
    expect(metrics.activeSpans).toBe(1);
    expect(metrics.currentConcurrency).toBeGreaterThan(1);
    expect(metrics.recentAlerts.length).toBeGreaterThan(0);
    expect(metrics.memoryUsageMB).toBeGreaterThan(0);

    const memoryUsage = monitor.getMemoryUsage();
    expect(memoryUsage.totalSpans).toBe(structuredTrace.getSpans().length);
    expect(memoryUsage.estimatedSizeMB).toBeGreaterThan(0);

    const status = monitor.getMonitoringStatus();
    expect(status.isMonitoring).toBe(true);
    expect(status.alertCount).toBe(alerts.length);

    expect(monitor.shouldSampleTrace()).toBe(true);

    advanceTime(40);
    structuredTrace.endSpan(ongoingSpan);
    advanceTime(30);
    structuredTrace.endSpan(root);

    advanceTime(20);
    jest.advanceTimersByTime(50);

    stopMonitoring();

    const finalAlerts = monitor.getAlerts();
    expect(
      finalAlerts.some((alert) => alert.type === 'monitoring_stopped')
    ).toBe(true);

    monitor.clearAlerts();
    expect(monitor.getAlerts()).toHaveLength(0);

    monitor.clearRecordedMetrics();
    expect(monitor.getRecordedMetrics()).toEqual({});
  });

  it('validates thresholds, sampling, manual checks, and metric tracking across modules', () => {
    const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);

    expect(() => monitor.setThresholds()).toThrow('Thresholds are required');
    expect(() => monitor.setThresholds('bad')).toThrow(
      'Thresholds must be an object'
    );
    expect(() => monitor.setThresholds({ slowOperationMs: -1 })).toThrow(
      'slowOperationMs must be a non-negative number'
    );
    monitor.setThresholds({ slowOperationMs: 120 });

    expect(() => monitor.enableSampling()).toThrow(
      'Sampling config is required'
    );
    monitor.enableSampling(0.3);
    expect(() => monitor.enableSampling(-0.1)).toThrow(
      'Sampling rate must be between 0.0 and 1.0'
    );
    expect(() => monitor.enableSampling({ strategy: 'invalid' })).toThrow(
      'Invalid sampling strategy. Must be one of: random, adaptive, error_biased'
    );
    expect(() => monitor.enableSampling('bad')).toThrow(
      'Config must be a number or object'
    );
    monitor.enableSampling({
      rate: 0.2,
      strategy: 'random',
      alwaysSampleErrors: true,
      alwaysSampleSlow: true,
    });

    const stop = monitor.startMonitoring({ intervalMs: 100 });
    expect(() => monitor.startMonitoring()).toThrow(
      'Monitoring is already active'
    );

    monitor.setThresholds({ maxConcurrency: 5 });
    expect(
      monitor.getAlerts().some((alert) => alert.type === 'threshold_changed')
    ).toBe(true);
    monitor.clearAlerts();

    const root = structuredTrace.startSpan('TrackedOperation');
    const child = structuredTrace.startSpan('TrackedChild');
    advanceTime(60);
    structuredTrace.endSpan(child);
    advanceTime(150);
    structuredTrace.endSpan(root);

    expect(() => monitor.recordMetric('', 1)).toThrow(
      'Metric name must be a non-empty string'
    );
    expect(() => monitor.recordMetric('metric', 'bad')).toThrow(
      'Metric value must be a valid number'
    );
    monitor.recordMetric('custom.metric', 5);
    advanceTime(5);
    monitor.recordMetric('custom.metric', 7);

    const recorded = monitor.getRecordedMetrics();
    expect(recorded['custom.metric'].count).toBe(2);
    expect(recorded['custom.metric'].previousValue).toBe(5);

    expect(monitor.checkThreshold('fastOp', 5, 10)).toBe(false);
    expect(() => monitor.checkThreshold('warnOp', 'bad', 10)).toThrow(
      'Value must be a valid number'
    );
    expect(() => monitor.checkThreshold('warnOp', 10, 'bad')).toThrow(
      'Threshold must be a valid number'
    );
    const warningExceeded = monitor.checkThreshold('warnOp', 16, 10);
    expect(warningExceeded).toBe(true);
    const criticalExceeded = monitor.checkThreshold('critOp', 25, 10);
    expect(criticalExceeded).toBe(true);

    const alertsAfterThresholds = monitor.getAlerts();
    expect(
      alertsAfterThresholds.some((alert) => alert.type === 'metric_recorded')
    ).toBe(true);
    expect(
      alertsAfterThresholds.filter(
        (alert) => alert.type === 'threshold_exceeded'
      ).length
    ).toBe(2);
    monitor.clearAlerts();

    monitor.setThresholds({ slowOperationMs: 60 });
    monitor.clearAlerts();

    advanceTime(10);
    monitor.trackOperation('slowOperation', performance.now() - 200);
    advanceTime(10);
    monitor.trackOperation('moderateOperation', performance.now() - 80);

    const operationAlerts = monitor
      .getAlerts()
      .filter(
        (alert) =>
          alert.type === 'critical_operation' || alert.type === 'slow_operation'
      );
    expect(
      operationAlerts.some((alert) => alert.operation === 'slowOperation')
    ).toBe(true);
    expect(
      operationAlerts.some((alert) => alert.operation === 'moderateOperation')
    ).toBe(true);

    const metricsAfterTrack = monitor.getRecordedMetrics();
    expect(Object.keys(metricsAfterTrack)).toEqual(
      expect.arrayContaining([
        'custom.metric',
        'operation.slowOperation.duration',
        'operation.moderateOperation.duration',
      ])
    );

    monitor.clearAlerts();

    mathRandomSpy.mockReturnValue(0.5);
    monitor.enableSampling({
      rate: 0.2,
      strategy: 'random',
      alwaysSampleErrors: false,
      alwaysSampleSlow: false,
    });
    expect(monitor.shouldSampleTrace()).toBe(false);

    const slowRoot = structuredTrace.startSpan('RootForSampling');
    advanceTime(200);
    structuredTrace.endSpan(slowRoot);
    monitor.enableSampling({
      rate: 0.2,
      strategy: 'random',
      alwaysSampleSlow: true,
      slowThresholdMs: 100,
    });
    mathRandomSpy.mockReturnValue(0.9);
    expect(monitor.shouldSampleTrace()).toBe(true);

    monitor.enableSampling({
      rate: 0.2,
      strategy: 'adaptive',
      alwaysSampleErrors: false,
      alwaysSampleSlow: false,
    });
    const errorSpan = structuredTrace.startSpan('ErrorSpan');
    advanceTime(10);
    errorSpan.setError(createError('oops'));
    structuredTrace.endSpan(errorSpan);
    mathRandomSpy.mockReturnValue(0.3);
    expect(monitor.shouldSampleTrace()).toBe(true);

    monitor.enableSampling({
      rate: 0.1,
      strategy: 'error_biased',
      alwaysSampleErrors: false,
      alwaysSampleSlow: false,
    });
    mathRandomSpy.mockReturnValue(0.19);
    expect(monitor.shouldSampleTrace()).toBe(true);

    monitor.enableSampling(1);
    mathRandomSpy.mockReturnValue(0.8);
    expect(monitor.shouldSampleTrace()).toBe(true);

    stop();
    jest.runOnlyPendingTimers();
  });
});
