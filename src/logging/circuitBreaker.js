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
 * Enhanced error classification patterns for sophisticated error detection
 */
const ERROR_CLASSIFICATION = {
  // Network connectivity errors
  CONNECTIVITY: ['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ECONNABORTED'],
  
  // DNS resolution errors
  DNS_ISSUES: ['ENOTFOUND', 'EAI_AGAIN', 'EADDRNOTAVAIL'],
  
  // Timeout variants
  TIMEOUT_VARIANTS: ['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ETIMEOUT'],
  
  // Server overload indicators
  SERVER_OVERLOAD: [429, 503, 502],
  
  // General server errors
  SERVER_ERROR: [500, 501, 502, 503, 504, 507, 509],
  
  // Application-specific quota errors
  QUOTA_PATTERNS: ['quota_exceeded', 'rate_limit_exceeded', 'limit_reached'],
  
  // Rate limit header names
  RATE_LIMIT_HEADERS: ['X-RateLimit-Remaining', 'Retry-After', 'X-RateLimit-Reset'],
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
   * @private
   * @type {object|null}
   */
  #eventBus;

  /**
   * @private
   * @type {Array<{timestamp: number, type: string}>}
   */
  #rollingWindow;

  /**
   * @private
   * @type {number}
   */
  #rollingWindowDuration;

  /**
   * @private
   * @type {Map<string, number>}
   */
  #errorTypeDistribution;

  /**
   * @private
   * @type {number}
   */
  #totalRetryAttempts;

  /**
   * @private
   * @type {object}
   */
  #lastErrorContext;

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
   * @param {object} [options.eventBus] - Optional event bus for dispatching circuit breaker events
   * @param {number} [options.rollingWindowDuration] - Duration for rolling window statistics in ms (default: 10 minutes)
   */
  constructor({
    failureThreshold = 5,
    timeout = 60000,
    halfOpenMaxCalls = 3,
    healthCheck = null,
    exponentialBackoffBase = 2,
    maxBackoffTime = 5 * 60 * 1000, // 5 minutes
    successThresholdForIncrease = 20,
    eventBus = null,
    rollingWindowDuration = 10 * 60 * 1000, // 10 minutes
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
    
    // New enhanced features
    this.#eventBus = eventBus;
    this.#rollingWindow = [];
    this.#rollingWindowDuration = rollingWindowDuration;
    this.#errorTypeDistribution = new Map();
    this.#totalRetryAttempts = 0;
    this.#lastErrorContext = null;
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
    
    // Update rolling window
    this.#addToRollingWindow('success');

    // Adjust adaptive threshold based on success pattern
    if (this.#consecutiveSuccesses >= this.#successThresholdForIncrease) {
      this.#increaseAdaptiveThreshold();
      this.#consecutiveSuccesses = 0;
    }

    if (this.#state === CircuitBreakerState.HALF_OPEN) {
      // If we have enough successful calls in half-open, close the circuit
      if (this.#successCount >= this.#halfOpenMaxCalls) {
        this.#transitionToClosed('half_open_test_successful', {
          successCount: this.#successCount,
          requiredSuccesses: this.#halfOpenMaxCalls,
        });
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
    
    // Store error context for detailed analysis
    this.#lastErrorContext = {
      timestamp: Date.now(),
      error: error ? {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      } : null,
    };

    // Enhanced error classification
    const errorType = this.#classifyError(error);
    this.#updateErrorDistribution(errorType);
    
    // Update rolling window
    this.#addToRollingWindow('failure', errorType);
    
    // Extract retry information if available
    const retryInfo = this.#extractRetryInfo(error);
    if (retryInfo) {
      this.#lastErrorContext.retryInfo = retryInfo;
    }

    // Classify error type for better decision making
    if (error && this.#isNetworkError(error)) {
      this.#networkFailureCount++;
    } else {
      this.#serverFailureCount++;
    }

    // Adjust failure threshold adaptively based on failure pattern
    this.#adjustAdaptiveThreshold();

    const oldState = this.#state;
    if (this.#state === CircuitBreakerState.CLOSED) {
      // Check if we should open the circuit
      if (this.#failureCount >= this.#failureThreshold) {
        this.#transitionToOpen('failure_threshold_exceeded', error);
      }
    } else if (this.#state === CircuitBreakerState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit
      this.#transitionToOpen('half_open_test_failed', error);
    }
    
    // Emit failure event
    if (this.#eventBus && oldState !== this.#state) {
      this.#emitStateChange(oldState, this.#state, 'failure_recorded', {
        errorType,
        retryInfo,
        failureCount: this.#failureCount,
      });
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
   * @param {string} [reason] - Reason for transition
   * @param {object} [context] - Additional context
   */
  #transitionToClosed(reason = 'recovery_successful', context = {}) {
    const oldState = this.#state;
    this.#state = CircuitBreakerState.CLOSED;
    this.#failureCount = 0;
    this.#successCount = 0;
    this.#halfOpenCallCount = 0;
    // Don't reset consecutive success counters - we want to continue tracking for adaptive threshold
    
    if (oldState !== this.#state) {
      this.#emitStateChange(oldState, this.#state, reason, context);
    }
  }

  /**
   * Transitions circuit to open state.
   *
   * @private
   * @param {string} [reason] - Reason for transition
   * @param {Error} [error] - Error that triggered the transition
   */
  #transitionToOpen(reason = 'failure_threshold_exceeded', error = null) {
    const oldState = this.#state;
    this.#state = CircuitBreakerState.OPEN;
    this.#successCount = 0;
    this.#halfOpenCallCount = 0;
    this.#lastFailureTime = Date.now();
    
    if (oldState !== this.#state) {
      this.#emitStateChange(oldState, this.#state, reason, {
        error: error ? { message: error.message, code: error.code } : null,
        failureCount: this.#failureCount,
        threshold: this.#failureThreshold,
      });
    }
  }

  /**
   * Transitions circuit to half-open state.
   *
   * @private
   * @param {string} [reason] - Reason for transition
   */
  #transitionToHalfOpen(reason = 'timeout_expired') {
    const oldState = this.#state;
    this.#state = CircuitBreakerState.HALF_OPEN;
    this.#successCount = 0;
    this.#halfOpenCallCount = 0;
    
    if (oldState !== this.#state) {
      this.#emitStateChange(oldState, this.#state, reason, {
        timeSinceLastFailure: Date.now() - this.#lastFailureTime,
      });
    }
  }

  /**
   * Emits a state change event if event bus is configured.
   *
   * @private
   * @param {string} oldState - Previous state
   * @param {string} newState - New state
   * @param {string} reason - Reason for state change
   * @param {object} context - Additional context information
   */
  #emitStateChange(oldState, newState, reason, context = {}) {
    if (!this.#eventBus || typeof this.#eventBus.dispatch !== 'function') {
      return;
    }
    
    this.#eventBus.dispatch({
      type: 'CIRCUIT_BREAKER_STATE_CHANGED',
      payload: {
        from: oldState,
        to: newState,
        reason,
        timestamp: Date.now(),
        stats: this.getDetailedStats(),
        context,
      },
    });
  }

  /**
   * Emits a retry attempt event if event bus is configured.
   *
   * @private
   * @param {number} attempt - Retry attempt number
   * @param {number} delay - Delay before retry
   * @param {Error} error - Error that triggered retry
   * @param {object} context - Additional context
   */
  #emitRetryAttempt(attempt, delay, error, context = {}) {
    if (!this.#eventBus || typeof this.#eventBus.dispatch !== 'function') {
      return;
    }
    
    this.#totalRetryAttempts++;
    
    this.#eventBus.dispatch({
      type: 'CIRCUIT_BREAKER_RETRY_ATTEMPT',
      payload: {
        attempt,
        delay,
        error: error?.message || String(error),
        errorType: this.#classifyError(error),
        timestamp: Date.now(),
        totalRetryAttempts: this.#totalRetryAttempts,
        context,
      },
    });
  }

  /**
   * Adds an event to the rolling window for statistics.
   *
   * @private
   * @param {string} type - Event type (success/failure)
   * @param {string} [subtype] - Event subtype (error classification)
   */
  #addToRollingWindow(type, subtype = null) {
    const now = Date.now();
    
    // Add new event
    this.#rollingWindow.push({
      timestamp: now,
      type,
      subtype,
    });
    
    // Clean old events outside the window
    const cutoff = now - this.#rollingWindowDuration;
    this.#rollingWindow = this.#rollingWindow.filter(event => event.timestamp > cutoff);
  }

  /**
   * Updates error type distribution statistics.
   *
   * @private
   * @param {string} errorType - Type of error
   */
  #updateErrorDistribution(errorType) {
    const current = this.#errorTypeDistribution.get(errorType) || 0;
    this.#errorTypeDistribution.set(errorType, current + 1);
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
    
    // Check for connectivity errors
    if (ERROR_CLASSIFICATION.CONNECTIVITY.some(code => 
      error.code === code || error.message?.includes(code)
    )) {
      return true;
    }
    
    // Check for DNS issues
    if (ERROR_CLASSIFICATION.DNS_ISSUES.some(code => 
      error.code === code || error.message?.includes(code)
    )) {
      return true;
    }
    
    // Check for timeout variants
    if (ERROR_CLASSIFICATION.TIMEOUT_VARIANTS.some(code => 
      error.code === code || error.message?.includes(code)
    )) {
      return true;
    }
    
    // Legacy network indicators
    const networkIndicators = [
      'NetworkError',
      'NETWORK_ERROR',
      'fetch'
    ];
    
    return networkIndicators.some(indicator => 
      error.name === indicator ||
      error.code === indicator ||
      error.message?.includes(indicator)
    );
  }

  /**
   * Classifies an error into detailed categories.
   *
   * @private
   * @param {Error} error - The error to classify
   * @returns {string} Error classification type
   */
  #classifyError(error) {
    if (!error) return 'unknown';
    
    // Check for server overload
    if (error.statusCode && ERROR_CLASSIFICATION.SERVER_OVERLOAD.includes(error.statusCode)) {
      return 'server_overload';
    }
    
    // Check for general server errors
    if (error.statusCode && ERROR_CLASSIFICATION.SERVER_ERROR.includes(error.statusCode)) {
      return 'server_error';
    }
    
    // Check for quota/rate limit errors
    if (ERROR_CLASSIFICATION.QUOTA_PATTERNS.some(pattern => 
      error.message?.toLowerCase().includes(pattern)
    )) {
      return 'quota_exceeded';
    }
    
    // Check network error types
    if (this.#isNetworkError(error)) {
      // More specific network error classification
      if (ERROR_CLASSIFICATION.CONNECTIVITY.some(code => 
        error.code === code || error.message?.includes(code)
      )) {
        return 'connectivity';
      }
      
      if (ERROR_CLASSIFICATION.DNS_ISSUES.some(code => 
        error.code === code || error.message?.includes(code)
      )) {
        return 'dns';
      }
      
      if (ERROR_CLASSIFICATION.TIMEOUT_VARIANTS.some(code => 
        error.code === code || error.message?.includes(code)
      )) {
        return 'timeout';
      }
      
      return 'network_other';
    }
    
    return 'application';
  }

  /**
   * Extracts retry information from error response.
   *
   * @private
   * @param {Error} error - The error with potential retry information
   * @returns {object|null} Retry information if available
   */
  #extractRetryInfo(error) {
    if (!error || !error.response) return null;
    
    const headers = error.response.headers || {};
    const retryInfo = {};
    
    // Check for Retry-After header
    if (headers['retry-after']) {
      const retryAfter = headers['retry-after'];
      // Parse as seconds or HTTP date
      retryInfo.retryAfter = isNaN(retryAfter) 
        ? new Date(retryAfter).getTime() - Date.now()
        : parseInt(retryAfter) * 1000;
    }
    
    // Check for rate limit headers
    if (headers['x-ratelimit-remaining']) {
      retryInfo.rateLimitRemaining = parseInt(headers['x-ratelimit-remaining']);
    }
    
    if (headers['x-ratelimit-reset']) {
      retryInfo.rateLimitReset = parseInt(headers['x-ratelimit-reset']) * 1000;
    }
    
    return Object.keys(retryInfo).length > 0 ? retryInfo : null;
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
      hasEventBus: this.#eventBus !== null,
      totalRetryAttempts: this.#totalRetryAttempts,
    };
  }

  /**
   * Gets detailed circuit breaker statistics including rolling window metrics.
   *
   * @returns {object} Detailed statistics with granular metrics
   */
  getDetailedStats() {
    const basicStats = this.getStats();
    
    // Calculate rolling window metrics
    const now = Date.now();
    const windowStart = now - this.#rollingWindowDuration;
    const windowEvents = this.#rollingWindow.filter(e => e.timestamp > windowStart);
    
    const successCount = windowEvents.filter(e => e.type === 'success').length;
    const failureCount = windowEvents.filter(e => e.type === 'failure').length;
    const totalEvents = windowEvents.length;
    
    // Calculate failure rate
    const failureRate = totalEvents > 0 ? (failureCount / totalEvents) * 100 : 0;
    
    // Get error distribution
    const errorDistribution = {};
    this.#errorTypeDistribution.forEach((count, type) => {
      errorDistribution[type] = count;
    });
    
    // Calculate error type breakdown from rolling window
    const recentErrorTypes = {};
    windowEvents
      .filter(e => e.type === 'failure' && e.subtype)
      .forEach(e => {
        recentErrorTypes[e.subtype] = (recentErrorTypes[e.subtype] || 0) + 1;
      });
    
    return {
      ...basicStats,
      rollingWindow: {
        duration: this.#rollingWindowDuration,
        successCount,
        failureCount,
        totalEvents,
        failureRate: Math.round(failureRate * 100) / 100,
        startTime: windowStart,
        endTime: now,
      },
      errorDistribution: {
        allTime: errorDistribution,
        recent: recentErrorTypes,
      },
      lastError: this.#lastErrorContext,
      performance: {
        totalRetryAttempts: this.#totalRetryAttempts,
        averageFailureRate: totalEvents > 0 ? failureRate : null,
      },
    };
  }

  /**
   * Resets the circuit breaker to initial state.
   * Useful for testing or manual recovery scenarios.
   */
  reset() {
    const oldState = this.#state;
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
    
    // Reset enhanced features
    this.#rollingWindow = [];
    this.#errorTypeDistribution.clear();
    this.#totalRetryAttempts = 0;
    this.#lastErrorContext = null;
    
    // Emit reset event if state changed
    if (oldState !== CircuitBreakerState.CLOSED && this.#eventBus) {
      this.#emitStateChange(oldState, CircuitBreakerState.CLOSED, 'manual_reset', {
        resetTimestamp: Date.now(),
      });
    }
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
    this.#transitionToClosed('manual_close');
  }

  /**
   * Executes a function with retry logic and circuit breaker protection.
   * This is a convenience method that combines circuit breaker with retry attempts.
   *
   * @param {Function} fn - Async function to execute
   * @param {object} options - Retry options
   * @param {number} [options.maxAttempts] - Maximum retry attempts
   * @param {number} [options.retryDelay] - Base delay between retries in ms
   * @param {boolean} [options.exponentialBackoff] - Use exponential backoff for retries
   * @returns {Promise<any>} Result of the function execution
   * @throws {Error} When all retry attempts fail or circuit is open
   */
  async executeWithRetry(fn, { maxAttempts = 3, retryDelay = 1000, exponentialBackoff = true } = {}) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Try to execute through circuit breaker
        const result = await this.execute(fn);
        return result;
      } catch (error) {
        lastError = error;
        
        // If circuit is open, don't retry
        if (this.#state === CircuitBreakerState.OPEN) {
          throw error;
        }
        
        // If this was the last attempt, throw the error
        if (attempt === maxAttempts) {
          throw error;
        }
        
        // Calculate retry delay
        const delay = exponentialBackoff 
          ? retryDelay * Math.pow(2, attempt - 1)
          : retryDelay;
        
        // Emit retry attempt event
        this.#emitRetryAttempt(attempt, delay, error, {
          maxAttempts,
          willRetry: true,
        });
        
        // Wait before retrying (using timer-friendly approach)
        await new Promise(resolve => {
          const timer = setTimeout(() => resolve(), delay);
          // Store timer for potential cleanup
          if (typeof timer === 'object' && timer.unref) {
            timer.unref();
          }
        });
      }
    }
    
    throw lastError;
  }

  /**
   * Gets the current error classification configuration.
   *
   * @returns {object} Error classification patterns
   */
  static getErrorClassification() {
    return ERROR_CLASSIFICATION;
  }
}

export default CircuitBreaker;
