// src/core/worldContext.js
// --- FILE START ---

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */

import {IWorldContext} from './interfaces/IWorldContext.js';
import {POSITION_COMPONENT_ID, CURRENT_ACTOR_COMPONENT_ID} from '../constants/componentIds.js'; // Assuming these constants exist

/**
 * Provides a stateless view of the world context, deriving information directly
 * from the EntityManager based on component queries. Focuses on identifying the
 * single current actor and their location.
 * Implements the IWorldContext interface.
 *
 * @class WorldContext
 * @implements {IWorldContext}
 */
class WorldContext extends IWorldContext {
    /**
     * @private
     * @type {EntityManager}
     */
    #entityManager;

    /**
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * Creates an instance of WorldContext.
     * @param {EntityManager} entityManager - The entity manager instance to query game state.
     * @param {ILogger} logger - The logger service.
     * @throws {Error} If entityManager or logger is invalid.
     */
    constructor(entityManager, logger) {
        super();
        if (!entityManager || typeof entityManager.getEntitiesWithComponent !== 'function' || typeof entityManager.getEntityInstance !== 'function') {
            throw new Error('WorldContext requires a valid EntityManager instance.');
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            throw new Error('WorldContext requires a valid ILogger instance.');
        }
        this.#entityManager = entityManager;
        this.#logger = logger;
        this.#logger.info('WorldContext: Initialized (Stateless, backed by EntityManager).');
    }

    /**
     * Asserts that exactly one entity has the CURRENT_ACTOR_COMPONENT_ID.
     * Throws an error in development environments if the assertion fails.
     * Logs an error in production environments if the assertion fails.
     * @private
     * @param {Entity[]} actors - The array of entities found with the current actor component.
     * @returns {boolean} True if the assertion passes (exactly one actor), false otherwise.
     */
    #assertSingleCurrentActor(actors) {
        const actorCount = actors.length;
        if (actorCount === 1) {
            return true; // Assertion passes
        }

        const errorMessage = `WorldContext: Expected exactly one entity with component '${CURRENT_ACTOR_COMPONENT_ID}', but found ${actorCount}.`;

