/**
 * @file Unit tests for the LowMemoryStrategy class
 * @see src/entities/monitoring/strategies/LowMemoryStrategy.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

jest.mock('../../../../../src/utils/environmentUtils.js', () => ({
  triggerGarbageCollection: jest.fn(),
  getMemoryUsageBytes: jest.fn(),
}));

import LowMemoryStrategy from '../../../../../src/entities/monitoring/strategies/LowMemoryStrategy.js';
import {
  triggerGarbageCollection,
  getMemoryUsageBytes,
} from '../../../../../src/utils/environmentUtils.js';

const advanceTimers = async (ms) => {
  if (typeof jest.advanceTimersByTimeAsync === 'function') {
    await jest.advanceTimersByTimeAsync(ms);
  } else {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  }
};

const createLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

const createEventBus = (dispatcher = jest.fn()) => ({
  dispatch: dispatcher,
});

const createCache = (initialSize = 10) => {
  const state = {
    currentSize: initialSize,
    sizeChecked: false,
    sizeMethod: jest.fn(() => state.currentSize),
  };

  const target = {
    prune: jest.fn(() => {
      const before = state.currentSize;
      state.currentSize = Math.max(0, state.currentSize - 2);
      return { removed: before - state.currentSize };
    }),
    getStats: jest.fn(() => ({ size: state.currentSize })),
  };

  return new Proxy(target, {
    get(obj, prop) {
      if (prop === 'size') {
        if (!state.sizeChecked) {
          state.sizeChecked = true;
          return state.sizeMethod;
        }
        return state.currentSize;
      }
      if (prop === '_state') {
        return state;
      }
      return Reflect.get(obj, prop);
    },
    set(obj, prop, value) {
      if (prop === 'size') {
        state.currentSize = value;
        return true;
      }
      return Reflect.set(obj, prop, value);
    },
  });
};

describe('LowMemoryStrategy', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    triggerGarbageCollection.mockReset();
    getMemoryUsageBytes.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('executes the full strategy and aggregates memory freed from each step', async () => {
    const logger = createLogger();
    const eventBus = createEventBus(jest.fn());
    const cache = createCache(6);

    triggerGarbageCollection.mockReturnValue(true);
    getMemoryUsageBytes
      .mockReturnValueOnce(8_000_000)
      .mockReturnValueOnce(5_000_000);

    const strategy = new LowMemoryStrategy(
      { logger, eventBus, cache },
      { minTimeBetweenExecutions: 0 }
    );

    const executePromise = strategy.execute({ level: 'warning' });
    await advanceTimers(100);
    const result = await executePromise;

    expect(result.success).toBe(true);
    expect(result.actionsTaken).toEqual([
      'cache_pruned',
      'gc_requested',
      'resources_released',
      'memory_compacted',
    ]);
    expect(result.memoryFreed).toBe(2 * 1024 + 3_000_000);
    expect(result.metrics.executionCount).toBe(1);

    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MEMORY_STRATEGY_STARTED' })
    );
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MEMORY_RESOURCE_RELEASE_REQUESTED' })
    );
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MEMORY_COMPACTION_REQUESTED' })
    );
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MEMORY_STRATEGY_COMPLETED' })
    );

    expect(cache.prune).toHaveBeenCalledWith(false);
    expect(triggerGarbageCollection).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'LowMemoryStrategy: Low memory strategy completed',
      expect.objectContaining({ actionsTaken: expect.any(Array) })
    );
  });

  it('throttles executions based on minimum interval and respects re-execution after waiting', async () => {
    const logger = createLogger();
    const eventBus = createEventBus(jest.fn());

    triggerGarbageCollection.mockReturnValue(false);
    getMemoryUsageBytes.mockReturnValue(4_000_000);

    const strategy = new LowMemoryStrategy(
      { logger, eventBus },
      {
        minTimeBetweenExecutions: 1000,
        enableCachePruning: false,
        enableEventNotification: false,
      }
    );

    const firstRun = strategy.execute();
    await advanceTimers(100);
    const firstResult = await firstRun;
    expect(firstResult.success).toBe(true);
    expect(firstResult.actionsTaken).toEqual([
      'resources_released',
      'memory_compacted',
    ]);

    const throttledResult = await strategy.execute();
    expect(throttledResult.success).toBe(false);
    expect(throttledResult.actionsTaken).toEqual(['throttled']);

    jest.setSystemTime(new Date(Date.now() + 1000));

    const thirdRun = strategy.execute();
    await advanceTimers(100);
    const thirdResult = await thirdRun;
    expect(thirdResult.success).toBe(true);
    expect(thirdResult.actionsTaken).toContain('resources_released');
  });

  it('handles cache pruning and GC errors gracefully without stopping the strategy', async () => {
    const logger = createLogger();
    const eventBus = createEventBus(jest.fn());
    const cache = createCache(4);
    cache.prune.mockImplementation(() => {
      throw new Error('prune failure');
    });

    triggerGarbageCollection.mockReturnValue(true);
    getMemoryUsageBytes.mockImplementationOnce(() => {
      throw new Error('usage failure');
    });

    const strategy = new LowMemoryStrategy(
      { logger, eventBus, cache },
      { minTimeBetweenExecutions: 0 }
    );

    const promise = strategy.execute();
    await advanceTimers(100);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.actionsTaken).toEqual([
      'resources_released',
      'memory_compacted',
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      'LowMemoryStrategy: Cache pruning failed:',
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      'LowMemoryStrategy: GC request failed:',
      expect.any(Error)
    );
  });

  it('continues execution when resource release request fails', async () => {
    const logger = createLogger();
    const dispatchMock = jest.fn((event) => {
      if (event.type === 'MEMORY_RESOURCE_RELEASE_REQUESTED') {
        throw new Error('release failed');
      }
    });
    const eventBus = createEventBus(dispatchMock);
    const cache = createCache(5);

    triggerGarbageCollection.mockReturnValue(false);
    getMemoryUsageBytes.mockReturnValue(0);

    const strategy = new LowMemoryStrategy(
      { logger, eventBus, cache },
      { minTimeBetweenExecutions: 0 }
    );

    const execPromise = strategy.execute();
    await advanceTimers(100);
    const result = await execPromise;

    expect(result.success).toBe(true);
    expect(result.actionsTaken).toEqual(['cache_pruned', 'memory_compacted']);
    expect(logger.error).toHaveBeenCalledWith(
      'LowMemoryStrategy: Resource release request failed:',
      expect.any(Error)
    );
  });

  it('handles memory compaction failures without aborting the strategy', async () => {
    const logger = createLogger();
    const dispatchMock = jest.fn((event) => {
      if (event.type === 'MEMORY_COMPACTION_REQUESTED') {
        throw new Error('compaction failed');
      }
    });
    const eventBus = createEventBus(dispatchMock);
    const cache = createCache(5);

    triggerGarbageCollection.mockReturnValue(false);
    getMemoryUsageBytes.mockReturnValue(0);

    const strategy = new LowMemoryStrategy(
      { logger, eventBus, cache },
      { minTimeBetweenExecutions: 0 }
    );

    const execPromise = strategy.execute();
    await advanceTimers(100);
    const result = await execPromise;

    expect(result.success).toBe(true);
    expect(result.actionsTaken).toEqual(['cache_pruned', 'resources_released']);
    expect(logger.error).toHaveBeenCalledWith(
      'LowMemoryStrategy: Memory compaction failed:',
      expect.any(Error)
    );
  });

  it('dispatches failure events when a recovery step throws', async () => {
    const logger = createLogger();
    const eventBus = createEventBus(
      jest.fn((event) => {
        if (event.type === 'MEMORY_STRATEGY_COMPLETED') {
          throw new Error('dispatch failure');
        }
      })
    );

    triggerGarbageCollection.mockReturnValue(true);
    getMemoryUsageBytes
      .mockReturnValueOnce(6_000_000)
      .mockReturnValueOnce(5_500_000);

    const strategy = new LowMemoryStrategy(
      { logger, eventBus },
      { enableCachePruning: false, minTimeBetweenExecutions: 0 }
    );

    const execPromise = strategy.execute();
    await advanceTimers(100);
    const result = await execPromise;

    expect(result.success).toBe(false);
    expect(result.actionsTaken).toEqual([
      'gc_requested',
      'resources_released',
      'memory_compacted',
    ]);
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MEMORY_STRATEGY_FAILED' })
    );
  });

  it('exposes statistics and resets internal state', async () => {
    const logger = createLogger();
    const eventBus = createEventBus(jest.fn());

    triggerGarbageCollection.mockReturnValue(false);
    getMemoryUsageBytes.mockReturnValue(0);

    const strategy = new LowMemoryStrategy(
      { logger, eventBus },
      { cachePrunePercent: 0.35, minTimeBetweenExecutions: 0 }
    );

    const execPromise = strategy.execute();
    await advanceTimers(100);
    await execPromise;

    const stats = strategy.getStatistics();
    expect(stats.executionCount).toBe(1);
    expect(stats.config.cachePrunePercent).toBe(0.35);

    stats.config.cachePrunePercent = 0.9;
    const freshStats = strategy.getStatistics();
    expect(freshStats.config.cachePrunePercent).toBe(0.35);

    strategy.reset();
    expect(strategy.getStatistics().executionCount).toBe(0);

    strategy.destroy();
    expect(logger.info).toHaveBeenCalledWith(
      'LowMemoryStrategy: LowMemoryStrategy destroyed'
    );
    expect(strategy.getStatistics().executionCount).toBe(0);
  });
});
