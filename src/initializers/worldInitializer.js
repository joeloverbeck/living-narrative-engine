// src/initializers/worldInitializer.js
// --- FILE START ---
// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/IWorldContext.js').default} IWorldContext */ // Assuming IWorldContext is default export
/** @typedef {import('../services/gameDataRepository.js').default} GameDataRepository */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../data/schemas/entity.schema.json').EntityDefinition} EntityDefinition */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').ISpatialIndexManager} ISpatialIndexManager */ // Added for direct use

import {POSITION_COMPONENT_ID} from '../constants/componentIds.js'; // For resolving position

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
    #worldContext; // May not be strictly needed here if EM handles all entity access
    /** @type {GameDataRepository} */
    #repository;
    /** @type {ValidatedEventDispatcher} */
    #validatedEventDispatcher;
    /** @type {ILogger} */
    #logger;
    /** @type {ISpatialIndexManager} */ // Added for direct use
    #spatialIndexManager;


    /**
     * Creates an instance of WorldInitializer.
     * @param {object} dependencies
     * @param {EntityManager} dependencies.entityManager
     * @param {IWorldContext} dependencies.worldContext
     * @param {GameDataRepository} dependencies.gameDataRepository
     * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher
     * @param {ILogger} dependencies.logger
     * @param {ISpatialIndexManager} dependencies.spatialIndexManager - Added dependency
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({
                    entityManager,
                    worldContext,
                    gameDataRepository,
                    validatedEventDispatcher,
                    logger,
                    spatialIndexManager
                }) { // Added spatialIndexManager
        if (!entityManager) throw new Error('WorldInitializer requires an EntityManager.');
        if (!worldContext) throw new Error('WorldInitializer requires a WorldContext.');
        if (!gameDataRepository) throw new Error('WorldInitializer requires a GameDataRepository.');
        if (!validatedEventDispatcher) throw new Error('WorldInitializer requires a ValidatedEventDispatcher.');
        if (!logger) throw new Error('WorldInitializer requires an ILogger.');
        if (!spatialIndexManager) throw new Error('WorldInitializer requires an ISpatialIndexManager.'); // Added check

        this.#entityManager = entityManager;
        this.#worldContext = worldContext;
        this.#repository = gameDataRepository;
        this.#validatedEventDispatcher = validatedEventDispatcher;
        this.#logger = logger;
        this.#spatialIndexManager = spatialIndexManager; // Store dependency

        this.#logger.info('WorldInitializer: Instance created.');
    }

    /**
     * Instantiates initial world entities from definitions, resolves references (like location IDs),
     * and builds the spatial index.
     * Dispatches 'initialization:world_initializer:started/completed/failed' events.
     * Dispatches finer-grained 'worldinit:entity_instantiated' and 'worldinit:entity_instantiation_failed' events.
     * @returns {Promise<boolean>} Resolves with true if successful.
     * @throws {Error} If a critical error occurs during initialization.
     */
    async initializeWorldEntities() {
        this.#logger.info('WorldInitializer: Starting world entity initialization process...');
        let totalInstantiatedCount = 0;
        /** @type {import('../entities/entity.js').default[]} */
        const instantiatedEntities = [];

        try {
            // --- PASS 1: Instantiate all entities from definitions ---
            this.#logger.info('WorldInitializer (Pass 1): Instantiating entities from definitions...');
            const allEntityDefinitions = this.#repository.getAllEntityDefinitions?.() || [];

            if (allEntityDefinitions.length === 0) {
                this.#logger.warn('WorldInitializer (Pass 1): No entity definitions found. World may be empty of defined entities.');
            }

            for (const entityDef of allEntityDefinitions) {
                if (!entityDef || !entityDef.id) {
                    this.#logger.warn('WorldInitializer (Pass 1): Skipping invalid entity definition (missing or empty id):', entityDef);
                    continue;
                }
                const definitionId = entityDef.id;

                // Create a new instance; EntityManager will generate a unique UUID
                // and map definitionId to instanceId internally, but NOT add to spatial index yet.
                const instance = this.#entityManager.createEntityInstance(definitionId);

                if (instance) {
                    this.#logger.info(`WorldInitializer (Pass 1): Instantiated entity ${instance.id} (from definition: ${instance.definitionId})`);
                    instantiatedEntities.push(instance); // Collect for Pass 2
                    totalInstantiatedCount++;

                    this.#validatedEventDispatcher.dispatchValidated(
                        'worldinit:entity_instantiated',
                        {entityId: instance.id, definitionId: instance.definitionId, reason: 'Initial World Load'},
                        {allowSchemaNotFound: true}
                    ).catch(e => this.#logger.error(`Failed dispatching entity_instantiated event for ${instance.id}`, e));
                } else {
                    this.#logger.warn(`WorldInitializer (Pass 1): Failed to instantiate entity from definition: ${definitionId}.`);
                    this.#validatedEventDispatcher.dispatchValidated('worldinit:entity_instantiation_failed', {
                        definitionId: definitionId,
                        reason: 'Initial World Load'
                    }, {allowSchemaNotFound: true}).catch(e => this.#logger.error(`Failed dispatching entity_instantiation_failed for ${definitionId}`, e));
                }
            }
            this.#logger.info(`WorldInitializer (Pass 1): Completed. Instantiated ${totalInstantiatedCount} total entities.`);

            // --- PASS 2: Resolve references and populate spatial index ---
            this.#logger.info('WorldInitializer (Pass 2): Resolving references and populating spatial index...');
            let entitiesAddedToSpatialIndex = 0;
            for (const entity of instantiatedEntities) {
                const positionComponent = entity.getComponentData(POSITION_COMPONENT_ID);

                if (positionComponent && typeof positionComponent.locationId === 'string' && positionComponent.locationId.trim() !== '') {
                    const originalLocationId = positionComponent.locationId; // This is likely a definitionId, e.g., "isekai:adventurers_guild"

                    // Attempt to resolve the definitionId to an instanceId
                    const locationEntityInstance = this.#entityManager.getPrimaryInstanceByDefinitionId(originalLocationId);

                    let resolvedLocationInstanceId = originalLocationId; // Default to original if not resolved or not a defId

                    if (locationEntityInstance) {
                        // Successfully resolved the definition ID to an actual location instance
                        resolvedLocationInstanceId = locationEntityInstance.id;
                        if (originalLocationId !== resolvedLocationInstanceId) {
                            this.#logger.debug(`WorldInitializer (Pass 2): Resolved location for entity ${entity.id}. Original ref: '${originalLocationId}', Resolved instanceId: '${resolvedLocationInstanceId}'.`);
                            // Update the component data on the entity instance
                            positionComponent.locationId = resolvedLocationInstanceId;
                        } else {
                            // OriginalLocationId was already an instance ID (or a defId that matched an instanceId directly, less common)
                            this.#logger.debug(`WorldInitializer (Pass 2): Location for entity ${entity.id} ('${originalLocationId}') did not require resolution or was already an instanceId.`);
                        }
                    } else {
                        // Could not resolve originalLocationId. It might be:
                        // 1. A definitionId for a location that wasn't defined/instantiated (error in data).
                        // 2. Already an instanceId (e.g. if data was pre-processed or from a save).
                        // 3. A deliberately non-existent location or an error.
                        // A simple heuristic: if it contains ':', it was likely intended as a definitionId.
                        if (originalLocationId.includes(':')) {
                            this.#logger.warn(`WorldInitializer (Pass 2): Could not resolve location definitionId '${originalLocationId}' to an instance for entity ${entity.id}. Entity might be misplaced or location data missing.`);
                        } else {
                            this.#logger.debug(`WorldInitializer (Pass 2): LocationId '${originalLocationId}' for entity ${entity.id} is not a known definitionId and not resolved. Assuming it's a direct instanceId or out-of-world.`);
                        }
                    }

                    // Add to spatial index using the (now hopefully resolved) location instanceId
                    // If resolvedLocationInstanceId is still a definitionId because it couldn't be resolved,
                    // the spatial index will be keyed by that. This is not ideal but better than crashing.
                    // The spatial index should ideally only ever store instance IDs for locations.
                    if (resolvedLocationInstanceId && typeof resolvedLocationInstanceId === 'string') {
                        this.#spatialIndexManager.addEntity(entity.id, resolvedLocationInstanceId);
                        entitiesAddedToSpatialIndex++;
                        this.#logger.debug(`WorldInitializer (Pass 2): Added entity ${entity.id} to spatial index at location ${resolvedLocationInstanceId}.`);
                    } else {
                        this.#logger.warn(`WorldInitializer (Pass 2): Entity ${entity.id} has position component but an invalid or null final locationId ('${resolvedLocationInstanceId}'). Not added to spatial index.`);
                    }

                } else if (positionComponent) {
                    this.#logger.debug(`WorldInitializer (Pass 2): Entity ${entity.id} has a position component but missing or invalid locationId. Not added to spatial index.`);
                } else {
                    this.#logger.debug(`WorldInitializer (Pass 2): Entity ${entity.id} has no position component. Not added to spatial index.`);
                }
            }
            this.#logger.info(`WorldInitializer (Pass 2): Completed. Processed ${instantiatedEntities.length} entities for linking. Added ${entitiesAddedToSpatialIndex} entities to spatial index.`);

            // The old call this.#entityManager.buildInitialSpatialIndex(); is no longer needed
            // as entities are added progressively above.

            this.#logger.info('WorldInitializer: World entity initialization and spatial indexing complete.');
            return true;

        } catch (error) {
            this.#logger.error('WorldInitializer: CRITICAL ERROR during entity initialization or reference resolution:', error);
            // Consider dispatching a failure event
            throw error; // Re-throw to allow higher-level error handling
        }
    }
}

export default WorldInitializer;
// --- FILE END ---