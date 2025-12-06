/**
 * @file JSON Logic operator that checks if entity is hungry
 * @module IsHungryOperator
 * @description Checks if an entity's hunger state indicates hunger (hungry, starving, or critical)
 */

import {
  resolveEntityPath,
  hasValidEntityId,
} from '../utils/entityPathResolver.js';
import jsonLogic from 'json-logic-js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class IsHungryOperator
 * @description Checks if an entity is in a hungry state
 *
 * Usage: {"is_hungry": ["actor"]}
 * Usage: {"is_hungry": [{"var": "entity.id"}]}
 * Returns: true if the entity's hunger state is hungry, starving, or critical
 */
export class IsHungryOperator {
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {string} */
  #operatorName = 'is_hungry';

  /**
   * Creates a new IsHungryOperator instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {IEntityManager} dependencies.entityManager - The entity manager service
   * @param {ILogger} dependencies.logger - The logger service
   */
  constructor({ entityManager, logger }) {
    if (!entityManager || !logger) {
      throw new Error('IsHungryOperator: Missing required dependencies');
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Main evaluation method called by JSON Logic
   *
   * @param {Array} params - Operator parameters [entityPath]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if the entity is hungry (hungry/starving/critical state)
   */
  evaluate(params, context) {
    try {
      // Validate parameters
      if (!params || !Array.isArray(params) || params.length !== 1) {
        this.#logger.error(
          `${this.#operatorName}: Invalid parameters. Expected [entityPath], got ${JSON.stringify(params)}`
        );
        return false;
      }

      let [entityPath] = params;

      // If entityPath is a JSON Logic expression, evaluate it
      let entity;
      let pathForLogging;

      if (
        entityPath &&
        typeof entityPath === 'object' &&
        !Array.isArray(entityPath)
      ) {
        // Check if this is an entity object or JSON Logic expression
        if (hasValidEntityId(entityPath)) {
          // This is an entity object
          entity = entityPath;
          pathForLogging = `entity object with id=${entityPath.id}`;
          this.#logger.debug(
            `${this.#operatorName}: Received entity object directly: ${pathForLogging}`
          );
        } else {
          // JSON Logic expression - evaluate it
          entity = jsonLogic.apply(entityPath, context);
          pathForLogging = JSON.stringify(entityPath);
          this.#logger.debug(
            `${this.#operatorName}: Evaluated JSON Logic expression ${pathForLogging}, result: ${JSON.stringify(entity)}`
          );
        }
      } else if (typeof entityPath === 'string') {
        // Try to resolve as a path first
        const resolved = resolveEntityPath(context, entityPath);
        pathForLogging = entityPath;

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
            commonContextKeys.includes(entityPath) || entityPath.includes('.');

          if (looksLikeContextPath) {
            this.#logger.warn(
              `${this.#operatorName}: No entity found at path ${entityPath}`
            );
            return false;
          } else {
            // Treat as entity ID directly
            this.#logger.debug(
              `${this.#operatorName}: Could not resolve "${entityPath}" as path, treating as entity ID`
            );
            entity = entityPath;
          }
        } else {
          // Check if resolved to object without id
          if (
            typeof resolved.entity === 'object' &&
            !hasValidEntityId(resolved.entity)
          ) {
            this.#logger.debug(
              `${this.#operatorName}: Resolved "${entityPath}" to object without id, treating original path as entity ID`
            );
            entity = entityPath;
          } else {
            entity = resolved.entity;
          }
        }
      } else {
        this.#logger.warn(
          `${this.#operatorName}: Invalid entityPath type: ${typeof entityPath}`
        );
        return false;
      }

      const entityId = this.#resolveEntityId(entity, pathForLogging);

      if (entityId === null) {
        return false;
      }

      return this.#evaluateInternal(entityId);
    } catch (error) {
      this.#logger.error(
        `${this.#operatorName}: Error during evaluation`,
        error
      );
      return false;
    }
  }

  /**
   * Resolves a usable entity identifier from the resolved entity path value
   *
   * @private
   * @param {unknown} entity - The resolved entity value from the context
   * @param {string} entityPath - The path used to resolve the entity
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
   * @returns {boolean} True if the entity is hungry
   */
  #evaluateInternal(entityId) {
    // Get hunger_state component
    const hungerState = this.#entityManager.getComponentData(
      entityId,
      'metabolism:hunger_state'
    );

    // If no hunger state component, entity is not hungry
    if (!hungerState) {
      this.#logger.debug(
        `${this.#operatorName}: Entity ${entityId} missing metabolism:hunger_state component, returning false`
      );
      return false;
    }

    // Check if state indicates hunger
    const hungryStates = ['hungry', 'starving', 'critical'];
    const isHungry = hungryStates.includes(hungerState.state);

    this.#logger.debug(
      `${this.#operatorName}: Entity ${entityId} hunger check: state=${hungerState.state}, isHungry=${isHungry}`
    );

    return isHungry;
  }
}
