/**
 * @file Helper for dispatching events with error handling and logging.
 */

/**
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */
/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

import { ensureValidLogger } from './loggerUtils.js';
import { safeDispatchError } from './safeDispatchErrorUtils.js';
import { createErrorDetails } from './errorDetails.js';

/**
 * Dispatches an event using the provided dispatcher and logs the outcome.
 *
 * @description
 * Mimics the error handling behavior originally embedded in CommandProcessor.
 * On success, a debug message is logged. When the dispatcher returns `false`, a
 * warning is logged. On exception, a system error event is dispatched and the
 * function returns `false`.
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher used to emit the event.
 * @param {string} eventName - Name of the event to dispatch.
 * @param {object} payload - Payload for the event.
 * @param {ILogger} [logger] - Logger for debug/error output.
 * @param {string} context - Contextual identifier used in log messages.
 * @returns {Promise<boolean>} `true` if the dispatcher reported success, `false` otherwise.
 */
export async function dispatchWithErrorHandling(
  dispatcher,
  eventName,
  payload,
  logger,
  context
) {
  const log = ensureValidLogger(logger, 'dispatchWithErrorHandling');
  log.debug(
    `dispatchWithErrorHandling: Attempting dispatch: ${context} ('${eventName}')`
  );
  try {
    const success = await dispatcher.dispatch(eventName, payload);
    if (success) {
      log.debug(
        `dispatchWithErrorHandling: Dispatch successful for ${context}.`
      );
    } else {
      log.warn(
        `dispatchWithErrorHandling: SafeEventDispatcher reported failure for ${context} (likely VED validation failure). Payload: ${JSON.stringify(
          payload
        )}`
      );
    }
    return success;
  } catch (error) {
    log.error(
      `dispatchWithErrorHandling: CRITICAL - Error during dispatch for ${context}. Error: ${error.message}`,
      error
    );
    safeDispatchError(
      dispatcher,
      'System error during event dispatch.',
      createErrorDetails(
        `Exception in dispatch for ${eventName}`,
        error?.stack || new Error().stack
      ),
      log
    );
    return false;
  }
}

// --- FILE END ---
