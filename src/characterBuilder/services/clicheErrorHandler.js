/**
 * @file Centralized error handling service for cliché generation
 *
 * Provides comprehensive error handling with recovery strategies:
 * - Context-aware error analysis and classification
 * - Retry logic with exponential backoff and jitter
 * - Graceful degradation and fallback strategies
 * - User-friendly error message generation
 * - EventBus integration for monitoring and alerting
 * @see ../../errors/clicheErrors.js
 * @see ./characterBuilderService.js
 * @see ../validators/clicheValidator.js
 */

import {
  ClicheError,
  ClicheLLMError,
  ClicheStorageError,
  ClicheValidationError,
  ClicheDataIntegrityError,
  ClicheGenerationError,
  ClichePrerequisiteError,
} from '../../errors/clicheErrors.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Default retry configuration with exponential backoff
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  jitterFactor: 0.3, // 30% jitter to prevent thundering herd
};

/**
 * Circuit breaker configuration for preventing cascading failures
 */
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5, // Number of failures before opening circuit
  resetTimeout: 60000, // 1 minute before attempting to close circuit
  monitoringWindow: 300000, // 5 minutes monitoring window
};

/**
 * Cleanup throttling configuration to prevent O(n) performance issues
 */
const CLEANUP_THROTTLE_CONFIG = {
  operationsThreshold: 100, // Cleanup after this many error operations
  timeThreshold: 300000, // Or after 5 minutes, whichever comes first
};

/**
 * Error categorization for recovery strategy selection
 */
const ERROR_CATEGORIES = {
  RETRYABLE: 'retryable',
  NON_RETRYABLE: 'non_retryable',
  DEGRADATION_POSSIBLE: 'degradation_possible',
  USER_ACTION_REQUIRED: 'user_action_required',
};

/**
 * Centralized error handler for cliché operations
 *
 * Provides intelligent error handling with context-aware recovery strategies,
 * retry logic, and graceful degradation options. Features throttled cleanup
 * of error statistics to prevent O(n) performance degradation.
 */
