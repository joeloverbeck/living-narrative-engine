// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/IWorldContext.js').default} IWorldContext */
/** @typedef {import('../data/gameDataRepository.js').default} GameDataRepository */
/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../data/schemas/entity-definition.schema.json').EntityDefinition} EntityDefinition */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityDefinition.js').default} EntityDefinition */
/** @typedef {import('../entities/entityInstance.js').default} EntityInstance */
/** @typedef {import('../interfaces/IDataRegistry.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../scopeDsl/scopeRegistry.js').default} ScopeRegistry */

// --- Library Imports ---
import _get from 'lodash/get.js';
import _set from 'lodash/set.js';

// --- Constant Imports ---
import { POSITION_COMPONENT_ID } from '../constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';
import { WORLDINIT_ENTITY_INSTANTIATED_ID, WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID } from '../constants/eventIds.js';

// --- Utility Imports ---
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';

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
  /** @type {EntityManager} */
  #entityManager;
  /** @type {IWorldContext} */
  #worldContext;
  /** @type {GameDataRepository} */
  #repository;
  /** @type {ValidatedEventDispatcher} */
  #validatedEventDispatcher;
  /** @type {ILogger} */
  #logger;
  /** @type {ScopeRegistry} */
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
   * Initializes the ScopeRegistry with loaded scopes from the data registry.
   * This should be called after mods are loaded but before world entities are initialized.
   *
   * @returns {Promise<void>}
   */
  async initializeScopeRegistry() {
    this.#logger.debug(
      'WorldInitializer: Initializing ScopeRegistry with loaded scopes...'
    );

    try {
      const loadedScopes = this.#repository.get('scopes') || {};

      this.#scopeRegistry.initialize(loadedScopes);

      this.#logger.info(
        `WorldInitializer: ScopeRegistry initialized with ${Object.keys(loadedScopes).length} scopes.`
      );
    } catch (error) {
      this.#logger.error(
        'WorldInitializer: Failed to initialize ScopeRegistry:',
        error
      );
      // Don't throw - scope initialization failure shouldn't prevent world initialization
    }
  }

  /**
   * Creates an instance of WorldInitializer.
   *
   * @param {object} dependencies
   * @param {EntityManager} dependencies.entityManager
   * @param {IWorldContext} dependencies.worldContext
   * @param {GameDataRepository} dependencies.gameDataRepository
   * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher
   * @param {ILogger} dependencies.logger
   * @param {ScopeRegistry} dependencies.scopeRegistry
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
    if (!entityManager)
      throw new Error('WorldInitializer requires an EntityManager.');
    if (!worldContext)
      throw new Error('WorldInitializer requires a WorldContext.');
    if (!gameDataRepository)
      throw new Error('WorldInitializer requires a GameDataRepository.');
    if (!validatedEventDispatcher)
      throw new Error('WorldInitializer requires a ValidatedEventDispatcher.');
    if (!logger) throw new Error('WorldInitializer requires an ILogger.');
    if (!scopeRegistry)
      throw new Error('WorldInitializer requires a ScopeRegistry.');

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
   * Helper method to dispatch world initialization related events with standardized error logging.
   *
   * @param {string} eventName - The name of the event.
   * @param {object} payload - The event payload.
   * @param {string} identifierForLog - An identifier (e.g., entity ID, definition ID) for logging purposes if dispatch fails.
   * @private
   */
  async #_dispatchWorldInitEvent(eventName, payload, identifierForLog) {
    try {
      await this.#validatedEventDispatcher.dispatch(eventName, payload, {
        allowSchemaNotFound: true,
      });
      this.#logger.debug(
        `WorldInitializer (EventDispatch): Successfully dispatched '${eventName}' for ${identifierForLog}.`
      );
    } catch (e) {
      this.#logger.error(
        `WorldInitializer (EventDispatch): Failed dispatching '${eventName}' event for ${identifierForLog}. Error:`,
        e
      );
    }
  }

  /**
   * Instantiates entities from the specified world's instances array. (Pass 1)
   * Dispatches 'worldinit:entity_instantiated' or 'worldinit:entity_instantiation_failed' events.
   *
   * @param {string} worldName - The name of the world to instantiate entities from.
   * @returns {Promise<{entities: Entity[], instantiatedCount: number, failedCount: number, totalProcessed: number}>} An object containing the list of instantiated entities and counts.
   * @private
   */
  async #_instantiateEntitiesFromWorld(worldName) {
    this.#logger.debug(
      `WorldInitializer (Pass 1): Instantiating entities from world: ${worldName}...`
    );
    let instantiatedCount = 0;
    let failedCount = 0;
    /** @type {Entity[]} */
    const instantiatedEntities = [];

    const worldData = this.#repository.getWorld(worldName);
    if (!worldData) {
      safeDispatchError(
        this.#validatedEventDispatcher,
        `World '${worldName}' not found. The game cannot start without a valid world.`,
        {
          statusCode: 500,
          raw: `World '${worldName}' not available in game data repository. Context: WorldInitializer._instantiateEntitiesFromWorld, worldName: ${worldName}, repositoryMethod: getWorld`,
          timestamp: new Date().toISOString(),
        }
      );
      throw new Error(
        `Game cannot start: World '${worldName}' not found in the world data. Please ensure the world is properly defined.`
      );
    }

    if (
      !worldData.instances ||
      !Array.isArray(worldData.instances)
      // Allow zero instances for worlds that might be empty by design or during setup
    ) {
      this.#logger.warn(
        `WorldInitializer (Pass 1): World '${worldName}' has no instances array or it's not an array. Proceeding with zero instances.`
      );
      // Even if instances array is missing/invalid, we consider it "processed" with 0 success/failures.
      return { entities: [], instantiatedCount: 0, failedCount: 0, totalProcessed: 0 };
    }
    
    const totalProcessed = worldData.instances.length;

    this.#logger.debug(
      `WorldInitializer (Pass 1): Found ${totalProcessed} instances in world '${worldName}'.`
    );

    for (const worldInstance of worldData.instances) {
      if (!worldInstance || !worldInstance.instanceId) {
        this.#logger.warn(
          `WorldInitializer (Pass 1): Skipping invalid world instance (missing instanceId):`,
          worldInstance
        );
        failedCount++;
        continue;
      }

      const { instanceId } = worldInstance;
      
      const entityInstanceDef = this.#repository.getEntityInstanceDefinition(instanceId);

      if (!entityInstanceDef) {
        const errorMessage = `Entity instance definition not found for instance ID: '${instanceId}'. Referenced in world '${worldName}'.`;
        this.#logger.warn(`WorldInitializer (Pass 1): ${errorMessage} Skipping.`);
        safeDispatchError(
            this.#validatedEventDispatcher,
            errorMessage,
            {
                statusCode: 404, // Not Found
                raw: `Context: WorldInitializer._instantiateEntitiesFromWorld, instanceId: ${instanceId}, worldName: ${worldName}`,
                type: 'MissingResource',
                resourceType: 'EntityInstanceDefinition',
                resourceId: instanceId,
            }
        );
        failedCount++;
        continue;
      }

      const definitionId = entityInstanceDef.definitionId;
      if (!definitionId) {
        this.#logger.warn(
          `WorldInitializer (Pass 1): Entity instance definition '${instanceId}' is missing a definitionId. Skipping.`
        );
        failedCount++;
        continue;
      }
      
      const componentOverrides = entityInstanceDef.componentOverrides;

      this.#logger.debug(
        `WorldInitializer (Pass 1): Attempting to create entity instance '${instanceId}' from definition '${definitionId}' with overrides:`,
        componentOverrides
      );
      
      let instance = null;
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
          instance = null; // Ensure instance is null if creation threw
      }


      if (instance) {
        this.#logger.debug(
          `WorldInitializer (Pass 1): Successfully instantiated entity ${instance.id} (from definition: ${instance.definitionId})`
        );
        instantiatedEntities.push(instance);
        instantiatedCount++;

        await this.#_dispatchWorldInitEvent(
          WORLDINIT_ENTITY_INSTANTIATED_ID,
          {
            entityId: instance.id,
            instanceId: instance.instanceId, // Added for consistency
            definitionId: instance.definitionId,
            worldName: worldName, // Added for context
            reason: 'Initial World Load',
          },
          `entity ${instance.id}`
        );
      } else {
        this.#logger.error(
          `WorldInitializer (Pass 1): Failed to instantiate entity from definition: ${definitionId} for instance: ${instanceId}. createEntityInstance returned null/undefined or threw an error.`
        );
        failedCount++;
        await this.#_dispatchWorldInitEvent(
          WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
          { 
            instanceId, 
            definitionId, 
            worldName: worldName, // Added for context
            error: `Failed to create entity instance. EntityManager returned null/undefined or threw an error.`,
            reason: 'Initial World Load' 
          },
          `instance ${instanceId}`
        );
      }
    }
    this.#logger.debug(
      `WorldInitializer (Pass 1): Completed. Instantiated ${instantiatedCount} entities, ${failedCount} failures out of ${totalProcessed} total instances for world '${worldName}'.`
    );
    return { entities: instantiatedEntities, instantiatedCount, failedCount, totalProcessed };
  }

  /**
   * Resolves field references for all components of a single entity using the ReferenceResolver.
   * Iterates through the entity's components and their 'resolveFields' specifications.
   *
   * @param {Entity} entity - The entity whose components need reference resolution.
   * @private
   * @throws {Error} If a critical error occurs during component iteration that should halt processing for this entity.
   */
  async #_resolveReferencesForEntityComponents(entity) {
    this.#logger.debug(
      `WorldInitializer (Pass 2 RefResolution): Processing entity ${entity.id}. This step is mostly a no-op as 'resolveFields' is deprecated.`
    );

    // The following logic is largely deprecated as componentDefinition.resolveFields is being removed.
    // Kept for informational purposes during transition, but will not execute if resolveFields is absent.
    const entriesIterable = entity.componentEntries;

    if (
      entriesIterable &&
      typeof entriesIterable[Symbol.iterator] === 'function'
    ) {
      const iterator = entriesIterable[Symbol.iterator]();
      if (!(iterator && typeof iterator.next === 'function')) {
        this.#logger.warn(
          `WorldInitializer (Pass 2 RefResolution): Entity ${entity.id} componentEntries[Symbol.iterator]() did not return a valid iterator. Skipping component processing for this entity.`
        );
        return;
      }
    } else {
      this.#logger.warn(
        `WorldInitializer (Pass 2 RefResolution): Entity ${entity.id} componentEntries IS NOT ITERABLE or is problematic. Value: ${String(entriesIterable)}. Skipping component processing for this entity.`
      );
      return;
    }

    try {
      for (const [componentTypeId, componentDataInstance] of entriesIterable) {
        const componentDefinition =
          this.#repository.getComponentDefinition(componentTypeId);

        if (
          componentDefinition?.resolveFields &&
          Array.isArray(componentDefinition.resolveFields) &&
          componentDefinition.resolveFields.length > 0 // Only proceed if there are actual fields to resolve
        ) {
          this.#logger.warn(
            `WorldInitializer (Pass 2 RefResolution): Entity ${entity.id}, component ${componentTypeId} still has 'resolveFields'. This is a DEPRECATED pattern.`
          );
          // The original loop for processing spec in resolveFields has been removed
          // as ReferenceResolver no longer performs active resolution and resolveFields itself is deprecated.
          // If any component *still* has resolveFields, it will be logged above, but no resolution attempt will be made here.
        } else {
          // This is the expected path for components following the updated schema (no resolveFields)
          this.#logger.debug(
            `WorldInitializer (Pass 2 RefResolution): Entity ${entity.id}, component ${componentTypeId} has no 'resolveFields' to process, or it is empty. (Expected)`
          );
        }

        // Log position component information for debugging
        if (componentTypeId === POSITION_COMPONENT_ID) {
          const locationId = _get(componentDataInstance, 'locationId');
          if (locationId) {
            this.#logger.debug(
              `WorldInitializer (Pass 2 Post-Processing): Entity ${entity.id} has POSITION_COMPONENT_ID with locationId '${locationId}'. Spatial index management is handled by SpatialIndexSynchronizer.`
            );
          } else {
            this.#logger.debug(
              `WorldInitializer (Pass 2 Post-Processing): Entity ${entity.id} has POSITION_COMPONENT_ID but no locationId found in its data.`
            );
          }
        }
      }
    } catch (error) {
      this.#logger.error(
        `WorldInitializer (Pass 2 RefResolution): Error processing components for entity ${entity.id}:`,
        error
      );
      // Decide if this error is critical enough to throw and halt further processing for this entity or all entities.
      // For now, logging and continuing with the next entity or step.
    }
    this.#logger.debug(
      `WorldInitializer (Pass 2 RefResolution): Finished processing components for entity ${entity.id}.`
    );
  }

  /**
   * Processes a single entity for reference resolution during Pass 2.
   * Spatial index management is now handled automatically by SpatialIndexSynchronizer.
   *
   * @param {Entity} entity - The entity to process.
   * @returns {Promise<boolean>} True if the entity was successfully processed, false otherwise.
   * @private
   */
  async #_processSingleEntityForPass2(entity) {
    if (
      !entity ||
      !entity.componentEntries ||
      typeof entity.addComponent !== 'function' ||
      typeof entity.getComponentData !== 'function'
    ) {
      safeDispatchError(
        this.#validatedEventDispatcher,
        `Invalid entity detected during world initialization. Entity ${entity?.id || 'Unknown ID'} is missing required component access methods.`,
        {
          statusCode: 500,
          raw: `Entity validation failed. Context: WorldInitializer._processSingleEntityForPass2, entityId: ${entity?.id || 'Unknown ID'}`,
          timestamp: new Date().toISOString(),
        }
      );
      return false;
    }

    try {
      await this.#_resolveReferencesForEntityComponents(entity);
      return true; // Successfully processed
    } catch (resolutionError) {
      // This catches the error re-thrown by #_resolveReferencesForEntityComponents
      this.#logger.warn(
        `WorldInitializer (Pass 2 Processing): Entity ${entity.id} failed component reference resolution. Error: ${resolutionError.message}`
      );
      return false; // Failed processing for this entity
    }
  }

  /**
   * Resolves component references for the given entities. (Pass 2)
   * Spatial index population is now handled automatically by SpatialIndexSynchronizer.
   *
   * @param {Entity[]} instantiatedEntities - An array of entities instantiated in Pass 1.
   * @private
   */
  async #_resolveReferencesForEntities(instantiatedEntities) {
    this.#logger.debug(
      'WorldInitializer (Pass 2): Resolving component references for entities...'
    );
    let entitiesProcessed = 0;

    for (const entity of instantiatedEntities) {
      const wasSuccessfullyProcessed =
        await this.#_processSingleEntityForPass2(entity);
      if (wasSuccessfullyProcessed) {
        entitiesProcessed++;
      }
    }

    this.#logger.debug(
      `WorldInitializer (Pass 2): Completed entity processing. Processed ${instantiatedEntities.length} entities. Successfully processed ${entitiesProcessed} entities.`
    );
  }

  /**
   * Instantiates initial world entities from the specified world's instances and resolves references (like location IDs).
   * Spatial index management is handled automatically by SpatialIndexSynchronizer through event listening.
   * Dispatches 'initialization:world_initializer:started/completed/failed' events.
   * Dispatches finer-grained 'worldinit:entity_instantiated' and 'worldinit:entity_instantiation_failed' events.
   *
   * @param {string} worldName - The name of the world to initialize entities for.
   * @returns {Promise<{entities: Entity[], instantiatedCount: number, failedCount: number, totalProcessed: number}>} Resolves with an object containing instantiated entities and counts.
   * @throws {Error} If a critical error occurs during initialization that should stop the process (e.g., world not found).
   */
  async initializeWorldEntities(worldName) {
    this.#logger.debug(
      `WorldInitializer: Starting world entity initialization process for world: ${worldName}...`
    );
    // Event 'initialization:world_initializer:started' could be dispatched here if needed.

    try {
      // Initialize ScopeRegistry with loaded scopes
      await this.initializeScopeRegistry();

      const instantiationResult =
        await this.#_instantiateEntitiesFromWorld(worldName);

      if (instantiationResult.entities && instantiationResult.entities.length > 0) {
        await this.#_resolveReferencesForEntities(instantiationResult.entities);
      } else {
        this.#logger.debug(
          'WorldInitializer (Pass 2): Skipped reference resolution. No entities were instantiated in Pass 1 or entities array was empty.'
        );
      }

      this.#logger.debug(
        `WorldInitializer: World entity initialization complete for world: ${worldName}. Instantiated: ${instantiationResult.instantiatedCount}, Failed: ${instantiationResult.failedCount}, Total Processed: ${instantiationResult.totalProcessed}. Spatial index management is handled by SpatialIndexSynchronizer.`
      );
      // Event 'initialization:world_initializer:completed' could be dispatched here.
      return instantiationResult;
    } catch (error) {
      // This catch block primarily handles critical errors like worldData not found
      // from #_instantiateEntitiesFromWorld, or other unexpected errors.
      // Individual entity instantiation failures are handled within #_instantiateEntitiesFromWorld
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
          error // Include the original error object if available
        }
      );
      // Event 'initialization:world_initializer:failed' could be dispatched here.
      throw error; // Always re-throw to indicate initialization failure.
    }
  }
}

export default WorldInitializer;