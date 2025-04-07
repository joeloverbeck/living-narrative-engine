// gameStateManager.js

/** @typedef {import('./entities/entity.js').default} Entity */

/**
 * Manages the core, mutable game world state.
 * Acts as the single source of truth for dynamic elements like the
 * player's current state and location.
 */
class GameStateManager {
    /** @type {Entity | null} */
    #playerEntity; // Using private fields for encapsulation

    /** @type {Entity | null} */
    #currentLocation;

    /**
     * Initializes the game state manager with default null state.
     */
    constructor() {
        this.#playerEntity = null;
        this.#currentLocation = null;
        console.log("GameStateManager: Initialized.");
    }

    /**
     * Retrieves the current player entity instance.
     * @returns {Entity | null} The player entity or null if not set.
     */
    getPlayer() {
        return this.#playerEntity;
    }

    /**
     * Retrieves the current location entity instance.
     * @returns {Entity | null} The current location entity or null if not set.
     */
    getCurrentLocation() {
        return this.#currentLocation;
    }

    /**
     * Sets the active player entity.
     * @param {Entity | null} playerEntity - The player entity instance. Should not be null during gameplay.
     */
    setPlayer(playerEntity) {
        // Optional: Add validation (e.g., check if it's actually an Entity)
        if (playerEntity && typeof playerEntity.id !== 'string') {
            console.error("GameStateManager: Attempted to set invalid player entity:", playerEntity);
            // Optionally throw an error or just log
            return;
        }
        this.#playerEntity = playerEntity;
        console.log(`GameStateManager: Player set to ${playerEntity ? playerEntity.id : 'null'}`);
    }

    /**
     * Sets the current location entity.
     * @param {Entity | null} locationEntity - The location entity instance. Should not be null during gameplay.
     */
    setCurrentLocation(locationEntity) {
        // Optional: Add validation
        if (locationEntity && typeof locationEntity.id !== 'string') {
            console.error("GameStateManager: Attempted to set invalid location entity:", locationEntity);
            // Optionally throw an error or just log
            return;
        }
        this.#currentLocation = locationEntity;
        console.log(`GameStateManager: Current location set to ${locationEntity ? locationEntity.id : 'null'}`);
    }
}

export default GameStateManager;