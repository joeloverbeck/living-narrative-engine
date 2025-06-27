// src/utils/safeDispatchErrorUtils.js

/**
 * @file Utility to safely dispatch a standardized error event using an
 * ISafeEventDispatcher.
 */

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';
import { ensureValidLogger } from './loggerUtils.js';

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
 * @param {ILogger} [logger] - Optional logger for error logging. When omitted, a
 * console-based fallback is used.
 * @throws {InvalidDispatcherError} If the dispatcher is missing or invalid.
 * @returns {void}
 * @example
 * safeDispatchError(safeEventDispatcher, 'Invalid action', { id: 'bad-action' });
 */
export function safeDispatchError(dispatcher, message, details = {}, logger) {
  const log = ensureValidLogger(logger, 'safeDispatchError');
  const hasDispatch = dispatcher && typeof dispatcher.dispatch === 'function';
  if (!hasDispatch) {
    const errorMsg =
      "Invalid or missing method 'dispatch' on dependency 'safeDispatchError: dispatcher'.";
    log.error(errorMsg);
    throw new InvalidDispatcherError(errorMsg, {
      functionName: 'safeDispatchError',
    });
  }

  dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, { message, details });
}

/**
 * @description Dispatches a validation error and returns a standardized result object.
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher used to emit the event.
 * @param {string} message - Human readable error message.
 * @param {object} [details] - Additional structured details for debugging.
 * @param {ILogger} [logger] - Optional logger for error logging. When omitted, a
 * console-based fallback is used.
 * @returns {{ ok: false, error: string, details?: object }} Result object for validation failures.
 */
export function dispatchValidationError(dispatcher, message, details, logger) {
  safeDispatchError(dispatcher, message, details, logger);
  return details !== undefined
    ? { ok: false, error: message, details }
    : { ok: false, error: message };
}

// --- FILE END ---
