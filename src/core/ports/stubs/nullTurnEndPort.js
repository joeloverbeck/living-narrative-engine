// src/core/ports/stubs/NullTurnEndPort.js
// --- FILE START ---

/**
 * @fileoverview Implements a non-functional Null/Stub for ITurnEndPort.
 */

import { ITurnEndPort } from '../ITurnEndPort.js';

/**
 * @class NullTurnEndPort
 * @implements {ITurnEndPort}
 * @description A non-functional implementation of ITurnEndPort suitable for
 * testing environments where signaling the end of a turn is not required
 * or should be ignored. It fulfills the interface contract without
 * performing any actions.
 */
export class NullTurnEndPort extends ITurnEndPort {
    /**
     * A no-op implementation of the turnEnded method.
     * It accepts the entityId but performs no action and immediately
     * returns a resolved promise.
     *
     * @async
     * @param {string} entityId - The entity ID whose turn ended (ignored).
     * @returns {Promise<void>} A promise that resolves immediately.
     */
    async turnEnded(entityId) {
        // Null implementation: Do nothing.
        return Promise.resolve();
    }

    /**
     * Optional: Add properties or methods for recording calls if needed
     * for more advanced stubbing/assertion scenarios later.
     */
    // lastTurnEndedEntityId = null;
    // async turnEnded(entityId) {
    //     this.lastTurnEndedEntityId = entityId;
    //     return Promise.resolve();
    // }
}

// --- FILE END ---