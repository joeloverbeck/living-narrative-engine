/**
 * @file Circuit breaker implementation for network resilience and failure handling
 * @see remoteLogger.js
 */

/**
 * Circuit breaker states
 *
 * @enum {string}
 */
export const CircuitBreakerState = {
  CLOSED: 'closed', // Normal operation, requests allowed
  OPEN: 'open', // Too many failures, requests blocked
  HALF_OPEN: 'half_open', // Testing with limited requests
};

/**
 * Circuit breaker for network resilience and graceful failure handling.
 * Implements the circuit breaker pattern to prevent cascade failures.
 *
 * States:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Failures exceed threshold, requests are blocked
 * - HALF_OPEN: Test mode, single request allowed to check recovery
 */
class CircuitBreaker {
  /**
   * @private
   * @type {string}
   */
  #state;

  /**
   * @private
   * @type {number}
   */
  #failureCount;

  /**
   * @private
   * @type {number}
   */
  #successCount;

  /**
   * @private
   * @type {number}
   */
  #lastFailureTime;

  /**
   * @private
   * @type {number}
   */
  #failureThreshold;

  /**
   * @private
   * @type {number}
   */
  #timeout;

  /**
   * @private
   * @type {number}
   */
  #halfOpenMaxCalls;

  /**
   * @private
   * @type {number}
   */
  #halfOpenCallCount;

  /**
   * @private
   * @type {Function|null}
   */
  #healthCheck;

  /**
   * @private
   * @type {number}
   */
  #exponentialBackoffBase;

  /**
   * @private
   * @type {number}
   */
  #maxBackoffTime;

  /**
   * @private
   * @type {number}
   */
  #successThresholdForIncrease;

  /**
   * @private
   * @type {number}
   */
  #consecutiveSuccesses;

  /**
   * @private
   * @type {number}
   */
  #consecutiveFailures;

  /**
   * @private
   * @type {number}
   */
  #baseFailureThreshold;

  /**
   * @private
   * @type {number}
   */
  #networkFailureCount;

  /**
   * @private
   * @type {number}
   */
  #serverFailureCount;

  /**
   * Creates a new CircuitBreaker instance.
   *
   * @param {object} options - Configuration options
   * @param {number} [options.failureThreshold] - Number of failures before opening circuit
   * @param {number} [options.timeout] - Time in ms before attempting recovery
   * @param {number} [options.halfOpenMaxCalls] - Max calls to test in half-open state
   * @param {Function} [options.healthCheck] - Optional health check function
   * @param {number} [options.exponentialBackoffBase] - Base multiplier for exponential backoff (default: 2)
   * @param {number} [options.maxBackoffTime] - Maximum backoff time in ms (default: 5 minutes)
   * @param {number} [options.successThresholdForIncrease] - Successes needed to increase adaptive threshold
   */
  constructor({
    failureThreshold = 5,
    timeout = 60000,
    halfOpenMaxCalls = 3,
    healthCheck = null,
    exponentialBackoffBase = 2,
    maxBackoffTime = 5 * 60 * 1000, // 5 minutes
    successThresholdForIncrease = 20,
  } = {}) {
    this.#state = CircuitBreakerState.CLOSED;
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#lastFailureTime = 0;
    this.#failureThreshold = failureThreshold;
    this.#timeout = timeout;
    this.#halfOpenMaxCalls = halfOpenMaxCalls;
    this.#halfOpenCallCount = 0;
    
    // Enhanced features
    this.#healthCheck = healthCheck;
    this.#exponentialBackoffBase = exponentialBackoffBase;
    this.#maxBackoffTime = maxBackoffTime;
    this.#successThresholdForIncrease = successThresholdForIncrease;
    this.#consecutiveSuccesses = 0;
    this.#consecutiveFailures = 0;
    this.#baseFailureThreshold = failureThreshold;
    this.#networkFailureCount = 0;
    this.#serverFailureCount = 0;
  }