        if (process.env.NODE_ENV !== 'production') {
            // In development, throw an error for immediate feedback
            this.#logger.error(errorMessage + ' (Throwing in dev mode)');
            throw new Error(errorMessage);
        } else {
            // In production, log an error but allow the calling function to return null gracefully
            this.#logger.error(errorMessage + ' (Returning null in prod mode)');
            return false; // Assertion fails
        }
    }


    /**
     * Retrieves the primary entity currently marked as the active actor.
     * It expects exactly one entity to have the `CURRENT_ACTOR_COMPONENT_ID`.
     * Logs an error and returns null if zero or more than one actor is found.
     * Uses a development-only assertion (`#assertSingleCurrentActor`) to throw on error during development.
     * @returns {Entity | null} The current actor entity instance, or null if none or multiple are found.
     * @implements {IWorldContext.getCurrentActor}
     */
    getCurrentActor() {
        const actors = this.#entityManager.getEntitiesWithComponent(CURRENT_ACTOR_COMPONENT_ID);

        // Perform assertion (throws in dev if fails, logs in prod)
        if (!this.#assertSingleCurrentActor(actors)) {
            return null; // Assertion failed in production (or dev if error wasn't caught)
        }

        // If assertion passed, we know actors.length === 1
        const actor = actors[0];
        // this.#logger.debug(`WorldContext: Found current actor: ${actor.id}`);
        return actor;
    }

    /**
     * Retrieves the entity representing the current location of the primary actor.
     * This is derived by first finding the current actor, then getting their position component,
     * and finally resolving the location entity based on the locationId in the position component.
     * Logs errors and returns null if the actor cannot be determined, has no position,
     * or the location entity cannot be found.
     * @returns {Entity | null} The entity instance representing the current location, or null if it cannot be determined.
     * @implements {IWorldContext.getCurrentLocation}
     */
    getCurrentLocation() {
        const actor = this.getCurrentActor();
        if (!actor) {
            // Error already logged by getCurrentActor if actor count != 1
            this.#logger.debug('WorldContext.getCurrentLocation: Cannot get location because current actor could not be determined.');
            return null;
        }

        const positionData = this.#entityManager.getComponentData(actor.id, POSITION_COMPONENT_ID);
        if (!positionData || typeof positionData.locationId !== 'string' || !positionData.locationId) {
            this.#logger.error(`WorldContext.getCurrentLocation: Current actor '${actor.id}' is missing a valid '${POSITION_COMPONENT_ID}' component or locationId.`);
            return null;
        }

        const locationId = positionData.locationId;
        const locationEntity = this.#entityManager.getEntityInstance(locationId);

        if (!locationEntity) {
            // This might indicate a data integrity issue (position points to a non-existent entity)
            this.#logger.warn(`WorldContext.getCurrentLocation: Could not find location entity with ID '${locationId}' referenced by actor '${actor.id}'.`);
            return null;
        }

        // this.#logger.debug(`WorldContext: Current location for actor ${actor.id} is ${locationEntity.id}`);
        return locationEntity;
    }

    /**
     * Retrieves the location entity containing a specific entity instance, based on its position component.
     * @param {string} entityId - The unique ID of the entity whose location is requested.
     * @returns {Entity | null} The location entity instance where the specified entity resides,
     * or null if the entity is not found, has no position component, or the location entity doesn't exist.
     * @implements {IWorldContext.getLocationOfEntity}
     */
    getLocationOfEntity(entityId) {
        if (typeof entityId !== 'string' || !entityId) {
            this.#logger.warn(`WorldContext.getLocationOfEntity: Invalid entityId provided: ${entityId}`);
            return null;
        }

        // We don't need the full Entity instance here, just its components via EntityManager
        const positionData = this.#entityManager.getComponentData(entityId, POSITION_COMPONENT_ID);

        if (!positionData) {
            // It's valid for an entity to not have a position, so debug log might be more appropriate
            // this.#logger.debug(`WorldContext.getLocationOfEntity: Entity '${entityId}' does not have a '${POSITION_COMPONENT_ID}' component.`);
            return null;
        }

        if (typeof positionData.locationId !== 'string' || !positionData.locationId) {
            // Entity has position, but no valid locationId
            this.#logger.warn(`WorldContext.getLocationOfEntity: Entity '${entityId}' has a position component but is missing a valid locationId.`);
            return null;
        }

        const locationId = positionData.locationId;
        const locationEntity = this.#entityManager.getEntityInstance(locationId);

        if (!locationEntity) {
            // Position points to a non-existent location entity
            this.#logger.warn(`WorldContext.getLocationOfEntity: Could not find location entity with ID '${locationId}' referenced by entity '${entityId}'.`);
            return null;
        }

        // this.#logger.debug(`WorldContext: Location of entity ${entityId} is ${locationEntity.id}`);
        return locationEntity;
    }

    /**
     * Resolves a direction taken from a current location to a target location ID.
     * This method is intended to be called via SystemDataRegistry for rules.
     * @param {object} queryParams - Parameters for the query.
     * @param {string} queryParams.current_location_id - The ID of the current location entity.
     * @param {string} queryParams.direction_taken - The direction string (e.g., "out to town").
     * @returns {string | null} The ID of the target location, or null if invalid.
     */
    getTargetLocationForDirection({current_location_id, direction_taken}) {
        if (!current_location_id || typeof current_location_id !== 'string') {
            this.#logger.warn('WorldContext.getTargetLocationForDirection: Missing or invalid current_location_id.', {
                current_location_id,
                direction_taken
            });
            return null;
        }
        if (!direction_taken || typeof direction_taken !== 'string') {
            this.#logger.warn('WorldContext.getTargetLocationForDirection: Missing or invalid direction_taken.', {
                current_location_id,
                direction_taken
            });
            return null;
        }

        this.#logger.debug(`WorldContext: Attempting to resolve direction '${direction_taken}' from location '${current_location_id}'.`);

        const exitsComponentData = this.#entityManager.getComponentData(current_location_id, 'core:exits');

        if (!exitsComponentData) {
            this.#logger.warn(`WorldContext: Location '${current_location_id}' has no 'core:exits' component.`);
            return null;
        }

        if (!Array.isArray(exitsComponentData)) {
            this.#logger.error(`WorldContext: 'core:exits' component data for location '${current_location_id}' is not an array.`, {data: exitsComponentData});
            return null;
        }

        const foundExit = exitsComponentData.find(exit => exit.direction === direction_taken);

        if (foundExit) {
            if (foundExit.blocker) {
                this.#logger.debug(`WorldContext: Exit from '${current_location_id}' via '${direction_taken}' to '${foundExit.target}' is blocked by '${foundExit.blocker}'.`);
                // For now, a blocked exit means "can't go that way"
                return null;
            }
            this.#logger.debug(`WorldContext: Successfully resolved direction. Target location: '${foundExit.target}'.`);
            return foundExit.target; // This is the target location ID string
        } else {
            this.#logger.warn(`WorldContext: No exit found for direction '${direction_taken}' from location '${current_location_id}'.`);
            return null;
        }
    }

}

export default WorldContext;
// --- FILE END ---