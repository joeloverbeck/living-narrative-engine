/**
 * Utility functions for LLM-related helpers.
 *
 * @module llmUtils
 */

import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { isValidEnvironmentContext } from '../environmentContext.js';

/** @typedef {import('../environmentContext.js').EnvironmentContext} EnvironmentContext */

/**
 * Retrieves the LLM identifier from configuration with a fallback to 'UnknownLLM'.
 *
 * @param {object} [config] - The LLM configuration object.
 * @returns {string} The configuration's configId or 'UnknownLLM' if unavailable.
 */
export function getLlmId(config) {
  return config?.configId || 'UnknownLLM';
}

/**
 * Validates an {@link EnvironmentContext} instance and dispatches an error when invalid.
 *
 * @param {EnvironmentContext|any} ctx - The context object to validate.
 * @param {string} contextMsg - Prefix for the error message.
 * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher - Dispatcher for error events.
 * @returns {boolean} True if the context is valid; otherwise false.
 */
export function validateEnvironmentContext(ctx, contextMsg, dispatcher) {
  if (!isValidEnvironmentContext(ctx)) {
    safeDispatchError(
      dispatcher,
      `${contextMsg}: Invalid environmentContext provided.`,
      { providedValue: ctx }
    );
    return false;
  }
  return true;
}
