// src/initializers/worldInitializer.js
// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/IWorldContext.js').default} IWorldContext */
/** @typedef {import('../services/gameDataRepository.js').GameDataRepository} GameDataRepository */ // Corrected path based on common project structure
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Corrected path
/** @typedef {import('../../data/schemas/entity.schema.json').EntityDefinition} EntityDefinition */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */


/**
 * Service responsible for instantiating non-player/location entities defined
 * in the world data and building the spatial index. Runs after GameStateInitializer.
 * Dispatches events related to world entity initialization.
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
        if (!entityManager) throw new Error('WorldInitializer requires an EntityManager.');
        if (!worldContext) throw new Error('WorldInitializer requires a WorldContext.');
        if (!gameDataRepository) throw new Error('WorldInitializer requires a GameDataRepository.');
        if (!validatedEventDispatcher) throw new Error('WorldInitializer requires a ValidatedEventDispatcher.');
        if (!logger) throw new Error('WorldInitializer requires an ILogger.');

        this.#entityManager = entityManager;
        this.#worldContext = worldContext;
        this.#repository = gameDataRepository;
        this.#validatedEventDispatcher = validatedEventDispatcher;
        this.#logger = logger;

        this.#logger.info('WorldInitializer: Instance created.');
    }

    /**
     * Instantiates initial world entities from all definitions and builds the spatial index.
     * Each entity instance will receive a unique runtime UUID.
     * Dispatches 'initialization:world_initializer:started/completed/failed' events.
     * Dispatches finer-grained 'worldinit:entity_instantiated' and 'worldinit:entity_instantiation_failed' events.
     * @returns {Promise<boolean>} Resolves with true if successful.
     * @throws {Error} If a critical error occurs during initialization (after logging and dispatching failure event).
     */
    async initializeWorldEntities() {
        this.#logger.info('WorldInitializer: Instantiating initial world entities...');
        let totalInstantiatedCount = 0;

        try {
            const allEntityDefinitions = this.#repository.getAllEntityDefinitions?.() || [];
            if (allEntityDefinitions.length === 0) {
                this.#logger.warn('WorldInitializer: No entity definitions found. World may be empty.');
            }

            for (const entityDef of allEntityDefinitions) {
                if (!entityDef || !entityDef.id) {
                    this.#logger.warn('WorldInitializer: Skipping invalid entity definition (missing or empty id):', entityDef);
                    continue;
                }
                const definitionId = entityDef.id; // This is "isekai:hero", "isekai:adventurers_guild", etc.

                // Create a new instance; EntityManager will generate a unique UUID for it.
                // The definitionId is used to fetch the template data.
                const instance = this.#entityManager.createEntityInstance(definitionId /*, instanceId = null */);

                if (instance) {
                    // instance.id is the new UUID, instance.definitionId is the original definitionId ("isekai:hero")
                    this.#logger.info(`Instantiated entity: ${instance.id} (from definition: ${instance.definitionId})`);
                    totalInstantiatedCount++;

                    this.#validatedEventDispatcher.dispatchValidated(
                        'worldinit:entity_instantiated',
                        {entityId: instance.id, definitionId: instance.definitionId, reason: 'Initial World Load'},
                        {allowSchemaNotFound: true}
                    ).catch(e => this.#logger.error(`Failed dispatching entity_instantiated event for ${instance.id} (Def: ${instance.definitionId})`, e));

                } else {
                    this.#logger.warn(`Failed to instantiate entity from definition: ${definitionId}.`);
                    this.#validatedEventDispatcher.dispatchValidated('worldinit:entity_instantiation_failed', {
                        definitionId: definitionId, // Use the definitionId that failed
                        reason: 'Initial World Load'
                    }, {allowSchemaNotFound: true}).catch(e => this.#logger.error(`Failed dispatching entity_instantiation_failed event for definition ${definitionId}`, e));
                }
            }

            this.#logger.info(`Instantiated ${totalInstantiatedCount} total entities.`);

            this.#logger.info('Building initial spatial index...');
            this.#entityManager.buildInitialSpatialIndex();
            this.#logger.info('Initial spatial index build completed.');

            return true;

        } catch (error) {
            this.#logger.error('WorldInitializer: CRITICAL ERROR during entity instantiation or index build:', error);
            throw error;
        }
    }
}

export default WorldInitializer;