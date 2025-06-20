// src/services/gameDataRepository.js

import { IGameDataRepository } from '../interfaces/IGameDataRepository.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition
 * @typedef {import('../../data/schemas/entity-definition.schema.json').EntityDefinition} EntityDefinition
 * @typedef {import('../../data/schemas/entity-instance.schema.json').EntityInstance} EntityInstance
 * @typedef {import('../../data/schemas/goal.schema.json').GoalDefinition} GoalDefinition
 * @typedef {import('../../data/schemas/component.schema.json').EventDefinition} EventDefinition
 * @typedef {import('../../data/schemas/component.schema.json').ComponentDefinition} ComponentDefinition
 * @typedef {import('../../data/schemas/condition.schema.json').ConditionDefinition} ConditionDefinition
 */

/**
 * @class GameDataRepository
 * @augments {IGameDataRepository}
 * @implements {IGameDataRepository}
 * @description
 * Lightweight façade over an IDataRegistry implementation.
 * This class does not cache anything internally; every getter reflects the
 * current contents of the registry.
 */
export class GameDataRepository extends IGameDataRepository {
  /** @type {IDataRegistry} */
  #registry;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {IDataRegistry} registry
   * @param {ILogger} logger
   */
  constructor(registry, logger) {
    super();
    // --- Validation ---
    if (!logger?.info || !logger?.warn || !logger?.error || !logger?.debug) {
      throw new Error(
        'GameDataRepository requires a valid ILogger with info, warn, error, and debug methods.'
      );
    }

    const requiredRegistryMethods = [
      'getStartingPlayerId',
      'getStartingLocationId',
      'getActionDefinition',
      'getAllActionDefinitions',
      'getEntityDefinition',
      'getAllEntityDefinitions',
      'getEventDefinition',
      'getAllEventDefinitions',
      'getComponentDefinition',
      'getAllComponentDefinitions',
      'getConditionDefinition',
      'getAllConditionDefinitions',
      'getGoalDefinition', // Added
      'getAllGoalDefinitions', // Added
      'getEntityInstanceDefinition',
      'getAllEntityInstanceDefinitions',
      'get',
      'getAll',
      'clear',
      'store',
    ];
    const missingMethods = requiredRegistryMethods.filter(
      (method) => typeof registry?.[method] !== 'function'
    );

    if (!registry || missingMethods.length > 0) {
      const missing = (!registry ? ['registry object'] : [])
        .concat(missingMethods)
        .join(', ');
      throw new Error(
        `GameDataRepository requires a valid IDataRegistry with specific methods. Missing or invalid: ${missing}.`
      );
    }

    this.#registry = registry;
    this.#logger = logger;

    this.#logger.debug(
      'GameDataRepository initialised (delegates to registry).'
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 	Manifest / World Info
  // ────────────────────────────────────────────────────────────────────────────

  getWorldName() {
    return 'DEMO_WORLD';
  }

  getStartingPlayerId() {
    return this.#registry.getStartingPlayerId();
  }

  getStartingLocationId() {
    return this.#registry.getStartingLocationId();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 	Action definitions
  // ────────────────────────────────────────────────────────────────────────────

  /** @returns {ActionDefinition[]} */
  getAllActionDefinitions() {
    return this.#registry.getAllActionDefinitions();
  }

  /**
   * @param {string} id
   * @returns {ActionDefinition | null}
   */
  getActionDefinition(id) {
    if (typeof id !== 'string' || !id.trim()) {
      this.#logger.warn(
        `GameDataRepository: getActionDefinition called with invalid ID: ${id}`
      );
      return null;
    }
    const definition = this.#registry.getActionDefinition(id);
    return definition ?? null;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 	Entity definitions
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} id
   * @returns {EntityDefinition | null}
   */
  getEntityDefinition(id) {
    if (typeof id !== 'string' || !id.trim()) {
      this.#logger.warn(
        `GameDataRepository: getEntityDefinition called with invalid ID: ${id}`
      );
      return null;
    }
    const definition = this.#registry.getEntityDefinition(id);
    return definition ?? null;
  }

