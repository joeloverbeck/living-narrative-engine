/**
 * @file Retry strategy utility for anatomy visualization operations
 * @description Configurable retry logic with exponential backoff and circuit breaker patterns
 * @see src/domUI/visualizer/ErrorRecovery.js, src/domUI/visualizer/ErrorClassifier.js
 */

import { validateDependency } from '../../utils/index.js';
import { ErrorClassifier } from './ErrorClassifier.js';

/**
 * Utility class providing configurable retry strategies with exponential backoff,
 * circuit breaker patterns, and intelligent retry logic for anatomy visualization operations.
 *
 * @class RetryStrategy
 */
class RetryStrategy {
  #logger;
  #retryAttempts;
  #circuitBreakers;
  #defaultConfig;
  #disposed;

  /**
   * Retry strategy types
   *
   * @readonly
   */
  static STRATEGY_TYPES = {
    IMMEDIATE: 'immediate', // Retry immediately
    LINEAR: 'linear', // Linear backoff
    EXPONENTIAL: 'exponential', // Exponential backoff
    FIBONACCI: 'fibonacci', // Fibonacci backoff
    CUSTOM: 'custom', // Custom backoff function
  };

  /**
   * Circuit breaker states
   *
   * @readonly
   */
  static CIRCUIT_STATES = {
    CLOSED: 'closed', // Normal operation
    OPEN: 'open', // Failing, no retries allowed
    HALF_OPEN: 'half_open', // Testing if service recovered
  };

