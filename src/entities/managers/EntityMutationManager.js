/**
 * @file EntityMutationManager - Handles component mutations and entity removal
 * @module EntityMutationManager
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { validateInstanceAndComponent } from '../../utils/idValidation.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../services/componentMutationService.js').default} ComponentMutationService */
/** @typedef {import('../services/entityLifecycleManager.js').default} EntityLifecycleManager */

/**
 * @class EntityMutationManager
 * @description Specialized manager for entity mutations and component operations
 */
export default class EntityMutationManager {
  /** @type {ComponentMutationService} */
  #componentMutationService;
  /** @type {EntityLifecycleManager} */
  #lifecycleManager;
  /** @type {ILogger} */
  #logger;

  /**
   * @class
   * @param {object} deps - Dependencies
   * @param {ComponentMutationService} deps.componentMutationService - Component mutation service
   * @param {EntityLifecycleManager} deps.lifecycleManager - Entity lifecycle manager
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ componentMutationService, lifecycleManager, logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityMutationManager');

    validateDependency(
      componentMutationService,
      'ComponentMutationService',
      this.#logger,
      {
        requiredMethods: ['addComponent', 'removeComponent'],
      }
    );
    this.#componentMutationService = componentMutationService;

    validateDependency(
      lifecycleManager,
      'EntityLifecycleManager',
      this.#logger,
      {
        requiredMethods: ['removeEntityInstance'],
      }
    );
    this.#lifecycleManager = lifecycleManager;

    this.#logger.debug('EntityMutationManager initialized.');
  }

  /**
   * Adds or updates a component on an existing entity instance.
   *
   * @param {string} instanceId - The ID of the entity instance.
   * @param {string} componentTypeId - The unique ID of the component type.
   * @param {object} componentData - The data for the component.
   * @returns {boolean} True if the component was added or updated successfully.
   * @throws {EntityNotFoundError} If entity not found.
   * @throws {InvalidArgumentError} If parameters are invalid.
   * @throws {ValidationError} If component data validation fails.
   */
  addComponent(instanceId, componentTypeId, componentData) {
    // Validate instanceId and componentTypeId
    validateInstanceAndComponent(
      instanceId,
      componentTypeId,
      this.#logger,
      'EntityMutationManager.addComponent'
    );

    if (!componentData || typeof componentData !== 'object') {
      throw new InvalidArgumentError(
        'EntityMutationManager.addComponent: componentData must be an object.'
      );
    }

    this.#logger.debug(
      `EntityMutationManager.addComponent: Adding component '${componentTypeId}' to entity '${instanceId}'`
    );

    return this.#componentMutationService.addComponent(
      instanceId,
      componentTypeId,
      componentData
    );
  }

  /**
   * Removes a component override from an existing entity instance.
   *
   * @param {string} instanceId - The ID of the entity instance.
   * @param {string} componentTypeId - The unique ID of the component type to remove.
   * @throws {EntityNotFoundError} If entity not found.
   * @throws {InvalidArgumentError} If parameters are invalid.
   * @throws {ComponentOverrideNotFoundError} If component override does not exist.
   * @throws {Error} If removal fails.
   */
  removeComponent(instanceId, componentTypeId) {
    // Validate instanceId and componentTypeId
    validateInstanceAndComponent(
      instanceId,
      componentTypeId,
      this.#logger,
      'EntityMutationManager.removeComponent'
    );

    this.#logger.debug(
      `EntityMutationManager.removeComponent: Removing component '${componentTypeId}' from entity '${instanceId}'`
    );

    this.#componentMutationService.removeComponent(instanceId, componentTypeId);
  }

  /**
   * Remove an entity instance from the manager.
   *
   * @param {string} instanceId - The ID of the entity instance to remove.
   * @throws {EntityNotFoundError} If the entity is not found.
   * @throws {InvalidArgumentError} If the instanceId is invalid.
   * @throws {Error} If internal removal operation fails.
   */
  removeEntityInstance(instanceId) {
    this.#logger.debug(
      `EntityMutationManager.removeEntityInstance: Removing entity '${instanceId}'`
    );

    return this.#lifecycleManager.removeEntityInstance(instanceId);
  }
}
