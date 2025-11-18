/**
 * @file Circuit breaker implementation for clothing services
 */

import { ClothingServiceError } from '../errors/clothingErrors.js';

/**
 * Circuit breaker states
 *
 * @enum {string}
 */
export const CircuitBreakerState = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

/**
 * Circuit breaker implementation for protecting service calls
 * Prevents cascading failures by failing fast when services are unavailable
 */
export class CircuitBreaker {
  #serviceName;
  #failureThreshold;
  #resetTimeout;
  #state;
  #failureCount;
  #lastFailureTime;
  #logger;
  #successCount;
  #halfOpenSuccessThreshold;

  /**
   * @param {string} serviceName - Name of the service being protected
   * @param {number} failureThreshold - Number of failures before opening circuit
   * @param {number} resetTimeout - Time in ms before attempting to close circuit
   * @param {object} logger - Logger instance
   * @param {number} halfOpenSuccessThreshold - Successes needed to close from half-open
   */
  constructor(
    serviceName, 
    failureThreshold = 5, 
    resetTimeout = 60000, 
    logger,
    halfOpenSuccessThreshold = 2
  ) {
    this.#serviceName = serviceName;
    this.#failureThreshold = failureThreshold;
    this.#resetTimeout = resetTimeout;
    this.#state = CircuitBreakerState.CLOSED;
    this.#failureCount = 0;
    this.#lastFailureTime = null;
    this.#logger = logger;
    this.#successCount = 0;
    this.#halfOpenSuccessThreshold = halfOpenSuccessThreshold;
  }

  /**
   * Execute operation with circuit breaker protection
   *
   * @param {Function} operation - Async operation to execute
   * @param {Function} fallback - Optional fallback function
   * @returns {Promise<*>} Operation result or fallback result
   * @throws {ClothingServiceError} When circuit is open and no fallback provided
   */
  async execute(operation, fallback = null) {
    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.#state === CircuitBreakerState.OPEN) {
      if (this.#shouldAttemptReset()) {
        this.#transitionToHalfOpen();
      } else {
        return this.#handleOpenCircuit(fallback);
      }
    }

    // Attempt to execute the operation
    try {
      const result = await operation();
      this.#onSuccess();
      return result;
    } catch (error) {
      this.#onFailure(error);
      
      // If we have a fallback, use it
      if (fallback) {
        this.#logger.info(`Circuit breaker using fallback for ${this.#serviceName}`);
        return fallback();
      }
      
      // Otherwise, re-throw the error
      throw error;
    }
  }

  /**
   * Handle successful operation
   *
   * @private
   */
  #onSuccess() {
    if (this.#state === CircuitBreakerState.HALF_OPEN) {
      this.#successCount++;
      
      if (this.#successCount >= this.#halfOpenSuccessThreshold) {
        this.#transitionToClosed();
      } else {
        this.#logger.debug(`Circuit breaker half-open success ${this.#successCount}/${this.#halfOpenSuccessThreshold} for ${this.#serviceName}`);
      }
    } else if (this.#state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success in closed state
      this.#failureCount = 0;
    }
  }

  /**
   * Handle failed operation
   *
   * @private
   * @param {Error} error - The error that occurred
   */
  #onFailure(error) {
    this.#failureCount++;
    this.#lastFailureTime = Date.now();

    this.#logger.warn(`Circuit breaker failure ${this.#failureCount}/${this.#failureThreshold} for ${this.#serviceName}`, {
      error: error.message
    });

    if (this.#state === CircuitBreakerState.HALF_OPEN) {
      // Any failure in half-open state reopens the circuit
      this.#transitionToOpen();
    } else if (this.#state === CircuitBreakerState.CLOSED && 
               this.#failureCount >= this.#failureThreshold) {
      this.#transitionToOpen();
    }
  }

  /**
   * Handle open circuit
   *
   * @private
   * @param {Function} fallback - Fallback function
   * @returns {*} Fallback result
   * @throws {ClothingServiceError} When no fallback provided
   */
  #handleOpenCircuit(fallback) {
    this.#logger.warn(`Circuit breaker OPEN for ${this.#serviceName}, using fallback`);
    
    if (fallback) {
      return fallback();
    }
    
    throw new ClothingServiceError(
      `Service ${this.#serviceName} is unavailable (circuit breaker open)`,
      this.#serviceName,
      'circuit_breaker',
      { 
        state: this.#state, 
        failureCount: this.#failureCount,
        lastFailureTime: this.#lastFailureTime
      }
    );
  }

  /**
   * Check if circuit should attempt reset
   *
   * @private
   * @returns {boolean} Whether to attempt reset
   */
  #shouldAttemptReset() {
    return this.#lastFailureTime && 
           (Date.now() - this.#lastFailureTime) > this.#resetTimeout;
  }

  /**
   * Transition to CLOSED state
   *
   * @private
   */
  #transitionToClosed() {
    this.#state = CircuitBreakerState.CLOSED;
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#logger.info(`Circuit breaker CLOSED for ${this.#serviceName}`);
  }

  /**
   * Transition to OPEN state
   *
   * @private
   */
  #transitionToOpen() {
    this.#state = CircuitBreakerState.OPEN;
    this.#successCount = 0;
    this.#logger.warn(`Circuit breaker OPEN for ${this.#serviceName} after ${this.#failureCount} failures`);
  }

  /**
   * Transition to HALF_OPEN state
   *
   * @private
   */
  #transitionToHalfOpen() {
    this.#state = CircuitBreakerState.HALF_OPEN;
    this.#successCount = 0;
    this.#logger.info(`Circuit breaker transitioning to HALF_OPEN for ${this.#serviceName}`);
  }

  /**
   * Get current circuit breaker state
   *
   * @returns {object} State information
   */
  getState() {
    return {
      state: this.#state,
      serviceName: this.#serviceName,
      failureCount: this.#failureCount,
      successCount: this.#successCount,
      lastFailureTime: this.#lastFailureTime,
      failureThreshold: this.#failureThreshold,
      resetTimeout: this.#resetTimeout
    };
  }

  /**
   * Force circuit to open (useful for testing)
   */
  forceOpen() {
    this.#transitionToOpen();
  }

  /**
   * Force circuit to closed (useful for testing)
   */
  forceClosed() {
    this.#transitionToClosed();
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset() {
    this.#state = CircuitBreakerState.CLOSED;
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#lastFailureTime = null;
    this.#logger.debug(`Circuit breaker reset for ${this.#serviceName}`);
  }

  /**
   * Check if circuit is currently open
   *
   * @returns {boolean} Whether circuit is open
   */
  isOpen() {
    return this.#state === CircuitBreakerState.OPEN;
  }

  /**
   * Check if circuit is currently closed
   *
   * @returns {boolean} Whether circuit is closed
   */
  isClosed() {
    return this.#state === CircuitBreakerState.CLOSED;
  }

  /**
   * Check if circuit is currently half-open
   *
   * @returns {boolean} Whether circuit is half-open
   */
  isHalfOpen() {
    return this.#state === CircuitBreakerState.HALF_OPEN;
  }
}

export default CircuitBreaker;