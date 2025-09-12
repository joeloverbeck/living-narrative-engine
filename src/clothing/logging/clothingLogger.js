/**
 * @file Structured logging utility for clothing operations with performance metrics
 */

/**
 * Structured logger for clothing system operations
 * Provides consistent logging format with performance metrics and context preservation
 */
export class ClothingLogger {
  #baseLogger;
  #context;

  /**
   * @param {object} baseLogger - Base logger instance
   * @param {object} context - Additional context to include in all logs
   */
  constructor(baseLogger, context = {}) {
    this.#baseLogger = baseLogger;
    this.#context = context;
  }

  /**
   * Log clothing accessibility query with detailed context
   * @param {string} entityId - Entity ID
   * @param {object} options - Query options
   * @param {number} startTime - Performance start time
   * @param {Array} result - Query result
   */
  logAccessibilityQuery(entityId, options, startTime, result) {
    const duration = performance.now() - startTime;
    
    this.#baseLogger.debug('Clothing accessibility query', {
      operation: 'getAccessibleItems',
      entityId,
      queryOptions: options,
      resultCount: result?.length || 0,
      duration: `${duration.toFixed(2)}ms`,
      timestamp: new Date().toISOString(),
      ...this.#context
    });
  }

  /**
   * Log coverage analysis operation
   * @param {object} equipped - Equipment state
   * @param {string} entityId - Entity ID
   * @param {number} startTime - Performance start time
   * @param {object} result - Analysis result
   */
  logCoverageAnalysis(equipped, entityId, startTime, result) {
    const duration = performance.now() - startTime;
    const itemCount = Object.values(equipped).reduce((count, slot) => 
      count + Object.keys(slot || {}).length, 0
    );

    this.#baseLogger.debug('Coverage analysis performed', {
      operation: 'analyzeCoverageBlocking',
      entityId,
      itemCount,
      duration: `${duration.toFixed(2)}ms`,
      blockedItems: result?.blockedCount || 0,
      timestamp: new Date().toISOString(),
      ...this.#context
    });
  }

  /**
   * Log priority calculation operation
   * @param {string} layer - Clothing layer
   * @param {string} context - Calculation context
   * @param {object} modifiers - Priority modifiers
   * @param {number} result - Calculated priority
   * @param {boolean} cached - Whether result was cached
   */
  logPriorityCalculation(layer, context, modifiers, result, cached = false) {
    this.#baseLogger.debug('Priority calculation', {
      operation: 'calculatePriority',
      layer,
      context,
      modifiers,
      result,
      cached,
      timestamp: new Date().toISOString(),
      ...this.#context
    });
  }

  /**
   * Log service call with performance metrics
   * @param {string} serviceName - Name of the service
   * @param {string} method - Method name
   * @param {object} parameters - Call parameters
   * @param {number} startTime - Performance start time
   * @param {*} result - Call result
   * @param {Error} error - Error if occurred
   */
  logServiceCall(serviceName, method, parameters, startTime, result, error = null) {
    const duration = performance.now() - startTime;
    const logLevel = error ? 'error' : 'debug';
    
    this.#baseLogger[logLevel]('Clothing service call', {
      operation: 'serviceCall',
      serviceName,
      method,
      parameters: this.#sanitizeParameters(parameters),
      duration: `${duration.toFixed(2)}ms`,
      success: !error,
      error: error?.message,
      resultType: typeof result,
      timestamp: new Date().toISOString(),
      ...this.#context
    });
  }

  /**
   * Log cache operations
   * @param {string} operation - Cache operation type (hit, miss, set, clear)
   * @param {string} cacheKey - Cache key
   * @param {object} details - Additional details
   */
  logCacheOperation(operation, cacheKey, details = {}) {
    this.#baseLogger.debug('Cache operation', {
      operation: `cache_${operation}`,
      cacheKey,
      ...details,
      timestamp: new Date().toISOString(),
      ...this.#context
    });
  }

  /**
   * Log validation operations
   * @param {string} field - Field being validated
   * @param {*} value - Value being validated
   * @param {string} expectedType - Expected type
   * @param {boolean} valid - Whether validation passed
   */
  logValidation(field, value, expectedType, valid) {
    const logLevel = valid ? 'debug' : 'warn';
    
    this.#baseLogger[logLevel]('Validation result', {
      operation: 'validation',
      field,
      valueType: typeof value,
      expectedType,
      valid,
      timestamp: new Date().toISOString(),
      ...this.#context
    });
  }

  /**
   * Log error recovery attempt
   * @param {Error} error - Original error
   * @param {string} strategy - Recovery strategy used
   * @param {boolean} success - Whether recovery succeeded
   * @param {object} fallbackData - Fallback data used
   */
  logErrorRecovery(error, strategy, success, fallbackData = null) {
    const logLevel = success ? 'info' : 'warn';
    
    this.#baseLogger[logLevel]('Error recovery attempt', {
      operation: 'error_recovery',
      errorType: error.constructor.name,
      errorMessage: error.message,
      strategy,
      success,
      hasFallbackData: fallbackData !== null,
      timestamp: new Date().toISOString(),
      ...this.#context
    });
  }

  /**
   * Log performance warning when operation exceeds threshold
   * @param {string} operation - Operation name
   * @param {number} duration - Operation duration in ms
   * @param {number} threshold - Threshold in ms
   */
  logPerformanceWarning(operation, duration, threshold) {
    this.#baseLogger.warn('Performance threshold exceeded', {
      operation,
      duration: `${duration.toFixed(2)}ms`,
      threshold: `${threshold}ms`,
      exceeded: `${(duration - threshold).toFixed(2)}ms`,
      timestamp: new Date().toISOString(),
      ...this.#context
    });
  }

  /**
   * Create child logger with additional context
   * @param {object} additionalContext - Additional context to add
   * @returns {ClothingLogger} New logger instance with combined context
   */
  withContext(additionalContext) {
    return new ClothingLogger(this.#baseLogger, {
      ...this.#context,
      ...additionalContext
    });
  }

  /**
   * Sanitize parameters to remove sensitive or large data
   * @private
   * @param {*} params - Parameters to sanitize
   * @returns {*} Sanitized parameters
   */
  #sanitizeParameters(params) {
    if (!params || typeof params !== 'object') {
      return params;
    }

    const sanitized = { ...params };
    
    // Remove large data structures
    if (sanitized.equipped && Object.keys(sanitized.equipped).length > 5) {
      sanitized.equipped = `[${Object.keys(sanitized.equipped).length} slots]`;
    }
    
    // Remove sensitive fields if present
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
}

export default ClothingLogger;