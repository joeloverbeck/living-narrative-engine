/**
 * @file Provides an in-memory implementation for storing and retrieving
 * loaded game data definitions (like entities, actions, components, etc.), fulfilling the
 * IDataRegistry interface. It uses Maps for efficient lookups.
 */

/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */

/**
 * Implements the IDataRegistry interface using in-memory Maps for data storage.
 *
 * @implements {IDataRegistry}
 */
class InMemoryDataRegistry {
  /**
   * Initializes the internal storage structures.
   */
  constructor() {
    /**
     * @private
     * @type {Map<string, Map<string, object>>}
     */
    this.data = new Map();

    /**
     * @private
     * @type {Map<string, Map<string, string>>}
     */
    this.contentOrigins = new Map();
  }

  /**
   * @param {string} type
   * @param {string} id
   * @param {object} data
   * @returns {boolean}
   */
  store(type, id, data) {
    if (typeof type !== 'string' || type.trim() === '') {
      console.error(
        'InMemoryDataRegistry.store: Invalid or empty type provided.'
      );
      return false;
    }
    if (typeof id !== 'string' || id.trim() === '') {
      console.error(
        `InMemoryDataRegistry.store: Invalid or empty id provided for type '${type}'.`
      );
      return false;
    }
    if (typeof data !== 'object' || data === null) {
      console.error(
        `InMemoryDataRegistry.store: Invalid data provided for type '${type}', id '${id}'. Must be an object.`
      );
      return false;
    }

    if (!this.data.has(type)) {
      this.data.set(type, new Map());
      this.contentOrigins.set(type, new Map());
    }
    const typeMap = this.data.get(type);
    const didOverride = typeMap.has(id);
    typeMap.set(id, data);

    const originMap = this.contentOrigins.get(type);
    if (originMap && typeof data.modId === 'string') {
      originMap.set(id, data.modId);
    }

    return didOverride;
  }

  /**
   * @param {string} type
   * @param {string} id
   * @returns {any | undefined}
   */
  get(type, id) {
    const typeMap = this.data.get(type);
    return typeMap ? typeMap.get(id) : undefined;
  }

  /**
   * @param {string} type
   * @returns {any[]}
   */
  getAll(type) {
    const typeMap = this.data.get(type);
    return typeMap ? Array.from(typeMap.values()) : [];
  }

  /**
   * @returns {object[]}
   */
  getAllSystemRules() {
    return this.getAll('rules');
  }

  // --- Specific Definition Getters ---

  getWorldDefinition(id) {
    return this.get('worlds', id);
  }

  getAllWorldDefinitions() {
    return this.getAll('worlds');
  }

  getEntityDefinition(id) {
    return this.get('entityDefinitions', id); // Note: key is entityDefinitions
  }

  getActionDefinition(id) {
    return this.get('actions', id);
  }

  getEventDefinition(id) {
    return this.get('events', id);
  }

  getComponentDefinition(id) {
    return this.get('components', id);
  }

  getConditionDefinition(id) {
    return this.get('conditions', id);
  }

  getEntityInstanceDefinition(id) {
    return this.get('entityInstances', id); // Note: key is entityInstances
  }

  getAllEntityDefinitions() {
    return this.getAll('entityDefinitions');
  }

  getAllActionDefinitions() {
    return this.getAll('actions');
  }

  getAllEventDefinitions() {
    return this.getAll('events');
  }

  getAllComponentDefinitions() {
    return this.getAll('components');
  }

  getAllConditionDefinitions() {
    return this.getAll('conditions');
  }

  getAllEntityInstanceDefinitions() {
    return this.getAll('entityInstances');
  }

  getGoalDefinition(id) {
    return this.get('goals', id);
  }

  getAllGoalDefinitions() {
    return this.getAll('goals');
  }

  /**
   * @param {string} type
   * @param {string} id
   * @returns {string | null}
   */
  getContentSource(type, id) {
    const typeMap = this.contentOrigins.get(type);
    return typeMap ? typeMap.get(id) || null : null;
  }

  /**
   * @param {string} modId
   * @returns {Record<string, string[]>}
   */
  listContentByMod(modId) {
    const result = {};
    for (const [type, idMap] of this.contentOrigins.entries()) {
      for (const [id, source] of idMap.entries()) {
        if (source === modId) {
          if (!result[type]) {
            result[type] = [];
          }
          result[type].push(id);
        }
      }
    }
    return result;
  }

  clear() {
    this.data.clear();
    this.contentOrigins.clear();
  }

  // --- Dynamically Discovered Startup Info ---

  getStartingPlayerId() {
    const entityDefs = this.getAllEntityDefinitions();
    for (const definition of entityDefs) {
      if (definition?.components?.['core:player']) {
        return definition.id;
      }
    }
    return null;
  }

  getStartingLocationId() {
    const playerId = this.getStartingPlayerId();
    if (!playerId) return null;

    const playerDef = this.getEntityDefinition(playerId);
    const locationId = playerDef?.components?.['core:position']?.locationId;

    if (typeof locationId !== 'string' || !locationId.trim()) {
      console.warn(
        `Starting player '${playerId}' has no valid locationId in core:position component.`
      );
      return null;
    }

    return locationId;
  }
}

export default InMemoryDataRegistry;
