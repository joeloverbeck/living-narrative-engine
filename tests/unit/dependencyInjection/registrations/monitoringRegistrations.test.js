import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { getEnvironmentMode } from '../../../../src/utils/environmentUtils.js';

const monitoringMocks = {
  shouldProvideMemoryReporter: true,
  environmentMode: 'development',
};

jest.mock(
  '../../../../src/entities/monitoring/MonitoringCoordinator.js',
  () => {
    monitoringMocks.mockMonitoringCoordinatorInject = jest.fn();
    monitoringMocks.mockMonitoringCoordinator = jest
      .fn()
      .mockImplementation(() => ({
        injectErrorHandlers: monitoringMocks.mockMonitoringCoordinatorInject,
      }));
    return {
      __esModule: true,
      default: monitoringMocks.mockMonitoringCoordinator,
    };
  }
);
jest.mock('../../../../src/entities/monitoring/MemoryMonitor.js', () => {
  monitoringMocks.mockMemoryMonitor = jest.fn();
  return { __esModule: true, default: monitoringMocks.mockMemoryMonitor };
});
jest.mock('../../../../src/entities/monitoring/MemoryAnalyzer.js', () => {
  monitoringMocks.mockMemoryAnalyzer = jest.fn();
  return { __esModule: true, default: monitoringMocks.mockMemoryAnalyzer };
});
jest.mock('../../../../src/entities/monitoring/MemoryProfiler.js', () => {
  monitoringMocks.mockMemoryProfiler = jest.fn();
  return { __esModule: true, default: monitoringMocks.mockMemoryProfiler };
});
jest.mock(
  '../../../../src/entities/monitoring/MemoryPressureManager.js',
  () => {
    monitoringMocks.mockMemoryPressureManager = jest.fn();
    return {
      __esModule: true,
      default: monitoringMocks.mockMemoryPressureManager,
    };
  }
);
jest.mock('../../../../src/entities/monitoring/MemoryReporter.js', () => {
  if (monitoringMocks.shouldProvideMemoryReporter === false) {
    monitoringMocks.mockMemoryReporter = undefined;
    return { __esModule: true, default: undefined };
  }

  monitoringMocks.mockMemoryReporter = jest.fn();
  return { __esModule: true, default: monitoringMocks.mockMemoryReporter };
});
jest.mock(
  '../../../../src/entities/monitoring/strategies/LowMemoryStrategy.js',
  () => {
    monitoringMocks.mockLowMemoryStrategy = jest.fn();
    return { __esModule: true, default: monitoringMocks.mockLowMemoryStrategy };
  }
);
jest.mock(
  '../../../../src/entities/monitoring/strategies/CriticalMemoryStrategy.js',
  () => {
    monitoringMocks.mockCriticalMemoryStrategy = jest.fn();
    return {
      __esModule: true,
      default: monitoringMocks.mockCriticalMemoryStrategy,
    };
  }
);
jest.mock('../../../../src/errors/CentralErrorHandler.js', () => {
  monitoringMocks.mockCentralErrorHandler = jest.fn();
  return { __esModule: true, default: monitoringMocks.mockCentralErrorHandler };
});
jest.mock('../../../../src/errors/RecoveryStrategyManager.js', () => {
  monitoringMocks.mockRecoveryStrategyManager = jest.fn();
  return {
    __esModule: true,
    default: monitoringMocks.mockRecoveryStrategyManager,
  };
});
jest.mock('../../../../src/errors/ErrorReporter.js', () => {
  monitoringMocks.mockErrorReporter = jest.fn();
  return { __esModule: true, default: monitoringMocks.mockErrorReporter };
});

jest.mock('../../../../src/utils/environmentUtils.js', () => ({
  getEnvironmentMode: jest.fn(() => monitoringMocks.environmentMode),
}));

/**
 * Creates a lightweight mock of the DI container used by the registrar helpers.
 * It stores registrations and produces singleton instances when resolved.
 *
 * @param {Map<any, any>} [initialEntries]
 * @returns {{register: jest.Mock, resolve: jest.Mock, isRegistered: jest.Mock, __registrations: Map, __instances: Map}}
 */
