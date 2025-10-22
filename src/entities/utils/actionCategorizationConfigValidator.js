/**
 * @file Action Categorization Configuration Validator
 * Provides validation utilities for categorization configurations
 */

import {
  DEFAULT_CATEGORIZATION_CONFIG,
  DEFAULT_PERFORMANCE_CONFIG,
  DEFAULT_ERROR_HANDLING_CONFIG,
  CONFIG_VALIDATION_ERRORS,
} from './actionCategorizationConfig.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Validate and normalize a categorization configuration
 *
 * @param {object} config - Configuration object to validate
 * @param {ILogger} logger - Logger instance for validation warnings
 * @returns {CategorizationConfig} Validated and normalized configuration
 * @throws {InvalidArgumentError} If configuration is invalid
 */
export function validateCategorizationConfig(config, logger) {
  const validLogger = ensureValidLogger(logger, 'validateCategorizationConfig');

  if (!config || typeof config !== 'object') {
    const errorMsg = 'Configuration must be a non-null object';
    validLogger.error(errorMsg, { config });
    throw new InvalidArgumentError(errorMsg, 'config', config);
  }

  // Start with default configuration
  const validated = {
    ...DEFAULT_CATEGORIZATION_CONFIG,
    ...config,
  };

  // Validate boolean fields
  validateBoolean(validated, 'enabled', validLogger);
  validateBoolean(validated, 'showCounts', validLogger);

  // Validate numeric fields with ranges
  validateInteger(validated, 'minActionsForGrouping', 1, 100, validLogger);
  validateInteger(validated, 'minNamespacesForGrouping', 1, 20, validLogger);

  // Validate namespace order
  validateNamespaceOrder(validated.namespaceOrder, validLogger);

  // Validate nested configurations
  if (config.performance) {
    validated.performance = validatePerformanceConfig(
      config.performance,
      validLogger
    );
  }

  if (config.errorHandling) {
    validated.errorHandling = validateErrorHandlingConfig(
      config.errorHandling,
      validLogger
    );
  }

  return validated;
}

/**
 * Validate boolean configuration field
 *
 * @param config
 * @param field
 * @param logger
 * @private
 */
function validateBoolean(config, field, logger) {
  if (typeof config[field] !== 'boolean') {
    const errorMsg = `${field} must be a boolean`;
    logger.error(errorMsg, { field, value: config[field] });
    throw new InvalidArgumentError(errorMsg, field, config[field]);
  }
}

/**
 * Validate integer configuration field with range
 *
 * @param config
 * @param field
 * @param min
 * @param max
 * @param logger
 * @private
 */
function validateInteger(config, field, min, max, logger) {
  const value = config[field];

  if (!Number.isInteger(value)) {
    const errorMsg = `${field} must be an integer`;
    logger.error(errorMsg, { field, value });
    throw new InvalidArgumentError(errorMsg, field, value);
  }

  if (value < min || value > max) {
    const errorMsg = `${field} must be between ${min} and ${max}`;
    logger.error(errorMsg, { field, value, min, max });
    throw new InvalidArgumentError(errorMsg, field, value);
  }
}

/**
 * Validate namespace order array
 *
 * @param namespaceOrder
 * @param logger
 * @private
 */
function validateNamespaceOrder(namespaceOrder, logger) {
  if (!Array.isArray(namespaceOrder)) {
    const errorMsg = 'namespaceOrder must be an array';
    logger.error(errorMsg, { namespaceOrder });
    throw new InvalidArgumentError(errorMsg, 'namespaceOrder', namespaceOrder);
  }

  if (namespaceOrder.length > 50) {
    const errorMsg = 'namespaceOrder cannot have more than 50 items';
    logger.error(errorMsg, { length: namespaceOrder.length });
    throw new InvalidArgumentError(
      errorMsg,
      'namespaceOrder',
      namespaceOrder.length
    );
  }

  const seen = new Set();
  const namespacePattern = /^[a-z][a-z0-9_-]*[a-z0-9]$|^[a-z]$/;

  for (let i = 0; i < namespaceOrder.length; i++) {
    const namespace = namespaceOrder[i];

    if (typeof namespace !== 'string') {
      const errorMsg = `namespaceOrder[${i}] must be a string`;
      logger.error(errorMsg, { index: i, namespace });
      throw new InvalidArgumentError(
        errorMsg,
        `namespaceOrder[${i}]`,
        namespace
      );
    }

    if (!namespacePattern.test(namespace)) {
      const errorMsg = `namespaceOrder[${i}] "${namespace}" must be lowercase alphanumeric with underscores or hyphens`;
      logger.error(errorMsg, { index: i, namespace });
      throw new InvalidArgumentError(
        errorMsg,
        `namespaceOrder[${i}]`,
        namespace
      );
    }

    if (seen.has(namespace)) {
      const errorMsg = `namespaceOrder contains duplicate namespace "${namespace}"`;
      logger.error(errorMsg, { namespace, namespaceOrder });
      throw new InvalidArgumentError(errorMsg, 'namespaceOrder', namespace);
    }

    seen.add(namespace);
  }
}

