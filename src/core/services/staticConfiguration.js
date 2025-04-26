// src/core/services/staticConfiguration.js

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */

/**
 * Provides static configuration values for the application.
 * Implements the IConfiguration interface.
 * In a real application, this might load from a file or environment variables.
 * @implements {IConfiguration}
 */
class StaticConfiguration {
    /** @private @type {string} */
    #baseDataPath = './data'; // Base path relative to execution

    /**
     * Returns the root path where all game data (worlds, schemas, content) is located.
     * @returns {string}
     */
    getBaseDataPath() {
        return this.#baseDataPath;
    }

    /**
     * Returns a list of schema filenames that should be loaded.
     * These are typically core schemas needed for validation.
     * @returns {string[]}
     */
    getSchemaFiles() {
        // Define the core schemas needed by the application
        return [
            'common.schema.json',
            'action-definition.schema.json',
            'component-definition.schema.json',
            'entity.schema.json',
            'event-definition.schema.json',
            'game.schema.json', // <<< Already present, as required
            'json-logic.schema.json',
            'operation.schema.json',
            'system-rule.schema.json',
            'world.schema.json' // <<< ADDED missing world schema for ManifestLoader
        ];
    }

    /**
     * Returns the schema ID (e.g., the `$id` value) associated with a given content type name.
     * This maps type names (like 'entities', 'items') to their validation schema IDs.
     * @param {string} typeName - The content type (e.g., 'entities', 'items', 'actions', 'game').
     * @returns {string | undefined} The schema ID or undefined if not mapped.
     */
    getContentTypeSchemaId(typeName) {
        const map = {
            'actions': 'http://example.com/schemas/action-definition.schema.json',
            'blockers': 'http://example.com/schemas/entity.schema.json',
            'components': 'http://example.com/schemas/component-definition.schema.json',
            'connections': 'http://example.com/schemas/entity.schema.json',
            'entities': 'http://example.com/schemas/entity.schema.json',
            'events': 'http://example.com/schemas/event-definition.schema.json',
            'game': 'http://example.com/schemas/game.schema.json', // <<< ADDED mapping for 'game'
            'items': 'http://example.com/schemas/entity.schema.json',
            'locations': 'http://example.com/schemas/entity.schema.json',
            'operations': 'http://example.com/schemas/operation.schema.json',
            'system-rules': 'http://example.com/schemas/system-rule.schema.json',
            'world': 'http://example.com/schemas/world.schema.json', // <<< ADDED mapping for world manifest
            // Add other content types as needed
        };
        return map[typeName];
    }

    /**
     * Returns the path (relative to the `baseDataPath`) where schema files are stored.
     * @returns {string}
     */
    getSchemaBasePath() {
        // --- Kept logic as-is, assuming it's correct for the project structure ---
        return `schemas`; // Relative path to schemas subdirectory
    }

    /**
     * Returns the path (relative to the `baseDataPath`) where content definition files
     * for a specific type (e.g., 'items', 'actions') are stored.
     * @param {string} typeName - The content type name (e.g., 'items', 'actions').
     * @returns {string} The relative path to the content directory.
     */
    getContentBasePath(typeName) {
        // --- Kept logic as-is, assuming it's correct ---
        // Assumes content types are stored in directories named after the typeName
        // within the baseDataPath. Returns only the relative dir name.
        return typeName; // e.g., 'items', 'actions'
    }

    /**
     * Returns the path (relative to the `baseDataPath`) where world manifest files
     * (`.world.json`) are stored.
     * @returns {string}
     */
    getWorldBasePath() {
        // --- Kept logic as-is ---
        return `worlds`; // Relative path to worlds subdirectory
    }

    /**
     * Returns the filename for the main game configuration file.
     * @returns {string} - e.g., "game.json"
     */
    getGameConfigFilename() {
        return 'game.json';
    }

    /**
     * Returns the path (relative to the `baseDataPath`) where system rule files
     * are stored.
     * @returns {string}
     */
    getRuleBasePath() {
        // --- Kept logic as-is ---
        return `system-rules`;
    }

    /**
     * Returns the schema ID used for validating system rule files.
     * @returns {string}
     */
    getRuleSchemaId() {
        return 'http://example.com/schemas/system-rule.schema.json';
    }

    /**
     * Returns the schema ID used for validating world manifest files.
     * Needed by ManifestLoader.
     * @returns {string}
     */
    getManifestSchemaId() {
        return 'http://example.com/schemas/world.schema.json'; // <<< ADDED required method
    }
}

export default StaticConfiguration;