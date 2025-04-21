/**
 * @fileoverview Implements the IConfiguration interface by providing
 * hardcoded configuration values, primarily sourced from the legacy
 * constants in the original GameDataRepository.js. This serves as an initial,
 * static configuration provider during the refactoring process.
 */

// --- Constants reflecting consolidated entity validation ---

const BASE_DATA_PATH = './data';

// Updated SCHEMA_FILES array: Removed item/location, added component schemas
const SCHEMA_FILES = [
    'common.schema.json',
    'event-definition.schema.json',
    'action-definition.schema.json',
    'entity.schema.json', // Main generic entity schema
    'interaction-test.schema.json',
    'connection.schema.json',
    'quest.schema.json',
    'objective.schema.json',
    'world-manifest.schema.json',
    'container.schema.json',
    'lockable.schema.json',
    'effect.schema.json',
    'openable.schema.json',
    'edible.schema.json',
    'pushable.schema.json',
    'liquid-container.schema.json',
    'breakable.schema.json',
    'component-definition.schema.json',
    // Added component schemas (assuming they are directly loaded/needed)
    'item-component.schema.json', // From Ticket 1.2.2
    'usable.schema.json', // From Ticket 1.2.3
    'equippable.schema.json', // From Ticket 1.2.3
];

// Updated CONTENT_TYPE_SCHEMAS map: items and locations now point to the generic entity schema ID
const CONTENT_TYPE_SCHEMAS = {
    common: 'http://example.com/schemas/common.schema.json',
    actions: 'http://example.com/schemas/action-definition.schema.json',
    events: 'http://example.com/schemas/event-definition.schema.json',
    entities: 'http://example.com/schemas/entity.schema.json', // For player/NPC entities listed under "entities"
    items: 'http://example.com/schemas/entity.schema.json', // Updated: Use generic entity schema
    locations: 'http://example.com/schemas/entity.schema.json', // Updated: Use generic entity schema
    connections: 'http://example.com/schemas/connection.schema.json', // Uses its own specific entity schema
    blockers: 'http://example.com/schemas/entity.schema.json', // Assumed to be generic entities
    objectives: 'http://example.com/schemas/objective.schema.json',
    quests: 'http://example.com/schemas/quest.schema.json',
    interactionTests: 'http://example.com/schemas/interaction-test.schema.json',
    manifest: 'http://example.com/schemas/world-manifest.schema.json', // Schema for the manifest itself
    // Component schemas (these are loaded but typically not assigned as a 'content type' schema directly)
    // Keep other potential entity sub-type schemas if they exist and weren't consolidated yet
    components: 'http://example.com/schemas/component-definition.schema.json',
    // Note: The specific component schemas like item-component, usable, equippable are in SCHEMA_FILES
    // but usually don't need entries here unless there's a content type named 'item-components' etc.
};

// --- Static Configuration Class ---

/**
 * Provides hardcoded configuration values based on the legacy GameDataRepository constants.
 * This implementation fulfills the IConfiguration interface for initial refactoring steps.
 * Future implementations might load configuration from files or environment variables.
 *
 * @implements {IConfiguration}
 */
class StaticConfiguration {
    /**
     * @private
     * @type {string}
     * @description The root path for game data.
     */
    #baseDataPath = BASE_DATA_PATH;

    /**
     * @private
     * @type {string[]}
     * @description List of schema filenames to be loaded.
     */
    #schemaFiles = SCHEMA_FILES; // Uses the updated array

    /**
     * @private
     * @type {Record<string, string>}
     * @description Mapping of content type names (from manifest) to their schema $ids.
     */
    #contentTypeSchemas = CONTENT_TYPE_SCHEMAS; // Uses the updated map

    /**
     * @private
     * @type {string}
     * @description The specific schema $id for validating world manifest files.
     */
    #manifestSchemaId = CONTENT_TYPE_SCHEMAS.manifest;

    /**
     * Returns the root path where all game data (worlds, schemas, content) is located.
     * @override
     * @returns {string} The base data path (e.g., './data').
     */
    getBaseDataPath() {
        return this.#baseDataPath;
    }

    /**
     * Returns a list of schema filenames that should be loaded.
     * Returns a copy to prevent external modification of the internal list.
     * @override
     * @returns {string[]} A new array containing the schema filenames.
     */
    getSchemaFiles() {
        // Returns a copy of the updated #schemaFiles array
        return [...this.#schemaFiles];
    }

    /**
     * Returns the schema ID (e.g., the `$id` value) associated with a given content type name.
     * @override
     * @param {string} typeName - The content type name (e.g., 'entities', 'items', 'actions').
     * @returns {string | undefined} The schema ID string if found, otherwise undefined.
     */
    getContentTypeSchemaId(typeName) {
        // Correctly uses the updated #contentTypeSchemas map
        return this.#contentTypeSchemas[typeName];
    }

    /**
     * Returns the schema ID used specifically for validating world manifest files.
     * @override
     * @returns {string} The manifest schema ID.
     */
    getManifestSchemaId() {
        return this.#manifestSchemaId;
    }

    /**
     * Returns the path where schema files are stored, relative to the base data path.
     * @override
     * @returns {string} The schema base path (e.g., './data/schemas').
     */
    getSchemaBasePath() {
        return `${this.#baseDataPath}/schemas`;
    }

    /**
     * Returns the path where content definition files for a specific type are stored,
     * relative to the base data path.
     * @override
     * @param {string} typeName - The content type name (e.g., 'items', 'actions').
     * @returns {string} The content base path for the given type (e.g., './data/items').
     */
    getContentBasePath(typeName) {
        return `${this.#baseDataPath}/${typeName}`;
    }

    /**
     * Returns the path where world manifest files (`.world.json`) are stored,
     * relative to the base data path.
     * @override
     * @returns {string} The world base path (e.g., './data/worlds').
     */
    getWorldBasePath() {
        return `${this.#baseDataPath}/worlds`;
    }
}

// Export the class as the default export for this module
export default StaticConfiguration;

// JSDoc type import for interface reference - helps tools understand @implements
/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 */