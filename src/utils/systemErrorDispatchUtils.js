// src/utils/systemErrorDispatchUtils.js

/**
 * @file Utility to dispatch system error events asynchronously.
 */

/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';

/**
 * Dispatches a system error event asynchronously with the provided details.
 *
 * @param {IValidatedEventDispatcher} dispatcher - The event dispatcher to use.
 * @param {string} message - The error message.
 * @param {object} details - Additional error details.
 * @param {ILogger} logger - Logger instance for error logging.
 * @returns {Promise<void>}
 */
export async function dispatchSystemErrorEvent(
  dispatcher,
  message,
  details,
  logger
) {
  try {
    await dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message,
      details,
    });
  } catch (error) {
    // If we can't dispatch the error event, at least log it
    if (logger && typeof logger.error === 'function') {
      logger.error(`Failed to dispatch system error event: ${message}`, {
        originalDetails: details,
        dispatchError: error,
      });
    }
  }
}
