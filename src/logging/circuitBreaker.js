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
   * Creates a new CircuitBreaker instance.
   *
   * @param {object} options - Configuration options
   * @param {number} [options.failureThreshold] - Number of failures before opening circuit
   * @param {number} [options.timeout] - Time in ms before attempting recovery
   * @param {number} [options.halfOpenMaxCalls] - Max calls to test in half-open state
   */
  constructor({
    failureThreshold = 5,
    timeout = 60000,
    halfOpenMaxCalls = 3,
  } = {}) {
    this.#state = CircuitBreakerState.CLOSED;
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#lastFailureTime = 0;
    this.#failureThreshold = failureThreshold;
    this.#timeout = timeout;
    this.#halfOpenMaxCalls = halfOpenMaxCalls;
    this.#halfOpenCallCount = 0;
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
    this.#checkStateTransition();

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
      // Record failure
      this.#recordFailure();

      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Records a successful operation and updates circuit state.
   */
  #recordSuccess() {
    this.#successCount++;

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
   */
  #recordFailure() {
    this.#failureCount++;
    this.#lastFailureTime = Date.now();

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
  #checkStateTransition() {
    if (this.#state === CircuitBreakerState.OPEN) {
      const timeSinceLastFailure = Date.now() - this.#lastFailureTime;

      if (timeSinceLastFailure >= this.#timeout) {
        this.#transitionToHalfOpen();
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
    return {
      state: this.#state,
      failureCount: this.#failureCount,
      successCount: this.#successCount,
      failureThreshold: this.#failureThreshold,
      timeout: this.#timeout,
      timeSinceLastFailure: this.#lastFailureTime
        ? Date.now() - this.#lastFailureTime
        : 0,
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
