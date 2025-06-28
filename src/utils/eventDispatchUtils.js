/**
 * @file Utility for dispatching events with standardized success/error logging.
 */

/**
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 */
/**
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */
/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

import { ensureValidLogger } from './loggerUtils.js';

/**
 * Error thrown when `dispatchWithLogging` receives an invalid dispatcher.
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
 * Dispatches an event and logs the outcome.
 *
 * @description
 * Calls `.dispatch()` on the provided dispatcher and logs a debug message on
 * success or an error message on failure. The promise resolves either way and
 * errors are not re-thrown.
 * @param {IValidatedEventDispatcher|ISafeEventDispatcher} dispatcher - Dispatcher used to emit the event.
 * @param {string} eventName - Event name to dispatch.
 * @param root0
 * @param root0.throwOnInvalidDispatcher
 * @param options.throwOnInvalidDispatcher
 * @param {object} payload - Event payload.
 * @param {ILogger} [logger] - Logger for debug/error output.
 * @param {string} [identifierForLog] - Optional identifier appended to log messages.
 * @param {object} [options] - Options forwarded to the dispatch call.
 * @returns {Promise<void>} Resolves when dispatch completes.
 */
export async function dispatchWithLogging(
  dispatcher,
  eventName,
  payload,
  logger,
  identifierForLog = '',
  options = {},
  { throwOnInvalidDispatcher = false } = {}
) {
  const log = ensureValidLogger(logger, 'dispatchWithLogging');
  const context = identifierForLog ? ` for ${identifierForLog}` : '';

  const hasDispatch = dispatcher && typeof dispatcher.dispatch === 'function';
  if (!hasDispatch) {
    const errorMsg =
      "Invalid or missing method 'dispatch' on dependency 'dispatchWithLogging: dispatcher'.";
    log.error(errorMsg);
    if (throwOnInvalidDispatcher) {
      throw new InvalidDispatcherError(errorMsg, {
        functionName: 'dispatchWithLogging',
      });
    }
    return;
  }

  try {
    if (options && Object.keys(options).length > 0) {
      await dispatcher.dispatch(eventName, payload, options);
    } else {
      await dispatcher.dispatch(eventName, payload);
    }
    log.debug(`Dispatched '${eventName}'${context}.`);
  } catch (e) {
    log.error(`Failed dispatching '${eventName}' event${context}.`, e);
  }
}

// --- FILE END ---
