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
  'applyDamage.schema.json',
  'atomicModifyComponent.schema.json',
  'autoMoveClosenessPartners.schema.json',
  'autoMoveFollowers.schema.json',
  'breakBidirectionalCloseness.schema.json',
  'breakClosenessWithTarget.schema.json',
  'breakFollowRelation.schema.json',
  'checkFollowCycle.schema.json',
  'depleteOxygen.schema.json',
  'dispatchEvent.schema.json',
  'dispatchPerceptibleEvent.schema.json',
  'dispatchSpeech.schema.json',
  'dispatchThought.schema.json',
  'drinkEntirely.schema.json',
  'drinkFrom.schema.json',
  'dropItemAtLocation.schema.json',
  'endTurn.schema.json',
  'equipClothing.schema.json',
  'establishBidirectionalCloseness.schema.json',
  'establishFollowRelation.schema.json',
  'establishLyingCloseness.schema.json',
  'establishSittingCloseness.schema.json',
  'forEach.schema.json',
  'getDamageCapabilities.schema.json',
  'getName.schema.json',
  'getTimestamp.schema.json',
  'hasComponent.schema.json',
  'if.schema.json',
  'ifCoLocated.schema.json',
  'lockGrabbing.schema.json',
  'lockMouthEngagement.schema.json',
  'lockMovement.schema.json',
  'log.schema.json',
  'math.schema.json',
  'mergeClosenessCircle.schema.json',
  'modifyArrayField.schema.json',
  'modifyComponent.schema.json',
  'modifyContextArray.schema.json',
  'modifyPartHealth.schema.json',
  'openContainer.schema.json',
  'pickRandomArrayElement.schema.json',
  'pickRandomEntity.schema.json',
  'pickUpItemFromLocation.schema.json',
  'prepareActionContext.schema.json',
  'putInContainer.schema.json',
  'queryComponent.schema.json',
  'queryComponents.schema.json',
  'queryEntities.schema.json',
  'queryLookup.schema.json',
  'rebuildLeaderListCache.schema.json',
  'regenerateDescription.schema.json',
  'removeComponent.schema.json',
  'removeFromClosenessCircle.schema.json',
  'removeLyingCloseness.schema.json',
  'removeSittingCloseness.schema.json',
  'resolveDirection.schema.json',
  'resolveHitLocation.schema.json',
  'resolveOutcome.schema.json',
  'restoreOxygen.schema.json',
  'setVariable.schema.json',
  'systemMoveEntity.schema.json',
  'takeFromContainer.schema.json',
  'transferItem.schema.json',
  'unequipClothing.schema.json',
  'unlockGrabbing.schema.json',
  'unlockMouthEngagement.schema.json',
  'unlockMovement.schema.json',
  'unwieldItem.schema.json',
  'updatePartHealthState.schema.json',
  'validateContainerCapacity.schema.json',
  'validateInventoryCapacity.schema.json',
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

  /** @param {string} registryKey */
  getContentBasePath(registryKey) {
    return registryKey;
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
    return 'mod-manifest.json';
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
      'json-logic.schema.json',
      'condition-container.schema.json',
      'action.schema.json',
      'action-result.schema.json',
      'component.schema.json',
      'condition.schema.json',
      'damage-type.schema.json',
      'status-effect.registry.schema.json',
      'damage-capability-entry.schema.json',
      'entity-definition.schema.json', // CORRECTED
      'entity-instance.schema.json', // CORRECTED
      'event.schema.json',
      'game.schema.json',
      'goal.schema.json',
      'task.schema.json', // GOAP planning task schema
      'refinement-method.schema.json', // GOAP refinement method schema
      'mod-manifest.schema.json',
      'nested-operation.schema.json',
      'operation.schema.json',
      'rule.schema.json',
      'llm-configs.schema.json',
      'prompt-text.schema.json',
      'macro.schema.json',
      'ui-icons.schema.json',
      'ui-labels.schema.json',
      'world.schema.json',
      'lookup.schema.json',
      'anatomy.recipe.schema.json',
      'anatomy.blueprint.schema.json',
      'anatomy.blueprint-part.schema.json',
      'anatomy.slot-library.schema.json',
      'anatomy.structure-template.schema.json',
      'anatomy-formatting.schema.json',
      'target-context.schema.json',
      'thematic-direction.schema.json', // Character builder thematic direction schema
      'base-operation.schema.json', // Base schema for all operations
      'trace-config.schema.json', // Trace configuration schema
      'actionTraceConfig.schema.json', // Action trace configuration schema
      // Prepend the 'operations/' subdirectory to each operation schema file
      ...OPERATION_SCHEMA_FILES.map((file) => `operations/${file}`),
    ];
  }

  /**
   * @param    {string} registryKey
   * @returns  {string|null|undefined}
   */
  getContentTypeSchemaId(registryKey) {
    const map = {
      components: 'schema://living-narrative-engine/component.schema.json',
      actions: 'schema://living-narrative-engine/action.schema.json',
      events: 'schema://living-narrative-engine/event.schema.json',
      conditions: 'schema://living-narrative-engine/condition.schema.json',
      damageTypes: 'schema://living-narrative-engine/damage-type.schema.json',
      macros: 'schema://living-narrative-engine/macro.schema.json',
      rules: 'schema://living-narrative-engine/rule.schema.json',
      goals: 'schema://living-narrative-engine/goal.schema.json',
      entityDefinitions:
        'schema://living-narrative-engine/entity-definition.schema.json',
      entityInstances:
        'schema://living-narrative-engine/entity-instance.schema.json',
      'llm-configs': 'schema://living-narrative-engine/llm-configs.schema.json',
      'mod-manifest':
        'schema://living-narrative-engine/mod-manifest.schema.json',
      game: 'schema://living-narrative-engine/game.schema.json',
      world: 'schema://living-narrative-engine/world.schema.json',
      'prompt-text': 'schema://living-narrative-engine/prompt-text.schema.json',
      lookups: 'schema://living-narrative-engine/lookup.schema.json',
      statusEffects:
        'schema://living-narrative-engine/status-effect.registry.schema.json',
      anatomyRecipes:
        'schema://living-narrative-engine/anatomy.recipe.schema.json',
      anatomyBlueprints:
        'schema://living-narrative-engine/anatomy.blueprint.schema.json',
      anatomyBlueprintParts:
        'schema://living-narrative-engine/anatomy.blueprint-part.schema.json',
      anatomySlotLibraries:
        'schema://living-narrative-engine/anatomy.slot-library.schema.json',
      anatomyFormatting:
        'schema://living-narrative-engine/anatomy-formatting.schema.json',
      anatomyStructureTemplates:
        'schema://living-narrative-engine/anatomy.structure-template.schema.json',
      'thematic-direction':
        'schema://living-narrative-engine/thematic-direction.schema.json',
      tasks: 'schema://living-narrative-engine/task.schema.json',
      'refinement-methods':
        'schema://living-narrative-engine/refinement-method.schema.json',
      // Scopes use a custom DSL format (.scope files) and are validated by the scope engine,
      // not by JSON schema validation. Explicitly return null to indicate no schema validation.
      scopes: null,
    };
    return map[registryKey];
  }

  /* ─────────────────────────────── OTHER IDS ─────────────────────────────── */

  /** @returns {string} */
  getRuleSchemaId() {
    return 'schema://living-narrative-engine/rule.schema.json';
  }
}

export default StaticConfiguration;
