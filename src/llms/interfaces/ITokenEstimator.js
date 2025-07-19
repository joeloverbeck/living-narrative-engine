/**
 * @file Interface for token estimation and validation
 * @see src/llms/interfaces/ITokenEstimator.js
 */

/**
 * @typedef {import('../llmConfigTypes.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @typedef {object} TokenBudget
 * @property {number} totalLimit - Total token limit for the model
 * @property {number} reservedTokens - Tokens reserved for output
 * @property {number} availableForPrompt - Tokens available for the prompt
 */

/**
 * @typedef {object} TokenValidationResult
 * @property {boolean} isValid - Whether the token count is within limits
 * @property {number} estimatedTokens - The estimated token count
 * @property {number} availableTokens - Available tokens for the prompt
 * @property {number} [excessTokens] - Number of tokens over the limit (if any)
 * @property {boolean} [isNearLimit] - Whether the count is near the limit (>90%)
 */

/**
 * @interface ITokenEstimator
 * @description Estimates and validates token counts for LLM prompts
 */
export class ITokenEstimator {
  /**
   * Estimates the token count for a given text
   *
   * @async
   * @param {string} text - The text to estimate tokens for
   * @param {string} [model] - The model identifier
   * @returns {Promise<number>} The estimated token count
   */
  async estimateTokens(text, model) {
    throw new Error('Not implemented');
  }

  /**
   * Validates if a text is within token limits
   *
   * @async
   * @param {string} text - The text to validate
   * @param {number} limit - The token limit
   * @param {string} [model] - The model identifier
   * @returns {Promise<TokenValidationResult>} Validation result
   */
  async validateTokenLimit(text, limit, model) {
    throw new Error('Not implemented');
  }

  /**
   * Gets the token budget for a given configuration
   *
   * @param {number} contextTokenLimit - Total context token limit
   * @param {number} [maxOutputTokens] - Maximum tokens for output
   * @returns {TokenBudget} The token budget breakdown
   */
  getTokenBudget(contextTokenLimit, maxOutputTokens) {
    throw new Error('Not implemented');
  }

  /**
   * Gets the appropriate encoding for a model
   *
   * @param {string} model - The model identifier
   * @returns {string} The encoding name (e.g., 'cl100k_base')
   */
  getEncodingForModel(model) {
    throw new Error('Not implemented');
  }

  /**
   * Checks if token count is approaching limit
   *
   * @param {number} tokenCount - Current token count
   * @param {number} limit - Token limit
   * @param {number} [threshold] - Warning threshold (default 90%)
   * @returns {boolean} True if near limit
   */
  isNearTokenLimit(tokenCount, limit, threshold) {
    throw new Error('Not implemented');
  }
}

export default ITokenEstimator;
