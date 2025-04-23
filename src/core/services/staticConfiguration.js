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

// Updated SCHEMA_FILES array:
// - Removed 'connection.schema.json'
// - component-definition.schema.json is essential for loading component definitions.
const SCHEMA_FILES = [
    'common.schema.json',
    'event-definition.schema.json',
    'action-definition.schema.json',
    'entity.schema.json',            // Main generic entity schema (for items, locations, NPCs, connections, etc.)
    'interaction-test.schema.json',
    // 'connection.schema.json',     // REMOVED
    'quest.schema.json',
    'objective.schema.json',
    'world-manifest.schema.json',
    'component-definition.schema.json', // Core schema for validating component definition files
    'json-logic.schema.json',
    'system-rule.schema.json',
    'operation.schema.json',
];

// Updated CONTENT_TYPE_SCHEMAS map:
// - 'connections' now points to the generic 'entity.schema.json' ID.
const CONTENT_TYPE_SCHEMAS = {
    common: 'http://example.com/schemas/common.schema.json',
    actions: 'http://example.com/schemas/action-definition.schema.json',
    events: 'http://example.com/schemas/event-definition.schema.json',
    entities: 'http://example.com/schemas/entity.schema.json',   // For player/NPC entities
    items: 'http://example.com/schemas/entity.schema.json',      // Items are generic entities
    locations: 'http://example.com/schemas/entity.schema.json',  // Locations are generic entities
    connections: 'http://example.com/schemas/entity.schema.json',// UPDATED: Connections are generic entities
    blockers: 'http://example.com/schemas/entity.schema.json',   // Blockers are generic entities
    objectives: 'http://example.com/schemas/objective.schema.json',
    quests: 'http://example.com/schemas/quest.schema.json',
    interactionTests: 'http://example.com/schemas/interaction-test.schema.json',
    manifest: 'http://example.com/schemas/world-manifest.schema.json',
    components: 'http://example.com/schemas/component-definition.schema.json' // Schema for component definition files
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
     * @description Mapping of content type names to their schema $ids.
     */
    #contentTypeSchemas = CONTENT_TYPE_SCHEMAS; // Uses the updated map

    /**
     * @private
     * @type {string}
     * @description The specific schema $id for validating world manifest files.
     */
    #manifestSchemaId = CONTENT_TYPE_SCHEMAS.manifest;

    /**
     * Returns the root path where all game data is located.
     * @override
     * @returns {string}
     */
    getBaseDataPath() {
        return this.#baseDataPath;
    }

    /**
     * Returns a list of core schema filenames.
     * @override
     * @returns {string[]}
     */
    getSchemaFiles() {
        return [...this.#schemaFiles]; // Return a copy
    }

    /**
     * Returns the schema ID associated with a given content type name.
     * @override
     * @param {string} typeName
     * @returns {string | undefined}
     */
    getContentTypeSchemaId(typeName) {
        return this.#contentTypeSchemas[typeName];
    }

    /**
     * Returns the schema ID used for validating world manifest files.
     * @override
     * @returns {string}
     */
    getManifestSchemaId() {
        return this.#manifestSchemaId;
    }

    /**
     * Returns the path where core schema files are stored.
     * @override
     * @returns {string}
     */
    getSchemaBasePath() {
        return `${this.#baseDataPath}/schemas`;
    }

    /**
     * Returns the base path where content definition files for a specific type are stored.
     * @override
     * @param {string} typeName
     * @returns {string}
     */
    getContentBasePath(typeName) {
        // Handles 'components' -> './data/components', 'items' -> './data/items', etc.
        return `${this.#baseDataPath}/${typeName}`;
    }

    /**
     * Returns the path where world manifest files are stored.
     * @override
     * @returns {string}
     */
    getWorldBasePath() {
        return `${this.#baseDataPath}/worlds`;
    }
}

// Export the class as the default export for this module
export default StaticConfiguration;