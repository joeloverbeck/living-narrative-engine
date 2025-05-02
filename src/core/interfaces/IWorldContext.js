// src/core/interfaces/IWorldContext.js
// --- FILE START ---

/** @typedef {import('../../entities/entity.js').default} Entity */

/**
 * @interface IWorldContext
 * @description Defines the contract for accessing core game state information,
 * particularly regarding the currently active actor(s) and their context.
 * This interface provides a viewpoint into the dynamic state of the world.
 */
export class IWorldContext {
    /**
     * Retrieves the primary entity currently acting or being focused on (e.g., the player character).
     * @function getCurrentActor
     * @returns {Entity | null} The current actor entity instance, or null if none is active or defined.
     */
    getCurrentActor() {
        throw new Error('IWorldContext.getCurrentActor method not implemented.');
    }

    /**
     * Retrieves the entity representing the current location relevant to the active context or actor.
     * @function getCurrentLocation
     * @returns {Entity | null} The entity instance representing the current location,
     * or null if the location cannot be determined or is not set.
     */
    getCurrentLocation() {
        throw new Error('IWorldContext.getCurrentLocation method not implemented.');
    }

    /**
     * Retrieves the location entity containing a specific entity instance.
     * @function getLocationOfEntity
     * @param {string} entityId - The unique ID of the entity whose location is requested.
     * @returns {Entity | null} The location entity instance where the specified entity resides,
     * or null if the entity is not found or has no defined location.
     */
    getLocationOfEntity(entityId) {
        throw new Error('IWorldContext.getLocationOfEntity method not implemented.');
    }

    // Note: assertSingleCurrentActor? is not included as per ticket conditions (#3 dependency).
}

// --- FILE END ---