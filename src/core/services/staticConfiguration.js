// src/core/services/staticConfiguration.js

/**
 * @fileoverview Implements the IConfiguration interface by providing
 * hardcoded configuration values, primarily sourced from the legacy
 * constants in the original GameDataRepository.js. This serves as an initial,
 * static configuration provider during the refactoring process.
 */

// --- Constants copied from GameDataRepository.js ---

const BASE_DATA_PATH = './data';

const SCHEMA_FILES = [
    'common.schema.json',
    'event-definition.schema.json',
    'action-definition.schema.json',
    'entity.schema.json',
    'interaction-test.schema.json',
    'item.schema.json',
    'location.schema.json',
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
];

const CONTENT_TYPE_SCHEMAS = {
    common: 'http://example.com/schemas/common.schema.json',
    actions: 'http://example.com/schemas/action-definition.schema.json',
    events: 'http://example.com/schemas/event-definition.schema.json',
    entities: 'http://example.com/schemas/entity.schema.json', // For player/NPC entities listed under "entities"
    items: 'http://example.com/schemas/item.schema.json', // For items listed under "items"
    locations: 'http://example.com/schemas/location.schema.json', // For locations listed under "locations"
    connections: 'http://example.com/schemas/connection.schema.json',
    blockers: 'http://example.com/schemas/entity.schema.json',
    objectives: 'http://example.com/schemas/objective.schema.json', // For objectives listed under "objectives"
    quests: 'http://example.com/schemas/quest.schema.json', // For quests listed under "quests"
    interactionTests: 'http://example.com/schemas/interaction-test.schema.json', // For tests listed under "interactionTests"
    manifest: 'http://example.com/schemas/world-manifest.schema.json', // Schema for the manifest itself
    containers: 'http://example.com/schemas/container.schema.json',
    lockables: 'http://example.com/schemas/lockable.schema.json',
    openables: 'http://example.com/schemas/openable.schema.json',
    edibles: 'http://example.com/schemas/edible.schema.json',
    pushables: 'http://example.com/schemas/pushable.schema.json',
    liquidContainers: 'http://example.com/schemas/liquid-container.schema.json',
    breakables: 'http://example.com/schemas/breakable.schema.json',
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
    #schemaFiles = SCHEMA_FILES;

    /**
     * @private
     * @type {Record<string, string>}
     * @description Mapping of content type names (from manifest) to their schema $ids.
     */
    #contentTypeSchemas = CONTENT_TYPE_SCHEMAS;

    /**
     * @private
     * @type {string}
     * @description The specific schema $id for validating world manifest files.
     */
    #manifestSchemaId = CONTENT_TYPE_SCHEMAS.manifest; // Extracted as requested

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
        // Return a copy as required by the ticket to prevent mutation
        return [...this.#schemaFiles];
    }

    /**
     * Returns the schema ID (e.g., the `$id` value) associated with a given content type name.
     * @override
     * @param {string} typeName - The content type name (e.g., 'entities', 'items', 'actions').
     * @returns {string | undefined} The schema ID string if found, otherwise undefined.
     */
    getContentTypeSchemaId(typeName) {
        // Object property access returns undefined if the key doesn't exist, fulfilling the requirement.
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