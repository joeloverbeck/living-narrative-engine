// src/initializers/worldInitializer.js
// --- FILE START ---
// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/IWorldContext.js').default} IWorldContext */
/** @typedef {import('../data/gameDataRepository.js').default} GameDataRepository */
/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../data/schemas/entity-definition.schema.json').EntityDefinition} EntityDefinition */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').ISpatialIndexManager} ISpatialIndexManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityDefinition.js').default} EntityDefinition */
/** @typedef {import('../entities/entityInstance.js').default} EntityInstance */
/** @typedef {import('../interfaces/IDataRegistry.js').IDataRegistry} IDataRegistry */

// --- Library Imports ---
import _get from 'lodash/get.js';
import _set from 'lodash/set.js';

// --- Constant Imports ---
import { POSITION_COMPONENT_ID } from '../constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';

// --- Utility Imports ---
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';

/**
 * Service responsible for instantiating entities defined
 * in the world data, resolving their references (e.g., location IDs),
 * and building the spatial index. Runs after GameStateInitializer.
 * Dispatches events related to world entity initialization.
 */
class WorldInitializer {
  /** @type {EntityManager} */
  #entityManager;
  /** @type {IWorldContext} */
  #worldContext; // Note: Checked for usage, see review summary.
  /** @type {GameDataRepository} */
  #repository;
  /** @type {ValidatedEventDispatcher} */
  #validatedEventDispatcher;
  /** @type {ILogger} */
  #logger;
  /** @type {ISpatialIndexManager} */
  #spatialIndexManager;
  // /** @type {IReferenceResolver | ReferenceResolver} */
  // #referenceResolver; // ReferenceResolver is being phased out - removed entirely

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
   * @param {EntityManager} dependencies.entityManager
   * @param {IWorldContext} dependencies.worldContext
   * @param {GameDataRepository} dependencies.gameDataRepository
   * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher
   * @param {ILogger} dependencies.logger
   * @param {ISpatialIndexManager} dependencies.spatialIndexManager
   * @throws {Error} If any required dependency is missing or invalid.
   */
  constructor({
    entityManager,
    worldContext,
    gameDataRepository,
    validatedEventDispatcher,
    logger,
    spatialIndexManager,
  }) {
    if (!entityManager)
      throw new Error('WorldInitializer requires an EntityManager.');
    if (!worldContext)
      throw new Error('WorldInitializer requires a WorldContext.'); // Dependency kept for now as per ticket instructions
    if (!gameDataRepository)
      throw new Error('WorldInitializer requires a GameDataRepository.');
    if (!validatedEventDispatcher)
      throw new Error('WorldInitializer requires a ValidatedEventDispatcher.');
    if (!logger) throw new Error('WorldInitializer requires an ILogger.');
    if (!spatialIndexManager)
      throw new Error('WorldInitializer requires an ISpatialIndexManager.');

    this.#entityManager = entityManager;
    this.#worldContext = worldContext;
    this.#repository = gameDataRepository;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#logger = logger;
    this.#spatialIndexManager = spatialIndexManager;
    // this.#referenceResolver = referenceResolver; // No longer assigned - removed entirely

    this.#logger.debug(
      'WorldInitializer: Instance created. Reference resolution step has been removed.'
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
   * Instantiates all entities from their definitions based on data from the repository. (Pass 1)
   * Dispatches 'worldinit:entity_instantiated' or 'worldinit:entity_instantiation_failed' events.
   *
   * @returns {Promise<{entities: Entity[], count: number}>} An object containing the list of instantiated entities and their count.
   * @private
   */
  async #_instantiateAllEntitiesFromDefinitions() {
    this.#logger.debug(
      'WorldInitializer (Pass 1): Instantiating entities from definitions...'
    );
    let totalInstantiatedCount = 0;
    /** @type {Entity[]} */
    const instantiatedEntities = [];

    const allEntityDefinitions =
      this.#repository.getAllEntityDefinitions?.() || [];

    if (allEntityDefinitions.length === 0) {
      this.#logger.error(
        'WorldInitializer (Pass 1): No entity definitions found. Game cannot start without entities.'
      );
      
      // Dispatch system error event with comprehensive payload
      safeDispatchError(
        this.#validatedEventDispatcher,
        'No entity definitions found. The game cannot start without any entities in the world.',
        {
          statusCode: 500,
          raw: 'No entity definitions available in game data repository',
          timestamp: new Date().toISOString(),
          context: 'WorldInitializer._instantiateAllEntitiesFromDefinitions',
          entityDefinitionsCount: 0,
          repositoryMethod: 'getAllEntityDefinitions'
        }
      );
      
