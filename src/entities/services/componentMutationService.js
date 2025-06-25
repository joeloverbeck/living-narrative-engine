/**
 * @file ComponentMutationService - Handles component mutations on entities
 * @description Service responsible for adding and removing components on entities
 * with proper validation, event dispatching, and error handling.
 */

import { validateDependency } from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { EntityNotFoundError } from '../../errors/entityNotFoundError.js';
import { ValidationError } from '../../errors/validationError.js';
import { validateAndClone as validateAndCloneUtil } from '../utils/componentValidation.js';
import {
  validateAddComponentParams as validateAddComponentParamsUtil,
  validateRemoveComponentParams as validateRemoveComponentParamsUtil,
} from '../utils/parameterValidators.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
} from '../../constants/eventIds.js';

/** @typedef {import('../entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../ports/IComponentCloner.js').IComponentCloner} IComponentCloner */
/** @typedef {import('./entityRepositoryAdapter.js').EntityRepositoryAdapter} EntityRepositoryAdapter */

/**
 * @class ComponentMutationService
 * @description Service for handling component additions and removals on entities
 */
export class ComponentMutationService {
  /** @type {EntityRepositoryAdapter} @private */
  #entityRepository;
  /** @type {ISchemaValidator} @private */
  #validator;
  /** @type {ILogger} @private */
  #logger;
  /** @type {ISafeEventDispatcher} @private */
  #eventDispatcher;
  /** @type {IComponentCloner} @private */
  #cloner;

  /**
   * @param {object} deps - Dependencies
   * @param {EntityRepositoryAdapter} deps.entityRepository - Entity repository adapter
   * @param {ISchemaValidator} deps.validator - Schema validator
   * @param {ILogger} deps.logger - Logger instance
   * @param {ISafeEventDispatcher} deps.eventDispatcher - Event dispatcher
   * @param {IComponentCloner} deps.cloner - Component cloner
   */
  constructor({
    entityRepository,
    validator,
    logger,
    eventDispatcher,
    cloner,
  }) {
    validateDependency(entityRepository, 'EntityRepositoryAdapter', console, {
      requiredMethods: ['get'],
    });
    validateDependency(validator, 'ISchemaValidator', console, {
      requiredMethods: ['validate'],
    });
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    validateDependency(eventDispatcher, 'ISafeEventDispatcher', console, {
      requiredMethods: ['dispatch'],
    });
    validateDependency(cloner, 'IComponentCloner', console, {
      isFunction: true,
    });

    this.#entityRepository = entityRepository;
    this.#validator = validator;
    this.#logger = ensureValidLogger(logger, 'ComponentMutationService');
    this.#eventDispatcher = eventDispatcher;
    this.#cloner = cloner;

    this.#logger.debug('ComponentMutationService initialized.');
  }

