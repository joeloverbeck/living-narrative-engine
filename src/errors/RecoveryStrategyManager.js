/**
 * @file RecoveryStrategyManager - Unified recovery strategy manager for error handling
 * @description Handles retry logic, circuit breaker integration, and fallback mechanisms
 * @see baseError.js - Foundation error class with recoverable property
 * @see MonitoringCoordinator.js - Circuit breaker integration
 * @see ../config/errorHandling.config.js - Centralized error handling configuration
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import {
  getErrorConfig,
  getRetryConfig,
  getCircuitBreakerConfig,
  getFallbackValue,
  isRetriable,
} from '../config/errorHandling.config.js';

/**
 * Recovery strategy manager that handles retry logic, circuit breaker integration,
 * and fallback mechanisms for error recovery
 *
 * @class
 */
class RecoveryStrategyManager {
  #logger;
  #strategies;
  #circuitBreakers;
  #fallbacks;
  #cache;
  #monitoringCoordinator;
  #defaultRetry;
  #defaultFallback;
  #defaultCircuitBreaker;

  constructor({ logger, monitoringCoordinator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });

    if (monitoringCoordinator) {
      validateDependency(
        monitoringCoordinator,
        'IMonitoringCoordinator',
        logger,
        {
          requiredMethods: ['getCircuitBreaker'],
        }
      );
    }

    this.#logger = logger;
    this.#monitoringCoordinator = monitoringCoordinator;
    this.#strategies = new Map();
    this.#circuitBreakers = new Map();
    this.#fallbacks = new Map();
    this.#cache = new Map();

