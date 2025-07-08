/**
 * @file EntityLifecycleManager (Optimized) - Handles lifecycle operations for entities
 * @description Refactored service with extracted helper classes for better maintainability
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { RepositoryConsistencyError } from '../../errors/repositoryConsistencyError.js';
import { EntityNotFoundError } from '../../errors/entityNotFoundError.js';
import EntityLifecycleValidator from './helpers/EntityLifecycleValidator.js';
import EntityEventDispatcher from './helpers/EntityEventDispatcher.js';
import EntityDefinitionHelper from './helpers/EntityDefinitionHelper.js';

/**
 * @typedef {import('../factories/entityFactory.js').default} EntityFactory
 * @typedef {import('./entityRepositoryAdapter.js').EntityRepositoryAdapter} EntityRepositoryAdapter
 * @typedef {import('./definitionCache.js').DefinitionCache} DefinitionCache
 * @typedef {import('./errorTranslator.js').ErrorTranslator} ErrorTranslator
 * @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

/**
 * @class EntityLifecycleManager
 * @description Optimized entity lifecycle manager with helper classes
 */
export class EntityLifecycleManager {
  /** @type {IDataRegistry} */
  #registry;
  /** @type {ILogger} */
  #logger;
  /** @type {EntityRepositoryAdapter} */
  #entityRepository;
  /** @type {EntityFactory} */
  #factory;
  /** @type {ErrorTranslator} */
  #errorTranslator;

  // Helper classes
  /** @type {EntityLifecycleValidator} */
  #validator;
  /** @type {EntityEventDispatcher} */
  #eventDispatcher;
  /** @type {EntityDefinitionHelper} */
  #definitionHelper;

  /**
   * @class
   * @param {object} deps - Constructor dependencies
   * @param {IDataRegistry} deps.registry - Data registry for definitions
   * @param {ILogger} deps.logger - Logger instance
   * @param {ISafeEventDispatcher} deps.eventDispatcher - Event dispatcher
   * @param {EntityRepositoryAdapter} deps.entityRepository - Internal entity repository
   * @param {EntityFactory} deps.factory - EntityFactory instance
   * @param {ErrorTranslator} deps.errorTranslator - Error translator
   * @param {DefinitionCache} deps.definitionCache - Definition cache instance
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
    this.#validateDependencies({
      registry,
      logger,
      eventDispatcher,
      entityRepository,
      factory,
      errorTranslator,
      definitionCache,
    });

    this.#initializeCoreDependencies({
      registry,
      logger,
      entityRepository,
      factory,
      errorTranslator,
    });

    this.#initializeHelpers({
      logger,
      eventDispatcher,
      registry,
      definitionCache,
    });

    this.#logger.debug('EntityLifecycleManager (optimized) initialized');
  }

  /**
   * Validates all constructor dependencies.
   *
   * @param {object} deps - Dependencies to validate
   * @param deps.registry
   * @param deps.logger
   * @param deps.eventDispatcher
   * @param deps.entityRepository
   * @param deps.factory
   * @param deps.errorTranslator
   * @param deps.definitionCache
   */
  #validateDependencies({
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
    const tempLogger = ensureValidLogger(logger, 'EntityLifecycleManager');

