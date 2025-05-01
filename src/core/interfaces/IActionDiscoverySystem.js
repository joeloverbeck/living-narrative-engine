/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */

/** @typedef {import('../../entities/entity.js').default} Entity */

/**
 * @interface IActionDiscoverySystem
 * @description Defines the contract for discovering valid actions available to an entity in the current game state.
 */
export class IActionDiscoverySystem {
    /**
     * Determines all valid actions that the specified entity can currently perform.
     * This typically involves checking action definitions against the entity's state,
     * components, location, inventory, and the environment.
     * @function getValidActions
     * @param {Entity} actingEntity - The entity for whom to discover actions.
     * @param {ActionContext} context - The current context, including location and potentially other relevant state.
     * Note: The `parsedCommand` property within this context will likely be undefined during discovery.
     * @returns {Promise<string[]>} A promise that resolves to an array of formatted command strings
     * representing the valid actions (e.g., ["move north", "take rusty key"]). Returns an empty array if no actions are valid.
     * @throws {Error} Implementations might throw errors for unexpected issues during discovery.
     */
    async getValidActions(actingEntity, context) {
        throw new Error('IActionDiscoverySystem.getValidActions method not implemented.');
    }
}