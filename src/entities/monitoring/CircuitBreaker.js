/**
 * @file CircuitBreaker - Circuit breaker pattern implementation for error handling
 * @module CircuitBreaker
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {'CLOSED' | 'OPEN' | 'HALF_OPEN'} CircuitState
 */

/**
 * @typedef {object} CircuitBreakerOptions
 * @property {number} [failureThreshold=5] - Number of failures before opening
 * @property {number} [timeout=60000] - Timeout in ms before trying half-open
 * @property {number} [successThreshold=2] - Successes needed to close from half-open
 * @property {string} [name='CircuitBreaker'] - Name for logging
 */

/**
 * @typedef {object} CircuitBreakerStats
 * @property {CircuitState} state - Current state
 * @property {number} failureCount - Current failure count
 * @property {number} successCount - Current success count
 * @property {number} totalRequests - Total requests processed
 * @property {number} totalFailures - Total failures
 * @property {number} lastFailureTime - Timestamp of last failure
 * @property {number} lastSuccessTime - Timestamp of last success
 * @property {number} stateChangeTime - Timestamp of last state change
 */

/**
 * @class CircuitBreaker
 * @description Implements circuit breaker pattern for fault tolerance
 */
export default class CircuitBreaker {
  /** @type {string} */
  #name;
  /** @type {number} */
  #failureThreshold;
  /** @type {number} */
  #timeout;
  /** @type {number} */
  #successThreshold;
  /** @type {CircuitState} */
  #state;
  /** @type {number} */
  #failureCount;
  /** @type {number} */
  #successCount;
  /** @type {number} */
  #totalRequests;
  /** @type {number} */
  #totalFailures;
  /** @type {number} */
  #lastFailureTime;
  /** @type {number} */
  #lastSuccessTime;
  /** @type {number} */
  #stateChangeTime;
  /** @type {ILogger} */
  #logger;
  /** @type {boolean} */
  #enabled;

  /**
   * Creates a new CircuitBreaker instance.
   *
   * @class
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   * @param {CircuitBreakerOptions} [deps.options] - Circuit breaker options
   */
  constructor({ logger, options = {} }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'CircuitBreaker');

    this.#enabled = true;
    this.#name = options.name || 'CircuitBreaker';
    this.#failureThreshold = options.failureThreshold ?? 5;
    this.#timeout = options.timeout ?? 60000;
    this.#successThreshold = options.successThreshold ?? 2;

    // Initialize state
    this.#state = 'CLOSED';
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#totalRequests = 0;
    this.#totalFailures = 0;
    this.#lastFailureTime = 0;
    this.#lastSuccessTime = 0;
    this.#stateChangeTime = Date.now();