  /**
   * Create a new RetryStrategy instance
   *
   * @param {object} dependencies - Required dependencies
   * @param {object} dependencies.logger - Logging service
   * @param {object} defaultConfig - Default retry configuration
   * @param {number} defaultConfig.maxAttempts - Maximum retry attempts (default: 3)
   * @param {number} defaultConfig.baseDelayMs - Base delay in milliseconds (default: 1000)
   * @param {number} defaultConfig.maxDelayMs - Maximum delay in milliseconds (default: 30000)
   * @param {number} defaultConfig.jitterPercent - Jitter percentage (default: 0.1)
   * @param {string} defaultConfig.strategy - Default strategy type (default: 'exponential')
   * @param {number} defaultConfig.circuitBreakerThreshold - Circuit breaker failure threshold (default: 5)
   * @param {number} defaultConfig.circuitBreakerTimeoutMs - Circuit breaker timeout (default: 60000)
   */
  constructor(dependencies, defaultConfig = {}) {
    this.#logger = null;
    this.#disposed = false;

    // Validate dependencies
    validateDependency(dependencies.logger, 'logger');
    this.#logger = dependencies.logger;

    // State management
    this.#retryAttempts = new Map(); // operation -> { attempts, lastAttempt, failures }
    this.#circuitBreakers = new Map(); // operation -> { state, failures, lastFailure, timeout }

    // Default configuration
    this.#defaultConfig = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      jitterPercent: 0.1,
      strategy: RetryStrategy.STRATEGY_TYPES.EXPONENTIAL,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeoutMs: 60000,
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'TEMPORARY_ERROR'],
      ...defaultConfig,
    };
  }

  /**
   * Execute an operation with retry logic
   *
   * @param {string} operationId - Unique identifier for the operation
   * @param {Function} operation - Async function to execute
   * @param {object} config - Retry configuration (overrides defaults)
   * @param {number} config.maxAttempts - Maximum retry attempts
   * @param {number} config.baseDelayMs - Base delay in milliseconds
   * @param {number} config.maxDelayMs - Maximum delay in milliseconds
   * @param {number} config.jitterPercent - Jitter percentage
   * @param {string} config.strategy - Retry strategy type
   * @param {Function} config.customBackoff - Custom backoff function
   * @param {Function} config.retryCondition - Custom retry condition function
   * @param {object} config.context - Additional context for error handling
   * @returns {Promise<*>} Operation result
   */
  async execute(operationId, operation, config = {}) {
    this._throwIfDisposed();

    if (typeof operation !== 'function') {
      throw new Error('Operation must be a function');
    }

    const finalConfig = { ...this.#defaultConfig, ...config };

    // Check circuit breaker
    if (!this._isCircuitClosed(operationId)) {
      throw new Error(`Circuit breaker is open for operation: ${operationId}`);
    }

    let lastError = null;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        // Record attempt
        this._recordAttempt(operationId, attempt);

        // Execute operation
        const result = await operation();

        // Success - reset circuit breaker and attempts
        this._recordSuccess(operationId);
        this._resetRetryAttempts(operationId);

        this.#logger.debug(
          `Operation ${operationId} succeeded on attempt ${attempt}`
        );
        return result;
      } catch (error) {
        lastError = error;
        this._recordFailure(operationId, error);

        // Check if we should retry this error
        if (!this._shouldRetryError(error, finalConfig)) {
          this.#logger.debug(
            `Operation ${operationId} failed with non-retryable error:`,
            error.message
          );
          break;
        }

        // Check if this is the last attempt
        if (attempt >= finalConfig.maxAttempts) {
          this.#logger.debug(
            `Operation ${operationId} failed after ${attempt} attempts`
          );
          break;
        }

        // Calculate delay and wait
        const delay = this._calculateDelay(attempt, finalConfig);
        this.#logger.debug(
          `Operation ${operationId} failed on attempt ${attempt}, retrying in ${delay}ms`
        );
        await this._delay(delay);
      }
    }

    // All attempts failed
    const totalTime = Date.now() - startTime;
    this.#logger.warn(
      `Operation ${operationId} failed after ${finalConfig.maxAttempts} attempts in ${totalTime}ms`
    );

    // Update circuit breaker
    this._updateCircuitBreaker(operationId);

    throw lastError;
  }

  /**
   * Execute operation with simple retry (convenience method)
   *
   * @param {Function} operation - Operation to execute
   * @param {number} maxAttempts - Maximum attempts (default: 3)
   * @param {number} delayMs - Delay between attempts (default: 1000)
   * @returns {Promise<*>} Operation result
   */
  async executeSimple(operation, maxAttempts = 3, delayMs = 1000) {
    const operationId = `simple_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return this.execute(operationId, operation, {
      maxAttempts,
      baseDelayMs: delayMs,
      strategy: RetryStrategy.STRATEGY_TYPES.LINEAR,
    });
  }

  /**
   * Get retry statistics for an operation
   *
   * @param {string} operationId - Operation ID
   * @returns {object} Retry statistics
   */
  getRetryStatistics(operationId) {
    this._throwIfDisposed();

    const attempts = this.#retryAttempts.get(operationId);
    const circuitBreaker = this.#circuitBreakers.get(operationId);

    return {
      operationId,
      attempts: attempts ? attempts.attempts : 0,
      failures: attempts ? attempts.failures : 0,
      lastAttempt: attempts ? attempts.lastAttempt : null,
      circuitBreakerState: circuitBreaker
        ? circuitBreaker.state
        : RetryStrategy.CIRCUIT_STATES.CLOSED,
      circuitBreakerFailures: circuitBreaker ? circuitBreaker.failures : 0,
    };
  }

  /**
   * Reset retry attempts for an operation
   *
   * @param {string} operationId - Operation ID to reset
   */
  resetRetryAttempts(operationId) {
    this._throwIfDisposed();
    this._resetRetryAttempts(operationId);
  }

  /**
   * Reset circuit breaker for an operation
   *
   * @param {string} operationId - Operation ID to reset
   */
  resetCircuitBreaker(operationId) {
    this._throwIfDisposed();
    this.#circuitBreakers.delete(operationId);
    this.#logger.debug(`Circuit breaker reset for operation: ${operationId}`);
  }

  /**
   * Get circuit breaker status
   *
   * @param {string} operationId - Operation ID
   * @returns {object} Circuit breaker status
   */
  getCircuitBreakerStatus(operationId) {
    this._throwIfDisposed();

    const breaker = this.#circuitBreakers.get(operationId);
    if (!breaker) {
      return {
        state: RetryStrategy.CIRCUIT_STATES.CLOSED,
        failures: 0,
        lastFailure: null,
        nextAttemptAllowed: Date.now(),
      };
    }

    return {
      state: breaker.state,
      failures: breaker.failures,
      lastFailure: breaker.lastFailure,
      nextAttemptAllowed:
        breaker.state === RetryStrategy.CIRCUIT_STATES.OPEN
          ? breaker.lastFailure + this.#defaultConfig.circuitBreakerTimeoutMs
          : Date.now(),
    };
  }

  /**
   * Clean up old retry attempts and circuit breaker data
   *
   * @param {number} maxAgeMs - Maximum age in milliseconds (default: 1 hour)
   */
  cleanup(maxAgeMs = 3600000) {
    this._throwIfDisposed();

    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    // Clean up old retry attempts
    for (const [operationId, data] of this.#retryAttempts.entries()) {
      if (data.lastAttempt < cutoff) {
        this.#retryAttempts.delete(operationId);
        cleaned++;
      }
    }

    // Clean up old circuit breakers
    for (const [operationId, data] of this.#circuitBreakers.entries()) {
      if (data.lastFailure < cutoff) {
        this.#circuitBreakers.delete(operationId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.#logger.debug(
        `Cleaned up ${cleaned} old retry/circuit breaker entries`
      );
    }
  }

  /**
   * Dispose the retry strategy instance
   */
  dispose() {
    if (this.#disposed) {
      return;
    }

    this.#retryAttempts.clear();
    this.#circuitBreakers.clear();
    this.#disposed = true;
  }

  /**
   * Check if the instance is disposed
   *
   * @returns {boolean} True if disposed
   */
  isDisposed() {
    return this.#disposed;
  }

  /**
   * Check if circuit breaker is closed (operation allowed)
   *
   * @private
   * @param {string} operationId - Operation ID
   * @returns {boolean} True if circuit is closed
   */
  _isCircuitClosed(operationId) {
    const breaker = this.#circuitBreakers.get(operationId);
    if (!breaker) {
      return true; // No circuit breaker = closed
    }

    const now = Date.now();

    switch (breaker.state) {
      case RetryStrategy.CIRCUIT_STATES.CLOSED:
        return true;

      case RetryStrategy.CIRCUIT_STATES.OPEN:
        // Check if timeout has elapsed
        if (
          now >=
          breaker.lastFailure + this.#defaultConfig.circuitBreakerTimeoutMs
        ) {
          breaker.state = RetryStrategy.CIRCUIT_STATES.HALF_OPEN;
          this.#logger.debug(
            `Circuit breaker ${operationId} moved to HALF_OPEN state`
          );
          return true;
        }
        return false;

      case RetryStrategy.CIRCUIT_STATES.HALF_OPEN:
        return true;

      default:
        return true;
    }
  }

  /**
   * Record a retry attempt
   *
   * @private
   * @param {string} operationId - Operation ID
   * @param {number} attempt - Attempt number
   */
  _recordAttempt(operationId, attempt) {
    const now = Date.now();
    const existing = this.#retryAttempts.get(operationId);

    this.#retryAttempts.set(operationId, {
      attempts: attempt,
      failures: existing ? existing.failures : 0,
      lastAttempt: now,
    });
  }

  /**
   * Record a successful operation
   *
   * @private
   * @param {string} operationId - Operation ID
   */
  _recordSuccess(operationId) {
    // Reset circuit breaker on success
    const breaker = this.#circuitBreakers.get(operationId);
    if (breaker) {
      if (breaker.state === RetryStrategy.CIRCUIT_STATES.HALF_OPEN) {
        breaker.state = RetryStrategy.CIRCUIT_STATES.CLOSED;
        breaker.failures = 0;
        this.#logger.debug(
          `Circuit breaker ${operationId} moved to CLOSED state after success`
        );
      } else if (breaker.state === RetryStrategy.CIRCUIT_STATES.CLOSED) {
        breaker.failures = Math.max(0, breaker.failures - 1); // Gradual recovery
      }
    }
  }

  /**
   * Record a failed operation
   *
   * @private
   * @param {string} operationId - Operation ID
   * @param {Error} error - Error that occurred
   */
  _recordFailure(operationId, error) {
    const now = Date.now();

    // Update retry attempts
    const existing = this.#retryAttempts.get(operationId);
    if (existing) {
      existing.failures = (existing.failures || 0) + 1;
    }

    // Update circuit breaker
    let breaker = this.#circuitBreakers.get(operationId);
    if (!breaker) {
      breaker = {
        state: RetryStrategy.CIRCUIT_STATES.CLOSED,
        failures: 0,
        lastFailure: now,
      };
      this.#circuitBreakers.set(operationId, breaker);
    }

    breaker.failures++;
    breaker.lastFailure = now;
  }

  /**
   * Update circuit breaker state based on failures
   *
   * @private
   * @param {string} operationId - Operation ID
   */
  _updateCircuitBreaker(operationId) {
    const breaker = this.#circuitBreakers.get(operationId);
    if (!breaker) return;

    if (breaker.state === RetryStrategy.CIRCUIT_STATES.HALF_OPEN) {
      breaker.state = RetryStrategy.CIRCUIT_STATES.OPEN;
      this.#logger.debug(
        `Circuit breaker ${operationId} moved back to OPEN state after HALF_OPEN failure`
      );
      return;
    }

    if (breaker.failures >= this.#defaultConfig.circuitBreakerThreshold) {
      if (breaker.state !== RetryStrategy.CIRCUIT_STATES.OPEN) {
        breaker.state = RetryStrategy.CIRCUIT_STATES.OPEN;
        this.#logger.warn(
          `Circuit breaker ${operationId} moved to OPEN state after ${breaker.failures} failures`
        );
      }
    }
  }

  /**
   * Reset retry attempts for an operation
   *
   * @private
   * @param {string} operationId - Operation ID
   */
  _resetRetryAttempts(operationId) {
    this.#retryAttempts.delete(operationId);
  }

  /**
   * Check if an error should be retried
   *
   * @private
   * @param {Error} error - Error to check
   * @param {object} config - Retry configuration
   * @returns {boolean} True if error should be retried
   */
  _shouldRetryError(error, config) {
    // Use custom retry condition if provided
    if (config.retryCondition && typeof config.retryCondition === 'function') {
      return config.retryCondition(error);
    }

    // Use error classifier to determine retryability
    const classification = ErrorClassifier.classify(
      error,
      config.context || {}
    );
    if (classification.retryable !== undefined) {
      return classification.retryable;
    }

    // Check against configured retryable error types
    if (config.retryableErrors && Array.isArray(config.retryableErrors)) {
      return config.retryableErrors.some(
        (errorType) =>
          error.name.includes(errorType) ||
          error.message.includes(errorType) ||
          (error.code && error.code.includes(errorType))
      );
    }

    // Default retryable patterns
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /temporary/i,
      /unavailable/i,
      /rate limit/i,
      /fetch/i,
    ];

    return retryablePatterns.some(
      (pattern) => pattern.test(error.message) || pattern.test(error.name)
    );
  }

  /**
   * Calculate delay for next retry attempt
   *
   * @private
   * @param {number} attempt - Current attempt number
   * @param {object} config - Retry configuration
   * @returns {number} Delay in milliseconds
   */
  _calculateDelay(attempt, config) {
    let delay;

    switch (config.strategy) {
      case RetryStrategy.STRATEGY_TYPES.IMMEDIATE:
        delay = 0;
        break;

      case RetryStrategy.STRATEGY_TYPES.LINEAR:
        delay = config.baseDelayMs * attempt;
        break;

      case RetryStrategy.STRATEGY_TYPES.EXPONENTIAL:
        delay = config.baseDelayMs * Math.pow(2, attempt - 1);
        break;

      case RetryStrategy.STRATEGY_TYPES.FIBONACCI:
        delay = config.baseDelayMs * this._fibonacci(attempt);
        break;

      case RetryStrategy.STRATEGY_TYPES.CUSTOM:
        if (
          config.customBackoff &&
          typeof config.customBackoff === 'function'
        ) {
          delay = config.customBackoff(attempt, config.baseDelayMs);
        } else {
          delay = config.baseDelayMs;
        }
        break;

      default:
        delay = config.baseDelayMs;
    }

    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelayMs);

    // Apply jitter to avoid thundering herd
    if (config.jitterPercent > 0) {
      const jitter = delay * config.jitterPercent * (Math.random() - 0.5) * 2;
      delay = Math.max(0, delay + jitter);
    }

    return Math.floor(delay);
  }

  /**
   * Calculate Fibonacci number for retry delay
   *
   * @private
   * @param {number} n - Position in Fibonacci sequence
   * @returns {number} Fibonacci number
   */
  _fibonacci(n) {
    if (n <= 1) return 1;
    if (n === 2) return 1;

    let a = 1,
      b = 1;
    for (let i = 3; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }

  /**
   * Delay execution for specified milliseconds
   *
   * @private
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>} Promise that resolves after delay
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Throw error if instance is disposed
   *
   * @private
   */
  _throwIfDisposed() {
    if (this.#disposed) {
      throw new Error('RetryStrategy instance has been disposed');
    }
  }
}

export { RetryStrategy };
