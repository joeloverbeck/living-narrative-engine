// src/core/utils/safeEventDispatcher.js
// --- FILE START ---

/**
 * @fileoverview Implements the SafeEventDispatcher utility class.
 */

/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { ISafeEventDispatcher } from '../interfaces/ISafeEventDispatcher.js';

/**
 * @class SafeEventDispatcher
 * @implements {ISafeEventDispatcher}
 * @description A utility class that wraps an IValidatedEventDispatcher to provide
 * safe, non-throwing event dispatching. It logs failures encountered during
 * dispatch but ensures the calling code doesn't need to handle exceptions from
 * the dispatch process itself.
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
     * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - The underlying VED to use for dispatching.
     * @param {ILogger} dependencies.logger - The logger instance for reporting errors.
     * @throws {Error} If required dependencies or their methods are missing.
     */
    constructor({ validatedEventDispatcher, logger }) {
        super();

        // Validate Logger first
        if (!logger || typeof logger.error !== 'function') {
            throw new Error('SafeEventDispatcher: Invalid or missing logger dependency (requires error method).');
        }
        this.#logger = logger; // Assign logger early for potential use in other validation errors

        // Validate VED
        if (!validatedEventDispatcher || typeof validatedEventDispatcher.dispatchValidated !== 'function') {
            this.#logger.error('SafeEventDispatcher Constructor: Invalid or missing validatedEventDispatcher dependency (requires dispatchValidated method).');
            throw new Error('SafeEventDispatcher: Invalid or missing validatedEventDispatcher dependency.');
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
                // AC1: Successfully dispatched
                this.#logger.debug(`SafeEventDispatcher: Successfully dispatched event '${eventName}'.`);
                return true;
            } else {
                // AC2: VED returned false (validation/dispatch failure)
                this.#logger.error(`SafeEventDispatcher: Underlying VED failed to dispatch event '${eventName}' (returned false). Payload: ${JSON.stringify(payload)}`);
                return false;
            }
        } catch (error) {
            // AC3: VED threw an exception
            this.#logger.error(`SafeEventDispatcher: Exception caught while dispatching event '${eventName}'. Error: ${error.message}`, { payload, error });
            // Consider logging error.stack if available and needed for debugging
            // this.#logger.error(`Stack trace: ${error.stack}`);
            return false;
        }
    }
}

// Optional: Export default if that's the project convention
// export default SafeEventDispatcher;

// --- FILE END ---