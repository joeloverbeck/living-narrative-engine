/**
 * @file JSON Logic operator that retrieves skill values from entity components
 * @module GetSkillValueOperator
 * @description Retrieves skill values from entity components for use in conditions
 * @see specs/non-deterministic-actions-system.md
 */

import {
  resolveEntityPath,
  hasValidEntityId,
} from '../utils/entityPathResolver.js';
import jsonLogic from 'json-logic-js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class GetSkillValueOperator
 * @description Retrieves skill values from entity components
 *
 * Usage: {"getSkillValue": ["actor", "skills:melee_skill", "value", 0]}
 * Usage: {"getSkillValue": [{"var": "entity.id"}, "skills:defense_skill", "value", 10]}
 * Returns: The skill value or the default value if not found
 */
export class GetSkillValueOperator {
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {string} */
  #operatorName = 'getSkillValue';

  /**
   * Creates a new GetSkillValueOperator instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {IEntityManager} dependencies.entityManager - The entity manager service
   * @param {ILogger} dependencies.logger - The logger service
   */
  constructor({ entityManager, logger }) {
    if (!entityManager || !logger) {
      throw new Error(
        'GetSkillValueOperator: Missing required dependencies'
      );
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Main evaluation method called by JSON Logic
   *
   * @param {Array} params - [entityPath, componentId, propertyPath?, defaultValue?]
   * @param {object} context - Evaluation context
   * @returns {number} Skill value or default
   */
  evaluate(params, context) {
    try {
      // Validate parameters
      if (!params || !Array.isArray(params) || params.length < 2) {
        this.#logger.warn(
          `${this.#operatorName}: Invalid parameters. Expected [entityPath, componentId, propertyPath?, defaultValue?], got ${JSON.stringify(params)}`
        );
        return 0;
      }

      const [entityPath, componentId, propertyPath = 'value', defaultValue = 0] = params;

      // Resolve entity using standard pattern
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
            return defaultValue;
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
        return defaultValue;
      }

      const entityId = this.#resolveEntityId(entity, pathForLogging);

      if (entityId === null) {
        return defaultValue;
      }

      return this.#evaluateInternal(entityId, componentId, propertyPath, defaultValue);
    } catch (error) {
      this.#logger.error(
        `${this.#operatorName}: Error during evaluation`,
        error
      );
      return 0;
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
   * @param {string} componentId - The component ID to retrieve
   * @param {string} propertyPath - The property path within the component
   * @param {number} defaultValue - The default value to return if not found
   * @returns {number} The skill value or default
   */
  #evaluateInternal(entityId, componentId, propertyPath, defaultValue) {
    // Get component data
    const componentData = this.#entityManager.getComponentData(entityId, componentId);

    if (componentData === null || componentData === undefined) {
      this.#logger.debug(
        `${this.#operatorName}: Component ${componentId} not found on entity ${entityId}, returning default ${defaultValue}`
      );
      return defaultValue;
    }

    // Extract value from property path
    const value = this.#extractPropertyValue(componentData, propertyPath);
    const result = value !== undefined ? value : defaultValue;

    this.#logger.debug(
      `${this.#operatorName}: Entity ${entityId}, component ${componentId}, path ${propertyPath} = ${result}`
    );

    return result;
  }

  /**
   * Extracts value from nested property path
   *
   * @private
   * @param {object} obj - Object to extract from
   * @param {string} path - Dot-separated path (e.g., "value" or "stats.strength")
   * @returns {unknown} Extracted value or undefined
   */
  #extractPropertyValue(obj, path) {
    if (!path || typeof path !== 'string') {
      return undefined;
    }

    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}
