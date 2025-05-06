// src/core/interfaces/ISafeEventDispatcher.js
// --- FILE START ---

/**
 * @fileoverview Defines the interface for a safe event dispatcher utility.
 */

/** @typedef {import('../eventBus.js').EventListener} EventListener */
/** @typedef {() => void} UnsubscribeFn */ // Consistent UnsubscribeFn definition

/**
 * @interface ISafeEventDispatcher
 * @description Defines the contract for a utility that wraps an IValidatedEventDispatcher
 * to provide safe, non-throwing event dispatching with consistent logging on failure.
 * It also provides safe subscription and unsubscription capabilities.
 */
export class ISafeEventDispatcher {
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
        throw new Error('ISafeEventDispatcher.dispatchSafely method not implemented.');
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
        throw new Error('ISafeEventDispatcher.subscribe method not implemented.');
    }

    /**
     * Safely unsubscribes a listener from an event.
     * Wraps the underlying IValidatedEventDispatcher's unsubscribe method.
     * Logs errors internally if unsubscription fails. Does not throw.
     * Note: This direct unsubscribe is less common if using the UnsubscribeFn returned by `subscribe`.
     *
     * @param {string} eventName - The name of the event to unsubscribe from.
     * @param {EventListener} listener - The listener function to remove.
     * @returns {void}
     */
    unsubscribe(eventName, listener) {
        throw new Error('ISafeEventDispatcher.unsubscribe method not implemented.');
    }
}

// --- FILE END ---