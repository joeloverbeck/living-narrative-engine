/**
 * @file Default configuration and presets for the debug logging system
 * @description Provides comprehensive default values and environment-specific presets
 */

import { getEndpointConfig } from '../../config/endpointConfig.js';

/**
 * Default configuration for the debug logging system
 *
 * @type {object}
 */
export const DEFAULT_CONFIG = {
  enabled: true,
  mode: 'development',
  fallbackToConsole: true,
  logLevel: 'INFO', // Legacy support
  debugNamespaces: {
    enabled: new Set(), // Set of enabled namespaces (format: "category:namespace")
    global: false, // If true, all debug logs are enabled regardless of namespace
  },
  remote: {
    endpoint: getEndpointConfig().getDebugLogEndpoint(),
    batchSize: 100,
    flushInterval: 1000,
    retryAttempts: 3,
    retryBaseDelay: 1000,
    retryMaxDelay: 30000,
    retryDelay: 1000, // Legacy support
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000,
    requestTimeout: 5000,
    compression: {
      enabled: false,
      threshold: 1024, // Minimum payload size in bytes to trigger compression
      algorithm: 'gzip', // Compression algorithm to use
      level: 6, // Compression level (1-9, where 9 is maximum compression)
      maxPayloadSize: 5242880, // 5MB - maximum uncompressed payload size
    },
    batching: {
      adaptive: true, // Enable adaptive batch sizing
      minBatchSize: 10, // Minimum batch size
      maxBatchSize: 500, // Maximum batch size
      targetLatency: 100, // Target latency in ms for optimization
      adjustmentFactor: 0.1, // Rate of batch size adjustment (0.0-1.0)
    },
  },
  categories: {
    engine: { enabled: true, level: 'debug' },
    ui: { enabled: true, level: 'info' },
    ecs: { enabled: true, level: 'debug' },
    ai: { enabled: true, level: 'debug' },
    persistence: { enabled: false, level: 'warn' },
    anatomy: { enabled: true, level: 'info' },
    actions: { enabled: true, level: 'debug' },
    turns: { enabled: true, level: 'info' },
    events: { enabled: false, level: 'warn' },
    validation: { enabled: false, level: 'error' },
    general: { enabled: true, level: 'debug' },
    entities: { enabled: true, level: 'info' }, // From existing config
    llm: { enabled: true, level: 'info' }, // From existing config
  },
  console: {
    enabled: true,
    useColors: true,
    showTimestamp: false,
    showCategory: true,
    groupSimilar: true,
  },
  performance: {
    enableMetrics: true,
    metricsInterval: 60000,
    memoryWarningThreshold: 100, // MB
    slowLogThreshold: 1000, // From existing config
  },
  stackParsing: {
    stackCacheSize: 200, // Number of stack traces to cache
    sourceMapResolution: false, // Enable/disable source map resolution
    webpackDetection: true, // Enable/disable webpack pattern detection
  },
  filtering: {
    enabled: true,
    strategy: 'mask',
    patterns: {},
    strategies: {},
  },
  criticalLogging: {
    alwaysShowInConsole: true,
    enableVisualNotifications: true,
    bufferSize: 50,
    notificationPosition: 'top-right',
    autoDismissAfter: null,
    soundEnabled: false,
    minimumLevel: 'warn',
  },
};

/**
 * Environment-specific configuration presets
 * These can be merged with DEFAULT_CONFIG for quick environment setup
 *
 * @type {object}
 */
