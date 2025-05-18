// src/core/interfaces/IValidatedEventDispatcher.js

/** @typedef {import('../eventBus.js').EventListener} EventListener */
/** @typedef {() => void} UnsubscribeFn */ // Assuming UnsubscribeFn is a function that takes no args and returns void. Adjust if defined elsewhere differently.

/**
 * @interface IValidatedEventDispatcher
 * @description Defines the contract for dispatching, subscribing, and unsubscribing
 * to game events. Implementations typically validate dispatched events against
 * schemas and delegate all operations to an underlying EventBus.
 */
export class IValidatedEventDispatcher {
    /**
     * Dispatches an event with the given name and payload.
     * Implementations should ideally validate the payload against a schema associated
     * with the eventName before dispatching via the underlying EventBus.
     * @function dispatchValidated
     * @param {string} eventName - The unique identifier of the event to dispatch (e.g., 'entity:moved').
     * @param {object} payload - The data associated with the event.
     * @param {object} [options] - Optional settings for validation/dispatch behavior (e.g., skipping validation if schema not found).
     * @returns {Promise<boolean>} A promise resolving to `true` if the event was successfully dispatched
     * (passed validation or validation was skipped), `false` otherwise (validation failed, dispatch error).
     * @throws {Error} Implementations might throw errors for critical failures during the dispatch process.
     */
    async dispatchValidated(eventName, payload, options) {
        throw new Error('IValidatedEventDispatcher.dispatchValidated method not implemented.');
    }

    /**
     * Subscribes a listener function to a specific event name.
     * Implementations should delegate this call to the underlying EventBus.
     * @function subscribe
     * @param {string} eventName - The name of the event to subscribe to.
     * @param {EventListener} listener - The function to call when the event is dispatched.
     * @returns {UnsubscribeFn} A function that, when called, unregisters the provided listener.
     */
    subscribe(eventName, listener) {
        throw new Error('IValidatedEventDispatcher.subscribe method not implemented.');
    }

    /**
     * Unsubscribes a listener function from a specific event name.
     * Implementations should delegate this call to the underlying EventBus.
     * @function unsubscribe
     * @param {string} eventName - The name of the event to unsubscribe from.
     * @param {EventListener} listener - The listener function to remove.
     * @returns {void}
     */
    unsubscribe(eventName, listener) {
        throw new Error('IValidatedEventDispatcher.unsubscribe method not implemented.');
    }
}

// --- Boilerplate to ensure this file is treated as a module ---
export {};