  /**
   * Validate component data and return a deep clone.
   *
   * @private
   * @param {string} componentTypeId
   * @param {object} data
   * @param {string} errorContext
   * @returns {object} The validated (and potentially cloned/modified by validator) data.
   */
  #validateAndClone(componentTypeId, data, errorContext) {
    return validateAndCloneUtil(
      componentTypeId,
      data,
      this.#validator,
      this.#logger,
      errorContext,
      this.#cloner
    );
  }

  /**
   * Validate parameters for addComponent.
   *
   * @private
   * @param {string} instanceId - Entity instance ID.
   * @param {string} componentTypeId - Component type ID.
   * @param {object} componentData - Raw component data.
   * @throws {InvalidArgumentError} If parameters are invalid.
   */
  #validateAddComponentParams(instanceId, componentTypeId, componentData) {
    validateAddComponentParamsUtil(
      instanceId,
      componentTypeId,
      componentData,
      this.#logger
    );
  }

  /**
   * Validate parameters for removeComponent.
   *
   * @private
   * @param {string} instanceId - Entity instance ID.
   * @param {string} componentTypeId - Component type ID.
   * @throws {InvalidArgumentError} If parameters are invalid.
   */
  #validateRemoveComponentParams(instanceId, componentTypeId) {
    validateRemoveComponentParamsUtil(
      instanceId,
      componentTypeId,
      this.#logger
    );
  }

  /**
   * Adds or updates a component on an existing entity instance.
   *
   * @param {string} instanceId - The ID of the entity instance.
   * @param {string} componentTypeId - The unique ID of the component type.
   * @param {object} componentData - The data for the component.
   * @throws {EntityNotFoundError} If entity not found.
   * @throws {InvalidArgumentError} If parameters are invalid.
   * @throws {ValidationError} If component data validation fails.
   */
  addComponent(instanceId, componentTypeId, componentData) {
    this.#validateAddComponentParams(
      instanceId,
      componentTypeId,
      componentData
    );

    const entity = this.#entityRepository.get(instanceId);
    if (!entity) {
      this.#logger.error(
        `ComponentMutationService.addComponent: Entity not found with ID: ${instanceId}`,
        { instanceId, componentTypeId }
      );
      throw new EntityNotFoundError(instanceId);
    }

    // Capture the state of the component *before* the change.
    const oldComponentData = entity.getComponentData(componentTypeId);

    let validatedData;
    if (componentData === undefined) {
      validatedData = undefined;
    } else {
      try {
        validatedData = this.#validateAndClone(
          componentTypeId,
          componentData,
          `addComponent ${componentTypeId} to entity ${instanceId}`
        );
      } catch (error) {
        // Convert generic validation errors to ValidationError
        throw new ValidationError(
          error.message,
          componentTypeId,
          error.validationErrors
        );
      }
    }

    const updateSucceeded = entity.addComponent(componentTypeId, validatedData);

    if (!updateSucceeded) {
      this.#logger.warn(
        `ComponentMutationService.addComponent: entity.addComponent returned false for '${componentTypeId}' on entity '${instanceId}'. This may indicate an internal issue.`
      );
      throw new Error(
        `Failed to add component '${componentTypeId}' to entity '${instanceId}'. Internal entity update failed.`
      );
    }

    this.#eventDispatcher.dispatch(COMPONENT_ADDED_ID, {
      entity,
      componentTypeId,
      componentData: validatedData,
      oldComponentData, // Include old data in the event
    });

    this.#logger.debug(
      `Successfully added/updated component '${componentTypeId}' data on entity '${instanceId}'.`
    );
  }

  /**
   * Removes a component override from an existing entity instance.
   *
   * @param {string} instanceId - The ID of the entity instance.
   * @param {string} componentTypeId - The unique ID of the component type to remove.
   * @throws {EntityNotFoundError} If entity not found.
   * @throws {InvalidArgumentError} If parameters are invalid.
   * @throws {Error} If component override does not exist or removal fails.
   */
  removeComponent(instanceId, componentTypeId) {
    this.#validateRemoveComponentParams(instanceId, componentTypeId);

    const entity = this.#entityRepository.get(instanceId);
    if (!entity) {
      this.#logger.error(
        `ComponentMutationService.removeComponent: Entity not found with ID: '${instanceId}'. Cannot remove component '${componentTypeId}'.`
      );
      throw new EntityNotFoundError(instanceId);
    }

    // Check if the component to be removed exists as an override.
    if (!entity.hasComponent(componentTypeId, true)) {
      this.#logger.debug(
        `ComponentMutationService.removeComponent: Component '${componentTypeId}' not found as an override on entity '${instanceId}'. Nothing to remove at instance level.`
      );
      throw new Error(
        `Component '${componentTypeId}' not found as an override on entity '${instanceId}'. Nothing to remove at instance level.`
      );
    }

    // Capture the state of the component *before* it is removed.
    const oldComponentData = entity.getComponentData(componentTypeId);

    const successfullyRemovedOverride = entity.removeComponent(componentTypeId);

    if (successfullyRemovedOverride) {
      this.#eventDispatcher.dispatch(COMPONENT_REMOVED_ID, {
        entity,
        componentTypeId,
        oldComponentData, // Include old data in the event
      });

      this.#logger.debug(
        `ComponentMutationService.removeComponent: Component override '${componentTypeId}' removed from entity '${instanceId}'.`
      );
    } else {
      this.#logger.warn(
        `ComponentMutationService.removeComponent: entity.removeComponent('${componentTypeId}') returned false for entity '${instanceId}' when an override was expected and should have been removable. This may indicate an issue in Entity class logic.`
      );
      throw new Error(
        `Failed to remove component '${componentTypeId}' from entity '${instanceId}'. Internal entity removal failed.`
      );
    }
  }
}

export default ComponentMutationService;
