/**
 * @typedef {import('../../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition
 * @typedef {import('../../../data/schemas/condition.schema.json').ConditionDefinition} ConditionDefinition
 */

/**
 * @interface IGameDataRepository
 * @description Defines the contract for accessing game data definitions.
 * This interface specifies the methods that various services rely upon for
 * retrieving game data definitions like actions and conditions.
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
   * Retrieves a specific ConditionDefinition by its ID.
   *
   * @param {string} conditionId The fully qualified ID of the condition (e.g., 'core:actor-is-not-rooted').
   * @returns {ConditionDefinition | null} The condition definition if found, otherwise null.
   */
  getConditionDefinition(conditionId) {
    throw new Error(
      'IGameDataRepository.getConditionDefinition not implemented.'
    );
  }

  /**
   * Returns all ConditionDefinition objects currently available.
   *
   * @returns {ConditionDefinition[]} An array of all condition definitions.
   */
  getAllConditionDefinitions() {
    throw new Error(
      'IGameDataRepository.getAllConditionDefinitions not implemented.'
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