    validateDependency(registry, 'IDataRegistry', tempLogger, {
      requiredMethods: ['getEntityDefinition'],
    });
    validateDependency(entityRepository, 'EntityRepositoryAdapter', tempLogger, {
      requiredMethods: ['add', 'get', 'has', 'remove', 'clear', 'entities'],
    });
    validateDependency(eventDispatcher, 'ISafeEventDispatcher', tempLogger, {
      requiredMethods: ['dispatch'],
    });
    validateDependency(factory, 'EntityFactory', tempLogger, {
      requiredMethods: ['create', 'reconstruct'],
    });
    validateDependency(errorTranslator, 'ErrorTranslator', tempLogger, {
      requiredMethods: ['translate'],
    });
    validateDependency(definitionCache, 'DefinitionCache', tempLogger, {
      requiredMethods: ['get', 'clear'],
    });
  }

  /**
   * Initializes core dependencies.
   *
   * @param {object} deps - Core dependencies
   * @param deps.registry
   * @param deps.logger
   * @param deps.entityRepository
   * @param deps.factory
   * @param deps.errorTranslator
   */
  #initializeCoreDependencies({
    registry,
    logger,
    entityRepository,
    factory,
    errorTranslator,
  }) {
    this.#registry = registry;
    this.#logger = ensureValidLogger(logger, 'EntityLifecycleManager');
    this.#entityRepository = entityRepository;
    this.#factory = factory;
    this.#errorTranslator = errorTranslator;
  }

  /**
   * Initializes helper classes.
   *
   * @param {object} deps - Helper dependencies
   * @param deps.logger
   * @param deps.eventDispatcher
   * @param deps.registry
   * @param deps.definitionCache
   */
  #initializeHelpers({
    logger,
    eventDispatcher,
    registry,
    definitionCache,
  }) {
    this.#validator = new EntityLifecycleValidator({ logger });
    this.#eventDispatcher = new EntityEventDispatcher({ eventDispatcher, logger });
    this.#definitionHelper = new EntityDefinitionHelper({
      registry,
      definitionCache,
      logger,
    });
  }

  /**
   * Constructs a new entity instance using the factory.
   *
   * @param {string} definitionId - Definition ID
   * @param {object} opts - Creation options
   * @param {object} definition - Resolved definition
   * @returns {object} Newly constructed entity
   */
  #constructEntity(definitionId, opts, definition) {
    try {
      const entity = this.#factory.create(
        definitionId,
        opts,
        this.#registry,
        this.#entityRepository,
        definition
      );

      // Add to repository
      this.#entityRepository.add(entity);

      return entity;
    } catch (error) {
      this.#logger.error(`Failed to construct entity '${definitionId}':`, error);
      throw this.#errorTranslator.translate(error);
    }
  }

  /**
   * Reconstructs an entity instance using the factory.
   *
   * @param {object} serializedEntity - Serialized entity data
   * @returns {object} Reconstructed entity
   */
  #reconstructEntity(serializedEntity) {
    try {
      const entity = this.#factory.reconstruct(
        serializedEntity,
        this.#registry,
        this.#entityRepository
      );

      // Add to repository
      this.#entityRepository.add(entity);

      return entity;
    } catch (error) {
      this.#logger.error(`Failed to reconstruct entity '${serializedEntity.instanceId}':`, error);
      throw this.#errorTranslator.translate(error);
    }
  }

  /**
   * Create a new entity instance from a definition.
   *
   * @param {string} definitionId - The ID of the entity definition
   * @param {object} opts - Options for creation
   * @param {string} [opts.instanceId] - Optional instance ID
   * @param {Object<string, Object>} [opts.componentOverrides] - Component overrides
   * @returns {object} The newly created entity
   * @throws {Error} If creation fails
   */
  createEntityInstance(definitionId, opts = {}) {
    // Validate parameters
    this.#validator.validateCreateEntityParams(definitionId);
    this.#validator.validateCreationOptions(opts);

    // Get definition
    const definition = this.#definitionHelper.getDefinitionForCreate(definitionId);

    // Construct entity
    const entity = this.#constructEntity(definitionId, opts, definition);

    // Dispatch event
    this.#eventDispatcher.dispatchEntityCreated(entity, false);

    this.#logger.info(`Entity created: ${entity.id} (definition: ${definitionId})`);
    return entity;
  }

  /**
   * Reconstructs an entity instance from a serialized object.
   *
   * @param {object} serializedEntity - Serialized entity data
   * @param {string} serializedEntity.instanceId - Instance ID
   * @param {string} serializedEntity.definitionId - Definition ID
   * @param {object} [serializedEntity.components] - Component data
   * @returns {object} The reconstructed entity
   * @throws {Error} If reconstruction fails
   */
  reconstructEntity(serializedEntity) {
    // Validate parameters
    this.#validator.validateReconstructEntityParams(serializedEntity);
    this.#validator.validateSerializedEntityStructure(serializedEntity);

    // Get definition
    const definition = this.#definitionHelper.getDefinitionForReconstruct(
      serializedEntity.definitionId
    );

    // Reconstruct entity
    const entity = this.#reconstructEntity(serializedEntity);

    // Dispatch event
    this.#eventDispatcher.dispatchEntityCreated(entity, true);

    this.#logger.info(`Entity reconstructed: ${entity.id} (definition: ${serializedEntity.definitionId})`);
    return entity;
  }

  /**
   * Remove an entity instance from the manager.
   *
   * @param {string} instanceId - The ID of the entity instance to remove
   * @throws {EntityNotFoundError} If the entity is not found
   * @throws {Error} If removal fails
   */
  removeEntityInstance(instanceId) {
    // Validate parameters
    this.#validator.validateRemoveEntityInstanceParams(instanceId);

    // Check entity exists
    const entity = this.#entityRepository.get(instanceId);
    if (!entity) {
      throw new EntityNotFoundError(instanceId);
    }

    try {
      // Remove from repository
      const removed = this.#entityRepository.remove(instanceId);
      
      if (!removed) {
        throw new RepositoryConsistencyError(
          `Repository inconsistency: Entity '${instanceId}' was found but could not be removed`
        );
      }

      // Dispatch event
      this.#eventDispatcher.dispatchEntityRemoved(entity);

      this.#logger.info(`Entity removed: ${instanceId}`);
    } catch (error) {
      // If repository operations fail, wrap in RepositoryConsistencyError
      if (error instanceof RepositoryConsistencyError) {
        throw error;
      }
      
      this.#logger.error(`EntityRepository.remove failed for already retrieved entity '${instanceId}': ${error.message}`);
      throw new RepositoryConsistencyError(
        `EntityRepository.remove failed for already retrieved entity '${instanceId}': ${error.message}`
      );
    }
  }

  /**
   * Batch create multiple entities.
   *
   * @param {Array<{definitionId: string, opts?: object}>} entitySpecs - Entity specifications
   * @returns {Array<object>} Created entities
   */
  batchCreateEntities(entitySpecs) {
    const results = [];
    const errors = [];

    for (const spec of entitySpecs) {
      try {
        const entity = this.createEntityInstance(spec.definitionId, spec.opts);
        results.push(entity);
      } catch (error) {
        errors.push({ spec, error });
      }
    }

    if (errors.length > 0) {
      this.#logger.warn(`Batch create completed with ${errors.length} errors`);
    }

    return { entities: results, errors };
  }

  /**
   * Preloads entity definitions for better performance.
   *
   * @param {string[]} definitionIds - Definition IDs to preload
   * @returns {object} Preload results
   */
  preloadDefinitions(definitionIds) {
    return this.#definitionHelper.preloadDefinitions(definitionIds);
  }

  /**
   * Gets lifecycle statistics.
   *
   * @returns {object} Lifecycle statistics
   */
  getStats() {
    return {
      entityCount: this.#entityRepository.size || 0,
      cacheStats: this.#definitionHelper.getCacheStats(),
      eventStats: this.#eventDispatcher.getStats(),
    };
  }

  /**
   * Clears definition cache.
   */
  clearCache() {
    this.#definitionHelper.clearCache();
  }
}

export default EntityLifecycleManager;