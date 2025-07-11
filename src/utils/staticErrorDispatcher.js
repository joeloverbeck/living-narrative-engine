/**
 * @file Static error dispatcher for backward compatibility during consolidation.
 * This provides a transition path from safeDispatchError to EventDispatchService.
 */

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import {
  EventDispatchService,
  InvalidDispatcherError,
} from './eventDispatchService.js';
import { ensureValidLogger } from './loggerUtils.js';

/**
 * Static error dispatcher that provides the same API as safeDispatchError
 * but uses EventDispatchService internally.
 */
export class StaticErrorDispatcher {
  /**
   * Dispatches a system error event with the same signature as safeDispatchError.
   *
   * @param {ISafeEventDispatcher|IValidatedEventDispatcher} dispatcher - Dispatcher used to emit the event.
   * @param {string} message - Human readable error message.
   * @param {object} [details] - Additional structured details for debugging.
   * @param {ILogger} [logger] - Optional logger for error logging.
   * @throws {InvalidDispatcherError} If the dispatcher is missing or invalid.
   * @returns {void}
   */
  static dispatchError(dispatcher, message, details = {}, logger) {
    const log = ensureValidLogger(
      logger,
      'StaticErrorDispatcher.dispatchError'
    );

    // Create a temporary EventDispatchService instance
    const eventDispatchService = new EventDispatchService({
      safeEventDispatcher: dispatcher,
      logger: log,
    });

    // Use the new consolidated method
    eventDispatchService.dispatchSystemError(message, details, {
      throwOnInvalidDispatcher: true,
    });
  }

  /**
   * Dispatches a system error event asynchronously.
   *
   * @param {ISafeEventDispatcher|IValidatedEventDispatcher} dispatcher - The event dispatcher to use.
   * @param {string} message - The error message.
   * @param {object} details - Additional error details.
   * @param {ILogger} logger - Logger instance for error logging.
   * @returns {Promise<void>}
   */
  static async dispatchErrorAsync(dispatcher, message, details, logger) {
    const log = ensureValidLogger(
      logger,
      'StaticErrorDispatcher.dispatchErrorAsync'
    );

    // Create a temporary EventDispatchService instance
    const eventDispatchService = new EventDispatchService({
      safeEventDispatcher: dispatcher,
      logger: log,
    });

    // Use the new consolidated method with async option
    return eventDispatchService.dispatchSystemError(message, details, {
      async: true,
      throwOnInvalidDispatcher: false,
    });
  }

  /**
   * Dispatches a validation error and returns a standardized result object.
   *
   * @param {ISafeEventDispatcher|IValidatedEventDispatcher} dispatcher - Dispatcher used to emit the event.
   * @param {string} message - Human readable error message.
   * @param {object} [details] - Additional structured details for debugging.
   * @param {ILogger} [logger] - Optional logger for error logging.
   * @returns {{ ok: false, error: string, details?: object }} Result object for validation failures.
   */
  static dispatchValidationError(dispatcher, message, details, logger) {
    const log = ensureValidLogger(
      logger,
      'StaticErrorDispatcher.dispatchValidationError'
    );

    // Create a temporary EventDispatchService instance
    const eventDispatchService = new EventDispatchService({
      safeEventDispatcher: dispatcher,
      logger: log,
    });

    // Use the new consolidated method
    return eventDispatchService.dispatchValidationError(message, details);
  }
}

// Backward compatibility functions that can be drop-in replacements

/**
 * Drop-in replacement for safeDispatchError function.
 *
 * @param dispatcher
 * @param message
 * @param details
 * @param logger
 * @deprecated Use EventDispatchService.dispatchSystemError() or StaticErrorDispatcher.dispatchError()
 */
export function safeDispatchError(dispatcher, message, details = {}, logger) {
  return StaticErrorDispatcher.dispatchError(
    dispatcher,
    message,
    details,
    logger
  );
}

/**
 * Drop-in replacement for dispatchSystemErrorEvent function.
 *
 * @param dispatcher
 * @param message
 * @param details
 * @param logger
 * @deprecated Use EventDispatchService.dispatchSystemError() or StaticErrorDispatcher.dispatchErrorAsync()
 */
export async function dispatchSystemErrorEvent(
  dispatcher,
  message,
  details,
  logger
) {
  return StaticErrorDispatcher.dispatchErrorAsync(
    dispatcher,
    message,
    details,
    logger
  );
}

/**
 * Drop-in replacement for dispatchValidationError function.
 *
 * @param dispatcher
 * @param message
 * @param details
 * @param logger
 * @deprecated Use EventDispatchService.dispatchValidationError() or StaticErrorDispatcher.dispatchValidationError()
 */
export function dispatchValidationError(dispatcher, message, details, logger) {
  return StaticErrorDispatcher.dispatchValidationError(
    dispatcher,
    message,
    details,
    logger
  );
}
