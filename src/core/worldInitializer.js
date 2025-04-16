// src/core/worldInitializer.js

// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./dataManager.js').default} DataManager */
/** @typedef {import('../components/positionComponent.js').PositionComponent} PositionComponent */ // Keep for type checking if needed

// --- Component Class Imports ---
import { PositionComponent } from '../components/positionComponent.js';
// Required for getComponent check and accessing blockerId
import { PassageDetailsComponent } from '../components/passageDetailsComponent.js';
// Note: ConnectionsComponent class import is not strictly needed here as we only check entityDef.components.Connections

/**
 * Service responsible for instantiating non-player/location entities defined
 * in the world data, specifically those with initial positions (`PositionComponent`),
 * those representing locations (`ConnectionsComponent`), and those representing
 * the connections between locations (`PassageDetailsComponent`). It also handles
 * instantiating blockers associated with these connections.
 * This runs *after* the GameStateInitializer has set up the player and starting location.
 * It also builds the initial spatial index.
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
     * (checking for Position, Connections, or PassageDetails components), including associated blockers,
     * and then builds the spatial index in the EntityManager.
     * Relies on GameStateInitializer having already run and set the player/location in GameStateManager.
     * @returns {boolean} True if successful, false on critical error (though errors are typically thrown).
     */
    initializeWorldEntities() {
        console.log("WorldInitializer: Instantiating initial world entities (Locations, Positioned, Connections, Blockers)...");
        let initialEntityCount = 0;
        let blockerEntityCount = 0; // Keep track of blockers instantiated here
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

                // --- Determine if this entity should be instantiated ---
                let shouldInstantiate = false;
                let reason = "No initial instantiation component found (Position, Connections, or PassageDetails)"; // Default reason

                if (entityDef.components) {
                    if (entityDef.components.Position) {
                        shouldInstantiate = true;
                        reason = "Has Position component";
                    } else if (entityDef.components.Connections) { // Check specifically for Connections if Position is absent
                        shouldInstantiate = true;
                        reason = "Is Location (Has Connections component)";
                    } else if (entityDef.components.PassageDetails) {
                        shouldInstantiate = true;
                        reason = "Is Connection (Has PassageDetails component)";
                    }
                }
                // ---------------------------------------------------------------

                if (shouldInstantiate) {
                    // Check if an entity with this ID somehow already exists
                    if (this.#entityManager.activeEntities.has(entityDef.id)) {
                        console.warn(`WorldInitializer: Entity ${entityDef.id} requested for initial instantiation but already exists. Skipping.`);
                        continue;
                    }

                    // Create the primary entity instance using EntityManager
                    const instance = this.#entityManager.createEntityInstance(entityDef.id);

                    if (instance) {
                        console.log(`WorldInitializer: Instantiated entity: ${instance.id} (Reason: ${reason})`);
                        initialEntityCount++;

                        // --- >>> NEW: Check for and instantiate blockers <<< ---
                        // Check if the newly instantiated entity is a connection
                        const passageDetailsComp = instance.getComponent(PassageDetailsComponent);
                        if (passageDetailsComp) {
                            const blockerId = passageDetailsComp.getBlockerId(); // Use the getter method

                            if (blockerId && typeof blockerId === 'string' && blockerId.trim() !== '') {
                                // Check if the blocker entity definition exists
                                if (!this.#dataManager.entities.has(blockerId)) {
                                    console.warn(`WorldInitializer: Connection ${instance.id} references blocker entity ID '${blockerId}', but no definition found for it. Skipping blocker instantiation.`);
                                }
                                // Check if the blocker entity instance ALREADY exists
                                else if (this.#entityManager.activeEntities.has(blockerId)) {
                                    console.log(`WorldInitializer: Blocker entity ${blockerId} for connection ${instance.id} already exists (likely instantiated separately). Skipping.`);
                                } else {
                                    // Blocker definition exists and instance doesn't - instantiate it
                                    console.log(`WorldInitializer: Instantiating blocker entity ${blockerId} for connection ${instance.id}...`);
                                    const blockerInstance = this.#entityManager.createEntityInstance(blockerId);
                                    if (blockerInstance) {
                                        console.log(`WorldInitializer: Successfully instantiated blocker entity: ${blockerInstance.id}`);
                                        blockerEntityCount++;
                                    } else {
                                        // createEntityInstance logs its own errors
                                        console.warn(`WorldInitializer: Failed to instantiate blocker entity from definition: ${blockerId} (referenced by ${instance.id}). See previous EntityManager errors.`);
                                    }
                                }
                            }
                        }
                        // --- >>> END NEW BLOCKER LOGIC <<< ---

                    } else {
                        // createEntityInstance logs its own errors, but we add context here.
                        console.warn(`WorldInitializer: Failed to instantiate initial entity from definition: ${entityDef.id}. See previous EntityManager errors.`);
                    }
                } else {
                    // Optional: Log skipped entities for debugging if desired
                    // console.log(`WorldInitializer: Skipping instantiation for ${entityDef.id} (Reason: ${reason})`);
                }
            } // End loop through entity definitions

            console.log(`WorldInitializer: Instantiated ${initialEntityCount} primary initial entities.`);
            if (blockerEntityCount > 0) {
                console.log(`WorldInitializer: Instantiated ${blockerEntityCount} associated blocker entities.`);
            }

            // --- Build Spatial Index ---
            // This remains important for entities that *do* have positions (including potentially blockers).
            console.log("WorldInitializer: Building initial spatial index via EntityManager...");
            this.#entityManager.buildInitialSpatialIndex(); // Delegate to EntityManager
            console.log("WorldInitializer: Initial spatial index build completed successfully.");

            return true; // Indicate success

        } catch (error) {
            console.error("WorldInitializer: Error during initial world entity instantiation or spatial index build:", error);
            throw error; // Rethrow to halt initialization process
        }
    }
}

export default WorldInitializer;