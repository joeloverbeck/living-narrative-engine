// src/data/inMemoryDataRegistry.js

/**
 * @file Provides an in-memory implementation for storing and retrieving
 * loaded game data definitions (like entities, actions, components, etc.), fulfilling the
 * IDataRegistry interface. It uses Maps for efficient lookups.
 * Starting player and location are dynamically discovered from loaded entity definitions.
 */

/**
 * Implements the IDataRegistry interface using in-memory Maps for data storage.
 * This class acts as a central registry for loaded game definitions.
 * It dynamically discovers the starting player and location based on component data
 * within the registered entity definitions.
 *
 * @implements {IDataRegistry}
 */
class InMemoryDataRegistry {
  /**
   * Initializes the internal storage structures.
   */
  constructor() {
    /**
     * Internal storage for typed game data definitions.
     * The outer Map's key is the data type (e.g., 'actions', 'entities', 'components').
     * The inner Map's key is the specific item's ID, and the value is the data object.
     *
     * @private
     * @type {Map<string, Map<string, object>>}
     */
    this.data = new Map();

    /**
     * Tracks which mod supplied each content item.
     * Maps a content type to a Map of item ID to the originating mod ID.
     *
     * @private
     * @type {Map<string, Map<string, string>>}
     */
    this.contentOrigins = new Map();

    // Manifest property removed - no longer used.

    // console.log("InMemoryDataRegistry: Instance created.");
  }

  /**
   * Stores a data object under a specific category (`type`) and unique identifier (`id`).
   * If the type category doesn't exist, it's created. Overwrites existing data for the same type/id.
   *
   * @param {string} type - The category of data (e.g., 'entities', 'actions'). Must be a non-empty string.
   * @param {string} id - The unique identifier for the data object within its type. Must be a non-empty string.
   * @param {object} data - The data object to store. Must be a non-null object.
   */
  store(type, id, data) {
    // Basic input validation
    if (typeof type !== 'string' || type.trim() === '') {
      console.error(
        'InMemoryDataRegistry.store: Invalid or empty type provided.'
      );
      return; // Or throw new Error('Invalid type');
    }
    if (typeof id !== 'string' || id.trim() === '') {
      console.error(
        `InMemoryDataRegistry.store: Invalid or empty id provided for type '${type}'.`
      );
      return; // Or throw new Error('Invalid id');
    }
    if (typeof data !== 'object' || data === null) {
      console.error(
        `InMemoryDataRegistry.store: Invalid data provided for type '${type}', id '${id}'. Must be an object.`
      );
      return; // Or throw new Error('Invalid data object');
    }

    if (!this.data.has(type)) {
      this.data.set(type, new Map());
      this.contentOrigins.set(type, new Map());
    }
    const typeMap = this.data.get(type);
    typeMap.set(id, data);

    const originMap = this.contentOrigins.get(type);
    if (originMap && typeof data.modId === 'string') {
      originMap.set(id, data.modId);
    }
  }

  /**
   * Retrieves a specific data object by its type and ID.
   *
   * @param {string} type - The category of data (e.g., 'entities').
   * @param {string} id - The unique identifier of the data object.
   * @returns {object | undefined} The data object if found, otherwise undefined.
   */
  get(type, id) {
    const typeMap = this.data.get(type);
    return typeMap ? typeMap.get(id) : undefined;
  }

  /**
   * Retrieves all data objects belonging to a specific type as an array.
   *
   * @param {string} type - The category of data (e.g., 'entities').
   * @returns {object[]} An array of data objects for the given type. Returns an empty array
   * if the type is unknown or has no data stored.
   */
  getAll(type) {
    const typeMap = this.data.get(type);
    return typeMap ? Array.from(typeMap.values()) : [];
  }

  /**
   * Retrieves all loaded system rule objects.
   *
   * @returns {object[]} An array containing all stored system rule objects.
   */
  getAllSystemRules() {
    return this.getAll('rules');
  }

  // =======================================================
  // --- Specific Definition Getter Methods (Verified against Interface) ---
  // =======================================================

  getEntityDefinition(id) {
    return this.get('entities', id);
  }

  // getItemDefinition removed
  // getLocationDefinition removed
  // getConnectionDefinition removed
  // getBlockerDefinition removed
  getActionDefinition(id) {
    return this.get('actions', id);
  }

  getEventDefinition(id) {
    return this.get('events', id);
  }

  getComponentDefinition(id) {
    return this.get('components', id);
  }

  getAllEntityDefinitions() {
    return this.getAll('entities');
  }

  // getAllItemDefinitions removed
  // getAllLocationDefinitions removed
  // getAllConnectionDefinitions removed
  // getAllBlockerDefinitions removed
  getAllActionDefinitions() {
    return this.getAll('actions');
  }

  getAllEventDefinitions() {
    return this.getAll('events');
  }

