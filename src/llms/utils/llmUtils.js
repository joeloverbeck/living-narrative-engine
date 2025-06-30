/**
 * Utility functions for LLM-related helpers.
 *
 * @module llmUtils
 */

/**
 * Retrieves the LLM identifier from configuration with a fallback to 'UnknownLLM'.
 *
 * @param {object} [config] - The LLM configuration object.
 * @returns {string} The configuration's configId or 'UnknownLLM' if unavailable.
 */
export function getLlmId(config) {
  return config?.configId || 'UnknownLLM';
}