      throw new Error('Game cannot start: No entity definitions found in the world data. Please ensure at least one entity is defined.');
    }

    for (const entityDef of allEntityDefinitions) {
      if (!entityDef || !entityDef.id) {
        this.#logger.warn(
          'WorldInitializer (Pass 1): Skipping invalid entity definition (missing or empty id):',
          entityDef
        );
        continue;
      }
      const definitionId = entityDef.id;
      const instance = this.#entityManager.createEntityInstance(definitionId);

      if (instance) {
        // Changed from info to debug for less verbose default logging
        this.#logger.debug(
          `WorldInitializer (Pass 1): Instantiated entity ${instance.id} (from definition: ${instance.definitionId})`
        );
        instantiatedEntities.push(instance);
        totalInstantiatedCount++;

        await this.#_dispatchWorldInitEvent(
          'worldinit:entity_instantiated',
          {
            entityId: instance.id,
            definitionId: instance.definitionId,
            reason: 'Initial World Load',
          },
          `entity ${instance.id}`
        );
      } else {
        this.#logger.warn(
          `WorldInitializer (Pass 1): Failed to instantiate entity from definition: ${definitionId}.`
        );
        await this.#_dispatchWorldInitEvent(
          'worldinit:entity_instantiation_failed',
          { definitionId: definitionId, reason: 'Initial World Load' },
          `definition ${definitionId}`
        );
      }
    }
    this.#logger.debug(
      `WorldInitializer (Pass 1): Completed. Instantiated ${totalInstantiatedCount} total entities.`
    );
    return { entities: instantiatedEntities, count: totalInstantiatedCount };
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

        // Original location update logic - this should remain if still relevant
        // This part seems to be for initializing spatial index based on PositionComponent, not related to resolveFields.
        if (componentTypeId === POSITION_COMPONENT_ID) {
          const locationId = _get(componentDataInstance, 'locationId');
          if (locationId) {
            // Ensure entity is added to spatial index if not already (e.g. by EntityManager upon creation with location)
            // EntityManager now handles entity tracking directly via MapManager.add.
            // Let's confirm if an explicit add here is still needed or if it's redundant.
            // For now, will keep the logging to see if it triggers.
            this.#logger.debug(
              `WorldInitializer (Pass 2 Post-Processing): Entity ${entity.id} has POSITION_COMPONENT_ID with locationId '${locationId}'. Spatial index add/update is handled by EntityManager.`
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
   * Adds a single entity to the spatial index if it has a valid position and location.
   * Checks for the POSITION_COMPONENT_ID and uses its locationId.
   *
   * @param {Entity} entity - The entity to potentially add to the spatial index.
   * @returns {boolean} True if the entity was added to the spatial index, false otherwise.
   * @private
   */
  #_addEntityToSpatialIndex(entity) {
    // Removed async
    const positionComponentData = entity.getComponentData(
      POSITION_COMPONENT_ID
    );
    // POSITION_COMPONENT_ID import is verified.

    if (
      positionComponentData &&
      typeof positionComponentData.locationId === 'string' &&
      positionComponentData.locationId.trim() !== ''
    ) {
      const locationIdForSpatialIndex = positionComponentData.locationId;

      if (locationIdForSpatialIndex.includes(':')) {
        this.#logger.warn(
          `WorldInitializer (Spatial Index): Entity ${entity.id}'s position component locationId '${locationIdForSpatialIndex}' still appears to be an unresolved definitionId. Spatial index might be incorrect if this is not intended.`
        );
      }

      // Check if not an empty string after trim (already done by outer if, but good for clarity)
      // const locationEntity = this.#entityManager.getEntityInstance(locationIdForSpatialIndex); // Not strictly needed to check if location *exists* before adding to spatial index, spatial index handles abstract locations.

      // Original logic based on whether it *looks like* a def ID OR if instance is found.
      // Simplified: The key is whether we have a string ID. The warning above handles the "looks like def ID" case.
      // The spatial index should be able to handle being given an ID that might not (yet) exist as a full entity,
      // as it's primarily a mapping of entity IDs to location IDs.
      this.#spatialIndexManager.addEntity(entity.id, locationIdForSpatialIndex);
      this.#logger.debug(
        `WorldInitializer (Spatial Index): Added entity ${entity.id} to spatial index at location ${locationIdForSpatialIndex}.`
      );
      return true;
    } else if (positionComponentData) {
      this.#logger.debug(
        `WorldInitializer (Spatial Index): Entity ${entity.id} has a position component but missing, malformed, or empty locationId after resolution. Not added to spatial index.`
      );
    } else {
      this.#logger.debug(
        `WorldInitializer (Spatial Index): Entity ${entity.id} has no position component. Not added to spatial index.`
      );
    }
    return false;
  }

  /**
   * Processes a single entity for reference resolution and spatial index population during Pass 2.
   * This involves validating the entity, resolving its component references,
   * and then attempting to add it to the spatial index.
   *
   * @param {Entity} entity - The entity to process.
   * @returns {Promise<boolean>} True if the entity was successfully added to the spatial index, false otherwise.
   * @private
   */
  async #_processSingleEntityForPass2(entity) {
    if (
      !entity ||
      !entity.componentEntries ||
      typeof entity.addComponent !== 'function' ||
      typeof entity.getComponentData !== 'function'
    ) {
      this.#logger.error(
        `WorldInitializer (Pass 2 Processing): Entity ${entity?.id || 'Unknown ID'} is invalid or missing required component access methods. Skipping processing for this entity.`
      );
      return false;
    }

    try {
      await this.#_resolveReferencesForEntityComponents(entity);
    } catch (resolutionError) {
      // This catches the error re-thrown by #_resolveReferencesForEntityComponents
      this.#logger.warn(
        `WorldInitializer (Pass 2 Processing): Entity ${entity.id} failed component reference resolution. Skipping spatial index addition. Error: ${resolutionError.message}`
      );
      return false; // Failed processing for this entity, not added to spatial index
    }

    // Call the now synchronous method for spatial index addition
    const wasAddedToSpatialIndex = this.#_addEntityToSpatialIndex(entity); // Removed await
    return wasAddedToSpatialIndex;
  }

  /**
   * Resolves component references and populates the spatial index for the given entities. (Pass 2)
   * This method iterates through entities, resolving their component references using
   * the ReferenceResolver service and then attempts to add them to the spatial index.
   *
   * @param {Entity[]} instantiatedEntities - An array of entities instantiated in Pass 1.
   * @private
   */
  async #_resolveReferencesAndPopulateSpatialIndex(instantiatedEntities) {
    this.#logger.debug(
      'WorldInitializer (Pass 2): Resolving component references and populating spatial index for entities...'
    );
    let entitiesAddedToSpatialIndex = 0;

    for (const entity of instantiatedEntities) {
      const wasSuccessfullyProcessedAndAdded =
        await this.#_processSingleEntityForPass2(entity);
      if (wasSuccessfullyProcessedAndAdded) {
        entitiesAddedToSpatialIndex++;
      }
    }

    this.#logger.debug(
      `WorldInitializer (Pass 2): Completed entity processing. Processed ${instantiatedEntities.length} entities. Added ${entitiesAddedToSpatialIndex} entities to spatial index.`
    );
  }

  /**
   * Instantiates initial world entities from definitions, resolves references (like location IDs),
   * and builds the spatial index.
   * Dispatches 'initialization:world_initializer:started/completed/failed' events.
   * Dispatches finer-grained 'worldinit:entity_instantiated' and 'worldinit:entity_instantiation_failed' events.
   *
   * @returns {Promise<boolean>} Resolves with true if successful.
   * @throws {Error} If a critical error occurs during initialization that should stop the process.
   */
  async initializeWorldEntities() {
    this.#logger.debug(
      'WorldInitializer: Starting world entity initialization process...'
    );
    // Event 'initialization:world_initializer:started' could be dispatched here if needed.

    try {
      const { entities: instantiatedEntities } =
        await this.#_instantiateAllEntitiesFromDefinitions();

      if (instantiatedEntities && instantiatedEntities.length > 0) {
        await this.#_resolveReferencesAndPopulateSpatialIndex(
          instantiatedEntities
        );
      } else {
        this.#logger.debug(
          'WorldInitializer (Pass 2): Skipped. No entities were instantiated in Pass 1.'
        );
      }

      this.#logger.debug(
        'WorldInitializer: World entity initialization and spatial indexing complete.'
      );
      // Event 'initialization:world_initializer:completed' could be dispatched here.
      return true;
    } catch (error) {
      // The check '!String(error?.message).includes("CRITICAL error during component iteration")'
      // is kept, as per original code. However, as #_processSingleEntityForPass2 catches and handles
      // that specific error without re-throwing it to this level, this condition might not be met
      // for errors originating from component iteration in #_resolveReferencesForEntityComponents.
      // It will catch other critical errors from the promise chain.
      if (
        !String(error?.message).includes(
          'CRITICAL error during component iteration'
        )
      ) {
        this.#logger.error(
          'WorldInitializer: CRITICAL ERROR during entity initialization or reference resolution:',
          error
        );
      }
      // Event 'initialization:world_initializer:failed' could be dispatched here.
      throw error; // Always re-throw to indicate initialization failure.
    }
  }
}

export default WorldInitializer;
// --- FILE END ---
