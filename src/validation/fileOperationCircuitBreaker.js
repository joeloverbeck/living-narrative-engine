/**
 * @file Circuit breaker for file operations
 * @description Implements circuit breaker pattern to prevent cascade failures
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * Circuit breaker states
 *
 * @enum {string}
 */
export const CircuitBreakerState = {
  CLOSED: 'CLOSED', // Normal operation
  OPEN: 'OPEN', // Failing fast
  HALF_OPEN: 'HALF_OPEN', // Testing recovery
};

/**
 * Circuit breaker error
 */
class CircuitBreakerError extends Error {
  constructor(message, state, context) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.state = state;
    this.context = context;
  }
}

/**
 * Implements circuit breaker pattern for file operations
 */
class FileOperationCircuitBreaker {
  #config;
  #logger;
  #state;
  #failureCount;
  #successCount;
  #lastFailureTime;
  #lastStateChange;
  #halfOpenTimer;
  #monitoringWindow;
  #failureTimestamps;

  /**
   * Creates a new FileOperationCircuitBreaker instance
   *
   * @param {object} dependencies - Dependencies
   * @param {object} dependencies.config - Circuit breaker configuration
   * @param {import('../utils/loggerUtils.js').ILogger} [dependencies.logger] - Optional logger
   */
  constructor({ config, logger = console }) {
    this.#config = config || {};
    this.#logger = logger;

    // Configuration with defaults
    this.failureThreshold = this.#config.failureThreshold || 5;
    this.recoveryTimeout = this.#config.recoveryTimeout || 60000; // 1 minute
    this.monitoringWindow = this.#config.monitoringWindow || 300000; // 5 minutes
    this.successThreshold = this.#config.successThreshold || 3;
    this.halfOpenTimeout = this.#config.halfOpenTimeout || 30000; // 30 seconds

    // Initialize state
    this.#state = CircuitBreakerState.CLOSED;
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#lastFailureTime = null;
    this.#lastStateChange = Date.now();
    this.#halfOpenTimer = null;
    this.#failureTimestamps = [];

    this.#logger.debug('Circuit breaker initialized', {
      failureThreshold: this.failureThreshold,
      recoveryTimeout: this.recoveryTimeout,
    });
  }

  /**
   * Gets the current state of the circuit breaker
   *
   * @returns {string} Current state
   */
  get state() {
    return this.#state;
  }

  /**
   * Gets circuit breaker statistics
   *
   * @returns {object} Statistics
   */
  getStats() {
    const now = Date.now();
    const timeUntilRetry = this.#getTimeUntilRetry();
    return {
      state: this.#state,
      failureCount: this.#failureCount,
      successCount: this.#successCount,
      lastFailureTime: this.#lastFailureTime
        ? new Date(this.#lastFailureTime).toISOString()
        : null,
      timeSinceLastFailure: this.#lastFailureTime
        ? now - this.#lastFailureTime
        : null,
      stateAge: now - this.#lastStateChange,
      recentFailures: this.#getRecentFailureCount(),
      timeUntilRetry,
      canAttempt: this.#canAttemptOperation(),
    };
  }

  /**
   * Executes an operation with circuit breaker protection
   *
   * @param {Function} operation - Async operation to execute
   * @param {object} [context] - Operation context for logging
   * @returns {Promise<any>} Operation result
   * @throws {CircuitBreakerError|Error} Circuit breaker error or operation error
   */
  async executeOperation(operation, context = {}) {
    // Check if we can attempt the operation
    if (!this.#canAttemptOperation()) {
      const error = new CircuitBreakerError(
        'Circuit breaker is OPEN - failing fast',
        this.#state,
        {
          ...context,
          failureCount: this.#failureCount,
          lastFailureTime: this.#lastFailureTime,
          timeUntilRetry: this.#getTimeUntilRetry(),
        }
      );

      this.#logger.warn('Circuit breaker rejecting operation', error.context);
      throw error;
    }

    try {
      // Attempt the operation
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;

      // Record success
      this.#recordSuccess(duration, context);

      return result;
    } catch (error) {
      // Record failure
      this.#recordFailure(error, context);

      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Manually resets the circuit breaker
   */
  reset() {
    const previousState = this.#state;

    this.#state = CircuitBreakerState.CLOSED;
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#lastFailureTime = null;
    this.#lastStateChange = Date.now();
    this.#failureTimestamps = [];

    clearTimeout(this.#halfOpenTimer);
    this.#halfOpenTimer = null;

    this.#logger.info('Circuit breaker manually reset', {
      previousState,
      newState: this.#state,
    });
  }

  /**
   * Manually opens the circuit breaker
   *
   * @param {string} [reason] - Reason for opening
   */
  open(reason = 'Manual open') {
    this.#transitionToOpen(reason);
  }

  /**
   * Checks if an operation can be attempted
   *
   * @private
   * @returns {boolean} True if operation can be attempted
   */
  #canAttemptOperation() {
    // Update state based on timeouts
    this.#checkStateTransitions();

    return (
      this.#state === CircuitBreakerState.CLOSED ||
      this.#state === CircuitBreakerState.HALF_OPEN
    );
  }

  /**
   * Records a successful operation
   *
   * @private
   * @param {number} duration - Operation duration in ms
   * @param {object} context - Operation context
   */
  #recordSuccess(duration, context) {
    this.#successCount++;

    this.#logger.debug('Circuit breaker operation succeeded', {
      state: this.#state,
      successCount: this.#successCount,
      duration,
      ...context,
    });

    switch (this.#state) {
      case CircuitBreakerState.HALF_OPEN:
        // Check if we've had enough successes to close
        if (this.#successCount >= this.successThreshold) {
          this.#transitionToClosed('Success threshold reached');
        }
        break;

      case CircuitBreakerState.CLOSED:
        // Reset failure count on successful operations
        if (this.#failureCount > 0) {
          this.#failureCount = 0;
          this.#failureTimestamps = [];
        }
        break;
    }
  }

  /**
   * Records a failed operation
   *
   * @private
   * @param {Error} error - The error that occurred
   * @param {object} context - Operation context
   */
  #recordFailure(error, context) {
    const now = Date.now();
    this.#failureCount++;
    this.#lastFailureTime = now;
    this.#failureTimestamps.push(now);

    // Clean old failure timestamps outside monitoring window
    this.#cleanOldFailures();

    this.#logger.warn('Circuit breaker operation failed', {
      state: this.#state,
      failureCount: this.#failureCount,
      recentFailures: this.#getRecentFailureCount(),
      error: error.message,
      ...context,
    });

    switch (this.#state) {
      case CircuitBreakerState.CLOSED:
        // Check if we should open the circuit
        if (this.#getRecentFailureCount() >= this.failureThreshold) {
          this.#transitionToOpen('Failure threshold exceeded');
        }
        break;

      case CircuitBreakerState.HALF_OPEN:
        // Any failure in half-open state reopens the circuit
        this.#transitionToOpen('Failure in half-open state');
        break;
    }
  }

  /**
   * Transitions to OPEN state
   *
   * @private
   * @param {string} reason - Reason for opening
   */
  #transitionToOpen(reason) {
    const previousState = this.#state;
    this.#state = CircuitBreakerState.OPEN;
    this.#lastStateChange = Date.now();
    this.#successCount = 0;

    // Clear any existing timer
    clearTimeout(this.#halfOpenTimer);

    // Schedule transition to half-open
    this.#halfOpenTimer = setTimeout(() => {
      this.#transitionToHalfOpen();
    }, this.recoveryTimeout);

    this.#logger.error('Circuit breaker opened', {
      reason,
      previousState,
      failureCount: this.#failureCount,
      recentFailures: this.#getRecentFailureCount(),
      recoveryTimeout: this.recoveryTimeout,
    });
  }

  /**
   * Transitions to HALF_OPEN state
   *
   * @private
   */
  #transitionToHalfOpen() {
    const previousState = this.#state;
    this.#state = CircuitBreakerState.HALF_OPEN;
    this.#lastStateChange = Date.now();
    this.#successCount = 0;
    this.#failureCount = 0;

    this.#logger.info('Circuit breaker half-open', {
      previousState,
      successThreshold: this.successThreshold,
    });

    // Set timeout for half-open state
    clearTimeout(this.#halfOpenTimer);

    this.#halfOpenTimer = setTimeout(() => {
      // If still in half-open after timeout, reopen
      if (this.#state === CircuitBreakerState.HALF_OPEN) {
        this.#transitionToOpen('Half-open timeout');
      }
    }, this.halfOpenTimeout);
  }

  /**
   * Transitions to CLOSED state
   *
   * @private
   * @param {string} reason - Reason for closing
   */
  #transitionToClosed(reason) {
    const previousState = this.#state;
    this.#state = CircuitBreakerState.CLOSED;
    this.#lastStateChange = Date.now();
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#failureTimestamps = [];

    // Clear timer
    clearTimeout(this.#halfOpenTimer);
    this.#halfOpenTimer = null;

    this.#logger.info('Circuit breaker closed', {
      reason,
      previousState,
    });
  }

  /**
   * Checks if state transitions are needed
   *
   * @private
   */
  #checkStateTransitions() {
    const now = Date.now();

    if (this.#state === CircuitBreakerState.OPEN) {
      // Check if recovery timeout has passed
      if (
        this.#lastFailureTime &&
        now - this.#lastFailureTime >= this.recoveryTimeout
      ) {
        this.#transitionToHalfOpen();
      }
    }
  }

  /**
   * Gets the number of recent failures within the monitoring window
   *
   * @private
   * @returns {number} Recent failure count
   */
  #getRecentFailureCount() {
    const now = Date.now();
    const windowStart = now - this.monitoringWindow;

    return this.#failureTimestamps.filter(
      (timestamp) => timestamp >= windowStart
    ).length;
  }

  /**
   * Cleans old failure timestamps outside the monitoring window
   *
   * @private
   */
  #cleanOldFailures() {
    const now = Date.now();
    const windowStart = now - this.monitoringWindow;

    this.#failureTimestamps = this.#failureTimestamps.filter(
      (timestamp) => timestamp >= windowStart
    );
  }

  /**
   * Gets time until retry is allowed
   *
   * @private
   * @returns {number|null} Milliseconds until retry, or null if retry is allowed
   */
  #getTimeUntilRetry() {
    if (this.#state !== CircuitBreakerState.OPEN) {
      return null;
    }

    if (!this.#lastFailureTime) {
      return null;
    }

    const now = Date.now();
    const timeSinceFailure = now - this.#lastFailureTime;
    const timeUntilRetry = this.recoveryTimeout - timeSinceFailure;

    return timeUntilRetry > 0 ? timeUntilRetry : null;
  }
}

export { FileOperationCircuitBreaker, CircuitBreakerError };
export default FileOperationCircuitBreaker;
