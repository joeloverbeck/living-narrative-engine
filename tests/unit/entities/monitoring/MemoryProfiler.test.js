import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import MemoryProfiler from '../../../../src/entities/monitoring/MemoryProfiler.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { getMemoryUsage } from '../../../../src/utils/environmentUtils.js';

jest.mock('../../../../src/utils/environmentUtils.js', () => ({
  getMemoryUsage: jest.fn(),
}));

const MB = 1024 * 1024;

const buildMemoryUsage = (
  heapUsed,
  heapTotal = heapUsed * 2,
  external = 0
) => ({
  heapUsed,
  heapTotal,
  external,
});

describe('MemoryProfiler', () => {
  let logger;
  let originalPerformance;
  let nowTick;

  const createProfiler = (config = {}) =>
    new MemoryProfiler(
      { logger },
      {
        maxSnapshots: 5,
        maxOperations: 10,
        snapshotInterval: 25,
        trackPeakMemory: false,
        ...config,
      }
    );

  beforeEach(() => {
    logger = createMockLogger();
    originalPerformance = global.performance;
    nowTick = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      nowTick += 100;
      return nowTick;
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.performance = originalPerformance;
    jest.restoreAllMocks();
    getMemoryUsage.mockReset();
  });

  it('initializes with validated dependencies and merged configuration', () => {
    const profiler = createProfiler({ maxSnapshots: 2, snapshotInterval: 10 });

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('MemoryProfiler initialized'),
      expect.objectContaining({ maxSnapshots: 2, snapshotInterval: 10 })
    );
    expect(profiler.getStatistics()).toEqual({
      snapshots: 0,
      operations: 0,
      activeOperations: 0,
      trackedObjects: 0,
      config: expect.objectContaining({
        maxSnapshots: 2,
        snapshotInterval: 10,
      }),
    });
  });

  it('uses default configuration values when none are provided', () => {
    const profiler = new MemoryProfiler({ logger });

    expect(profiler.getStatistics().config).toEqual(
      expect.objectContaining({
        maxSnapshots: 100,
        maxOperations: 1000,
        autoSnapshot: true,
        trackPeakMemory: true,
        snapshotInterval: 100,
      })
    );

    profiler.destroy();
  });

  it('tracks peak memory during profiling and records completed operations', () => {
    jest.useFakeTimers();
    global.performance = {
      memory: {
        usedJSHeapSize: 10 * MB,
        totalJSHeapSize: 20 * MB,
      },
    };

    const profiler = createProfiler({ trackPeakMemory: true });

    const opId = 'op-1';
    profiler.startProfiling(opId, 'loadAssets');

    global.performance.memory.usedJSHeapSize = 15 * MB;
    jest.advanceTimersByTime(50);

    global.performance.memory.usedJSHeapSize = 12 * MB;
    const profile = profiler.endProfiling(opId);

    expect(profile).toEqual(
      expect.objectContaining({
        id: opId,
        label: 'loadAssets',
        peakMemory: 15 * MB,
        memoryDelta: expect.any(Number),
      })
    );
    expect(profiler.findMemoryHotspots(1)).toHaveLength(1);
  });

  it('warns when starting a profile for an already active operation', () => {
    const profiler = createProfiler();

    profiler.startProfiling('repeat', 'repeat');
    profiler.startProfiling('repeat', 'repeat');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Operation repeat already being profiled')
    );
  });

  it('warns and returns null when ending a non-existent profile', () => {
    const profiler = createProfiler();

    const result = profiler.endProfiling('missing');

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Operation missing not being profiled')
    );
  });

  it('measures synchronous operations and cleans up on error', () => {
    const profiler = createProfiler();

    getMemoryUsage
      .mockReturnValueOnce(buildMemoryUsage(100 * MB))
      .mockReturnValueOnce(buildMemoryUsage(160 * MB))
      .mockReturnValueOnce(buildMemoryUsage(120 * MB))
      .mockReturnValueOnce(buildMemoryUsage(180 * MB));

    const result = profiler.measureOperation(() => 'value', 'task');
    expect(result).toBe('value');

    expect(profiler.findMemoryHotspots()).toEqual([]);
    expect(profiler.findMemoryHotspots(1)).toEqual([
      expect.objectContaining({
        operation: 'task',
        executionCount: 1,
        totalMemoryIncrease: 60 * MB,
      }),
    ]);

    expect(() =>
      profiler.measureOperation(() => {
        throw new Error('boom');
      }, 'task')
    ).toThrow('boom');

    expect(profiler.getStatistics().activeOperations).toBe(0);
  });

  it('prunes stored operations when exceeding the configured max limit', () => {
    const profiler = createProfiler({ maxOperations: 1 });

    getMemoryUsage
      .mockReturnValueOnce(buildMemoryUsage(50 * MB))
      .mockReturnValueOnce(buildMemoryUsage(60 * MB))
      .mockReturnValueOnce(buildMemoryUsage(70 * MB))
      .mockReturnValueOnce(buildMemoryUsage(90 * MB))
      .mockReturnValueOnce(buildMemoryUsage(40 * MB))
      .mockReturnValueOnce(buildMemoryUsage(45 * MB));

    profiler.measureOperation(() => 'first', 'first');
    profiler.measureOperation(() => 'second', 'second');

    let hotspots = profiler.findMemoryHotspots(1);
    expect(hotspots).toHaveLength(1);
    expect(hotspots[0].operation).toBe('second');

    profiler.startProfiling('idOnly');
    const idProfile = profiler.endProfiling('idOnly');
    expect(idProfile.label).toBe('idOnly');

    hotspots = profiler.findMemoryHotspots(1);
    expect(hotspots[0].operation).toBe('idOnly');
  });

  it('measures async operations and handles rejections', async () => {
    const profiler = createProfiler();

    getMemoryUsage
      .mockReturnValueOnce(buildMemoryUsage(200 * MB))
      .mockReturnValueOnce(buildMemoryUsage(240 * MB))
      .mockReturnValueOnce(buildMemoryUsage(260 * MB))
      .mockReturnValueOnce(buildMemoryUsage(250 * MB));

    await expect(
      profiler.measureAsyncOperation(async () => 'done', 'asyncTask')
    ).resolves.toBe('done');

    await expect(
      profiler.measureAsyncOperation(async () => {
        throw new Error('async failure');
      }, 'asyncTask')
    ).rejects.toThrow('async failure');

    expect(profiler.getStatistics().operations).toBeGreaterThanOrEqual(1);
  });

  it('maintains snapshot history with size limits and compares snapshots', () => {
    const profiler = createProfiler({ maxSnapshots: 5 });
    global.performance = undefined;

    getMemoryUsage
      .mockReturnValueOnce(buildMemoryUsage(50 * MB, 100 * MB))
      .mockReturnValueOnce(buildMemoryUsage(60 * MB, 110 * MB))
      .mockReturnValueOnce(buildMemoryUsage(0, 0))
      .mockReturnValueOnce(buildMemoryUsage(0, 0))
      .mockReturnValueOnce(buildMemoryUsage(90 * MB, 120 * MB))
      .mockReturnValueOnce(buildMemoryUsage(70 * MB, 120 * MB))
      .mockReturnValueOnce(buildMemoryUsage(95 * MB, 130 * MB));

    profiler.takeSnapshot('grow1');
    profiler.takeSnapshot('grow2');
    const growing = profiler.compareSnapshots('grow1', 'grow2');
    expect(growing.analysis.trend).toBe('growing');

    profiler.takeSnapshot('stable1');
    profiler.takeSnapshot('stable2');
    const stable = profiler.compareSnapshots('stable1', 'stable2');
    expect(stable.analysis.trend).toBe('stable');
    expect(stable.analysis.percentChange).toBe(0);

    profiler.takeSnapshot('shrink1');
    profiler.takeSnapshot('shrink2');
    const shrinking = profiler.compareSnapshots('shrink1', 'shrink2');
    expect(shrinking.analysis.trend).toBe('shrinking');

    profiler.takeSnapshot('extra');
    expect(profiler.getStatistics().snapshots).toBe(5);

    const missingComparison = profiler.compareSnapshots('grow1', 'extra');
    expect(missingComparison).toBeNull();
    expect(logger.warn).toHaveBeenLastCalledWith(
      expect.stringContaining('One or both snapshots not found')
    );
  });

  it('falls back to zeroed memory usage when APIs are unavailable', () => {
    const profiler = createProfiler();
    global.performance = undefined;
    getMemoryUsage.mockReturnValue(null);

    const snapshot = profiler.takeSnapshot('empty');

    expect(snapshot).toEqual(
      expect.objectContaining({ heapUsed: 0, heapTotal: 0, external: 0 })
    );
  });

  it('aggregates hotspots and retained objects for reports', () => {
    const profiler = createProfiler();

    getMemoryUsage
      .mockReturnValueOnce(buildMemoryUsage(100 * MB))
      .mockReturnValueOnce(buildMemoryUsage(180 * MB))
      .mockReturnValueOnce(buildMemoryUsage(120 * MB))
      .mockReturnValueOnce(buildMemoryUsage(220 * MB));

    profiler.measureOperation(() => 'first', 'render');
    profiler.measureOperation(() => 'second', 'render');

    profiler.trackObjectAllocation('Widget');
    profiler.trackObjectAllocation('Widget');
    profiler.trackObjectAllocation('Panel');

    const hotspots = profiler.findMemoryHotspots();
    expect(hotspots[0]).toEqual(
      expect.objectContaining({
        operation: 'render',
        executionCount: 2,
      })
    );

    const retained = profiler.analyzeRetainedObjects();
    expect(retained).toEqual(
      expect.objectContaining({
        totalTracked: 3,
        byClass: { Widget: 2, Panel: 1 },
      })
    );

    const report = profiler.generateReport();
    expect(report).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({ totalOperations: 2 }),
        hotspots: expect.any(Array),
        retainedObjects: expect.objectContaining({ totalTracked: 3 }),
      })
    );
    expect(logger.info).toHaveBeenLastCalledWith(
      expect.stringContaining('Profiling report generated'),
      expect.objectContaining({ totalOperations: 2 })
    );
  });

  it('clears all profiling data and destroys the profiler', () => {
    const profiler = createProfiler({ trackPeakMemory: true });

    global.performance = {
      memory: {
        usedJSHeapSize: 5 * MB,
        totalJSHeapSize: 10 * MB,
      },
    };

    jest.useFakeTimers();
    profiler.startProfiling('cleanup', 'cleanup');
    profiler.takeSnapshot('cleanup');
    profiler.trackObjectAllocation('Temp');

    profiler.clear();
    expect(profiler.getStatistics()).toEqual({
      snapshots: 0,
      operations: 0,
      activeOperations: 0,
      trackedObjects: 0,
      config: expect.any(Object),
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('MemoryProfiler data cleared')
    );

    const emptyReport = profiler.generateReport();
    expect(emptyReport.summary.totalOperations).toBe(0);
    expect(emptyReport.hotspots).toEqual([]);

    profiler.destroy();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('MemoryProfiler destroyed')
    );
  });
});
