/**
 * @module IsActorLocationLitOperator
 * @description JSON Logic operator to check if the actor's current location is lit
 */

import {
  resolveEntityPath,
  hasValidEntityId,
} from '../utils/entityPathResolver.js';
import { POSITION_COMPONENT_ID } from '../../constants/componentIds.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../locations/services/lightingStateService.js').LightingStateService} LightingStateService */

/**
 * @class IsActorLocationLitOperator
 * @description Checks if the actor's current location has sufficient lighting
 *
 * Usage: {"isActorLocationLit": ["actor"]}
 * Returns: true if the actor's location is lit (either ambient or artificial light)
 */
export class IsActorLocationLitOperator {
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {LightingStateService} */
  #lightingStateService;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {string} */
  #operatorName = 'isActorLocationLit';

  /**
   * Creates a new IsActorLocationLitOperator instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {IEntityManager} dependencies.entityManager - The entity manager service
   * @param {LightingStateService} dependencies.lightingStateService - The lighting state service
   * @param {ILogger} dependencies.logger - The logger service
   */
  constructor({ entityManager, lightingStateService, logger }) {
    if (!entityManager || !lightingStateService || !logger) {
      throw new Error(
        'IsActorLocationLitOperator: Missing required dependencies'
      );
    }

    this.#entityManager = entityManager;
    this.#lightingStateService = lightingStateService;
    this.#logger = logger;
  }

  /**
   * Main evaluation method called by JSON Logic
   *
   * @param {Array} params - Operator parameters [entityPath]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if the actor's location is lit
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
   * Internal evaluation logic - gets actor's location and checks lighting
   *
   * @private
   * @param {string|number} actorId - The actor entity ID
   * @returns {boolean} True if the actor's location is lit
   */
  #evaluateInternal(actorId) {
    // Get actor's position component
    const actorPosition = this.#entityManager.getComponentData(
      actorId,
      POSITION_COMPONENT_ID
    );

    if (!actorPosition || !actorPosition.locationId) {
      this.#logger.debug(
        `${this.#operatorName}: Actor ${actorId} has no position component or locationId - failing open`
      );
      // Fail open - don't block movement if we can't determine location
      return true;
    }

    const locationId = actorPosition.locationId;
    const isLit = this.#lightingStateService.isLocationLit(locationId);

    this.#logger.debug(
      `${this.#operatorName}: Location ${locationId} isLit=${isLit}`
    );

    return isLit;
  }
}
