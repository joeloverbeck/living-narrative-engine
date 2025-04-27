// src/core/services/inMemoryDataRegistry.js

/**
 * @fileoverview Provides an in-memory implementation for storing and retrieving
 * loaded game data (entities, items, actions, manifest, etc.), fulfilling the
 * IDataRegistry interface. It uses Maps for efficient lookups.
 */

/**
 * Implements the IDataRegistry interface using in-memory Maps for data storage.
 * This class acts as a central registry for loaded game definitions and the world manifest.
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
         * The outer Map's key is the data type (e.g., 'actions', 'entities', 'items').
         * The inner Map's key is the specific item's ID, and the value is the data object.
         * @private
         * @type {Map<string, Map<string, object>>}
         */
        this.data = new Map();

        /**
         * Internal storage for the loaded world manifest object.
         * @private
         * @type {object | null}
         */
        this.manifest = null;

        // console.log("InMemoryDataRegistry: Instance created."); // Optional: Add logging
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
            console.error('InMemoryDataRegistry.store: Invalid or empty type provided.');
            return; // Or throw new Error('Invalid type');
        }
        if (typeof id !== 'string' || id.trim() === '') {
            console.error(`InMemoryDataRegistry.store: Invalid or empty id provided for type '${type}'.`);
            return; // Or throw new Error('Invalid id');
        }
        if (typeof data !== 'object' || data === null) {
            // Allow storing potentially empty objects, but not null/undefined/primitives
            console.error(`InMemoryDataRegistry.store: Invalid data provided for type '${type}', id '${id}'. Must be an object.`);
            return; // Or throw new Error('Invalid data object');
        }

        // Check if a map for the type exists in this.data. If not, create it.
        if (!this.data.has(type)) {
            this.data.set(type, new Map());
        }

        // Get the map for the type.
        const typeMap = this.data.get(type);

        // Store the data object using its id as the key.
        typeMap.set(id, data);
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
     * @param {string} type - The category of data (e.g., 'items').
     * @returns {object[]} An array of data objects for the given type. Returns an empty array
     * if the type is unknown or has no data stored.
     */
    getAll(type) {
        const typeMap = this.data.get(type);
        return typeMap ? Array.from(typeMap.values()) : [];
    }

    // =======================================================
    // --- ADDED METHOD for RULESYS-101 ---
    // =======================================================
    /**
     * Retrieves all loaded system rule objects.
     * Uses the specific key 'rules' as agreed upon.
     *
     * @returns {object[]} An array containing all stored system rule objects.
     * Returns an empty array `[]` if no system rules have been stored.
     */
    getAllSystemRules() {
        return this.getAll('rules'); // AC3: Calls this.getAll with the specific key
    }

    // =======================================================
    // --- END ADDED METHOD ---
    // =======================================================


    // =======================================================
    // --- Existing Definition Getter Methods ---
    // =======================================================

    /**
     * Retrieves a specific entity definition by its ID.
     * @param {string} entityId - The ID of the entity definition.
     * @returns {object | undefined} The entity definition object or undefined.
     */
    getEntityDefinition(entityId) {
        // Try common categories where entity-like definitions might be stored
        return this.get('entities', entityId)
            || this.get('locations', entityId)
            || this.get('connections', entityId)
            || this.get('items', entityId) // Add other relevant categories
            || undefined; // Return undefined if not found in any category
    }

    /**
     * Retrieves a specific action definition by its ID.
     * @param {string} actionId - The ID of the action definition.
     * @returns {object | undefined} The action definition object or undefined.
     */
    getActionDefinition(actionId) {
        return this.get('actions', actionId);
    }

    /**
     * Retrieves all loaded action definitions.
     * @returns {object[]} An array of all action definition objects.
     */
    getAllActionDefinitions() {
        return this.getAll('actions');
    }

    getEventDefinition(id) {
        return this.get('events', id);
    }

    getAllEventDefinitions() {
        return this.getAll('events');
    }

    /**
     * Retrieves a specific location definition by its ID.
     * Note: Assumes locations are stored under the 'locations' type OR 'entities' type.
     * Adjust the types checked ('locations', 'entities') if you store them differently.
     * @param {string} locationId - The ID of the location definition.
     * @returns {object | undefined} The location definition object or undefined.
     */
    getLocationDefinition(locationId) {
        // Check both 'locations' and 'entities' types, returning the first match found.
        // Prioritize 'locations' if it exists as a distinct type.
        return this.get('locations', locationId) ?? this.get('entities', locationId);
    }

    // =======================================================
    // --- End Existing Definition Getter Methods ---
    // =======================================================


    /**
     * Removes all stored typed data objects and resets the manifest to null.
     */
    clear() {
        this.data.clear();
        this.manifest = null;
        // console.log("InMemoryDataRegistry: Cleared all data and manifest.");
    }

    /**
     * Retrieves the currently loaded world manifest object.
     * @returns {object | null} The stored manifest object, or null.
     */
    getManifest() {
        return this.manifest;
    }

    /**
     * Stores the world manifest object. Overwrites any previously stored manifest.
     * @param {object} data - The manifest object to store. Must be a non-null object.
     */
    setManifest(data) {
        if (typeof data !== 'object' || data === null) {
            console.error('InMemoryDataRegistry.setManifest: Attempted to set invalid manifest data. Must be a non-null object.');
            return;
        }
        this.manifest = data;
    }
}

// Export the class as the default export of this module
export default InMemoryDataRegistry;

// JSDoc type import for interface reference - ensures tools can understand the @implements tag
/**
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 */