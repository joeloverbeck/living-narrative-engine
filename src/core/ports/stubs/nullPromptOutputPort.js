// src/core/ports/stubs/nullPromptOutputPort.js
// --- FILE START ---

/**
 * @fileoverview Implements a non-functional Null/Stub for IPromptOutputPort.
 */

import { IPromptOutputPort } from '../IPromptOutputPort.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../commonTypes.js').DiscoveredActionInfo} DiscoveredActionInfo */

/**
 * @class NullPromptOutputPort
 * @implements {IPromptOutputPort}
 * @description A non-functional implementation of IPromptOutputPort suitable for
 * testing environments where sending prompts is not required or should be ignored.
 * It fulfills the interface contract without performing any actions.
 */
export class NullPromptOutputPort extends IPromptOutputPort {
    /**
     * A no-op implementation of the prompt method.
     * It accepts the arguments but performs no action and immediately
     * returns a resolved promise.
     *
     * @async
     * @param {string} entityId - The entity ID (ignored).
     * @param {DiscoveredActionInfo[]} availableActions - The available actions (ignored).
     * @param {string} [error] - The optional error message (ignored).
     * @returns {Promise<void>} A promise that resolves immediately.
     */
    async prompt(entityId, availableActions, error) {
        // Null implementation: Do nothing.
        return Promise.resolve();
    }

    /**
     * Optional: Add properties or methods for recording calls if needed
     * for more advanced stubbing/assertion scenarios later.
     */
    // lastPromptArgs = null;
    // async prompt(entityId, availableActions, error) {
    //     this.lastPromptArgs = { entityId, availableActions, error };
    //     return Promise.resolve();
    // }
}

// --- FILE END ---