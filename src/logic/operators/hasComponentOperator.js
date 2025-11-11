/**
 * @module HasComponentOperator
 * @description JSON Logic operator to check if an entity has a specific component
 */

import jsonLogic from 'json-logic-js';
import {
  resolveEntityPath,
  hasValidEntityId,
} from '../utils/entityPathResolver.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class HasComponentOperator
 * @description Checks if an entity has a specific component
 *
 * Usage: {"has_component": ["entity", "movement:is_dimensional_portal"]}
 * Usage: {"has_component": [{"var": "entity.blocker"}, "movement:is_dimensional_portal"]}
 * Returns: true if the entity has the specified component
 */
export class HasComponentOperator {
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {string} */
  #operatorName = 'has_component';

  /**
   * Creates a new HasComponentOperator instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {IEntityManager} dependencies.entityManager - The entity manager service
   * @param {ILogger} dependencies.logger - The logger service
   */
  constructor({ entityManager, logger }) {
    if (!entityManager || !logger) {
      throw new Error(
        'HasComponentOperator: Missing required dependencies'
      );
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Main evaluation method called by JSON Logic
   *
   * @param {Array} params - Operator parameters [entityPath, componentId]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if the entity has the specified component
   */
  evaluate(params, context) {
    try {
      // Validate parameters
      if (!params || !Array.isArray(params) || params.length < 2) {
        this.#logger.warn(
          `${this.#operatorName}: Invalid parameters. Expected [entityPath, componentId], got ${JSON.stringify(params)}`
        );
        return false;
      }

      let [entityPath, componentId] = params;

      // If entityPath is a JSON Logic expression (e.g., {"var": "entity.blocker"}),
      // evaluate it using the context to get the actual value
      let entity;
      let pathForLogging;

      if (
        entityPath &&
        typeof entityPath === 'object' &&
        !Array.isArray(entityPath)
      ) {
        // Check if this is a JSON Logic expression or just an entity object
        // Entity objects have an 'id' property but no JSON Logic operators
        if (hasValidEntityId(entityPath)) {
          // This is an entity object, not a JSON Logic expression
          entity = entityPath;
          pathForLogging = `entity object with id=${entityPath.id}`;
          this.#logger.debug(
            `${this.#operatorName}: Received entity object directly: ${pathForLogging}`
          );
        } else {
          // Assume it's a JSON Logic expression and evaluate it
          entity = jsonLogic.apply(entityPath, context);
          pathForLogging = JSON.stringify(entityPath);
          this.#logger.debug(
            `${this.#operatorName}: Evaluated JSON Logic expression ${pathForLogging}, result: ${JSON.stringify(entity)}`
          );
        }
      } else if (typeof entityPath === 'string') {
        // Try to resolve as a path first (e.g., "entity", "entity.blocker")
        const resolved = resolveEntityPath(context, entityPath);
        pathForLogging = entityPath;

        if (!resolved.isValid) {
          // Path resolution failed - check if this looks like a context path or an entity ID
          // Common context paths: "entity", "actor", "location", "target", "targets"
          // Also paths with dots: "entity.blocker", "actor.items"
          const commonContextKeys = ['entity', 'actor', 'location', 'target', 'targets', 'event'];
          const looksLikeContextPath =
            commonContextKeys.includes(entityPath) ||
            entityPath.includes('.');

          if (looksLikeContextPath) {
            // This looks like a context path that should exist but doesn't - log warning
            this.#logger.warn(
              `${this.#operatorName}: No entity found at path ${entityPath}`
            );
            return false;
          } else {
            // Treat as an entity ID directly
            // This handles cases where JSON Logic pre-evaluates {"var": "entity.blocker"}
            // to an entity ID string like "patrol:dimensional_rift_blocker_instance"
            // or test cases with simple entity IDs like "some-other-entity"
            this.#logger.debug(
              `${this.#operatorName}: Could not resolve "${entityPath}" as path, treating as entity ID`
            );
            entity = entityPath;
          }
        } else {
          entity = resolved.entity;
        }
      } else {
        this.#logger.warn(
          `${this.#operatorName}: Invalid entityPath type: ${typeof entityPath}`
        );
        return false;
      }

      // Validate componentId
      if (typeof componentId !== 'string' || componentId.trim() === '') {
        this.#logger.warn(
          `${this.#operatorName}: Invalid componentId: ${componentId}`
        );
        return false;
      }

      const entityId = this.#resolveEntityId(entity, pathForLogging);

      if (entityId === null) {
        return false;
      }

      return this.#evaluateInternal(entityId, componentId);
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
        `${this.#operatorName}: Invalid entity ID at path ${entityPath}: ${entityId}`
      );
      return null;
    }

    return entityId;
  }

  /**
   * Internal evaluation logic
   *
   * @private
   * @param {string|number} entityId - The entity ID
   * @param {string} componentId - The component ID to check for
   * @returns {boolean} True if the entity has the specified component
   */
  #evaluateInternal(entityId, componentId) {
    const hasComponent = this.#entityManager.hasComponent(
      entityId,
      componentId
    );

    this.#logger.debug(
      `${this.#operatorName}: Entity ${entityId} ${hasComponent ? 'has' : 'does not have'} component ${componentId}`
    );

    return hasComponent;
  }
}
