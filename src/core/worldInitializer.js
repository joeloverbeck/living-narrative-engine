// src/core/worldInitializer.js

// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../components/positionComponent.js').PositionComponent} PositionComponent */

// --- Component Class Imports ---
import {PositionComponent} from '../components/positionComponent.js';
import {PassageDetailsComponent} from '../components/passageDetailsComponent.js';
// Note: We'll need type definitions for entity definitions from the repository
/** @typedef {import('../../../data/schemas/entity.schema.json').EntityDefinition} EntityDefinition */

/**
 * Service responsible for instantiating non-player/location entities defined
 * in the world data, using GameDataRepository.
 * Runs *after* GameStateInitializer. Builds the spatial index.
 * NOTE: Requires significant refactoring due to removal of direct entity collection access.
 */
class WorldInitializer {
    /** @type {EntityManager} */
    #entityManager;
    /** @type {GameStateManager} */
    #gameStateManager;
    /**
     * @type {GameDataRepository} // <-- UPDATED Type
     */
    #repository; // <-- UPDATED Property Name

    /**
     * // *** [REFACTOR-014-SUB-11] Updated Constructor Signature ***
     * @param {object} dependencies
     * @param {EntityManager} dependencies.entityManager
     * @param {GameStateManager} dependencies.gameStateManager
     * @param {GameDataRepository} dependencies.gameDataRepository - The game data repository.
     */
    constructor({entityManager, gameStateManager, gameDataRepository}) { // <-- UPDATED Parameter key
        if (!entityManager) throw new Error("WorldInitializer requires an EntityManager.");
        if (!gameStateManager) throw new Error("WorldInitializer requires a GameStateManager.");
        // Updated error message to reflect new dependency
        if (!gameDataRepository) throw new Error("WorldInitializer requires a GameDataRepository.");

        this.#entityManager = entityManager;
        this.#gameStateManager = gameStateManager;
        this.#repository = gameDataRepository; // <-- UPDATED Assignment

        console.log("WorldInitializer: Instance created.");
    }

