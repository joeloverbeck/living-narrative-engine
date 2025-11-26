/**
 * @file JSON Logic operator that checks if an item is being grabbed by an actor
 * @module IsItemBeingGrabbedOperator
 * @description Checks if a specific item is currently held by an actor's grabbing appendages
 */

import {
  resolveEntityPath,
  hasValidEntityId,
} from '../utils/entityPathResolver.js';
import jsonLogic from 'json-logic-js';
import { getHeldItems } from '../../utils/grabbingUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class IsItemBeingGrabbedOperator
 * @description Checks if an item is currently being held by an actor
 *
 * Usage: {"isItemBeingGrabbed": ["actor", "entity"]}
 * Usage: {"isItemBeingGrabbed": [{"var": "actor"}, {"var": "entity"}]}
 * Returns: true if the item is currently held by the actor
 */
export class IsItemBeingGrabbedOperator {
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {string} */
  #operatorName = 'isItemBeingGrabbed';

  /**
   * Creates a new IsItemBeingGrabbedOperator instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {IEntityManager} dependencies.entityManager - The entity manager service
   * @param {ILogger} dependencies.logger - The logger service
   */
  constructor({ entityManager, logger }) {
    if (!entityManager || !logger) {
      throw new Error(
        'IsItemBeingGrabbedOperator: Missing required dependencies'
      );
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Main evaluation method called by JSON Logic
   *
   * @param {Array} params - Operator parameters [actorPath, itemPath]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if the item is currently held by the actor
   */
  evaluate(params, context) {
    try {
      // Validate parameters
      if (!params || !Array.isArray(params) || params.length < 2) {
        this.#logger.warn(
          `${this.#operatorName}: Invalid parameters. Expected [actorPath, itemPath], got ${JSON.stringify(params)}`
        );
        return false;
      }

      const [actorParam, itemParam] = params;

      // Resolve actor
      const actorId = this.#resolveParam(actorParam, context, 'actor');
      if (actorId === null) {
        return false;
      }

      // Resolve item
      const itemId = this.#resolveParam(itemParam, context, 'item');
      if (itemId === null) {
        return false;
      }

      return this.#evaluateInternal(actorId, itemId);
    } catch (error) {
      this.#logger.error(
        `${this.#operatorName}: Error during evaluation`,
        error
      );
      return false;
    }
  }

  /**
   * Resolves a parameter to an entity ID
   *
   * @private
   * @param {unknown} param - The parameter to resolve
   * @param {object} context - The evaluation context
   * @param {string} paramName - Name of the parameter for logging
   * @returns {string|number|null} A valid entity identifier or null when invalid
   */
  #resolveParam(param, context, paramName) {
    let entity;
    let pathForLogging;

    if (param && typeof param === 'object' && !Array.isArray(param)) {
      // Check if this is an entity object or JSON Logic expression
      if (hasValidEntityId(param)) {
        // This is an entity object
        entity = param;
        pathForLogging = `entity object with id=${param.id}`;
        this.#logger.debug(
          `${this.#operatorName}: Received ${paramName} entity object directly: ${pathForLogging}`
        );
      } else {
        // JSON Logic expression - evaluate it
        entity = jsonLogic.apply(param, context);
        pathForLogging = JSON.stringify(param);
        this.#logger.debug(
          `${this.#operatorName}: Evaluated ${paramName} JSON Logic expression ${pathForLogging}, result: ${JSON.stringify(entity)}`
        );
      }
    } else if (typeof param === 'string') {
      // Try to resolve as a path first
      const resolved = resolveEntityPath(context, param);
      pathForLogging = param;

      if (!resolved.isValid) {
        // Check if this looks like a context path
        const commonContextKeys = [
          'entity',
          'actor',
          'location',
          'target',
          'targets',
          'event',
          'self',
        ];
        const looksLikeContextPath =
          commonContextKeys.includes(param) || param.includes('.');

        if (looksLikeContextPath) {
          this.#logger.warn(
            `${this.#operatorName}: No ${paramName} entity found at path ${param}`
          );
          return null;
        } else {
          // Treat as entity ID directly
          this.#logger.debug(
            `${this.#operatorName}: Could not resolve "${param}" as path, treating as ${paramName} entity ID`
          );
          entity = param;
        }
      } else {
        // Check if resolved to object without id
        if (
          typeof resolved.entity === 'object' &&
          !hasValidEntityId(resolved.entity)
        ) {
          this.#logger.debug(
            `${this.#operatorName}: Resolved "${param}" to object without id, treating original path as ${paramName} entity ID`
          );
          entity = param;
        } else {
          entity = resolved.entity;
        }
      }
    } else {
      this.#logger.warn(
        `${this.#operatorName}: Invalid ${paramName} parameter type: ${typeof param}`
      );
      return null;
    }

    return this.#resolveEntityId(entity, pathForLogging, paramName);
  }

  /**
   * Resolves a usable entity identifier from the resolved entity path value
   *
   * @private
   * @param {unknown} entity - The resolved entity value from the context
   * @param {string} entityPath - The path used to resolve the entity
   * @param {string} paramName - Name of the parameter for logging
   * @returns {string|number|null} A valid entity identifier or null when invalid
   */
  #resolveEntityId(entity, entityPath, paramName) {
    let entityId = null;

    if (hasValidEntityId(entity)) {
      entityId = /** @type {{id: string|number}} */ (entity).id;
    } else if (typeof entity === 'string' || typeof entity === 'number') {
      entityId = entity;
    } else {
      this.#logger.warn(
        `${this.#operatorName}: Invalid ${paramName} entity at path ${entityPath}`
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
        `${this.#operatorName}: Invalid ${paramName} entity ID at path ${entityPath}: ${entityId}`
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
   * @param {string|number} itemId - The item entity ID to check
   * @returns {boolean} True if the item is being held by the actor
   */
  #evaluateInternal(actorId, itemId) {
    const heldItems = getHeldItems(this.#entityManager, actorId);

    const isHeld = heldItems.some((held) => held.itemId === itemId);

    this.#logger.debug(
      `${this.#operatorName}: Actor ${actorId} holds ${heldItems.length} items, checking for item ${itemId}, result=${isHeld}`
    );

    return isHeld;
  }
}
