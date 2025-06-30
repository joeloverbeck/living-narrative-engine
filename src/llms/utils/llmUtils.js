/**
 * Utility functions for LLM-related helpers.
 *
 * @module llmUtils
 */

import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { isValidEnvironmentContext } from '../environmentContext.js';
import { InvalidEnvironmentContextError } from '../../errors/invalidEnvironmentContextError.js';

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
 * Validates an {@link EnvironmentContext} instance.
 *
 * When the context is invalid, an {@link InvalidEnvironmentContextError}
 * is thrown. If a dispatcher is provided, a system error event is also
 * emitted via {@link safeDispatchError} before throwing.
 *
 * @param {EnvironmentContext|any} ctx - The context object to validate.
 * @param {string} contextMsg - Prefix for the error message.
 * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} [dispatcher] - Dispatcher for error events.
 * @param {import('../../interfaces/coreServices.js').ILogger} [logger=console] - Logger used when dispatcher is absent.
 * @returns {boolean} True if the context is valid.
 * @throws {InvalidEnvironmentContextError} When the context is invalid.
 */
export function validateEnvironmentContext(
  ctx,
  contextMsg,
  dispatcher,
  logger = console
) {
  if (!isValidEnvironmentContext(ctx)) {
    const message = `${contextMsg}: Invalid environmentContext provided.`;
    if (dispatcher && typeof dispatcher.dispatch === 'function') {
      safeDispatchError(dispatcher, message, { providedValue: ctx }, logger);
    } else if (logger && typeof logger.error === 'function') {
      logger.error(message, { providedValue: ctx });
    }
    throw new InvalidEnvironmentContextError(message, { providedValue: ctx });
  }
  return true;
}