  getAllComponentDefinitions() {
    return this.getAll('components');
  }

  /**
   * Retrieves the mod ID that provided a specific content item.
   *
   * @param {string} type - The content type category.
   * @param {string} id - The fully qualified ID of the content item.
   * @returns {string | null} The mod ID if tracked, otherwise null.
   */
  getContentSource(type, id) {
    const typeMap = this.contentOrigins.get(type);
    return typeMap ? typeMap.get(id) || null : null;
  }

  /**
   * Lists all content IDs provided by a specific mod, grouped by content type.
   *
   * @param {string} modId - The mod identifier.
   * @returns {Record<string, string[]>} Mapping of content type to array of IDs.
   */
  listContentByMod(modId) {
    /** @type {Record<string, string[]>} */
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

  // =======================================================
  // --- End Specific Definition Getter Methods ---
  // =======================================================

  /**
   * Removes all stored typed data objects.
   */
  clear() {
    this.data.clear();
    this.contentOrigins.clear();
    // Manifest removed, no need to clear it.
    // console.log("InMemoryDataRegistry: Cleared all data.");
  }

  // getManifest method removed.
  // setManifest method removed.

  // ===============================================================================
  // --- Dynamically Discovered Starting Player and Location ID Implementations ---
  // ===============================================================================

  /**
   * Dynamically discovers the starting player ID by finding the first entity
   * definition in the 'entities' type map that contains a 'core:player' component.
   * The iteration order depends on the insertion order into the underlying Map.
   *
   * @returns {string | null} The ID of the first entity definition found with a
   * 'core:player' component, or null if no such entity is found.
   */
  getStartingPlayerId() {
    // Verify: Uses 'entities' category via this.data.get('entities')
    const entityMap = this.data.get('entities');
    if (!entityMap) {
      // Log adjusted slightly to avoid implying 'type' is the problem when it might just be empty
      console.warn(
        "InMemoryDataRegistry.getStartingPlayerId: No 'entities' data found in registry."
      );
      return null; // No entities loaded at all
    }

    for (const [id, definition] of entityMap.entries()) {
      // Check if definition is a valid object and has the components property,
      // and if the 'core:player' component exists within components.
      if (
        definition &&
        typeof definition === 'object' &&
        definition.components &&
        typeof definition.components['core:player'] === 'object'
      ) {
        // Found the first entity definition with the player component.
        // console.log(`InMemoryDataRegistry.getStartingPlayerId: Found starting player ID: ${id}`);
        return id;
      }
    }

    // console.warn("InMemoryDataRegistry.getStartingPlayerId: Could not find any entity definition with a 'core:player' component.");
    return null; // No entity with the player component found
  }

  /**
   * Dynamically discovers the starting location ID.
   * It first finds the starting player ID using `getStartingPlayerId()`.
   * Then, it retrieves the player's entity definition and extracts the 'locationId'
   * property from the 'core:position' component data within that definition.
   *
   * @returns {string | null} The 'locationId' string found in the starting player's
   * position component data, or null if the player ID, definition, position component,
   * or locationId property cannot be found.
   */
  getStartingLocationId() {
    // Verify: Uses 'entities' category indirectly via getStartingPlayerId() and getEntityDefinition()
    const playerId = this.getStartingPlayerId();
    if (!playerId) {
      // Warning already logged by getStartingPlayerId if applicable
      return null; // Cannot determine location without a player
    }

    // Retrieve the definition for the found player ID using the verified getter
    const playerDef = this.getEntityDefinition(playerId); // Uses this.get('entities', playerId)
    if (!playerDef || typeof playerDef !== 'object') {
      console.warn(
        `InMemoryDataRegistry.getStartingLocationId: Could not retrieve definition for starting player ID: ${playerId}`
      );
      return null;
    }

    // Safely access the position component data
    const positionComponent = playerDef.components?.['core:position'];
    if (!positionComponent || typeof positionComponent !== 'object') {
      console.warn(
        `InMemoryDataRegistry.getStartingLocationId: Starting player definition (${playerId}) does not have a 'core:position' component in its components.`
      );
      return null;
    }

    // Safely access the locationId property within the position component
    const locationId = positionComponent.locationId;
    if (typeof locationId !== 'string' || locationId.trim() === '') {
      console.warn(
        `InMemoryDataRegistry.getStartingLocationId: Position component in starting player definition (${playerId}) does not have a valid 'locationId' property.`
      );
      return null;
    }

    // console.log(`InMemoryDataRegistry.getStartingLocationId: Found starting location ID from player ${playerId}: ${locationId}`);
    return locationId;
  }

  // =======================================================
  // --- END ADDED METHODS ---
  // =======================================================
}

// Export the class as the default export of this module
export default InMemoryDataRegistry;

// JSDoc type import for interface reference - ensures tools can understand the @implements tag
/**
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 */
