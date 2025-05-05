// src/core/adapters/EventBusTurnEndAdapter.js
// --- FILE START ---

import { ITurnEndPort } from '../ports/ITurnEndPort.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */

/**
 * @class EventBusTurnEndAdapter
 * @implements {ITurnEndPort}
 * @description Implements the ITurnEndPort by dispatching a 'core:turn_ended'
 * event via a Safe Event Dispatcher (preferred) or a Validated Event Dispatcher.
 */
export class EventBusTurnEndAdapter extends ITurnEndPort {
    /**
     * @private
     * @type {ISafeEventDispatcher | IValidatedEventDispatcher}
     */
    #dispatcher;

    /**
     * @private
     * @type {boolean} - Flag indicating if the injected dispatcher is safe.
     */
    #isSafeDispatcher;

    /**
     * Creates an instance of EventBusTurnEndAdapter.
     * Prefers ISafeEventDispatcher if available.
     * @param {object} dependencies - The dependencies required by the adapter.
     * @param {ISafeEventDispatcher} [dependencies.safeEventDispatcher] - The preferred safe dispatcher.
     * @param {IValidatedEventDispatcher} [dependencies.validatedEventDispatcher] - Fallback VED.
     * @throws {Error} If neither safeEventDispatcher nor validatedEventDispatcher is provided or valid.
     */
    constructor({ safeEventDispatcher, validatedEventDispatcher }) {
        super();
        if (safeEventDispatcher && typeof safeEventDispatcher.dispatchSafely === 'function') {
            this.#dispatcher = safeEventDispatcher;
            this.#isSafeDispatcher = true;
        } else if (validatedEventDispatcher && typeof validatedEventDispatcher.dispatchValidated === 'function') {
            this.#dispatcher = validatedEventDispatcher;
            this.#isSafeDispatcher = false;
            // Optional: Log a warning if falling back to VED
            console.warn("EventBusTurnEndAdapter: ISafeEventDispatcher not provided or invalid, falling back to IValidatedEventDispatcher. Dispatch errors may not be caught gracefully by the adapter.");
        } else {
            throw new Error('EventBusTurnEndAdapter: Requires a valid ISafeEventDispatcher (preferred) or IValidatedEventDispatcher.');
        }
    }

    /**
     * Signals turn end by dispatching the 'core:turn_ended' event.
     *
     * @async
     * @param {string} entityId - The unique ID of the entity whose turn has ended.
     * @returns {Promise<void>} Resolves after the dispatch attempt. Does not typically propagate dispatch success/failure unless VED throws uncaught.
     * @throws {Error} Only if using VED directly and `dispatchValidated` throws an unhandled error.
     */
    async turnEnded(entityId) {
        // Basic validation
        if (typeof entityId !== 'string' || !entityId) {
            console.error("EventBusTurnEndAdapter.turnEnded: Invalid entityId provided.");
            throw new Error("EventBusTurnEndAdapter.turnEnded: entityId must be a non-empty string.");
        }

        const payload = { entityId };

        if (this.#isSafeDispatcher) {
            // Using ISafeEventDispatcher
            await /** @type {ISafeEventDispatcher} */ (this.#dispatcher).dispatchSafely('core:turn_ended', payload);
            // console.debug(`EventBusTurnEndAdapter: Safely dispatched 'core:turn_ended' for ${entityId}.`);
            return Promise.resolve(); // Resolve void after attempt
        } else {
            // Using IValidatedEventDispatcher directly
            try {
                await /** @type {IValidatedEventDispatcher} */ (this.#dispatcher).dispatchValidated('core:turn_ended', payload);
                // console.debug(`EventBusTurnEndAdapter: Dispatched 'core:turn_ended' via VED for ${entityId}.`);
                return Promise.resolve(); // Resolve void after successful dispatch
            } catch (dispatchError) {
                console.error(`EventBusTurnEndAdapter: Error dispatching 'core:turn_ended' via VED: ${dispatchError.message}`, dispatchError);
                throw dispatchError; // Propagate critical VED errors
            }
        }
    }
}

// --- FILE END ---