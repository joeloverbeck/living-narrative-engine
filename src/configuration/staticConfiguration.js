// src/configuration/staticConfiguration.js

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */

/**
 * Provides static configuration values for the application.
 * Implements the IConfiguration interface.
 * In a real application, this might load from a file or environment variables.
 *
 * @implements {IConfiguration}
 */
class StaticConfiguration {
  #baseDataPath = './data'; // Base path relative to execution

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
  getRuleBasePath() {
    return 'rules';
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
   *
   * @returns {string[]}
   */
  getSchemaFiles() {
    return [
      'common.schema.json',
      'action-definition.schema.json',
      'action-result.schema.json',
      'component-definition.schema.json',
      'entity.schema.json',
      'event-definition.schema.json',
      'game.schema.json',
      'json-logic.schema.json',
      'mod.manifest.schema.json',
      'operation.schema.json',
      'rule.schema.json',
      'llm-configs.schema.json',
    ];
  }

  /**
   * Maps logical content-type names to their canonical $id values.
   *
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
      'mod-manifest': 'http://example.com/schemas/mod.manifest.schema.json',
      operations: 'http://example.com/schemas/operation.schema.json',
      rules: 'http://example.com/schemas/rule.schema.json',
      'llm-configs': 'http://example.com/schemas/llm-configs.schema.json',
    };
    return map[typeName];
  }

  /* ─────────────────────────────── OTHER IDS ─────────────────────────────── */

  /** @returns {string} */
  getRuleSchemaId() {
    return 'http://example.com/schemas/rule.schema.json';
  }
}

export default StaticConfiguration;
