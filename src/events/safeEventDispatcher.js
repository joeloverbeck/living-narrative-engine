// src/events/safeEventDispatcher.js
// --- FILE START ---

/**
 * @file Implements the SafeEventDispatcher utility class.
 */

/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./eventBus.js').EventListener} EventListener */
/** @typedef {() => void} UnsubscribeFn */

import { ISafeEventDispatcher } from '../interfaces/ISafeEventDispatcher.js';
import { safeStringify } from '../utils/safeStringify.js';

/**
 * @class SafeEventDispatcher
 * @implements {ISafeEventDispatcher}
 * @description A utility class that wraps an IValidatedEventDispatcher to provide
 * safe, non-throwing event dispatching, subscription, and unsubscription.
 * It logs failures encountered during these operations but ensures the calling
 * code doesn't need to handle exceptions from the process itself.
 */
export class SafeEventDispatcher extends ISafeEventDispatcher {
  /**
   * @private
   * @type {IValidatedEventDispatcher}
   */
  #validatedDispatcher;

  /**
   * @private
   * @type {ILogger}
   */
  #logger;

  /**
   * @private
   * @type {boolean}
   */
  #isHandlingError = false; // Track if we're already handling an error

  /**
   * Derives a readable error message from unknown error-like values.
   *
   * @private
   * @param {unknown} error - Error value provided by the dispatcher.
   * @returns {string} Normalized error message.
   */
  #normalizeErrorMessage(error) {
    if (error instanceof Error) {
      return error.message || 'Unknown error.';
    }

    if (typeof error === 'string') {
      const trimmed = error.trim();
      return trimmed || 'Unknown error.';
    }

    if (error && typeof error === 'object' && 'message' in error) {
      const messageValue = /** @type {{ message?: unknown }} */ (error).message;
      if (typeof messageValue === 'string') {
        const trimmedMessage = messageValue.trim();
        if (trimmedMessage) {
          return trimmedMessage;
        }
      }
    }

    if (error === null || error === undefined) {
      return 'Unknown error.';
    }

