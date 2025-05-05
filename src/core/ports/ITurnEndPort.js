// src/core/ports/ITurnEndPort.js
// --- FILE START ---

/**
 * @fileoverview Defines the interface for signaling the end of a player's turn.
 */

/**
 * @interface ITurnEndPort
 * @description An interface representing the output boundary for signaling that a player's turn has concluded.
 * Implementations (Adapters) will bridge this port to specific mechanisms
 * (like dispatching an EventBus event, resolving a promise, etc.) used by the
 * turn management system (e.g., GameLoop) to proceed to the next turn.
 */
export class ITurnEndPort {
    /**
     * Signals that the turn for the specified entity has ended.
     *
     * @async
     * @param {string} entityId - The unique ID of the entity whose turn has just finished.
     * @returns {Promise<void>} A promise that resolves when the turn end signal has been successfully processed
     * by the adapter. It might reject if signaling fails critically.
     * @throws {Error} Implementations might throw if the entityId is invalid or signaling fails critically.
     */
    async turnEnded(entityId) {
        throw new Error('ITurnEndPort.turnEnded method not implemented.');
    }
}

// --- FILE END ---