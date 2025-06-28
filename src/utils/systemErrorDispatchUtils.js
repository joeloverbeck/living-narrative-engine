import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';
import { ensureValidLogger } from './loggerUtils.js';

/**
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Dispatches the core system error event in a safe way.
 * Any dispatch failure is logged but does not throw.
 *
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher used to emit the event.
 * @param {string} message - Human-readable error message.
 * @param {object} [details] - Additional error context.
 * @param {ILogger} [logger] - Optional logger for diagnostics.
 * @returns {Promise<void>} Promise resolved once dispatch completes.
 */
export async function dispatchSystemErrorEvent(
  dispatcher,
  message,
  details = {},
  logger
) {
  const log = ensureValidLogger(logger, 'dispatchSystemErrorEvent');
  if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
    log.error('dispatchSystemErrorEvent: invalid dispatcher provided.', {
      message,
      details,
    });
    return;
  }
  try {
    await dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, { message, details });
  } catch (err) {
    log.error('dispatchSystemErrorEvent: failed to dispatch', err);
  }
}
