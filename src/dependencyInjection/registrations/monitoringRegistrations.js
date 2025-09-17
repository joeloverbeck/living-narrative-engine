/**
 * @file monitoringRegistrations.js - Dependency injection registrations for monitoring services
 */

import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import { getEnvironmentMode } from '../../utils/environmentUtils.js';
import MemoryMonitor from '../../entities/monitoring/MemoryMonitor.js';
import MemoryAnalyzer from '../../entities/monitoring/MemoryAnalyzer.js';
import MemoryProfiler from '../../entities/monitoring/MemoryProfiler.js';
import MemoryPressureManager from '../../entities/monitoring/MemoryPressureManager.js';
import MemoryReporter from '../../entities/monitoring/MemoryReporter.js';
import LowMemoryStrategy from '../../entities/monitoring/strategies/LowMemoryStrategy.js';
import CriticalMemoryStrategy from '../../entities/monitoring/strategies/CriticalMemoryStrategy.js';
import CentralErrorHandler from '../../errors/CentralErrorHandler.js';

/**
 * Default memory monitoring configuration
 */
const defaultMemoryMonitoringConfig = {
  enabled: getEnvironmentMode() !== 'production',
  sampling: {
    interval: 5000,
    historySize: 1000,
  },
  thresholds: {
    heap: {
      warning: 0.7,
      critical: 0.85,
    },
    rss: {
      warning: 800 * 1024 * 1024, // 800MB
      critical: 1024 * 1024 * 1024, // 1GB
    },
  },
  leakDetection: {
    enabled: true,
    sensitivity: 'medium',
    windowSize: 100,
    growthThreshold: 0.1, // 10% growth
  },
  automaticResponse: {
    enabled: true,
    cachePruning: {
      warning: 'normal',
      critical: 'aggressive',
    },
    gcTrigger: {
      critical: true,
    },
  },
};

/**
 * Register memory monitoring services
 *
 * @param {object} container - DI container
 */
export function registerMemoryMonitoring(container) {
  const registrar = new Registrar(container);

  // Try to get logger
  let log;
  try {
    log = container.resolve(tokens.ILogger);
    log.debug('Memory Monitoring Registration: starting…');
  } catch {
    // Logger not yet available, continue silently
    log = null;
  }

  const safeDebug = (message) => {
    if (log) {
      log.debug(message);
    }
    // Silent when logger is not available
  };

  // Register memory monitoring configuration
  registrar.instance(tokens.IMemoryMonitoringConfig, defaultMemoryMonitoringConfig);
  safeDebug(`Registered ${String(tokens.IMemoryMonitoringConfig)}.`);

  // Register MemoryMonitor
  container.register(
    tokens.IMemoryMonitor,
    (c) => {
      const config = c.resolve(tokens.IMemoryMonitoringConfig);
      return new MemoryMonitor({
        logger: c.resolve(tokens.ILogger),
        eventBus: c.resolve(tokens.IEventBus),
        enabled: config.enabled,
        heapWarning: config.thresholds.heap.warning,
        heapCritical: config.thresholds.heap.critical,
        rssWarning: config.thresholds.rss.warning,
        rssCritical: config.thresholds.rss.critical,
        samplingInterval: config.sampling.interval,
        maxHistorySize: config.sampling.historySize,
        leakDetectionConfig: config.leakDetection,
      });
    },
    { singleton: true }
  );
  safeDebug(`Registered ${String(tokens.IMemoryMonitor)}.`);

  // Register MemoryAnalyzer
  container.register(
    tokens.IMemoryAnalyzer,
    (c) => new MemoryAnalyzer({
      logger: c.resolve(tokens.ILogger),
    }),
    { singleton: true }
  );
  safeDebug(`Registered ${String(tokens.IMemoryAnalyzer)}.`);

  // Register MemoryProfiler
  container.register(
    tokens.IMemoryProfiler,
    (c) => new MemoryProfiler({
      logger: c.resolve(tokens.ILogger),
    }),
    { singleton: true }
  );
  safeDebug(`Registered ${String(tokens.IMemoryProfiler)}.`);

  // Register LowMemoryStrategy
  container.register(
    tokens.ILowMemoryStrategy,
    (c) => new LowMemoryStrategy({
      logger: c.resolve(tokens.ILogger),
      eventBus: c.resolve(tokens.IEventBus),
      cache: c.has(tokens.IUnifiedCache) ? c.resolve(tokens.IUnifiedCache) : null,
    }),
    { singleton: true }
  );
  safeDebug(`Registered ${String(tokens.ILowMemoryStrategy)}.`);

  // Register CriticalMemoryStrategy
  container.register(
    tokens.ICriticalMemoryStrategy,
    (c) => new CriticalMemoryStrategy({
      logger: c.resolve(tokens.ILogger),
      eventBus: c.resolve(tokens.IEventBus),
      cache: c.has(tokens.IUnifiedCache) ? c.resolve(tokens.IUnifiedCache) : null,
    }),
    { singleton: true }
  );
  safeDebug(`Registered ${String(tokens.ICriticalMemoryStrategy)}.`);

  // Register MemoryPressureManager
  container.register(
    tokens.IMemoryPressureManager,
    (c) => {
      const config = c.resolve(tokens.IMemoryMonitoringConfig);
      return new MemoryPressureManager({
        logger: c.resolve(tokens.ILogger),
        eventBus: c.resolve(tokens.IEventBus),
        monitor: c.resolve(tokens.IMemoryMonitor),
        cache: c.has(tokens.IUnifiedCache) ? c.resolve(tokens.IUnifiedCache) : null,
      }, {
        automaticManagement: config.automaticResponse.enabled,
        aggressiveGC: config.automaticResponse.gcTrigger.critical,
      });
    },
    { singleton: true }
  );
  safeDebug(`Registered ${String(tokens.IMemoryPressureManager)}.`);

  // Register MemoryReporter (if it exists)
  if (typeof MemoryReporter !== 'undefined') {
    container.register(
      tokens.IMemoryReporter,
      (c) => new MemoryReporter({
        logger: c.resolve(tokens.ILogger),
        monitor: c.resolve(tokens.IMemoryMonitor),
        analyzer: c.resolve(tokens.IMemoryAnalyzer),
        profiler: c.resolve(tokens.IMemoryProfiler),
        pressureManager: c.resolve(tokens.IMemoryPressureManager),
      }),
      { singleton: true }
    );
    safeDebug(`Registered ${String(tokens.IMemoryReporter)}.`);
  }

  // Register CentralErrorHandler
  container.register(
    tokens.ICentralErrorHandler,
    (c) => new CentralErrorHandler({
      logger: c.resolve(tokens.ILogger),
      eventBus: c.resolve(tokens.IEventBus),
      monitoringCoordinator: c.resolve(tokens.IMonitoringCoordinator),
    }),
    { singleton: true }
  );
  safeDebug(`Registered ${String(tokens.ICentralErrorHandler)}.`);

  safeDebug('Memory Monitoring Registration: completed.');
}

export default registerMemoryMonitoring;