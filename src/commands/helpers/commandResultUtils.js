// src/commands/helpers/commandResultUtils.js

/**
 * @file Utility helpers for building and dispatching command failure results.
 */

import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { createErrorDetails } from '../../utils/errorDetails.js';

/**
 * Creates a standardized failure {@link import('../../types/commandResult.js').CommandResult}.
 *
 * @param {string} [userError] - User-facing error message.
 * @param {string} [internalError] - Internal error message for logging.
 * @param {string} [originalInput] - The command string that was processed.
 * @param {string} [actionId] - Identifier of the attempted action.
 * @param {boolean} [turnEnded] - Indicates if the turn should end.
 * @returns {import('../../types/commandResult.js').CommandResult} The failure result object.
 */
export function createFailureResult(
  userError,
  internalError,
  originalInput,
  actionId,
  turnEnded = true
) {
  const result = {
    success: false,
    turnEnded,
    internalError,
    originalInput,
  };
  if (actionId) {
    result.actionResult = { actionId };
  }
  if (userError !== undefined) {
    result.error = userError;
  }
  return result;
}

/**
 * Logs an internal error and dispatches a system error event.
 *
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger used for errors.
 * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher - Dispatcher for system errors.
 * @param {string} userMsg - User-facing error message.
 * @param {string} internalMsg - Detailed internal error message.
 * @returns {void}
 */
export function dispatchFailure(logger, dispatcher, userMsg, internalMsg) {
  logger.error(internalMsg);
  safeDispatchError(
    dispatcher,
    userMsg,
    createErrorDetails(internalMsg),
    logger
  );
}

// --- FILE END ---
