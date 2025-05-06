// src/core/utils/safeEventDispatcher.js
// --- FILE START ---

/**
 * @fileoverview Implements the SafeEventDispatcher utility class.
 */

/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../eventBus.js').EventListener} EventListener */
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
    #ved;

    /**
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * Creates an instance of SafeEventDispatcher.
     *
     * @param {object} dependencies - The required dependencies.
     * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - The underlying VED to use.
     * @param {ILogger} dependencies.logger - The logger instance for reporting errors.
     * @throws {Error} If required dependencies or their methods are missing.
     */
    constructor({ validatedEventDispatcher, logger }) {
        super();

        if (!logger || typeof logger.error !== 'function' || typeof logger.debug !== 'function' || typeof logger.info !== 'function') {
            throw new Error('SafeEventDispatcher: Invalid or missing logger dependency (requires error, debug, info methods).');
        }
        this.#logger = logger;

        if (!validatedEventDispatcher ||
            typeof validatedEventDispatcher.dispatchValidated !== 'function' ||
            typeof validatedEventDispatcher.subscribe !== 'function' ||
            typeof validatedEventDispatcher.unsubscribe !== 'function') {
            const errMsg = 'SafeEventDispatcher Constructor: Invalid or missing validatedEventDispatcher dependency (requires dispatchValidated, subscribe, and unsubscribe methods).';
            this.#logger.error(errMsg);
            throw new Error(errMsg);
        }

        this.#ved = validatedEventDispatcher;
        this.#logger.info('SafeEventDispatcher: Instance created successfully.');
    }

    /**
     * Safely dispatches an event using the underlying IValidatedEventDispatcher.
     * Logs errors internally if the dispatch fails (returns false or throws) but
     * guarantees this method itself will not throw an exception.
     *
     * @async
     * @param {string} eventName - The unique identifier of the event to dispatch.
     * @param {object} payload - The data associated with the event.
     * @returns {Promise<boolean>} A promise resolving to `true` if the event was
     * successfully dispatched by the underlying dispatcher, and `false` otherwise
     * (due to validation failure, dispatch error, or exception).
     */
    async dispatchSafely(eventName, payload) {
        try {
            const dispatchResult = await this.#ved.dispatchValidated(eventName, payload);

            if (dispatchResult === true) {
                this.#logger.debug(`SafeEventDispatcher: Successfully dispatched event '${eventName}'.`);
                return true;
            } else {
                this.#logger.error(`SafeEventDispatcher: Underlying VED failed to dispatch event '${eventName}' (returned false). Payload: ${JSON.stringify(payload)}`);
                return false;
            }
        } catch (error) {
            this.#logger.error(`SafeEventDispatcher: Exception caught while dispatching event '${eventName}'. Error: ${error.message}`, { payload, error });
            return false;
        }
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
        try {
            const unsubscribeFn = this.#ved.subscribe(eventName, listener);
            if (typeof unsubscribeFn === 'function') {
                this.#logger.debug(`SafeEventDispatcher: Successfully subscribed to event '${eventName}'.`);
                return unsubscribeFn;
            } else {
                this.#logger.error(`SafeEventDispatcher: Underlying VED.subscribe for '${eventName}' did not return a valid unsubscribe function.`);
                return null;
            }
        } catch (error) {
            this.#logger.error(`SafeEventDispatcher: Exception caught while subscribing to event '${eventName}'. Error: ${error.message}`, { error });
            return null;
        }
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
        try {
            this.#ved.unsubscribe(eventName, listener);
            this.#logger.debug(`SafeEventDispatcher: Successfully unsubscribed from event '${eventName}' (direct call).`);
        } catch (error) {
            this.#logger.error(`SafeEventDispatcher: Exception caught while unsubscribing (direct call) from event '${eventName}'. Error: ${error.message}`, { error });
        }
    }
}

// --- FILE END ---