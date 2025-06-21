// src/utils/safeDispatchErrorUtils.js

/**
 * @file Utility to safely dispatch a standardized error event using an
 * ISafeEventDispatcher.
 */

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';

/**
 * Error thrown when `safeDispatchError` receives an invalid dispatcher.
 */
export class InvalidDispatcherError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {object} [details] - Optional diagnostic details.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'InvalidDispatcherError';
    this.details = details;
  }
}

/**
 * Sends a `core:system_error_occurred` event with a consistent payload structure.
 * The dispatcher is validated before dispatching.
 *
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher used to emit the event.
 * @param {string} message - Human readable error message.
 * @param {object} [details] - Additional structured details for debugging.
 * @param {ILogger} [logger] - Optional logger for error logging.
 * @throws {InvalidDispatcherError} If the dispatcher is missing or invalid.
 * @returns {void}
 * @example
 * safeDispatchError(safeEventDispatcher, 'Invalid action', { id: 'bad-action' });
 */
export function safeDispatchError(
  dispatcher,
  message,
  details = {},
  logger = console
) {
  const hasDispatch = dispatcher && typeof dispatcher.dispatch === 'function';
  if (!hasDispatch) {
    const errorMsg =
      "Invalid or missing method 'dispatch' on dependency 'safeDispatchError: dispatcher'.";
    logger.error(errorMsg);
    throw new InvalidDispatcherError(errorMsg, {
      functionName: 'safeDispatchError',
    });
  }

  dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, { message, details });
}

// --- FILE END ---