/**
 * Validate performance configuration
 *
 * @param config
 * @param logger
 * @private
 */
function validatePerformanceConfig(config, logger) {
  const validated = {
    ...DEFAULT_PERFORMANCE_CONFIG,
    ...config,
  };

  validateBoolean(validated, 'enableCaching', logger);
  validateBoolean(validated, 'performanceLogging', logger);
  validateInteger(validated, 'cacheMaxSize', 10, 10000, logger);

  const threshold = validated.slowOperationThresholdMs;
  if (typeof threshold !== 'number' || threshold < 1 || threshold > 1000) {
    const errorMsg =
      'slowOperationThresholdMs must be a number between 1 and 1000';
    logger.error(errorMsg, { threshold });
    throw new InvalidArgumentError(
      errorMsg,
      'slowOperationThresholdMs',
      threshold
    );
  }

  return validated;
}

/**
 * Validate error handling configuration
 *
 * @param config
 * @param logger
 * @private
 */
function validateErrorHandlingConfig(config, logger) {
  const validated = {
    ...DEFAULT_ERROR_HANDLING_CONFIG,
    ...config,
  };

  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(validated.logLevel)) {
    const errorMsg = `logLevel must be one of: ${validLogLevels.join(', ')}`;
    logger.error(errorMsg, { logLevel: validated.logLevel });
    throw new InvalidArgumentError(errorMsg, 'logLevel', validated.logLevel);
  }

  const validFallbackBehaviors = ['disable', 'flatten', 'unknown_namespace'];
  if (!validFallbackBehaviors.includes(validated.fallbackBehavior)) {
    const errorMsg = `fallbackBehavior must be one of: ${validFallbackBehaviors.join(', ')}`;
    logger.error(errorMsg, { fallbackBehavior: validated.fallbackBehavior });
    throw new InvalidArgumentError(
      errorMsg,
      'fallbackBehavior',
      validated.fallbackBehavior
    );
  }

  validateInteger(validated, 'maxRetries', 0, 5, logger);

  return validated;
}

/**
 * Check if a configuration is semantically valid (beyond schema validation)
 *
 * @param {CategorizationConfig} config - Configuration to check
 * @param {object} logger - Logger for warnings
 * @returns {string[]} Array of warning messages
 */
export function validateConfigurationSemantics(config, logger = console) {
  const warnings = [];

  // Check for potential performance issues
  if (config.minActionsForGrouping === 1) {
    warnings.push('minActionsForGrouping=1 may cause excessive grouping');
  }

  if (config.minNamespacesForGrouping === 1) {
    warnings.push(
      'minNamespacesForGrouping=1 will always trigger grouping when enabled'
    );
  }

  if (config.namespaceOrder.length > 20) {
    warnings.push('Large namespaceOrder arrays may impact performance');
  }

  if (config.performance.cacheMaxSize > 5000) {
    warnings.push('Large cache sizes may impact memory usage');
  }

  if (config.performance.slowOperationThresholdMs < 5) {
    warnings.push(
      'Very low slowOperationThresholdMs may generate excessive logs'
    );
  }

  // Check for logical inconsistencies
  if (config.minActionsForGrouping > config.minNamespacesForGrouping * 10) {
    warnings.push(
      'minActionsForGrouping may be too high relative to minNamespacesForGrouping'
    );
  }

  // Log warnings if logger provided
  if (warnings.length > 0 && logger.warn) {
    logger.warn('Configuration semantic warnings:', warnings);
  }

  return warnings;
}

/**
 * Create a configuration for testing with custom overrides
 *
 * @param {object} overrides - Configuration overrides
 * @returns {CategorizationConfig} Test configuration
 */
export function createTestConfig(overrides = {}) {
  return validateCategorizationConfig({
    enabled: true,
    minActionsForGrouping: 3,
    minNamespacesForGrouping: 2,
    namespaceOrder: ['core', 'test'],
    showCounts: false,
    performance: {
      enableCaching: false,
      performanceLogging: true,
      slowOperationThresholdMs: 1,
    },
    errorHandling: {
      logLevel: 'debug',
      fallbackBehavior: 'flatten',
      maxRetries: 0,
    },
    ...overrides,
  });
}

/**
 * Merge multiple configurations with validation
 *
 * @param {...object} configs - Configuration objects to merge (later ones override earlier ones)
 * @returns {CategorizationConfig} Merged and validated configuration
 */
export function mergeConfigurations(...configs) {
  const merged = configs.reduce(
    (result, config) => ({
      ...result,
      ...config,
      performance: { ...result.performance, ...config.performance },
      errorHandling: { ...result.errorHandling, ...config.errorHandling },
    }),
    DEFAULT_CATEGORIZATION_CONFIG
  );

  return validateCategorizationConfig(merged);
}
