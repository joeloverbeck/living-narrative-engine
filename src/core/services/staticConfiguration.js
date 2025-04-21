/**
 * @fileoverview Implements the IConfiguration interface by providing
 * hardcoded configuration values, primarily sourced from the legacy
 * constants in the original GameDataRepository.js. This serves as an initial,
 * static configuration provider during the refactoring process.
 */

// JSDoc type import for interface reference - helps tools understand @implements
/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 */

// --- Constants reflecting consolidated entity validation ---

const BASE_DATA_PATH = './data';

// Updated SCHEMA_FILES array: Includes component-definition schema, specific component schemas removed
// as they are now defined via component definition files themselves.
const SCHEMA_FILES = [
    'common.schema.json',
    'event-definition.schema.json', // Needed for event definition loading
    'action-definition.schema.json', // Needed for action definition loading
    'entity.schema.json',            // Main generic entity schema (for items, locations, NPCs etc.)
    'interaction-test.schema.json',  // Needed for interaction test loading
    'connection.schema.json',        // Needed for connection loading
    'quest.schema.json',             // Needed for quest loading
    'objective.schema.json',         // Needed for objective loading
    'world-manifest.schema.json',    // Needed for manifest loading
    'component-definition.schema.json' // Core schema for validating component definition files
    // Individual component schemas (like health, openable, etc.) are NO LONGER listed here.
    // Their structure is defined within their respective *.component.json files.
];

// Updated CONTENT_TYPE_SCHEMAS map:
// - items, locations, blockers etc. point to the generic entity schema ID.
// - Added 'components' entry pointing to the component-definition schema ID.
//   This is used to validate the *definition* files themselves.
const CONTENT_TYPE_SCHEMAS = {
    common: 'http://example.com/schemas/common.schema.json',
    actions: 'http://example.com/schemas/action-definition.schema.json',
    events: 'http://example.com/schemas/event-definition.schema.json',
    entities: 'http://example.com/schemas/entity.schema.json', // For player/NPC entities listed under "entities"
    items: 'http://example.com/schemas/entity.schema.json',    // Updated: Use generic entity schema
    locations: 'http://example.com/schemas/entity.schema.json',// Updated: Use generic entity schema
    connections: 'http://example.com/schemas/connection.schema.json', // Uses its own specific schema
    blockers: 'http://example.com/schemas/entity.schema.json', // Assumed to be generic entities
    objectives: 'http://example.com/schemas/objective.schema.json',
    quests: 'http://example.com/schemas/quest.schema.json',
    interactionTests: 'http://example.com/schemas/interaction-test.schema.json',
    manifest: 'http://example.com/schemas/world-manifest.schema.json', // Schema for the manifest itself
    /**
     * Schema ID used specifically for validating component *definition* files
     * (*.component.json) during the loading process. It validates the structure
     * containing 'id', 'description', and 'dataSchema'.
     */
    components: 'http://example.com/schemas/component-definition.schema.json'
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
     * @description List of core schema filenames that should be loaded by SchemaLoader.
     */
    #schemaFiles = SCHEMA_FILES; // Uses the updated array

    /**
     * @private
     * @type {Record<string, string>}
     * @description Mapping of content type names (from manifest or loader context) to their schema $ids.
     * Used for validating manifest-listed content files (items, actions, etc.)
     * and also for validating component definition files themselves (using 'components' key).
     */
    #contentTypeSchemas = CONTENT_TYPE_SCHEMAS; // Uses the updated map

    /**
     * @private
     * @type {string}
     * @description The specific schema $id for validating world manifest files.
     */
    #manifestSchemaId = CONTENT_TYPE_SCHEMAS.manifest;

    /**
     * Returns the root path where all game data (worlds, schemas, content, components) is located.
     * @override
     * @returns {string} The base data path (e.g., './data').
     */
    getBaseDataPath() {
        return this.#baseDataPath;
    }

    /**
     * Returns a list of core schema filenames that should be loaded by SchemaLoader.
     * Returns a copy to prevent external modification of the internal list.
     * Note: This list does NOT include individual component data schemas, only foundational ones
     * like entity.schema.json, common.schema.json, and component-definition.schema.json.
     * @override
     * @returns {string[]} A new array containing the core schema filenames.
     */
    getSchemaFiles() {
        // Returns a copy of the updated #schemaFiles array
        return [...this.#schemaFiles];
    }

    /**
     * Returns the schema ID (e.g., the `$id` value) associated with a given content type name.
     * This is used to determine which schema to use for validating:
     * 1. Content files listed in the world manifest (e.g., 'items', 'actions').
     * 2. Component definition files themselves (when typeName is 'components').
     *
     * @override
     * @param {string} typeName - The content type name (e.g., 'entities', 'items', 'actions', 'components').
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
     * Returns the path where core schema files are stored, relative to the base data path.
     * @override
     * @returns {string} The schema base path (e.g., './data/schemas').
     */
    getSchemaBasePath() {
        return `${this.#baseDataPath}/schemas`;
    }

    /**
     * Returns the base path where content definition files for a specific type are stored,
     * relative to the base data path. This is used for:
     * 1. Locating content files listed in the manifest (e.g., typeName 'items' -> './data/items').
     * 2. Locating component definition files (e.g., typeName 'components' -> './data/components').
     *
     * @override
     * @param {string} typeName - The content type name (e.g., 'items', 'actions', 'components').
     * @returns {string} The content base path for the given type (e.g., './data/items', './data/components').
     */
    getContentBasePath(typeName) {
        // This generic implementation now correctly handles 'components' alongside other types.
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