export const CONFIG_PRESETS = {
  production: {
    mode: 'remote',
    fallbackToConsole: false,
    logLevel: 'WARN',
    console: {
      enabled: false,
    },
    categories: {
      // Only warnings and errors in production
      engine: { enabled: true, level: 'warn' },
      ui: { enabled: true, level: 'warn' },
      ecs: { enabled: true, level: 'warn' },
      ai: { enabled: true, level: 'warn' },
      persistence: { enabled: true, level: 'error' },
      anatomy: { enabled: true, level: 'warn' },
      actions: { enabled: true, level: 'warn' },
      turns: { enabled: true, level: 'warn' },
      events: { enabled: true, level: 'error' },
      validation: { enabled: true, level: 'error' },
      general: { enabled: true, level: 'warn' },
      entities: { enabled: true, level: 'warn' },
      llm: { enabled: true, level: 'warn' },
    },
    performance: {
      enableMetrics: false,
      metricsInterval: 300000, // 5 minutes
    },
    remote: {
      batchSize: 50, // Smaller batches for production
      flushInterval: 5000, // Less frequent flushing
      retryAttempts: 5, // More retries for production
      circuitBreakerThreshold: 3, // More sensitive circuit breaker
    },
  },

  development: {
    mode: 'hybrid',
    fallbackToConsole: true,
    logLevel: 'INFO', // Changed from DEBUG to prevent console overload - use namespaces for debug logging
    console: {
      enabled: true,
      showCategory: true,
      useColors: true,
      showTimestamp: true,
    },
    categories: {
      // INFO by default to prevent ~25K debug logs from hanging console
      // Use debug namespaces for targeted debugging (e.g., /debug:enable engine:init)
      engine: { enabled: true, level: 'info' },
      ui: { enabled: true, level: 'info' },
      ecs: { enabled: true, level: 'info' },
      ai: { enabled: true, level: 'info' },
      persistence: { enabled: true, level: 'info' },
      anatomy: { enabled: true, level: 'info' },
      actions: { enabled: true, level: 'info' },
      turns: { enabled: true, level: 'info' },
      events: { enabled: true, level: 'info' },
      validation: { enabled: true, level: 'info' },
      general: { enabled: true, level: 'info' },
      entities: { enabled: true, level: 'info' },
      llm: { enabled: true, level: 'info' },
    },
    performance: {
      enableMetrics: true,
      slowLogThreshold: 500, // Lower threshold for development
    },
    debugNamespaces: {
      enabled: new Set(), // Empty by default - activate specific namespaces as needed
      global: false, // Set to true to enable all debug logs (not recommended)
    },
  },

  test: {
    mode: 'test',
    enabled: false, // Disable most logging during tests
    fallbackToConsole: false,
    logLevel: 'NONE',
    remote: {
      enabled: false,
    },
    console: {
      enabled: false,
    },
    categories: {
      // Only critical errors in tests
      engine: { enabled: false, level: 'none' },
      ui: { enabled: false, level: 'none' },
      ecs: { enabled: false, level: 'none' },
      ai: { enabled: false, level: 'none' },
      persistence: { enabled: false, level: 'none' },
      anatomy: { enabled: false, level: 'none' },
      actions: { enabled: false, level: 'none' },
      turns: { enabled: false, level: 'none' },
      events: { enabled: false, level: 'none' },
      validation: { enabled: true, level: 'error' }, // Keep validation errors in tests
      general: { enabled: false, level: 'none' },
      entities: { enabled: false, level: 'none' },
      llm: { enabled: false, level: 'none' },
    },
    performance: {
      enableMetrics: false,
    },
  },

  debugging: {
    mode: 'hybrid',
    fallbackToConsole: true,
    logLevel: 'DEBUG',
    console: {
      enabled: true,
      useColors: true,
      showTimestamp: true,
      showCategory: true,
      groupSimilar: false, // Show all messages when debugging
    },
    categories: {
      // Everything enabled for debugging
      engine: { enabled: true, level: 'debug' },
      ui: { enabled: true, level: 'debug' },
      ecs: { enabled: true, level: 'debug' },
      ai: { enabled: true, level: 'debug' },
      persistence: { enabled: true, level: 'debug' },
      anatomy: { enabled: true, level: 'debug' },
      actions: { enabled: true, level: 'debug' },
      turns: { enabled: true, level: 'debug' },
      events: { enabled: true, level: 'debug' },
      validation: { enabled: true, level: 'debug' },
      general: { enabled: true, level: 'debug' },
      entities: { enabled: true, level: 'debug' },
      llm: { enabled: true, level: 'debug' },
    },
    performance: {
      enableMetrics: true,
      slowLogThreshold: 100, // Very sensitive in debugging mode
      metricsInterval: 30000, // More frequent metrics
    },
  },

  silent: {
    mode: 'none',
    enabled: false,
    fallbackToConsole: false,
    logLevel: 'NONE',
    remote: {
      enabled: false,
    },
    console: {
      enabled: false,
    },
    categories: {
      // Everything disabled
      engine: { enabled: false, level: 'none' },
      ui: { enabled: false, level: 'none' },
      ecs: { enabled: false, level: 'none' },
      ai: { enabled: false, level: 'none' },
      persistence: { enabled: false, level: 'none' },
      anatomy: { enabled: false, level: 'none' },
      actions: { enabled: false, level: 'none' },
      turns: { enabled: false, level: 'none' },
      events: { enabled: false, level: 'none' },
      validation: { enabled: false, level: 'none' },
      general: { enabled: false, level: 'none' },
      entities: { enabled: false, level: 'none' },
      llm: { enabled: false, level: 'none' },
    },
    performance: {
      enableMetrics: false,
    },
  },
};

