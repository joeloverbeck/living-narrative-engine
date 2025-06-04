// src/errors/promptTooLongError.js
/**
 * @file Defines a custom error class for when a prompt exceeds the allowed token space.
 */

/**
 * @class PromptTooLongError
 * @augments Error
 * @description Error thrown when the estimated prompt token count surpasses the available token space for an LLM configuration.
 */
class PromptTooLongError extends Error {
  /**
   * Creates an instance of PromptTooLongError.
   *
   * @param {string} message - The error message.
   * @param {object} [details] - Additional context about the error.
   * @param {number} [details.estimatedTokens] - Estimated number of tokens in the prompt.
   * @param {number} [details.promptTokenSpace] - Maximum allowed tokens for the prompt.
   * @param {number} [details.contextTokenLimit] - The overall context token limit of the model.
   * @param {number} [details.maxTokensForOutput] - Tokens reserved for the LLM response.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'PromptTooLongError';
    this.estimatedTokens = details.estimatedTokens;
    this.promptTokenSpace = details.promptTokenSpace;
    this.contextTokenLimit = details.contextTokenLimit;
    this.maxTokensForOutput = details.maxTokensForOutput;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PromptTooLongError);
    }
  }
}

export default PromptTooLongError;
