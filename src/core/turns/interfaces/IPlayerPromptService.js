// src/core/interfaces/IPlayerPromptService.js
// --- FILE START ---
/** @typedef {import('../../../entities/entity.js').default} Entity */

/**
 * @interface IPlayerPromptService
 * @description Defines the contract for a service that prompts a player for their turn.
 */
export class IPlayerPromptService {
    /**
     * Prompts the specified actor for their next action.
     * @async
     * @param {Entity} actor - The entity (player) to prompt.
     * @returns {Promise<void>} A promise that resolves when the prompt has been successfully processed.
     * @throws {Error} If prompting fails critically (e.g., invalid actor, underlying system error).
     */
    async prompt(actor) {
        throw new Error('IPlayerPromptService.prompt method not implemented.');
    }
}
// --- FILE END ---