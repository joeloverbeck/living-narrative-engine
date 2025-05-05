// src/core/adapters/eventBusTurnEndAdapter.js

import {ITurnEndPort} from '../ports/ITurnEndPort.js';

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeDispatcher */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedDispatcher */

export default class EventBusTurnEndAdapter extends ITurnEndPort {
    /** @type {ISafeDispatcher|IValidatedDispatcher} */ #dispatcher;
    /** @type {boolean} */                               #isSafe;
    /** @type {Console|import('../interfaces/coreServices.js').ILogger} */ #log;

    /**
     * @param {{
     *   safeEventDispatcher?:      ISafeDispatcher,
     *   validatedEventDispatcher?: IValidatedDispatcher,
     *   logger?:                   Console|import('../interfaces/coreServices.js').ILogger
     * }} deps
     */
    constructor({safeEventDispatcher, validatedEventDispatcher, logger = console}) {
        super();

        if (safeEventDispatcher?.dispatchSafely) {
            this.#dispatcher = safeEventDispatcher;
            this.#isSafe = true;
        } else if (validatedEventDispatcher?.dispatchValidated) {
            this.#dispatcher = validatedEventDispatcher;
            this.#isSafe = false;
            // 👇 restore the warning the tests look for
            console.warn(
                'EventBusTurnEndAdapter: ISafeEventDispatcher not provided or invalid, ' +
                'falling back to IValidatedEventDispatcher. Dispatch errors may not be caught gracefully by the adapter.'
            );
        } else {
            throw new Error(
                'EventBusTurnEndAdapter: Requires a valid ISafeEventDispatcher (preferred) or IValidatedEventDispatcher.'
            );
        }

        this.#log = logger;
    }

    /**
     * Canonical method used by PlayerTurnHandler / TurnManager.
     */
    async notifyTurnEnded(entityId, success) {
        if (!entityId || typeof entityId !== 'string') {
            throw new Error('entityId must be a non-empty string');
        }

        const payload = {entityId, success: !!success};

        try {
            if (this.#isSafe) {
                await this.#dispatcher.dispatchSafely('core:turn_ended', payload);
            } else {
                await this.#dispatcher.dispatchValidated('core:turn_ended', payload);
            }
        } catch (err) {
            this.#log.error("Error dispatching 'core:turn_ended' via VED", err);
            throw err;
        }
    }

    /**
     * ⚠️ Legacy shim so the old unit-tests that call `turnEnded()` still pass.
     * Calls `notifyTurnEnded(id, true)` so existing behavioural assertions remain valid.
     */
    async turnEnded(entityId) {
        return this.notifyTurnEnded(entityId, true);
    }
}

/* make it importable both ways */
export {EventBusTurnEndAdapter};