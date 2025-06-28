import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';
import { ensureValidLogger } from './loggerUtils.js';

/**
 * @description Safely dispatches a system error event.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher
 * @param {string} message - Human readable error message.
 * @param {object} [details] - Additional error details.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Logger for diagnostic output.
 * @returns {Promise<void>} Resolves when the event has been dispatched.
 */
export async function dispatchSystemErrorEvent(
  dispatcher,
  message,
  details = {},
  logger
) {
  const log = ensureValidLogger(logger, 'dispatchSystemErrorEvent');
  const hasDispatch = dispatcher && typeof dispatcher.dispatch === 'function';
  if (!hasDispatch) {
    log.error(
      "Invalid or missing method 'dispatch' on dependency 'safeEventDispatcher'."
    );
    return;
  }

  await dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, { message, details });
}
