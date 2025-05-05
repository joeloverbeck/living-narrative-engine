// src/core/interfaces/ISafeEventDispatcher.js
// --- FILE START ---

/**
 * @fileoverview Defines the interface for a safe event dispatcher utility.
 */

/**
 * @interface ISafeEventDispatcher
 * @description Defines the contract for a utility that wraps an IValidatedEventDispatcher
 * to provide safe, non-throwing event dispatching with consistent logging on failure.
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
}

// --- FILE END ---