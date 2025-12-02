/**
 * @file Operator to check if an entity has a specific damage capability
 */

import jsonLogic from 'json-logic-js';
import {
  resolveEntityPath,
  hasValidEntityId,
} from '../utils/entityPathResolver.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class HasDamageCapabilityOperator
 * @description Checks if an entity has a specific damage type in its damage_capabilities component
 *
 * Usage: {"has_damage_capability": ["entity", "slashing"]}
 * Usage: {"has_damage_capability": [{"var": "primary"}, "piercing"]}
 * Returns: true if the entity has the specified damage capability
 */
export class HasDamageCapabilityOperator {
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {string} */
  #operatorName = 'has_damage_capability';

  /**
   * Creates an instance of HasDamageCapabilityOperator
   *
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   */
  constructor({ entityManager, logger }) {
    if (!entityManager || !logger) {
      throw new Error(
        'HasDamageCapabilityOperator: Missing required dependencies'
      );
    }
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Evaluates whether an entity has a specific damage capability
   *
   * @param {Array} params - [entityPath, damageTypeName]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if entity has the specified damage capability
   */
  evaluate(params, context) {
    try {
      // Validate parameters
      if (!Array.isArray(params) || params.length < 2) {
        this.#logger.warn(
          `${this.#operatorName}: Invalid params - expected [entityPath, damageTypeName]`
        );
        return false;
      }

      const [entityPath, damageTypeName] = params;

      // Validate damage type name
      if (typeof damageTypeName !== 'string' || damageTypeName.trim() === '') {
        this.#logger.warn(
          `${this.#operatorName}: Invalid damageTypeName - expected non-empty string`
        );
        return false;
      }

      // Resolve entity using the same pattern as HasComponentOperator
      let entity;
      let pathForLogging;

      if (
        entityPath &&
        typeof entityPath === 'object' &&
        !Array.isArray(entityPath)
      ) {
        // Check if this is a JSON Logic expression or just an entity object
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
            `${this.#operatorName}: Evaluated JSON Logic expression ${pathForLogging}`
          );
        }
      } else if (typeof entityPath === 'string') {
        // Try to resolve as a path first (e.g., "entity", "entity.equipped")
        const resolved = resolveEntityPath(context, entityPath);
        pathForLogging = entityPath;

        if (!resolved.isValid) {
          // Path resolution failed - check if this looks like a context path or an entity ID
          const commonContextKeys = [
            'entity',
            'actor',
            'location',
            'target',
            'targets',
            'event',
            'primary',
          ];
          const looksLikeContextPath =
            commonContextKeys.includes(entityPath) || entityPath.includes('.');

          if (looksLikeContextPath) {
            this.#logger.debug(
              `${this.#operatorName}: No entity found at path ${entityPath}`
            );
            return false;
          } else {
            // Treat as an entity ID directly
            this.#logger.debug(
              `${this.#operatorName}: Could not resolve "${entityPath}" as path, treating as entity ID`
            );
            entity = entityPath;
          }
        } else {
          // Resolution succeeded
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

      // Resolve entity ID
      const entityId = this.#resolveEntityId(entity, pathForLogging);

      if (entityId === null) {
        return false;
      }

      // Get damage_capabilities component
      const componentData = this.#entityManager.getComponentData(
        entityId,
        'damage-types:damage_capabilities'
      );

      if (!componentData) {
        this.#logger.debug(
          `${this.#operatorName}: Entity ${entityId} has no damage_capabilities component`
        );
        return false;
      }

      // Check if entries array exists and has items
      if (
        !Array.isArray(componentData.entries) ||
        componentData.entries.length === 0
      ) {
        this.#logger.debug(
          `${this.#operatorName}: Entity ${entityId} has empty or invalid entries array`
        );
        return false;
      }

      // Check if any entry matches the damage type name
      const hasCapability = componentData.entries.some(
        (entry) => entry && entry.name === damageTypeName
      );

      this.#logger.debug(
        `${this.#operatorName}: Entity ${entityId} ${hasCapability ? 'has' : 'does not have'} damage capability '${damageTypeName}'`
      );

      return hasCapability;
    } catch (err) {
      this.#logger.error(
        `${this.#operatorName}: Error evaluating damage capability`,
        err
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
      this.#logger.debug(
        `${this.#operatorName}: Could not resolve entity from path ${entityPath}`
      );
      return null;
    }

    if (
      entityId === undefined ||
      entityId === null ||
      (typeof entityId === 'string' && entityId.trim() === '') ||
      (typeof entityId === 'number' && Number.isNaN(entityId))
    ) {
      this.#logger.debug(
        `${this.#operatorName}: Invalid entity ID at path ${entityPath}: ${entityId}`
      );
      return null;
    }

    return entityId;
  }
}

export default HasDamageCapabilityOperator;
