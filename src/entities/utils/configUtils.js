/**
 * @file configUtils - Utility functions for working with entity configuration
 * @module configUtils
 */

import EntityConfigProvider from '../config/EntityConfigProvider.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Global configuration provider instance.
 *
 * @type {EntityConfigProvider|null}
 */
let globalConfigProvider = null;

/**
 * Initializes the global configuration provider.
 *
 * @param {ILogger} logger - Logger instance
 * @param {object} [userConfig] - User configuration overrides
 * @returns {EntityConfigProvider} Initialized configuration provider
 */
export function initializeGlobalConfig(logger, userConfig = {}) {
  globalConfigProvider = new EntityConfigProvider({ logger, userConfig });
  return globalConfigProvider;
}

/**
 * Gets the global configuration provider.
 *
 * @returns {EntityConfigProvider} Configuration provider
 * @throws {Error} If configuration provider is not initialized
 */
export function getGlobalConfig() {
  if (!globalConfigProvider) {
    throw new Error(
      'Global configuration provider is not initialized. Call initializeGlobalConfig() first.'
    );
  }
  return globalConfigProvider;
}

/**
 * Gets a configuration value from the global provider.
 *
 * @param {string} path - Configuration path
 * @returns {*} Configuration value
 */
export function getConfigValue(path) {
  return getGlobalConfig().getValue(path);
}

/**
 * Checks if a feature is enabled.
 *
 * @param {string} feature - Feature path
 * @returns {boolean} True if feature is enabled
 */
export function isFeatureEnabled(feature) {
  return getGlobalConfig().isFeatureEnabled(feature);
}

/**
 * Gets performance limits.
 *
 * @returns {object} Performance limits
 */
export function getLimits() {
  return getGlobalConfig().getLimits();
}

/**
 * Gets cache settings.
 *
 * @returns {object} Cache settings
 */
export function getCacheSettings() {
  return getGlobalConfig().getCacheSettings();
}

/**
 * Gets validation settings.
 *
 * @returns {object} Validation settings
 */
export function getValidationSettings() {
  return getGlobalConfig().getValidationSettings();
}

/**
 * Gets performance settings.
 *
 * @returns {object} Performance settings
 */
export function getPerformanceSettings() {
  return getGlobalConfig().getPerformanceSettings();
}

/**
 * Validates that an entity count is within limits.
 *
 * @param {number} count - Current entity count
 * @throws {Error} If count exceeds maximum
 */
export function validateEntityCount(count) {
  const limits = getLimits();
  if (count > limits.MAX_ENTITIES) {
    throw new Error(
      `Entity count ${count} exceeds maximum limit of ${limits.MAX_ENTITIES}`
    );
  }
}

/**
 * Validates that a component size is within limits.
 *
 * @param {number} size - Component size in bytes
 * @throws {Error} If size exceeds maximum
 */
export function validateComponentSize(size) {
  const limits = getLimits();
  if (size > limits.MAX_COMPONENT_SIZE) {
    throw new Error(
      `Component size ${size} bytes exceeds maximum limit of ${limits.MAX_COMPONENT_SIZE} bytes`
    );
  }
}

/**
 * Validates that a batch size is within limits.
 *
 * @param {number} batchSize - Batch size
 * @throws {Error} If batch size exceeds maximum
 */
export function validateBatchSize(batchSize) {
  const limits = getLimits();
  if (batchSize > limits.MAX_BATCH_SIZE) {
    throw new Error(
      `Batch size ${batchSize} exceeds maximum limit of ${limits.MAX_BATCH_SIZE}`
    );
  }
}

/**
 * Validates that a string length is within limits.
 *
 * @param {string} str - String to validate
 * @throws {Error} If string length exceeds maximum
 */
export function validateStringLength(str) {
  const limits = getLimits();
  if (str && str.length > limits.MAX_STRING_LENGTH) {
    throw new Error(
      `String length ${str.length} exceeds maximum limit of ${limits.MAX_STRING_LENGTH}`
    );
  }
}

/**
 * Validates that an object depth is within limits.
 *
 * @param {*} obj - Object to validate
 * @param {number} [currentDepth] - Current depth
 * @throws {Error} If object depth exceeds maximum
 */
