import { safeDispatchError } from './safeDispatchErrorUtils.js';
import { ensureValidLogger } from './loggerUtils.js';

/**
 * @description Dispatches a system error event using the provided dispatcher.
 * Any failures during dispatch are logged but not rethrown.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher - Event dispatcher.
 * @param {string} message - Human readable error message.
 * @param {object} [details={}] - Additional diagnostic info.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger.
 * @returns {Promise<void>} Resolved when dispatch attempt completes.
 */
export async function dispatchSystemErrorEvent(
  dispatcher,
  message,
  details = {},
  logger
) {
  try {
    safeDispatchError(dispatcher, message, details, logger);
  } catch (err) {
    const log = ensureValidLogger(logger, 'dispatchSystemErrorEvent');
    log.error('Failed to dispatch system error event:', err);
  }
}
