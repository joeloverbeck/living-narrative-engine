import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import MemoryMonitor from '../../../../src/entities/monitoring/MemoryMonitor.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';
import { getMemoryUsage } from '../../../../src/utils/environmentUtils.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

jest.mock('../../../../src/utils/environmentUtils.js', () => ({
  getMemoryUsage: jest.fn(),
}));

const MB = 1024 * 1024;
const createUsage = ({ heapUsed, heapTotal = heapUsed * 2, rss = 0, external = 0 }) => ({
  heapUsed,
  heapTotal,
  heapLimit: heapTotal,
  rss,
  external,
});

describe('MemoryMonitor', () => {
  let logger;
  let eventBus;
  let originalPerformance;

  const hasDispatchCall = (type) =>
    eventBus.dispatch.mock.calls.some(([event]) => event?.type === type);

  const infoIncludes = (snippet) =>
    logger.info.mock.calls.some(
      ([message]) => typeof message === 'string' && message.includes(snippet)
    );

  const latestDispatchFor = (type) => {
    const calls = eventBus.dispatch.mock.calls.filter(([event]) => event?.type === type);
    return calls.length ? calls[calls.length - 1][0] : undefined;
  };

  const createMonitor = (options = {}) =>
    new MemoryMonitor({
      logger,
      eventBus,
      samplingInterval: 50,
      maxHistorySize: 10,
      leakDetectionConfig: {
        enabled: true,
        windowSize: 3,
        checkInterval: 100,
        sensitivity: 'medium',
        ...options.leakDetectionConfig,
      },
      ...options,
    });

  beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
    logger = createMockLogger();
    eventBus = { dispatch: jest.fn() };
    getMemoryUsage.mockReset();
    originalPerformance = global.performance;
    delete global.performance;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.performance = originalPerformance;
  });

  it('initializes with defaults and validates thresholds', () => {
    getMemoryUsage.mockReturnValue(createUsage({ heapUsed: 20 * MB, heapTotal: 80 * MB }));

    const defaultMonitor = new MemoryMonitor({ logger, eventBus });

    expect(infoIncludes('MemoryMonitor initialized')).toBe(true);
    expect(defaultMonitor.getConfiguration()).toMatchObject({
      thresholds: { heapWarning: 0.7, heapCritical: 0.85 },
      leakDetection: expect.objectContaining({ windowSize: 100, sensitivity: 'medium' }),
    });

    expect(() =>
      new MemoryMonitor({
        logger,
        eventBus,
        heapWarning: 0.9,
        heapCritical: 0.8,
      })
    ).toThrow(InvalidArgumentError);
  });

  it('monitors heap thresholds, dispatches lifecycle events, and resets state', () => {
    const usageSequence = [
      createUsage({ heapUsed: 40 * MB, heapTotal: 100 * MB }),
      createUsage({ heapUsed: 80 * MB, heapTotal: 100 * MB }),
      createUsage({ heapUsed: 90 * MB, heapTotal: 100 * MB }),
      createUsage({ heapUsed: 60 * MB, heapTotal: 100 * MB }),
    ];
    let index = 0;
    getMemoryUsage.mockImplementation(() => ({
      ...usageSequence[Math.min(index++, usageSequence.length - 1)],
    }));

    const monitor = createMonitor();
    const warningHandler = jest.fn();
    const criticalHandler = jest.fn();
    const criticalHandlerThatThrows = jest.fn(() => {
      throw new Error('handler failure');
    });
    monitor.onThresholdExceeded('warning', warningHandler);
    monitor.onThresholdExceeded('critical', criticalHandler);
    monitor.onThresholdExceeded('critical', criticalHandlerThatThrows);

    monitor.start();
    expect(hasDispatchCall('MEMORY_MONITORING_STARTED')).toBe(true);

    monitor.start();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Memory monitoring already started')
    );

    jest.advanceTimersByTime(50);
    expect(warningHandler).toHaveBeenCalledTimes(1);
    const warningEvent = latestDispatchFor('MEMORY_THRESHOLD_EXCEEDED');
    expect(warningEvent.payload).toMatchObject({ level: 'warning', type: 'heap' });

    jest.advanceTimersByTime(50);
    expect(criticalHandler).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Alert handler error:'),
      expect.any(Error)
    );
    const criticalEvent = latestDispatchFor('MEMORY_THRESHOLD_EXCEEDED');
    expect(criticalEvent.payload).toMatchObject({ level: 'critical', type: 'heap' });

    jest.advanceTimersByTime(50);
    expect(monitor.getPressureLevel()).toBe('normal');
    expect(hasDispatchCall('MEMORY_PRESSURE_CHANGED')).toBe(true);

    expect(monitor.getCurrentUsage()).toEqual(
      expect.objectContaining({ heapUsed: 60 * MB, heapTotal: 100 * MB })
    );
    expect(monitor.getHistory().length).toBe(4);
    expect(monitor.getHistory(120).length).toBeGreaterThanOrEqual(2);

    monitor.updateThresholds({ heapWarning: 0.6, heapCritical: 0.75 });
    expect(infoIncludes('Memory thresholds updated')).toBe(true);
    expect(hasDispatchCall('MEMORY_THRESHOLDS_UPDATED')).toBe(true);

    monitor.stop();
    expect(hasDispatchCall('MEMORY_MONITORING_STOPPED')).toBe(true);

    monitor.destroy();
    expect(infoIncludes('MemoryMonitor destroyed')).toBe(true);
    expect(monitor.getHistory()).toEqual([]);

    getMemoryUsage.mockReset();
    const trimmedSequence = [
      createUsage({ heapUsed: 30 * MB, heapTotal: 120 * MB }),
      createUsage({ heapUsed: 40 * MB, heapTotal: 120 * MB }),
      createUsage({ heapUsed: 50 * MB, heapTotal: 120 * MB }),
    ];
    let trimmedIndex = 0;
    getMemoryUsage.mockImplementation(() => ({
      ...trimmedSequence[Math.min(trimmedIndex++, trimmedSequence.length - 1)],
    }));

    const trimmedMonitor = new MemoryMonitor({
      logger,
      eventBus,
      samplingInterval: 25,
      maxHistorySize: 2,
      leakDetectionConfig: { windowSize: 2, checkInterval: 50 },
    });
    trimmedMonitor.start();
    jest.advanceTimersByTime(100);
    expect(trimmedMonitor.getHistory().length).toBe(2);
    trimmedMonitor.stop();
  });

  it('produces RSS alerts, detects leaks, and predicts OOM timing', () => {
    const usageSequence = [
      createUsage({ heapUsed: 10 * MB, heapTotal: 200 * MB, rss: 150 * MB }),
      createUsage({ heapUsed: 12 * MB, heapTotal: 200 * MB, rss: 260 * MB }),
      createUsage({ heapUsed: 14 * MB, heapTotal: 200 * MB, rss: 500 * MB }),
      createUsage({ heapUsed: 60 * MB, heapTotal: 200 * MB, rss: 520 * MB }),
      createUsage({ heapUsed: 90 * MB, heapTotal: 200 * MB, rss: 540 * MB }),
      createUsage({ heapUsed: 120 * MB, heapTotal: 200 * MB, rss: 560 * MB }),
    ];
    let index = 0;
    getMemoryUsage.mockImplementation(() => ({
      ...usageSequence[Math.min(index++, usageSequence.length - 1)],
    }));

    const leakHandler = jest.fn();
    const monitor = createMonitor({
      rssWarning: 200 * MB,
      rssCritical: 400 * MB,
      leakDetectionConfig: {
        enabled: true,
        windowSize: 3,
        checkInterval: 150,
        sensitivity: 'high',
      },
    });
    const warningHandler = jest.fn();
    const criticalHandler = jest.fn();
    monitor.onThresholdExceeded('warning', warningHandler);
    monitor.onThresholdExceeded('critical', criticalHandler);
    monitor.onThresholdExceeded('leak', leakHandler);

    monitor.start();
    jest.advanceTimersByTime(50);
    expect(warningHandler).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'warning', type: 'rss' })
    );

    jest.advanceTimersByTime(50);
    expect(criticalHandler).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'critical', type: 'rss' })
    );

    jest.advanceTimersByTime(150);
    const leakCall = leakHandler.mock.calls[0][0];
    expect(leakCall.detected).toBe(true);
    expect(['growing', 'fluctuating']).toContain(leakCall.trend);
    expect(hasDispatchCall('MEMORY_LEAK_DETECTED')).toBe(true);

    const leakResult = monitor.detectMemoryLeak('high');
    expect(leakResult.detected).toBe(true);
    expect(['high', 'medium']).toContain(leakResult.confidence);
    expect(leakResult.estimatedTimeToOOM ?? 1).toBeGreaterThan(0);

    const growthAnalysis = monitor.analyzeGrowthPattern();
    expect(growthAnalysis.pattern).toBe('growing');
    expect(growthAnalysis.samples).toBeGreaterThan(2);

    const prediction = monitor.predictOutOfMemory();
    expect(prediction).toBeGreaterThan(0);

    monitor.stop();
  });

  it('handles edge cases, validation failures, and browser memory API', () => {
    const emptyMonitor = createMonitor({ leakDetectionConfig: { windowSize: 4 } });

    expect(emptyMonitor.detectMemoryLeak()).toEqual(
      expect.objectContaining({ detected: false, trend: 'insufficient_data' })
    );

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(0);
    const flatSequence = [
      createUsage({ heapUsed: 10 * MB, heapTotal: 100 * MB }),
      createUsage({ heapUsed: 20 * MB, heapTotal: 100 * MB }),
      createUsage({ heapUsed: 30 * MB, heapTotal: 100 * MB }),
      createUsage({ heapUsed: 40 * MB, heapTotal: 100 * MB }),
    ];
    let idx = 0;
    getMemoryUsage.mockImplementation(() => ({
      ...flatSequence[Math.min(idx++, flatSequence.length - 1)],
    }));

    const zeroSpanMonitor = createMonitor({ leakDetectionConfig: { windowSize: 4 } });
    zeroSpanMonitor.start();
    jest.advanceTimersByTime(200);
    const zeroSpanResult = zeroSpanMonitor.detectMemoryLeak();
    expect(zeroSpanResult.trend).toBe('insufficient_time');
    zeroSpanMonitor.stop();
    nowSpy.mockRestore();

    const altSequence = [
      createUsage({ heapUsed: 40 * MB, heapTotal: 120 * MB }),
      createUsage({ heapUsed: 35 * MB, heapTotal: 120 * MB }),
      createUsage({ heapUsed: 20 * MB, heapTotal: 120 * MB }),
      createUsage({ heapUsed: 25 * MB, heapTotal: 120 * MB }),
    ];
    let altIndex = 0;
    getMemoryUsage.mockImplementation(() => ({
      ...altSequence[Math.min(altIndex++, altSequence.length - 1)],
    }));

    const patternMonitor = createMonitor({ leakDetectionConfig: { windowSize: 4 } });
    patternMonitor.start();
    jest.advanceTimersByTime(200);
    const pattern = patternMonitor.analyzeGrowthPattern();
    expect(['volatile', 'shrinking', 'stable']).toContain(pattern.pattern);
    expect(patternMonitor.predictOutOfMemory()).toBeNull();
    patternMonitor.stop();

    expect(() => patternMonitor.updateThresholds({ heapWarning: 1.2 })).toThrow(
      InvalidArgumentError
    );

    expect(() => patternMonitor.onThresholdExceeded('', () => {})).toThrow(InvalidArgumentError);
    expect(() => patternMonitor.onThresholdExceeded('warning')).toThrow(Error);

    eventBus.dispatch.mockClear();
    const disabledMonitor = createMonitor({ enabled: false });
    disabledMonitor.start();
    expect(infoIncludes('Memory monitoring is disabled')).toBe(true);
    expect(eventBus.dispatch).not.toHaveBeenCalled();
    disabledMonitor.stop();

    getMemoryUsage.mockClear();
    global.performance = {
      memory: {
        usedJSHeapSize: 40 * MB,
        totalJSHeapSize: 90 * MB,
        jsHeapSizeLimit: 160 * MB,
      },
    };
    getMemoryUsage.mockReturnValue(createUsage({ heapUsed: 10 * MB, heapTotal: 40 * MB }));
    const browserMonitor = createMonitor();
    browserMonitor.start();
    const [browserSnapshot] = browserMonitor.getHistory();
    expect(browserSnapshot.usagePercent).toBeCloseTo(40 * MB / (160 * MB));
    expect(getMemoryUsage).not.toHaveBeenCalled();
    browserMonitor.stop();
  });

  it('exercises fallback memory usage paths and additional threshold validation', () => {
    expect(() =>
      new MemoryMonitor({
        logger,
        eventBus,
        heapCritical: -0.1,
      })
    ).toThrow(InvalidArgumentError);

    global.performance = {
      memory: {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
      },
    };

    const zeroPerfMonitor = createMonitor();
    zeroPerfMonitor.start();
    const zeroPerfSnapshot = zeroPerfMonitor.getHistory()[0];
    expect(zeroPerfSnapshot).toMatchObject({
      heapUsed: 0,
      heapTotal: 0,
      usagePercent: 0,
    });
    zeroPerfMonitor.stop();

    global.performance = undefined;
    getMemoryUsage
      .mockReset()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        heapUsed: 5 * MB,
        heapTotal: 0,
        external: 123,
      });

    const fallbackMonitor = createMonitor();
    fallbackMonitor.start();
    const [firstSnapshot] = fallbackMonitor.getHistory();
    expect(firstSnapshot).toMatchObject({
      heapTotal: 0,
      heapLimit: 0,
      usagePercent: 0,
    });

    jest.advanceTimersByTime(50);
    const latest = fallbackMonitor.getHistory().at(-1);
    expect(latest).toMatchObject({
      heapTotal: 0,
      usagePercent: 0,
      external: 123,
    });

    fallbackMonitor.stop();
  });

  it('analyzes sustained growth and shrinkage patterns for leak predictions', () => {
    const growthSequence = [
      createUsage({ heapUsed: 40 * MB, heapTotal: 100 * MB }),
      createUsage({ heapUsed: 55 * MB, heapTotal: 100 * MB }),
      createUsage({ heapUsed: 70 * MB, heapTotal: 100 * MB }),
      createUsage({ heapUsed: 85 * MB, heapTotal: 100 * MB }),
    ];
    let growthIndex = 0;
    getMemoryUsage.mockImplementation(() => ({
      ...growthSequence[Math.min(growthIndex++, growthSequence.length - 1)],
    }));

    const growthMonitor = createMonitor({
      leakDetectionConfig: { windowSize: 4, checkInterval: 50, sensitivity: 'low' },
    });
    growthMonitor.start();
    jest.advanceTimersByTime(150);

    const growthResult = growthMonitor.detectMemoryLeak('low');
    expect(growthResult).toMatchObject({
      detected: true,
      trend: 'growing',
      confidence: 'high',
    });
    expect(growthResult.estimatedTimeToOOM).toBeGreaterThan(0);

    growthMonitor.stop();

    const freshMonitor = createMonitor();
    expect(freshMonitor.analyzeGrowthPattern()).toEqual(
      expect.objectContaining({ pattern: 'insufficient_data' })
    );

    getMemoryUsage.mockReset();
    const shrinkingSequence = [
      createUsage({ heapUsed: 90 * MB, heapTotal: 120 * MB }),
      createUsage({ heapUsed: 80 * MB, heapTotal: 120 * MB }),
      createUsage({ heapUsed: 70 * MB, heapTotal: 120 * MB }),
      createUsage({ heapUsed: 60 * MB, heapTotal: 120 * MB }),
    ];
    let shrinkingIndex = 0;
    getMemoryUsage.mockImplementation(() => ({
      ...shrinkingSequence[Math.min(shrinkingIndex++, shrinkingSequence.length - 1)],
    }));

    const shrinkingMonitor = createMonitor({ leakDetectionConfig: { windowSize: 4 } });
    shrinkingMonitor.start();
    jest.advanceTimersByTime(200);

    const shrinkingAnalysis = shrinkingMonitor.analyzeGrowthPattern();
    expect(shrinkingAnalysis.pattern).toBe('shrinking');
    expect(shrinkingMonitor.predictOutOfMemory()).toBeNull();

    shrinkingMonitor.stop();
  });
});
