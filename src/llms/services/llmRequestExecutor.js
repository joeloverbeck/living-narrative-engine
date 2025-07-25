/**
 * @file LLM request execution service implementation
 * @see src/llms/services/llmRequestExecutor.js
 */

import { ILLMRequestExecutor } from '../interfaces/ILLMRequestExecutor.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ILLMRequestExecutor.js').LLMRequestOptions} LLMRequestOptions
 * @typedef {import('../interfaces/ILLMRequestExecutor.js').RetryOptions} RetryOptions
 */

/**
 * @class LLMRequestExecutor
 * @implements {ILLMRequestExecutor}
 * @description Handles execution of LLM requests with retry logic and abort handling
 */
export class LLMRequestExecutor extends ILLMRequestExecutor {
  #logger;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    super();
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = logger;
    this.#logger.debug('LLMRequestExecutor: Instance created.');
  }

  /**
   * @async
   * @param {LLMRequestOptions} options
   * @returns {Promise<string>}
   * @throws {Error}
   */
  async executeRequest(options) {
    this.#validateRequestOptions(options);

    const {
      strategy,
      gameSummary,
      llmConfig,
      apiKey,
      environmentContext,
      abortSignal,
      requestOptions = {}, // NEW: Accept request options
    } = options;

    this.#logger.debug('LLMRequestExecutor: Executing request', {
      configId: llmConfig.configId,
      strategyMethod: llmConfig.jsonOutputStrategy?.method,
      hasAbortSignal: !!abortSignal,
      hasRequestOptions: Object.keys(requestOptions).length > 0,
    });

    // Handle abort signal if provided
    let abortCleanup = null;
    if (abortSignal) {
      abortCleanup = this.handleAbortSignal(abortSignal, () => {
        this.#logger.debug('LLMRequestExecutor: Request aborted by signal');
      });
    }

    try {
      const result = await strategy.execute({
        gameSummary,
        llmConfig,
        apiKey,
        environmentContext,
        abortSignal,
        requestOptions, // NEW: Pass request options to strategy
      });

      this.#logger.debug('LLMRequestExecutor: Request executed successfully', {
        configId: llmConfig.configId,
      });

      return result;
    } catch (error) {
      this.#logger.error('LLMRequestExecutor: Request execution failed', {
        configId: llmConfig.configId,
        error: error.message,
        errorName: error.name,
      });
      throw error;
    } finally {
      if (abortCleanup) {
        abortCleanup();
      }
    }
  }

  /**
   * @async
   * @param {LLMRequestOptions} options
   * @param {RetryOptions} [retryOptions]
   * @returns {Promise<string>}
   * @throws {Error}
   */
  async executeWithRetry(options, retryOptions = {}) {
    this.#validateRequestOptions(options);

    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2,
    } = retryOptions;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.#logger.debug('LLMRequestExecutor: Attempt', {
          attempt: attempt + 1,
          maxAttempts: maxRetries + 1,
          configId: options.llmConfig.configId,
        });

        const result = await this.executeRequest(options);

        if (attempt > 0) {
          this.#logger.info(
            'LLMRequestExecutor: Request succeeded after retry',
            {
              attempt: attempt + 1,
              configId: options.llmConfig.configId,
            }
          );
        }

        return result;
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries || !this.isRetryableError(error)) {
          this.#logger.error(
            'LLMRequestExecutor: All retry attempts exhausted or non-retryable error',
            {
              attempts: attempt + 1,
              configId: options.llmConfig.configId,
              error: error.message,
              errorName: error.name,
              isRetryable: this.isRetryableError(error),
            }
          );
          throw error;
        }

        // Check if request was aborted
        if (options.abortSignal?.aborted) {
          this.#logger.debug(
            'LLMRequestExecutor: Request aborted, stopping retries'
          );
          throw error;
        }

        this.#logger.warn('LLMRequestExecutor: Request failed, will retry', {
          attempt: attempt + 1,
          nextDelay: delay,
          configId: options.llmConfig.configId,
          error: error.message,
        });

        // Wait before retry
        await this.#delay(delay);

        // Calculate next delay with exponential backoff
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }

    throw lastError;
  }

  /**
   * @param {Error} error
   * @returns {boolean}
   */
  isRetryableError(error) {
    // Network errors
    if (
      error.name === 'NetworkError' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT'
    ) {
      return true;
    }

    // HTTP status-based retryable errors
    if (error.status) {
      // Retry on rate limit (429), server errors (5xx), and gateway timeout (504)
      if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
        return true;
      }
    }

    // HttpClientError with specific status codes
    if (error.name === 'HttpClientError' && error.status) {
      return (
        error.status === 429 || (error.status >= 500 && error.status < 600)
      );
    }

    // Specific error types that are retryable
    if (error.name === 'RateLimitError' || error.name === 'ServerError') {
      return true;
    }

    // Default: not retryable
    return false;
  }

  /**
   * @param {AbortSignal} signal
   * @param {Function} cleanup
   * @returns {Function}
   */
  handleAbortSignal(signal, cleanup) {
    if (!signal || typeof signal.addEventListener !== 'function') {
      this.#logger.warn('LLMRequestExecutor: Invalid abort signal provided');
      return () => {};
    }

    const abortHandler = () => {
      this.#logger.debug('LLMRequestExecutor: Abort signal received');
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };

    signal.addEventListener('abort', abortHandler);

    // Return cleanup function to remove listener
    return () => {
      signal.removeEventListener('abort', abortHandler);
    };
  }

  /**
   * @private
   * @param {LLMRequestOptions} options
   * @throws {Error}
   */
  #validateRequestOptions(options) {
    if (!options || typeof options !== 'object') {
      throw new Error('LLMRequestExecutor: Request options are required');
    }

    if (!options.strategy || typeof options.strategy.execute !== 'function') {
      throw new Error(
        'LLMRequestExecutor: Valid strategy with execute method is required'
      );
    }

    if (typeof options.gameSummary !== 'string') {
      throw new Error('LLMRequestExecutor: gameSummary must be a string');
    }

    if (!options.llmConfig || typeof options.llmConfig !== 'object') {
      throw new Error('LLMRequestExecutor: llmConfig is required');
    }

    if (
      !options.environmentContext ||
      typeof options.environmentContext.getExecutionEnvironment !== 'function'
    ) {
      throw new Error(
        'LLMRequestExecutor: Valid environmentContext is required'
      );
    }
  }

  /**
   * @private
   * @param {number} ms
   * @returns {Promise<void>}
   */
  #delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default LLMRequestExecutor;