    /**
     * Instantiates initial world entities (excluding player/start location) based on data definitions
     * retrieved via GameDataRepository, and builds the spatial index.
     * // *** [REFACTOR-014-SUB-11] Significantly refactored logic ***
     * @returns {boolean} True if successful, false on critical error.
     */
    initializeWorldEntities() {
        console.log("WorldInitializer: Instantiating initial world entities (Locations, Positioned, Connections, Blockers)...");
        let initialEntityCount = 0;
        let blockerEntityCount = 0;
        const player = this.#gameStateManager.getPlayer();
        const startLocation = this.#gameStateManager.getCurrentLocation();

        if (!player || !startLocation) {
            console.error("WorldInitializer: CRITICAL - Player or starting location not set...");
            throw new Error("WorldInitializer prerequisite failed: Player or starting location not initialized.");
        }

        try {
            // --- Refactored Logic: Get definitions from repository ---
            // This approach assumes GameDataRepository has methods like getAllXDefinitions().
            // A different approach might involve reading a manifest or specific lists.
            const allEntityDefinitions = [];
            // Example: Fetch different types and combine (adjust based on actual repo methods)
            if (typeof this.#repository.getAllEntityDefinitions === 'function') {
                allEntityDefinitions.push(...this.#repository.getAllEntityDefinitions()); // Assumes generic characters/NPCs
            }
            if (typeof this.#repository.getAllLocationDefinitions === 'function') {
                allEntityDefinitions.push(...this.#repository.getAllLocationDefinitions());
            }
            if (typeof this.#repository.getAllItemDefinitions === 'function') {
                allEntityDefinitions.push(...this.#repository.getAllItemDefinitions());
            }
            if (typeof this.#repository.getAllConnectionDefinitions === 'function') {
                allEntityDefinitions.push(...this.#repository.getAllConnectionDefinitions());
            }
            if (typeof this.#repository.getAllBlockerDefinitions === 'function') { // Assuming blockers are distinct
                allEntityDefinitions.push(...this.#repository.getAllBlockerDefinitions());
            }
            // Add more calls as needed for other definition types stored separately

            if (allEntityDefinitions.length === 0) {
                console.warn("WorldInitializer: No entity definitions found via GameDataRepository. World may be empty.");
            }

            // Iterate through all collected definitions
            for (const entityDef of allEntityDefinitions) {
                // Basic validation of the definition object
                if (!entityDef || !entityDef.id) {
                    console.warn("WorldInitializer: Skipping invalid/incomplete entity definition:", entityDef);
                    continue;
                }

                // Skip player and starting location
                if (entityDef.id === player.id || entityDef.id === startLocation.id) {
                    continue;
                }

                // Determine if this entity should be instantiated based on components
                let shouldInstantiate = false;
                let reason = "No initial instantiation component found";
                if (entityDef.components) {
                    if (entityDef.components.Position) {
                        shouldInstantiate = true;
                        reason = "Has Position";
                    } else if (entityDef.components.Connections) { // Locations
                        shouldInstantiate = true;
                        reason = "Is Location (Has Connections)";
                    } else if (entityDef.components.PassageDetails) { // Connections
                        shouldInstantiate = true;
                        reason = "Is Connection (Has PassageDetails)";
                    }
                    // Add other rules? E.g., instantiate all defined NPCs?
                    // else if (entityDef.type === 'NPC') { shouldInstantiate = true; reason = "Is NPC"; }
                }

                if (shouldInstantiate) {
                    if (this.#entityManager.activeEntities.has(entityDef.id)) {
                        console.warn(`WorldInitializer: Entity ${entityDef.id} requested for initial instantiation but already exists. Skipping.`);
                        continue;
                    }

                    const instance = this.#entityManager.createEntityInstance(entityDef.id);
                    if (instance) {
                        console.log(`WorldInitializer: Instantiated entity: ${instance.id} (Reason: ${reason})`);
                        initialEntityCount++;

                        // Check for blockers associated with connections
                        const passageDetailsComp = instance.getComponent(PassageDetailsComponent);
                        if (passageDetailsComp) {
                            const blockerId = passageDetailsComp.getBlockerId();
                            if (blockerId && typeof blockerId === 'string' && blockerId.trim() !== '') {
                                // *** [REFACTOR-014-SUB-11] Use repository method to check definition ***
                                if (!this.#repository.getEntityDefinition(blockerId)) { // <-- UPDATED Check
                                    console.warn(`WorldInitializer: Connection ${instance.id} references blocker ID '${blockerId}', but definition not found via GameDataRepository.`);
                                } else if (this.#entityManager.activeEntities.has(blockerId)) {
                                    console.log(`WorldInitializer: Blocker entity ${blockerId} for connection ${instance.id} already exists. Skipping.`);
                                } else {
                                    console.log(`WorldInitializer: Instantiating blocker entity ${blockerId} for connection ${instance.id}...`);
                                    const blockerInstance = this.#entityManager.createEntityInstance(blockerId);
                                    if (blockerInstance) {
                                        console.log(`WorldInitializer: Successfully instantiated blocker entity: ${blockerInstance.id}`);
                                        blockerEntityCount++;
                                    } else {
                                        console.warn(`WorldInitializer: Failed to instantiate blocker entity from definition: ${blockerId} (referenced by ${instance.id}).`);
                                    }
                                }
                            }
                        }
                    } else {
                        console.warn(`WorldInitializer: Failed to instantiate initial entity from definition: ${entityDef.id}.`);
                    }
                }
            } // End loop

            console.log(`WorldInitializer: Instantiated ${initialEntityCount} primary initial entities.`);
            if (blockerEntityCount > 0) {
                console.log(`WorldInitializer: Instantiated ${blockerEntityCount} associated blocker entities.`);
            }

            // Build Spatial Index (No change needed here)
            console.log("WorldInitializer: Building initial spatial index via EntityManager...");
            this.#entityManager.buildInitialSpatialIndex();
            console.log("WorldInitializer: Initial spatial index build completed successfully.");

            return true;

        } catch (error) {
            console.error("WorldInitializer: Error during initial world entity instantiation or spatial index build:", error);
            throw error;
        }
    }
}

export default WorldInitializer;