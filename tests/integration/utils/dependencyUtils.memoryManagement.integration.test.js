import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import MemoryMonitor from '../../../src/entities/monitoring/MemoryMonitor.js';
import MemoryPressureManager from '../../../src/entities/monitoring/MemoryPressureManager.js';
import MemoryProfiler from '../../../src/entities/monitoring/MemoryProfiler.js';
import TargetManager from '../../../src/entities/multiTarget/targetManager.js';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import * as environmentUtils from '../../../src/utils/environmentUtils.js';

class RecordingLogger {
  constructor() {
    this.entries = { debug: [], info: [], warn: [], error: [] };
  }

  debug(message, metadata) {
    this.entries.debug.push({ message, metadata });
  }

  info(message, metadata) {
    this.entries.info.push({ message, metadata });
  }

  warn(message, metadata) {
    this.entries.warn.push({ message, metadata });
  }

  error(message, metadata) {
    this.entries.error.push({ message, metadata });
  }
}

class RecordingEventBus {
  constructor() {
    this.events = [];
    this.subscriptions = new Map();
  }

  dispatch(event) {
    this.events.push(event);
    const handlers = this.subscriptions.get(event.type) ?? [];
    handlers.forEach((handler) => handler(event));
    return true;
  }

  subscribe(eventType, handler) {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }
    const handlers = this.subscriptions.get(eventType);
    handlers.push(handler);
    return () => {
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    };
  }
}

class RecordingCache {
  constructor(initialSize = 0) {
    this.sizeValue = initialSize;
    this.prunedLevels = [];
  }

  prune(level = 'normal') {
    const label =
      level === true ? 'aggressive' : level === false ? 'normal' : level;
    this.prunedLevels.push(label);
    return 0;
  }

  clear() {
    this.sizeValue = 0;
    return { cleared: true };
  }

  size() {
    return this.sizeValue;
  }

  getStats() {
    return {
      size: this.sizeValue,
      entries: this.sizeValue,
    };
  }
}

const advanceAndFlush = async (ms) => {
  jest.advanceTimersByTime(ms);
  await Promise.resolve();
  await Promise.resolve();
};

