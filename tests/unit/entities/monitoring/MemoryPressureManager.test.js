import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

const lowStrategyInstances = [];
const criticalStrategyInstances = [];

jest.mock(
  '../../../../src/entities/monitoring/strategies/LowMemoryStrategy.js',
  () => {
    const factory = jest.fn().mockImplementation(() => {
      const instance = {
        execute: jest.fn().mockResolvedValue({
          success: true,
          memoryFreed: 0,
          actionsTaken: [],
          metrics: {},
        }),
        getStatistics: jest.fn().mockReturnValue({ config: { preset: 'low' } }),
        updateConfig: jest.fn(),
        destroy: jest.fn(),
      };
      lowStrategyInstances.push(instance);
      return instance;
    });
    factory.__getInstances = () => lowStrategyInstances;
    factory.__reset = () => {
      factory.mockClear();
      lowStrategyInstances.length = 0;
    };
    return { __esModule: true, default: factory };
  }
);

jest.mock(
  '../../../../src/entities/monitoring/strategies/CriticalMemoryStrategy.js',
  () => {
    const factory = jest.fn().mockImplementation(() => {
      const instance = {
        execute: jest.fn().mockResolvedValue({
          success: true,
          memoryFreed: 0,
          actionsTaken: [],
          metrics: {},
        }),
        getStatistics: jest
          .fn()
          .mockReturnValue({ config: { preset: 'critical' } }),
        updateConfig: jest.fn(),
        destroy: jest.fn(),
      };
      criticalStrategyInstances.push(instance);
      return instance;
    });
    factory.__getInstances = () => criticalStrategyInstances;
    factory.__reset = () => {
      factory.mockClear();
      criticalStrategyInstances.length = 0;
    };
    return { __esModule: true, default: factory };
  }
);

jest.mock('../../../../src/utils/environmentUtils.js', () => {
  const actual = jest.requireActual(
    '../../../../src/utils/environmentUtils.js'
  );
  return {
    ...actual,
    triggerGarbageCollection: jest.fn(),
    getMemoryUsageBytes: jest.fn(),
  };
});

import MemoryPressureManager from '../../../../src/entities/monitoring/MemoryPressureManager.js';
import LowMemoryStrategy from '../../../../src/entities/monitoring/strategies/LowMemoryStrategy.js';
import CriticalMemoryStrategy from '../../../../src/entities/monitoring/strategies/CriticalMemoryStrategy.js';
import {
  triggerGarbageCollection,
  getMemoryUsageBytes,
} from '../../../../src/utils/environmentUtils.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

const createLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

const createEventBus = () => {
  const handlers = new Map();
  return {
    dispatch: jest.fn(),
    subscribe: jest.fn((name, handler) => {
      handlers.set(name, handler);
    }),
    __handlers: handlers,
  };
};

const createMonitor = () => {
  const thresholds = new Map();
  return {
    getCurrentUsage: jest.fn().mockReturnValue({ heapUsed: 1024 }),
    getPressureLevel: jest.fn().mockReturnValue('normal'),
    onThresholdExceeded: jest.fn((level, handler) => {
      thresholds.set(level, handler);
    }),
    __thresholds: thresholds,
  };
};

const createCache = () => ({
  prune: jest.fn(),
  clear: jest.fn(),
  size: jest.fn(),
});

const buildManager = ({
  cache = createCache(),
  config,
  overrides = {},
} = {}) => {
  const logger = createLogger();
  const eventBus = createEventBus();
  const monitor = createMonitor();
  const deps = {
    logger,
    eventBus,
    monitor,
    cache,
    ...overrides,
  };
  const constructorArgs = config === undefined ? [deps] : [deps, config];
  const manager = new MemoryPressureManager(...constructorArgs);
  return { manager, logger, eventBus, monitor, cache: deps.cache };
};