    this.#logger.debug(`CircuitBreaker '${this.#name}' initialized`, {
      enabled: this.#enabled,
      failureThreshold: this.#failureThreshold,
      timeout: this.#timeout,
      successThreshold: this.#successThreshold,
    });
  }

  /**
   * Executes a function with circuit breaker protection.
   *
   * @param {Function} fn - Function to execute
   * @param {...*} args - Arguments to pass to the function
   * @returns {Promise<*>} Result of the function
   * @throws {Error} If circuit is open or function fails
   */
  async execute(fn, ...args) {
    if (!this.#enabled) {
      return await fn(...args);
    }

    this.#totalRequests++;

    // Check if circuit is open
    if (this.#state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.#lastFailureTime;

      if (timeSinceLastFailure < this.#timeout) {
        const error = new Error(
          `Circuit breaker '${this.#name}' is OPEN. Requests blocked for ${Math.round((this.#timeout - timeSinceLastFailure) / 1000)}s`
        );
        error.name = 'CircuitBreakerOpenError';
        throw error;
      }

      // Transition to half-open
      this.#transitionToHalfOpen();
    }

    try {
      const result = await fn(...args);
      this.#onSuccess();
      return result;
    } catch (error) {
      this.#onFailure(error);
      throw error;
    }
  }

  /**
   * Executes a synchronous function with circuit breaker protection.
   *
   * @param {Function} fn - Function to execute
   * @param {...*} args - Arguments to pass to the function
   * @returns {*} Result of the function
   * @throws {Error} If circuit is open or function fails
   */
  executeSync(fn, ...args) {
    if (!this.#enabled) {
      return fn(...args);
    }

    this.#totalRequests++;

    // Check if circuit is open
    if (this.#state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.#lastFailureTime;

      if (timeSinceLastFailure < this.#timeout) {
        const error = new Error(
          `Circuit breaker '${this.#name}' is OPEN. Requests blocked for ${Math.round((this.#timeout - timeSinceLastFailure) / 1000)}s`
        );
        error.name = 'CircuitBreakerOpenError';
        throw error;
      }

      // Transition to half-open
      this.#transitionToHalfOpen();
    }

    try {
      const result = fn(...args);
      this.#onSuccess();
      return result;
    } catch (error) {
      this.#onFailure(error);
      throw error;
    }
  }

  /**
   * Handles successful execution.
   */
  #onSuccess() {
    this.#lastSuccessTime = Date.now();
    this.#failureCount = 0;

    if (this.#state === 'HALF_OPEN') {
      this.#successCount++;

      if (this.#successCount >= this.#successThreshold) {
        this.#transitionToClosed();
      }
    }

    this.#logger.debug(`Circuit breaker '${this.#name}' - Success recorded`, {
      state: this.#state,
      successCount: this.#successCount,
      failureCount: this.#failureCount,
    });
  }

  /**
   * Handles failed execution.
   *
   * @param {Error} error - The error that occurred
   */
  #onFailure(error) {
    this.#lastFailureTime = Date.now();
    this.#failureCount++;
    this.#totalFailures++;

    this.#logger.debug(`Circuit breaker '${this.#name}' - Failure recorded`, {
      state: this.#state,
      failureCount: this.#failureCount,
      error: error.message,
    });

    if (this.#state === 'HALF_OPEN') {
      this.#transitionToOpen();
    } else if (
      this.#state === 'CLOSED' &&
      this.#failureCount >= this.#failureThreshold
    ) {
      this.#transitionToOpen();
    }
  }

  /**
   * Transitions circuit to CLOSED state.
   */
  #transitionToClosed() {
    this.#state = 'CLOSED';
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#stateChangeTime = Date.now();

    this.#logger.info(
      `Circuit breaker '${this.#name}' transitioned to CLOSED`,
      {
        state: this.#state,
        timestamp: new Date().toISOString(),
      }
    );
  }

  /**
   * Transitions circuit to OPEN state.
   */
  #transitionToOpen() {
    this.#state = 'OPEN';
    this.#stateChangeTime = Date.now();

    this.#logger.warn(`Circuit breaker '${this.#name}' transitioned to OPEN`, {
      state: this.#state,
      failureCount: this.#failureCount,
      failureThreshold: this.#failureThreshold,
      timeoutMs: this.#timeout,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Transitions circuit to HALF_OPEN state.
   */
  #transitionToHalfOpen() {
    this.#state = 'HALF_OPEN';
    this.#successCount = 0;
    this.#stateChangeTime = Date.now();

    this.#logger.info(
      `Circuit breaker '${this.#name}' transitioned to HALF_OPEN`,
      {
        state: this.#state,
        successThreshold: this.#successThreshold,
        timestamp: new Date().toISOString(),
      }
    );
  }

  /**
   * Gets current circuit breaker statistics.
   *
   * @returns {CircuitBreakerStats} Current statistics
   */
  getStats() {
    return {
      state: this.#state,
      failureCount: this.#failureCount,
      successCount: this.#successCount,
      totalRequests: this.#totalRequests,
      totalFailures: this.#totalFailures,
      lastFailureTime: this.#lastFailureTime,
      lastSuccessTime: this.#lastSuccessTime,
      stateChangeTime: this.#stateChangeTime,
      enabled: this.#enabled,
      name: this.#name,
    };
  }

  /**
   * Gets the current state of the circuit breaker.
   *
   * @returns {CircuitState} Current state
   */
  getState() {
    return this.#state;
  }

  /**
   * Checks if the circuit breaker is open.
   *
   * @returns {boolean} True if circuit is open
   */
  isOpen() {
    return this.#state === 'OPEN';
  }

  /**
   * Checks if the circuit breaker is closed.
   *
   * @returns {boolean} True if circuit is closed
   */
  isClosed() {
    return this.#state === 'CLOSED';
  }

  /**
   * Checks if the circuit breaker is half-open.
   *
   * @returns {boolean} True if circuit is half-open
   */
  isHalfOpen() {
    return this.#state === 'HALF_OPEN';
  }

  /**
   * Manually opens the circuit breaker.
   */
  open() {
    this.#transitionToOpen();
  }

  /**
   * Manually closes the circuit breaker.
   */
  close() {
    this.#transitionToClosed();
  }

  /**
   * Resets the circuit breaker to initial state.
   */
  reset() {
    this.#state = 'CLOSED';
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#totalRequests = 0;
    this.#totalFailures = 0;
    this.#lastFailureTime = 0;
    this.#lastSuccessTime = 0;
    this.#stateChangeTime = Date.now();

    this.#logger.info(`Circuit breaker '${this.#name}' reset to initial state`);
  }

  /**
   * Enables or disables the circuit breaker.
   *
   * @param {boolean} enabled - Whether to enable the circuit breaker
   */
  setEnabled(enabled) {
    this.#enabled = enabled;
    this.#logger.info(
      `Circuit breaker '${this.#name}' ${enabled ? 'enabled' : 'disabled'}`
    );
  }

  /**
   * Gets a status report.
   *
   * @returns {string} Status report
   */
  getStatusReport() {
    const stats = this.getStats();
    const timeSinceLastFailure =
      stats.lastFailureTime > 0 ? Date.now() - stats.lastFailureTime : 0;
    const timeSinceLastSuccess =
      stats.lastSuccessTime > 0 ? Date.now() - stats.lastSuccessTime : 0;
    const timeSinceStateChange = Date.now() - stats.stateChangeTime;

    const report = [
      `Circuit Breaker: ${this.#name}`,
      '='.repeat(30),
      `State: ${stats.state}`,
      `Enabled: ${stats.enabled}`,
      `Total Requests: ${stats.totalRequests}`,
      `Total Failures: ${stats.totalFailures}`,
      `Current Failures: ${stats.failureCount}/${this.#failureThreshold}`,
      `Success Count: ${stats.successCount}`,
      `Last Failure: ${timeSinceLastFailure > 0 ? Math.round(timeSinceLastFailure / 1000) + 's ago' : 'Never'}`,
      `Last Success: ${timeSinceLastSuccess > 0 ? Math.round(timeSinceLastSuccess / 1000) + 's ago' : 'Never'}`,
      `State Change: ${Math.round(timeSinceStateChange / 1000)}s ago`,
      `Failure Rate: ${stats.totalRequests > 0 ? Math.round((stats.totalFailures / stats.totalRequests) * 100) + '%' : '0%'}`,
    ];

    if (stats.state === 'OPEN') {
      const timeUntilHalfOpen = this.#timeout - timeSinceLastFailure;
      if (timeUntilHalfOpen > 0) {
        report.push(`Half-Open In: ${Math.round(timeUntilHalfOpen / 1000)}s`);
      } else {
        report.push('Ready for Half-Open');
      }
    }

    return report.join('\n');
  }
}
