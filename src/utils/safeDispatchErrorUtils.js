// src/utils/safeDispatchErrorUtils.js

/**
 * @file Utility to safely dispatch a standardized error event using an
 * ISafeEventDispatcher.
 */

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';

/**
 * Sends a `core:system_error_occurred` event with a consistent payload structure.
 * The dispatcher is validated before dispatching.
 *
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher used to emit the event.
 * @param {string} message - Human readable error message.
 * @param {object} [details] - Additional structured details for debugging.
 * @throws {Error} If the dispatcher is missing or invalid.
 * @returns {void}
 * @example
 * safeDispatchError(safeEventDispatcher, 'Invalid action', { id: 'bad-action' });
 */
export function safeDispatchError(dispatcher, message, details = {}) {
  const hasDispatch = dispatcher && typeof dispatcher.dispatch === 'function';
  if (!hasDispatch) {
    const errorMsg =
      "Invalid or missing method 'dispatch' on dependency 'safeDispatchError: dispatcher'.";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, { message, details });
}

// --- FILE END ---
