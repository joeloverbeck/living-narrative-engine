// src/services/gameDataRepository.js
// --- FILE START ---
import { IGameDataRepository } from '../interfaces/IGameDataRepository.js'; // Ensure this path is correct

/**
 * @class GameDataRepository
 * @augments {IGameDataRepository}
 * @implements {IGameDataRepository}
 * @description
 * Lightweight façade over an IDataRegistry implementation.
 * This class does not cache anything internally; every getter reflects the
 * current contents of the registry.
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {object} ComponentDefinition // Assuming a basic object type for now, or import a more specific typedef if available
 * @property
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

    // Extended to include component definition methods
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
      'getAllComponentDefinitions', // Added
      'get',
      'getAll',
      'clear',
      'store', // Basic IDataRegistry methods
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
  //  Manifest / World Info
  // ────────────────────────────────────────────────────────────────────────────

  getWorldName() {
    // Consider if this should also come from registry or a manifest object within it
    return 'DEMO_WORLD'; // Placeholder, as in original
  }

  getStartingPlayerId() {
    const playerId = this.#registry.getStartingPlayerId();
    // if (!playerId) { // Logging can be verbose, IDataRegistry might log this
    //     this.#logger.warn('GameDataRepository: getStartingPlayerId called, but no ID found in registry.');
    // }
    return playerId;
  }

  getStartingLocationId() {
    const locationId = this.#registry.getStartingLocationId();
    // if (!locationId) { // Logging can be verbose
    //     this.#logger.warn('GameDataRepository: getStartingLocationId called, but no ID found in registry.');
    // }
    return locationId;
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
  //  Component definitions (NEW SECTION)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves a specific ComponentDefinition by its ID from the registry.
   *
   * @param {string} id The fully qualified ID (e.g., 'core:position').
   * @returns {ComponentDefinition | null} The component definition, or null if not found.
   */
  getComponentDefinition(id) {
    if (typeof id !== 'string' || !id.trim()) {
      this.#logger.warn(
        `GameDataRepository: getComponentDefinition called with invalid ID: ${id}`
      );
      return null;
    }
    // `getComponentDefinition` should exist on IDataRegistry per interface contract
    const definition = this.#registry.getComponentDefinition(id);
    // Optionally log if not found, but can be noisy if checks are frequent
    // if (!definition) this.#logger.debug(`GameDataRepository: Component definition not found for ID: ${id}`);
    return definition ?? null;
  }

  /**
   * Retrieves all ComponentDefinition objects currently stored in the registry.
   *
   * @returns {ComponentDefinition[]} An array of all component definitions.
   */
  getAllComponentDefinitions() {
    // `getAllComponentDefinitions` should exist on IDataRegistry per interface contract
    return this.#registry.getAllComponentDefinitions();
  }

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
// --- FILE END ---
