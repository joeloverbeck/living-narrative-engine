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
import MonitoringCoordinator from '../monitoring/MonitoringCoordinator.js';

/**
 * @typedef {import('../factories/entityFactory.js').default} EntityFactory
 * @typedef {import('./entityRepositoryAdapter.js').EntityRepositoryAdapter} EntityRepositoryAdapter
 * @typedef {import('./definitionCache.js').DefinitionCache} DefinitionCache
 * @typedef {import('./errorTranslator.js').ErrorTranslator} ErrorTranslator
 * @typedef {import('../monitoring/MonitoringCoordinator.js').default} MonitoringCoordinator
 * @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('../interfaces/IBatchOperationManager.js').default} IBatchOperationManager
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
  /** @type {MonitoringCoordinator} */
  #monitoringCoordinator;

  // Batch operation support
  /** @type {IBatchOperationManager} */
  #batchOperationManager;
  /** @type {boolean} */
  #enableBatchOperations;

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
   * @param {MonitoringCoordinator} [deps.monitoringCoordinator] - Monitoring coordinator
   * @param {IBatchOperationManager} [deps.batchOperationManager] - Batch operation manager
   * @param {boolean} [deps.enableBatchOperations] - Enable batch operations
   */
  constructor({
    registry,
    logger,
    eventDispatcher,
    entityRepository,
    factory,
    errorTranslator,
    definitionCache,
    monitoringCoordinator,
    batchOperationManager,
    enableBatchOperations = false,
  }) {
    this.#validateDependencies({
      registry,
      logger,
      eventDispatcher,
      entityRepository,
      factory,
      errorTranslator,
      definitionCache,
      monitoringCoordinator,
      batchOperationManager,
      enableBatchOperations,
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
      monitoringCoordinator,
    });

    // Initialize batch operation support
    this.#batchOperationManager = batchOperationManager;
    this.#enableBatchOperations = enableBatchOperations;

    this.#logger.debug('EntityLifecycleManager (optimized) initialized', {
      batchOperationsEnabled: enableBatchOperations,
    });
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
   * @param deps.monitoringCoordinator
   * @param deps.batchOperationManager
   * @param deps.enableBatchOperations
   */
  #validateDependencies({
    registry,
    logger,
    eventDispatcher,
    entityRepository,
    factory,
    errorTranslator,
    definitionCache,
    monitoringCoordinator,
    batchOperationManager,
    enableBatchOperations,
  }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    const tempLogger = ensureValidLogger(logger, 'EntityLifecycleManager');

    validateDependency(registry, 'IDataRegistry', tempLogger, {
      requiredMethods: ['getEntityDefinition'],
    });
    validateDependency(
      entityRepository,
      'EntityRepositoryAdapter',
      tempLogger,
      {
        requiredMethods: ['add', 'get', 'has', 'remove', 'clear', 'entities'],
      }
    );
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

    // MonitoringCoordinator is optional
    if (monitoringCoordinator) {
      validateDependency(
        monitoringCoordinator,
        'MonitoringCoordinator',
        tempLogger,
        {
          requiredMethods: [
            'executeMonitored',
            'getCircuitBreaker',
            'getStats',
          ],
        }
      );
    }

    // BatchOperationManager is optional - it may be set later via setBatchOperationManager
    // to resolve circular dependencies

    if (batchOperationManager) {
      validateDependency(
        batchOperationManager,
        'BatchOperationManager',
        tempLogger,
        {
          requiredMethods: [
            'batchCreateEntities',
            'batchAddComponents',
            'batchRemoveEntities',
          ],
        }
      );
    }
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
   * @param deps.monitoringCoordinator
   */
  #initializeHelpers({
    logger,
    eventDispatcher,
    registry,
    definitionCache,
    monitoringCoordinator,
  }) {
    this.#validator = new EntityLifecycleValidator({ logger });
    this.#eventDispatcher = new EntityEventDispatcher({
      eventDispatcher,
      logger,
    });
    this.#definitionHelper = new EntityDefinitionHelper({
      registry,
      definitionCache,
      logger,
    });
    this.#monitoringCoordinator = monitoringCoordinator;
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
      this.#logger.error(
        `Failed to construct entity '${definitionId}':`,
        error
      );
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
      this.#logger.error(
        `Failed to reconstruct entity '${serializedEntity.instanceId}':`,
        error
      );
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
  async createEntityInstance(definitionId, opts = {}) {
    // If monitoring is enabled, wrap the execution
    if (this.#monitoringCoordinator) {
      return await this.#monitoringCoordinator.executeMonitored(
        'createEntityInstance',
        () => this.#createEntityInstanceCore(definitionId, opts),
        { context: `definition:${definitionId}` }
      );
    }

    // Otherwise, execute directly
    return this.#createEntityInstanceCore(definitionId, opts);
  }

  /**
   * Core implementation of createEntityInstance.
   *
   * @private
   * @param {string} definitionId - The ID of the entity definition
   * @param {object} opts - Options for creation
   * @returns {object} The newly created entity
   */
  #createEntityInstanceCore(definitionId, opts = {}) {
    // Validate parameters
    this.#validator.validateCreateEntityParams(definitionId);
    this.#validator.validateCreationOptions(opts);

    // Get definition
    const definition =
      this.#definitionHelper.getDefinitionForCreate(definitionId);

    // Construct entity
    const entity = this.#constructEntity(definitionId, opts, definition);

    // Dispatch event
    this.#eventDispatcher.dispatchEntityCreated(entity, false);

    this.#logger.debug(
      `Entity created: ${entity.id} (definition: ${definitionId})`
    );
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

    this.#logger.debug(
      `Entity reconstructed: ${entity.id} (definition: ${serializedEntity.definitionId})`
    );
    return entity;
  }

  /**
   * Remove an entity instance from the manager.
   *
   * @param {string} instanceId - The ID of the entity instance to remove
   * @throws {EntityNotFoundError} If the entity is not found
   * @throws {Error} If removal fails
   */
  async removeEntityInstance(instanceId) {
    // If monitoring is enabled, wrap the execution
    if (this.#monitoringCoordinator) {
      return await this.#monitoringCoordinator.executeMonitored(
        'removeEntityInstance',
        () => this.#removeEntityInstanceCore(instanceId),
        { context: `instance:${instanceId}` }
      );
    }

    // Otherwise, execute directly
    return this.#removeEntityInstanceCore(instanceId);
  }

  /**
   * Core implementation of removeEntityInstance.
   *
   * @private
   * @param {string} instanceId - The ID of the entity instance to remove
   */
  #removeEntityInstanceCore(instanceId) {
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

      this.#logger.debug(`Entity removed: ${instanceId}`);
    } catch (error) {
      // If repository operations fail, wrap in RepositoryConsistencyError
      if (error instanceof RepositoryConsistencyError) {
        throw error;
      }

      this.#logger.error(
        `EntityRepository.remove failed for already retrieved entity '${instanceId}': ${error.message}`
      );
      throw new RepositoryConsistencyError(
        `EntityRepository.remove failed for already retrieved entity '${instanceId}': ${error.message}`
      );
    }
  }

  /**
   * Creates multiple entities in batch for improved performance.
   *
   * @param {Array<{definitionId: string, opts?: object}>} entitySpecs - Array of entity creation specifications
   * @param {object} [options] - Batch operation options
   * @param {number} [options.batchSize] - Override default batch size
   * @param {boolean} [options.enableParallel] - Enable parallel processing
   * @param {boolean} [options.stopOnError] - Stop on first error
   * @returns {Promise<{successes: Array, failures: Array, totalProcessed: number, successCount: number, failureCount: number, processingTime: number}>} Batch operation result
   */
  async batchCreateEntities(entitySpecs, options = {}) {
    if (!this.#enableBatchOperations || !this.#batchOperationManager) {
      return this.#fallbackSequentialCreate(entitySpecs, options);
    }

    this.#logger.info('Executing batch entity creation', {
      entityCount: entitySpecs.length,
      batchSize:
        options.batchSize ||
        this.#batchOperationManager.getStats().defaultBatchSize,
    });

    return await this.#batchOperationManager.batchCreateEntities(
      entitySpecs,
      options
    );
  }

  /**
   * Adds components to multiple entities in batch.
   *
   * @param {Array<{instanceId: string, componentTypeId: string, componentData: object}>} componentSpecs - Array of component specifications
   * @param {object} [options] - Batch operation options
   * @returns {Promise<{successes: Array, failures: Array, totalProcessed: number, successCount: number, failureCount: number, processingTime: number}>} Batch operation result
   */
  async batchAddComponents(componentSpecs, options = {}) {
    if (!this.#enableBatchOperations || !this.#batchOperationManager) {
      return this.#fallbackSequentialAddComponents(componentSpecs, options);
    }

    this.#logger.info('Executing batch component addition', {
      componentCount: componentSpecs.length,
    });

    return await this.#batchOperationManager.batchAddComponents(
      componentSpecs,
      options
    );
  }

  /**
   * Removes multiple entities in batch.
   *
   * @param {string[]} instanceIds - Array of entity instance IDs
   * @param {object} [options] - Batch operation options
   * @returns {Promise<{successes: Array, failures: Array, totalProcessed: number, successCount: number, failureCount: number, processingTime: number}>} Batch operation result
   */
  async batchRemoveEntities(instanceIds, options = {}) {
    if (!this.#enableBatchOperations || !this.#batchOperationManager) {
      return this.#fallbackSequentialRemove(instanceIds, options);
    }

    this.#logger.info('Executing batch entity removal', {
      entityCount: instanceIds.length,
    });

    return await this.#batchOperationManager.batchRemoveEntities(
      instanceIds,
      options
    );
  }

  /**
   * Fallback sequential entity creation when batch operations are disabled.
   *
   * @private
   * @param {Array<{definitionId: string, opts?: object}>} entitySpecs - Entity specifications
   * @param {object} options - Options
   * @returns {Promise<object>} Result matching batch operation format
   */
  async #fallbackSequentialCreate(entitySpecs, options) {
    const result = {
      // Expected format for tests
      entities: [],
      errors: [],
      // Keep internal tracking fields for compatibility
      successes: [],
      failures: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      processingTime: 0,
    };

    const startTime = performance.now();

    for (const spec of entitySpecs) {
      result.totalProcessed++;
      try {
        const entity = await this.createEntityInstance(
          spec.definitionId,
          spec.opts
        );
        result.entities.push(entity);
        result.successes.push(entity);
        result.successCount++;
      } catch (error) {
        result.errors.push({ item: spec, error });
        result.failures.push({ item: spec, error });
        result.failureCount++;
        this.#logger.warn(
          `Failed to create entity with definition '${spec.definitionId}': ${error.message}`
        );

        if (options.stopOnError) {
          break;
        }
      }
    }

    result.processingTime = performance.now() - startTime;
    return result;
  }

  /**
   * Fallback sequential component addition when batch operations are disabled.
   *
   * @private
   * @param {Array} componentSpecs - Component specifications
   * @param {object} options - Options
   * @returns {Promise<object>} Result matching batch operation format
   */
  async #fallbackSequentialAddComponents(componentSpecs, options) {
    const result = {
      successes: [],
      failures: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      processingTime: 0,
    };

    const startTime = performance.now();

    this.#logger.warn(
      'Batch component addition requested but batch operations are disabled. Falling back to sequential processing.'
    );

    // This would need ComponentMutationService to be available
    // For now, we'll just return an error since this is a lifecycle manager
    result.failures = componentSpecs.map((spec) => ({
      item: spec,
      error: new Error(
        'Component operations not available in EntityLifecycleManager. Use ComponentMutationService.'
      ),
    }));
    result.failureCount = componentSpecs.length;
    result.totalProcessed = componentSpecs.length;

    result.processingTime = performance.now() - startTime;
    return result;
  }

  /**
   * Fallback sequential entity removal when batch operations are disabled.
   *
   * @private
   * @param {string[]} instanceIds - Instance IDs
   * @param {object} options - Options
   * @returns {Promise<object>} Result matching batch operation format
   */
  async #fallbackSequentialRemove(instanceIds, options) {
    const result = {
      successes: [],
      failures: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      processingTime: 0,
    };

    const startTime = performance.now();

    for (const instanceId of instanceIds) {
      result.totalProcessed++;
      try {
        await this.removeEntityInstance(instanceId);
        result.successes.push(instanceId);
        result.successCount++;
      } catch (error) {
        result.failures.push({ item: instanceId, error });
        result.failureCount++;

        if (options.stopOnError) {
          break;
        }
      }
    }

    result.processingTime = performance.now() - startTime;
    return result;
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
    const stats = {
      entityCount: this.#entityRepository.size || 0,
      cacheStats: this.#definitionHelper.getCacheStats(),
      eventStats: this.#eventDispatcher.getStats(),
    };

    // Add monitoring stats if available
    if (this.#monitoringCoordinator) {
      stats.monitoringStats = this.#monitoringCoordinator.getStats();
    }

    return stats;
  }

  /**
   * Creates an entity instance with explicit monitoring.
   * This is a convenience method that ensures monitoring is enabled.
   *
   * @param {string} definitionId - The ID of the entity definition
   * @param {object} [opts] - Options for creation
   * @returns {object} The newly created entity
   * @throws {Error} If creation fails
   */
  async createEntityInstanceWithMonitoring(definitionId, opts = {}) {
    if (!this.#monitoringCoordinator) {
      this.#logger.warn(
        'createEntityInstanceWithMonitoring called but monitoring is disabled'
      );
      return this.createEntityInstance(definitionId, opts);
    }

    return await this.#monitoringCoordinator.executeMonitored(
      'createEntityInstance',
      () => this.#createEntityInstanceCore(definitionId, opts),
      { context: `definition:${definitionId}` }
    );
  }

  /**
   * Gets monitoring statistics if monitoring is enabled.
   *
   * @returns {object|null} Monitoring statistics or null if disabled
   */
  getMonitoringStats() {
    return this.#monitoringCoordinator
      ? this.#monitoringCoordinator.getStats()
      : null;
  }

  /**
   * Gets circuit breaker status for a specific operation.
   *
   * @param {string} operationName - Name of the operation
   * @returns {object|null} Circuit breaker status or null if disabled
   */
  getCircuitBreakerStatus(operationName) {
    if (!this.#monitoringCoordinator) {
      return null;
    }

    const circuitBreaker =
      this.#monitoringCoordinator.getCircuitBreaker(operationName);
    return circuitBreaker.getStats();
  }

  /**
   * Clears definition cache.
   */
  clearCache() {
    this.#definitionHelper.clearCache();
  }

  /**
   * Sets the batch operation manager after construction.
   * This is used to resolve circular dependencies between EntityLifecycleManager and BatchOperationManager.
   *
   * @param {IBatchOperationManager} batchOperationManager - The batch operation manager
   */
  setBatchOperationManager(batchOperationManager) {
    if (!this.#enableBatchOperations) {
      this.#logger.warn(
        'Setting batch operation manager but batch operations are disabled'
      );
      return;
    }

    validateDependency(
      batchOperationManager,
      'BatchOperationManager',
      this.#logger,
      {
        requiredMethods: [
          'batchCreateEntities',
          'batchAddComponents',
          'batchRemoveEntities',
        ],
      }
    );

    this.#batchOperationManager = batchOperationManager;
    this.#logger.debug('Batch operation manager set');
  }
}

export default EntityLifecycleManager;
