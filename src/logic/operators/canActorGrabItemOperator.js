/**
 * @file JSON Logic operator that checks if actor can grab an item based on hand requirements
 * @module CanActorGrabItemOperator
 * @description Compares actor's free grabbing appendages against item's handsRequired property
 */

import {
  resolveEntityPath,
  hasValidEntityId,
} from '../utils/entityPathResolver.js';
import jsonLogic from 'json-logic-js';
import { countFreeGrabbingAppendages } from '../../utils/grabbingUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class CanActorGrabItemOperator
 * @description Checks if an actor has enough free grabbing appendages to grab an item
 *
 * Usage: {"canActorGrabItem": ["actor", "entity"]}
 * Returns: true if actor has >= item's handsRequired free grabbing appendages
 */
export class CanActorGrabItemOperator {
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {string} */
  #operatorName = 'canActorGrabItem';

  /**
   * Creates a new CanActorGrabItemOperator instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {IEntityManager} dependencies.entityManager - The entity manager service
   * @param {ILogger} dependencies.logger - The logger service
   */
  constructor({ entityManager, logger }) {
    if (!entityManager || !logger) {
      throw new Error(
        'CanActorGrabItemOperator: Missing required dependencies'
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
   * @returns {boolean} True if actor can grab the item
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

      const [actorPath, itemPath] = params;

      // Resolve actor
      const actorId = this.#resolveEntityIdFromPath(actorPath, context, 'actor');
      if (actorId === null) {
        return false;
      }

      // Resolve item
      const itemId = this.#resolveEntityIdFromPath(itemPath, context, 'item');
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
   * Resolves an entity ID from a path parameter
   *
   * @private
   * @param {unknown} pathParam - The path parameter (string, JSON Logic expression, or entity object)
   * @param {object} context - The evaluation context
   * @param {string} paramName - Name of the parameter for logging
   * @returns {string|number|null} The resolved entity ID or null if resolution fails
   */
  #resolveEntityIdFromPath(pathParam, context, paramName) {
    let entity;
    let pathForLogging;

    if (
      pathParam &&
      typeof pathParam === 'object' &&
      !Array.isArray(pathParam)
    ) {
      // Check if this is an entity object or JSON Logic expression
      if (hasValidEntityId(pathParam)) {
        // This is an entity object
        entity = pathParam;
        pathForLogging = `entity object with id=${pathParam.id}`;
        this.#logger.debug(
          `${this.#operatorName}: Received ${paramName} entity object directly: ${pathForLogging}`
        );
      } else {
        // JSON Logic expression - evaluate it
        entity = jsonLogic.apply(pathParam, context);
        pathForLogging = JSON.stringify(pathParam);
        this.#logger.debug(
          `${this.#operatorName}: Evaluated ${paramName} JSON Logic expression ${pathForLogging}, result: ${JSON.stringify(entity)}`
        );
      }
    } else if (typeof pathParam === 'string') {
      // Try to resolve as a path first
      const resolved = resolveEntityPath(context, pathParam);
      pathForLogging = pathParam;

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
          commonContextKeys.includes(pathParam) || pathParam.includes('.');

        if (looksLikeContextPath) {
          this.#logger.warn(
            `${this.#operatorName}: No ${paramName} entity found at path ${pathParam}`
          );
          return null;
        } else {
          // Treat as entity ID directly
          this.#logger.debug(
            `${this.#operatorName}: Could not resolve "${pathParam}" as path, treating as ${paramName} entity ID`
          );
          entity = pathParam;
        }
      } else {
        // Check if resolved to object without id
        if (
          typeof resolved.entity === 'object' &&
          !hasValidEntityId(resolved.entity)
        ) {
          this.#logger.debug(
            `${this.#operatorName}: Resolved "${pathParam}" to object without id, treating original path as ${paramName} entity ID`
          );
          entity = pathParam;
        } else {
          entity = resolved.entity;
        }
      }
    } else {
      this.#logger.warn(
        `${this.#operatorName}: Invalid ${paramName} path type: ${typeof pathParam}`
      );
      return null;
    }

    return this.#extractEntityId(entity, pathForLogging, paramName);
  }

  /**
   * Extracts a valid entity ID from the resolved entity
   *
   * @private
   * @param {unknown} entity - The resolved entity value
   * @param {string} pathForLogging - The path used for logging
   * @param {string} paramName - Name of the parameter for logging
   * @returns {string|number|null} A valid entity ID or null when invalid
   */
  #extractEntityId(entity, pathForLogging, paramName) {
    let entityId = null;

    if (hasValidEntityId(entity)) {
      entityId = /** @type {{id: string|number}} */ (entity).id;
    } else if (typeof entity === 'string' || typeof entity === 'number') {
      entityId = entity;
    } else {
      this.#logger.warn(
        `${this.#operatorName}: Invalid ${paramName} at path ${pathForLogging}`
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
        `${this.#operatorName}: Invalid ${paramName} ID at path ${pathForLogging}: ${entityId}`
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
   * @param {string|number} itemId - The item entity ID
   * @returns {boolean} True if actor has enough free appendages to grab the item
   */
  #evaluateInternal(actorId, itemId) {
    // Get item's handsRequired (default to 1 if component is absent)
    const requiresGrabbing = this.#entityManager.getComponentData(
      itemId,
      'anatomy:requires_grabbing'
    );
    const handsRequired = requiresGrabbing?.handsRequired ?? 1;

    // If handsRequired is 0, always return true (rings, etc.)
    if (handsRequired === 0) {
      this.#logger.debug(
        `${this.#operatorName}: Item ${itemId} requires 0 hands, returning true`
      );
      return true;
    }

    // Get actor's free appendage count
    const freeCount = countFreeGrabbingAppendages(this.#entityManager, actorId);

    const result = freeCount >= handsRequired;

    this.#logger.debug(
      `${this.#operatorName}: Actor ${actorId} has ${freeCount} free grabbing appendages, item ${itemId} requires ${handsRequired}, result=${result}`
    );

    return result;
  }
}
