// --- Type Imports ---
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../data/schemas/entity-definition.schema.json').EntityDefinition} EntityDefinition */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityDefinition.js').default} EntityDefinition */
/** @typedef {import('../entities/entityInstance.js').default} EntityInstance */
/** @typedef {import('../interfaces/IDataRegistry.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/IScopeRegistry.js').IScopeRegistry} IScopeRegistry */
/** @typedef {import('../utils/eventDispatchService.js').EventDispatchService} EventDispatchService */

// --- Library Imports ---

// --- Constant Imports ---
import {
  WORLDINIT_ENTITY_INSTANTIATED_ID,
  WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
} from '../constants/eventIds.js';

/**
 * @description Default result object used when no world instances are processed.
 * @type {{entities: Entity[], instantiatedCount: number, failedCount: number, totalProcessed: number}}
 */
const EMPTY_RESULT = {
  entities: [],
  instantiatedCount: 0,
  failedCount: 0,
  totalProcessed: 0,
};

// --- Utility Imports ---
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import { WorldInitializationError } from '../errors/InitializationError.js';
import {
  assertFunction,
  assertPresent,
  assertMethods,
} from '../utils/dependencyUtils.js';

/**
 * Service responsible for instantiating entities defined
 * in the world data, resolving their references (e.g., location IDs),
 * and building the spatial index. Runs after GameStateInitializer.
 * Dispatches events related to world entity initialization.
 *
 * Note: Spatial index management is now handled automatically by SpatialIndexSynchronizer
 * through event listening, so this service no longer directly manages the spatial index.
 */
class WorldInitializer {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {IWorldContext} */
  #worldContext;
  /** @type {IGameDataRepository} */
  #repository;
  /** @type {ValidatedEventDispatcher} */
  #validatedEventDispatcher;
  /** @type {ILogger} */
  #logger;
  /** @type {EventDispatchService} */
  #eventDispatchService;
  /** @type {object} */
  #config;

  /**
   * Exposes the provided world context for potential external use.
   *
   * @returns {IWorldContext} The current world context
   */
  getWorldContext() {
    return this.#worldContext;
  }

