/**
 * @file Consolidated service for event dispatching with various logging and error handling strategies.
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

import { createErrorDetails } from './errorDetails.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';
import { ensureValidLogger } from './loggerUtils.js';

/**
 * Error thrown when EventDispatchService receives an invalid dispatcher.
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
 * Consolidated service for event dispatching with various logging and error handling strategies.
 */
export class EventDispatchService {
  /** @type {ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {ILogger} */
  #logger;

  /**
   * Creates an instance of EventDispatchService.
   *
   * @param {object} dependencies - The required dependencies.
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher - The safe event dispatcher.
   * @param {ILogger} dependencies.logger - The logger instance.
   * @throws {Error} If required dependencies are missing.
   */
  constructor({ safeEventDispatcher, logger }) {
    if (!safeEventDispatcher) {
      throw new Error('EventDispatchService: safeEventDispatcher is required');
    }
    if (!logger) {
      throw new Error('EventDispatchService: logger is required');
    }
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#logger = logger;
  }

  /**
   * Dispatches an event and logs the outcome.
   *
   * @description
   * Calls `.dispatch()` on the provided dispatcher and logs a debug message on
   * success or an error message on failure. The promise resolves either way and
   * errors are not re-thrown.
   * @param {string} eventName - Event name to dispatch.
   * @param {object} payload - Event payload.
   * @param {string} [identifierForLog] - Optional identifier appended to log messages.
   * @param {object} [options] - Options forwarded to the dispatch call.
   * @returns {Promise<void>} Resolves when dispatch completes.
   */
  async dispatchWithLogging(
    eventName,
    payload,
    identifierForLog = '',
    options = {}
  ) {
    const context = identifierForLog ? ` for ${identifierForLog}` : '';

    return this.#safeEventDispatcher
      .dispatch(eventName, payload, options)
      .then(() => {
        this.#logger.debug(`Dispatched '${eventName}'${context}.`);
      })
      .catch((e) => {
        this.#logger.error(
          `Failed dispatching '${eventName}' event${context}.`,
          e
        );
      });
  }

  /**
   * Dispatches an event using the provided dispatcher and logs the outcome.
   *
   * @description
   * Mimics the error handling behavior originally embedded in CommandProcessor.
   * On success, a debug message is logged. When the dispatcher returns `false`, a
   * warning is logged. On exception, a system error event is dispatched and the
   * function returns `false`.
   * @param {string} eventName - Name of the event to dispatch.
   * @param {object} payload - Payload for the event.
   * @param {string} context - Contextual identifier used in log messages.
   * @returns {Promise<boolean>} `true` if the dispatcher reported success, `false` otherwise.
   */
  async dispatchWithErrorHandling(eventName, payload, context) {
    this.#logger.debug(
      `dispatchWithErrorHandling: Attempting dispatch: ${context} ('${eventName}')`
    );
    try {
      const success = await this.#safeEventDispatcher.dispatch(
        eventName,
        payload
      );
      if (success) {
        this.#logger.debug(
          `dispatchWithErrorHandling: Dispatch successful for ${context}.`
        );
      } else {
        this.#logger.warn(
          `dispatchWithErrorHandling: SafeEventDispatcher reported failure for ${context} (likely VED validation failure). Payload: ${JSON.stringify(
            payload
          )}`
        );
      }
      return success;
    } catch (error) {
      this.#logger.error(
        `dispatchWithErrorHandling: CRITICAL - Error during dispatch for ${context}. Error: ${error.message}`,
        error
      );
      this.dispatchSystemError(
        'System error during event dispatch.',
        createErrorDetails(
          `Exception in dispatch for ${eventName}`,
          error?.stack || new Error().stack
        )
      );
      return false;
    }
  }

  /**
   * Safely dispatches an event using the provided dispatcher.
   *
   * @param {string} eventId - Identifier of the event to dispatch.
   * @param {object} payload - Payload for the event.
   * @returns {Promise<void>} Resolves when the dispatch attempt completes.
   */
  async safeDispatchEvent(eventId, payload) {
    if (
      !this.#safeEventDispatcher ||
      typeof this.#safeEventDispatcher.dispatch !== 'function'
    ) {
      this.#logger.warn(`SafeEventDispatcher unavailable for ${eventId}`);
      return;
    }

    try {
      await this.#safeEventDispatcher.dispatch(eventId, payload);
      this.#logger.debug(`Dispatched ${eventId}`, { payload });
    } catch (error) {
      this.#logger.error(`Failed to dispatch ${eventId}`, error);
    }
  }

  /**
   * Dispatches a system error event with consistent payload structure.
   * Supports both synchronous and asynchronous dispatching.
   *
   * @param {string} message - Human readable error message.
   * @param {object} [details] - Additional structured details for debugging.
   * @param {object} [options] - Options for dispatching.
   * @param {boolean} [options.async] - Whether to dispatch asynchronously.
   * @param {boolean} [options.throwOnInvalidDispatcher] - Whether to throw if dispatcher is invalid.
   * @returns {void|Promise<void>} Returns void for sync, Promise<void> for async.
   * @throws {InvalidDispatcherError} If the dispatcher is missing or invalid and throwOnInvalidDispatcher is true.
   */
  dispatchSystemError(message, details = {}, options = {}) {
    const { async = false, throwOnInvalidDispatcher = false } = options;

    const hasDispatch =
      this.#safeEventDispatcher &&
      typeof this.#safeEventDispatcher.dispatch === 'function';
    if (!hasDispatch) {
      const errorMsg =
        "Invalid or missing method 'dispatch' on dependency 'EventDispatchService: safeEventDispatcher'.";
      this.#logger.error(errorMsg);
      if (throwOnInvalidDispatcher) {
        throw new InvalidDispatcherError(errorMsg, {
          functionName: 'dispatchSystemError',
        });
      }
      return;
    }

    const payload = { message, details };

    if (async) {
      try {
        const result = this.#safeEventDispatcher.dispatch(
          SYSTEM_ERROR_OCCURRED_ID,
          payload
        );
        // Handle both Promise and non-Promise returns defensively
        if (result && typeof result.catch === 'function') {
          return result.catch((error) => {
            // If we can't dispatch the error event, at least log it
            this.#logger.error(
              `Failed to dispatch system error event: ${message}`,
              {
                originalDetails: details,
                dispatchError: error,
              }
            );
          });
        }
        // If not a Promise, wrap in resolved Promise for consistency
        return Promise.resolve();
      } catch (error) {
        // Handle synchronous errors
        this.#logger.error(
          `Failed to dispatch system error event: ${message}`,
          {
            originalDetails: details,
            dispatchError: error,
          }
        );
        return Promise.resolve();
      }
    } else {
      try {
        this.#safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, payload);
      } catch (error) {
        this.#logger.error(
          `Failed to dispatch system error event: ${message}`,
          {
            originalDetails: details,
            dispatchError: error,
          }
        );
      }
    }
  }

  /**
   * Dispatches a validation error and returns a standardized result object.
   *
   * @param {string} message - Human readable error message.
   * @param {object} [details] - Additional structured details for debugging.
   * @returns {{ ok: false, error: string, details?: object }} Result object for validation failures.
   */
  dispatchValidationError(message, details) {
    this.dispatchSystemError(message, details, {
      throwOnInvalidDispatcher: true,
    });
    return details !== undefined
      ? { ok: false, error: message, details }
      : { ok: false, error: message };
  }
}
