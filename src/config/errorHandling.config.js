/**
 * @file Comprehensive error handling configuration for the Living Narrative Engine
 * @description Centralizes all error handling settings including retry policies, circuit breakers,
 *              reporting endpoints, and fallback values. Supports environment-specific overrides.
 * @see ../utils/environmentUtils.js - Environment detection utilities
 * @see ../errors/CentralErrorHandler.js - Main error handler that uses this configuration
 * @see ../errors/RecoveryStrategyManager.js - Recovery strategy manager that uses retry config
 * @see ../errors/ErrorReporter.js - Error reporter that uses reporting config
 */

import { getEnvironmentMode } from '../utils/environmentUtils.js';

// Define error severity constants
export const ErrorSeverity = {
  CRITICAL: 'critical',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

/**
 * Comprehensive error handling configuration
 *
 * @module errorHandling.config
 */
export const errorHandlingConfig = {
  // Global settings
  global: {
    enabled: true, // Can be overridden per environment
    logLevel: 'error', // Default log level
    includeStackTrace: true, // Will be overridden per environment
    correlationIdHeader: 'X-Correlation-ID',
    maxContextSize: 1000, // Max size of error context object
  },

  // Retry configuration
  retry: {
    default: {
      maxAttempts: 3,
      backoff: {
        type: 'exponential', // exponential, linear, constant
        initialDelay: 100,
        maxDelay: 5000,
        factor: 2,
        jitter: 0.1, // 10% jitter
      },
      timeout: 5000,
    },
    // Domain-specific overrides
    overrides: {
      ClothingError: {
        maxAttempts: 3,
        backoff: { type: 'exponential', initialDelay: 200 },
      },
      AnatomyVisualizationError: {
        maxAttempts: 2,
        backoff: { type: 'exponential', initialDelay: 500 },
      },
      LLMInteractionError: {
        maxAttempts: 2,
        backoff: { type: 'linear', initialDelay: 1000 },
      },
      NetworkError: {
        maxAttempts: 5,
        backoff: { type: 'exponential', initialDelay: 100, maxDelay: 10000 },
      },
    },
    // Non-retriable error types
    nonRetriable: [
      'ValidationError',
      'ConfigurationError',
      'InitializationError',
      'AuthenticationError',
      'AuthorizationError',
      'NotFoundError',
      'ConflictError',
    ],
  },

  // Circuit breaker configuration
  circuitBreaker: {
    default: {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000, // 30 seconds
      halfOpenRequests: 3,
      volumeThreshold: 10, // Min requests before opening
      errorThresholdPercentage: 50,
    },
    // Service-specific overrides
    overrides: {
      'clothing-service': {
        failureThreshold: 3,
        timeout: 60000,
      },
      'anatomy-service': {
        failureThreshold: 4,
        timeout: 45000,
      },
      'llm-service': {
        failureThreshold: 2,
        timeout: 120000, // 2 minutes for LLM
      },
      'external-api': {
        failureThreshold: 5,
        timeout: 60000,
        errorThresholdPercentage: 30,
      },
    },
  },

  // Error reporting configuration
  reporting: {
    enabled: false, // Will be enabled in production environment
    endpoint: null, // Set via environment configuration
    apiKey: null, // Set via environment configuration
    batchSize: 50,
    flushInterval: 30000, // 30 seconds
    includeStackTrace: true, // Will be overridden per environment
    // Sampling configuration for high-volume scenarios
    sampling: {
      enabled: false, // Can be enabled per environment
      rate: 1.0, // 1.0 = 100%
      // Always report these error types regardless of sampling
      alwaysReport: [
        'critical',
        'SecurityError',
        'DataCorruptionError',
        'SystemFailureError',
      ],
    },
    // Alert thresholds
    alerts: {
      criticalErrors: 5,
      errorRate: 10, // errors per minute
      specificError: 20, // same error count
      failureRate: 0.1, // 10% failure rate
    },
  },

  // Fallback values by domain
  fallback: {
    useCache: true,
    cacheTimeout: 60000, // 1 minute
    // Default fallback values by operation type
    defaults: {
      fetch: null,
      list: [],
      count: 0,
      validate: false,
      generate: {},
      calculate: 0,
      parse: null,
      render: '',
    },
    // Domain-specific fallback values
    domains: {
      clothing: {
        getEquipment: [],
        getAccessibility: { accessible: true, items: [] },
        calculatePriority: { priorities: {} },
        analyzeCoverage: { blocking: [] },
      },
      anatomy: {
        generateAnatomy: {
          parts: [
            { id: 'head', type: 'head' },
            { id: 'torso', type: 'torso' },
            { id: 'leftArm', type: 'arm' },
            { id: 'rightArm', type: 'arm' },
            { id: 'leftLeg', type: 'leg' },
            { id: 'rightLeg', type: 'leg' },
          ],
        },
        generateDescription: 'A standard humanoid form.',
        buildGraph: { nodes: [], edges: [] },
      },
      llm: {
        generateText: '[Text generation unavailable]',
        analyzePrompt: { tokens: 0, valid: false },
        complete: null,
      },
    },
  },

  // Recovery strategies
  recovery: {
    // Strategy selection based on error severity
    strategies: {
      [ErrorSeverity.CRITICAL]: {
        strategy: 'fail-fast',
        notify: true,
        fallback: false,
      },
      [ErrorSeverity.ERROR]: {
        strategy: 'retry-with-fallback',
        notify: false,
        fallback: true,
      },
      [ErrorSeverity.WARNING]: {
        strategy: 'retry-with-fallback',
        notify: false,
        fallback: true,
      },
      [ErrorSeverity.INFO]: {
        strategy: 'log-only',
        notify: false,
        fallback: false,
      },
    },
    // Maximum time to spend on recovery attempts
    maxRecoveryTime: 30000, // 30 seconds
    // Use cached results during recovery
    useCachedResults: true,
  },

  // Performance settings
  performance: {
    // Maximum errors to keep in memory
    maxErrorHistory: 1000,
    // Error metrics retention
    metricsRetention: 24 * 60 * 60 * 1000, // 24 hours
    // Cleanup interval
    cleanupInterval: 60 * 60 * 1000, // 1 hour
  },

  // Environment-specific overrides
  environments: {
    development: {
      global: { includeStackTrace: true },
      retry: { default: { maxAttempts: 2 } },
      reporting: { enabled: false },
    },
    test: {
      global: { enabled: true },
      retry: { default: { maxAttempts: 1 } },
      circuitBreaker: { default: { failureThreshold: 2 } },
      reporting: { enabled: true },
    },
    production: {
      global: { includeStackTrace: false },
      reporting: {
        enabled: true,
        sampling: {
          enabled: true,
          rate: 0.1,
          alwaysReport: ['critical'],
        },
      },
      fallback: { useCache: true },
    },
  },
};

/**
 * Get configuration for current environment
 *
 * @returns {object} Merged configuration
 */
export function getErrorConfig() {
  // Use getEnvironmentMode from environmentUtils
  const env = getEnvironmentMode();
  const envConfig = errorHandlingConfig.environments[env] || {};

  // Deep merge environment config with base config
  return deepMerge(errorHandlingConfig, envConfig);
}

/**
 * Get retry configuration for specific error type
 *
 * @param {string} errorType - Error type name
 * @returns {object} Retry configuration
 */
export function getRetryConfig(errorType) {
  const config = getErrorConfig();
  return config.retry.overrides[errorType] || config.retry.default;
}

/**
 * Get circuit breaker configuration for specific service
 *
 * @param {string} serviceName - Service name
 * @returns {object} Circuit breaker configuration
 */
export function getCircuitBreakerConfig(serviceName) {
  const config = getErrorConfig();
  return (
    config.circuitBreaker.overrides[serviceName] ||
    config.circuitBreaker.default
  );
}

/**
 * Get fallback value for specific operation
 *
 * @param {string} domain - Domain name
 * @param {string} operation - Operation name
 * @returns {*} Fallback value
 */
export function getFallbackValue(domain, operation) {
  const config = getErrorConfig();

  // Check domain-specific fallback
  if (config.fallback.domains[domain]?.[operation] !== undefined) {
    return config.fallback.domains[domain][operation];
  }

  // Check default fallback
  return config.fallback.defaults[operation] ?? null;
}

/**
 * Check if error type is retriable
 *
 * @param {string} errorType - Error type name
 * @returns {boolean} Whether error is retriable
 */
export function isRetriable(errorType) {
  const config = getErrorConfig();
  return !config.retry.nonRetriable.includes(errorType);
}

/**
 * Deep merge utility for configuration objects
 *
 * @private
 * @param {object} target - Target object
 * @param {object} source - Source object to merge
 * @returns {object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

export default errorHandlingConfig;
