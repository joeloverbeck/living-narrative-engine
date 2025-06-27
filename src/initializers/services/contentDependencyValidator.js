// src/initializers/services/contentDependencyValidator.js

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */

/**
 * @description Validates content dependencies for a world by ensuring that
 * entity instances reference existing definitions and that exit targets and
 * blockers correspond to spawned instances.
 */
import IContentDependencyValidator from '../../interfaces/IContentDependencyValidator.js';

class ContentDependencyValidator extends IContentDependencyValidator {
  /** @type {ILogger} */
  #logger;
  /** @type {IGameDataRepository} */
  #gameDataRepository;

  /**
   * Creates an instance of ContentDependencyValidator.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {IGameDataRepository} deps.gameDataRepository - Repository providing entity and world data.
   * @param {ILogger} deps.logger - Logger for debug and error output.
   */
  constructor({ gameDataRepository, logger } = {}) {
    super();
    this.#gameDataRepository = gameDataRepository;
    this.#logger = logger;
  }

  /**
   * Performs dependency validation for the specified world.
   *
   * @param {string} worldName - Target world name for spawn checks.
   * @returns {Promise<void>} Resolves when validation completes.
   */
  async validate(worldName) {
    this.#logger?.debug(
      'ContentDependencyValidator: Validating content dependencies...'
    );

    if (
      !this.#gameDataRepository ||
      typeof this.#gameDataRepository.getAllEntityInstanceDefinitions !==
        'function' ||
      typeof this.#gameDataRepository.getAllEntityDefinitions !== 'function' ||
      typeof this.#gameDataRepository.getWorld !== 'function'
    ) {
      this.#logger?.warn(
        'Content dependency validation skipped: gameDataRepository lacks required methods.'
      );
      return;
    }

    const instanceDefs =
      this.#gameDataRepository.getAllEntityInstanceDefinitions();
    const definitionIds = new Set(
      this.#gameDataRepository.getAllEntityDefinitions().map((d) => d.id)
    );

    this.#validateInstanceDefinitions(instanceDefs, definitionIds);

    const instanceIdSet = new Set(instanceDefs.map((i) => i.instanceId));
    const worldDef = this.#gameDataRepository.getWorld(worldName);
    const worldSpawnSet = new Set();
    if (worldDef && Array.isArray(worldDef.instances)) {
      for (const { instanceId } of worldDef.instances) {
        if (typeof instanceId === 'string') worldSpawnSet.add(instanceId);
      }
    }

    const entityDefs = this.#gameDataRepository.getAllEntityDefinitions();
    this.#validateExits(entityDefs, instanceIdSet, worldSpawnSet, worldName);

    this.#logger?.debug(
      'ContentDependencyValidator: Content dependency validation complete.'
    );
  }

  /**
   * @description Checks that each instance references an existing definition.
   * @param {Array<{instanceId: string, definitionId: string}>} instanceDefs -
   *   All entity instance definitions.
   * @param {Set<string>} definitionIds - Set of available definition IDs.
   * @returns {void}
   */
  #validateInstanceDefinitions(instanceDefs, definitionIds) {
    for (const inst of instanceDefs) {
      if (!definitionIds.has(inst.definitionId)) {
        this.#logger?.error(
          `Content Validation: Instance '${inst.instanceId}' references missing definition '${inst.definitionId}'.`
        );
      }
    }
  }

  /**
   * @description Validates exit targets and blockers against spawned instances.
   * @param {Array<object>} entityDefs - All entity definitions.
   * @param {Set<string>} instanceIdSet - All instance IDs across the game.
   * @param {Set<string>} worldSpawnSet - Instances spawned in the current world.
   * @param {string} worldName - Name of the world being validated.
   * @returns {void}
   */
  #validateExits(entityDefs, instanceIdSet, worldSpawnSet, worldName) {
    for (const def of entityDefs) {
      const exits = def?.components?.['core:exits'];
      if (Array.isArray(exits)) {
        for (const exit of exits) {
          const { target, blocker } = exit || {};
          if (target) {
            if (!instanceIdSet.has(target)) {
              this.#logger?.error(
                `Content Validation: Exit target '${target}' in definition '${def.id}' has no corresponding instance data.`
              );
            } else if (!worldSpawnSet.has(target)) {
              this.#logger?.error(
                `Content Validation: Exit target '${target}' in definition '${def.id}' is not spawned in world '${worldName}'.`
              );
            }
          }
          if (blocker) {
            if (!instanceIdSet.has(blocker)) {
              this.#logger?.error(
                `Content Validation: Exit blocker '${blocker}' in definition '${def.id}' has no corresponding instance data.`
              );
            } else if (!worldSpawnSet.has(blocker)) {
              this.#logger?.error(
                `Content Validation: Exit blocker '${blocker}' in definition '${def.id}' is not spawned in world '${worldName}'.`
              );
            }
          }
        }
      }
    }
  }
}

export default ContentDependencyValidator;