export function validateObjectDepth(obj, currentDepth = 0) {
  const limits = getLimits();
  if (currentDepth > limits.MAX_COMPONENT_DEPTH) {
    throw new Error(
      `Object depth ${currentDepth} exceeds maximum limit of ${limits.MAX_COMPONENT_DEPTH}`
    );
  }

  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        validateObjectDepth(value, currentDepth + 1);
      }
    }
  }
}

/**
 * Validates that an object property count is within limits.
 *
 * @param {object} obj - Object to validate
 * @throws {Error} If property count exceeds maximum
 */
export function validateObjectProperties(obj) {
  const limits = getLimits();
  if (obj && typeof obj === 'object') {
    const propertyCount = Object.keys(obj).length;
    if (propertyCount > limits.MAX_COMPONENT_PROPERTIES) {
      throw new Error(
        `Object property count ${propertyCount} exceeds maximum limit of ${limits.MAX_COMPONENT_PROPERTIES}`
      );
    }
  }
}

/**
 * Validates component data according to configuration limits.
 *
 * @param {*} componentData - Component data to validate
 * @throws {Error} If component data violates limits
 */
export function validateComponentData(componentData) {
  if (!componentData || typeof componentData !== 'object') {
    return;
  }

  // Validate size (approximate)
  const size = JSON.stringify(componentData).length;
  validateComponentSize(size);

  // Validate depth
  validateObjectDepth(componentData);

  // Validate property count
  validateObjectProperties(componentData);

  // Validate string lengths
  const validateStrings = (obj) => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof key === 'string') {
        validateStringLength(key);
      }
      if (typeof value === 'string') {
        validateStringLength(value);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        validateStrings(value);
      }
    }
  };

  validateStrings(componentData);
}

/**
 * Checks if debugging is enabled.
 *
 * @returns {boolean} True if debugging is enabled
 */
export function isDebugEnabled() {
  return isFeatureEnabled('logging.ENABLE_DEBUG_LOGGING');
}

/**
 * Checks if performance monitoring is enabled.
 *
 * @returns {boolean} True if performance monitoring is enabled
 */
export function isMonitoringEnabled() {
  return isFeatureEnabled('performance.ENABLE_MONITORING');
}

/**
 * Checks if strict validation is enabled.
 *
 * @returns {boolean} True if strict validation is enabled
 */
export function isStrictValidationEnabled() {
  return isFeatureEnabled('validation.STRICT_MODE');
}

/**
 * Checks if caching is enabled.
 *
 * @returns {boolean} True if caching is enabled
 */
export function isCachingEnabled() {
  return isFeatureEnabled('cache.ENABLE_DEFINITION_CACHE');
}

/**
 * Gets the slow operation threshold.
 *
 * @returns {number} Slow operation threshold in milliseconds
 */
export function getSlowOperationThreshold() {
  return getConfigValue('performance.SLOW_OPERATION_THRESHOLD');
}

/**
 * Gets the memory warning threshold.
 *
 * @returns {number} Memory warning threshold (0-1)
 */
export function getMemoryWarningThreshold() {
  return getConfigValue('performance.MEMORY_WARNING_THRESHOLD');
}

/**
 * Gets the circuit breaker threshold.
 *
 * @returns {number} Circuit breaker threshold
 */
export function getCircuitBreakerThreshold() {
  return getConfigValue('errorHandling.CIRCUIT_BREAKER_THRESHOLD');
}

/**
 * Gets the circuit breaker timeout.
 *
 * @returns {number} Circuit breaker timeout in milliseconds
 */
export function getCircuitBreakerTimeout() {
  return getConfigValue('errorHandling.CIRCUIT_BREAKER_TIMEOUT');
}

/**
 * Gets the default component types.
 *
 * @returns {string[]} Default component types
 */
export function getDefaultComponentTypes() {
  return getConfigValue('defaults.DEFAULT_COMPONENT_TYPES');
}

/**
 * Checks if the configuration provider is initialized.
 *
 * @returns {boolean} True if initialized
 */
export function isConfigInitialized() {
  return globalConfigProvider !== null;
}

/**
 * Resets the global configuration provider (for testing).
 */
export function resetGlobalConfig() {
  globalConfigProvider = null;
}
