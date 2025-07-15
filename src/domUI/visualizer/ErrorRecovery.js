/**
 * @file Error recovery framework for anatomy visualization
 * @description Provides graceful fallbacks, retry mechanisms, and user-friendly error handling
 * @see src/errors/anatomyVisualizationError.js, src/domUI/visualizer/VisualizerStateController.js
 */

import { validateDependency } from '../../utils/index.js';
import { AnatomyVisualizationError } from '../../errors/anatomyVisualizationError.js';
import { AnatomyDataError } from '../../errors/anatomyDataError.js';
import { AnatomyRenderError } from '../../errors/anatomyRenderError.js';
import { AnatomyStateError } from '../../errors/anatomyStateError.js';

/**
 * Comprehensive error recovery framework for anatomy visualization.
 * Handles error classification, recovery strategies, fallback mechanisms,
 * and user-friendly error reporting.
 *
 * @class ErrorRecovery
 */
class ErrorRecovery {
  #logger;
  #eventDispatcher;
  #retryAttempts;
  #maxRetryAttempts;
  #retryDelayMs;
  #useExponentialBackoff;
  #fallbackStrategies;
  #errorHistory;
  #disposed;

  /**
   * Creates a new ErrorRecovery instance
   *
   * @param {object} dependencies - Required dependencies
   * @param {object} dependencies.logger - Logging service
   * @param {object} dependencies.eventDispatcher - Event dispatching service
   * @param {object} options - Configuration options
   * @param {number} options.maxRetryAttempts - Maximum retry attempts (default: 3)
   * @param {number} options.retryDelayMs - Base retry delay in milliseconds (default: 1000)
   * @param {boolean} options.useExponentialBackoff - Use exponential backoff for retries (default: true)
   */
  constructor(dependencies, options = {}) {
    this.#logger = null;
    this.#eventDispatcher = null;
    this.#disposed = false;

    // Validate dependencies
    validateDependency(dependencies.logger, 'logger');
    validateDependency(dependencies.eventDispatcher, 'eventDispatcher');

    this.#logger = dependencies.logger;
    this.#eventDispatcher = dependencies.eventDispatcher;

    // Configuration
    this.#maxRetryAttempts = options.maxRetryAttempts || 3;
    this.#retryDelayMs = options.retryDelayMs || 1000;
    this.#useExponentialBackoff = options.useExponentialBackoff !== false;

    // State
    this.#retryAttempts = new Map(); // operation -> attempt count
    this.#errorHistory = [];
    this.#fallbackStrategies = new Map();

    // Register default fallback strategies
    this._registerDefaultFallbackStrategies();
  }

  /**
   * Handle an error with appropriate recovery strategy
   *
   * @param {Error} error - Error to handle
   * @param {object} context - Context information
   * @param {string} context.operation - Operation that failed
   * @param {object} context.data - Data related to the operation
   * @param {Function} context.retryCallback - Function to call for retry
   * @param {object} context.fallbackOptions - Options for fallback strategies
   * @returns {Promise<object>} Recovery result
   */
  async handleError(error, context = {}) {
    this._throwIfDisposed();

    const {
      operation = 'unknown',
      data = null,
      retryCallback = null,
      fallbackOptions = {},
    } = context;

    // Log error details
    this._logError(error, context);

    // Record error in history
    this._recordError(error, context);

    // Determine recovery strategy
    const strategy = this._determineRecoveryStrategy(error, context);

    // Dispatch error event for UI handling
    this._dispatchErrorEvent(error, context, strategy);

    // Execute recovery strategy
    try {
      const result = await this._executeRecoveryStrategy(
        strategy,
        error,
        context
      );

      // Clear retry attempts on successful recovery
      if (result.success) {
        this.#retryAttempts.delete(operation);
      }

      return result;
    } catch (recoveryError) {
      this.#logger.error('Recovery strategy failed:', recoveryError);
      return {
        success: false,
        strategy: 'failed',
        error: recoveryError,
        userMessage: 'Recovery failed. Please refresh the page.',
        suggestions: [
          'Refresh the page',
          'Contact support if the problem persists',
        ],
      };
    }
  }

  /**
   * Register a custom fallback strategy
   *
   * @param {string} errorType - Type of error this strategy handles
   * @param {Function} strategy - Strategy function
   */
  registerFallbackStrategy(errorType, strategy) {
    this._throwIfDisposed();

    if (typeof strategy !== 'function') {
      throw new Error('Fallback strategy must be a function');
    }

    this.#fallbackStrategies.set(errorType, strategy);
    this.#logger.debug(`Registered fallback strategy for ${errorType}`);
  }

