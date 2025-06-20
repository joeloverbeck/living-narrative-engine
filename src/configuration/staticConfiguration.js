/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */

/**
 * Provides static configuration values for the application.
 * Implements the IConfiguration interface.
 * In a real application, this might load from a file or environment variables.
 *
 * @implements {IConfiguration}
 */
const OPERATION_SCHEMA_FILES = [
  'addComponent.schema.json',
  'addPerceptionLogEntry.schema.json',
  'autoMoveFollowers.schema.json',
  'breakFollowRelation.schema.json',
  'checkFollowCycle.schema.json',
  'dispatchEvent.schema.json',
  'dispatchPerceptibleEvent.schema.json',
  'dispatchSpeech.schema.json',
  'endTurn.schema.json',
  'establishFollowRelation.schema.json',
  'forEach.schema.json',
  'getName.schema.json',
  'getTimestamp.schema.json',
  'hasComponent.schema.json',
  'if.schema.json',
  'ifCoLocated.schema.json',
  'log.schema.json',
  'math.schema.json',
  'mergeClosenessCircle.schema.json',
  'modifyArrayField.schema.json',
  'modifyComponent.schema.json',
  'modifyContextArray.schema.json',
  'queryComponent.schema.json',
  'queryComponents.schema.json',
  'queryEntities.schema.json',
  'rebuildLeaderListCache.schema.json',
  'removeComponent.schema.json',
  'removeFromClosenessCircle.schema.json',
  'resolveDirection.schema.json',
  'setVariable.schema.json',
  'systemMoveEntity.schema.json',
];

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
   * It returns the path relative to the schema base path.
   *
   * @returns {string[]}
   */
  getSchemaFiles() {
    return [
      'common.schema.json',
      'action.schema.json',
      'action-result.schema.json',
      'component.schema.json',
      'condition.schema.json',
      'condition-container.schema.json',
      'entity-definition.schema.json', // CORRECTED
      'entity-instance.schema.json', // CORRECTED
      'event.schema.json',
      'game.schema.json',
      'goal.schema.json',
      'json-logic.schema.json',
      'mod.manifest.schema.json',
      'operation.schema.json',
      'rule.schema.json',
      'llm-configs.schema.json',
      'prompt-text.schema.json',
      'macro.schema.json',
      'ui-icons.schema.json',
      'ui-labels.schema.json',
      // Prepend the 'operations/' subdirectory to each operation schema file
      ...OPERATION_SCHEMA_FILES.map((file) => `operations/${file}`),
    ];
  }

  /**
   * Maps logical content-type names to their canonical $id values.
   *
   * @param    {string} typeName
   * @returns {string|undefined}
   */
  getContentTypeSchemaId(typeName) {
    const map = {
      // --- CORE ---
      'mod-manifest': 'http://example.com/schemas/mod.manifest.schema.json',
      game: 'http://example.com/schemas/game.schema.json',

      // --- CONTENT TYPES ---
      actions: 'http://example.com/schemas/action.schema.json',
      components: 'http://example.com/schemas/component.schema.json',
      conditions: 'http://example.com/schemas/condition.schema.json',
      events: 'http://example.com/schemas/event.schema.json',
      goals: 'http://example.com/schemas/goal.schema.json',
      macros: 'http://example.com/schemas/macro.schema.json',
      rules: 'http://example.com/schemas/rule.schema.json',

      // --- ENTITY TYPES ---
      entityDefinitions:
        'http://example.com/schemas/entity-definition.schema.json',
      entityInstances: 'http://example.com/schemas/entity-instance.schema.json',

      // --- MISC ---
      operations: 'http://example.com/schemas/operation.schema.json',
      'llm-configs': 'http://example.com/schemas/llm-configs.schema.json',
      'prompt-text': 'http://example.com/schemas/prompt-text.schema.json',
      'ui-icons': 'http://example.com/schemas/ui-icons.schema.json',
      'ui-labels': 'http://example.com/schemas/ui-labels.schema.json',
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
