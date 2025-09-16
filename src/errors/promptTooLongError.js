// src/errors/promptTooLongError.js
/**
 * @file Defines a custom error class for when a prompt exceeds the allowed token space.
 */

import BaseError from './baseError.js';

/**
 * @class PromptTooLongError
 * @augments BaseError
 * @description Error thrown when the estimated prompt token count surpasses the available token space for an LLM configuration.
 */
class PromptTooLongError extends BaseError {
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
    super(message, 'PROMPT_TOO_LONG_ERROR', details);
    this.name = 'PromptTooLongError';
    // Backward compatibility: preserve all existing properties
    this.estimatedTokens = details.estimatedTokens;
    this.promptTokenSpace = details.promptTokenSpace;
    this.contextTokenLimit = details.contextTokenLimit;
    this.maxTokensForOutput = details.maxTokensForOutput;
  }

  /**
   * @returns {string} Severity level for prompt too long errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Prompt too long errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}

export default PromptTooLongError;
