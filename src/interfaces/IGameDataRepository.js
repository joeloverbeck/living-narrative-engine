// src/interfaces/IGameDataRepository.js

/**
 * @typedef {import('../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition
 * @typedef {import('../../data/schemas/condition.schema.json').ConditionDefinition} ConditionDefinition
 * @typedef {import('../../data/schemas/goal.schema.json').GoalDefinition} GoalDefinition
 * @typedef {import('../../data/schemas/entity-definition.schema.json').EntityDefinition} EntityDefinition
 * @typedef {import('../../data/schemas/entity-instance.schema.json').EntityInstance} EntityInstance
 */

/**
 * @interface IGameDataRepository
 * @description Defines the contract for accessing game data definitions.
 * This interface specifies the methods that various services rely upon for
 * retrieving game data definitions like actions, conditions, and goals.
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
   * Retrieves a specific GoalDefinition by its ID.
   *
   * @param {string} goalId The fully qualified ID of the goal (e.g., 'core:goal_survive').
   * @returns {GoalDefinition | null} The goal definition if found, otherwise null.
   */
  getGoalDefinition(goalId) {
    throw new Error('IGameDataRepository.getGoalDefinition not implemented.');
  }

  /**
   * Returns all GoalDefinition objects currently available.
   *
   * @returns {GoalDefinition[]} An array of all goal definitions.
   */
  getAllGoalDefinitions() {
    throw new Error(
      'IGameDataRepository.getAllGoalDefinitions not implemented.'
    );
  }

  /**
   * Retrieves a specific EntityDefinition by its ID.
   *
   * @param {string} entityId The fully qualified ID of the entity definition (e.g., 'core:player').
   * @returns {EntityDefinition | null} The entity definition if found, otherwise null.
   */
  getEntityDefinition(entityId) {
    throw new Error('IGameDataRepository.getEntityDefinition not implemented.');
  }

  /**
   * Returns all EntityDefinition objects currently available.
   *
   * @returns {EntityDefinition[]} An array of all entity definitions.
   */
  getAllEntityDefinitions() {
    throw new Error(
      'IGameDataRepository.getAllEntityDefinitions not implemented.'
    );
  }

  /**
   * Retrieves a specific EntityInstance data object by its ID.
   *
   * @param {string} instanceId The fully qualified ID of the entity instance (e.g., 'world:main_character').
   * @returns {EntityInstance | null} The entity instance data if found, otherwise null.
   */
  getEntityInstanceDefinition(instanceId) {
    throw new Error(
      'IGameDataRepository.getEntityInstanceDefinition not implemented.'
    );
  }

  /**
   * Returns all EntityInstance data objects currently available.
   *
   * @returns {EntityInstance[]} An array of all entity instance data objects.
   */
  getAllEntityInstanceDefinitions() {
    throw new Error(
      'IGameDataRepository.getAllEntityInstanceDefinitions not implemented.'
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