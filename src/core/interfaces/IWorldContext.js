/** @typedef {import('../../entities/entity.js').default} Entity */

/**
 * @interface IWorldContext
 * @description Defines the contract for accessing core, mutable game state information,
 * such as the player entity and their current location. Acts as a central point of access
 * for dynamic world state needed by various systems.
 */
export class IWorldContext {
    /**
     * Retrieves the entity representing the player's current location in the game world.
     * @function getCurrentLocation
     * @param {string} [entityId] - Optional: The ID of the entity whose location is needed.
     * Implementations may vary; some might return a global "player viewpoint" location
     * if no ID is provided, while others might require the ID.
     * @returns {Entity | null} The entity instance representing the current location,
     * or null if the location cannot be determined or is not set.
     */
    getCurrentLocation(entityId) {
        throw new Error('IGameStateManager.getCurrentLocation method not implemented.');
    }

    /**
     * Retrieves the entity instance representing the primary player character.
     * @function getPlayer
     * @returns {Entity | null} The player entity instance, or null if not set or not applicable.
     */
    getPlayer() {
        throw new Error('IGameStateManager.getPlayer method not implemented.');
    }
}