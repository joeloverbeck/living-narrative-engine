// src/core/worldInitializer.js

// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/IWorldContext.js').default} IWorldContext */
/** @typedef {import('./services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('./services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../data/schemas/entity.schema.json').EntityDefinition} EntityDefinition */ // Example path
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */

import {PASSAGE_DETAILS_COMPONENT_TYPE_ID} from "../../types/components.js"; // Corrected path

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
     * Instantiates initial world entities and builds the spatial index.
     * Dispatches 'initialization:world_initializer:started/completed/failed' events.
     * Dispatches finer-grained 'worldinit:entity_instantiated', 'worldinit:blocker_instantiated', etc. events.
     * @returns {boolean} True if successful, false on critical error (now throws).
     * @throws {Error} If a critical error occurs during initialization.
     */
    initializeWorldEntities() {
        this.#logger.info('WorldInitializer: Instantiating initial world entities...');
        let initialEntityCount = 0;
        let blockerEntityCount = 0;

        // --- Ticket 16: Dispatch 'started' event ---
        // Replace existing worldinit:started
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
                if (!entityDef || !entityDef.id) {
                    this.#logger.warn('WorldInitializer: Skipping invalid entity definition:', entityDef);
                    continue;
                }
                const entityDefId = entityDef.id;
                // REMOVED: Check against player/startLocation IDs as WorldInitializer now handles all entities.
                // if (entityDefId === player.id || entityDefId === startLocation.id) continue;

                // Determine instantiation logic (simplified)
                // TODO: Refine this logic - should we instantiate *everything* here?
                // Currently instantiates entities with Position, Connections, or PassageDetails.
                // This might change based on broader initialization strategy.
                let shouldInstantiate = false;
                let reason = 'Default Instantiation Logic'; // Adjust logic as needed
                if (entityDef.components?.Position || entityDef.components?.Connections || entityDef.components?.PassageDetails) {
                    shouldInstantiate = true;
                    reason = entityDef.components.Position ? 'Has Position' :
                        entityDef.components.Connections ? 'Is Location' : 'Is Connection';
                }
                // Example: Add logic to always instantiate NPCs
                // if (entityDef.type === 'NPC') { shouldInstantiate = true; reason = 'Is NPC'; }


                if (shouldInstantiate) {
                    if (this.#entityManager.activeEntities.has(entityDefId)) {
                        this.#logger.warn(`Entity ${entityDefId} requested but already exists. Skipping.`);
                        continue;
                    }

                    const instance = this.#entityManager.createEntityInstance(entityDefId);
                    if (instance) {
                        this.#logger.info(`Instantiated entity: ${instance.id} (Reason: ${reason})`);
                        initialEntityCount++;

                        // Dispatch finer-grained event (keep existing)
                        this.#validatedEventDispatcher.dispatchValidated(
                            'worldinit:entity_instantiated',
                            {entityId: instance.id, definitionId: entityDefId, reason: reason},
                            {allowSchemaNotFound: true}
                        ).catch(e => this.#logger.error(`Failed dispatching entity_instantiated event for ${instance.id}`, e));

                        // Blocker instantiation logic (keep existing)
                        const passageDetailsComp = instance.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID);
                        if (passageDetailsComp) {
                            const blockerId = passageDetailsComp.getBlockerId?.(); // Use optional chaining
                            if (blockerId && typeof blockerId === 'string' && blockerId.trim()) {
                                if (!this.#repository.getEntityDefinition(blockerId)) {
                                    this.#logger.warn(`Connection ${instance.id} refs blocker '${blockerId}', definition not found.`);
                                } else if (this.#entityManager.activeEntities.has(blockerId)) {
                                    this.#logger.debug(`Blocker ${blockerId} for ${instance.id} already exists.`);
                                } else {
                                    this.#logger.info(`Instantiating blocker ${blockerId} for connection ${instance.id}...`);
                                    const blockerInstance = this.#entityManager.createEntityInstance(blockerId);
                                    if (blockerInstance) {
                                        this.#logger.info(`Instantiated blocker: ${blockerInstance.id}`);
                                        blockerEntityCount++;
                                        // Dispatch finer-grained event (keep existing)
                                        this.#validatedEventDispatcher.dispatchValidated(
                                            'worldinit:blocker_instantiated',
                                            {blockerId: blockerInstance.id, connectionId: instance.id},
                                            {allowSchemaNotFound: true}
                                        ).catch(e => this.#logger.error(`Failed dispatching blocker_instantiated event for ${blockerInstance.id}`, e));
                                    } else {
                                        this.#logger.warn(`Failed to instantiate blocker from definition: ${blockerId}`);
                                        // Optional: Dispatch blocker failure event
                                        this.#validatedEventDispatcher.dispatchValidated('worldinit:blocker_instantiation_failed', {
                                            blockerDefinitionId: blockerId,
                                            connectionId: instance.id
                                        }, {allowSchemaNotFound: true}).catch(e => this.#logger.error("Failed dispatching blocker_instantiation_failed event", e));
                                    }
                                }
                            }
                        }
                    } else {
                        this.#logger.warn(`Failed to instantiate entity from definition: ${entityDefId}.`);
                        // Optional: Dispatch entity failure event
                        this.#validatedEventDispatcher.dispatchValidated('worldinit:entity_instantiation_failed', {
                            definitionId: entityDefId,
                            reason: reason
                        }, {allowSchemaNotFound: true}).catch(e => this.#logger.error("Failed dispatching entity_instantiation_failed event", e));
                    }
                }
            } // End loop

            this.#logger.info(`Instantiated ${initialEntityCount} primary entities.`);
            if (blockerEntityCount > 0) {
                this.#logger.info(`Instantiated ${blockerEntityCount} blocker entities.`);
            }

            // Build Spatial Index
            this.#logger.info('Building initial spatial index...');
            this.#entityManager.buildInitialSpatialIndex();
            this.#logger.info('Initial spatial index build completed.');

            // --- Ticket 16: Dispatch 'completed' event ---
            // Replace existing worldinit:completed
            const completedPayload = {initialEntityCount, blockerEntityCount};
            this.#validatedEventDispatcher.dispatchValidated('initialization:world_initializer:completed', completedPayload, {allowSchemaNotFound: true})
                .then(() => this.#logger.debug("Dispatched 'initialization:world_initializer:completed' event.", completedPayload))
                .catch(e => this.#logger.error("Failed to dispatch 'initialization:world_initializer:completed' event", e));
            // --- End Ticket 16 ---

            return true; // Indicate success (caller should handle)

        } catch (error) {
            this.#logger.error('WorldInitializer: CRITICAL ERROR during entity instantiation or index build:', error);

            // --- Ticket 16: Dispatch 'failed' event ---
            // Replace existing worldinit:failed
            const failedPayload = {error: error?.message || 'Unknown error', stack: error?.stack};
            this.#validatedEventDispatcher.dispatchValidated('initialization:world_initializer:failed', failedPayload, {allowSchemaNotFound: true})
                .then(() => this.#logger.debug("Dispatched 'initialization:world_initializer:failed' event.", failedPayload))
                .catch(e => this.#logger.error("Failed to dispatch 'initialization:world_initializer:failed' event", e));
            // --- End Ticket 16 ---

            throw error; // Re-throw after logging/dispatching to halt initialization sequence
        }
    }
}

export default WorldInitializer;