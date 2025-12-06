/**
 * @file Unit tests for the CriticalMemoryStrategy class.
 * @see src/entities/monitoring/strategies/CriticalMemoryStrategy.js
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
  getMemoryUsagePercent: jest.fn(),
}));

import CriticalMemoryStrategy from '../../../../../src/entities/monitoring/strategies/CriticalMemoryStrategy.js';
import {
  triggerGarbageCollection,
  getMemoryUsageBytes,
  getMemoryUsagePercent,
} from '../../../../../src/utils/environmentUtils.js';

const advanceTimers = async (ms = 0) => {
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

const createEventBus = (implementation = jest.fn()) => ({
  dispatch: implementation,
});

const createCache = (initialSize = 5) => {
  const state = {
    currentSize: initialSize,
    validationAccessCount: 0,
  };

  const cache = {
    clear: jest.fn(() => {
      state.currentSize = 0;
    }),
    prune: jest.fn(),
  };

  const sizeFn = jest.fn(() => state.currentSize);

  return new Proxy(cache, {
    get(target, prop) {
      if (prop === 'size') {
        if (state.validationAccessCount === 0) {
          state.validationAccessCount += 1;
          return sizeFn;
        }
        return state.currentSize;
      }
      if (prop === '_state') {
        return state;
      }
      if (prop === '_sizeFn') {
        return sizeFn;
      }
      return Reflect.get(target, prop);
    },
    set(target, prop, value) {
      if (prop === 'size') {
        state.currentSize = value;
        return true;
      }
      return Reflect.set(target, prop, value);
    },
  });
};

describe('CriticalMemoryStrategy', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes with defaults and executes the full emergency recovery workflow', async () => {
    const logger = createLogger();
    const eventBus = createEventBus(jest.fn());
    const cache = createCache(4);

    getMemoryUsagePercent
      .mockReturnValueOnce(0.97)
      .mockReturnValueOnce(0.96)
      .mockReturnValueOnce(0.5);

    getMemoryUsageBytes
      .mockReturnValueOnce(500_000_000)
      .mockReturnValueOnce(200_000_000);

    triggerGarbageCollection.mockReturnValue(true);

    const strategy = new CriticalMemoryStrategy(
      { logger, eventBus, cache },
      { minTimeBetweenExecutions: 0 }
    );

    const resultPromise = strategy.execute({ level: 'critical' });
    await advanceTimers(200);
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.actionsTaken).toEqual([
      'emergency_mode_activated',
      'operations_stopped',
      'caches_cleared',
      'aggressive_gc',
      'all_resources_released',
      'emergency_dump',
      'emergency_mode_deactivated',
    ]);
    expect(result.memoryFreed).toBe(300_008_192);
    expect(result.metrics.executionCount).toBe(1);
    expect(result.metrics.recovered).toBe(true);

    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MEMORY_STRATEGY_STARTED' })
    );
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MEMORY_CRITICAL_STOP_OPERATIONS' })
    );
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MEMORY_CRITICAL_CLEAR_ALL_CACHES' })
    );
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MEMORY_CRITICAL_RELEASE_ALL' })
    );
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MEMORY_EMERGENCY_DUMP' })
    );
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'MEMORY_STRATEGY_COMPLETED',
        payload: expect.objectContaining({ success: true }),
      })
    );

    expect(triggerGarbageCollection).toHaveBeenCalledTimes(3);
    expect(cache.clear).toHaveBeenCalled();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Executing critical memory pressure strategy'),
      expect.objectContaining({ emergencyMode: true })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Critical memory strategy completed'),
      expect.objectContaining({ recovered: true })
    );

    const stats = strategy.getStatistics();
    expect(stats.executionCount).toBe(1);
    expect(stats.emergencyMode).toBe(false);
    expect(stats.config.clearCache).toBe(true);

    expect(strategy.isEmergencyMode()).toBe(false);

    strategy.reset();
    expect(strategy.getStatistics().executionCount).toBe(0);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('CriticalMemoryStrategy reset')
    );

    strategy.destroy();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('CriticalMemoryStrategy destroyed')
    );
  });

  it('throttles execution when not in emergency mode', async () => {
    const logger = createLogger();
    const eventBus = createEventBus(jest.fn());

    getMemoryUsagePercent.mockReturnValue(0.4);
    triggerGarbageCollection.mockReturnValue(false);

    const strategy = new CriticalMemoryStrategy(
      { logger, eventBus },
      { minTimeBetweenExecutions: 1_000, clearCache: false, forceGC: false }
    );

    const firstRunPromise = strategy.execute();
    await advanceTimers(200);
    const firstResult = await firstRunPromise;

    expect(firstResult.success).toBe(true);
    expect(firstResult.actionsTaken).toEqual([
      'operations_stopped',
      'all_resources_released',
    ]);

    const throttled = await strategy.execute();
    expect(throttled.success).toBe(false);
    expect(throttled.actionsTaken).toEqual(['throttled']);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Strategy execution throttled (non-emergency)')
    );
  });

  it('uses default configuration values when no overrides are provided', () => {
    const logger = createLogger();
    const eventBus = createEventBus(jest.fn());

    const strategy = new CriticalMemoryStrategy({ logger, eventBus });
    const stats = strategy.getStatistics();

    expect(stats.config).toMatchObject({
      clearCache: true,
      forceGC: true,
      minTimeBetweenExecutions: 10000,
      emergencyThreshold: 0.95,
      enableEmergencyMode: true,
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('CriticalMemoryStrategy initialized'),
      expect.objectContaining({ clearCache: true })
    );
  });

  it('bypasses throttling while emergency mode is active', async () => {
    const logger = createLogger();
    const eventBus = createEventBus(jest.fn());

    getMemoryUsagePercent
      .mockReturnValueOnce(0.98)
      .mockReturnValueOnce(0.97)
      .mockReturnValueOnce(0.97)
      .mockReturnValueOnce(0.96)
      .mockReturnValueOnce(0.95)
      .mockReturnValueOnce(0.9);

    const strategy = new CriticalMemoryStrategy(
      { logger, eventBus },
      { minTimeBetweenExecutions: 60_000, clearCache: false, forceGC: false }
    );

    const firstRun = strategy.execute();
    await advanceTimers(200);
    await firstRun;

    expect(strategy.isEmergencyMode()).toBe(true);

    const secondRunPromise = strategy.execute();
    await advanceTimers(200);
    const secondResult = await secondRunPromise;

    expect(secondResult.success).toBe(true);
    expect(secondResult.actionsTaken).toEqual([
      'emergency_mode_activated',
      'operations_stopped',
      'all_resources_released',
      'emergency_dump',
      'emergency_mode_deactivated',
    ]);
    expect(logger.debug).toHaveBeenCalledTimes(0);
  });

  it('returns without aggressive GC when garbage collection is unavailable', async () => {
    const logger = createLogger();
    const eventBus = createEventBus(jest.fn());

    getMemoryUsagePercent.mockReturnValue(0.6);
    getMemoryUsageBytes.mockReturnValue(4_000_000);
    triggerGarbageCollection.mockReturnValue(false);

    const strategy = new CriticalMemoryStrategy(
      { logger, eventBus },
      { minTimeBetweenExecutions: 0, clearCache: false, forceGC: true }
    );

    const resultPromise = strategy.execute({ scenario: 'gc-unavailable' });
    await advanceTimers(200);
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.actionsTaken).toEqual([
      'operations_stopped',
      'all_resources_released',
    ]);
    expect(triggerGarbageCollection).toHaveBeenCalledTimes(3);
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Aggressive garbage collection completed'),
      expect.anything()
    );
  });

  it('dispatches failure event when an error happens during completion', async () => {
    const logger = createLogger();
    const dispatch = jest.fn((event) => {
      if (event.type === 'MEMORY_STRATEGY_COMPLETED') {
        throw new Error('completion failed');
      }
    });
    const eventBus = createEventBus(dispatch);

    getMemoryUsagePercent
      .mockReturnValueOnce(0.96)
      .mockReturnValueOnce(0.95)
      .mockReturnValueOnce(0.96);

    const strategy = new CriticalMemoryStrategy(
      { logger, eventBus },
      { minTimeBetweenExecutions: 0, clearCache: false, forceGC: false }
    );

    const resultPromise = strategy.execute({ reason: 'test-failure' });
    await advanceTimers(200);
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.metrics.error).toBe('completion failed');
    expect(eventBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MEMORY_STRATEGY_FAILED' })
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Critical memory strategy failed'),
      expect.any(Error)
    );
  });

  it('continues execution when individual steps fail', async () => {
    const logger = createLogger();
    const dispatch = jest.fn((event) => {
      if (event.type === 'MEMORY_CRITICAL_STOP_OPERATIONS') {
        throw new Error('stop failure');
      }
      if (event.type === 'MEMORY_CRITICAL_RELEASE_ALL') {
        throw new Error('release failure');
      }
      if (event.type === 'MEMORY_EMERGENCY_DUMP') {
        throw new Error('dump failure');
      }
    });
    const eventBus = createEventBus(dispatch);
    const cache = createCache(3);
    cache.clear.mockImplementation(() => {
      throw new Error('clear failure');
    });

    getMemoryUsagePercent
      .mockReturnValueOnce(0.97)
      .mockReturnValueOnce(0.96)
      .mockReturnValueOnce(0.92);

    getMemoryUsageBytes.mockImplementation(() => {
      throw new Error('usage failure');
    });

    triggerGarbageCollection.mockReturnValue(true);

    const strategy = new CriticalMemoryStrategy(
      { logger, eventBus, cache },
      { minTimeBetweenExecutions: 0 }
    );

    const resultPromise = strategy.execute({ stage: 'recovery' });
    await advanceTimers(200);
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.actionsTaken).toEqual([
      'emergency_mode_activated',
      'emergency_mode_deactivated',
    ]);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to stop operations'),
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Cache clearing failed'),
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Aggressive GC failed'),
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Resource release failed'),
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Emergency dump failed'),
      expect.any(Error)
    );
  });
});
