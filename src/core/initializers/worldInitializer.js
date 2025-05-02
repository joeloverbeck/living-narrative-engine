// src/core/initializers/worldInitializer.js
// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/IWorldContext.js').default} IWorldContext */
/** @typedef {import('./services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('./services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../data/schemas/entity.schema.json').EntityDefinition} EntityDefinition */ // Example path
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */

// Removed import for PASSAGE_DETAILS_COMPONENT_TYPE_ID as it's no longer used here

/**
 * Service responsible for instantiating non-player/location entities defined
 * in the world data and building the spatial index. Runs after GameStateInitializer.
 * Dispatches events related to world entity initialization.
 */
class WorldInitializer {
    /** @type {EntityManager} */
    #entityManager;
    /** @type {IWorldContext} */
    #worldContext; // Still injected, might be used elsewhere or later
    /** @type {GameDataRepository} */
    #repository;
    /** @type {ValidatedEventDispatcher} */
    #validatedEventDispatcher;
    /** @type {ILogger} */
    #logger;

    /**
     * Creates an instance of WorldInitializer.
     * @param {object} dependencies
     * @param {EntityManager} dependencies.entityManager
     * @param {IWorldContext} dependencies.worldContext
     * @param {GameDataRepository} dependencies.gameDataRepository
     * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher
     * @param {ILogger} dependencies.logger
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({entityManager, worldContext, gameDataRepository, validatedEventDispatcher, logger}) {
        // Simplified validation for brevity, assume checks pass
        if (!entityManager) throw new Error('WorldInitializer requires an EntityManager.');
        if (!worldContext) throw new Error('WorldInitializer requires a WorldContext.'); // Keep dependency injection
        if (!gameDataRepository) throw new Error('WorldInitializer requires a GameDataRepository.');
        if (!validatedEventDispatcher) throw new Error('WorldInitializer requires a ValidatedEventDispatcher.');
        if (!logger) throw new Error('WorldInitializer requires an ILogger.');

        this.#entityManager = entityManager;
        this.#worldContext = worldContext; // Assign injected dependency
        this.#repository = gameDataRepository;
        this.#validatedEventDispatcher = validatedEventDispatcher;
        this.#logger = logger;

        this.#logger.info('WorldInitializer: Instance created.');
    }

    /**
     * Instantiates initial world entities from all definitions and builds the spatial index.
     * Dispatches 'initialization:world_initializer:started/completed/failed' events.
     * Dispatches finer-grained 'worldinit:entity_instantiated' and 'worldinit:entity_instantiation_failed' events.
     * @returns {Promise<boolean>} Resolves with true if successful.
     * @throws {Error} If a critical error occurs during initialization (after logging and dispatching failure event).
     */
    async initializeWorldEntities() { // <-- Make async
        this.#logger.info('WorldInitializer: Instantiating initial world entities...');
        let totalInstantiatedCount = 0; // Single counter for all entities

        // --- Ticket 16: Dispatch 'started' event (fire-and-forget is okay here) ---
        const startPayload = {};
        this.#validatedEventDispatcher.dispatchValidated('initialization:world_initializer:started', startPayload, {allowSchemaNotFound: true})
            .then(() => this.#logger.debug("Dispatched 'initialization:world_initializer:started' event."))
            .catch(e => this.#logger.error("Failed to dispatch 'initialization:world_initializer:started' event", e));
        // --- End Ticket 16 ---

        try {
            const allEntityDefinitions = this.#repository.getAllEntityDefinitions?.() || [];
            if (allEntityDefinitions.length === 0) {
                this.#logger.warn('WorldInitializer: No entity definitions found. World may be empty.');
            }

            for (const entityDef of allEntityDefinitions) {
                // Check for invalid definition
                if (!entityDef || !entityDef.id) {
                    this.#logger.warn('WorldInitializer: Skipping invalid entity definition:', entityDef);
                    continue;
                }
                const entityDefId = entityDef.id;

                // Check if entity already exists
                if (this.#entityManager.activeEntities.has(entityDefId)) {
                    this.#logger.warn(`Entity definition ${entityDefId} requested but entity already exists. Skipping.`);
                    continue;
                }

                // Instantiate the entity directly
                const instance = this.#entityManager.createEntityInstance(entityDefId);

                if (instance) {
                    this.#logger.info(`Instantiated entity: ${instance.id} from definition: ${entityDefId}`);
                    totalInstantiatedCount++;

                    // Dispatch finer-grained event (fire-and-forget okay for individual entities)
                    this.#validatedEventDispatcher.dispatchValidated(
                        'worldinit:entity_instantiated',
                        {entityId: instance.id, definitionId: entityDefId, reason: 'Initial World Load'},
                        {allowSchemaNotFound: true}
                    ).catch(e => this.#logger.error(`Failed dispatching entity_instantiated event for ${instance.id}`, e));

                } else {
                    this.#logger.warn(`Failed to instantiate entity from definition: ${entityDefId}.`);
                    // Dispatch entity failure event (fire-and-forget okay)
                    this.#validatedEventDispatcher.dispatchValidated('worldinit:entity_instantiation_failed', {
                        definitionId: entityDefId,
                        reason: 'Initial World Load'
                    }, {allowSchemaNotFound: true}).catch(e => this.#logger.error("Failed dispatching entity_instantiation_failed event", e));
                }
            } // End loop

            this.#logger.info(`Instantiated ${totalInstantiatedCount} total entities.`);

            // Build Spatial Index
            this.#logger.info('Building initial spatial index...');
            this.#entityManager.buildInitialSpatialIndex();
            this.#logger.info('Initial spatial index build completed.');

            // --- Ticket 16: Dispatch 'completed' event ---
            const completedPayload = {totalInstantiatedCount};
            // Await the final dispatch AND logging before returning success
            await this.#validatedEventDispatcher.dispatchValidated('initialization:world_initializer:completed', completedPayload, {allowSchemaNotFound: true})
                .then(() => {
                    this.#logger.debug("Dispatched 'initialization:world_initializer:completed' event.", completedPayload);
                })
                .catch(e => {
                    // Log the error but allow the function to return true unless this dispatch failure is critical
                    this.#logger.error("Failed to dispatch 'initialization:world_initializer:completed' event", e);
                });
            // --- End Ticket 16 ---

            return true; // Indicate success

        } catch (error) {
            this.#logger.error('WorldInitializer: CRITICAL ERROR during entity instantiation or index build:', error);

            // --- Ticket 16: Dispatch 'failed' event ---
            const failedPayload = {error: error?.message || 'Unknown error', stack: error?.stack};
            // Await the failure dispatch/logging before re-throwing
            await this.#validatedEventDispatcher.dispatchValidated('initialization:world_initializer:failed', failedPayload, {allowSchemaNotFound: true})
                .then(() => this.#logger.debug("Dispatched 'initialization:world_initializer:failed' event.", failedPayload))
                .catch(e => this.#logger.error("Failed to dispatch 'initialization:world_initializer:failed' event", e));
            // --- End Ticket 16 ---

            throw error; // Re-throw critical error after logging/dispatching
        }
    }
}

export default WorldInitializer;