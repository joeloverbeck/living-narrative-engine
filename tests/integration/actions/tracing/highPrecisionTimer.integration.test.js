import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  HighPrecisionTimer,
  highPrecisionTimer,
} from '../../../../src/actions/tracing/timing/highPrecisionTimer.js';

describe('HighPrecisionTimer integration', () => {
  let originalPerformance;
  let originalPerformanceDescriptor;
  let originalHrtime;
  let originalConsoleDebug;

  beforeAll(() => {
    originalPerformanceDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'performance'
    );
    originalPerformance = globalThis.performance;
    originalHrtime = process.hrtime;
    originalConsoleDebug = console.debug;
  });

  afterAll(() => {
    restorePerformance();
    process.hrtime = originalHrtime;
    console.debug = originalConsoleDebug;
  });

  function restorePerformance() {
    if (originalPerformanceDescriptor) {
      Object.defineProperty(
        globalThis,
        'performance',
        originalPerformanceDescriptor
      );
    } else {
      globalThis.performance = originalPerformance;
    }
  }

  function overridePerformance(value) {
    Object.defineProperty(globalThis, 'performance', {
      value,
      configurable: true,
      writable: true,
    });
  }

  it('provides high precision timestamps when performance API is available', () => {
    const first = highPrecisionTimer.now();
    const second = highPrecisionTimer.now();

    expect(second).toBeGreaterThanOrEqual(first);
    expect(highPrecisionTimer.isHighPrecisionAvailable()).toBe(true);
  });

  it('measures synchronous executions including failures', () => {
    const successMeasurement = highPrecisionTimer.measure(() => {
      const start = performance.now();
      while (performance.now() - start < 1) {
        // busy wait for measurable time
      }
      return 'complete';
    });

    expect(successMeasurement.success).toBe(true);
    expect(successMeasurement.result).toBe('complete');
    expect(successMeasurement.duration).toBeGreaterThan(0);
    expect(successMeasurement.endTime).toBeGreaterThan(
      successMeasurement.startTime
    );

    const failureMeasurement = highPrecisionTimer.measure(() => {
      throw new Error('expected failure');
    });

    expect(failureMeasurement.success).toBe(false);
    expect(failureMeasurement.result).toBeNull();
    expect(failureMeasurement.error).toBeInstanceOf(Error);
    expect(failureMeasurement.duration).toBeGreaterThanOrEqual(0);
  });

  it('measures asynchronous executions including rejections', async () => {
    const asyncSuccess = await highPrecisionTimer.measureAsync(async () => {
      const start = performance.now();
      while (performance.now() - start < 1) {
        // busy wait for measurable time
      }
      return 'async-complete';
    });

    expect(asyncSuccess.success).toBe(true);
    expect(asyncSuccess.result).toBe('async-complete');
    expect(asyncSuccess.duration).toBeGreaterThan(0);

    const asyncFailure = await highPrecisionTimer.measureAsync(async () => {
      throw new Error('async failure');
    });

    expect(asyncFailure.success).toBe(false);
    expect(asyncFailure.result).toBeNull();
    expect(asyncFailure.error).toBeInstanceOf(Error);
    expect(asyncFailure.duration).toBeGreaterThanOrEqual(0);
  });

  it('creates markers and calculates human readable durations', () => {
    const startMarker = highPrecisionTimer.createMarker('start-phase');
    const endMarker = highPrecisionTimer.createMarker('end-phase');

    const durationData = highPrecisionTimer.calculateDuration(
      startMarker,
      endMarker
    );

    expect(durationData.startMarker).toEqual(startMarker);
    expect(durationData.endMarker).toEqual(endMarker);
    expect(durationData.label).toBe('start-phase → end-phase');
    expect(durationData.duration).toBeGreaterThanOrEqual(0);
    expect(durationData.humanReadable).toMatch(/ms|μs|s/);
  });

  it('throws when duration markers are missing', () => {
    expect(() =>
      highPrecisionTimer.calculateDuration(null, {
        label: 'end',
        timestamp: highPrecisionTimer.now(),
      })
    ).toThrow('Both start and end markers are required');
    expect(() =>
      highPrecisionTimer.calculateDuration(
        { label: 'start', timestamp: highPrecisionTimer.now() },
        null
      )
    ).toThrow('Both start and end markers are required');
  });

  it('formats durations across supported units', () => {
    const freshTimer = new HighPrecisionTimer();

    expect(freshTimer.formatDuration(0.5)).toMatch(/μs$/);
    expect(freshTimer.formatDuration(10)).toBe('10.00ms');
    expect(freshTimer.formatDuration(1500)).toBe('1.50s');
    expect(freshTimer.formatDuration(65000)).toBe('1m 5.00s');
  });

  it('reports precision information with positive baseline', () => {
    const precisionInfo = highPrecisionTimer.getPrecisionInfo();

    expect(precisionInfo.api).toMatch(/performance|process|Date/);
    expect(precisionInfo.resolution).toBeGreaterThan(0);
    expect(precisionInfo.baseline).toBeGreaterThanOrEqual(0);
  });

  it('falls back to process.hrtime when performance API is unavailable', () => {
    try {
      overridePerformance(undefined);
      process.hrtime = originalHrtime;
      console.debug = jest.fn();

      const timer = new HighPrecisionTimer();
      const timestamp = timer.now();
      const info = timer.getPrecisionInfo();

      expect(timestamp).toBeGreaterThanOrEqual(0);
      expect(info.api).toBe('process.hrtime()');
      expect(info.resolution).toBe(0.000001);
    } finally {
      restorePerformance();
      process.hrtime = originalHrtime;
      console.debug = originalConsoleDebug;
    }
  });

  it('falls back to Date.now when no high precision APIs are available', () => {
    try {
      overridePerformance(undefined);
      process.hrtime = undefined;
      console.debug = jest.fn();

      const timer = new HighPrecisionTimer();
      const first = timer.now();
      const second = timer.now();
      const info = timer.getPrecisionInfo();

      expect(first).toBeGreaterThanOrEqual(0);
      expect(second).toBeGreaterThanOrEqual(first);
      expect(info.api).toBe('Date.now()');
      expect(info.resolution).toBe(1);
    } finally {
      restorePerformance();
      process.hrtime = originalHrtime;
      console.debug = originalConsoleDebug;
    }
  });
});
