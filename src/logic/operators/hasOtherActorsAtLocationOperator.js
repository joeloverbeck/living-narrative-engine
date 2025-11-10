/**
 * @module HasOtherActorsAtLocationOperator
 * @description JSON Logic operator to check if other actors are present at the same location as the entity
 */

import {
  resolveEntityPath,
  hasValidEntityId,
} from '../utils/entityPathResolver.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class HasOtherActorsAtLocationOperator
 * @description Checks if there are other actors (besides the specified entity) at the same location
 *
 * Usage: {"hasOtherActorsAtLocation": ["actor"]}
 * Returns: true if other actors are present at the same location
 */
export class HasOtherActorsAtLocationOperator {
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {string} */
  #operatorName = 'hasOtherActorsAtLocation';

  /**
   * Creates a new HasOtherActorsAtLocationOperator instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {IEntityManager} dependencies.entityManager - The entity manager service
   * @param {ILogger} dependencies.logger - The logger service
   */
  constructor({ entityManager, logger }) {
    if (!entityManager || !logger) {
      throw new Error(
        'HasOtherActorsAtLocationOperator: Missing required dependencies'
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
   * @returns {boolean} True if other actors are present at the same location
   */
  evaluate(params, context) {
    try {
      // Validate parameters
      if (!params || !Array.isArray(params) || params.length < 1) {
        this.#logger.warn(`${this.#operatorName}: Invalid parameters`);
        return false;
      }

      const [entityPath] = params;

      // Store the entity path for logging
      context._currentPath = entityPath;

      // Resolve entity from path
      const { entity, isValid } = resolveEntityPath(context, entityPath);

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
   * Internal evaluation logic
   *
   * @private
   * @param {string|number} actorId - The actor entity ID
   * @returns {boolean} True if other actors are at the same location
   */
  #evaluateInternal(actorId) {
    // Get actor's position component
    const actorPosition = this.#entityManager.getComponentData(
      actorId,
      'core:position'
    );

    if (!actorPosition || !actorPosition.locationId) {
      this.#logger.debug(
        `${this.#operatorName}: Actor ${actorId} has no position component or locationId`
      );
      return false;
    }

    const locationId = actorPosition.locationId;

    this.#logger.debug(
      `${this.#operatorName}: Checking for other actors at location ${locationId}`
    );

    // Get all entities
    const allEntities = this.#entityManager.getAllEntities();

    // Find all entities at the same location
    const entitiesAtLocation = allEntities.filter((entity) => {
      const position = this.#entityManager.getComponentData(
        entity.id,
        'core:position'
      );
      return position && position.locationId === locationId;
    });

    this.#logger.debug(
      `${this.#operatorName}: Found ${entitiesAtLocation.length} entities at location ${locationId}`
    );

    // Filter to actors only (entities with core:actor component)
    const actorsAtLocation = entitiesAtLocation.filter((entity) =>
      this.#entityManager.hasComponent(entity.id, 'core:actor')
    );

    this.#logger.debug(
      `${this.#operatorName}: Found ${actorsAtLocation.length} actors at location ${locationId}`
    );

    // Exclude the acting actor
    const otherActors = actorsAtLocation.filter(
      (entity) => entity.id !== actorId
    );

    const result = otherActors.length > 0;

    this.#logger.debug(
      `${this.#operatorName}: Found ${otherActors.length} other actors at location ${locationId}, returning ${result}`
    );

    return result;
  }
}