  /**
   * Clear retry attempts for an operation
   *
   * @param {string} operation - Operation to clear
   */
  clearRetryAttempts(operation) {
    this._throwIfDisposed();
    this.#retryAttempts.delete(operation);
  }

  /**
   * Get error history
   *
   * @param {number} limit - Maximum number of errors to return
   * @returns {Array<object>} Recent error history
   */
  getErrorHistory(limit = 10) {
    this._throwIfDisposed();
    return this.#errorHistory.slice(-limit);
  }

  /**
   * Check if an operation can be retried
   *
   * @param {string} operation - Operation to check
   * @returns {boolean} True if operation can be retried
   */
  canRetry(operation) {
    this._throwIfDisposed();
    const attempts = this.#retryAttempts.get(operation) || 0;
    return attempts < this.#maxRetryAttempts;
  }

  /**
   * Get retry delay for an operation
   *
   * @param {string} operation - Operation to get delay for
   * @returns {number} Delay in milliseconds
   */
  getRetryDelay(operation) {
    this._throwIfDisposed();
    const attempts = this.#retryAttempts.get(operation) || 0;

    if (!this.#useExponentialBackoff) {
      return this.#retryDelayMs;
    }

    // Exponential backoff with jitter
    const baseDelay = this.#retryDelayMs * Math.pow(2, attempts);
    const jitter = Math.random() * 0.3; // Up to 30% jitter
    return Math.floor(baseDelay * (1 + jitter));
  }

  /**
   * Dispose the error recovery instance
   */
  dispose() {
    if (this.#disposed) {
      return;
    }

    this.#retryAttempts.clear();
    this.#fallbackStrategies.clear();
    this.#errorHistory.length = 0;
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
   * Determine the appropriate recovery strategy for an error
   *
   * @private
   * @param {Error} error - Error to analyze
   * @param {object} context - Error context
   * @returns {string} Recovery strategy name
   */
  _determineRecoveryStrategy(error, context) {
    const { operation } = context;

    // Check if error is recoverable
    if (error instanceof AnatomyVisualizationError && !error.recoverable) {
      return 'fallback';
    }

    // Check retry eligibility
    if (this.canRetry(operation) && this._isRetryable(error)) {
      return 'retry';
    }

    // Check for custom fallback strategy
    if (this.#fallbackStrategies.has(error.constructor.name)) {
      return 'custom_fallback';
    }

    // Default to built-in fallback
    return 'fallback';
  }

  /**
   * Execute the selected recovery strategy
   *
   * @private
   * @param {string} strategy - Strategy to execute
   * @param {Error} error - Original error
   * @param {object} context - Error context
   * @returns {Promise<object>} Recovery result
   */
  async _executeRecoveryStrategy(strategy, error, context) {
    switch (strategy) {
      case 'retry':
        return await this._executeRetryStrategy(error, context);
      case 'custom_fallback':
        return await this._executeCustomFallback(error, context);
      case 'fallback':
        return await this._executeFallbackStrategy(error, context);
      default:
        throw new Error(`Unknown recovery strategy: ${strategy}`);
    }
  }

  /**
   * Execute retry strategy
   *
   * @private
   * @param {Error} error - Original error
   * @param {object} context - Error context
   * @returns {Promise<object>} Recovery result
   */
  async _executeRetryStrategy(error, context) {
    const { operation, retryCallback } = context;

    if (!retryCallback || typeof retryCallback !== 'function') {
      throw new Error('Retry callback is required for retry strategy');
    }

    let lastError = error;

    // Keep retrying until we succeed or exhaust all attempts
    while (this.canRetry(operation)) {
      // Increment retry attempts
      const attempts = (this.#retryAttempts.get(operation) || 0) + 1;
      this.#retryAttempts.set(operation, attempts);

      // Calculate delay
      const delay = this.getRetryDelay(operation);

      this.#logger.debug(
        `Retrying ${operation} (attempt ${attempts}/${this.#maxRetryAttempts}) after ${delay}ms`
      );

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        // Execute retry
        const result = await retryCallback();

        return {
          success: true,
          strategy: 'retry',
          attempt: attempts,
          result,
          userMessage: `Retry successful after ${attempts} attempt${attempts > 1 ? 's' : ''}.`,
          suggestions: [],
        };
      } catch (retryError) {
        lastError = retryError;
        // Continue to next iteration if we can still retry
      }
    }

    // All retries exhausted, fall back
    return await this._executeFallbackStrategy(lastError, context);
  }