    try {
      const asString = String(error);
      return asString && asString !== '[object Object]'
        ? asString
        : 'Unknown error.';
    } catch {
      return 'Unknown error.';
    }
  }

  /**
   * Creates an instance of SafeEventDispatcher.
   *
   * @param {object} dependencies - The required dependencies.
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - The underlying validated dispatcher to use.
   * @param {ILogger} dependencies.logger - The logger instance for reporting errors.
   * @throws {Error} If required dependencies or their methods are missing.
   */
  constructor({ validatedEventDispatcher, logger }) {
    super();

    if (
      !logger ||
      typeof logger.error !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.debug !== 'function'
    ) {
      throw new Error(
        'SafeEventDispatcher: Invalid or missing logger dependency (requires error, warn, debug methods).'
      );
    }
    this.#logger = logger;

    if (
      !validatedEventDispatcher ||
      typeof validatedEventDispatcher.dispatch !== 'function' ||
      typeof validatedEventDispatcher.subscribe !== 'function' ||
      typeof validatedEventDispatcher.unsubscribe !== 'function'
    ) {
      const errMsg =
        'SafeEventDispatcher Constructor: Invalid or missing validatedEventDispatcher dependency (requires dispatch, subscribe, and unsubscribe methods).';
      this.#logger.error(errMsg);
      throw new Error(errMsg);
    }

    this.#validatedDispatcher = validatedEventDispatcher;
    this.#logger.debug('SafeEventDispatcher: Instance created successfully.');
  }

  /**
   * Executes the provided function while capturing and logging any thrown
   * errors using a consistent format.
   *
   * @private
   * @param {string} description - Description of the operation being executed.
   * @param {Function} fn - The function to execute. May return a promise.
   * @param {object} [context] - Additional context to include in error logs.
   * @returns {Promise<*>} The return value of `fn`, or `undefined` if an error
   * occurs.
   */
  /**
   * Executes the provided function while capturing and logging any thrown
   * errors using a consistent format.
   *
   * @private
   * @param {string} description - Description of the operation being executed.
   * @param {Function} fn - The function to execute. May return a promise.
   * @param {object} [context] - Additional context to include in error logs.
   * @returns {Promise<*>} The return value of `fn`, or `undefined` if an error
   * occurs.
  */
  #executeSafely(description, fn, context = {}) {
    try {
      const result = fn();
      if (result && typeof result.then === 'function') {
        return result.catch((error) => {
          const errorMessage = this.#normalizeErrorMessage(error);
          // Enhanced recursion detection
          const isErrorEvent =
            description.includes('system_error_occurred') ||
            description.includes('error');
          const hasErrorKeywords = description.match(/(error|exception|fail)/i);

          const logMessage =
            `SafeEventDispatcher: Exception caught while ${description}. Error: ${errorMessage}`;
          const logContext = { ...context, error };

          if (isErrorEvent || hasErrorKeywords || this.#isHandlingError) {
            // Use console directly to avoid potential recursion
            console.error(logMessage, logContext);
          } else {
            this.#isHandlingError = true;
            try {
              // Use try-catch around logger to prevent any logger-triggered events
              this.#logger.error(logMessage, logContext);
            } catch (loggerError) {
              // Logger failed - use console as ultimate fallback
              console.error(
                `SafeEventDispatcher: Logger failed while handling error in ${description}. Original message: ${errorMessage}`,
                error,
                'Logger error:',
                loggerError
              );
            } finally {
              this.#isHandlingError = false;
            }
          }
          return undefined;
        });
      }
      return result;
    } catch (error) {
      const errorMessage = this.#normalizeErrorMessage(error);
      // Enhanced recursion detection for synchronous errors
      const isErrorEvent =
        description.includes('system_error_occurred') ||
        description.includes('error');
      const hasErrorKeywords = description.match(/(error|exception|fail)/i);

      const logMessage =
        `SafeEventDispatcher: Exception caught while ${description}. Error: ${errorMessage}`;
      const logContext = { ...context, error };

      if (isErrorEvent || hasErrorKeywords || this.#isHandlingError) {
        // Use console directly to avoid potential recursion
        console.error(logMessage, logContext);
      } else {
        this.#isHandlingError = true;
        try {
          // Use try-catch around logger to prevent any logger-triggered events
          this.#logger.error(logMessage, logContext);
        } catch (loggerError) {
          // Logger failed - use console as ultimate fallback
          console.error(
            `SafeEventDispatcher: Logger failed while handling error in ${description}. Original message: ${errorMessage}`,
            error,
            'Logger error:',
            loggerError
          );
        } finally {
          this.#isHandlingError = false;
        }
      }
      return undefined;
    }
  }

  /**
   * Safely dispatches an event using the underlying IValidatedEventDispatcher.
   * Logs errors internally if the dispatch fails (returns false or throws) but
   * guarantees this method itself will not throw an exception.
   *
   * @async
   * @param {string} eventName - The unique identifier of the event to dispatch.
   * @param {object} payload - The data associated with the event.
   * @param {object} [options] - Optional settings to pass to the underlying validated dispatcher.
   * @returns {Promise<boolean>} A promise resolving to `true` if the event was
   * successfully dispatched by the underlying dispatcher, and `false` otherwise
   * (due to validation failure, dispatch error, or exception).
   */
  async dispatch(eventName, payload, options = {}) {
    const dispatchResult = await this.#executeSafely(
      `dispatching event '${eventName}'`,
      () => this.#validatedDispatcher.dispatch(eventName, payload, options),
      { payload, options }
    );

    if (dispatchResult === true) {
      this.#logger.debug(
        `SafeEventDispatcher: Successfully dispatched event '${eventName}'.`
      );
      return true;
    }

    if (dispatchResult === false) {
      let payloadSummary;

      try {
        payloadSummary = safeStringify(payload);
      } catch (error) {
        this.#logger.debug(
          'SafeEventDispatcher: Failed to stringify payload after VED returned false.',
          { error }
        );
        payloadSummary = '[Unserializable payload]';
      }

      this.#logger.warn(
        `SafeEventDispatcher: Underlying VED failed to dispatch event '${eventName}' (returned false). See VED logs for details. Payload: ${payloadSummary}`
      );
    }

    return false;
  }

  /**
   * Safely subscribes a listener to an event.
   * Wraps the underlying IValidatedEventDispatcher's subscribe method.
   * Logs errors internally if subscription fails but guarantees this method
   * itself will not throw an exception if the underlying subscribe call throws.
   *
   * @param {string} eventName - The name of the event to subscribe to.
   * @param {EventListener} listener - The function to call when the event is dispatched.
   * @returns {UnsubscribeFn | null} An unsubscribe function if successful, or null on failure.
   */
  subscribe(eventName, listener) {
    const unsubscribeFn = this.#executeSafely(
      `subscribing to event '${eventName}'`,
      () => this.#validatedDispatcher.subscribe(eventName, listener)
    );

    if (typeof unsubscribeFn === 'function') {
      this.#logger.debug(
        `SafeEventDispatcher: Successfully subscribed to event '${eventName}'.`
      );
      return unsubscribeFn;
    }

    if (unsubscribeFn === undefined || unsubscribeFn === null) {
      return null;
    }

    this.#logger.error(
      `SafeEventDispatcher: Underlying VED.subscribe for '${eventName}' did not return a valid unsubscribe function.`
    );
    return null;
  }

  /**
   * Safely unsubscribes a listener from an event using VED's direct unsubscribe.
   * Wraps the underlying IValidatedEventDispatcher's unsubscribe method.
   * Logs errors internally if unsubscription fails. Does not throw.
   * Note: This direct unsubscribe is less common if using the UnsubscribeFn returned by `subscribe`.
   *
   * @param {string} eventName - The name of the event to unsubscribe from.
   * @param {EventListener} listener - The listener function to remove.
   * @returns {void}
   */
  unsubscribe(eventName, listener) {
    const result = this.#executeSafely(
      `unsubscribing (direct call) from event '${eventName}'`,
      () => this.#validatedDispatcher.unsubscribe(eventName, listener)
    );

    if (result === undefined) {
      return;
    }

    if (result) {
      this.#logger.debug(
        `SafeEventDispatcher: Successfully unsubscribed from event '${eventName}' (direct call).`
      );
    }
  }

  /**
   * Safely sets batch mode on the underlying ValidatedEventDispatcher.
   * This is primarily used to control event processing behavior during bulk operations.
   * Logs errors internally if batch mode setting fails. Does not throw.
   *
   * @param {boolean} enabled - Whether to enable or disable batch mode
   * @param {object} [options] - Batch mode configuration options
   * @param {number} [options.maxRecursionDepth] - Maximum recursion depth in batch mode
   * @param {number} [options.maxGlobalRecursion] - Maximum global recursion in batch mode
   * @param {number} [options.timeoutMs] - Auto-disable timeout in milliseconds
   * @param {string} [options.context] - Context description for logging
   * @returns {void}
   */
  setBatchMode(enabled, options = {}) {
    this.#executeSafely(
      `setting batch mode to ${enabled} with context: ${options.context || 'unknown'}`,
      () => this.#validatedDispatcher.setBatchMode(enabled, options)
    );

    this.#logger.debug(
      `SafeEventDispatcher: Delegated setBatchMode(${enabled}) to ValidatedEventDispatcher with context: ${options.context || 'unknown'}`
    );
  }
}

// --- FILE END ---
