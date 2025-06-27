/**
 * @file EntityLifecycleManager - Handles lifecycle operations for entities.
 * @description Service responsible for creating, reconstructing and removing
 *   entity instances with proper validation, caching and event dispatching.
 */

import { validateDependency } from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { assertValidId } from '../../utils/parameterGuards.js';
import {
  validateReconstructEntityParams as validateReconstructEntityParamsUtil,
  validateRemoveEntityInstanceParams as validateRemoveEntityInstanceParamsUtil,
} from '../utils/parameterValidators.js';
import { DefinitionNotFoundError } from '../../errors/definitionNotFoundError.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { EntityNotFoundError } from '../../errors/entityNotFoundError.js';
import {
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
} from '../../constants/eventIds.js';

/**
 * @typedef {import('../factories/entityFactory.js').default} EntityFactory
 * @typedef {import('./entityRepositoryAdapter.js').EntityRepositoryAdapter} EntityRepositoryAdapter
 * @typedef {import('./definitionCache.js').DefinitionCache} DefinitionCache
 * @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../../ports/IEntityRepository.js').IEntityRepository} IEntityRepository
 * @typedef {import('./errorTranslator.js').ErrorTranslator} ErrorTranslator
 */

/**
 * @class EntityLifecycleManager
 * @description Handles creation, reconstruction and removal of entity instances.
 */
export class EntityLifecycleManager {
  /** @type {IDataRegistry} @private */
  #registry;
  /** @type {ILogger} @private */
  #logger;
  /** @type {ISafeEventDispatcher} @private */
  #eventDispatcher;
  /** @type {EntityRepositoryAdapter} @private */
  #entityRepository;
  /** @type {EntityFactory} @private */
  #factory;
  /** @type {ErrorTranslator} @private */
  #errorTranslator;
  /** @type {DefinitionCache} @private */
  #definitionCache;