describe('dependencyUtils integration across memory monitoring stack', () => {
  let logger;
  let eventBus;
  let cache;
  let usageSpy;
  let usageBytesSpy;
  let gcSpy;
  let usagePercentSpy;

  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
    logger = new RecordingLogger();
    eventBus = new RecordingEventBus();
    cache = new RecordingCache();

    const usageSequence = [
      {
        heapUsed: 150 * 1024 * 1024,
        heapTotal: 400 * 1024 * 1024,
        rss: 400 * 1024 * 1024,
      },
      {
        heapUsed: 320 * 1024 * 1024,
        heapTotal: 400 * 1024 * 1024,
        rss: 700 * 1024 * 1024,
      },
      {
        heapUsed: 360 * 1024 * 1024,
        heapTotal: 400 * 1024 * 1024,
        rss: 950 * 1024 * 1024,
      },
      {
        heapUsed: 200 * 1024 * 1024,
        heapTotal: 400 * 1024 * 1024,
        rss: 600 * 1024 * 1024,
      },
    ];
    let callCount = 0;
    usageSpy = jest
      .spyOn(environmentUtils, 'getMemoryUsage')
      .mockImplementation(
        () => usageSequence[Math.min(callCount++, usageSequence.length - 1)]
      );

    usageBytesSpy = jest
      .spyOn(environmentUtils, 'getMemoryUsageBytes')
      .mockReturnValue(400 * 1024 * 1024);

    gcSpy = jest
      .spyOn(environmentUtils, 'triggerGarbageCollection')
      .mockReturnValue(true);

    usagePercentSpy = jest
      .spyOn(environmentUtils, 'getMemoryUsagePercent')
      .mockReturnValue(0.8);
  });

  afterEach(() => {
    jest.useRealTimers();
    usageSpy.mockRestore();
    usageBytesSpy.mockRestore();
    gcSpy.mockRestore();
    usagePercentSpy.mockRestore();
  });

  it('escalates memory pressure and coordinates automatic management', async () => {
    const monitor = new MemoryMonitor({
      logger,
      eventBus,
      samplingInterval: 10,
      leakDetectionConfig: {
        enabled: false,
      },
    });

    const pressureManager = new MemoryPressureManager({
      logger,
      eventBus,
      monitor,
      cache,
    });

    const warningHandler = jest.fn();
    const criticalHandler = jest.fn();

    monitor.onThresholdExceeded('warning', warningHandler);
    monitor.onThresholdExceeded('critical', criticalHandler);

    pressureManager.enableAutomaticManagement(true);

    monitor.start();
    await advanceAndFlush(50);
    monitor.stop();

    expect(warningHandler).toHaveBeenCalledTimes(1);
    expect(criticalHandler).toHaveBeenCalledTimes(1);
    const pressureEvents = eventBus.events.filter(
      (event) => event.type === 'MEMORY_PRESSURE_CHANGED'
    );
    expect(pressureEvents.length).toBeGreaterThan(0);
    expect(
      pressureEvents.some((event) => event.payload.newLevel === 'critical')
    ).toBe(true);

    const pruningResult =
      await pressureManager.triggerCachePruning('aggressive');
    expect(pruningResult).toBe(0);
    expect(cache.prunedLevels).toContain('aggressive');

    const targetManager = new TargetManager({ logger });
    expect(() => targetManager.addTarget('   ', 'entity-x')).toThrow(
      InvalidArgumentError
    );
    expect(() => targetManager.addTarget('secondary', '   ')).toThrow(
      InvalidArgumentError
    );
    expect(() => targetManager.setTargets(null)).toThrow(
      'Targets object is required'
    );
  });

  it('profiles synchronous and asynchronous operations tied to the pressure manager', async () => {
    const monitor = new MemoryMonitor({
      logger,
      eventBus,
      samplingInterval: 20,
      leakDetectionConfig: {
        enabled: false,
      },
    });

    const pressureManager = new MemoryPressureManager({
      logger,
      eventBus,
      monitor,
      cache,
    });

    const profiler = new MemoryProfiler(
      {
        logger,
      },
      {
        snapshotInterval: 5,
        trackPeakMemory: true,
      }
    );

    const result = profiler.measureOperation(() => {
      pressureManager.registerStrategy('custom', {
        level: 'custom',
        execute: () => ({ level: 'custom', freed: 0 }),
      });
      return 'registered';
    }, 'register_strategy');

    expect(result).toBe('registered');

    await profiler.measureAsyncOperation(async () => {
      await pressureManager.triggerCachePruning('normal');
      return true;
    }, 'async_pruning');

    profiler.trackObjectAllocation('CacheEntry');
    expect(() => profiler.measureOperation(null, 'missing')).toThrow(
      /Operation function/
    );

    profiler.destroy();
  });
});

describe('dependencyUtils integration through WorldInitializer validations', () => {
  let logger;

  beforeEach(() => {
    logger = new RecordingLogger();
  });

  const createValidWorldInitializerDeps = () => {
    const entityManager = {
      createEntityInstance: () => ({ id: 'entity-1' }),
      hasBatchSupport: () => true,
    };

    const worldContext = { initialized: true };

    const gameDataRepository = {
      getWorld: () => ({ id: 'world-1', entities: [] }),
      getEntityInstanceDefinition: () => ({ id: 'entity-1' }),
      get: () => ({}),
    };

    const validatedEventDispatcher = {
      dispatch: () => true,
    };

    const eventDispatchService = {
      dispatchWithLogging: () => {},
    };

    const scopeRegistry = {
      initialize: () => true,
    };

    return {
      entityManager,
      worldContext,
      gameDataRepository,
      validatedEventDispatcher,
      eventDispatchService,
      logger: {
        debug: logger.debug.bind(logger),
      },
      scopeRegistry,
      config: {
        isFeatureEnabled: () => true,
        getValue: () => 5,
      },
    };
  };

  it('constructs successfully with fully implemented dependencies', () => {
    const deps = createValidWorldInitializerDeps();
    const initializer = new WorldInitializer(deps);
    expect(initializer.getWorldContext()).toBe(deps.worldContext);
  });

  it('throws when required repository methods are missing', () => {
    const deps = createValidWorldInitializerDeps();
    delete deps.gameDataRepository.get;

    expect(() => new WorldInitializer(deps)).toThrow(/IGameDataRepository/);
  });

  it('throws when entity manager lacks required function', () => {
    const deps = createValidWorldInitializerDeps();
    delete deps.entityManager.createEntityInstance;

    expect(() => new WorldInitializer(deps)).toThrow(/IEntityManager/);
  });

  it('throws when world context is absent', () => {
    const deps = createValidWorldInitializerDeps();
    deps.worldContext = null;

    expect(() => new WorldInitializer(deps)).toThrow(/WorldContext/);
  });
});
