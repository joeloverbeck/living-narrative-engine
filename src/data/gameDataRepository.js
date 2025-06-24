// src/services/gameDataRepository.js

import { IGameDataRepository } from '../interfaces/IGameDataRepository.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../data/schemas/action.schema.json').ActionDefinition} ActionDefinition
 * @typedef {import('../../data/schemas/entity-definition.schema.json').EntityDefinition} EntityDefinition
 * @typedef {import('../../data/schemas/entity-instance.schema.json').EntityInstance} EntityInstance
 * @typedef {import('../../data/schemas/goal.schema.json').GoalDefinition} GoalDefinition
 * @typedef {import('../../data/schemas/event.schema.json').EventDefinition} EventDefinition
 * @typedef {import('../../data/schemas/component.schema.json').ComponentDefinition} ComponentDefinition
 * @typedef {import('../../data/schemas/condition.schema.json').ConditionDefinition} ConditionDefinition
 * @typedef {import('../../data/schemas/world.schema.json').WorldDefinition} WorldDefinition
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
      'getWorldDefinition', // Added
      'getAllWorldDefinitions', // Added
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
      'getGoalDefinition',
      'getAllGoalDefinitions',
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
  //  World & Startup Info
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} id The namespaced ID of the world.
   * @returns {WorldDefinition | null}
   */
  getWorld(id) {
    if (typeof id !== 'string' || !id.trim()) {
      this.#logger.warn(
        `GameDataRepository: getWorld called with invalid ID: ${id}`
      );
      return null;
    }
    return this.#registry.getWorldDefinition(id) ?? null;
  }

  /** @returns {WorldDefinition[]} */
  getAllWorlds() {
    return this.#registry.getAllWorldDefinitions();
  }

  getStartingPlayerId() {
    return this.#registry.getStartingPlayerId();
  }

  getStartingLocationId() {
    return this.#registry.getStartingLocationId();
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Action definitions
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
  //  Entity definitions
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
  //  Entity instances
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} id
   * @returns {EntityInstance | null} The instance definition, or null when the
   * ID is invalid or no definition exists.
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
  //  Event definitions
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
  //  Component definitions
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
  //  Condition definitions
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} id
   * @returns {ConditionDefinition | null}
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

  /** @returns {ConditionDefinition[]} */
  getAllConditionDefinitions() {
    return this.#registry.getAllConditionDefinitions();
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Goal definitions
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} id
   * @returns {GoalDefinition | null}
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

  /** @returns {GoalDefinition[]} */
  getAllGoalDefinitions() {
    return this.#registry.getAllGoalDefinitions();
  }

  // ────────────────────────────────────────────────────────────────────────────
  //  Mod & Content Info
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * @param {string} type
   * @param {string} id
   * @returns {string | null}
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
   * @param {string} modId
   * @returns {Record<string, string[]>}
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

  // ────────────────────────────────────────────────────────────────────────────
  //  Generic data access
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves arbitrary data from the underlying registry by key.
   * This provides access to data types not covered by specific getter methods.
   *
   * @param {string} key The data key to retrieve (e.g., 'scopes', 'prompts').
   * @returns {any} The data associated with the key, or undefined if not found.
   */
  get(key) {
    if (typeof key !== 'string' || !key.trim()) {
      this.#logger.warn(
        `GameDataRepository: get called with invalid key: ${key}`
      );
      return undefined;
    }

    if (typeof this.#registry.get === 'function') {
      return this.#registry.get(key);
    }

    this.#logger.warn(
      'GameDataRepository: get method not supported by registry'
    );
    return undefined;
  }
}

export default GameDataRepository;
