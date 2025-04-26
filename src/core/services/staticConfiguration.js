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
    #baseDataPath = './data';   // Base path relative to execution

    /* ─────────────────────────────── BASE PATHS ────────────────────────────── */

    /** @returns {string} */
    getBaseDataPath() {
        return this.#baseDataPath;
    }

    /** @returns {string} */
    getSchemaBasePath() {
        return 'schemas';
    }

    /** @param {string} typeName */
    getContentBasePath(typeName) {
        return typeName;
    }

    /** @returns {string} */
    getWorldBasePath() {
        return 'worlds';
    }

    /** @returns {string} */
    getRuleBasePath() {
        return 'system-rules';
    }

    /* ─────────────────────────────── FILENAMES ─────────────────────────────── */

    /** @returns {string} */
    getGameConfigFilename() {
        return 'game.json';
    }

    /** @returns {string} */
    getModManifestFilename() {
        return 'mod.manifest.json';
    }

    /* ─────────────────────────────── MODS PATH ─────────────────────────────── */

    /** @returns {string} */
    getModsBasePath() {
        return 'mods';
    }

    /* ─────────────────────────────── SCHEMAS ───────────────────────────────── */

    /**
     * Enumerates every JSON-Schema file that must be pre-compiled.
     * @returns {string[]}
     */
    getSchemaFiles() {
        return [
            'common.schema.json',
            'action-definition.schema.json',
            'component-definition.schema.json',
            'entity.schema.json',
            'event-definition.schema.json',
            'game.schema.json',
            'json-logic.schema.json',
            'mod.manifest.schema.json',          // ← NEW schema added
            'operation.schema.json',
            'system-rule.schema.json',
        ];
    }

    /**
     * Maps logical content-type names to their canonical $id values.
     * @param   {string} typeName
     * @returns {string|undefined}
     */
    getContentTypeSchemaId(typeName) {
        const map = {
            actions: 'http://example.com/schemas/action-definition.schema.json',
            blockers: 'http://example.com/schemas/entity.schema.json',
            components: 'http://example.com/schemas/component-definition.schema.json',
            connections: 'http://example.com/schemas/entity.schema.json',
            entities: 'http://example.com/schemas/entity.schema.json',
            events: 'http://example.com/schemas/event-definition.schema.json',
            game: 'http://example.com/schemas/game.schema.json',
            items: 'http://example.com/schemas/entity.schema.json',
            locations: 'http://example.com/schemas/entity.schema.json',
            'mod-manifest': 'http://example.com/schemas/mod.manifest.schema.json', // ← NEW mapping
            operations: 'http://example.com/schemas/operation.schema.json',
            'system-rules': 'http://example.com/schemas/system-rule.schema.json',
        };
        return map[typeName];
    }

    /* ─────────────────────────────── OTHER IDS ─────────────────────────────── */

    /** @returns {string} */
    getRuleSchemaId() {
        return 'http://example.com/schemas/system-rule.schema.json';
    }

}

export default StaticConfiguration;