export class ClicheErrorHandler {
  #logger;
  #eventBus;
  #retryConfig;
  #circuitBreakers = new Map();
  #errorStatistics = new Map();
  #cleanupThrottle = {
    operationCount: 0,
    lastCleanup: 0,
  };

  /**
   * @param {object} dependencies - Handler dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dependencies.eventBus - Event dispatcher
   * @param {object} [dependencies.retryConfig] - Custom retry configuration
   */
  constructor({ logger, eventBus, retryConfig = {} }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['error', 'warn', 'info', 'debug'],
    });
    validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch'],
    });

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

    // Initialize error statistics tracking
    this.#initializeErrorTracking();
  }

  /**
   * Handles errors with appropriate recovery strategies
   *
   * Analyzes the error context and determines the best recovery approach,
   * including retry logic, fallback strategies, and user feedback.
   *
   * @param {Error} error - The error that occurred
   * @param {object} [context] - Error context and operation details
   * @param {string} [context.operation] - Operation that failed
   * @param {number} [context.attempt] - Current retry attempt
   * @param {string} [context.directionId] - Direction ID if applicable
   * @param {string} [context.conceptId] - Concept ID if applicable
   * @returns {Promise<object>} Recovery strategy and recommendations
   */
  async handleError(error, context = {}) {
    const enhancedContext = this.#enrichContext(error, context);

    // Log error with full context
    this.#logError(error, enhancedContext);

    // Update error statistics
    this.#updateErrorStatistics(error, enhancedContext);

    // Dispatch error event for monitoring
    await this.#dispatchErrorEvent(error, enhancedContext);

    // Check circuit breaker state
    const circuitState = this.#checkCircuitBreaker(enhancedContext.operation);
    if (circuitState.isOpen) {
      return this.#handleCircuitBreakerOpen(error, enhancedContext);
    }

    // Determine error category and strategy
    const errorCategory = this.#categorizeError(error, enhancedContext);
    const strategy = await this.#selectRecoveryStrategy(
      error,
      enhancedContext,
      errorCategory
    );

    // Update circuit breaker based on strategy
    this.#updateCircuitBreaker(enhancedContext.operation, strategy.success);

    return strategy;
  }

  /**
   * Handles LLM-specific errors with intelligent retry logic
   *
   * @param {ClicheLLMError|ClicheGenerationError} error - LLM-related error
   * @param {object} context - Error context
   * @returns {Promise<object>} Recovery strategy
   */
  async #handleLLMError(error, context) {
    const { attempt = 1, maxRetries = this.#retryConfig.maxRetries } = context;

    // Determine if error is retryable
    const isRetryable = this.#isLLMErrorRetryable(error);
    const shouldRetry = isRetryable && attempt < maxRetries;

    if (shouldRetry) {
      const delay = this.#calculateRetryDelay(attempt);

      this.#logger.info(
        `Retrying LLM operation (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`,
        { error: error.message, context }
      );

      return {
        success: false,
        shouldRetry: true,
        delay,
        userMessage: this.#getLLMRetryMessage(attempt + 1, maxRetries),
        nextAttempt: attempt + 1,
        errorCategory: ERROR_CATEGORIES.RETRYABLE,
        recommendation: 'RETRY_WITH_BACKOFF',
      };
    }

    // Maximum retries exceeded or non-retryable error
    const fallbackOptions = this.#getLLMFallbackOptions(error, context);

    // Determine category: non-retryable errors vs user action required
    const errorCategory =
      error instanceof ClicheLLMError && !error.isTemporaryFailure()
        ? ERROR_CATEGORIES.NON_RETRYABLE
        : ERROR_CATEGORIES.USER_ACTION_REQUIRED;

    return {
      success: false,
      shouldRetry: false,
      userMessage: this.#getLLMFailureMessage(error, context),
      fallbackOptions,
      errorCategory,
      recommendation: 'SHOW_FALLBACK_OPTIONS',
    };
  }

  /**
   * Handles storage errors with fallback strategies
   *
   * @param {ClicheStorageError} error - Storage-related error
   * @param {object} context - Error context
   * @returns {Promise<object>} Recovery strategy
   */
  async #handleStorageError(error, context) {
    this.#logger.warn('Storage failed, attempting graceful degradation', {
      error: error.message,
      operation: error.storageOperation,
      context,
    });

    // Determine fallback strategy based on operation
    const fallbackStrategy = this.#getStorageFallbackStrategy(
      error.storageOperation
    );

    return {
      success: false,
      shouldRetry: false,
      userMessage:
        'Unable to save data permanently. Your work will be preserved for this session only.',
      fallbackAction: fallbackStrategy.action,
      canContinue: true,
      errorCategory: ERROR_CATEGORIES.DEGRADATION_POSSIBLE,
      recommendation: 'USE_FALLBACK_STORAGE',
      degradationLevel: 'PARTIAL',
    };
  }

  /**
   * Handles validation errors with specific guidance
   *
   * @param {ClicheValidationError|ClichePrerequisiteError} error - Validation-related error
   * @param {object} context - Error context
   * @returns {Promise<object>} Recovery strategy
   */
  async #handleValidationError(error, context) {
    const userMessage = this.#getValidationUserMessage(error);
    const actionableSteps = this.#getValidationActionableSteps(error);

    return {
      success: false,
      shouldRetry: false,
      userMessage,
      validationErrors: error.validationErrors || [],
      actionableSteps,
      canContinue: false,
      errorCategory: ERROR_CATEGORIES.USER_ACTION_REQUIRED,
      recommendation: 'USER_INPUT_CORRECTION',
    };
  }

  /**
   * Handles data integrity errors with recovery attempts
   *
   * @param {ClicheDataIntegrityError} error - Data integrity error
   * @param {object} context - Error context
   * @returns {Promise<object>} Recovery strategy
   */
  async #handleDataIntegrityError(error, context) {
    const recoveryOptions = this.#getDataRecoveryOptions(error);

    return {
      success: false,
      shouldRetry: false,
      userMessage:
        'Data consistency issue detected. Please refresh the page to reload fresh data.',
      recoveryOptions,
      requiresRefresh: true,
      errorCategory: ERROR_CATEGORIES.USER_ACTION_REQUIRED,
      recommendation: 'REFRESH_DATA',
    };
  }

  /**
   * Handles generic ClicheError instances
   *
   * @param {ClicheError} error - Generic cliché error
   * @param {object} context - Error context
   * @returns {Promise<object>} Recovery strategy
   */
  async #handleGenericClicheError(error, context) {
    return {
      success: false,
      shouldRetry: false,
      userMessage: this.formatUserMessage(error, context),
      errorCategory: ERROR_CATEGORIES.NON_RETRYABLE,
      recommendation: 'RETRY_OPERATION',
    };
  }

  /**
   * Handles unknown errors with conservative approach
   *
   * @param {Error} error - Unknown error
   * @param {object} context - Error context
   * @returns {Promise<object>} Recovery strategy
   */
  async #handleUnknownError(error, context) {
    this.#logger.error(
      'Unknown error encountered, using conservative recovery',
      {
        error: error.message,
        stack: error.stack,
        context,
      }
    );

    return {
      success: false,
      shouldRetry: false,
      userMessage:
        'An unexpected error occurred. Please refresh the page and try again.',
      requiresRefresh: true,
      errorCategory: ERROR_CATEGORIES.NON_RETRYABLE,
      recommendation: 'FULL_REFRESH',
    };
  }

  /**
   * Creates user-friendly error message based on error type and context
   *
   * @param {Error} error - The error to format
   * @param {object} [context] - Error context
   * @returns {string} User-friendly error message
   */
  formatUserMessage(error, context = {}) {
    if (error instanceof ClicheError) {
      const messageMap = {
        CLICHE_GENERATION_ERROR:
          'Unable to generate clichés at this time. Please try again in a few moments.',
        CLICHE_VALIDATION_ERROR: 'Please check your input and try again.',
        CLICHE_STORAGE_ERROR:
          'Unable to save your work permanently. It will be available for this session only.',
        CLICHE_LLM_ERROR:
          'The generation service is temporarily unavailable. Please try again later.',
        CLICHE_DATA_INTEGRITY_ERROR:
          'Data consistency issue detected. Please refresh the page.',
        CLICHE_PREREQUISITE_ERROR:
          'Please ensure all required fields are completed before proceeding.',
      };

      return messageMap[error.code] || error.message;
    }

    // Fallback for non-cliché errors
    return 'An error occurred while processing your request. Please try again.';
  }

  /**
   * Get error statistics for monitoring and debugging
   *
   * @returns {object} Error statistics summary
   */
  getErrorStatistics() {
    const stats = {};

    for (const [key, data] of this.#errorStatistics) {
      stats[key] = {
        count: data.count,
        lastOccurrence: data.lastOccurrence,
        averageResolution: data.totalResolutionTime / data.count,
      };
    }

    return stats;
  }

  /**
   * @description Records a successful operation to reset circuit breaker counters
   * @param {string} operation - Operation name that completed successfully
   * @returns {void}
   */
  recordSuccessfulOperation(operation) {
    if (!operation) {
      this.#logger.debug(
        'recordSuccessfulOperation called without a valid operation name'
      );
      return;
    }

    this.#updateCircuitBreaker(operation, true);
    this.#logger.info(
      `Circuit breaker marked as healthy for operation: ${operation}`
    );
  }

  /**
   * Reset circuit breaker for a specific operation
   *
   * @param {string} operation - Operation name
   */
  resetCircuitBreaker(operation) {
    this.#circuitBreakers.delete(operation);
    this.#logger.info(`Circuit breaker reset for operation: ${operation}`);
  }

  // Private helper methods

  /**
   * Initialize error tracking and monitoring
   *
   * @private
   */
  #initializeErrorTracking() {
    this.#logger.debug(
      'Initializing cliché error handler with monitoring capabilities'
    );
  }

  /**
   * Enrich error context with additional metadata
   *
   * @private
   * @param {Error} error - The error
   * @param {object} context - Original context
   * @returns {object} Enhanced context
   */
  #enrichContext(error, context) {
    const safeContext = context || {};
    return {
      ...safeContext,
      timestamp: new Date().toISOString(),
      errorType: error.constructor.name,
      errorCode: error.code || 'UNKNOWN',
      sessionId: this.#generateSessionId(),
      operation: safeContext.operation || 'unknown_operation',
    };
  }

  /**
   * Log error with appropriate level and context
   *
   * @private
   * @param {Error} error - The error
   * @param {object} context - Error context
   */
  #logError(error, context) {
    const logLevel = this.#determineLogLevel(error);
    const logData = {
      message: error.message,
      code: error.code,
      operation: context.operation,
      attempt: context.attempt,
      context: context,
      stack: error.stack,
    };

    this.#logger[logLevel](`Cliché error in ${context.operation}:`, logData);
  }

  /**
   * Update error statistics for monitoring
   *
   * @private
   * @param {Error} error - The error
   * @param {object} context - Error context
   */
  #updateErrorStatistics(error, context) {
    const key = `${error.constructor.name}:${context.operation}`;

    if (!this.#errorStatistics.has(key)) {
      this.#errorStatistics.set(key, {
        count: 0,
        firstOccurrence: context.timestamp,
        lastOccurrence: null,
        totalResolutionTime: 0,
      });
    }

    const stats = this.#errorStatistics.get(key);
    stats.count++;
    stats.lastOccurrence = context.timestamp;

    // Increment operation count for throttling
    this.#cleanupThrottle.operationCount++;

    // Throttled cleanup to prevent O(n) performance issues
    this.#throttledCleanupStatistics();
  }

  /**
   * Dispatch error event to EventBus for monitoring
   *
   * @private
   * @param {Error} error - The error
   * @param {object} context - Error context
   */
  async #dispatchErrorEvent(error, context) {
    try {
      await this.#eventBus.dispatch('core:cliche_error_occurred', {
        error: {
          name: error.name,
          message: error.message,
          code: error.code || 'UNKNOWN',
          details: error.details,
          stack: error.stack,
        },
        context,
        timestamp: context.timestamp,
        severity: this.#determineErrorSeverity(error),
      });
    } catch (eventError) {
      this.#logger.error('Failed to dispatch error event:', eventError);
    }
  }

  /**
   * Check circuit breaker state for operation
   *
   * @private
   * @param {string} operation - Operation name
   * @returns {object} Circuit breaker state
   */
  #checkCircuitBreaker(operation) {
    const breaker = this.#circuitBreakers.get(operation);

    if (!breaker) {
      return { isOpen: false };
    }

    const now = Date.now();

    // Check if circuit should be reset
    if (breaker.state === 'open' && now > breaker.resetTime) {
      breaker.state = 'half-open';
      this.#logger.info(
        `Circuit breaker transitioning to half-open for: ${operation}`
      );
    }

    return {
      isOpen: breaker.state === 'open',
      state: breaker.state,
      failureCount: breaker.failureCount,
    };
  }

  /**
   * Update circuit breaker based on operation result
   *
   * @private
   * @param {string} operation - Operation name
   * @param {boolean} success - Whether operation succeeded
   */
  #updateCircuitBreaker(operation, success) {
    let breaker = this.#circuitBreakers.get(operation);

    if (!breaker) {
      breaker = {
        state: 'closed',
        failureCount: 0,
        resetTime: null,
      };
      this.#circuitBreakers.set(operation, breaker);
    }

    if (success) {
      breaker.failureCount = 0;
      breaker.state = 'closed';
      breaker.resetTime = null;
    } else {
      breaker.failureCount++;

      if (breaker.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
        breaker.state = 'open';
        breaker.resetTime = Date.now() + CIRCUIT_BREAKER_CONFIG.resetTimeout;

        this.#logger.warn(
          `Circuit breaker opened for operation: ${operation}`,
          {
            failureCount: breaker.failureCount,
            resetTime: new Date(breaker.resetTime).toISOString(),
          }
        );
      }
    }
  }

  /**
   * Handle circuit breaker open state
   *
   * @private
   * @param {Error} error - The error
   * @param {object} context - Error context
   * @returns {object} Circuit breaker response
   */
  #handleCircuitBreakerOpen(error, context) {
    return {
      success: false,
      shouldRetry: false,
      userMessage:
        'The service is temporarily unavailable. Please try again in a few minutes.',
      circuitBreakerOpen: true,
      errorCategory: ERROR_CATEGORIES.NON_RETRYABLE,
      recommendation: 'WAIT_AND_RETRY',
    };
  }

  /**
   * Categorize error for recovery strategy selection
   *
   * @private
   * @param {Error} error - The error
   * @param {object} context - Error context
   * @returns {string} Error category
   */
  #categorizeError(error, context) {
    if (error instanceof ClicheLLMError) {
      return error.isTemporaryFailure()
        ? ERROR_CATEGORIES.RETRYABLE
        : ERROR_CATEGORIES.NON_RETRYABLE;
    }

    if (error instanceof ClicheStorageError) {
      return ERROR_CATEGORIES.DEGRADATION_POSSIBLE;
    }

    if (
      error instanceof ClicheValidationError ||
      error instanceof ClichePrerequisiteError
    ) {
      return ERROR_CATEGORIES.USER_ACTION_REQUIRED;
    }

    if (error instanceof ClicheDataIntegrityError) {
      return ERROR_CATEGORIES.USER_ACTION_REQUIRED;
    }

    return ERROR_CATEGORIES.NON_RETRYABLE;
  }

  /**
   * Select appropriate recovery strategy based on error and context
   *
   * @private
   * @param {Error} error - The error
   * @param {object} context - Error context
   * @param {string} category - Error category
   * @returns {Promise<object>} Recovery strategy
   */
  async #selectRecoveryStrategy(error, context, category) {
    switch (error.constructor) {
      case ClicheLLMError:
      case ClicheGenerationError:
        return await this.#handleLLMError(error, context);

      case ClicheStorageError:
        return await this.#handleStorageError(error, context);

      case ClicheValidationError:
      case ClichePrerequisiteError:
        return await this.#handleValidationError(error, context);

      case ClicheDataIntegrityError:
        return await this.#handleDataIntegrityError(error, context);

      case ClicheError:
        return await this.#handleGenericClicheError(error, context);

      default:
        return await this.#handleUnknownError(error, context);
    }
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   *
   * @private
   * @param {number} attempt - Current attempt number
   * @returns {number} Delay in milliseconds
   */
  #calculateRetryDelay(attempt) {
    const exponentialDelay = Math.min(
      this.#retryConfig.baseDelay *
        Math.pow(this.#retryConfig.backoffMultiplier, attempt - 1),
      this.#retryConfig.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter =
      Math.random() * this.#retryConfig.jitterFactor * exponentialDelay;

    return Math.floor(exponentialDelay + jitter);
  }

  /**
   * Determine if LLM error is retryable
   *
   * @private
   * @param {Error} error - LLM error
   * @returns {boolean} Whether error is retryable
   */
  #isLLMErrorRetryable(error) {
    if (error instanceof ClicheLLMError) {
      return error.isRetryable && error.isTemporaryFailure();
    }

    // Generation errors are generally retryable unless explicitly marked otherwise
    return error instanceof ClicheGenerationError;
  }

  /**
   * Generate retry message for LLM errors
   *
   * @private
   * @param {number} attempt - Current attempt
   * @param {number} maxRetries - Maximum retries
   * @returns {string} User message
   */
  #getLLMRetryMessage(attempt, maxRetries) {
    if (attempt === 2) {
      return 'Generation is taking longer than expected. Retrying...';
    }

    return `Generation delayed. Attempting retry ${attempt}/${maxRetries}...`;
  }

  /**
   * Generate failure message for LLM errors
   *
   * @private
   * @param {Error} error - The error
   * @param {object} context - Error context
   * @returns {string} User message
   */
  #getLLMFailureMessage(error, context) {
    const { attempt = 1, maxRetries = this.#retryConfig.maxRetries } = context;

    // If we've exhausted retries, show "unable" message
    if (attempt >= maxRetries && this.#isLLMErrorRetryable(error)) {
      return 'Unable to generate clichés after multiple attempts. Please try again later or contact support.';
    }

    if (error.statusCode === 429) {
      return 'Generation service is busy. Please try again in a few minutes.';
    }

    if (error.statusCode >= 500) {
      return 'Generation service is temporarily unavailable. Please try again later.';
    }

    return 'Unable to generate clichés at this time. Please try again or contact support if the problem persists.';
  }

  /**
   * Get LLM fallback options
   *
   * @private
   * @param {Error} error - The error
   * @param {object} context - Error context
   * @returns {Array} Fallback options
   */
  #getLLMFallbackOptions(error, context) {
    return [
      { action: 'MANUAL_ENTRY', label: 'Enter clichés manually' },
      { action: 'TRY_LATER', label: 'Try again later' },
      { action: 'CONTACT_SUPPORT', label: 'Contact support' },
    ];
  }

  /**
   * Get storage fallback strategy
   *
   * @private
   * @param {string} operation - Storage operation that failed
   * @returns {object} Fallback strategy
   */
  #getStorageFallbackStrategy(operation) {
    const strategies = {
      save: { action: 'USE_MEMORY_STORAGE', temporary: true },
      load: { action: 'USE_DEFAULT_DATA', temporary: false },
      delete: { action: 'MARK_FOR_DELETION', temporary: true },
    };

    return (
      strategies[operation] || { action: 'USE_MEMORY_STORAGE', temporary: true }
    );
  }

  /**
   * Get user message for validation errors
   *
   * @private
   * @param {Error} error - Validation error
   * @returns {string} User message
   */
  #getValidationUserMessage(error) {
    if (error instanceof ClichePrerequisiteError) {
      return 'Please ensure all required information is provided before proceeding.';
    }

    if (error.validationErrors && error.validationErrors.length > 0) {
      return error.getValidationSummary
        ? error.getValidationSummary()
        : error.validationErrors[0];
    }

    return error.message || 'Please check your input and try again.';
  }

  /**
   * Get actionable steps for validation errors
   *
   * @private
   * @param {Error} error - Validation error
   * @returns {Array<string>} Actionable steps
   */
  #getValidationActionableSteps(error) {
    const steps = [];

    if (error instanceof ClichePrerequisiteError) {
      if (error.missingPrerequisites.includes('direction selection')) {
        steps.push('Select a thematic direction from the dropdown');
      }
      if (error.missingPrerequisites.includes('concept data')) {
        steps.push('Ensure the concept data is loaded properly');
      }
    }

    if (error.validationErrors) {
      error.validationErrors.forEach((validationError) => {
        if (validationError.includes('Direction')) {
          steps.push('Select a valid direction from the available options');
        }
        if (validationError.includes('Category')) {
          steps.push('Ensure all required categories are properly formatted');
        }
      });
    }

    return steps.length > 0
      ? steps
      : ['Please review your input and try again'];
  }

  /**
   * Get data recovery options
   *
   * @private
   * @param {Error} error - Data integrity error
   * @returns {Array} Recovery options
   */
  #getDataRecoveryOptions(error) {
    return [
      { action: 'REFRESH_PAGE', label: 'Refresh page to reload data' },
      { action: 'CLEAR_CACHE', label: 'Clear cache and reload' },
      { action: 'RESTART_SESSION', label: 'Start a new session' },
    ];
  }

  /**
   * Determine appropriate log level for error
   *
   * @private
   * @param {Error} error - The error
   * @returns {string} Log level
   */
  #determineLogLevel(error) {
    if (error instanceof ClicheValidationError) {
      return 'info'; // User input errors are informational
    }

    if (error instanceof ClicheLLMError && error.statusCode === 429) {
      return 'warn'; // Rate limiting is a warning
    }

    return 'error'; // Default to error level
  }

  /**
   * Determine error severity for monitoring
   *
   * @private
   * @param {Error} error - The error
   * @returns {string} Severity level
   */
  #determineErrorSeverity(error) {
    if (
      error instanceof ClicheValidationError ||
      error instanceof ClichePrerequisiteError
    ) {
      return 'LOW';
    }

    if (error instanceof ClicheStorageError) {
      return 'MEDIUM';
    }

    if (error instanceof ClicheDataIntegrityError) {
      return 'HIGH';
    }

    return 'MEDIUM';
  }

  /**
   * Generate session ID for error tracking
   *
   * @private
   * @returns {string} Session ID
   */
  #generateSessionId() {
    return `cliche-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Throttled cleanup of old statistics to prevent O(n) performance issues
   *
   * Only performs cleanup when operation count or time thresholds are exceeded,
   * preventing the previous O(n) issue where cleanup ran on every error.
   *
   * @private
   */
  #throttledCleanupStatistics() {
    const now = Date.now();
    const timeSinceLastCleanup = now - this.#cleanupThrottle.lastCleanup;

    const shouldCleanupByOperations =
      this.#cleanupThrottle.operationCount >=
      CLEANUP_THROTTLE_CONFIG.operationsThreshold;
    const shouldCleanupByTime =
      timeSinceLastCleanup >= CLEANUP_THROTTLE_CONFIG.timeThreshold;

    if (shouldCleanupByOperations || shouldCleanupByTime) {
      this.#cleanupOldStatistics();

      // Reset throttling counters
      this.#cleanupThrottle.operationCount = 0;
      this.#cleanupThrottle.lastCleanup = now;

      this.#logger.debug(`Error statistics cleanup performed`, {
        triggerReason: shouldCleanupByOperations
          ? 'operations_threshold'
          : 'time_threshold',
        statisticsCount: this.#errorStatistics.size,
      });
    }
  }

  /**
   * Clean up old error statistics (internal implementation)
   *
   * @private
   */
  #cleanupOldStatistics() {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    for (const [key, stats] of this.#errorStatistics) {
      if (new Date(stats.lastOccurrence).getTime() < twentyFourHoursAgo) {
        this.#errorStatistics.delete(key);
      }
    }
  }
}
