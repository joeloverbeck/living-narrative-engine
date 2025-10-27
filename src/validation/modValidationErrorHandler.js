/**
 * @file Error handler for mod validation with classification and recovery strategies
 * @description Provides intelligent error handling with recovery strategies and graceful degradation
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ModValidationError } from '../errors/modValidationError.js';
import { ModSecurityError, SecurityLevel } from '../errors/modSecurityError.js';
import { ModCorruptionError } from '../errors/modCorruptionError.js';
import { ModAccessError } from '../errors/modAccessError.js';

/**
 * Error types for classification
 * @enum {string}
 */
export const ErrorType = {
  ACCESS: 'ACCESS',
  CORRUPTION: 'CORRUPTION',
  SECURITY: 'SECURITY',
  SYNTAX: 'SYNTAX',
  TIMEOUT: 'TIMEOUT',
  RESOURCE: 'RESOURCE',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Recovery strategies
 * @enum {string}
 */
export const RecoveryStrategy = {
  RETRY: 'RETRY',
  SKIP: 'SKIP',
  USE_DEFAULT: 'USE_DEFAULT',
  PARTIAL_RESULT: 'PARTIAL_RESULT',
  FAIL_FAST: 'FAIL_FAST',
  QUARANTINE: 'QUARANTINE',
};

/**
 * Handles mod validation errors with classification and recovery
 */
class ModValidationErrorHandler {
  #logger;
  #eventBus;
  #config;
  #errorHistory;
  #recoveryAttempts;

  /**
   * Creates a new ModValidationErrorHandler instance
   *
   * @param {object} dependencies - Dependencies
   * @param {import('../utils/loggerUtils.js').ILogger} dependencies.logger - Logger instance
   * @param {object} [dependencies.eventBus] - Event bus for error events
   * @param {object} [dependencies.config] - Error handling configuration
   */
  constructor({ logger, eventBus = null, config = {} }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    if (eventBus) {
      validateDependency(eventBus, 'IEventBus', logger, {
        requiredMethods: ['dispatch'],
      });
    }

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#config = config;
    this.#errorHistory = [];
    this.#recoveryAttempts = new Map();
  }

  /**
   * Handles extraction errors with recovery strategies
   *
   * @param {Error} error - The error that occurred
   * @param {object} context - Error context
   * @returns {object} Recovery result with partial data if available
   */
  handleExtractionError(error, context) {
    const classification = this.#classifyError(error);
    const strategy = this.#determineRecoveryStrategy(classification, context);

    this.#logger.warn(`Handling extraction error: ${error.message}`, {
      errorType: classification.type,
      strategy,
      context,
    });

    // Record error for pattern analysis
    const record = this.#recordError(error, classification, context);

    // Dispatch error event if event bus available
    if (this.#eventBus) {
      this.#eventBus.dispatch({
        type: 'MOD_VALIDATION_ERROR',
        payload: {
          error: error.message,
          errorType: classification.type,
          context,
          strategy,
        },
      });
    }

    // Apply recovery strategy
    try {
      const result = this.#applyRecoveryStrategy(
        strategy,
        error,
        context,
        classification
      );

      record.recoveryAttempted = true;
      record.recoverySuccessful =
        result.recoveryApplied && strategy !== RecoveryStrategy.RETRY;

      return result;
    } catch (strategyError) {
      record.recoveryAttempted = true;
      record.recoverySuccessful = false;
      throw strategyError;
    }
  }

  /**
   * Handles validation errors
   *
   * @param {Error} error - The error that occurred
   * @param {object} context - Error context
   * @returns {object} Recovery result
   */
  handleValidationError(error, context) {
    const classification = this.#classifyError(error);

    // Validation errors are often more serious
    if (classification.severity === 'CRITICAL') {
      this.#logger.error(`Critical validation error: ${error.message}`, {
        errorType: classification.type,
        context,
      });

      // For critical errors, fail fast
      throw error;
    }

    return this.handleExtractionError(error, context);
  }

  /**
   * Handles security violations
   *
   * @param {object} violation - Security violation details
   * @param {object} context - Violation context
   * @returns {object} Security response
   */
  handleSecurityViolation(violation, context) {
    const securityError = new ModSecurityError(
      violation.message || 'Security violation detected',
      violation.level || SecurityLevel.HIGH,
      context
    );

    // Log security incident
    this.#logger.error('Security violation detected', {
      violation,
      context,
      incidentReport: securityError.generateIncidentReport(),
    });

    // Security violations always fail fast
    throw securityError;
  }

  /**
   * Gets error statistics
   *
   * @returns {object} Error statistics
   */
  getErrorStatistics() {
    const stats = {
      totalErrors: this.#errorHistory.length,
      errorsByType: {},
      recoverySuccessRate: 0,
      recentErrors: [],
    };

    // Count errors by type
    for (const record of this.#errorHistory) {
      const type = record.classification.type;
      stats.errorsByType[type] = (stats.errorsByType[type] || 0) + 1;
    }

    // Calculate recovery success rate
    let recoveryAttempts = 0;
    let recoverySuccesses = 0;
    for (const record of this.#errorHistory) {
      if (record.recoveryAttempted) {
        recoveryAttempts++;
        if (record.recoverySuccessful) {
          recoverySuccesses++;
        }
      }
    }

    if (recoveryAttempts > 0) {
      stats.recoverySuccessRate = (recoverySuccesses / recoveryAttempts) * 100;
    }

    // Get recent errors (last 10)
    stats.recentErrors = this.#errorHistory.slice(-10).map((record) => ({
      timestamp: record.timestamp,
      type: record.classification.type,
      message: record.error.message,
      recovered: record.recoverySuccessful,
    }));

    return stats;
  }

  /**
   * Resets error tracking
   */
  reset() {
    this.#errorHistory = [];
    this.#recoveryAttempts.clear();
    this.#logger.debug('Error handler reset');
  }

  /**
   * Classifies an error
   *
   * @private
   * @param {Error} error - Error to classify
   * @returns {object} Classification with type, severity, and recoverable flag
   */
  #classifyError(error) {
    // Check if it's already a classified error
    if (error instanceof ModSecurityError) {
      return {
        type: ErrorType.SECURITY,
        severity: 'CRITICAL',
        recoverable: false,
        originalError: error,
      };
    }

    if (error instanceof ModCorruptionError) {
      return {
        type: ErrorType.CORRUPTION,
        severity: 'HIGH',
        recoverable: error.context?.canPartiallyRecover || false,
        originalError: error,
      };
    }

    if (error instanceof ModAccessError) {
      return {
        type: ErrorType.ACCESS,
        severity: 'MEDIUM',
        recoverable: error.recoverable,
        originalError: error,
      };
    }

    if (error instanceof ModValidationError) {
      return {
        type: ErrorType.SYNTAX,
        severity: 'MEDIUM',
        recoverable: error.recoverable,
        originalError: error,
      };
    }

    // Classify based on error message patterns
    const message = error.message?.toLowerCase() || '';

    if (message.includes('enoent') || message.includes('not found')) {
      return {
        type: ErrorType.ACCESS,
        severity: 'LOW',
        recoverable: true,
        originalError: error,
      };
    }

    if (message.includes('unexpected token') || message.includes('json')) {
      return {
        type: ErrorType.CORRUPTION,
        severity: 'MEDIUM',
        recoverable: false,
        originalError: error,
      };
    }

    if (message.includes('timeout') || message.includes('etimedout')) {
      return {
        type: ErrorType.TIMEOUT,
        severity: 'MEDIUM',
        recoverable: true,
        originalError: error,
      };
    }

    if (message.includes('memory') || message.includes('heap')) {
      return {
        type: ErrorType.RESOURCE,
        severity: 'HIGH',
        recoverable: false,
        originalError: error,
      };
    }

    // Default classification
    return {
      type: ErrorType.UNKNOWN,
      severity: 'MEDIUM',
      recoverable: true,
      originalError: error,
    };
  }

  /**
   * Determines recovery strategy based on error classification
   *
   * @private
   * @param {object} classification - Error classification
   * @param {object} context - Error context
   * @returns {string} Recovery strategy
   */
  #determineRecoveryStrategy(classification, context) {
    // Check retry attempts
    const retryKey = `${classification.type}-${context.filePath || context.modPath || 'unknown'}`;
    const retryCount = this.#recoveryAttempts.get(retryKey) || 0;

    // Security errors always fail fast or quarantine
    if (classification.type === ErrorType.SECURITY) {
      return RecoveryStrategy.QUARANTINE;
    }

    // Non-recoverable errors fail fast
    if (!classification.recoverable) {
      return RecoveryStrategy.FAIL_FAST;
    }

    if (context?.overrideStrategy) {
      return context.overrideStrategy;
    }

    // Check retry limit
    if (retryCount >= (this.#config.maxRetries || 3)) {
      return RecoveryStrategy.SKIP;
    }

    // Determine strategy by error type
    switch (classification.type) {
      case ErrorType.ACCESS:
        // File not found - skip or use default
        return context.hasDefault
          ? RecoveryStrategy.USE_DEFAULT
          : RecoveryStrategy.SKIP;

      case ErrorType.CORRUPTION:
        // Try partial recovery if possible
        return classification.recoverable
          ? RecoveryStrategy.PARTIAL_RESULT
          : RecoveryStrategy.SKIP;

      case ErrorType.TIMEOUT:
        // Retry timeouts up to limit
        return retryCount < 2 ? RecoveryStrategy.RETRY : RecoveryStrategy.SKIP;

      default:
        // Default to skip for unknown errors
        return RecoveryStrategy.SKIP;
    }
  }

  /**
   * Applies recovery strategy
   *
   * @private
   * @param {string} strategy - Recovery strategy to apply
   * @param {Error} error - Original error
   * @param {object} context - Error context
   * @param {object} classification - Error classification
   * @returns {object} Recovery result
   */
  #applyRecoveryStrategy(strategy, error, context, classification) {
    const result = {
      errorType: classification.type,
      recoveryApplied: true,
      strategy,
      partialResults: null,
      degradationApplied: false,
      message: `Applied ${strategy} strategy for ${classification.type} error`,
    };

    switch (strategy) {
      case RecoveryStrategy.RETRY:
        // Record retry attempt
        const retryKey = `${classification.type}-${context.filePath || context.modPath || 'unknown'}`;
        const retryCount = this.#recoveryAttempts.get(retryKey) || 0;
        this.#recoveryAttempts.set(retryKey, retryCount + 1);

        result.shouldRetry = true;
        result.retryCount = retryCount + 1;
        break;

      case RecoveryStrategy.SKIP:
        // Skip the problematic file/operation
        result.skipped = true;
        result.partialResults = context.partialData || {};
        result.degradationApplied = true;
        break;

      case RecoveryStrategy.USE_DEFAULT:
        // Use default values
        result.partialResults = context.defaultValue || {};
        result.degradationApplied = true;
        result.usedDefault = true;
        break;

      case RecoveryStrategy.PARTIAL_RESULT:
        // Return partial results if available
        result.partialResults = context.partialData || {};
        result.degradationApplied = true;
        break;

      case RecoveryStrategy.FAIL_FAST:
        // Re-throw the error
        result.recoveryApplied = false;
        throw error;

      case RecoveryStrategy.QUARANTINE:
        // Mark for quarantine and fail
        result.quarantined = true;
        result.recoveryApplied = false;
        throw error;

      default:
        // Unknown strategy - fail safe
        result.recoveryApplied = false;
        throw error;
    }

    return result;
  }

  /**
   * Records error for analysis
   *
   * @private
   * @param {Error} error - Error to record
   * @param {object} classification - Error classification
   * @param {object} context - Error context
   */
  #recordError(error, classification, context) {
    const record = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      classification,
      context,
      recoveryAttempted: false,
      recoverySuccessful: false,
    };

    this.#errorHistory.push(record);

    // Limit history size
    if (this.#errorHistory.length > 1000) {
      this.#errorHistory.shift();
    }

    return record;
  }
}

export { ModValidationErrorHandler };
export default ModValidationErrorHandler;
