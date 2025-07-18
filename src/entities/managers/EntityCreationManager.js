/**
 * @file EntityCreationManager - Handles entity creation and reconstruction
 * @module EntityCreationManager
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { SerializedEntityError } from '../../errors/serializedEntityError.js';

/** @typedef {import('../entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../services/entityLifecycleManager.js').default} EntityLifecycleManager */

/**
 * @class EntityCreationManager
 * @description Specialized manager for entity creation and reconstruction operations
 */
export default class EntityCreationManager {
  /** @type {EntityLifecycleManager} @private */
  #lifecycleManager;
  /** @type {ILogger} @private */
  #logger;

  /**
   * @class
   * @param {object} deps - Dependencies
   * @param {EntityLifecycleManager} deps.lifecycleManager - Entity lifecycle manager
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ lifecycleManager, logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityCreationManager');

    validateDependency(
      lifecycleManager,
      'EntityLifecycleManager',
      this.#logger,
      {
        requiredMethods: ['createEntityInstance', 'reconstructEntity'],
      }
    );
    this.#lifecycleManager = lifecycleManager;

    this.#logger.debug('EntityCreationManager initialized.');
  }

  /**
   * Create a new entity instance from a definition.
   *
   * @param {string} definitionId - The ID of the entity definition to use.
   * @param {object} opts - Options for entity creation.
   * @param {string} [opts.instanceId] - Optional. A specific ID for the new instance.
   * @param {Object<string, object>} [opts.componentOverrides] - Optional. Component data to override or add.
   * @returns {Promise<Entity>} The newly created entity instance.
   * @throws {DefinitionNotFoundError} If the definition is not found.
   * @throws {DuplicateEntityError} If an entity with the given instanceId already exists.
   * @throws {InvalidArgumentError} If definitionId is invalid.
   * @throws {ValidationError} If component data validation fails.
   */
  async createEntityInstance(definitionId, opts = {}) {
    this.#logger.debug(
      `EntityCreationManager.createEntityInstance: Creating entity with definition '${definitionId}'`
    );

    return await this.#lifecycleManager.createEntityInstance(definitionId, opts);
  }

  /**
   * Reconstructs an entity instance from a plain serializable object.
   *
   * @param {object} serializedEntity - Plain object from a save file.
   * @param {string} serializedEntity.instanceId
   * @param {string} serializedEntity.definitionId
   * @param {Record<string, object>} [serializedEntity.overrides]
   * @returns {Entity} The reconstructed Entity instance.
   * @throws {DefinitionNotFoundError} If the entity definition is not found.
   * @throws {DuplicateEntityError} If an entity with the given ID already exists.
   * @throws {ValidationError} If component data validation fails.
   * @throws {Error} If serializedEntity data is invalid.
   */
  reconstructEntity(serializedEntity) {
    if (!serializedEntity || typeof serializedEntity !== 'object') {
      throw new SerializedEntityError(
        'EntityCreationManager.reconstructEntity: serializedEntity must be an object.'
      );
    }

    this.#logger.debug(
      `EntityCreationManager.reconstructEntity: Reconstructing entity with ID '${serializedEntity?.instanceId}'`
    );

    return this.#lifecycleManager.reconstructEntity(serializedEntity);
  }
}