  /**
   * Executes a function with circuit breaker protection.
   *
   * @param {Function} fn - Async function to execute
   * @returns {Promise<any>} Result of the function execution
   * @throws {Error} When circuit is open or function fails
   */
  async execute(fn) {
    if (!fn || typeof fn !== 'function') {
      throw new Error('Function is required and must be callable');
    }

    // Check if circuit should transition from open to half-open
    await this.#checkStateTransition();

    // Block requests if circuit is open
    if (this.#state === CircuitBreakerState.OPEN) {
      throw new Error('Circuit breaker is OPEN - requests blocked');
    }

    // In half-open state, limit number of test calls
    if (this.#state === CircuitBreakerState.HALF_OPEN) {
      this.#halfOpenCallCount++;
      if (this.#halfOpenCallCount > this.#halfOpenMaxCalls) {
        throw new Error('Circuit breaker is HALF_OPEN - test limit exceeded');
      }
    }

    try {
      // Execute the function
      const result = await fn();

      // Record success
      this.#recordSuccess();

      return result;
    } catch (error) {
      // Record failure with error context
      this.#recordFailure(error);

      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Records a successful operation and updates circuit state.
   */
  #recordSuccess() {
    this.#successCount++;
    this.#consecutiveSuccesses++;
    this.#consecutiveFailures = 0;

    // Adjust adaptive threshold based on success pattern
    if (this.#consecutiveSuccesses >= this.#successThresholdForIncrease) {
      this.#increaseAdaptiveThreshold();
      this.#consecutiveSuccesses = 0;
    }

    if (this.#state === CircuitBreakerState.HALF_OPEN) {
      // If we have enough successful calls in half-open, close the circuit
      if (this.#successCount >= this.#halfOpenMaxCalls) {
        this.#transitionToClosed();
      }
    } else if (this.#state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success in closed state
      this.#failureCount = 0;
    }
  }

  /**
   * Records a failed operation and updates circuit state.
   *
   * @param {Error} [error] - The error that caused the failure
   */
  #recordFailure(error = null) {
    this.#failureCount++;
    this.#consecutiveFailures++;
    this.#consecutiveSuccesses = 0;
    this.#lastFailureTime = Date.now();

    // Classify error type for better decision making
    if (error && this.#isNetworkError(error)) {
      this.#networkFailureCount++;
    } else {
      this.#serverFailureCount++;
    }

    // Adjust failure threshold adaptively based on failure pattern
    this.#adjustAdaptiveThreshold();

    if (this.#state === CircuitBreakerState.CLOSED) {
      // Check if we should open the circuit
      if (this.#failureCount >= this.#failureThreshold) {
        this.#transitionToOpen();
      }
    } else if (this.#state === CircuitBreakerState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit
      this.#transitionToOpen();
    }
  }

