// src/interfaces/IActionDiscoveryService.js (Assuming this is the path for the interface)

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../entities/entity.js').default} Entity */

// Assuming DiscoveredActionInfo is now defined as:
// {id: string, name: string, command: string, description?: string}
// If it's imported from elsewhere, ensure that source is updated.
// For this example, we'll update the comment here.

/**
 * @typedef {object} DiscoveredActionInfo
 * @property {string} id - The unique ID of the action definition.
 * @property {string} name - The human-readable name of the action.
 * @property {string} command - The formatted command string.
 * @property {string} [description] - Optional. The detailed description of the action.
 */

/**
 * @interface IActionDiscoveryService
 * @description Defines the contract for discovering valid actions available to an entity in the current game state.
 */
export class IActionDiscoveryService {
  /**
   * Determines all valid actions that the specified entity can currently perform.
   * This typically involves checking action definitions against the entity's state,
   * components, location, inventory, and the environment.
   *
   * @function getValidActions
   * @param {Entity} actingEntity - The entity for whom to discover actions.
   * @param {ActionContext} context - The current context, including location and potentially other relevant state.
   * Note: The `parsedCommand` property within this context will likely be undefined during discovery.
   * @returns {Promise<DiscoveredActionInfo[]>} A promise that resolves to an array of objects,
   * each containing the action ID, name, description (optional), and the formatted command string
   * (e.g., [{id: "core:go", name: "Go North", command: "go north", description: "Move to the north."}]).
   * Returns an empty array if no actions are valid.
   * @throws {Error} Implementations might throw errors for unexpected issues during discovery.
   */
  async getValidActions(actingEntity, context) {
    throw new Error(
      'IActionDiscoveryService.getValidActions method not implemented.'
    );
  }
}