  /**
   * @param {object} deps - Constructor dependencies.
   * @param {IDataRegistry} deps.registry - Data registry for definitions.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {ISafeEventDispatcher} deps.eventDispatcher - Event dispatcher.
   * @param {EntityRepositoryAdapter} deps.entityRepository - Internal entity repository.
   * @param {EntityFactory} deps.factory - EntityFactory instance.
   * @param {ErrorTranslator} deps.errorTranslator - Error translator.
   * @param {DefinitionCache} deps.definitionCache - Definition cache instance.
   */
  constructor({
    registry,
    logger,
    eventDispatcher,
    entityRepository,
    factory,
    errorTranslator,
    definitionCache,
  }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityLifecycleManager');

    validateDependency(registry, 'IDataRegistry', this.#logger, {
      requiredMethods: ['getEntityDefinition'],
    });
    validateDependency(
      entityRepository,
      'EntityRepositoryAdapter',
      this.#logger,
      {
        requiredMethods: ['add', 'get', 'has', 'remove', 'clear', 'entities'],
      }
    );
    validateDependency(eventDispatcher, 'ISafeEventDispatcher', this.#logger, {
      requiredMethods: ['dispatch'],
    });
    validateDependency(factory, 'EntityFactory', this.#logger, {
      requiredMethods: ['create', 'reconstruct'],
    });
    validateDependency(errorTranslator, 'ErrorTranslator', this.#logger, {
      requiredMethods: ['translate'],
    });
    validateDependency(definitionCache, 'DefinitionCache', this.#logger, {
      requiredMethods: ['get', 'clear'],
    });

    this.#registry = registry;
    this.#eventDispatcher = eventDispatcher;
    this.#entityRepository = entityRepository;
    this.#factory = factory;
    this.#errorTranslator = errorTranslator;
    this.#definitionCache = definitionCache;
  }

  /**
   * Validates parameters for {@link createEntityInstance}.
   *
   * @private
   * @param {string} definitionId - Definition ID to validate.
   * @throws {InvalidArgumentError} If the definitionId is invalid.
   */
  #validateCreateEntityParams(definitionId) {
    try {
      assertValidId(
        definitionId,
        'EntityManager.createEntityInstance',
        this.#logger
      );
    } catch (err) {
      if (err && err.name === 'InvalidArgumentError') {
        const msg = `EntityManager.createEntityInstance: invalid definitionId '${definitionId}'`;
        this.#logger.warn(msg);
        throw new InvalidArgumentError(msg, 'definitionId', definitionId);
      }
      throw err;
    }
  }

  /**
   * Retrieves an entity definition or throws if missing.
   *
   * @private
   * @param {string} definitionId - Entity definition ID.
   * @returns {import('../entityDefinition.js').default} The entity definition.
   * @throws {DefinitionNotFoundError} If the definition is missing.
   */
  #getDefinitionForCreate(definitionId) {
    const definition = this.#definitionCache.get(definitionId);
    if (!definition) {
      throw new DefinitionNotFoundError(definitionId);
    }
    return definition;
  }

  /**
   * Constructs a new entity instance using the factory.
   *
   * @private
   * @param {string} definitionId - Definition ID.
   * @param {object} opts - Creation options.
   * @param {import('../entityDefinition.js').default} definition - Resolved definition.
   * @returns {import('../entity.js').default} Newly constructed entity.
   */
  #constructEntity(definitionId, opts, definition) {
    return this.#factory.create(
      definitionId,
      opts,
      this.#registry,
      this.#entityRepository,
      definition
    );
  }

  /**
   * Dispatches the ENTITY_CREATED event.
   *
   * @private
   * @param {import('../entity.js').default} entity - Newly created entity.
   * @param {boolean} wasReconstructed - Flag indicating reconstruction.
   */
  #dispatchEntityCreated(entity, wasReconstructed) {
    this.#eventDispatcher.dispatch(ENTITY_CREATED_ID, {
      instanceId: entity.id,
      definitionId: entity.definitionId,
      wasReconstructed,
      entity,
    });
  }

  /**
   * Create a new entity instance from a definition.
   *
   * @param {string} definitionId - The ID of the entity definition.
   * @param {object} opts - Options for creation.
   * @param {string} [opts.instanceId] - Optional instance ID.
   * @param {Object<string, object>} [opts.componentOverrides] - Component overrides.
   * @returns {import('../entity.js').default} The newly created entity.
   * @throws {DefinitionNotFoundError} If the definition is not found.
   * @throws {InvalidArgumentError} If definitionId is invalid.
   * @throws {import('../../errors/validationError.js').ValidationError} If validation fails.
   * @throws {import('../../errors/duplicateEntityError.js').DuplicateEntityError} If duplicate ID.
   */
  createEntityInstance(definitionId, opts = {}) {
    this.#validateCreateEntityParams(definitionId);
    const definition = this.#getDefinitionForCreate(definitionId);

    this.#logger.debug(
      `EntityManager.createEntityInstance: Creating entity instance '${opts.instanceId || 'auto-generated'}' from definition '${definitionId}' with overrides:`,
      opts.componentOverrides
    );

    try {
      const entity = this.#constructEntity(definitionId, opts, definition);
      this.#logger.debug(
        `EntityManager.createEntityInstance: Factory created entity with ID '${entity.id}' and definitionId '${entity.definitionId}'`
      );
      this.#entityRepository.add(entity);
      this.#logger.debug(`Tracked entity ${entity.id}`);
      this.#dispatchEntityCreated(entity, false);
      return entity;
    } catch (err) {
      throw this.#errorTranslator.translate(err);
    }
  }

  /**
   * Reconstruct an entity from serialized data.
   *
   * @param {object} serializedEntity - Serialized entity data.
   * @param {string} serializedEntity.instanceId - Instance ID.
   * @param {string} serializedEntity.definitionId - Definition ID.
   * @param {Record<string, object>} [serializedEntity.components] - Component data.
   * @returns {import('../entity.js').default} The reconstructed entity.
   * @throws {DefinitionNotFoundError} If definition not found.
   * @throws {import('../../errors/duplicateEntityError.js').DuplicateEntityError} If duplicate ID.
   * @throws {import('../../errors/validationError.js').ValidationError} If validation fails.
   * @throws {Error} If serializedEntity data is invalid.
   */
  reconstructEntity(serializedEntity) {
    validateReconstructEntityParamsUtil(serializedEntity, this.#logger);
    try {
      const entity = this.#factory.reconstruct(
        serializedEntity,
        this.#registry,
        this.#entityRepository
      );
      this.#entityRepository.add(entity);
      this.#logger.debug(`Tracked entity ${entity.id}`);
      this.#dispatchEntityCreated(entity, true);
      return entity;
    } catch (err) {
      throw this.#errorTranslator.translate(err);
    }
  }

  /**
   * Remove an existing entity instance.
   *
   * @param {string} instanceId - Entity instance ID.
   * @throws {EntityNotFoundError} If entity is not found.
   * @throws {InvalidArgumentError} If instanceId is invalid.
   * @throws {Error} If internal removal fails.
   */
  removeEntityInstance(instanceId) {
    validateRemoveEntityInstanceParamsUtil(instanceId, this.#logger);

    const entityToRemove = this.#entityRepository.get(instanceId);
    if (!entityToRemove) {
      this.#logger.error(
        `EntityManager.removeEntityInstance: Attempted to remove non-existent entity instance '${instanceId}'.`
      );
      throw new EntityNotFoundError(instanceId);
    }

    try {
      this.#entityRepository.remove(entityToRemove.id);
      this.#logger.info(
        `Entity instance ${entityToRemove.id} removed from EntityManager.`
      );
      this.#eventDispatcher.dispatch(ENTITY_REMOVED_ID, {
        entity: entityToRemove,
      });
    } catch (error) {
      this.#logger.error(
        `EntityManager.removeEntityInstance: EntityRepository.remove failed for already retrieved entity '${instanceId}'. This indicates a serious internal inconsistency.`
      );
      throw new Error(
        `Internal error: Failed to remove entity '${instanceId}' from entity repository despite entity being found.`
      );
    }
  }
}

export default EntityLifecycleManager;
