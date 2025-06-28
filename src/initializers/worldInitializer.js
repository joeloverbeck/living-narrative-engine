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

// --- Library Imports ---

// --- Constant Imports ---
import {
  WORLDINIT_ENTITY_INSTANTIATED_ID,
  WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
} from '../constants/eventIds.js';

// --- Utility Imports ---
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import { dispatchWithLogging } from '../utils/eventDispatchUtils.js';
import { WorldInitializationError } from '../errors/InitializationError.js';
import {
  assertFunction,
  assertPresent,
  assertMethods,
} from '../utils/dependencyValidators.js';

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
  /** @type {IScopeRegistry} */
  #scopeRegistry;

  /**
   * Exposes the provided world context for potential external use.
   *
   * @returns {IWorldContext}
   */
  getWorldContext() {
    return this.#worldContext;
  }

  /**
   * Creates an instance of WorldInitializer.
   *
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {IWorldContext} dependencies.worldContext
   * @param {IGameDataRepository} dependencies.gameDataRepository
   * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher
   * @param {ILogger} dependencies.logger
   * @param {IScopeRegistry} dependencies.scopeRegistry
   * @throws {Error} If any required dependency is missing or invalid.
   */
  constructor({
    entityManager,
    worldContext,
    gameDataRepository,
    validatedEventDispatcher,
    logger,
    scopeRegistry,
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

    this.#entityManager = entityManager;
    this.#worldContext = worldContext;
    this.#repository = gameDataRepository;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#logger = logger;
    this.#scopeRegistry = scopeRegistry;

    this.#logger.debug(
      'WorldInitializer: Instance created. Spatial index management is now handled by SpatialIndexSynchronizer through event listening.'
    );
  }

  /**
   * Loads world data and validates the presence of an instances array.
   *
   * @param {string} worldName - The world identifier.
   * @returns {Promise<{instances: object[], earlyResult?: {entities: Entity[], instantiatedCount: number, failedCount: number, totalProcessed: number}}>} Object containing instances and optional early result.
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
        earlyResult: {
          entities: [],
          instantiatedCount: 0,
          failedCount: 0,
          totalProcessed: 0,
        },
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
   * @returns {Entity|null} The created entity instance or null on failure.
   * @private
   */
  #createInstance(definitionId, instanceId, componentOverrides) {
    this.#logger.debug(
      `WorldInitializer (Pass 1): Attempting to create entity instance '${instanceId}' from definition '${definitionId}' with overrides:`,
      componentOverrides
    );

    let instance;
    try {
      instance = this.#entityManager.createEntityInstance(definitionId, {
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
      await dispatchWithLogging(
        this.#validatedEventDispatcher,
        WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
        {
          instanceId,
          definitionId,
          worldName: worldName,
          error: `Failed to create entity instance. EntityManager returned null/undefined or threw an error.`,
          reason: 'Initial World Load',
        },
        this.#logger,
        `instance ${instanceId}`,
        { allowSchemaNotFound: true }
      );
      return { entity: null, success: false };
    }

    this.#logger.debug(
      `WorldInitializer (Pass 1): Successfully instantiated entity ${instance.id} (from definition: ${instance.definitionId})`
    );

    await dispatchWithLogging(
      this.#validatedEventDispatcher,
      WORLDINIT_ENTITY_INSTANTIATED_ID,
      {
        entityId: instance.id,
        instanceId: instance.instanceId,
        definitionId: instance.definitionId,
        worldName: worldName,
        reason: 'Initial World Load',
      },
      this.#logger,
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

    const instance = this.#createInstance(
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
   * @param {{entities: Entity[], instantiatedCount: number, failedCount: number, totalProcessed: number}} result - Summary object.
   * @returns {{entities: Entity[], instantiatedCount: number, failedCount: number, totalProcessed: number}} The same summary object.
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
   * Instantiates entities from the specified world's instances array. (Pass 1)
   * Dispatches 'worldinit:entity_instantiated' or 'worldinit:entity_instantiation_failed' events.
   *
   * @param {string} worldName - The name of the world to instantiate entities from.
   * @returns {Promise<{entities: Entity[], instantiatedCount: number, failedCount: number, totalProcessed: number}>} An object containing the list of instantiated entities and counts.
   * @private
   */
  async #instantiateEntitiesFromWorld(worldName) {
    this.#logger.debug(
      `WorldInitializer (Pass 1): Instantiating entities from world: ${worldName}...`
    );

    const { instances, earlyResult } = await this.#loadWorldData(worldName);
    if (earlyResult) {
      return this.#dispatchInstantiationSummary(worldName, earlyResult);
    }

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
    };

    return this.#dispatchInstantiationSummary(worldName, result);
  }

  /**
   * Instantiates initial world entities from the specified world's instances.
   * Spatial index management is handled automatically by SpatialIndexSynchronizer through event listening.
   * Dispatches 'initialization:world_initializer:started/completed/failed' events.
   * Dispatches finer-grained 'worldinit:entity_instantiated' and 'worldinit:entity_instantiation_failed' events.
   *
   * @param {string} worldName - The name of the world to initialize entities for.
   * @returns {Promise<{entities: Entity[], instantiatedCount: number, failedCount: number, totalProcessed: number}>} Resolves with an object containing instantiated entities and counts.
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
        await this.#instantiateEntitiesFromWorld(worldName);

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
