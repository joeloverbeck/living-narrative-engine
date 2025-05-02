// src/core/gameStateManager.js
// --- FILE START (Entire corrected file content) ---

/** @typedef {import('./entities/entity.js').default} Entity */

import {IGameStateManager} from "./interfaces/IGameStateManager.js"; // Ensure interface is imported

/**
 * Manages the core, mutable game world state.
 * Acts as the single source of truth for dynamic elements like the
 * player's current state and location.
 *
 * @class GameStateManager
 * @extends IGameStateManager
 * @implements {IGameStateManager}
 */
class GameStateManager extends IGameStateManager {
    /** @type {Entity | null} */
    #playerEntity; // Using private fields for encapsulation

    /** @type {Entity | null} */
    #currentLocation;

    /**
     * Initializes the game state manager with default null state.
     */
    constructor() {
        super(); // Call super constructor if IGameStateManager has one

        this.#playerEntity = null;
        this.#currentLocation = null;
        console.log('GameStateManager: Initialized.');
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
            console.error('GameStateManager: Attempted to set invalid player entity:', playerEntity);
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
            console.error('GameStateManager: Attempted to set invalid location entity:', locationEntity);
            // Optionally throw an error or just log
            return;
        }
        this.#currentLocation = locationEntity;
        console.log(`GameStateManager: Current location set to ${locationEntity ? locationEntity.id : 'null'}`);
    }

    // ****** START FIX ******
    /**
     * Retrieves the location of a given entity.
     * NOTE: In this simple manager, it returns the global current location,
     * regardless of the entity provided. It fulfills the interface requirement
     * for PlayerTurnHandler.
     * @param {Entity} entity - The entity whose location is requested (currently ignored in this simple implementation).
     * @returns {Entity | null} The current location entity or null if not set.
     * @todo Enhance this if multiple actors/locations need independent tracking based on the entity.
     */
    getLocationOfEntity(entity) {
        // Basic implementation: return the globally tracked location.
        // Add logging or checks if needed (e.g., ensure entity === this.#playerEntity).
        // console.debug(`GameStateManager: getLocationOfEntity called for ${entity?.id}. Returning global location: ${this.#currentLocation?.id}`);
        return this.#currentLocation;
    }
    // ****** END FIX ******

}

export default GameStateManager;
// --- FILE END ---