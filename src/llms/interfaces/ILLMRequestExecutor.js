/**
 * @file Interface for LLM request execution
 * @see src/llms/interfaces/ILLMRequestExecutor.js
 */

/**
 * @typedef {import('../llmConfigTypes.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('./ILLMStrategy.js').ILLMStrategy} ILLMStrategy
 * @typedef {import('../environmentContext.js').EnvironmentContext} EnvironmentContext
 */

/**
 * @typedef {object} LLMRequestOptions
 * @property {LLMModelConfig} llmConfig - The LLM configuration
 * @property {string} gameSummary - The prompt to send
 * @property {string} [apiKey] - Optional API key
 * @property {EnvironmentContext} environmentContext - Environment context
 * @property {AbortSignal} [abortSignal] - Optional abort signal
 * @property {ILLMStrategy} strategy - The strategy to use for execution
 */

/**
 * @typedef {object} RetryOptions
 * @property {number} [maxRetries=3] - Maximum number of retry attempts
 * @property {number} [initialDelay=1000] - Initial delay in milliseconds
 * @property {number} [maxDelay=10000] - Maximum delay in milliseconds
 * @property {number} [backoffMultiplier=2] - Backoff multiplier for exponential backoff
 */

/**
 * @interface ILLMRequestExecutor
 * @description Handles execution of LLM requests with retry logic and abort handling
 */
export class ILLMRequestExecutor {
  /**
   * Executes an LLM request
   *
   * @async
   * @param {LLMRequestOptions} options - Request options
   * @returns {Promise<string>} The LLM response
   * @throws {Error} If request fails
   */
  async executeRequest(options) {
    throw new Error('Not implemented');
  }

  /**
   * Executes an LLM request with retry logic
   *
   * @async
   * @param {LLMRequestOptions} options - Request options
   * @param {RetryOptions} [retryOptions] - Retry configuration
   * @returns {Promise<string>} The LLM response
   * @throws {Error} If all retry attempts fail
   */
  async executeWithRetry(options, retryOptions) {
    throw new Error('Not implemented');
  }

  /**
   * Checks if an error is retryable
   *
   * @param {Error} error - The error to check
   * @returns {boolean} True if the error is retryable
   */
  isRetryableError(error) {
    throw new Error('Not implemented');
  }

  /**
   * Handles abort signal setup and cleanup
   *
   * @param {AbortSignal} signal - The abort signal
   * @param {Function} cleanup - Cleanup function to call on abort
   * @returns {Function} Function to remove abort listener
   */
  handleAbortSignal(signal, cleanup) {
    throw new Error('Not implemented');
  }
}

export default ILLMRequestExecutor;
