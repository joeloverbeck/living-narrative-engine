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
      typeof logger.debug !== 'function'
    ) {
      throw new Error(
        'SafeEventDispatcher: Invalid or missing logger dependency (requires error, debug, info methods).'
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
  #executeSafely(description, fn, context = {}) {
    try {
      const result = fn();
      if (result && typeof result.then === 'function') {
        return result.catch((error) => {
          this.#logger.error(
            `SafeEventDispatcher: Exception caught while ${description}. Error: ${error.message}`,
            { ...context, error }
          );
          return undefined;
        });
      }
      return result;
    } catch (error) {
      this.#logger.error(
        `SafeEventDispatcher: Exception caught while ${description}. Error: ${error.message}`,
        { ...context, error }
      );
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
      this.#logger.warn(
        `SafeEventDispatcher: Underlying VED failed to dispatch event '${eventName}' (returned false). See VED logs for details. Payload: ${JSON.stringify(
          payload
        )}`
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
}

// --- FILE END ---
