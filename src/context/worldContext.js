// src/context/worldContext.js
// --- FILE START ---

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import { IWorldContext } from '../interfaces/IWorldContext.js';
import {
  POSITION_COMPONENT_ID,
  CURRENT_ACTOR_COMPONENT_ID,
} from '../constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';
import { ISafeEventDispatcher } from '../interfaces/ISafeEventDispatcher.js';
import { resolveSafeDispatcher } from '../utils/dispatcherUtils.js';

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
   * Safe event dispatcher for reporting errors.
   *
   * @private
   * @type {ISafeEventDispatcher}
   */
  #safeEventDispatcher;

  /**
   * Creates an instance of WorldContext.
   *
   * @param {EntityManager} entityManager - The entity manager instance to query game state.
   * @param {ILogger} logger - The logger service.
   * @throws {Error} If entityManager or logger is invalid.
   */
  constructor(entityManager, logger, safeEventDispatcher) {
    super();
    // Ensure EntityManager has the new getPrimaryInstanceByDefinitionId method
    if (
      !entityManager ||
      typeof entityManager.getEntitiesWithComponent !== 'function' ||
      typeof entityManager.getEntityInstance !== 'function' ||
      typeof entityManager.getPrimaryInstanceByDefinitionId !== 'function'
    ) {
      throw new Error(
        'WorldContext requires a valid EntityManager instance with getEntitiesWithComponent, getEntityInstance, and getPrimaryInstanceByDefinitionId methods.'
      );
    }
    if (
      !logger ||
      typeof logger.error !== 'function' ||
      typeof logger.debug !== 'function' ||
      typeof logger.warn !== 'function'
    ) {
      throw new Error(
        'WorldContext requires a valid ILogger instance with info, error, debug and warn methods.'
      );
    }
    this.#safeEventDispatcher = resolveSafeDispatcher(
      null,
      safeEventDispatcher,
      logger
    );
    if (!this.#safeEventDispatcher) {
      console.warn(
        'WorldContext: safeEventDispatcher resolution failed; some errors may not be dispatched.'
      );
    }
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#logger.debug(
      'WorldContext: Initialized (Stateless, backed by EntityManager).'
    );
  }

  /**
   * Asserts that exactly one entity has the CURRENT_ACTOR_COMPONENT_ID.
   * Throws an error in development environments if the assertion fails.
   * Logs an error in production environments if the assertion fails.
   *
   * @private
   * @param {Entity[]} actors - The array of entities found with the current actor component.
   * @returns {boolean} True if the assertion passes (exactly one actor), false otherwise.
   */
  #assertSingleCurrentActor(actors) {
    const actorCount = actors.length;
    if (actorCount === 1) {
      return true;
    }

    const errorMessage = `WorldContext: Expected exactly one entity with component '${CURRENT_ACTOR_COMPONENT_ID}', but found ${actorCount}.`;

    this.#safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      message: errorMessage,
      details: { actorCount },
    });

    if (
      typeof globalThis !== 'undefined' &&
      globalThis.process &&
      globalThis.process.env.NODE_ENV !== 'production'
    ) {
      throw new Error(errorMessage);
    } else {
      return false;
    }
  }

  /**
   * Retrieves the primary entity currently marked as the active actor.
   *
   * @returns {Entity | null} The current actor entity instance, or null if none or multiple are found.
   */
  getCurrentActor() {
    const actors = this.#entityManager.getEntitiesWithComponent(
      CURRENT_ACTOR_COMPONENT_ID
    );
    if (!this.#assertSingleCurrentActor(actors)) {
      return null;
    }
    const actor = actors[0];
    return actor;
  }

  /**
   * Retrieves the entity representing the current location of the primary actor.
   * The locationId in the actor's position component should be an instance ID.
   *
   * @returns {Entity | null} The entity instance representing the current location, or null if it cannot be determined.
   */
  getCurrentLocation() {
    const actor = this.getCurrentActor();
    if (!actor) {
      this.#logger.debug(
        'WorldContext.getCurrentLocation: Cannot get location because current actor could not be determined.'
      );
      return null;
    }

    const positionData = this.#entityManager.getComponentData(
      actor.id,
      POSITION_COMPONENT_ID
    );
    if (
      !positionData ||
      typeof positionData.locationId !== 'string' ||
      !positionData.locationId
    ) {
      const msg = `WorldContext.getCurrentLocation: Current actor '${actor.id}' is missing a valid '${POSITION_COMPONENT_ID}' component or locationId.`;
      this.#safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: msg,
      });
      return null;
    }

    const locationId = positionData.locationId; // This should be an INSTANCE ID
    const locationEntity = this.#entityManager.getEntityInstance(locationId);

    if (!locationEntity) {
      // This warning means the actor's position.locationId (an instanceId) doesn't point to a valid entity instance.
      this.#logger.warn(
        `WorldContext.getCurrentLocation: Could not find location entity INSTANCE with ID '${locationId}' referenced by actor '${actor.id}'.`
      );
      return null;
    }
    return locationEntity;
  }

  /**
   * Retrieves the location entity containing a specific entity instance, based on its position component.
   * The locationId in the entity's position component should be an instance ID.
   *
   * @param {string} entityId - The unique ID of the entity whose location is requested.
   * @returns {Entity | null} The location entity instance where the specified entity resides.
   */
  getLocationOfEntity(entityId) {
    if (typeof entityId !== 'string' || !entityId) {
      this.#logger.warn(
        `WorldContext.getLocationOfEntity: Invalid entityId provided: ${entityId}`
      );
      return null;
    }

    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      this.#logger.warn(
        `WorldContext.getLocationOfEntity: Entity with ID '${entityId}' not found.`
      );
      return null; // Entity itself doesn't exist
    }

    const positionData = entity.getComponentData(POSITION_COMPONENT_ID);

    if (!positionData) {
      this.#logger.debug(
        `WorldContext.getLocationOfEntity: Entity '${entityId}' has no position component.`
      );
      return null;
    }

    if (
      typeof positionData.locationId !== 'string' ||
      !positionData.locationId
    ) {
      this.#logger.warn(
        `WorldContext.getLocationOfEntity: Entity '${entityId}' has a position component but is missing a valid locationId.`
      );
      return null;
    }

    const locationId = positionData.locationId; // This should be an INSTANCE ID
    const locationEntity = this.#entityManager.getEntityInstance(locationId);

    if (!locationEntity) {
      // This warning means the entity's position.locationId (an instanceId) doesn't point to a valid entity instance.
      this.#logger.warn(
        `WorldContext.getLocationOfEntity: Could not find location entity INSTANCE with ID '${locationId}' referenced by entity '${entityId}'.`
      );
      return null;
    }
    return locationEntity;
  }

  /**
   * Resolves a direction taken from a current location to a target location's INSTANCE ID.
   *
   * @param {object} queryParams - Parameters for the query.
   * @param {string} queryParams.current_location_id - The INSTANCE ID of the current location entity.
   * @param {string} queryParams.direction_taken - The direction string (e.g., "out to town").
   * @returns {string | null} The INSTANCE ID of the target location, or null if invalid or target not found.
   */
  getTargetLocationForDirection({ current_location_id, direction_taken }) {
    if (!current_location_id || typeof current_location_id !== 'string') {
      this.#logger.warn(
        'WorldContext.getTargetLocationForDirection: Missing or invalid current_location_id (must be an instance ID).',
        {
          current_location_id,
          direction_taken,
        }
      );
      return null;
    }
    if (!direction_taken || typeof direction_taken !== 'string') {
      this.#logger.warn(
        'WorldContext.getTargetLocationForDirection: Missing or invalid direction_taken.',
        {
          current_location_id,
          direction_taken,
        }
      );
      return null;
    }

    this.#logger.debug(
      `WorldContext: Attempting to resolve direction '${direction_taken}' from location INSTANCE '${current_location_id}'.`
    );

    // current_location_id is an instance ID, so getComponentData is correct here.
    const exitsComponentData = this.#entityManager.getComponentData(
      current_location_id,
      'core:exits'
    );
    if (!Array.isArray(exitsComponentData)) {
      this.#logger.warn(
        `WorldContext: location '${current_location_id}' has no exits.`
      );
      return null;
    }

    const foundExit = exitsComponentData.find(
      (exit) => exit.direction === direction_taken
    );
    if (!foundExit) {
      this.#logger.warn(
        `WorldContext: no exit '${direction_taken}' from '${current_location_id}'.`
      );
      return null;
    }
    if (foundExit.blocker) return null;

    /* ---------------------------------------------------------
     * Treat target as runtime INSTANCE first
     * ---------------------------------------------------------
     */
    const instance = this.#entityManager.getEntityInstance(foundExit.target);
    if (instance) {
      // success on first try
      return instance.id;
    }

    // Nothing worked
    this.#logger.warn(
      `WorldContext: exit '${direction_taken}' points to '${foundExit.target}', but no such instance exists.`
    );
    return null;
  }

  /**
   * Retrieves the current timestamp in ISO 8601 format.
   *
   * @returns {string} The current ISO 8601 timestamp (e.g., "YYYY-MM-DDTHH:mm:ss.sssZ").
   */
  getCurrentISOTimestamp() {
    return new Date().toISOString();
  }
}

export default WorldContext;
// --- FILE END ---
