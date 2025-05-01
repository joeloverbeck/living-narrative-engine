/**
 * @interface IValidatedEventDispatcher
 * @description Defines the contract for dispatching game events, potentially after
 * validating their payload against a schema definition. Acts as a layer over the
 * base EventBus.
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
}

// --- Boilerplate to ensure this file is treated as a module ---
export {};
