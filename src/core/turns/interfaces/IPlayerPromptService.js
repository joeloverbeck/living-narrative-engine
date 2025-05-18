// src/core/interfaces/IPlayerPromptService.js
// --- FILE START ---
/** @typedef {import('../../../entities/entity.js').default} Entity */
/** @typedef {import('../../../actions/availableAction.js').default} AvailableAction */

/**
 * @typedef {object} PlayerPromptResolution
 * @property {AvailableAction} action - The selected available action object.
 * @property {string | null} speech - The optional speech input from the player, or null if not provided.
 */

/**
 * @interface IPlayerPromptService
 * @description Defines the contract for a service that prompts a player for their turn
 * and asynchronously returns their chosen action.
 */
export class IPlayerPromptService {
    /**
     * Prompts the specified actor for their next action and awaits their response.
     * @async
     * @param {Entity} actor - The entity (player) to prompt.
     * @returns {Promise<PlayerPromptResolution>} A promise that resolves with an object containing
     * the player's selected action and any accompanying speech.
     * @throws {Error} If prompting fails critically (e.g., invalid actor, underlying system error,
     * or failure to set up the prompt mechanism).
     */
    async prompt(actor) {
        // This is an interface method and should not be called directly.
        // Implementations of this interface should provide the actual logic.
        throw new Error('IPlayerPromptService.prompt method not implemented.');
    }
}

// --- FILE END ---