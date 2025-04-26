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
            'game.schema.json',
            'json-logic.schema.json',
            'operation.schema.json',
            'system-rule.schema.json',
        ];
    }

    /**
     * Returns the schema ID (e.g., the `$id` value) associated with a given content type name.
     * This maps type names (like 'entities', 'items') to their validation schema IDs.
     * @param {string} typeName - The content type (e.g., 'entities', 'items', 'actions').
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
            'items': 'http://example.com/schemas/entity.schema.json',
            'locations': 'http://example.com/schemas/entity.schema.json',
            'operations': 'http://example.com/schemas/operation.schema.json',
            'system-rules': 'http://example.com/schemas/system-rule.schema.json',
            // Add other content types as needed
        };
        return map[typeName];
    }

    /**
     * Returns the path (relative to the `baseDataPath`) where schema files are stored.
     * @returns {string}
     */
    getSchemaBasePath() {
        // --- CORRECTED LINE ---
        // Assumes schemas are directly in a 'schemas' subdirectory of baseDataPath
        return `${this.getBaseDataPath()}/schemas`; // Prepend base path
    }

    /**
     * Returns the path (relative to the `baseDataPath`) where content definition files
     * for a specific type (e.g., 'items', 'actions') are stored.
     * @param {string} typeName - The content type name (e.g., 'items', 'actions').
     * @returns {string} The relative path to the content directory.
     */
    getContentBasePath(typeName) {
        // --- CORRECTED LINE ---
        // Assumes content types are stored in directories named after the typeName
        // within the baseDataPath.
        // Example: typeName 'items' -> path will be `${baseDataPath}/items`
        // String coercion will handle null/undefined correctly (e.g., `${basePath}/null`)
        return `${this.getBaseDataPath()}/${typeName}`; // Prepend base path
    }

    /**
     * Returns the path (relative to the `baseDataPath`) where world manifest files
     * (`.world.json`) are stored.
     * @returns {string}
     */
    getWorldBasePath() {
        // --- CORRECTED LINE ---
        // Assumes manifests are in a 'worlds' subdirectory of baseDataPath
        return `${this.getBaseDataPath()}/worlds`; // Prepend base path
    }

    /**
     * Returns the filename for the main game configuration file.
     * @returns {string} - e.g., "game.json"
     */
    getGameConfigFilename() {
        return 'game.json'; // <<< IMPLEMENTED for GameConfigLoader
    }

    /**
     * Returns the path (relative to the `baseDataPath`) where system rule files
     * are stored.
     * @returns {string}
     */
    getRuleBasePath() {
        // --- CORRECTION (Consistent with others, assuming relative path needed) ---
        // Assumes rules are in a 'system-rules' subdirectory
        // If this method is used elsewhere and expects *only* the subdirectory,
        // you might need to adjust calls to it or create a separate method.
        // However, based on the pattern, it likely needs the base path too.
        return `${this.getBaseDataPath()}/system-rules`;
    }

    /**
     * Returns the schema ID used for validating system rule files.
     * @returns {string}
     */
    getRuleSchemaId() {
        // Note: The original schema ID seemed potentially incorrect (game_rule vs system-rule)
        // Adjusted to potentially match naming conventions, but verify this ID is correct for your setup.
        // return 'http://example.com/schemas/game_rule.schema.json';
        return 'http://example.com/schemas/system-rule.schema.json'; // Or keep original if intended
    }
}

export default StaticConfiguration;