/**
 * Migration support for old logger-config.json format
 * Converts legacy configuration to new schema format
 *
 * @param {object} oldConfig - Legacy configuration object
 * @returns {object} Migrated configuration object
 */
export function migrateOldConfig(oldConfig) {
  if (!oldConfig || typeof oldConfig !== 'object') {
    return DEFAULT_CONFIG;
  }

  const migrated = {
    enabled: oldConfig.logLevel !== 'NONE',
    mode: oldConfig.logLevel === 'NONE' ? 'none' : 'console',
    fallbackToConsole: true,
    logLevel: oldConfig.logLevel || 'INFO',
  };

  // Convert logLevel to categories
  if (oldConfig.logLevel && oldConfig.logLevel !== 'NONE') {
    migrated.categories = {
      general: {
        enabled: true,
        level: oldConfig.logLevel.toLowerCase(),
      },
    };
  }

  return migrated;
}

/**
 * Environment variable mappings for configuration override
 * Maps environment variable names to configuration paths
 *
 * @type {object}
 */
export const ENV_VAR_MAPPINGS = {
  DEBUG_LOG_ENABLED: 'enabled',
  DEBUG_LOG_MODE: 'mode',
  DEBUG_LOG_ENDPOINT: 'remote.endpoint',
  DEBUG_LOG_BATCH_SIZE: 'remote.batchSize',
  DEBUG_LOG_FLUSH_INTERVAL: 'remote.flushInterval',
  DEBUG_LOG_RETRY_ATTEMPTS: 'remote.retryAttempts',
  DEBUG_LOG_CIRCUIT_BREAKER_THRESHOLD: 'remote.circuitBreakerThreshold',
  DEBUG_LOG_REQUEST_TIMEOUT: 'remote.requestTimeout',
  DEBUG_LOG_CONSOLE_ENABLED: 'console.enabled',
  DEBUG_LOG_CONSOLE_COLORS: 'console.useColors',
  DEBUG_LOG_CONSOLE_TIMESTAMP: 'console.showTimestamp',
  DEBUG_LOG_CONSOLE_CATEGORY: 'console.showCategory',
  DEBUG_LOG_PERFORMANCE_METRICS: 'performance.enableMetrics',
  DEBUG_LOG_PERFORMANCE_THRESHOLD: 'performance.slowLogThreshold',
  DEBUG_LOG_CRITICAL_SOUND_ENABLED: 'criticalLogging.soundEnabled',
  DEBUG_LOG_CRITICAL_MINIMUM_LEVEL: 'criticalLogging.minimumLevel',
  DEBUG_LOG_LEVEL: 'logLevel', // Legacy support
  DEBUG_NAMESPACES: 'debugNamespaces', // Comma-separated list (e.g., "engine:init,ai:memory")
};