  /**
   * Execute custom fallback strategy
   *
   * @private
   * @param {Error} error - Original error
   * @param {object} context - Error context
   * @returns {Promise<object>} Recovery result
   */
  async _executeCustomFallback(error, context) {
    const strategy = this.#fallbackStrategies.get(error.constructor.name);

    try {
      const result = await strategy(error, context);

      return {
        success: true,
        strategy: 'custom_fallback',
        result,
        userMessage: result.userMessage || 'Used alternative approach.',
        suggestions: result.suggestions || [],
      };
    } catch (fallbackError) {
      // Fall back to built-in fallback if custom strategy fails
      return await this._executeFallbackStrategy(fallbackError, context);
    }
  }

  /**
   * Execute built-in fallback strategy
   *
   * @private
   * @param {Error} error - Original error
   * @param {object} context - Error context
   * @returns {Promise<object>} Recovery result
   */
  async _executeFallbackStrategy(error, context) {
    let fallbackResult;

    if (error instanceof AnatomyDataError) {
      fallbackResult = this._handleDataErrorFallback(error, context);
    } else if (error instanceof AnatomyRenderError) {
      fallbackResult = this._handleRenderErrorFallback(error, context);
    } else if (error instanceof AnatomyStateError) {
      fallbackResult = this._handleStateErrorFallback(error, context);
    } else {
      fallbackResult = this._handleGenericErrorFallback(error, context);
    }

    return {
      success: fallbackResult.success || false,
      strategy: 'fallback',
      result: fallbackResult.result || null,
      userMessage: fallbackResult.userMessage || 'Used fallback approach.',
      suggestions: fallbackResult.suggestions || [],
    };
  }

  /**
   * Handle data error fallback
   *
   * @private
   * @param {AnatomyDataError} error - Data error
   * @param {object} context - Error context
   * @returns {object} Fallback result
   */
  _handleDataErrorFallback(error, context) {
    switch (error.code) {
      case 'MISSING_ANATOMY_DATA':
        return {
          success: true,
          result: { emptyVisualization: true },
          userMessage: 'No anatomy data available for this entity.',
          suggestions: [
            'Try selecting a different entity',
            'This entity may not have anatomy information',
          ],
        };
      case 'MISSING_ANATOMY_PARTS':
        return {
          success: true,
          result: { partialVisualization: true },
          userMessage: 'Showing available anatomy parts only.',
          suggestions: [
            'Some parts may be loading',
            'Try refreshing to load all parts',
          ],
        };
      default:
        return {
          success: false,
          userMessage: 'Could not process anatomy data.',
          suggestions: [
            'Try selecting a different entity',
            'Check that the entity has valid anatomy data',
          ],
        };
    }
  }

  /**
   * Handle render error fallback
   *
   * @private
   * @param {AnatomyRenderError} error - Render error
   * @param {object} context - Error context
   * @returns {object} Fallback result
   */
  _handleRenderErrorFallback(error, context) {
    switch (error.code) {
      case 'SVG_RENDERING_FAILED':
        return {
          success: true,
          result: { textFallback: true },
          userMessage: 'Using text-based anatomy display.',
          suggestions: [
            'Your browser may not support graphics features',
            'Try using a different browser',
          ],
        };
      case 'LAYOUT_CALCULATION_FAILED':
        return {
          success: true,
          result: { simpleLayout: true },
          userMessage: 'Using simplified layout display.',
          suggestions: [
            'The anatomy structure may be too complex',
            'Try selecting a simpler entity',
          ],
        };
      default:
        return {
          success: false,
          userMessage: 'Could not render anatomy visualization.',
          suggestions: ['Try refreshing the page', 'Select a different entity'],
        };
    }
  }

