import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  ResourceMonitor,
  ResourceExhaustionError
} from '../../../src/validation/resourceMonitor.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

const originalMemoryUsage = globalThis.process?.memoryUsage;
const originalPerformance = globalThis.performance;
const originalGc = globalThis.gc;

/**
 * Creates a resource monitor test harness with controllable memory usage.
 *
 * @param {Partial<ConstructorParameters<typeof ResourceMonitor>[0]['config']>} [config]
 * @param {ReturnType<typeof createMockLogger>} [logger]
 */
function createMonitor(config = {}, logger = createMockLogger()) {
  const memoryUsageMock = jest.fn(() => ({ heapUsed: 128 }));
  if (globalThis.process) {
    globalThis.process.memoryUsage = memoryUsageMock;
  }

  const monitor = new ResourceMonitor({
    config: {
      maxMemoryUsage: 1024,
      maxProcessingTime: 500,
      maxConcurrentOperations: 5,
      memoryCheckInterval: 50,
      memoryWarningThreshold: 0.7,
      memoryCriticalThreshold: 0.9,
      ...config
    },
    logger
  });

  return { monitor, logger, memoryUsageMock };
}

describe('ResourceMonitor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();

    if (globalThis.process && originalMemoryUsage) {
      globalThis.process.memoryUsage = originalMemoryUsage;
    }
    if (!originalMemoryUsage && globalThis.process) {
      delete globalThis.process.memoryUsage;
    }
    if (originalPerformance !== undefined) {
      globalThis.performance = originalPerformance;
    } else {
      delete globalThis.performance;
    }
    if (originalGc) {
      globalThis.gc = originalGc;
    } else {
      delete globalThis.gc;
    }
  });

  it('starts monitoring once, emits warnings, and stops with summary logging', () => {
    const logger = createMockLogger();
    const { monitor, memoryUsageMock } = createMonitor(
      {
        maxMemoryUsage: 1000,
        memoryWarningThreshold: 0.75,
        memoryCriticalThreshold: 0.9
      },
      logger
    );

    const gcMock = jest.fn();
    globalThis.gc = gcMock;

    memoryUsageMock
      .mockReturnValueOnce({ heapUsed: 100 })
      .mockReturnValueOnce({ heapUsed: 800 })
      .mockReturnValueOnce({ heapUsed: 950 })
      .mockReturnValueOnce({ heapUsed: 420 })
      .mockReturnValue({ heapUsed: 420 });

    monitor.startMonitoring();
    monitor.startMonitoring();

    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Resource monitoring started');

    jest.advanceTimersByTime(50);
    expect(logger.warn).toHaveBeenCalledWith(
      'High memory usage detected',
      expect.objectContaining({
        current: expect.stringContaining('800'),
        limit: expect.any(String)
      })
    );

    jest.advanceTimersByTime(50);
    expect(logger.error).toHaveBeenCalledWith(
      'Critical memory usage detected',
      expect.objectContaining({
        current: expect.stringContaining('950'),
        limit: expect.any(String)
      })
    );
    expect(gcMock).toHaveBeenCalled();

    monitor.stopMonitoring();
    expect(logger.debug).toHaveBeenCalledWith(
      'Resource monitoring stopped',
      expect.objectContaining({
        startMemory: 100,
        peakMemory: 950,
        finalMemory: 420,
        memoryGrowth: 320
      })
    );

    monitor.stopMonitoring();
  });

  it('enforces concurrent operation limits before registration', () => {
    const { monitor } = createMonitor({ maxConcurrentOperations: 1 });

    const guard = monitor.createOperationGuard('op-1');
    expect(() => monitor.createOperationGuard('op-2')).toThrow(
      ResourceExhaustionError
    );

    guard.cleanup();
  });

  it('throws when memory usage exceeds configured maximum', () => {
    const { monitor, memoryUsageMock } = createMonitor({ maxMemoryUsage: 256 });

    memoryUsageMock.mockReturnValueOnce({ heapUsed: 200 });
    memoryUsageMock.mockReturnValue({ heapUsed: 512 });

    monitor.startMonitoring();
    expect(() => monitor.checkResourceLimits()).toThrow(ResourceExhaustionError);

    monitor.stopMonitoring();
  });

  it('provides guard utilities for active operations', () => {
    const { monitor } = createMonitor({ maxProcessingTime: 1000 });

    const guard = monitor.createOperationGuard('guard-1');
    expect(guard.isActive()).toBe(true);

    jest.advanceTimersByTime(25);
    expect(guard.getDuration()).toBeGreaterThanOrEqual(25);

    guard.cleanup();
    expect(guard.isActive()).toBe(false);
    expect(monitor.getResourceStats().operations.current).toBe(0);
  });

  it('handles operation timeouts with detailed errors and cleanup', () => {
    const logger = createMockLogger();
    const { monitor } = createMonitor({ maxProcessingTime: 100 }, logger);

    monitor.createOperationGuard('slow-op');

    expect(() => jest.advanceTimersByTime(110)).toThrow(ResourceExhaustionError);
    expect(logger.error).toHaveBeenCalledWith(
      'Operation timeout: slow-op',
      expect.objectContaining({
        duration: expect.any(Number),
        maxDuration: 100
      })
    );
    expect(monitor.getResourceStats().operations.current).toBe(0);
  });

  it('resets tracking data and clears active operations', () => {
    const { monitor, memoryUsageMock } = createMonitor();

    memoryUsageMock
      .mockReturnValueOnce({ heapUsed: 150 })
      .mockReturnValueOnce({ heapUsed: 200 })
      .mockReturnValue({ heapUsed: 220 });

    const guard = monitor.createOperationGuard('reset-op');
    expect(guard.isActive()).toBe(true);

    monitor.reset();

    expect(guard.isActive()).toBe(false);
    const stats = monitor.getResourceStats();
    expect(stats.memory.current).toBe(220);
    expect(stats.memory.peak).toBe(200);
    expect(stats.operations.current).toBe(0);
  });

  it('calculates status from operation pressure levels', () => {
    const { monitor } = createMonitor({ maxConcurrentOperations: 4 });

    const healthy = monitor.getResourceStats();
    expect(healthy.status).toBe('HEALTHY');

    const guardA = monitor.createOperationGuard('op-a');
    const guardB = monitor.createOperationGuard('op-b');
    expect(monitor.getResourceStats().status).toBe('MODERATE');

    const guardC = monitor.createOperationGuard('op-c');
    expect(monitor.getResourceStats().status).toBe('WARNING');

    const guardD = monitor.createOperationGuard('op-d');
    expect(monitor.getResourceStats().status).toBe('CRITICAL');

    guardA.cleanup();
    guardB.cleanup();
    guardC.cleanup();
    guardD.cleanup();
  });

  it('falls back to estimated memory usage when environment metrics are unavailable', () => {
    const logger = createMockLogger();
    if (globalThis.process) {
      globalThis.process.memoryUsage = undefined;
    }
    globalThis.performance = undefined;

    const { monitor } = createMonitor({ maxConcurrentOperations: 3 }, logger);
    if (globalThis.process) {
      globalThis.process.memoryUsage = undefined;
    }

    const guard = monitor.createOperationGuard('estimated');
    const stats = monitor.getResourceStats();
    expect(stats.memory.current).toBe(1024 * 1024);
    expect(stats.memory.formatted.current).toBe('1 MB');
    expect(stats.operations.current).toBe(1);

    guard.cleanup();
  });
});
