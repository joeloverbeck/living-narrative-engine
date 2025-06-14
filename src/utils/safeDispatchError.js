// src/utils/safeDispatchError.js

/**
 * @file Utility to safely dispatch a standardized error event using an
 * ISafeEventDispatcher.
 */

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { DISPLAY_ERROR_ID } from '../constants/eventIds.js';
import { validateDependency } from './validationUtils.js';

/**
 * @description
 * Sends a `core:display_error` event with a consistent payload structure.
 * The dispatcher is validated before dispatching.
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher used to emit the event.
 * @param {string} message - Human readable error message.
 * @param {object} [details] - Additional structured details for debugging.
 * @throws {Error} If the dispatcher is missing or invalid.
 * @returns {void}
 * @example
 * safeDispatchError(safeEventDispatcher, 'Invalid action', { id: 'bad-action' });
 */
export function safeDispatchError(dispatcher, message, details = {}) {
  validateDependency(dispatcher, 'safeDispatchError: dispatcher', console, {
    requiredMethods: ['dispatch'],
  });

  dispatcher.dispatch(DISPLAY_ERROR_ID, { message, details });
}

// --- FILE END ---
