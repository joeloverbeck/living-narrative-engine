/**
 * @module LocationHasExitsOperator
 * @description JSON Logic operator to check if the actor's current location has exits
 */

import {
  resolveEntityPath,
  hasValidEntityId,
} from '../utils/entityPathResolver.js';
import {
  POSITION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
} from '../../constants/componentIds.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class LocationHasExitsOperator
 * @description Checks if the actor's current location has available exits
 *
 * Usage: {"locationHasExits": ["actor"]}
 * Returns: true if the actor's location has at least one exit
 */
export class LocationHasExitsOperator {
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {string} */
  #operatorName = 'locationHasExits';

  /**
   * Creates a new LocationHasExitsOperator instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {IEntityManager} dependencies.entityManager - The entity manager service
   * @param {ILogger} dependencies.logger - The logger service
   */
  constructor({ entityManager, logger }) {
    if (!entityManager || !logger) {
      throw new Error(
        'LocationHasExitsOperator: Missing required dependencies'
      );
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Main evaluation method called by JSON Logic
   *
   * @param {Array} params - Operator parameters [entityPath]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if the actor's location has exits
   */
  evaluate(params, context) {
    try {
      // Validate parameters
      if (!params || !Array.isArray(params) || params.length < 1) {
        this.#logger.warn(`${this.#operatorName}: Invalid parameters`);
        return false;
      }

      const [entityPath] = params;

      // Clone context to avoid mutating the shared context object
      const localContext = { ...context };
      localContext._currentPath = entityPath;

      // Resolve entity from path
      const { entity, isValid } = resolveEntityPath(localContext, entityPath);

      if (!isValid) {
        this.#logger.warn(
          `${this.#operatorName}: No entity found at path ${entityPath}`
        );
        return false;
      }

      const actorId = this.#resolveEntityId(entity, entityPath);

      if (actorId === null) {
        return false;
      }

      return this.#evaluateInternal(actorId);
    } catch (error) {
      this.#logger.error(
        `${this.#operatorName}: Error during evaluation`,
        error
      );
      return false;
    }
  }

  /**
   * Resolves a usable entity identifier from the resolved entity path value.
   *
   * @private
   * @param {unknown} entity - The resolved entity value from the context
   * @param {string} entityPath - The JSON Logic path used to resolve the entity
   * @returns {string|number|null} A valid entity identifier or null when invalid
   */
  #resolveEntityId(entity, entityPath) {
    let entityId = null;

    if (hasValidEntityId(entity)) {
      entityId = /** @type {{id: string|number}} */ (entity).id;
    } else if (typeof entity === 'string' || typeof entity === 'number') {
      entityId = entity;
    } else {
      this.#logger.warn(
        `${this.#operatorName}: Invalid entity at path ${entityPath}`
      );
      return null;
    }

    if (
      entityId === undefined ||
      entityId === null ||
      (typeof entityId === 'string' && entityId.trim() === '') ||
      (typeof entityId === 'number' && Number.isNaN(entityId))
    ) {
      this.#logger.warn(
        `${this.#operatorName}: Invalid entity at path ${entityPath}`
      );
      return null;
    }

    return entityId;
  }

  /**
   * Internal evaluation logic - gets actor's location and checks for exits
   *
   * @private
   * @param {string|number} actorId - The actor entity ID
   * @returns {boolean} True if the actor's location has exits
   */
  #evaluateInternal(actorId) {
    // Get actor's position component
    const actorPosition = this.#entityManager.getComponentData(
      actorId,
      POSITION_COMPONENT_ID
    );

    if (!actorPosition || !actorPosition.locationId) {
      this.#logger.debug(
        `${this.#operatorName}: Actor ${actorId} has no position component or locationId`
      );
      return false;
    }

    const locationId = actorPosition.locationId;

    // Get location's exits component
    const exitsComponent = this.#entityManager.getComponentData(
      locationId,
      EXITS_COMPONENT_ID
    );

    if (!exitsComponent) {
      this.#logger.debug(
        `${this.#operatorName}: Location ${locationId} has no locations:exits component`
      );
      return false;
    }

    // Check if exits is an array with at least one element
    const exits = exitsComponent.exits || exitsComponent;
    const hasExits = Array.isArray(exits) && exits.length > 0;

    this.#logger.debug(
      `${this.#operatorName}: Location ${locationId} hasExits=${hasExits} (count=${Array.isArray(exits) ? exits.length : 0})`
    );

    return hasExits;
  }
}
