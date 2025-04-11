// src/core/gameStateInitializer.js

// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../gameStateManager.js').default} GameStateManager */
/** @typedef {import('../../dataManager.js').default} DataManager */
/** @typedef {import('../components/positionComponent.js').PositionComponent} PositionComponent */ // Keep for type checking if needed

// --- Component Class Imports (needed for getComponent/addComponent) ---
import { PositionComponent } from '../components/positionComponent.js';

/**
 * Service responsible for setting up the initial game state, including creating
 * the player entity, the starting location entity, and placing the player correctly.
 */
class GameStateInitializer {
    /** @type {EntityManager} */
    #entityManager;
    /** @type {GameStateManager} */
    #gameStateManager;
    /** @type {DataManager} */
    #dataManager;
    /** @type {string} */
    #startingPlayerId;
    /** @type {string} */
    #startingLocationId;

    /**
     * Creates an instance of GameStateInitializer.
     * @param {object} dependencies
     * @param {EntityManager} dependencies.entityManager
     * @param {GameStateManager} dependencies.gameStateManager
     * @param {DataManager} dependencies.dataManager
     * @param {string} dependencies.startingPlayerId - The ID of the player entity definition.
     * @param {string} dependencies.startingLocationId - The ID of the starting location entity definition.
     */
    constructor({ entityManager, gameStateManager, dataManager, startingPlayerId, startingLocationId }) {
        if (!entityManager) throw new Error("GameStateInitializer requires an EntityManager.");
        if (!gameStateManager) throw new Error("GameStateInitializer requires a GameStateManager.");
        if (!dataManager) throw new Error("GameStateInitializer requires a DataManager.");
        if (!startingPlayerId) throw new Error("GameStateInitializer requires a startingPlayerId.");
        if (!startingLocationId) throw new Error("GameStateInitializer requires a startingLocationId.");

        this.#entityManager = entityManager;
        this.#gameStateManager = gameStateManager;
        this.#dataManager = dataManager;
        this.#startingPlayerId = startingPlayerId;
        this.#startingLocationId = startingLocationId;

        console.log("GameStateInitializer: Instance created.");
    }

    /**
     * Executes the initial game state setup logic.
     * Creates player and starting location entities, sets them in the GameStateManager,
     * and positions the player in the starting location.
     * @returns {boolean} True if setup was successful, false otherwise.
     */
    setupInitialState() {
        try {
            console.log("GameStateInitializer: Setting up initial game state...");

            // --- 1. Retrieve/Create Player Entity ---
            if (!this.#dataManager.getEntityDefinition(this.#startingPlayerId)) {
                throw new Error(`Player definition '${this.#startingPlayerId}' not found.`);
            }
            const player = this.#entityManager.createEntityInstance(this.#startingPlayerId);
            if (!player) {
                throw new Error(`Failed to instantiate player entity '${this.#startingPlayerId}'.`);
            }
            this.#gameStateManager.setPlayer(player);
            console.log(`GameStateInitializer: Player entity '${player.id}' created and set.`);

            // --- 2. Retrieve/Create Starting Location Entity ---
            if (!this.#dataManager.getEntityDefinition(this.#startingLocationId)) {
                throw new Error(`Starting location definition '${this.#startingLocationId}' not found.`);
            }
            const startLocation = this.#entityManager.createEntityInstance(this.#startingLocationId);
            if (!startLocation) {
                throw new Error(`Failed to instantiate starting location entity '${this.#startingLocationId}'.`);
            }
            this.#gameStateManager.setCurrentLocation(startLocation);
            console.log(`GameStateInitializer: Starting location '${startLocation.id}' created and set.`);

            // --- 3. Place Player in Starting Location ---
            const playerPos = player.getComponent(PositionComponent);
            if (playerPos) {
                playerPos.setLocation(startLocation.id, 0, 0); // Default to 0,0 in the location
                console.log(`GameStateInitializer: Updated player's PositionComponent to location ${startLocation.id}`);
            } else {
                console.warn(`GameStateInitializer: Player '${player.id}' missing PositionComponent. Adding one for location ${startLocation.id}.`);
                try {
                    // Assume addComponent can take key + data, relying on EntityManager's registry
                    player.addComponent('Position', { locationId: startLocation.id, x: 0, y: 0 });
                    console.log(`GameStateInitializer: Added PositionComponent to player '${player.id}' for location ${startLocation.id}`);
                } catch (addCompError) {
                    console.error(`GameStateInitializer: Failed to add PositionComponent to player '${player.id}': ${addCompError.message}`, addCompError);
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