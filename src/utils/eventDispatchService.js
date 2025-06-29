/**
 * @file Service providing event dispatch helper methods.
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
import { safeDispatchError } from './safeDispatchErrorUtils.js';
import { createErrorDetails } from './errorDetails.js';

/**
 * Service encapsulating event dispatch helpers used throughout the engine.
 */
export class EventDispatchService {
  /**
   * Dispatches an event and logs the outcome.
   *
   * @description Calls `.dispatch()` on the provided dispatcher and logs a
   * debug message on success or an error message on failure. The promise resolves
   * either way and errors are not re-thrown.
   * @param {IValidatedEventDispatcher|ISafeEventDispatcher} dispatcher - Dispatcher used to emit the event.
   * @param {string} eventName - Event name to dispatch.
   * @param {object} payload - Event payload.
   * @param {ILogger} [logger] - Logger for debug/error output.
   * @param {string} [identifierForLog] - Optional identifier appended to log messages.
   * @param {object} [options] - Options forwarded to the dispatch call.
   * @returns {Promise<void>} Resolves when dispatch completes.
   */
  async dispatchWithLogging(
    dispatcher,
    eventName,
    payload,
    logger,
    identifierForLog = '',
    options = {}
  ) {
    const log = ensureValidLogger(logger, 'dispatchWithLogging');
    const context = identifierForLog ? ` for ${identifierForLog}` : '';

    return dispatcher
      .dispatch(eventName, payload, options)
      .then(() => {
        log.debug(`Dispatched '${eventName}'${context}.`);
      })
      .catch((e) => {
        log.error(`Failed dispatching '${eventName}' event${context}.`, e);
      });
  }

  /**
   * Dispatches an event using the provided dispatcher and logs the outcome.
   *
   * @description Mimics the error handling behavior originally embedded in
   * CommandProcessor. On success a debug message is logged. When the dispatcher
   * returns `false`, a warning is logged. On exception a system error event is
   * dispatched and the function returns `false`.
   * @param {ISafeEventDispatcher} dispatcher - Dispatcher used to emit the event.
   * @param {string} eventName - Name of the event to dispatch.
   * @param {object} payload - Payload for the event.
   * @param {ILogger} [logger] - Logger for debug/error output.
   * @param {string} context - Contextual identifier used in log messages.
   * @returns {Promise<boolean>} `true` if the dispatcher reported success, `false` otherwise.
   */
  async dispatchWithErrorHandling(
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

  /**
   * Safely dispatches an event using the provided dispatcher.
   *
   * @param {ISafeEventDispatcher|null|undefined} dispatcher - Dispatcher used to emit the event.
   * @param {string} eventId - Identifier of the event to dispatch.
   * @param {object} payload - Payload for the event.
   * @param {ILogger} [logger] - Logger for debug and error output.
   * @returns {Promise<void>} Resolves when the dispatch attempt completes.
   */
  async safeDispatchEvent(dispatcher, eventId, payload, logger) {
    const log = ensureValidLogger(logger, 'safeDispatchEvent');

    if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
      log.warn(`SafeEventDispatcher unavailable for ${eventId}`);
      return;
    }

    try {
      await dispatcher.dispatch(eventId, payload);
      log.debug(`Dispatched ${eventId}`, { payload });
    } catch (error) {
      log.error(`Failed to dispatch ${eventId}`, error);
    }
  }
}

/**
 * Shared instance used by modules that do not leverage DI.
 *
 * @type {EventDispatchService}
 */
export const eventDispatchService = new EventDispatchService();

export default eventDispatchService;
