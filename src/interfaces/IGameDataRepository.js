// src/interfaces/IGameDataRepository.js
/** @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition */

/**
 * @interface IGameDataRepository
 * @description Defines the contract for accessing game data definitions.
 * This interface specifies the methods that CommandProcessor.js and its created
 * ActionContext rely upon for retrieving game data, particularly action definitions.
 */
export class IGameDataRepository {
  /**
   * Retrieves a specific ActionDefinition by its ID.
   *
   * @param {string} actionId The fully qualified ID of the action (e.g., 'core:move').
   * @returns {ActionDefinition | null} The action definition if found, otherwise null.
   */
  getActionDefinition(actionId) {
    throw new Error('IGameDataRepository.getActionDefinition not implemented.');
  }

  /**
   * Returns all ActionDefinition objects currently available.
   *
   * @returns {ActionDefinition[]} An array of all action definitions.
   */
  getAllActionDefinitions() {
    throw new Error(
      'IGameDataRepository.getAllActionDefinitions not implemented.'
    );
  }

  /**
   * Returns the mod ID that supplied a particular content item.
   *
   * @param {string} type Content type category.
   * @param {string} id Fully qualified item ID.
   * @returns {string | null} Mod ID or null if not tracked.
   */
  getContentSource(type, id) {
    throw new Error('IGameDataRepository.getContentSource not implemented.');
  }

  /**
   * Lists all content IDs provided by the specified mod.
   *
   * @param {string} modId The mod identifier.
   * @returns {Record<string, string[]>} Mapping of type to IDs.
   */
  listContentByMod(modId) {
    throw new Error('IGameDataRepository.listContentByMod not implemented.');
  }
}