function createMockContainer(initialEntries = new Map()) {
  const registrations = new Map();
  const instances = new Map(initialEntries);

  const container = {};

  container.register = jest.fn((token, factoryOrValue, options = {}) => {
    registrations.set(token, { factoryOrValue, options });
  });

  container.resolve = jest.fn((token) => {
    if (instances.has(token)) {
      return instances.get(token);
    }

    if (!registrations.has(token)) {
      throw new Error(`Token not registered: ${String(token)}`);
    }

    const { factoryOrValue, options } = registrations.get(token);
    let value;

    if (options?.isInstance) {
      value = factoryOrValue;
    } else if (typeof factoryOrValue === 'function') {
      value = factoryOrValue(container);
    } else {
      value = factoryOrValue;
    }

    if (options?.lifecycle !== 'transient') {
      instances.set(token, value);
    }

    return value;
  });

  container.isRegistered = jest.fn(
    (token) => instances.has(token) || registrations.has(token)
  );

  container.__registrations = registrations;
  container.__instances = instances;

  return container;
}

describe('registerMemoryMonitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    monitoringMocks.shouldProvideMemoryReporter = true;
    monitoringMocks.environmentMode = 'development';
  });

  /**
   *
   * @param environment
   */
  async function loadRegisterMemoryMonitoring(environment = 'development') {
    monitoringMocks.environmentMode = environment;

    let registerMemoryMonitoring;
    let tokens;

    await jest.isolateModulesAsync(async () => {
      const tokensModule = await import(
        '../../../../src/dependencyInjection/tokens.js'
      );
      const module = await import(
        '../../../../src/dependencyInjection/registrations/monitoringRegistrations.js'
      );

      registerMemoryMonitoring = module.default;
      tokens = tokensModule.tokens;
    });

    return {
      registerMemoryMonitoring,
      tokens,
    };
  }

  it('registers monitoring services and performs deferred injection', async () => {
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const eventBus = { emit: jest.fn() };
    const unifiedCache = { prune: jest.fn() };

    const { registerMemoryMonitoring, tokens } =
      await loadRegisterMemoryMonitoring('development');

    const container = createMockContainer(
      new Map([
        [tokens.ILogger, logger],
        [tokens.IEventBus, eventBus],
        [tokens.IUnifiedCache, unifiedCache],
      ])
    );

    registerMemoryMonitoring(container);

    const errorConfig = container.resolve(tokens.IErrorReportingConfig);
    expect(errorConfig).toMatchObject({
      enabled: true,
      batchSize: 50,
      flushInterval: 30000,
    });

    const memoryConfig = container.resolve(tokens.IMemoryMonitoringConfig);
    expect(memoryConfig).toMatchObject({
      enabled: true,
      sampling: expect.objectContaining({ interval: 5000, historySize: 1000 }),
      automaticResponse: expect.objectContaining({ enabled: true }),
    });

    expect(monitoringMocks.mockMemoryMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        logger,
        eventBus,
        enabled: true,
        heapWarning: memoryConfig.thresholds.heap.warning,
        rssCritical: memoryConfig.thresholds.rss.critical,
        leakDetectionConfig: memoryConfig.leakDetection,
      })
    );

    expect(monitoringMocks.mockMemoryAnalyzer).toHaveBeenCalledWith(
      expect.objectContaining({ logger })
    );
    expect(monitoringMocks.mockMemoryProfiler).toHaveBeenCalledWith(
      expect.objectContaining({ logger })
    );

    container.resolve(tokens.ILowMemoryStrategy);
    container.resolve(tokens.ICriticalMemoryStrategy);

    expect(monitoringMocks.mockLowMemoryStrategy).toHaveBeenCalledWith(
      expect.objectContaining({ cache: unifiedCache })
    );
    expect(monitoringMocks.mockCriticalMemoryStrategy).toHaveBeenCalledWith(
      expect.objectContaining({ cache: unifiedCache })
    );

    expect(monitoringMocks.mockMemoryPressureManager).toHaveBeenCalledWith(
      expect.objectContaining({
        monitor: expect.anything(),
        cache: unifiedCache,
      }),
      expect.objectContaining({
        automaticManagement: true,
        aggressiveGC: true,
      })
    );

    expect(monitoringMocks.mockErrorReporter).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        endpoint: null,
        batchSize: 50,
      })
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'Memory Monitoring Registration: starting…'
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `Registered ${String(tokens.IMemoryMonitor)}.`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Memory Monitoring Registration: completed.'
    );

    expect(
      monitoringMocks.mockMonitoringCoordinatorInject
    ).toHaveBeenCalledTimes(1);
    const [
      centralErrorHandlerArg,
      recoveryStrategyManagerArg,
      errorReporterArg,
    ] = monitoringMocks.mockMonitoringCoordinatorInject.mock.calls[0];

    expect(monitoringMocks.mockCentralErrorHandler.mock.instances[0]).toBe(
      centralErrorHandlerArg
    );
    expect(monitoringMocks.mockRecoveryStrategyManager.mock.instances[0]).toBe(
      recoveryStrategyManagerArg
    );
    expect(monitoringMocks.mockErrorReporter.mock.instances[0]).toBe(
      errorReporterArg
    );

    const coordinatorArgs =
      monitoringMocks.mockMonitoringCoordinator.mock.calls[0][0];
    expect(coordinatorArgs.memoryMonitor).toBe(
      monitoringMocks.mockMemoryMonitor.mock.instances[0]
    );
    expect(coordinatorArgs.memoryPressureManager).toBe(
      monitoringMocks.mockMemoryPressureManager.mock.instances[0]
    );
    expect(monitoringMocks.mockMemoryReporter).toHaveBeenCalledWith(
      expect.objectContaining({
        monitor: monitoringMocks.mockMemoryMonitor.mock.instances[0],
        analyzer: monitoringMocks.mockMemoryAnalyzer.mock.instances[0],
        profiler: monitoringMocks.mockMemoryProfiler.mock.instances[0],
        pressureManager:
          monitoringMocks.mockMemoryPressureManager.mock.instances[0],
      })
    );
  });

  it('skips memory reporter registration when the module is unavailable', async () => {
    monitoringMocks.shouldProvideMemoryReporter = false;

    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const eventBus = { emit: jest.fn() };

    const { registerMemoryMonitoring, tokens } =
      await loadRegisterMemoryMonitoring('development');

    const container = createMockContainer(
      new Map([
        [tokens.ILogger, logger],
        [tokens.IEventBus, eventBus],
      ])
    );

    registerMemoryMonitoring(container);

    expect(container.__registrations.has(tokens.IMemoryReporter)).toBe(false);
    expect(container.isRegistered(tokens.IMemoryReporter)).toBe(false);
  });

  it('handles optional monitoring dependencies being unavailable at runtime', async () => {
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const eventBus = { emit: jest.fn() };

    const { registerMemoryMonitoring, tokens } =
      await loadRegisterMemoryMonitoring('development');

    const container = createMockContainer(
      new Map([
        [tokens.ILogger, logger],
        [tokens.IEventBus, eventBus],
      ])
    );

    const baseIsRegistered = container.isRegistered;
    container.isRegistered = jest.fn((token) => {
      if (
        token === tokens.IMemoryMonitor ||
        token === tokens.IMemoryPressureManager
      ) {
        return false;
      }
      return baseIsRegistered(token);
    });

    monitoringMocks.mockMonitoringCoordinator.mockImplementationOnce(
      () => ({})
    );

    registerMemoryMonitoring(container);

    const coordinatorArgs =
      monitoringMocks.mockMonitoringCoordinator.mock.calls[0][0];
    expect(coordinatorArgs.memoryMonitor).toBeNull();
    expect(coordinatorArgs.memoryPressureManager).toBeNull();

    expect(
      monitoringMocks.mockMonitoringCoordinatorInject
    ).not.toHaveBeenCalled();
  });

  it('falls back gracefully when the logger is unavailable and injection fails', async () => {
    const fallbackLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const eventBus = { emit: jest.fn() };

    const { registerMemoryMonitoring, tokens } =
      await loadRegisterMemoryMonitoring('production');

    const container = createMockContainer(
      new Map([
        [tokens.ILogger, fallbackLogger],
        [tokens.IEventBus, eventBus],
      ])
    );

    const baseResolve = container.resolve;
    let firstLoggerAttempt = true;
    container.resolve = jest.fn((token) => {
      if (token === tokens.ILogger && firstLoggerAttempt) {
        firstLoggerAttempt = false;
        throw new Error('Logger not ready');
      }
      if (token === tokens.IMonitoringCoordinator) {
        throw new Error('Coordinator unavailable');
      }
      return baseResolve(token);
    });

    expect(() => registerMemoryMonitoring(container)).not.toThrow();

    const errorConfig = container.resolve(tokens.IErrorReportingConfig);
    expect(errorConfig.enabled).toBe(false);

    container.resolve(tokens.ILowMemoryStrategy);
    container.resolve(tokens.ICriticalMemoryStrategy);

    expect(fallbackLogger.debug).not.toHaveBeenCalled();
    expect(
      monitoringMocks.mockMonitoringCoordinatorInject
    ).not.toHaveBeenCalled();

    expect(
      monitoringMocks.mockLowMemoryStrategy.mock.calls[0][0].cache
    ).toBeNull();
    expect(
      monitoringMocks.mockCriticalMemoryStrategy.mock.calls[0][0].cache
    ).toBeNull();
  });
});