  /** @returns {EntityDefinition[]} */
  getAllEntityDefinitions() {
    return this.#registry.getAllEntityDefinitions();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 	Entity instances
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} id
   * @returns {EntityInstance | null}
   */
  getEntityInstanceDefinition(id) {
    if (typeof id !== 'string' || !id.trim()) {
      this.#logger.warn(
        `GameDataRepository: getEntityInstanceDefinition called with invalid ID: ${id}`
      );
      return null;
    }
    const definition = this.#registry.getEntityInstanceDefinition(id);
    return definition ?? null;
  }

  /** @returns {EntityInstance[]} */
  getAllEntityInstanceDefinitions() {
    return this.#registry.getAllEntityInstanceDefinitions();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 	Event definitions
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} id
   * @returns {EventDefinition | null}
   */
  getEventDefinition(id) {
    if (typeof id !== 'string' || !id.trim()) {
      this.#logger.warn(
        `GameDataRepository: getEventDefinition called with invalid ID: ${id}`
      );
      return null;
    }
    const definition = this.#registry.getEventDefinition(id);
    return definition ?? null;
  }

  /** @returns {EventDefinition[]} */
  getAllEventDefinitions() {
    return this.#registry.getAllEventDefinitions();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 	Component definitions
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} id
   * @returns {ComponentDefinition | null}
   */
  getComponentDefinition(id) {
    if (typeof id !== 'string' || !id.trim()) {
      this.#logger.warn(
        `GameDataRepository: getComponentDefinition called with invalid ID: ${id}`
      );
      return null;
    }
    const definition = this.#registry.getComponentDefinition(id);
    return definition ?? null;
  }

  /** @returns {ComponentDefinition[]} */
  getAllComponentDefinitions() {
    return this.#registry.getAllComponentDefinitions();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 	Condition definitions
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves a specific ConditionDefinition by its ID from the registry.
   *
   * @param {string} id The fully qualified ID (e.g., 'core:actor-is-not-rooted').
   * @returns {ConditionDefinition | null} The condition definition, or null if not found.
   */
  getConditionDefinition(id) {
    if (typeof id !== 'string' || !id.trim()) {
      this.#logger.warn(
        `GameDataRepository: getConditionDefinition called with invalid ID: ${id}`
      );
      return null;
    }
    const definition = this.#registry.getConditionDefinition(id);
    return definition ?? null;
  }

  /**
   * Retrieves all ConditionDefinition objects currently stored in the registry.
   *
   * @returns {ConditionDefinition[]} An array of all condition definitions.
   */
  getAllConditionDefinitions() {
    return this.#registry.getAllConditionDefinitions();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 	Goal definitions (NEW)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves a specific GoalDefinition by its ID from the registry.
   *
   * @param {string} id The fully qualified ID (e.g., 'core:goal_survive').
   * @returns {GoalDefinition | null} The goal definition, or null if not found.
   */
  getGoalDefinition(id) {
    if (typeof id !== 'string' || !id.trim()) {
      this.#logger.warn(
        `GameDataRepository: getGoalDefinition called with invalid ID: ${id}`
      );
      return null;
    }
    const definition = this.#registry.getGoalDefinition(id);
    return definition ?? null;
  }

  /**
   * Retrieves all GoalDefinition objects currently stored in the registry.
   *
   * @returns {GoalDefinition[]} An array of all goal definitions.
   */
  getAllGoalDefinitions() {
    return this.#registry.getAllGoalDefinitions();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 	Mod & Content Info
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves the mod ID responsible for a given content item.
   *
   * @param {string} type - The content type (e.g., 'actions').
   * @param {string} id - The fully qualified item ID.
   * @returns {string | null} The mod ID or null if unknown.
   */
  getContentSource(type, id) {
    if (typeof this.#registry.getContentSource === 'function') {
      return this.#registry.getContentSource(type, id);
    }
    this.#logger.warn(
      'GameDataRepository: getContentSource not supported by registry'
    );
    return null;
  }

  /**
   * Lists all content provided by a specific mod.
   *
   * @param {string} modId - The mod identifier.
   * @returns {Record<string, string[]>} Mapping of type to IDs.
   */
  listContentByMod(modId) {
    if (typeof this.#registry.listContentByMod === 'function') {
      return this.#registry.listContentByMod(modId);
    }
    this.#logger.warn(
      'GameDataRepository: listContentByMod not supported by registry'
    );
    return {};
  }
}

export default GameDataRepository;
