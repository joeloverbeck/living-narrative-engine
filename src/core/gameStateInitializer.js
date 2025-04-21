// src/core/gameStateInitializer.js

// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */

import {POSITION_COMPONENT_ID} from "../types/components.js";

/**
 * Service responsible for setting up the initial game state using GameDataRepository.
 */
class GameStateInitializer {
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
        if (!entityManager) throw new Error("GameStateInitializer requires an EntityManager.");
        if (!gameStateManager) throw new Error("GameStateInitializer requires a GameStateManager.");
        // Updated error message to reflect new dependency
        if (!gameDataRepository) throw new Error("GameStateInitializer requires a GameDataRepository.");

        this.#entityManager = entityManager;
        this.#gameStateManager = gameStateManager;
        this.#repository = gameDataRepository; // <-- UPDATED Assignment

        console.log("GameStateInitializer: Instance created.");
    }

    /**
     * Executes the initial game state setup logic.
     * Retrieves starting IDs from GameDataRepository, creates player and starting location entities,
     * sets them in the GameStateManager, and positions the player in the starting location.
     * Assumes GameDataRepository has successfully loaded data for the selected world *before* this method is called.
     * @returns {boolean} True if setup was successful, false otherwise.
     */
    setupInitialState() {
        try {
            console.log("GameStateInitializer: Setting up initial game state...");

            console.log("GameStateInitializer: Retrieving starting IDs from GameDataRepository...");
            const startingPlayerId = this.#repository.getStartingPlayerId(); // <-- UPDATED
            const startingLocationId = this.#repository.getStartingLocationId(); // <-- UPDATED

            if (!startingPlayerId) {
                throw new Error("GameStateInitializer Error: Failed to retrieve startingPlayerId from loaded world manifest. Manifest invalid, missing 'startingPlayerId' property, or data not loaded?");
            }
            if (!startingLocationId) {
                throw new Error("GameStateInitializer Error: Failed to retrieve startingLocationId from loaded world manifest. Manifest invalid, missing 'startingLocationId' property, or data not loaded?");
            }
            console.log(`GameStateInitializer: Using startingPlayerId: ${startingPlayerId}, startingLocationId: ${startingLocationId}`);


            // --- 1. Retrieve Definition & Create Player Entity ---
            if (!this.#repository.getEntityDefinition(startingPlayerId)) {
                throw new Error(`Player definition '${startingPlayerId}' (from manifest) not found in loaded data.`);
            }
            const player = this.#entityManager.createEntityInstance(startingPlayerId);
            if (!player) {
                throw new Error(`Failed to instantiate player entity '${startingPlayerId}'.`);
            }
            this.#gameStateManager.setPlayer(player);
            console.log(`GameStateInitializer: Player entity '${player.id}' created and set.`);

            // --- 2. Retrieve Definition & Create Starting Location Entity ---
            if (!this.#repository.getEntityDefinition(startingLocationId)) {
                throw new Error(`Starting location definition '${startingLocationId}' (from manifest) not found in loaded data.`);
            }
            const startLocation = this.#entityManager.createEntityInstance(startingLocationId);
            if (!startLocation) {
                throw new Error(`Failed to instantiate starting location entity '${startingLocationId}'.`);
            }
            this.#gameStateManager.setCurrentLocation(startLocation);
            console.log(`GameStateInitializer: Starting location '${startLocation.id}' created and set.`);

            // --- 3. Place Player in Starting Location ---
            const playerPos = player.getComponentData(POSITION_COMPONENT_ID);
            if (playerPos) {
                playerPos.setLocation(startLocation.id, 0, 0); // Default to 0,0 in the location
                console.log(`GameStateInitializer: Updated player's position data to location ${startLocation.id}`);
            } else {
                console.warn(`GameStateInitializer: Player '${player.id}' missing position data. Adding one for location ${startLocation.id}.`);
                try {
                    // Assume addComponent can take key + data, relying on EntityManager's registry
                    player.addComponent(POSITION_COMPONENT_ID, {locationId: startLocation.id, x: 0, y: 0});
                    console.log(`GameStateInitializer: Added position data to player '${player.id}' for location ${startLocation.id}`);
                } catch (addCompError) {
                    console.error(`GameStateInitializer: Failed to add position data to player '${player.id}': ${addCompError.message}`, addCompError);
                    throw new Error(`Could not set player's initial position in ${startLocation.id}`);
                }
            }

            console.log("GameStateInitializer: Initial game state setup complete.");
            return true;
        } catch (error) {
            console.error(`GameStateInitializer: CRITICAL ERROR during initial game state setup: ${error.message}`, error);
            // Ensure GameStateManager state reflects potential partial failure if needed
            // (e.g., if player was set but location failed) - current logic is atomic enough.
            return false; // Indicate failure
        }
    }
}

export default GameStateInitializer;