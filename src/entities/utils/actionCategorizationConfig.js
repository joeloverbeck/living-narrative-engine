/**
 * @file Action Categorization Configuration Constants and Utilities
 * Provides default configurations and validation for action categorization
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} PerformanceConfig
 * @property {boolean} enableCaching - Enable caching for expensive operations
 * @property {number} cacheMaxSize - Maximum cache size
 * @property {boolean} performanceLogging - Enable performance logging
 * @property {number} slowOperationThresholdMs - Threshold for slow operation warnings
 */

/**
 * @typedef {object} ErrorHandlingConfig
 * @property {string} logLevel - Minimum log level ('debug'|'info'|'warn'|'error')
 * @property {string} fallbackBehavior - Error fallback behavior ('disable'|'flatten'|'unknown_namespace')
 * @property {number} maxRetries - Maximum retries for failed operations
 */

/**
 * @typedef {object} CategorizationConfig
 * @property {boolean} enabled - Whether categorization is active
 * @property {number} minActionsForGrouping - Minimum actions to trigger grouping
 * @property {number} minNamespacesForGrouping - Minimum namespaces to trigger grouping
 * @property {string[]} namespaceOrder - Priority order for namespace sorting
 * @property {boolean} showCounts - Whether to show action counts (UI only)
 * @property {PerformanceConfig} performance - Performance-related options
 * @property {ErrorHandlingConfig} errorHandling - Error handling options
 */

/**
 * Default performance configuration
 *
 * @type {PerformanceConfig}
 */
export const DEFAULT_PERFORMANCE_CONFIG = {
  enableCaching: true,
  cacheMaxSize: 1000,
  performanceLogging: false,
  slowOperationThresholdMs: 10,
};

/**
 * Default error handling configuration
 *
 * @type {ErrorHandlingConfig}
 */
export const DEFAULT_ERROR_HANDLING_CONFIG = {
  logLevel: 'warn',
  fallbackBehavior: 'flatten',
  maxRetries: 1,
};

/**
 * Default categorization configuration
 *
 * @type {CategorizationConfig}
 */
export const DEFAULT_CATEGORIZATION_CONFIG = {
  enabled: true,
  minActionsForGrouping: 6,
  minNamespacesForGrouping: 2,
  namespaceOrder: [
    'core',
    'affection',
    'kissing',
    'caressing',
    'sex',
    'anatomy',
    'clothing',
    'movement',
  ],
  showCounts: false,
  performance: DEFAULT_PERFORMANCE_CONFIG,
  errorHandling: DEFAULT_ERROR_HANDLING_CONFIG,
};

/**
 * UI-specific configuration (shows counts)
 *
 * @type {CategorizationConfig}
 */
export const UI_CATEGORIZATION_CONFIG = {
  ...DEFAULT_CATEGORIZATION_CONFIG,
  showCounts: true,
};

/**
 * LLM-specific configuration (no counts, performance optimized)
 *
 * @type {CategorizationConfig}
 */
export const LLM_CATEGORIZATION_CONFIG = {
  ...DEFAULT_CATEGORIZATION_CONFIG,
  showCounts: false,
  performance: {
    ...DEFAULT_PERFORMANCE_CONFIG,
    enableCaching: true,
    performanceLogging: true,
  },
};

/**
 * Testing configuration (faster thresholds, more logging)
 *
 * @type {CategorizationConfig}
 */
export const TEST_CATEGORIZATION_CONFIG = {
  ...DEFAULT_CATEGORIZATION_CONFIG,
  minActionsForGrouping: 3,
  minNamespacesForGrouping: 2,
  performance: {
    ...DEFAULT_PERFORMANCE_CONFIG,
    enableCaching: false,
    performanceLogging: true,
    slowOperationThresholdMs: 5,
  },
  errorHandling: {
    ...DEFAULT_ERROR_HANDLING_CONFIG,
    logLevel: 'debug',
  },
};

/**
 * Valid namespace order presets for common configurations
 */
export const NAMESPACE_ORDER_PRESETS = {
  default: [
    'core',
    'affection',
    'kissing',
    'caressing',
    'sex',
    'anatomy',
    'clothing',
    'movement',
  ],
  minimal: ['core'],
  extended: [
    'core',
    'affection',
    'kissing',
    'caressing',
    'sex',
    'anatomy',
    'clothing',
    'movement',
    'equipment',
    'magic',
    'social',
  ],
  alphabetical: [], // Will be sorted alphabetically when used
};

/**
 * Configuration validation error types
 */
export const CONFIG_VALIDATION_ERRORS = {
  INVALID_TYPE: 'INVALID_TYPE',
  MISSING_REQUIRED: 'MISSING_REQUIRED',
  INVALID_RANGE: 'INVALID_RANGE',
  INVALID_NAMESPACE: 'INVALID_NAMESPACE',
  DUPLICATE_NAMESPACE: 'DUPLICATE_NAMESPACE',
  INVALID_ENUM: 'INVALID_ENUM',
};
