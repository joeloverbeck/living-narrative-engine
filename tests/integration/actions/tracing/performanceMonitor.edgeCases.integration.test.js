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

describe('PerformanceMonitor edge case integration', () => {
  let now;
  let nowSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    now = 0;
    nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    if (nowSpy) {
      nowSpy.mockRestore();
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('uses default thresholds and skips alerts when metrics stay within safe limits', () => {
    const intervalCallbacks = [];
    const originalSetInterval = global.setInterval;
    const intervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockImplementation((callback, delay) => {
        intervalCallbacks.push(callback);
        return originalSetInterval(callback, delay);
      });

    const trace = new StructuredTrace();
    const monitor = new PerformanceMonitor(trace);

    const initialMetrics = monitor.getRealtimeMetrics();
    expect(initialMetrics.totalOperations).toBe(0);
    expect(initialMetrics.currentDuration).toBe(0);
    expect(monitor.getMonitoringStatus().monitoringDuration).toBe(0);

    const rootSpan = trace.startSpan('root-operation');
    trace.endSpan(rootSpan);

    const errorSpan = trace.startSpan('error-without-stack');
    const silentError = new Error('missing stack');
    silentError.stack = '';
    errorSpan.setError(silentError);
    now += 5;
    trace.endSpan(errorSpan);

    monitor.setThresholds({
      maxConcurrency: 50,
      maxTotalDurationMs: 10_000,
      maxErrorRate: 100,
      maxMemoryUsageMB: 1_000,
      recentWindowMs: 500,
    });

    const stopMonitoring = monitor.startMonitoring({ intervalMs: 20 });
    now += 20;
    jest.advanceTimersByTime(20);

    expect(monitor.getAlerts()).toHaveLength(0);

    const statusWhileRunning = monitor.getMonitoringStatus();
    expect(statusWhileRunning.isMonitoring).toBe(true);
    expect(statusWhileRunning.monitoringDuration).toBeGreaterThan(0);

    now += 10;
    stopMonitoring();

    const finalStatus = monitor.getMonitoringStatus();
    expect(finalStatus.isMonitoring).toBe(false);
    expect(finalStatus.monitoringDuration).toBe(0);

    const emptyTrace = new StructuredTrace();
    const emptyMonitor = new PerformanceMonitor(emptyTrace);
    const stopEmpty = emptyMonitor.startMonitoring({ intervalMs: 15 });

    now += 15;
    jest.advanceTimersByTime(15);
    intervalCallbacks[intervalCallbacks.length - 1]();

    expect(emptyMonitor.getAlerts()).toHaveLength(0);

    stopEmpty();
    intervalSpy.mockRestore();
  });

  it('covers sampling fallbacks, threshold severities, and slow operation tracking', () => {
    const trace = new StructuredTrace();
    const monitor = new PerformanceMonitor(trace);

    const root = trace.startSpan('root');
    now += 10;
    trace.endSpan(root);

    monitor.enableSampling({
      rate: 0.4,
      strategy: 'random',
      alwaysSampleErrors: false,
      alwaysSampleSlow: true,
      slowThresholdMs: 50,
    });

    const randomSpy = jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.6)
      .mockReturnValueOnce(0.2);

    expect(monitor.shouldSampleTrace()).toBe(false);
    expect(monitor.shouldSampleTrace()).toBe(true);

    randomSpy.mockReset();
    randomSpy.mockReturnValueOnce(0.1);
    monitor.enableSampling({
      rate: 0.2,
      strategy: 'adaptive',
      alwaysSampleErrors: false,
      alwaysSampleSlow: false,
    });
    expect(monitor.shouldSampleTrace()).toBe(true);

    randomSpy.mockReset();
    randomSpy.mockReturnValueOnce(0.7);
    monitor.enableSampling({
      rate: 0.3,
      strategy: undefined,
      alwaysSampleErrors: false,
      alwaysSampleSlow: false,
    });
    expect(monitor.shouldSampleTrace()).toBe(false);
    randomSpy.mockRestore();

    expect(monitor.checkThreshold('moderate-threshold', 16, 10)).toBe(true);
    expect(monitor.checkThreshold('no-alert', 5, 10)).toBe(false);
    expect(monitor.checkThreshold('slightly-over', 11, 10)).toBe(true);

    monitor.setThresholds({ slowOperationMs: 20, criticalOperationMs: 100 });
    now += 200;
    const slowTimestamp = performance.now() - 30;
    monitor.trackOperation('slow-range', slowTimestamp);
    monitor.trackOperation('fast-range', performance.now() - 5);

    const thresholdAlerts = monitor.getAlerts({ type: 'threshold_exceeded' });
    expect(thresholdAlerts.some((alert) => alert.severity === 'warning')).toBe(
      true
    );

    const slowAlerts = monitor.getAlerts({ type: 'slow_operation' });
    expect(slowAlerts.some((alert) => alert.operation === 'slow-range')).toBe(
      true
    );
  });
});
