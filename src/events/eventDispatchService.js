/**
 * @file Service for dispatching events with standard logging and error handling.
 */

/**
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

import { ensureValidLogger } from '../utils/loggerUtils.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';

/**
 * Service providing a unified method for event dispatching across the engine.
 * It mirrors the behaviour previously implemented by several helper utilities.
 *
 * @class EventDispatchService
 */
export default class EventDispatchService {
  /**
   * Dispatches an event using the given dispatcher and logs the outcome.
   *
   * @param {IValidatedEventDispatcher|ISafeEventDispatcher} dispatcher - The dispatcher used to emit the event.
   * @param {string} eventName - Name of the event to dispatch.
   * @param {object} payload - Payload for the event.
   * @param {object} [options]
   * @param {ILogger} [options.logger] - Logger for debug/error output.
   * @param {string} [options.context] - Context identifier used in log messages.
   * @param {boolean} [options.rethrow] - Rethrow the caught error instead of swallowing it.
   * @param {object} [options.errorDetails] - Details forwarded to safeDispatchError on exception.
   * @param {object} [options.eventOptions] - Options passed directly to the dispatcher.
   * @returns {Promise<boolean>} `true` when the dispatcher reports success, `false` otherwise.
   */
  async dispatch(
    dispatcher,
    eventName,
    payload,
    {
      logger,
      context = '',
      rethrow = false,
      errorDetails,
      eventOptions = {},
    } = {}
  ) {
    const log = ensureValidLogger(logger, 'EventDispatchService');
    const ctx = context ? ` ${context}` : '';
    log.debug(
      `EventDispatchService: Attempting dispatch:${ctx} ('${eventName}')`
    );
    try {
      const result = await dispatcher.dispatch(
        eventName,
        payload,
        eventOptions
      );
      if (result === false) {
        log.warn(
          `EventDispatchService: Dispatcher reported failure${ctx}. Payload: ${JSON.stringify(
            payload
          )}`
        );
        return false;
      }
      log.debug(`EventDispatchService: Dispatch successful${ctx}.`);
      return result !== false;
    } catch (error) {
      log.error(
        `EventDispatchService: CRITICAL - Error during dispatch${ctx}. Error: ${error.message}`,
        error
      );
      if (errorDetails) {
        safeDispatchError(
          dispatcher,
          'System error during event dispatch.',
          errorDetails,
          log
        );
      }
      if (rethrow) {
        throw error;
      }
      return false;
    }
  }
}

// --- FILE END ---
