/**
 * @file ComponentMutationService - Handles component mutations on entities
 * @description Service responsible for adding and removing components on entities
 * with proper validation, event dispatching, and error handling.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { EntityNotFoundError } from '../../errors/entityNotFoundError.js';
import { ValidationError } from '../../errors/validationError.js';
import { ComponentOverrideNotFoundError } from '../../errors/componentOverrideNotFoundError.js';
import createValidateAndClone from '../utils/createValidateAndClone.js';
import {
  validateAddComponentParams as validateAddComponentParamsUtil,
  validateRemoveComponentParams as validateRemoveComponentParamsUtil,
} from '../utils/parameterValidators.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
  COMPONENTS_BATCH_ADDED_ID,
} from '../../constants/eventIds.js';
import MonitoringCoordinator from '../monitoring/MonitoringCoordinator.js';

/** @typedef {import('../entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../ports/IComponentCloner.js').IComponentCloner} IComponentCloner */
/** @typedef {import('./entityRepositoryAdapter.js').EntityRepositoryAdapter} EntityRepositoryAdapter */
/** @typedef {import('../monitoring/MonitoringCoordinator.js').default} MonitoringCoordinator */

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
  /** @type {(componentTypeId: string, data: object, context: string) => object} @private */
  #validateAndClone;
  /** @type {MonitoringCoordinator} @private */
  #monitoringCoordinator;

  /**
   * @param {object} deps - Dependencies
   * @param {EntityRepositoryAdapter} deps.entityRepository - Entity repository adapter
   * @param {ISchemaValidator} deps.validator - Schema validator
   * @param {ILogger} deps.logger - Logger instance
   * @param {ISafeEventDispatcher} deps.eventDispatcher - Event dispatcher
   * @param {IComponentCloner} deps.cloner - Component cloner
   * @param {MonitoringCoordinator} [deps.monitoringCoordinator] - Monitoring coordinator
   */
  constructor({
    entityRepository,
    validator,
    logger,
    eventDispatcher,
    cloner,
    monitoringCoordinator,
  }) {
    validateDependency(entityRepository, 'EntityRepositoryAdapter', console, {
      requiredMethods: [
        'get',
        'indexComponentAdd',
        'indexComponentRemove',
        'getAllEntityIds',
      ],
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

    // MonitoringCoordinator is optional
    if (monitoringCoordinator) {
      validateDependency(
        monitoringCoordinator,
        'MonitoringCoordinator',
        console,
        {
          requiredMethods: ['executeMonitored', 'getCircuitBreaker'],
        }
      );
    }

    this.#entityRepository = entityRepository;
    this.#validator = validator;
    this.#logger = ensureValidLogger(logger, 'ComponentMutationService');
    this.#eventDispatcher = eventDispatcher;
    this.#cloner = cloner;
    this.#monitoringCoordinator = monitoringCoordinator;
    this.#validateAndClone = createValidateAndClone(
      this.#validator,
      this.#logger,
      this.#cloner
    );

    this.#logger.debug('ComponentMutationService initialized.');
  }

  /**
   * Fetch the target entity or throw if not found.
   *
   * @private
   * @param {string} instanceId
   * @param {string} componentTypeId
   * @returns {Entity}
   */
  #fetchEntity(instanceId, componentTypeId) {
    const entity = this.#entityRepository.get(instanceId);
    if (!entity) {
      // Enhanced error reporting for debugging race conditions
      const allEntities = this.#entityRepository.getAllEntityIds();
      const recentEntities = allEntities.slice(-10); // Show last 10 created entities

      this.#logger.error(
        `ComponentMutationService.addComponent: Entity not found with ID: ${instanceId}`,
        {
          instanceId,
          componentTypeId,
          totalEntities: allEntities.length,
          recentEntities: recentEntities,
          repositoryType: this.#entityRepository.constructor.name,
        }
      );

      // Add timing information if available
      const now = Date.now();
      this.#logger.error(
        `Timing context: Current time ${now}, Entity ID pattern suggests creation time: ${instanceId.includes('-') ? 'UUID format' : 'Custom format'}`,
        { instanceId, now }
      );

      throw new EntityNotFoundError(instanceId);
    }
    return entity;
  }

  /**
   * Validate and clone component data when provided.
   *
   * @private
   * @param {string} componentTypeId
   * @param {object} componentData
   * @param {string} instanceId
   * @returns {object|undefined}
   */
  #validateComponentData(componentTypeId, componentData, instanceId) {
    if (componentData === undefined) return undefined;
    try {
      return this.#validateAndClone(
        componentTypeId,
        componentData,
        `addComponent ${componentTypeId} to entity ${instanceId}`
      );
    } catch (error) {
      throw new ValidationError(
        error.message,
        componentTypeId,
        error.validationErrors
      );
    }
  }

  /**
   * Apply the component update to the entity, throwing if it fails.
   *
   * @private
   * @param {Entity} entity
   * @param {string} componentTypeId
   * @param {object|undefined} data
   * @param {string} instanceId
   */
  #applyComponentUpdate(entity, componentTypeId, data, instanceId) {
    const updateSucceeded = entity.addComponent(componentTypeId, data);
    if (!updateSucceeded) {
      this.#logger.warn(
        `ComponentMutationService.addComponent: entity.addComponent returned false for '${componentTypeId}' on entity '${instanceId}'. This may indicate an internal issue.`
      );
      throw new Error(
        `Failed to add component '${componentTypeId}' to entity '${instanceId}'. Internal entity update failed.`
      );
    }
  }

  /**
   * Emit COMPONENT_ADDED after a successful mutation.
   *
   * @private
   * @param {Entity} entity
   * @param {string} componentTypeId
   * @param {object|undefined} validatedData
   * @param {object|undefined} oldComponentData
   */
  #emitComponentAdded(
    entity,
    componentTypeId,
    validatedData,
    oldComponentData
  ) {
    this.#eventDispatcher.dispatch(COMPONENT_ADDED_ID, {
      entity,
      componentTypeId,
      componentData: validatedData,
      oldComponentData,
    });
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
   * @throws {Error} If circuit breaker is open.
   */
  async addComponent(instanceId, componentTypeId, componentData) {
    // If monitoring is enabled, wrap the execution
    if (this.#monitoringCoordinator) {
      return await this.#monitoringCoordinator.executeMonitored(
        'addComponent',
        () =>
          this.#addComponentCore(instanceId, componentTypeId, componentData),
        {
          context: `entity:${instanceId},component:${componentTypeId}`,
          useCircuitBreaker: true,
        }
      );
    }

    // Otherwise, execute directly
    return this.#addComponentCore(instanceId, componentTypeId, componentData);
  }

  /**
   * Core implementation of addComponent.
   *
   * @private
   * @param {string} instanceId - The ID of the entity instance.
   * @param {string} componentTypeId - The unique ID of the component type.
   * @param {object} componentData - The data for the component.
   * @returns {boolean} True if successful
   */
  #addComponentCore(instanceId, componentTypeId, componentData) {
    validateAddComponentParamsUtil(
      instanceId,
      componentTypeId,
      componentData,
      this.#logger,
      'ComponentMutationService.addComponent'
    );

    const entity = this.#fetchEntity(instanceId, componentTypeId);
    const oldComponentData = entity.getComponentData(componentTypeId);
    const validatedData = this.#validateComponentData(
      componentTypeId,
      componentData,
      instanceId
    );

    // Check if this is a new component (not just an update)
    const isNewComponent = !entity.hasComponent(componentTypeId);

    this.#applyComponentUpdate(
      entity,
      componentTypeId,
      validatedData,
      instanceId
    );

    // Update component index if this is a new component
    if (isNewComponent) {
      this.#entityRepository.indexComponentAdd(instanceId, componentTypeId);
    }

    this.#emitComponentAdded(
      entity,
      componentTypeId,
      validatedData,
      oldComponentData
    );

    this.#logger.debug(
      `Successfully added/updated component '${componentTypeId}' data on entity '${instanceId}'.`
    );

    return true;
  }

  /**
   * Removes a component override from an existing entity instance.
   *
   * @param {string} instanceId - The ID of the entity instance.
   * @param {string} componentTypeId - The unique ID of the component type to remove.
   * @returns {Promise<boolean>} True if component was removed successfully.
   * @throws {EntityNotFoundError} If entity not found.
   * @throws {ComponentOverrideNotFoundError} If component override does not exist.
   * @throws {InvalidArgumentError} If parameters are invalid.
   * @throws {Error} If removal fails or circuit breaker is open.
   */
  async removeComponent(instanceId, componentTypeId) {
    // If monitoring is enabled, wrap the execution
    if (this.#monitoringCoordinator) {
      return await this.#monitoringCoordinator.executeMonitored(
        'removeComponent',
        () => this.#removeComponentCore(instanceId, componentTypeId),
        {
          context: `entity:${instanceId},component:${componentTypeId}`,
          useCircuitBreaker: true,
        }
      );
    }

    // Otherwise, execute directly
    return this.#removeComponentCore(instanceId, componentTypeId);
  }

  /**
   * Core implementation of removeComponent.
   *
   * @private
   * @param {string} instanceId - The ID of the entity instance.
   * @param {string} componentTypeId - The unique ID of the component type to remove.
   */
  #removeComponentCore(instanceId, componentTypeId) {
    validateRemoveComponentParamsUtil(
      instanceId,
      componentTypeId,
      this.#logger,
      'ComponentMutationService.removeComponent'
    );

    const entity = this.#entityRepository.get(instanceId);
    if (!entity) {
      this.#logger.error(
        `ComponentMutationService.removeComponent: Entity not found with ID: '${instanceId}'. Cannot remove component '${componentTypeId}'.`
      );
      throw new EntityNotFoundError(instanceId);
    }

    // Check if the component to be removed exists as an override.
    // If not, treat as successful (idempotent operation - removing non-existent component succeeds).
    if (!entity.hasComponentOverride(componentTypeId)) {
      this.#logger.debug(
        `ComponentMutationService.removeComponent: Component '${componentTypeId}' not found as an override on entity '${instanceId}'. Treating as successful (idempotent operation).`
      );
      return true; // Idempotent: removing non-existent component succeeds
    }

    // Capture the state of the component *before* it is removed.
    const oldComponentData = entity.getComponentData(componentTypeId);

    const successfullyRemovedOverride = entity.removeComponent(componentTypeId);

    if (successfullyRemovedOverride) {
      // Update component index - only if the component is completely removed
      // (not just the override, but the component no longer exists on the entity)
      if (!entity.hasComponent(componentTypeId)) {
        this.#entityRepository.indexComponentRemove(
          instanceId,
          componentTypeId
        );
      }

      this.#eventDispatcher.dispatch(COMPONENT_REMOVED_ID, {
        entity,
        componentTypeId,
        oldComponentData, // Include old data in the event
      });

      this.#logger.debug(
        `ComponentMutationService.removeComponent: Component override '${componentTypeId}' removed from entity '${instanceId}'.`
      );
      return true;
    } else {
      this.#logger.warn(
        `ComponentMutationService.removeComponent: entity.removeComponent('${componentTypeId}') returned false for entity '${instanceId}' when an override was expected and should have been removable. This may indicate an issue in Entity class logic.`
      );
      throw new Error(
        `Failed to remove component '${componentTypeId}' from entity '${instanceId}'. Internal entity removal failed.`
      );
    }
  }

  /**
   * Batch add multiple components to entities.
   *
   * @param {Array<{instanceId: string, componentTypeId: string, componentData: object}>} componentSpecs - Component specifications
   * @returns {Promise<object>} Results with successes and errors
   */
  async batchAddComponents(componentSpecs) {
    const results = [];
    const errors = [];

    for (const spec of componentSpecs) {
      try {
        const result = await this.addComponent(
          spec.instanceId,
          spec.componentTypeId,
          spec.componentData
        );
        results.push({ spec, result });
      } catch (error) {
        errors.push({ spec, error });
      }
    }

    if (errors.length > 0) {
      this.#logger.warn(
        `Batch add components completed with ${errors.length} errors`
      );
    }

    return { results, errors };
  }

  /**
   * Optimized batch add that reduces event emissions.
   * Updates multiple components on entities with minimal event dispatching.
   *
   * @param {Array<{instanceId: string, componentTypeId: string, componentData: object}>} componentSpecs
   * @param {boolean} emitBatchEvent - Whether to emit a single batch event instead of individual events
   * @returns {Promise<object>} Results with successes and errors
   */
  async batchAddComponentsOptimized(componentSpecs, emitBatchEvent = true) {
    const results = [];
    const errors = [];
    const updates = [];

    // Process all updates without emitting individual events
    for (const spec of componentSpecs) {
      try {
        // Validate the component spec
        if (!spec.instanceId || !spec.componentTypeId) {
          throw new Error(
            'Invalid component spec: missing instanceId or componentTypeId'
          );
        }

        const entity = this.#fetchEntity(spec.instanceId);
        const oldComponentData = entity.hasComponent(spec.componentTypeId)
          ? entity.getComponentData(spec.componentTypeId)
          : undefined;

        // Validate and clone the component data
        const validatedData = this.#validateComponentData(
          spec.componentTypeId,
          spec.componentData,
          spec.instanceId
        );

        // Check if this is a new component (not just an update)
        const isNewComponent = !entity.hasComponent(spec.componentTypeId);

        // Apply the update
        this.#applyComponentUpdate(
          entity,
          spec.componentTypeId,
          validatedData,
          spec.instanceId
        );

        // Update component index if this is a new component
        if (isNewComponent) {
          this.#entityRepository.indexComponentAdd(
            spec.instanceId,
            spec.componentTypeId
          );
        }

        // Store update info for batch event
        updates.push({
          instanceId: spec.instanceId,
          componentTypeId: spec.componentTypeId,
          componentData: validatedData,
          oldComponentData,
          isNewComponent,
        });

        results.push({ spec, success: true });

        this.#logger.debug(
          `Batch: Successfully added/updated component '${spec.componentTypeId}' on entity '${spec.instanceId}'.`
        );
      } catch (error) {
        errors.push({ spec, error });
        this.#logger.error(
          `Batch: Failed to add component '${spec.componentTypeId}' to entity '${spec.instanceId}': ${error.message}`
        );
      }
    }

    // Emit a single batch event if requested
    if (emitBatchEvent && updates.length > 0) {
      this.#eventDispatcher.dispatch(COMPONENTS_BATCH_ADDED_ID, {
        updates,
        updateCount: updates.length,
      });
      this.#logger.debug(
        `Emitted batch event for ${updates.length} component updates`
      );
    } else if (!emitBatchEvent) {
      // Emit individual events for backward compatibility
      for (const update of updates) {
        const entity = this.#fetchEntity(update.instanceId);
        this.#emitComponentAdded(
          entity,
          update.componentTypeId,
          update.componentData,
          update.oldComponentData
        );
      }
    }

    if (errors.length > 0) {
      this.#logger.warn(
        `Batch add components completed with ${errors.length} errors out of ${componentSpecs.length} total`
      );
    }

    return { results, errors, updateCount: updates.length };
  }
}

export default ComponentMutationService;