  /**
   * Checks if the circuit should transition from open to half-open.
   *
   * @private
   */
  async #checkStateTransition() {
    if (this.#state === CircuitBreakerState.OPEN) {
      const timeSinceLastFailure = Date.now() - this.#lastFailureTime;
      const backoffTime = this.#calculateExponentialBackoff();

      if (timeSinceLastFailure >= backoffTime) {
        // If health check is provided, run it before transitioning
        if (this.#healthCheck) {
          try {
            const healthResult = await this.#healthCheck();
            if (healthResult) {
              this.#transitionToHalfOpen();
            }
            // If health check fails, wait for next check cycle
          } catch {
            // Health check failed, update last failure time to delay next attempt
            this.#lastFailureTime = Date.now();
          }
        } else {
          // No health check, transition based on time only
          this.#transitionToHalfOpen();
        }
      }
    }
  }

  /**
   * Transitions circuit to closed state.
   *
   * @private
   */
  #transitionToClosed() {
    this.#state = CircuitBreakerState.CLOSED;
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#halfOpenCallCount = 0;
    // Don't reset consecutive success counters - we want to continue tracking for adaptive threshold
  }

  /**
   * Transitions circuit to open state.
   *
   * @private
   */
  #transitionToOpen() {
    this.#state = CircuitBreakerState.OPEN;
    this.#successCount = 0;
    this.#halfOpenCallCount = 0;
    this.#lastFailureTime = Date.now();
  }

  /**
   * Transitions circuit to half-open state.
   *
   * @private
   */
  #transitionToHalfOpen() {
    this.#state = CircuitBreakerState.HALF_OPEN;
    this.#successCount = 0;
    this.#halfOpenCallCount = 0;
  }

  /**
   * Calculates exponential backoff time based on consecutive failures.
   *
   * @private
   * @returns {number} Backoff time in milliseconds
   */
  #calculateExponentialBackoff() {
    // Calculate exponential backoff: base^failures * timeout, capped at maxBackoffTime
    const exponentialMultiplier = Math.pow(this.#exponentialBackoffBase, this.#consecutiveFailures);
    const backoffTime = Math.min(
      this.#timeout * exponentialMultiplier,
      this.#maxBackoffTime
    );
    
    // Add jitter to prevent thundering herd (±10% random variation)
    const jitter = (Math.random() - 0.5) * 0.2; // -0.1 to 0.1
    return Math.max(this.#timeout, backoffTime * (1 + jitter));
  }

  /**
   * Determines if an error is network-related.
   *
   * @private
   * @param {Error} error - The error to classify
   * @returns {boolean} True if error is network-related
   */
  #isNetworkError(error) {
    if (!error) return false;
    
    // Check error properties for network indicators
    const networkIndicators = [
      'NetworkError',
      'NETWORK_ERROR',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'fetch'
    ];
    
    return networkIndicators.some(indicator => 
      error.name === indicator ||
      error.code === indicator ||
      error.message?.includes(indicator)
    );
  }

  /**
   * Adjusts the failure threshold based on failure patterns.
   *
   * @private
   */
  #adjustAdaptiveThreshold() {
    // If we're seeing mostly network errors, be more tolerant
    const totalFailures = this.#networkFailureCount + this.#serverFailureCount;
    if (totalFailures > 10) {
      const networkRatio = this.#networkFailureCount / totalFailures;
      
      // If >70% network errors, increase threshold (network issues should be more tolerated)
      if (networkRatio > 0.7) {
        this.#failureThreshold = Math.min(
          this.#baseFailureThreshold * 2,
          this.#baseFailureThreshold + 5
        );
      }
      // If <30% network errors (mostly server errors), decrease threshold
      else if (networkRatio < 0.3) {
        this.#failureThreshold = Math.max(
          Math.floor(this.#baseFailureThreshold * 0.7),
          3 // Minimum threshold
        );
      }
    }
  }

  /**
   * Increases the failure threshold after sustained success.
   *
   * @private
   */
  #increaseAdaptiveThreshold() {
    // After sustained success, gradually increase tolerance
    this.#failureThreshold = Math.min(
      this.#failureThreshold + 1,
      this.#baseFailureThreshold * 3 // Cap at 3x original
    );
  }

  /**
   * Gets the current circuit breaker state.
   *
   * @returns {string} Current state (closed, open, half_open)
   */
  getState() {
    return this.#state;
  }

  /**
   * Gets circuit breaker statistics.
   *
   * @returns {object} Statistics including failure count, success count, and state
   */
  getStats() {
    const timeSinceLastFailure = this.#lastFailureTime
      ? Date.now() - this.#lastFailureTime
      : 0;
      
    return {
      state: this.#state,
      failureCount: this.#failureCount,
      successCount: this.#successCount,
      failureThreshold: this.#failureThreshold,
      baseFailureThreshold: this.#baseFailureThreshold,
      timeout: this.#timeout,
      timeSinceLastFailure,
      nextBackoffTime: this.#state === CircuitBreakerState.OPEN 
        ? Math.max(0, this.#calculateExponentialBackoff() - timeSinceLastFailure)
        : 0,
      consecutiveSuccesses: this.#consecutiveSuccesses,
      consecutiveFailures: this.#consecutiveFailures,
      networkFailureCount: this.#networkFailureCount,
      serverFailureCount: this.#serverFailureCount,
      hasHealthCheck: this.#healthCheck !== null,
    };
  }

  /**
   * Resets the circuit breaker to initial state.
   * Useful for testing or manual recovery scenarios.
   */
  reset() {
    this.#state = CircuitBreakerState.CLOSED;
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#lastFailureTime = 0;
    this.#halfOpenCallCount = 0;
    this.#consecutiveSuccesses = 0;
    this.#consecutiveFailures = 0;
    this.#failureThreshold = this.#baseFailureThreshold;
    this.#networkFailureCount = 0;
    this.#serverFailureCount = 0;
  }

  /**
   * Forces the circuit to open state.
   * Useful for maintenance or emergency situations.
   */
  forceOpen() {
    this.#transitionToOpen();
  }

  /**
   * Forces the circuit to closed state.
   * Use with caution - should only be used when you're certain the service has recovered.
   */
  forceClosed() {
    this.#transitionToClosed();
  }
}

export default CircuitBreaker;
