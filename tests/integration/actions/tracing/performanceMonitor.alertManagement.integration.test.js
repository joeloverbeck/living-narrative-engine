/**
 * @file Integration tests focusing on PerformanceMonitor alert lifecycle and sampling fallbacks.
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

const createMonitor = (trace = new StructuredTrace()) =>
  new PerformanceMonitor(trace, {
    slowOperationMs: 20,
    criticalOperationMs: 40,
    maxConcurrency: 1,
    maxTotalDurationMs: 150,
    maxErrorRate: 20,
    maxMemoryUsageMB: 0.0005,
    recentWindowMs: 200,
  });

describe('PerformanceMonitor alert lifecycle integration', () => {
  let monitor;
  let structuredTrace;
  let now;
  let nowSpy;
  let setIntervalSpy;
  let intervalCallbacks;

  const advance = (ms) => {
    now += ms;
  };

  const tick = (ms) => {
    advance(ms);
    jest.advanceTimersByTime(ms);
  };

  beforeEach(() => {
    jest.useFakeTimers();
    now = 0;
    structuredTrace = new StructuredTrace();
    monitor = createMonitor(structuredTrace);
    intervalCallbacks = [];

    nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => now);

    const originalSetInterval = global.setInterval;
    setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockImplementation((callback, delay) => {
        intervalCallbacks.push(callback);
        return originalSetInterval(callback, delay);
      });
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
    nowSpy.mockRestore();
    jest.useRealTimers();
  });

  it('manages alert trimming, filtering, and idle monitoring cycles', () => {
    expect(() => monitor.enableSampling({ rate: 1.1 })).toThrow(
      'Sampling rate must be between 0.0 and 1.0'
    );

    monitor.enableSampling({
      rate: 0.5,
      strategy: 'random',
      alwaysSampleErrors: true,
      alwaysSampleSlow: true,
    });

    const root = structuredTrace.startSpan('RootOperation');
    advance(5);
    const slowSpan = structuredTrace.startSpan('SlowOperation');
    slowSpan.setAttribute('payload', 'x'.repeat(2000));
    advance(60);
    slowSpan.setError(new Error('slow failure'));
    structuredTrace.endSpan(slowSpan);

    const concurrentSpan = structuredTrace.startSpan('Concurrent');
    advance(15);
    concurrentSpan.setError(new Error('concurrent failure'));
    structuredTrace.endSpan(concurrentSpan);

    const moderateSpan = structuredTrace.startSpan('ModerateOperation');
    advance(25);
    structuredTrace.endSpan(moderateSpan);

    advance(10);
    structuredTrace.endSpan(root);

    const stopMonitoring = monitor.startMonitoring({ intervalMs: 5 });

    advance(1);
    monitor.trackOperation('ManualCriticalOperation', performance.now() - 90);
    advance(1);
    monitor.trackOperation('ManualSlowOperation', performance.now() - 30);

    tick(5);

    const filterSince = performance.now();

    for (let index = 0; index < 110; index += 1) {
      advance(1);
      monitor.recordMetric(`batch.metric.${index}`, index);
    }

    advance(1);
    monitor.trackOperation('PostTrimCriticalOperation', performance.now() - 80);
    advance(1);
    monitor.trackOperation('PostTrimSlowOperation', performance.now() - 25);

    const metricAlerts = monitor.getAlerts({ type: 'metric_recorded' });
    expect(metricAlerts.length).toBeLessThanOrEqual(70);
    expect(
      metricAlerts.some((alert) =>
        alert.context?.metricName?.includes('batch.metric.0')
      )
    ).toBe(false);

    const criticalAlerts = monitor.getAlerts({ severity: 'critical' });
    expect(criticalAlerts.length).toBeGreaterThan(0);
    expect(criticalAlerts.every((alert) => alert.severity === 'critical')).toBe(
      true
    );

    const slowAlerts = monitor.getAlerts({ type: 'slow_operation' });
    expect(slowAlerts.length).toBeGreaterThan(0);
    expect(slowAlerts.every((alert) => alert.type === 'slow_operation')).toBe(
      true
    );

    const recentAlerts = monitor.getAlerts({ since: filterSince });
    expect(recentAlerts.length).toBeGreaterThan(0);
    expect(recentAlerts.every((alert) => alert.timestamp >= filterSince)).toBe(
      true
    );

    advance(2);
    const alertsBeforeStop = monitor.getAlerts().length;
    stopMonitoring();

    expect(intervalCallbacks.length).toBeGreaterThan(0);
    intervalCallbacks[0]();

    expect(monitor.getAlerts().length).toBe(alertsBeforeStop + 1);
  });
});

describe('PerformanceMonitor sampling fallback integration', () => {
  let monitor;
  let structuredTrace;
  let now;
  let nowSpy;

  const advance = (ms) => {
    now += ms;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    now = 0;
    structuredTrace = new StructuredTrace();
    monitor = createMonitor(structuredTrace);
    nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    nowSpy.mockRestore();
    jest.useRealTimers();
  });

  it('falls back to random sampling and validates operation tracking input', () => {
    const root = structuredTrace.startSpan('Root');
    advance(80);
    structuredTrace.endSpan(root);

    const errorSpan = structuredTrace.startSpan('Erroneous');
    advance(10);
    errorSpan.setError(new Error('problem'));
    structuredTrace.endSpan(errorSpan);

    monitor.enableSampling({
      rate: 0.25,
      strategy: undefined,
      alwaysSampleErrors: false,
      alwaysSampleSlow: false,
    });

    const mathSpy = jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.4);

    expect(monitor.shouldSampleTrace()).toBe(true);
    expect(monitor.shouldSampleTrace()).toBe(false);
    expect(mathSpy).toHaveBeenCalledTimes(2);

    mathSpy.mockRestore();

    expect(() => monitor.trackOperation('analysis', 'invalid')).toThrow(
      'Timestamp must be a valid number'
    );

    advance(5);
    const timestamp = performance.now() - 50;
    monitor.trackOperation('analysis', timestamp);

    const recorded = monitor.getRecordedMetrics();
    expect(recorded['operation.analysis.duration']).toBeDefined();
  });
});