  /**
   * Handle state error fallback
   *
   * @private
   * @param {AnatomyStateError} error - State error
   * @param {object} context - Error context
   * @returns {object} Fallback result
   */
  _handleStateErrorFallback(error, context) {
    switch (error.code) {
      case 'INVALID_STATE_TRANSITION':
        return {
          success: true,
          result: { stateReset: true },
          userMessage: 'Visualizer state has been reset.',
          suggestions: [
            'Try the operation again',
            'Start with selecting an entity',
          ],
        };
      case 'OPERATION_TIMEOUT':
        return {
          success: false,
          userMessage: 'Operation timed out.',
          suggestions: [
            'Try again with a simpler entity',
            'Check your network connection',
          ],
        };
      default:
        return {
          success: false,
          userMessage: 'Visualizer state error occurred.',
          suggestions: ['Try resetting the visualizer', 'Refresh the page'],
        };
    }
  }

  /**
   * Handle generic error fallback
   *
   * @private
   * @param {Error} error - Generic error
   * @param {object} context - Error context
   * @returns {object} Fallback result
   */
  _handleGenericErrorFallback(error, context) {
    return {
      success: false,
      userMessage: 'An unexpected error occurred.',
      suggestions: [
        'Try refreshing the page',
        'Contact support if the problem persists',
      ],
    };
  }

  /**
   * Check if an error is retryable
   *
   * @private
   * @param {Error} error - Error to check
   * @returns {boolean} True if error is retryable
   */
  _isRetryable(error) {
    // Network errors are typically retryable
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true;
    }

    // Timeout errors are retryable
    if (
      error instanceof AnatomyStateError &&
      error.code === 'OPERATION_TIMEOUT'
    ) {
      return true;
    }

    // Some render errors are retryable
    if (
      error instanceof AnatomyRenderError &&
      ['SVG_RENDERING_FAILED', 'LAYOUT_CALCULATION_FAILED'].includes(error.code)
    ) {
      return true;
    }

    // Data errors with specific codes are retryable
    if (
      error instanceof AnatomyDataError &&
      error.code === 'MISSING_ANATOMY_PARTS'
    ) {
      return true;
    }

    // Check if error explicitly defines retryability
    if (error instanceof AnatomyVisualizationError) {
      return error.recoverable;
    }

    // Default to not retryable for unknown errors
    return false;
  }

  /**
   * Register default fallback strategies
   *
   * @private
   */
  _registerDefaultFallbackStrategies() {
    // Example custom strategy for network errors
    this.registerFallbackStrategy('TypeError', async (error, context) => {
      if (error.message.includes('fetch')) {
        return {
          result: { networkFallback: true },
          userMessage:
            'Network issue detected. Using cached data if available.',
          suggestions: [
            'Check your internet connection',
            'Try again in a moment',
          ],
        };
      }
      throw error; // Not a network error, let default fallback handle it
    });
  }

  /**
   * Log error details
   *
   * @private
   * @param {Error} error - Error to log
   * @param {object} context - Error context
   */
  _logError(error, context) {
    const errorDetails =
      error instanceof AnatomyVisualizationError
        ? error.getErrorDetails()
        : {
            name: error.name,
            message: error.message,
            stack: error.stack,
          };

    this.#logger.error('ErrorRecovery handling error:', {
      error: errorDetails,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record error in history
   *
   * @private
   * @param {Error} error - Error to record
   * @param {object} context - Error context
   */
  _recordError(error, context) {
    const errorRecord = {
      error:
        error instanceof AnatomyVisualizationError
          ? error.getUserInfo()
          : {
              name: error.name,
              message: error.message,
            },
      context,
      timestamp: new Date().toISOString(),
    };

    this.#errorHistory.push(errorRecord);

    // Keep only last 50 errors
    if (this.#errorHistory.length > 50) {
      this.#errorHistory.splice(0, this.#errorHistory.length - 50);
    }
  }

  /**
   * Dispatch error event for UI handling
   *
   * @private
   * @param {Error} error - Error that occurred
   * @param {object} context - Error context
   * @param {string} strategy - Recovery strategy
   */
  _dispatchErrorEvent(error, context, strategy) {
    try {
      this.#eventDispatcher.dispatch('anatomy:visualizer_error', {
        error:
          error instanceof AnatomyVisualizationError
            ? error.getUserInfo()
            : {
                name: error.name,
                message: error.message,
              },
        context,
        strategy,
        timestamp: new Date().toISOString(),
      });
    } catch (dispatchError) {
      this.#logger.warn('Failed to dispatch error event:', dispatchError);
    }
  }

  /**
   * Throw error if instance is disposed
   *
   * @private
   */
  _throwIfDisposed() {
    if (this.#disposed) {
      throw new Error('ErrorRecovery instance has been disposed');
    }
  }
}

export { ErrorRecovery };