  /**
   * Creates an instance of WorldInitializer.
   *
   * @param {object} dependencies - Injected dependencies
   * @param {IEntityManager} dependencies.entityManager - Entity management service
   * @param {IWorldContext} dependencies.worldContext - World context reference
   * @param {IGameDataRepository} dependencies.gameDataRepository - Repository for game data
   * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher - Event dispatcher
   * @param {EventDispatchService} dependencies.eventDispatchService - Event dispatch service
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {IScopeRegistry} dependencies.scopeRegistry - Registry used for scope initialization
   * @param {object} [dependencies.config] - Configuration object for world loading optimization
   * @throws {Error} If any required dependency is missing or invalid.
   */
  constructor({
    entityManager,
    worldContext,
    gameDataRepository,
    validatedEventDispatcher,
    eventDispatchService,
    logger,
    scopeRegistry,
    config,
  }) {
    assertFunction(
      entityManager,
      'createEntityInstance',
      'WorldInitializer requires an IEntityManager with createEntityInstance().',
      WorldInitializationError
    );
    assertPresent(
      worldContext,
      'WorldInitializer requires a WorldContext.',
      WorldInitializationError
    );
    assertMethods(
      gameDataRepository,
      ['getWorld', 'getEntityInstanceDefinition', 'get'],
      'WorldInitializer requires an IGameDataRepository with getWorld(), getEntityInstanceDefinition(), and get().',
      WorldInitializationError
    );
    assertFunction(
      validatedEventDispatcher,
      'dispatch',
      'WorldInitializer requires a ValidatedEventDispatcher with dispatch().',
      WorldInitializationError
    );
    assertFunction(
      logger,
      'debug',
      'WorldInitializer requires an ILogger.',
      WorldInitializationError
    );
    assertFunction(
      scopeRegistry,
      'initialize',
      'WorldInitializer requires an IScopeRegistry with initialize().',
      WorldInitializationError
    );
    assertFunction(
      eventDispatchService,
      'dispatchWithLogging',
      'WorldInitializer requires an EventDispatchService with dispatchWithLogging().',
      WorldInitializationError
    );

    this.#entityManager = entityManager;
    this.#worldContext = worldContext;
    this.#repository = gameDataRepository;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#eventDispatchService = eventDispatchService;
    this.#logger = logger;
    this.#config = config;

    this.#logger.debug(
      'WorldInitializer: Instance created. Spatial index management is now handled by SpatialIndexSynchronizer through event listening.'
    );
  }

  /**
   * Gets world loading configuration with defaults
   *
   * @returns {object} World loading configuration object
   * @private
   */
  #getWorldLoadingConfig() {
    return {
      ENABLE_WORLD_LOADING_OPTIMIZATION:
        this.#config?.isFeatureEnabled?.(
          'performance.ENABLE_WORLD_LOADING_OPTIMIZATION'
        ) ?? true,
      WORLD_LOADING_BATCH_SIZE:
        this.#config?.getValue?.('performance.WORLD_LOADING_BATCH_SIZE') ?? 25,
      WORLD_LOADING_MAX_BATCH_SIZE:
        this.#config?.getValue?.('performance.WORLD_LOADING_MAX_BATCH_SIZE') ??
        100,
      WORLD_LOADING_ENABLE_PARALLEL:
        this.#config?.getValue?.('performance.WORLD_LOADING_ENABLE_PARALLEL') ??
        true,
      WORLD_LOADING_BATCH_THRESHOLD:
        this.#config?.getValue?.('performance.WORLD_LOADING_BATCH_THRESHOLD') ??
        5,
      WORLD_LOADING_TIMEOUT_MS:
        this.#config?.getValue?.('performance.WORLD_LOADING_TIMEOUT_MS') ??
        30000,
    };
  }

  /**
   * Determines if batch operations should be used for world loading
   *
   * @param {number} entityCount - Number of entities to create
   * @returns {boolean} Whether to use batch operations
   * @private
   */
  #shouldUseBatchOperations(entityCount) {
    const config = this.#getWorldLoadingConfig();

    return (
      config.ENABLE_WORLD_LOADING_OPTIMIZATION &&
      this.#entityManager.hasBatchSupport?.() &&
      entityCount >= config.WORLD_LOADING_BATCH_THRESHOLD
    );
  }

  /**
   * Determines optimal batch size based on world entity count
   *
   * @param {number} entityCount - Number of entities to create
   * @returns {number} Optimal batch size
   * @private
   */
  #getBatchSizeForWorld(entityCount) {
    const config = this.#getWorldLoadingConfig();

    if (entityCount <= config.WORLD_LOADING_BATCH_THRESHOLD) {
      return entityCount; // Process small worlds in single batch
    }

    // Scale batch size based on entity count
    const baseBatchSize = config.WORLD_LOADING_BATCH_SIZE;
    const maxBatchSize = config.WORLD_LOADING_MAX_BATCH_SIZE;

    // For large worlds, use larger batches but cap at maximum
    const scaledBatchSize = Math.min(
      Math.ceil(entityCount / 4), // Quarter of total entities
      maxBatchSize
    );

    return Math.max(baseBatchSize, scaledBatchSize);
  }

  /**
   * Determines if parallel processing should be enabled
   *
   * @returns {boolean} Whether to enable parallel batch processing
   * @private
   */
  #isParallelProcessingEnabled() {
    const config = this.#getWorldLoadingConfig();
    return config.WORLD_LOADING_ENABLE_PARALLEL;
  }

  /**
   * Validates a world instance and creates a batch entity specification
   *
   * @param {object} worldInstance - Instance from world definition
   * @param {string} worldName - World name for context
   * @param {Set<string>} seenIds - Set to track duplicate instance IDs
   * @returns {Promise<object|null>} Entity specification or null if invalid
   * @private
   */
  async #validateAndPrepareSpec(worldInstance, worldName, seenIds) {
    // Check for valid instanceId
    if (!worldInstance?.instanceId) {
      this.#logger.warn(
        `Invalid world instance (missing instanceId):`,
        worldInstance
      );
      return null;
    }

    // Check for duplicates
    if (seenIds.has(worldInstance.instanceId)) {
      this.#logger.error(
        `Duplicate instanceId '${worldInstance.instanceId}' encountered. Skipping.`
      );
      return null;
    }
    seenIds.add(worldInstance.instanceId);

    // Validate instance definition
    const validation = this.#validateInstanceDefinition(
      worldInstance.instanceId,
      worldName
    );
    if (!validation) {
      return null;
    }

    const { definitionId, componentOverrides } = validation;

    return {
      definitionId,
      opts: {
        instanceId: worldInstance.instanceId,
        componentOverrides,
      },
    };
  }

  /**
   * Prepares entity specifications for batch creation
   *
   * @param {object[]} instances - World instance definitions
   * @param {string} worldName - World name for context
   * @returns {Promise<{entitySpecs: object[], validationFailures: number}>} Array of entity specifications and failure count
   * @private
   */
  async #prepareEntitySpecs(instances, worldName) {
    const entitySpecs = [];
    const seenIds = new Set();
    let validationFailures = 0;

    for (const worldInstance of instances) {
      // Validate and prepare each instance
      const spec = await this.#validateAndPrepareSpec(
        worldInstance,
        worldName,
        seenIds
      );
      if (spec) {
        entitySpecs.push(spec);
      } else {
        // Count validation failures (missing definitions, invalid data, etc.)
        validationFailures++;
      }
    }

    return { entitySpecs, validationFailures };
  }

  /**
   * Executes batch entity creation with performance monitoring
   *
   * @param {object[]} entitySpecs - Entity specifications for batch creation
   * @param {string} worldName - World name for context
   * @returns {Promise<object>} Batch operation result
   * @private
   */
  async #executeBatchEntityCreation(entitySpecs, worldName) {
    if (entitySpecs.length === 0) {
      return {
        successes: [],
        failures: [],
        successCount: 0,
        failureCount: 0,
        totalProcessed: 0,
        processingTime: 0,
      };
    }

    this.#logger.info(
      `WorldInitializer: Starting batch entity creation for ${entitySpecs.length} entities in world '${worldName}'`
    );

    const batchOptions = {
      batchSize: this.#getBatchSizeForWorld(entitySpecs.length),
      enableParallel: this.#isParallelProcessingEnabled(),
      stopOnError: false, // Continue processing other entities on individual failures
    };

    const startTime = performance.now();
    const result = await this.#entityManager.batchCreateEntities(
      entitySpecs,
      batchOptions
    );
    const processingTime = performance.now() - startTime;

    this.#logger.info(
      `WorldInitializer: Batch entity creation completed. ` +
        `Success: ${result.successCount}, Failed: ${result.failureCount}, ` +
        `Time: ${processingTime.toFixed(2)}ms`
    );

    return { ...result, processingTime };
  }

  /**
   * Processes batch operation results and dispatches appropriate events
   *
   * @param {object} batchResult - Result from batch entity creation
   * @param {string} worldName - World name for context
   * @param {number} totalInstances - Total instances processed
   * @param {number} validationFailures - Number of validation failures during preparation
   * @returns {Promise<object>} Final initialization result
   * @private
   */
  async #processBatchResults(
    batchResult,
    worldName,
    totalInstances,
    validationFailures = 0
  ) {
    const result = {
      entities: batchResult.successes || [],
      instantiatedCount: batchResult.successCount || 0,
      failedCount: (batchResult.failureCount || 0) + validationFailures,
      totalProcessed: totalInstances,
      processingTime: batchResult.processingTime || 0,
      optimizationUsed: 'batch',
    };

    // Dispatch success events for batch-created entities
    for (const entity of result.entities) {
      await this.#eventDispatchService.dispatchWithLogging(
        WORLDINIT_ENTITY_INSTANTIATED_ID,
        {
          entityId: entity.id,
          instanceId: entity.instanceId,
          definitionId: entity.definitionId,
          worldName: worldName,
          reason: 'Initial World Load (Batch)',
        },
        `entity ${entity.id}`,
        { allowSchemaNotFound: true }
      );
    }

    // Dispatch failure events for failed entities
    for (const failure of batchResult.failures || []) {
      await this.#eventDispatchService.dispatchWithLogging(
        WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
        {
          instanceId: failure.item?.opts?.instanceId,
          definitionId: failure.item?.definitionId,
          worldName: worldName,
          error: failure.error?.message || 'Batch creation failed',
          reason: 'Initial World Load (Batch)',
        },
        `instance ${failure.item?.opts?.instanceId}`,
        { allowSchemaNotFound: true }
      );
    }

    return this.#dispatchInstantiationSummary(worldName, result);
  }

  /**
   * Enhanced entity instantiation with batch operations support
   *
   * @param {string} worldName - The world identifier
   * @returns {Promise<object>} Enhanced result with performance metrics
   * @private
   */
  async #instantiateEntitiesFromWorldBatch(worldName) {
    const { instances, earlyResult } = await this.#loadWorldData(worldName);
    if (earlyResult) {
      return this.#dispatchInstantiationSummary(worldName, earlyResult);
    }

    // Check if batch operations should be used
    if (!this.#shouldUseBatchOperations(instances.length)) {
      return await this.#instantiateEntitiesFromWorldSequential(
        worldName,
        instances
      );
    }

    try {
      // Prepare batch entity specifications
      const { entitySpecs, validationFailures } =
        await this.#prepareEntitySpecs(instances, worldName);

      // Execute batch entity creation
      const batchResult = await this.#executeBatchEntityCreation(
        entitySpecs,
        worldName
      );

      // Check for critical failures that require fallback
      const shouldFallback = await this.#handleBatchFailures(
        batchResult,
        worldName
      );
      if (shouldFallback) {
        return await this.#fallbackToSequentialProcessing(
          worldName,
          instances,
          'Critical batch failures detected'
        );
      }

      // Process batch results and dispatch events
      return await this.#processBatchResults(
        batchResult,
        worldName,
        instances.length,
        validationFailures
      );
    } catch (error) {
      this.#logger.error(
        `WorldInitializer: Batch operation failed for world '${worldName}'. Falling back to sequential processing.`,
        error
      );

      // Fallback to sequential processing on any batch operation failure
      return await this.#fallbackToSequentialProcessing(
        worldName,
        instances,
        `Batch operation error: ${error.message}`
      );
    }
  }

  /**
   * Fallback sequential entity instantiation (existing implementation preserved)
   *
   * @param {string} worldName - The world identifier
   * @param {object[]} instances - World instances array
   * @returns {Promise<object>} Result from sequential processing
   * @private
   */
  async #instantiateEntitiesFromWorldSequential(worldName, instances) {
    this.#logger.debug(
      `WorldInitializer (Sequential): Processing ${instances.length} entities for world '${worldName}'`
    );

    /** @type {Entity[]} */
    const instantiatedEntities = [];
    let instantiatedCount = 0;
    let failedCount = 0;
    const seenIds = new Set();

    for (const worldInstance of instances) {
      if (this.#hasDuplicateInstanceId(seenIds, worldInstance)) {
        continue;
      }

      const { instantiated, failed } = await this.#processInstance(
        worldName,
        worldInstance,
        instantiatedEntities
      );

      instantiatedCount += instantiated;
      failedCount += failed;
    }

    const result = {
      entities: instantiatedEntities,
      instantiatedCount,
      failedCount,
      totalProcessed: instances.length,
      optimizationUsed: 'sequential',
    };

    return this.#dispatchInstantiationSummary(worldName, result);
  }

  /**
   * Classifies and handles batch operation errors
   *
   * @param {Error} error - Error to classify
   * @param {object} _context - Error context information (unused)
   * @returns {string} Error classification
   * @private
   */
  #classifyBatchError(error, _context) {
    if (error.name === 'ValidationError') {
      return 'validation';
    }
    if (error.name === 'EntityNotFoundError') {
      return 'definition_missing';
    }
    if (error.message.includes('timeout')) {
      return 'timeout';
    }
    if (error.name === 'RepositoryConsistencyError') {
      return 'consistency';
    }
    return 'unknown';
  }

  /**
   * Handles batch operation failures with appropriate fallback strategies
   *
   * @param {object} batchResult - Result from batch operation
   * @param {string} worldName - World name for context
   * @returns {Promise<boolean>} Whether to retry with sequential processing
   * @private
   */
  async #handleBatchFailures(batchResult, worldName) {
    const criticalFailures = batchResult.failures?.filter((failure) => {
      const errorType = this.#classifyBatchError(failure.error, failure.item);
      return errorType === 'consistency' || errorType === 'timeout';
    });

    if (criticalFailures?.length > 0) {
      this.#logger.error(
        `WorldInitializer: Critical failures detected in batch operation for world '${worldName}'. ` +
          `Falling back to sequential processing.`
      );
      return true; // Retry with sequential processing
    }

    // Log individual failures but continue with batch results
    for (const failure of batchResult.failures || []) {
      this.#logger.warn(
        `WorldInitializer: Failed to create entity in batch: ${failure.item?.opts?.instanceId}`,
        failure.error
      );
    }

    return false; // Continue with batch results
  }

  /**
   * Implements graceful fallback from batch to sequential processing
   *
   * @param {string} worldName - World name
   * @param {object[]} instances - World instances array
   * @param {string} reason - Reason for fallback
   * @returns {Promise<object>} Result from fallback processing
   * @private
   */
  async #fallbackToSequentialProcessing(worldName, instances, reason) {
    this.#logger.info(
      `WorldInitializer: Falling back to sequential processing for world '${worldName}'. Reason: ${reason}`
    );

    const result = await this.#instantiateEntitiesFromWorldSequential(
      worldName,
      instances
    );

    return {
      ...result,
      optimizationUsed: 'sequential_fallback',
      fallbackReason: reason,
    };
  }

  /**
   * Loads world data and validates the presence of an instances array.
   *
   * @param {string} worldName - The world identifier.
   * @returns {Promise<{instances: object[], earlyResult?: typeof EMPTY_RESULT}>} Object containing instances and optional early result.
   * @private
   */
  async #loadWorldData(worldName) {
    const worldData = this.#repository.getWorld(worldName);
    if (!worldData) {
      safeDispatchError(
        this.#validatedEventDispatcher,
        `World '${worldName}' not found. The game cannot start without a valid world.`,
        {
          statusCode: 500,
          raw: `World '${worldName}' not available in game data repository. Context: WorldInitializer.instantiateEntitiesFromWorld, worldName: ${worldName}, repositoryMethod: getWorld`,
          timestamp: new Date().toISOString(),
        }
      );
      throw new WorldInitializationError(
        `Game cannot start: World '${worldName}' not found in the world data. Please ensure the world is properly defined.`
      );
    }

    if (!worldData.instances || !Array.isArray(worldData.instances)) {
      this.#logger.warn(
        `WorldInitializer (Pass 1): World '${worldName}' has no instances array or it's not an array. Proceeding with zero instances.`
      );
      return {
        instances: [],
        earlyResult: EMPTY_RESULT,
      };
    }

    this.#logger.debug(
      `WorldInitializer (Pass 1): Found ${worldData.instances.length} instances in world '${worldName}'.`
    );

    return { instances: worldData.instances };
  }

  /**
   * Validates and retrieves the entity instance definition for a given instance.
   *
   * @param {string} instanceId - The instance identifier.
   * @param {string} worldName - Name of the world currently being initialized.
   * @returns {{definitionId: string, componentOverrides: object}|null} The
   *   resolved definition data or null if validation fails.
   * @private
   */
  #validateInstanceDefinition(instanceId, worldName) {
    const entityInstanceDef =
      this.#repository.getEntityInstanceDefinition(instanceId);

    if (!entityInstanceDef) {
      const errorMessage = `Entity instance definition not found for instance ID: '${instanceId}'. Referenced in world '${worldName}'.`;
      this.#logger.warn(`WorldInitializer (Pass 1): ${errorMessage} Skipping.`);
      safeDispatchError(this.#validatedEventDispatcher, errorMessage, {
        statusCode: 404,
        raw: `Context: WorldInitializer.instantiateEntitiesFromWorld, instanceId: ${instanceId}, worldName: ${worldName}`,
        type: 'MissingResource',
        resourceType: 'EntityInstanceDefinition',
        resourceId: instanceId,
      });
      return null;
    }

    const { definitionId, componentOverrides } = entityInstanceDef;
    if (!definitionId) {
      this.#logger.warn(
        `WorldInitializer (Pass 1): Entity instance definition '${instanceId}' is missing a definitionId. Skipping.`
      );
      return null;
    }

    return { definitionId, componentOverrides };
  }

  /**
   * Creates an entity instance from a definition using the entity manager.
   *
   * @param {string} definitionId - The definition ID to instantiate from.
   * @param {string} instanceId - The instance identifier for the new entity.
   * @param {object} [componentOverrides] - Optional component overrides.
   * @returns {Promise<Entity|null>} The created entity instance or null on failure.
   * @private
   */
  async #createInstance(definitionId, instanceId, componentOverrides) {
    this.#logger.debug(
      `WorldInitializer (Pass 1): Attempting to create entity instance '${instanceId}' from definition '${definitionId}' with overrides:`,
      componentOverrides
    );

    let instance;
    try {
      instance = await this.#entityManager.createEntityInstance(definitionId, {
        instanceId,
        componentOverrides,
      });

    } catch (creationError) {
      this.#logger.error(
        `WorldInitializer (Pass 1): Error during createEntityInstance for instanceId '${instanceId}', definitionId '${definitionId}':`,
        creationError
      );
    }

    return instance || null;
  }

  /**
   * Dispatches instantiation success or failure events and returns the result.
   *
   * @param {{instanceId: string, id?: string, definitionId?: string}|Entity|null} instance - The created entity or a placeholder containing instanceId.
   * @param {string} definitionId - The definition ID used for creation.
   * @param {string} worldName - The world name for logging and event payloads.
   * @returns {Promise<{entity: Entity|null, success: boolean}>} Result object.
   * @private
   */
  async #dispatchInstantiationEvents(instance, definitionId, worldName) {
    const instanceId = instance?.instanceId;

    if (!instance || !instance.id) {
      this.#logger.error(
        `WorldInitializer (Pass 1): Failed to instantiate entity from definition: ${definitionId} for instance: ${instanceId}. createEntityInstance returned null/undefined or threw an error.`
      );
      await this.#eventDispatchService.dispatchWithLogging(
        WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
        {
          instanceId,
          definitionId,
          worldName: worldName,
          error: `Failed to create entity instance. EntityManager returned null/undefined or threw an error.`,
          reason: 'Initial World Load',
        },
        `instance ${instanceId}`,
        { allowSchemaNotFound: true }
      );
      return { entity: null, success: false };
    }

    this.#logger.debug(
      `WorldInitializer (Pass 1): Successfully instantiated entity ${instance.id} (from definition: ${instance.definitionId})`
    );

    await this.#eventDispatchService.dispatchWithLogging(
      WORLDINIT_ENTITY_INSTANTIATED_ID,
      {
        entityId: instance.id,
        instanceId: instance.instanceId,
        definitionId: instance.definitionId,
        worldName: worldName,
        reason: 'Initial World Load',
      },
      `entity ${instance.id}`,
      { allowSchemaNotFound: true }
    );

    return { entity: instance, success: true };
  }

  /**
   * Creates an entity instance from a world instance definition and dispatches events.
   *
   * @param {string} worldName - Name of the world currently being initialized.
   * @param {object} worldInstance - Instance descriptor from the world file.
   * @returns {Promise<{entity: Entity|null, success: boolean}>} Instantiation result.
   * @private
   */
  async #instantiateInstance(worldName, worldInstance) {
    if (!worldInstance || !worldInstance.instanceId) {
      this.#logger.warn(
        `WorldInitializer (Pass 1): Skipping invalid world instance (missing instanceId):`,
        worldInstance
      );
      return { entity: null, success: false };
    }

    const { instanceId } = worldInstance;

    const validation = this.#validateInstanceDefinition(instanceId, worldName);
    if (!validation) {
      return { entity: null, success: false };
    }

    const { definitionId, componentOverrides } = validation;

    const instance = await this.#createInstance(
      definitionId,
      instanceId,
      componentOverrides
    );

    return await this.#dispatchInstantiationEvents(
      instance || { instanceId },
      definitionId,
      worldName
    );
  }

  /**
   * Logs the final instantiation summary and returns it.
   *
   * @param {string} worldName - Name of the world being initialized.
   * @param {typeof EMPTY_RESULT} result - Summary object.
   * @returns {typeof EMPTY_RESULT} The same summary object.
   * @private
   */
  #dispatchInstantiationSummary(worldName, result) {
    this.#logger.debug(
      `WorldInitializer (Pass 1): Completed. Instantiated ${result.instantiatedCount} entities, ${result.failedCount} failures out of ${result.totalProcessed} total instances for world '${worldName}'.`
    );
    return result;
  }

  /**
   * Checks if a world instance has a duplicate instanceId and logs an error.
   *
   * @param {Set<string>} seenIds - Set of instanceIds already processed.
   * @param {object} worldInstance - Instance descriptor from the world file.
   * @returns {boolean} True if the instanceId is a duplicate.
   * @private
   */
  #hasDuplicateInstanceId(seenIds, worldInstance) {
    if (seenIds.has(worldInstance.instanceId)) {
      this.#logger.error(
        `WorldInitializer: Duplicate instanceId '${worldInstance.instanceId}' encountered. Skipping duplicate.`
      );
      return true;
    }

    seenIds.add(worldInstance.instanceId);
    return false;
  }

  /**
   * Processes a single world instance by attempting to create it and updating
   * the instantiated entities list.
   *
   * @param {string} worldName - Name of the world currently being initialized.
   * @param {object} worldInstance - Instance descriptor from the world file.
   * @param {Entity[]} instantiatedEntities - Array collecting successfully created entities.
   * @returns {Promise<{instantiated: number, failed: number}>} Counts resulting from processing the instance.
   * @private
   */
  async #processInstance(worldName, worldInstance, instantiatedEntities) {
    const { entity, success } = await this.#instantiateInstance(
      worldName,
      worldInstance
    );

    if (success && entity) {
      instantiatedEntities.push(entity);
      return { instantiated: 1, failed: 0 };
    }

    return { instantiated: 0, failed: 1 };
  }

  /**
   * Instantiates initial world entities from the specified world's instances.
   * Spatial index management is handled automatically by SpatialIndexSynchronizer through event listening.
   * Dispatches 'initialization:world_initializer:started/completed/failed' events.
   * Dispatches finer-grained 'worldinit:entity_instantiated' and 'worldinit:entity_instantiation_failed' events.
   *
   * @param {string} worldName - The name of the world to initialize entities for.
   * @returns {Promise<typeof EMPTY_RESULT>} Resolves with an object containing instantiated entities and counts.
   * @throws {Error} If a critical error occurs during initialization that should stop the process (e.g., world not found).
   */
  async initializeWorldEntities(worldName) {
    if (typeof worldName !== 'string' || !worldName.trim()) {
      throw new Error(
        'initializeWorldEntities requires a valid worldName string.'
      );
    }
    this.#logger.debug(
      `WorldInitializer: Starting world entity initialization process for world: ${worldName}...`
    );
    // Event 'initialization:world_initializer:started' could be dispatched here if needed.

    try {
      // Note: ScopeRegistry initialization is now handled by InitializationService
      // before this method is called, so we don't need to initialize it here

      const instantiationResult =
        await this.#instantiateEntitiesFromWorldBatch(worldName);

      // Pass 2 (reference resolution) has been removed as it's no longer needed
      // with data-driven entity instances. Spatial index management is handled
      // automatically by SpatialIndexSynchronizer through event listening.

      this.#logger.debug(
        `WorldInitializer: World entity initialization complete for world: ${worldName}. Instantiated: ${instantiationResult.instantiatedCount}, Failed: ${instantiationResult.failedCount}, Total Processed: ${instantiationResult.totalProcessed}. Spatial index management is handled by SpatialIndexSynchronizer.`
      );
      // Event 'initialization:world_initializer:completed' could be dispatched here.
      return instantiationResult;
    } catch (error) {
      // This catch block primarily handles critical errors like worldData not found
      // from #instantiateEntitiesFromWorld, or other unexpected errors.
      // Individual entity instantiation failures are handled within #instantiateEntitiesFromWorld
      // and are reflected in the failedCount.

      // Log the error before re-throwing.
      this.#logger.error(
        `WorldInitializer: Critical error during entity initialization for world '${worldName}':`,
        error
      );

      safeDispatchError(
        this.#validatedEventDispatcher,
        `Critical error during world initialization for world '${worldName}'. Initialization halted.`,
        {
          statusCode: 500,
          raw: `World initialization failed. Context: WorldInitializer.initializeWorldEntities, worldName: ${worldName}, error: ${error?.message || 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          error, // Include the original error object if available
        }
      );
      // Event 'initialization:world_initializer:failed' could be dispatched here.
      throw error instanceof WorldInitializationError
        ? error
        : new WorldInitializationError(error.message, error); // Always re-throw to indicate initialization failure.
    }
  }
}

export default WorldInitializer;
