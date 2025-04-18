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
        // Map.set automatically handles overwriting if the key already exists.
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
        // Get the map for the type.
        const typeMap = this.data.get(type);

        // If typeMap exists, retrieve the data using the id.
        // If typeMap doesn't exist or the id is not found within it,
        // typeMap.get(id) will correctly return undefined.
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
        // Get the map for the type.
        const typeMap = this.data.get(type);

        // If typeMap exists, convert its values (the data objects) to an array.
        // If typeMap doesn't exist, return an empty array.
        return typeMap ? Array.from(typeMap.values()) : [];
    }

    /**
     * Removes all stored typed data objects and resets the manifest to null.
     * This is typically used when loading a new world or resetting the game state.
     */
    clear() {
        // Clear the main data map, removing all type categories and their contents.
        this.data.clear();

        // Reset the manifest reference to null.
        this.manifest = null;

        // console.log("InMemoryDataRegistry: Cleared all data and manifest."); // Optional: Add logging
    }

    /**
     * Retrieves the currently loaded world manifest object.
     *
     * @returns {object | null} The stored manifest object, or null if no manifest has been set or after clear() has been called.
     */
    getManifest() {
        return this.manifest;
    }

    /**
     * Stores the world manifest object. Overwrites any previously stored manifest.
     *
     * @param {object} data - The manifest object to store. Should be a non-null object.
     * Use clear() to unset the manifest.
     */
    setManifest(data) {
        // Basic validation: Ensure we are setting a non-null object.
        if (typeof data !== 'object' || data === null) {
            console.error('InMemoryDataRegistry.setManifest: Attempted to set invalid manifest data. Must be a non-null object.');
            // Consider throwing an error depending on desired strictness
            // throw new Error('Invalid manifest data: Must be a non-null object.');
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