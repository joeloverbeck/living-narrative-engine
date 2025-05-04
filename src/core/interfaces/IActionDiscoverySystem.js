/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../entities/entity.js').default} Entity */
// --- Make sure DiscoveredActionInfo is defined or imported here ---
/** @typedef {import('./actionDiscoverySystem.js').DiscoveredActionInfo} DiscoveredActionInfo */ // Example import if defined elsewhere

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
     * @returns {Promise<DiscoveredActionInfo[]>} A promise that resolves to an array of objects,
     * each containing the action ID and the formatted command string (e.g., [{id: "core:go", command: "go north"}]).
     * Returns an empty array if no actions are valid. // <<< --- MODIFIED THIS LINE ---
     * @throws {Error} Implementations might throw errors for unexpected issues during discovery.
     */
    async getValidActions(actingEntity, context) {
        throw new Error('IActionDiscoverySystem.getValidActions method not implemented.');
    }
}