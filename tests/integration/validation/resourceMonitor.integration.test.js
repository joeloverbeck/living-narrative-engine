import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  ResourceMonitor,
  ResourceExhaustionError,
} from '../../../src/validation/resourceMonitor.js';

const originalMemoryUsage = globalThis.process?.memoryUsage;
const originalGc = globalThis.gc;
const originalPerformance = globalThis.performance;

/**
 * Creates a memory usage mock that iterates through provided snapshots
 * and keeps returning the last value when exhausted.
 *
 * @param {number[]} snapshotsInBytes
 */
function createMemoryUsageMock(snapshotsInBytes) {
  let lastValue = snapshotsInBytes[snapshotsInBytes.length - 1] ?? 0;
  const queue = [...snapshotsInBytes];
  return jest.fn(() => {
    if (queue.length > 0) {
      lastValue = queue.shift();
    }
    return {
      heapUsed: lastValue,
      rss: lastValue,
      external: 0,
      arrayBuffers: 0,
      heapTotal: lastValue,
    };
  });
}

describe('ResourceMonitor integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();

    if (originalMemoryUsage) {
      globalThis.process.memoryUsage = originalMemoryUsage;
    } else {
      delete globalThis.process.memoryUsage;
    }

    if (originalGc) {
      globalThis.gc = originalGc;
    } else {
      delete globalThis.gc;
    }

    if (originalPerformance) {
      globalThis.performance = originalPerformance;
    } else {
      delete globalThis.performance;
    }
  });

  it('coordinates monitoring and enforces thresholds across concurrent validation operations', () => {
    const megabyte = 1024 * 1024;
    const memoryUsageMock = createMemoryUsageMock([
      10 * megabyte,
      30 * megabyte,
      40 * megabyte,
      55 * megabyte,
      92 * megabyte,
    ]);
    globalThis.process.memoryUsage = memoryUsageMock;

    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    globalThis.gc = jest.fn();

    const monitor = new ResourceMonitor({
      config: {
        maxMemoryUsage: 100 * megabyte,
        maxConcurrentOperations: 1,
        maxProcessingTime: 60,
        memoryCheckInterval: 20,
        memoryWarningThreshold: 0.5,
        memoryCriticalThreshold: 0.8,
      },
      logger,
    });

    let guard;

    try {
      monitor.startMonitoring();
      guard = monitor.createOperationGuard('validate:core', { timeout: 80 });

      expect(() => monitor.createOperationGuard('validate:extra')).toThrow(
        ResourceExhaustionError
      );

      let stats = monitor.getResourceStats();
      expect(stats.status).toBe('CRITICAL');
      expect(stats.operations.current).toBe(1);
      expect(stats.operations.active[0]).toEqual(
        expect.objectContaining({
          id: 'validate:core',
          startTime: expect.any(String),
        })
      );

      jest.advanceTimersByTime(20);
      expect(logger.warn).toHaveBeenCalledWith(
        'High memory usage detected',
        expect.objectContaining({
          current: expect.stringMatching(/MB/),
          limit: expect.any(String),
        })
      );

      jest.advanceTimersByTime(20);
      expect(logger.error).toHaveBeenCalledWith(
        'Critical memory usage detected',
        expect.objectContaining({
          current: expect.stringMatching(/MB/),
          limit: expect.any(String),
        })
      );
      expect(globalThis.gc).toHaveBeenCalledTimes(1);

      memoryUsageMock.mockImplementationOnce(() => ({
        heapUsed: 120 * megabyte,
        rss: 120 * megabyte,
        external: 0,
        arrayBuffers: 0,
        heapTotal: 120 * megabyte,
      }));
      expect(() => monitor.checkResourceLimits()).toThrow(
        ResourceExhaustionError
      );

      const postCheckMemoryUsage = jest.fn(() => ({
        heapUsed: 20 * megabyte,
        rss: 20 * megabyte,
        external: 0,
        arrayBuffers: 0,
        heapTotal: 20 * megabyte,
      }));
      globalThis.process.memoryUsage = postCheckMemoryUsage;

      guard.cleanup();
      stats = monitor.getResourceStats();
      expect(stats.operations.current).toBe(0);
      expect(stats.status).toBe('HEALTHY');

      monitor.reset();
      expect(logger.debug).toHaveBeenCalledWith('Resource monitor reset');

      const shutdownMemoryUsage = jest.fn(() => ({
        heapUsed: 15 * megabyte,
        rss: 15 * megabyte,
        external: 0,
        arrayBuffers: 0,
        heapTotal: 15 * megabyte,
      }));
      globalThis.process.memoryUsage = shutdownMemoryUsage;
      monitor.stopMonitoring();
      expect(logger.debug).toHaveBeenCalledWith(
        'Resource monitoring stopped',
        expect.objectContaining({
          startMemory: expect.any(Number),
          peakMemory: expect.any(Number),
          finalMemory: expect.any(Number),
          memoryGrowth: expect.any(Number),
        })
      );
    } finally {
      if (guard?.isActive()) {
        guard.cleanup();
      }
      monitor.stopMonitoring();
    }
  });

  it('propagates timeouts as security errors and releases resources for long running operations', () => {
    const megabyte = 1024 * 1024;
    const memoryUsageMock = createMemoryUsageMock([8 * megabyte]);
    globalThis.process.memoryUsage = memoryUsageMock;

    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const monitor = new ResourceMonitor({
      config: {
        maxMemoryUsage: 64 * megabyte,
        maxConcurrentOperations: 3,
        maxProcessingTime: 50,
        memoryCheckInterval: 100,
      },
      logger,
    });

    let guardA;

    try {
      monitor.startMonitoring();

      guardA = monitor.createOperationGuard('recipe:alpha');
      const guardB = monitor.createOperationGuard('recipe:beta', {
        timeout: 25,
      });

      expect(monitor.getResourceStats().status).toBe('MODERATE');

      expect(() => jest.advanceTimersByTime(26)).toThrow(
        ResourceExhaustionError
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Operation timeout: recipe:beta',
        expect.objectContaining({
          duration: expect.any(Number),
          maxDuration: 50,
        })
      );
      expect(guardB.isActive()).toBe(false);

      const afterTimeoutStats = monitor.getResourceStats();
      expect(afterTimeoutStats.operations.current).toBe(1);
      expect(afterTimeoutStats.operations.active[0].id).toBe('recipe:alpha');

      guardA.cleanup();
      expect(monitor.getResourceStats().operations.current).toBe(0);

      monitor.stopMonitoring();
    } finally {
      if (guardA?.isActive()) {
        guardA.cleanup();
      }
      monitor.stopMonitoring();
    }
  });

  it('manages lifecycle transitions across runtime fallbacks and manual cleanup scenarios', () => {
    const megabyte = 1024 * 1024;
    const nodeMemorySnapshots = [4 * megabyte, 6 * megabyte, 8 * megabyte];
    const memoryUsageMock = createMemoryUsageMock(nodeMemorySnapshots);
    globalThis.process.memoryUsage = memoryUsageMock;

    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const defaultMonitor = new ResourceMonitor({});
    expect(defaultMonitor.maxMemoryUsage).toBe(512 * megabyte);
    expect(defaultMonitor.maxProcessingTime).toBe(30000);
    expect(defaultMonitor.maxConcurrentOperations).toBe(10);
    expect(defaultMonitor.memoryCheckInterval).toBe(1000);
    expect(defaultMonitor.memoryWarningThreshold).toBe(0.75);
    expect(defaultMonitor.memoryCriticalThreshold).toBe(0.9);

    defaultMonitor.startMonitoring();
    jest.advanceTimersByTime(defaultMonitor.memoryCheckInterval);
    defaultMonitor.stopMonitoring();

    const monitor = new ResourceMonitor({
      config: {
        maxMemoryUsage: 50 * megabyte,
        maxConcurrentOperations: 10,
        maxProcessingTime: 80,
        memoryCheckInterval: 25,
        memoryWarningThreshold: 0.6,
        memoryCriticalThreshold: 0.9,
      },
      logger,
    });

    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    let interceptedIntervalId = null;

    global.setInterval = jest.fn((fn, delay, ...args) => {
      interceptedIntervalId = originalSetInterval(fn, delay, ...args);
      return 0;
    });

    global.clearInterval = jest.fn((intervalId) => {
      if (intervalId === 0 && interceptedIntervalId) {
        originalClearInterval(interceptedIntervalId);
        interceptedIntervalId = null;
      } else {
        originalClearInterval(intervalId);
      }
    });

    try {
      monitor.startMonitoring();
      const timersAfterFirstStart = jest.getTimerCount();
      monitor.startMonitoring();
      expect(jest.getTimerCount()).toBe(timersAfterFirstStart);

      const lifecycleGuard = monitor.createOperationGuard('lifecycle:node', {
        timeout: 40,
      });
      jest.advanceTimersByTime(12);
      expect(lifecycleGuard.getDuration()).toBeGreaterThanOrEqual(12);

      monitor.stopMonitoring();
      expect(lifecycleGuard.isActive()).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        'Resource monitoring stopped',
        expect.any(Object)
      );
    } finally {
      if (interceptedIntervalId) {
        originalClearInterval(interceptedIntervalId);
        interceptedIntervalId = null;
      }
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    }

    expect(jest.getTimerCount()).toBe(0);

    globalThis.process.memoryUsage = undefined;
    globalThis.performance = { memory: { usedJSHeapSize: 32 * megabyte } };

    monitor.startMonitoring();
    const guardA = monitor.createOperationGuard('runtime:alpha');
    const guardB = monitor.createOperationGuard('runtime:beta');
    const guardC = monitor.createOperationGuard('runtime:gamma');

    delete globalThis.gc;
    globalThis.performance.memory.usedJSHeapSize = 49 * megabyte;
    jest.advanceTimersByTime(monitor.memoryCheckInterval);
    globalThis.performance.memory.usedJSHeapSize = 32 * megabyte;

    const warningStats = monitor.getResourceStats();
    expect(warningStats.status).toBe('WARNING');
    expect(warningStats.memory.current).toBe(32 * megabyte);

    globalThis.performance = {};
    const fallbackStats = monitor.getResourceStats();
    expect(fallbackStats.memory.current).toBe(3 * megabyte);
    expect(fallbackStats.memory.formatted.current).toBe('3 MB');

    guardA.cleanup();
    guardA.cleanup();

    monitor.maxMemoryUsage = 1.5 * megabyte;
    expect(() => monitor.checkResourceLimits()).toThrow(
      ResourceExhaustionError
    );

    monitor.reset();
    expect(logger.debug).toHaveBeenCalledWith('Resource monitor reset');
    expect(monitor.getResourceStats().operations.current).toBe(0);
    expect(guardB.isActive()).toBe(false);
    expect(guardC.isActive()).toBe(false);

    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    let interceptedTimeoutId = null;
    let storedRealTimeout = null;

    globalThis.setTimeout = jest.fn((fn, delay, ...args) => {
      storedRealTimeout = originalSetTimeout(fn, delay, ...args);
      interceptedTimeoutId = 0;
      return interceptedTimeoutId;
    });

    globalThis.clearTimeout = jest.fn((timeoutId) => {
      if (timeoutId === interceptedTimeoutId && storedRealTimeout !== null) {
        originalClearTimeout(storedRealTimeout);
        storedRealTimeout = null;
      } else {
        originalClearTimeout(timeoutId);
      }
    });

    const ephemeralGuard = monitor.createOperationGuard('runtime:ephemeral', {
      timeout: 15,
    });
    try {
      ephemeralGuard.cleanup();
      expect(ephemeralGuard.isActive()).toBe(false);
      expect(() => jest.advanceTimersByTime(16)).not.toThrow();
    } finally {
      if (storedRealTimeout !== null) {
        originalClearTimeout(storedRealTimeout);
      }
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }

    monitor.stopMonitoring();
  });
});