describe('MemoryPressureManager', () => {
  beforeEach(() => {
    LowMemoryStrategy.__reset();
    CriticalMemoryStrategy.__reset();
    jest.clearAllMocks();
    triggerGarbageCollection.mockReset();
    getMemoryUsageBytes.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('initializes default strategies and subscriptions', () => {
    const { manager, eventBus, monitor } = buildManager();

    expect(LowMemoryStrategy).toHaveBeenCalledTimes(1);
    expect(CriticalMemoryStrategy).toHaveBeenCalledTimes(1);
    expect(monitor.onThresholdExceeded).toHaveBeenCalledWith(
      'warning',
      expect.any(Function)
    );
    expect(monitor.onThresholdExceeded).toHaveBeenCalledWith(
      'critical',
      expect.any(Function)
    );
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'MEMORY_PRESSURE_CHANGED',
      expect.any(Function)
    );

    const stats = manager.getStatistics();
    expect(stats.registeredStrategies).toEqual(['warning', 'critical']);
    expect(stats.config.automaticManagement).toBe(true);
  });

  it('applies default configuration values when config argument is omitted', () => {
    const logger = createLogger();
    const eventBus = createEventBus();
    const monitor = createMonitor();
    const cache = createCache();

    const manager = new MemoryPressureManager({
      logger,
      eventBus,
      monitor,
      cache,
    });

    expect(manager.getStatistics().config).toEqual(
      expect.objectContaining({
        automaticManagement: true,
        aggressiveGC: true,
        minTimeBetweenManagement: 30000,
        maxHistorySize: 100,
      })
    );
  });

  it('executes automatic management and throttles repeated triggers', async () => {
    const { manager, monitor, logger } = buildManager();
    const lowStrategy = LowMemoryStrategy.__getInstances()[0];
    const warningHandler = monitor.__thresholds.get('warning');

    lowStrategy.execute.mockResolvedValue({
      success: true,
      memoryFreed: 2048,
      actionsTaken: ['auto'],
      metrics: { run: 1 },
    });

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy
      .mockReturnValueOnce(35000) // first timeSinceLastManagement (beyond throttle window)
      .mockReturnValueOnce(36000) // set last management time
      .mockReturnValueOnce(37000) // record history timestamp
      .mockReturnValueOnce(36010) // second call throttled
      .mockReturnValueOnce(70000) // allow another automatic management cycle
      .mockReturnValueOnce(71000)
      .mockReturnValueOnce(72000);

    manager.enableAutomaticManagement();
    warningHandler({ type: 'heap', value: 0.6 });
    await Promise.resolve();
    await Promise.resolve();

    expect(lowStrategy.execute).toHaveBeenCalledTimes(1);
    expect(manager.getManagementHistory()).toHaveLength(1);

    warningHandler({ type: 'heap', value: 0.7 });
    await Promise.resolve();

    expect(lowStrategy.execute).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Automatic management throttled')
    );

    warningHandler({ type: 'rss', value: 2_621_440 });
    await Promise.resolve();
    await Promise.resolve();

    expect(lowStrategy.execute).toHaveBeenCalledTimes(2);
    expect(manager.getManagementHistory()).toHaveLength(2);
    expect(
      logger.info.mock.calls.some(
        ([, details]) =>
          details &&
          typeof details.value === 'string' &&
          details.value.includes('MB')
      )
    ).toBe(true);
  });

  it('logs errors when automatic management strategy fails', async () => {
    const { manager, monitor, logger } = buildManager();
    const lowStrategy = LowMemoryStrategy.__getInstances()[0];
    const warningHandler = monitor.__thresholds.get('warning');
    const failure = new Error('auto-failure');
    const nowSpy = jest.spyOn(Date, 'now');

    nowSpy.mockReturnValueOnce(35000);
    lowStrategy.execute.mockRejectedValueOnce(failure);

    manager.enableAutomaticManagement();
    warningHandler({ type: 'heap', value: 0.95 });
    await Promise.resolve();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Automatic management failed for level warning:'),
      failure
    );
  });

  it('warns when automatic management lacks a strategy and ignores normal pressure', async () => {
    const { manager, eventBus, logger } = buildManager();
    const changeHandler = eventBus.__handlers.get('MEMORY_PRESSURE_CHANGED');

    manager.enableAutomaticManagement();
    changeHandler({ payload: { newLevel: 'normal' } });
    await Promise.resolve();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Normal pressure, no automatic management needed')
    );

    changeHandler({ payload: { newLevel: 'extreme' } });
    await Promise.resolve();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No strategy registered for level: extreme')
    );
  });

  it('updates pressure handlers without automatic management and exposes current level', () => {
    const { manager, monitor, logger } = buildManager();
    const lowStrategy = LowMemoryStrategy.__getInstances()[0];
    const criticalStrategy = CriticalMemoryStrategy.__getInstances()[0];
    const warningHandler = monitor.__thresholds.get('warning');
    const criticalHandler = monitor.__thresholds.get('critical');

    warningHandler({ type: 'heap', value: 0.42 });

    expect(manager.getCurrentPressureLevel()).toBe('warning');
    expect(lowStrategy.execute).not.toHaveBeenCalled();
    expect(
      logger.info.mock.calls.some(
        ([message, details]) =>
          message.includes('Memory pressure changed to: warning') &&
          details &&
          typeof details.value === 'string' &&
          details.value === '42.0%'
      )
    ).toBe(true);

    criticalHandler({ type: 'rss', value: 6_291_456 });

    expect(manager.getCurrentPressureLevel()).toBe('critical');
    expect(criticalStrategy.execute).not.toHaveBeenCalled();
    expect(
      logger.info.mock.calls.some(
        ([message, details]) =>
          message.includes('Memory pressure changed to: critical') &&
          details &&
          typeof details.value === 'string' &&
          details.value.endsWith('MB')
      )
    ).toBe(true);
  });

  it('validates strategy registration inputs', () => {
    const { manager } = buildManager();

    expect(() =>
      manager.registerStrategy('', { execute: jest.fn() })
    ).toThrow();
    expect(() => manager.registerStrategy('custom', {})).toThrow(
      'Strategy execute function'
    );

    const strategy = {
      execute: jest
        .fn()
        .mockResolvedValue({
          success: true,
          memoryFreed: 0,
          actionsTaken: [],
          metrics: {},
        }),
    };
    manager.registerStrategy('custom', strategy);

    expect(manager.getStatistics().registeredStrategies).toContain('custom');
  });

  it('enables and disables automatic management respecting aggressive mode', async () => {
    const { manager, eventBus, monitor } = buildManager();
    monitor.getPressureLevel.mockReturnValue('critical');
    const criticalStrategy = CriticalMemoryStrategy.__getInstances()[0];
    criticalStrategy.execute.mockResolvedValue({
      success: true,
      memoryFreed: 4096,
      actionsTaken: ['critical'],
      metrics: {},
    });

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy
      .mockReturnValueOnce(35000)
      .mockReturnValueOnce(36000)
      .mockReturnValueOnce(37000);

    manager.enableAutomaticManagement(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'MEMORY_AUTOMATIC_MANAGEMENT_ENABLED',
      payload: { aggressive: true },
    });
    expect(criticalStrategy.execute).toHaveBeenCalledTimes(1);
    expect(manager.getStatistics().config.aggressiveGC).toBe(true);

    manager.disableAutomaticManagement();
    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'MEMORY_AUTOMATIC_MANAGEMENT_DISABLED',
    });
  });

  it('updates strategy configuration when toggling aggressive GC', () => {
    const { manager } = buildManager();
    const lowStrategy = LowMemoryStrategy.__getInstances()[0];
    const criticalStrategy = CriticalMemoryStrategy.__getInstances()[0];
    manager.registerStrategy('custom-no-update', { execute: jest.fn() });

    manager.setAggressiveGC(true);
    expect(lowStrategy.updateConfig).toHaveBeenCalledWith({ forceGC: true });
    expect(criticalStrategy.updateConfig).toHaveBeenCalledWith({
      forceGC: true,
    });

    manager.setAggressiveGC(false);
    expect(lowStrategy.updateConfig).toHaveBeenCalledWith({ forceGC: false });
  });

  it('handles cache pruning success, absence, and failure', async () => {
    const cache = createCache();
    cache.prune
      .mockResolvedValueOnce(5)
      .mockRejectedValueOnce(new Error('prune failed'));
    const { manager, logger, eventBus } = buildManager({ cache });

    await expect(manager.triggerCachePruning('aggressive')).resolves.toBe(5);
    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'MEMORY_CACHE_PRUNED',
      payload: { level: 'aggressive', entriesPruned: 5 },
    });

    await expect(manager.triggerCachePruning('aggressive')).resolves.toBe(0);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Cache pruning failed:'),
      expect.any(Error)
    );

    const { manager: noCacheManager, logger: noCacheLogger } = buildManager({
      overrides: { cache: undefined },
    });
    await expect(noCacheManager.triggerCachePruning()).resolves.toBe(0);
    expect(noCacheLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No cache available for pruning')
    );
  });

  it('forces garbage collection, handles missing GC, and recovers from errors', () => {
    const { manager, eventBus, logger } = buildManager();

    triggerGarbageCollection.mockReturnValueOnce(true);
    getMemoryUsageBytes.mockReturnValueOnce(10_000).mockReturnValueOnce(7_000);

    expect(manager.forceGarbageCollection()).toBe(true);
    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'MEMORY_GC_FORCED',
      payload: { memoryFreed: 3000 },
    });

    triggerGarbageCollection.mockReturnValueOnce(false);
    expect(manager.forceGarbageCollection()).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Garbage collection not available')
    );

    triggerGarbageCollection.mockImplementationOnce(() => {
      throw new Error('gc fail');
    });
    expect(manager.forceGarbageCollection()).toBe(false);
    const gcErrorCall = logger.error.mock.calls.find(([message]) =>
      String(message).includes('Force GC failed:')
    );
    expect(gcErrorCall).toBeDefined();
    expect(gcErrorCall?.[1]).toBeInstanceOf(Error);
  });

  it('releases unused memory and records actions', async () => {
    const cache = createCache();
    cache.prune.mockResolvedValue(3);
    const { manager, eventBus } = buildManager({ cache });
    jest.spyOn(manager, 'forceGarbageCollection').mockReturnValue(true);

    const result = await manager.releaseUnusedMemory();

    expect(result.actionsTaken).toEqual(
      expect.arrayContaining([
        'cache_pruned',
        'resources_released',
        'gc_forced',
      ])
    );
    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'MEMORY_RESOURCE_RELEASE_REQUESTED',
      payload: { level: 'unused', source: 'MemoryPressureManager' },
    });
    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'MEMORY_CACHE_PRUNED',
      payload: { level: 'normal', entriesPruned: 3 },
    });
  });

  it('releases memory without cache pruning when cache is unavailable', async () => {
    const { manager, eventBus, logger } = buildManager({ cache: null });
    jest.spyOn(manager, 'forceGarbageCollection').mockReturnValue(false);

    const result = await manager.releaseUnusedMemory();

    expect(result.actionsTaken).toEqual(['resources_released']);
    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'MEMORY_RESOURCE_RELEASE_REQUESTED',
      payload: { level: 'unused', source: 'MemoryPressureManager' },
    });
  });

  it('skips cache_pruned action when pruning reports zero entries', async () => {
    const cache = createCache();
    cache.prune.mockResolvedValue(0);
    const { manager } = buildManager({ cache });
    jest.spyOn(manager, 'forceGarbageCollection').mockReturnValue(false);

    const result = await manager.releaseUnusedMemory();

    expect(result.actionsTaken).toEqual(['resources_released']);
  });

  it('compacts heap asynchronously and notifies listeners', async () => {
    jest.useFakeTimers();
    const { manager, eventBus } = buildManager();

    const promise = manager.compactHeap();
    jest.advanceTimersByTime(100);
    const result = await promise;

    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'MEMORY_HEAP_COMPACTION_REQUESTED',
      payload: expect.objectContaining({ timestamp: expect.any(Number) }),
    });
    expect(result).toBe(true);
    jest.useRealTimers();
  });

  it('executes current strategy manually and handles missing cases', async () => {
    const { manager, eventBus } = buildManager();
    const criticalStrategy = CriticalMemoryStrategy.__getInstances()[0];
    criticalStrategy.execute.mockResolvedValue({
      success: true,
      memoryFreed: 8192,
      actionsTaken: ['manual'],
      metrics: { manual: true },
    });

    await expect(manager.executeCurrentStrategy()).resolves.toEqual({
      success: true,
      pressureLevel: 'normal',
      actionsTaken: ['none'],
      memoryFreed: 0,
      metrics: {},
    });

    const changeHandler = eventBus.__handlers.get('MEMORY_PRESSURE_CHANGED');
    changeHandler({ payload: { newLevel: 'critical' } });
    await Promise.resolve();

    const result = await manager.executeCurrentStrategy({ origin: 'test' });
    expect(criticalStrategy.execute).toHaveBeenCalledWith({
      origin: 'test',
      manual: true,
      pressureLevel: 'critical',
      currentUsage: expect.any(Object),
    });
    expect(result.actionsTaken).toEqual(['manual']);

    changeHandler({ payload: { newLevel: 'unknown' } });
    await Promise.resolve();
    await expect(manager.executeCurrentStrategy()).rejects.toThrow(
      InvalidArgumentError
    );
  });

  it('exposes statistics, history controls, and destroy lifecycle', async () => {
    const { manager, eventBus } = buildManager({
      config: { maxHistorySize: 2 },
    });
    const criticalStrategy = CriticalMemoryStrategy.__getInstances()[0];
    criticalStrategy.execute.mockResolvedValue({
      success: true,
      memoryFreed: 1024,
      actionsTaken: ['auto'],
      metrics: {},
    });

    const changeHandler = eventBus.__handlers.get('MEMORY_PRESSURE_CHANGED');
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy
      .mockReturnValueOnce(31000)
      .mockReturnValueOnce(32000)
      .mockReturnValueOnce(33000)
      .mockReturnValueOnce(64000)
      .mockReturnValueOnce(65000)
      .mockReturnValueOnce(66000)
      .mockReturnValueOnce(97000)
      .mockReturnValueOnce(98000)
      .mockReturnValueOnce(99000);

    manager.enableAutomaticManagement();
    changeHandler({ payload: { newLevel: 'critical' } });
    await Promise.resolve();
    await Promise.resolve();
    changeHandler({ payload: { newLevel: 'critical' } });
    await Promise.resolve();
    await Promise.resolve();
    changeHandler({ payload: { newLevel: 'critical' } });
    await Promise.resolve();
    await Promise.resolve();

    expect(manager.getManagementHistory()).toHaveLength(2);

    const limitedHistory = manager.getManagementHistory(1);
    expect(limitedHistory).toHaveLength(1);

    manager.clearHistory();
    expect(manager.getManagementHistory()).toEqual([]);

    manager.registerStrategy('ephemeral', {
      execute: jest.fn(),
      instance: {},
      config: {},
    });
    manager.destroy();
    expect(eventBus.dispatch).toHaveBeenCalledWith({
      type: 'MEMORY_AUTOMATIC_MANAGEMENT_DISABLED',
    });
    expect(
      CriticalMemoryStrategy.__getInstances()[0].destroy
    ).toHaveBeenCalled();
    expect(LowMemoryStrategy.__getInstances()[0].destroy).toHaveBeenCalled();
    expect(manager.getStatistics().registeredStrategies).toEqual([]);
  });
});