    this.#initializeDefaultStrategies();
  }

  /**
   * Register a recovery strategy for an error type
   *
   * @param {string} errorType - Type of error to register strategy for
   * @param {object} strategy - Recovery strategy configuration
   * @param {object} [strategy.retry] - Retry configuration
   * @param {Function} [strategy.fallback] - Fallback function
   * @param {object} [strategy.circuitBreaker] - Circuit breaker configuration
   * @param {number} [strategy.maxRetries] - Maximum retry attempts
   * @param {string} [strategy.backoff] - Backoff strategy ('exponential', 'linear', 'constant')
   * @param {number} [strategy.timeout] - Operation timeout in milliseconds
   */
  registerStrategy(errorType, strategy) {
    // Get type-specific config from configuration
    const retryConfig = getRetryConfig(errorType);

    this.#strategies.set(errorType, {
      retry: strategy.retry || retryConfig,
      fallback: strategy.fallback || this.#defaultFallback,
      circuitBreaker: strategy.circuitBreaker || this.#defaultCircuitBreaker,
      maxRetries: strategy.maxRetries || retryConfig.maxAttempts,
      backoff:
        strategy.backoff ||
        (retryConfig.backoff ? retryConfig.backoff.type : 'exponential'),
      timeout: strategy.timeout || retryConfig.timeout || 5000,
    });
    this.#logger.debug(`Registered recovery strategy for ${errorType}`);
  }

  /**
   * Execute operation with full recovery capabilities
   *
   * @param {Function} operation - Operation to execute
   * @param {object} [options] - Execution options
   * @param {string} [options.operationName] - Name of the operation
   * @param {string} [options.errorType] - Expected error type for strategy lookup
   * @param {number} [options.maxRetries] - Maximum retry attempts
   * @param {string} [options.backoff] - Backoff strategy
   * @param {boolean} [options.useCircuitBreaker] - Whether to use circuit breaker
   * @param {boolean} [options.useFallback] - Whether to use fallback on failure
   * @param {boolean} [options.cacheResult] - Whether to cache successful results
   * @param {number} [options.timeout] - Operation timeout in milliseconds
   * @returns {Promise<*>} Result of the operation or fallback value
   */
  async executeWithRecovery(operation, options = {}) {
    // Get configuration for specific error type
    const errorTypeTemp = options.errorType || null;
    const retryConfig = errorTypeTemp
      ? getRetryConfig(errorTypeTemp)
      : getRetryConfig(null);
    const config = getErrorConfig();

    const {
      operationName = 'unknown',
      errorType = errorTypeTemp,
      maxRetries = retryConfig.maxAttempts,
      backoff = retryConfig.backoff ? retryConfig.backoff.type : 'exponential',
      useCircuitBreaker = true,
      useFallback = true,
      cacheResult = config.fallback.useCache,
      timeout = retryConfig.timeout || 5000,
    } = options;

    // Check cache first
    if (cacheResult && this.#cache.has(operationName)) {
      const cached = this.#cache.get(operationName);
      if (Date.now() - cached.timestamp < config.fallback.cacheTimeout) {
        this.#logger.debug(`Returning cached result for ${operationName}`);
        return cached.value;
      }
    }

    // Get circuit breaker if enabled
    const circuitBreaker =
      useCircuitBreaker && this.#monitoringCoordinator
        ? this.#monitoringCoordinator.getCircuitBreaker(operationName, {})
        : null;

    // Execute with circuit breaker if available
    if (circuitBreaker) {
      try {
        return await this.#executeWithCircuitBreaker(
          circuitBreaker,
          operation,
          { maxRetries, backoff, timeout, operationName, cacheResult }
        );
      } catch (error) {
        if (useFallback) {
          return await this.#executeFallback(operationName, error, errorType);
        }
        throw error;
      }
    }

    // Execute with retry logic
    try {
      const result = await this.#executeWithRetry(operation, {
        maxRetries,
        backoff,
        timeout,
        operationName,
      });

      if (cacheResult) {
        this.#cache.set(operationName, {
          value: result,
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (error) {
      if (useFallback) {
        return await this.#executeFallback(operationName, error, errorType);
      }
      throw error;
    }
  }

  /**
   * Execute with circuit breaker protection
   *
   * @param {object} circuitBreaker - Circuit breaker instance
   * @param {Function} operation - Operation to execute
   * @param {object} options - Execution options
   * @returns {Promise<*>} Result of the operation
   * @private
   */
  async #executeWithCircuitBreaker(circuitBreaker, operation, options) {
    return await circuitBreaker.execute(async () => {
      return await this.#executeWithRetry(operation, options);
    });
  }

  /**
   * Execute with retry logic
   *
   * @param {Function} operation - Operation to execute
   * @param {object} options - Retry options
   * @param {number} options.maxRetries - Maximum retry attempts
   * @param {string} options.backoff - Backoff strategy
   * @param {number} options.timeout - Operation timeout
   * @param {string} options.operationName - Operation name for logging
   * @returns {Promise<*>} Result of the operation
   * @private
   */
  async #executeWithRetry(operation, options) {
    const { maxRetries, backoff, timeout, operationName } = options;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout wrapper
        const result = await this.#withTimeout(operation(), timeout);

        this.#logger.debug(
          `Operation ${operationName} succeeded on attempt ${attempt}`
        );
        return result;
      } catch (error) {
        lastError = error;

        // Check if error is retriable
        if (!this.#isRetriable(error)) {
          this.#logger.warn(`Non-retriable error for ${operationName}`, {
            error: error.message,
          });
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = this.#calculateBackoff(attempt, backoff);
          this.#logger.debug(
            `Retrying ${operationName} after ${delay}ms (attempt ${attempt}/${maxRetries})`
          );
          await this.#wait(delay);
        }
      }
    }

    this.#logger.error(`All retry attempts failed for ${operationName}`, {
      attempts: maxRetries,
      lastError: lastError.message,
    });
    throw lastError;
  }

  /**
   * Execute fallback mechanism
   *
   * @param {string} operationName - Name of the operation
   * @param {Error} error - Original error that triggered fallback
   * @param {string} [errorType] - Error type for strategy lookup
   * @returns {Promise<*>} Fallback value
   * @private
   */
  async #executeFallback(operationName, error, errorType) {
    this.#logger.info(`Executing fallback for ${operationName}`);

    // Check for registered fallback
    const strategy = errorType ? this.#strategies.get(errorType) : null;
    if (strategy && strategy.fallback) {
      try {
        return await strategy.fallback(error, operationName);
      } catch (fallbackError) {
        this.#logger.error(`Fallback failed for ${operationName}`, {
          error: fallbackError.message,
        });
      }
    }

    // Use default fallback value
    const fallbackValue = this.#fallbacks.get(operationName);
    if (fallbackValue !== undefined) {
      return typeof fallbackValue === 'function'
        ? fallbackValue(error)
        : fallbackValue;
    }

    // Return generic fallback based on operation type
    return this.#getGenericFallback(operationName);
  }

  /**
   * Register fallback value for an operation
   *
   * @param {string} operationName - Name of the operation
   * @param {*} value - Fallback value or function
   */
  registerFallback(operationName, value) {
    this.#fallbacks.set(operationName, value);
    this.#logger.debug(`Registered fallback for ${operationName}`);
  }

  /**
   * Check if error is retriable based on BaseError.recoverable property and heuristics
   *
   * @param {Error} error - Error to check
   * @returns {boolean} Whether the error is retriable
   * @private
   */
  #isRetriable(error) {
    // Check if error extends BaseError and has recoverable flag
    if (error.recoverable !== undefined) {
      return error.recoverable;
    }

    // Check for specific non-retriable error types
    const nonRetriableErrors = [
      'ValidationError',
      'ConfigurationError',
      'InitializationError',
      'AuthenticationError',
      'AuthorizationError',
    ];

    if (nonRetriableErrors.includes(error.constructor.name)) {
      return false;
    }

    // Check for specific error codes
    const nonRetriableCodes = [
      'INVALID_ARGUMENT',
      'PERMISSION_DENIED',
      'NOT_FOUND',
      'ALREADY_EXISTS',
    ];

    if (error.code && nonRetriableCodes.includes(error.code)) {
      return false;
    }

    // Default to retriable for network and timeout errors
    const retriableMessages = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'timeout',
    ];

    if (
      retriableMessages.some(
        (msg) => error.message && error.message.includes(msg)
      )
    ) {
      return true;
    }

    // Default to retriable for unknown error types (be conservative)
    return true;
  }

  /**
   * Calculate backoff delay based on strategy
   *
   * @param {number} attempt - Current attempt number
   * @param {string} strategy - Backoff strategy
   * @returns {number} Delay in milliseconds
   * @private
   */
  #calculateBackoff(attempt, strategy) {
    const baseDelay = 100; // Base delay in ms

    switch (strategy) {
      case 'exponential': {
        // Exponential backoff with jitter
        const exponentialDelay = Math.min(
          baseDelay * Math.pow(2, attempt - 1),
          30000
        );
        const jitter = Math.random() * exponentialDelay * 0.1; // 10% jitter
        return exponentialDelay + jitter;
      }

      case 'linear':
        // Linear backoff
        return baseDelay * attempt;

      case 'constant':
        // Constant delay
        return baseDelay;

      default:
        // Default to exponential
        return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
    }
  }

  /**
   * Wait for specified milliseconds
   *
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise<void>} Promise that resolves after delay
   * @private
   */
  #wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Add timeout to promise
   *
   * @param {Promise} promise - Promise to add timeout to
   * @param {number} ms - Timeout in milliseconds
   * @returns {Promise<*>} Promise with timeout
   * @private
   */
  #withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${ms}ms`)),
          ms
        )
      ),
    ]);
  }

  /**
   * Get generic fallback value based on operation name heuristics
   *
   * @param {string} operationName - Name of the operation
   * @returns {*} Generic fallback value
   * @private
   */
  #getGenericFallback(operationName) {
    // Infer fallback based on operation name
    if (operationName.includes('fetch') || operationName.includes('get')) {
      return null;
    }
    if (operationName.includes('list') || operationName.includes('array')) {
      return [];
    }
    if (operationName.includes('count') || operationName.includes('size')) {
      return 0;
    }
    if (operationName.includes('validate') || operationName.includes('check')) {
      return false;
    }
    if (
      operationName.includes('generate') ||
      operationName.includes('create')
    ) {
      return {};
    }

    return null;
  }

  /**
   * Initialize default strategies from configuration
   *
   * @private
   */
  #initializeDefaultStrategies() {
    const config = getErrorConfig();

    // Default retry strategy from config
    this.#defaultRetry = {
      maxRetries: config.retry.default.maxAttempts,
      backoff: config.retry.default.backoff.type,
    };

    // Default fallback strategy
    this.#defaultFallback = (error, operation) => {
      this.#logger.warn(`Using default fallback for ${operation}`);
      // Use configuration-based fallback
      return getFallbackValue(null, operation);
    };

    // Default circuit breaker config from configuration
    this.#defaultCircuitBreaker = {
      failureThreshold: config.circuitBreaker.default.failureThreshold,
      resetTimeout: config.circuitBreaker.default.timeout,
    };
  }

  /**
   * Get current metrics for monitoring and debugging
   *
   * @returns {object} Current metrics
   */
  getMetrics() {
    return {
      registeredStrategies: this.#strategies.size,
      registeredFallbacks: this.#fallbacks.size,
      cacheSize: this.#cache.size,
      circuitBreakers: this.#circuitBreakers.size,
    };
  }

  /**
   * Clear cached results
   */
  clearCache() {
    this.#cache.clear();
    this.#logger.debug('Recovery strategy cache cleared');
  }
}

export default RecoveryStrategyManager;
