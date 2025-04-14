// src/core/worldInitializer.js

// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./dataManager.js').default} DataManager */
/** @typedef {import('../components/positionComponent.js').PositionComponent} PositionComponent */ // Keep for type checking if needed

// --- Component Class Imports (needed for getComponent checks) ---
import {PositionComponent} from '../components/positionComponent.js';

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
    constructor({entityManager, gameStateManager, dataManager}) {
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
        console.log("WorldInitializer: Instantiating initial world entities (Locations & Positioned)...");
        let initialEntityCount = 0;
        const player = this.#gameStateManager.getPlayer();
        const startLocation = this.#gameStateManager.getCurrentLocation();

        if (!player || !startLocation) {
            console.error("WorldInitializer: CRITICAL - Player or starting location not set...");
            throw new Error("WorldInitializer prerequisite failed: Player or starting location not initialized.");
        }

        try {
            // Iterate through all entity definitions loaded by DataManager
            for (const entityDef of this.#dataManager.entities.values()) {
                // Skip player and starting location as they were handled by GameStateInitializer
                if (entityDef.id === player.id || entityDef.id === startLocation.id) {
                    continue;
                }

                // --- MODIFIED: Determine if this entity should be instantiated ---
                let shouldInstantiate = false;
                let reason = "Neither Position nor Connections component found"; // Default reason for skipping

                if (entityDef.components) {
                    if (entityDef.components.Position) {
                        shouldInstantiate = true;
                        reason = "Has Position component";
                    } else if (entityDef.components.Connections) { // Check specifically for Connections if Position is absent
                        shouldInstantiate = true;
                        reason = "Is Location (Has Connections component)";
                    }
                }
                // ---------------------------------------------------------------

                if (shouldInstantiate) {
                    // Check if an entity with this ID somehow already exists
                    if (this.#entityManager.activeEntities.has(entityDef.id)) {
                        console.warn(`WorldInitializer: Entity ${entityDef.id} requested for initial instantiation but already exists. Skipping.`);
                        continue;
                    }

                    // Create the entity instance using EntityManager
                    const instance = this.#entityManager.createEntityInstance(entityDef.id);

                    if (instance) {
                        console.log(`WorldInitializer: Instantiated entity: ${instance.id} (Reason: ${reason})`);
                        initialEntityCount++;
                        // Optional: Add specific post-instantiation checks if needed based on why it was instantiated
                    } else {
                        // createEntityInstance logs its own errors, but we add context here.
                        console.warn(`WorldInitializer: Failed to instantiate initial entity from definition: ${entityDef.id}. See previous EntityManager errors.`);
                    }
                } else {
                    // Optional: Log skipped entities for debugging if desired
                    // console.log(`WorldInitializer: Skipping instantiation for ${entityDef.id} (Reason: ${reason})`);
                }
            } // End loop through entity definitions

            console.log(`WorldInitializer: Instantiated ${initialEntityCount} additional initial world entities.`);

            // --- Build Spatial Index ---
            // This remains important for entities that *do* have positions.
            console.log("WorldInitializer: Building initial spatial index via EntityManager...");
            this.#entityManager.buildInitialSpatialIndex(); // Delegate to EntityManager
            console.log("WorldInitializer: Initial spatial index build completed successfully.");

            return true; // Indicate success

        } catch (error) {
            console.error("WorldInitializer: Error during initial world entity instantiation or spatial index build:", error);
            throw error;
        }
    }
}

export default WorldInitializer;