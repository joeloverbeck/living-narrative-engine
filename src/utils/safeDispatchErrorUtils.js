// src/utils/safeDispatchErrorUtils.js

/**
 * @file Utility to safely dispatch a standardized error event using an
 * ISafeEventDispatcher.
 */

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../actions/errors/actionErrorTypes.js').ActionErrorContext} ActionErrorContext */

import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';
import { ensureValidLogger } from './loggerUtils.js';

/**
 * Error thrown when `safeDispatchError` receives an invalid dispatcher.
 */
export class InvalidDispatcherError extends Error {
  /**
   * Creates an instance of InvalidDispatcherError.
   *
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
 * Can accept either traditional message/details or an ActionErrorContext object.
 *
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher used to emit the event.
 * @param {string|ActionErrorContext} messageOrContext - Human readable error message or ActionErrorContext.
 * @param {object} [details] - Additional structured details for debugging (ignored if first param is ActionErrorContext).
 * @param {ILogger} [logger] - Optional logger for error logging. When omitted, a
 * console-based fallback is used.
 * @throws {InvalidDispatcherError} If the dispatcher is missing or invalid.
 * @returns {Promise<boolean>} Resolves `true` when the dispatcher confirms the
 * error event was emitted, or `false` when the dispatch fails.
 * @example
 * safeDispatchError(safeEventDispatcher, 'Invalid action', { id: 'bad-action' });
 * // or
 * safeDispatchError(safeEventDispatcher, actionErrorContext);
 */
export async function safeDispatchError(
  dispatcher,
  messageOrContext,
  details = {},
  logger
) {
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

  let message;
  let eventDetails;

  // Check if we received an ActionErrorContext
  if (
    typeof messageOrContext === 'object' &&
    messageOrContext.actionId &&
    messageOrContext.error
  ) {
    // It's an ActionErrorContext
    const errorContext = messageOrContext;
    message =
      errorContext.error.message || 'An error occurred in the action system';
    eventDetails = {
      errorContext,
      // Include some key fields at top level for backward compatibility
      actionId: errorContext.actionId,
      phase: errorContext.phase,
      targetId: errorContext.targetId,
    };
  } else {
    // Traditional string message
    message = messageOrContext;
    // Preserve null explicitly, only default undefined to {}
    eventDetails = details === undefined ? {} : details;
  }

  try {
    const dispatchResult = await dispatcher.dispatch(
      SYSTEM_ERROR_OCCURRED_ID,
      {
        message,
        details: eventDetails,
      }
    );

    if (dispatchResult !== true) {
      log.warn(
        `safeDispatchError: Dispatcher reported failure for ${SYSTEM_ERROR_OCCURRED_ID}.`,
        { dispatchResult }
      );
      return false;
    }

    return true;
  } catch (error) {
    log.error(
      `safeDispatchError: Failed to dispatch ${SYSTEM_ERROR_OCCURRED_ID}.`,
      error
    );
    return false;
  }
}

/**
 * Dispatches a validation error and returns a standardized result object.
 *
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