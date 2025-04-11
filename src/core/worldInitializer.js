// src/core/worldInitializer.js

// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./dataManager.js').default} DataManager */
/** @typedef {import('../components/positionComponent.js').PositionComponent} PositionComponent */ // Keep for type checking if needed

// --- Component Class Imports (needed for getComponent checks) ---
import { PositionComponent } from '../components/positionComponent.js';

/**
 * Service responsible for instantiating non-player/location entities defined
 * with initial positions in the world data and building the initial spatial index.
 * This runs *after* the GameStateInitializer has set up the player and starting location.
 */
class WorldInitializer {
    /** @type {EntityManager} */
    #entityManager;
    /** @type {GameStateManager} */
    #gameStateManager;
    /** @type {DataManager} */
    #dataManager;

    /**
     * Creates an instance of WorldInitializer.
     * @param {object} dependencies
     * @param {EntityManager} dependencies.entityManager
     * @param {GameStateManager} dependencies.gameStateManager
     * @param {DataManager} dependencies.dataManager
     */
    constructor({ entityManager, gameStateManager, dataManager }) {
        if (!entityManager) throw new Error("WorldInitializer requires an EntityManager.");
        if (!gameStateManager) throw new Error("WorldInitializer requires a GameStateManager.");
        if (!dataManager) throw new Error("WorldInitializer requires a DataManager.");

        this.#entityManager = entityManager;
        this.#gameStateManager = gameStateManager;
        this.#dataManager = dataManager;

        console.log("WorldInitializer: Instance created.");
    }

    /**
     * Instantiates initial world entities (excluding player/start location) based on data definitions
     * and then builds the spatial index in the EntityManager.
     * Relies on GameStateInitializer having already run and set the player/location in GameStateManager.
     * @returns {boolean} True if successful, false on critical error (though errors are typically thrown).
     */
    initializeWorldEntities() {
        console.log("WorldInitializer: Instantiating initial non-player/location world entities...");
        let initialEntityCount = 0;
        // Retrieve already-initialized player and location to avoid re-instantiating them
        const player = this.#gameStateManager.getPlayer();
        const startLocation = this.#gameStateManager.getCurrentLocation();

        // Important check: Player and start location MUST be set by GameStateInitializer before this runs
        if (!player || !startLocation) {
            // This indicates a sequencing error in GameEngine initialization logic.
            console.error("WorldInitializer: CRITICAL - Player or starting location not set in GameStateManager before attempting to instantiate world entities. Check initialization order.");
            throw new Error("WorldInitializer prerequisite failed: Player or starting location not initialized.");
        }

        try {
            // Iterate through all entity definitions loaded by DataManager
            for (const entityDef of this.#dataManager.entities.values()) {
                // Skip player and starting location as they were handled by GameStateInitializer
                if (entityDef.id === player.id || entityDef.id === startLocation.id) {
                    continue;
                }

                // Check if the definition includes a 'Position' component, indicating it should be placed in the world initially.
                // Assumes 'Position' is the registered key for PositionComponent.
                if (entityDef.components && entityDef.components.Position) {
                    // Check if an entity with this ID somehow already exists (e.g., from a previous failed run or bug)
                    if (this.#entityManager.activeEntities.has(entityDef.id)) {
                        console.warn(`WorldInitializer: Entity ${entityDef.id} requested for initial instantiation but already exists in EntityManager. Skipping.`);
                        continue;
                    }

                    // Create the entity instance using EntityManager
                    const instance = this.#entityManager.createEntityInstance(entityDef.id);

                    if (instance) {
                        // Sanity check: Ensure the instantiated entity actually has the PositionComponent
                        // This guards against definition errors or component registration issues.
                        if (!instance.hasComponent(PositionComponent)) {
                            console.error(`WorldInitializer: CRITICAL - Instantiated ${instance.id} but it lacks the expected PositionComponent! Check component registration/definition.`);
                            // Depending on game requirements, this might be a recoverable warning or a fatal error.
                            // For now, log critically but continue. Consider throwing if this state is unacceptable.
                        }
                        initialEntityCount++;
                    } else {
                        // createEntityInstance logs its own errors, but we add context here.
                        console.warn(`WorldInitializer: Failed to instantiate initial entity from definition: ${entityDef.id}. See previous EntityManager errors.`);
                        // Decide if failure to instantiate *any* initial entity is critical. Throw if needed.
                        // throw new Error(`Failed to instantiate critical initial entity: ${entityDef.id}`);
                    }
                }
            }
            console.log(`WorldInitializer: Instantiated ${initialEntityCount} additional initial world entities.`);

            // --- Build Spatial Index ---
            // Now that all positioned entities (player, location, others) are created, build the index.
            console.log("WorldInitializer: Building initial spatial index via EntityManager...");
            this.#entityManager.buildInitialSpatialIndex(); // Delegate to EntityManager
            console.log("WorldInitializer: Initial spatial index build completed successfully.");

            return true; // Indicate success

        } catch (error) {
            console.error("WorldInitializer: Error during initial world entity instantiation or spatial index build:", error);
            // Propagate the error to halt engine initialization if something goes wrong here.
            throw error;
        }
    }
}

export default WorldInitializer;