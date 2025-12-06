/**
 * @file JSON Logic operator that calculates predicted energy
 * @module PredictedEnergyOperator
 * @description Calculates predicted energy = current energy + buffered energy from digestion
 */

import {
  resolveEntityPath,
  hasValidEntityId,
} from '../utils/entityPathResolver.js';
import jsonLogic from 'json-logic-js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class PredictedEnergyOperator
 * @description Calculates predicted energy including buffered items being digested
 *
 * Usage: {"predicted_energy": ["actor"]}
 * Usage: {"predicted_energy": [{"var": "entity.id"}]}
 * Returns: current_energy + sum(buffer_storage items' energy_content)
 */
export class PredictedEnergyOperator {
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {string} */
  #operatorName = 'predicted_energy';

  /**
   * Creates a new PredictedEnergyOperator instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {IEntityManager} dependencies.entityManager - The entity manager service
   * @param {ILogger} dependencies.logger - The logger service
   */
  constructor({ entityManager, logger }) {
    if (!entityManager || !logger) {
      throw new Error('PredictedEnergyOperator: Missing required dependencies');
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Main evaluation method called by JSON Logic
   *
   * @param {Array} params - Operator parameters [entityPath]
   * @param {object} context - Evaluation context
   * @returns {number} Predicted energy (current + buffered)
   */
  evaluate(params, context) {
    try {
      // Validate parameters
      if (!params || !Array.isArray(params) || params.length !== 1) {
        this.#logger.error(
          `${this.#operatorName}: Invalid parameters. Expected [entityPath], got ${JSON.stringify(params)}`
        );
        return 0;
      }

      let [entityPath] = params;

      // Resolve entity (following isHungryOperator pattern)
      let entity;
      let pathForLogging;

      if (
        entityPath &&
        typeof entityPath === 'object' &&
        !Array.isArray(entityPath)
      ) {
        // Check if this is an entity object or JSON Logic expression
        if (hasValidEntityId(entityPath)) {
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
            return 0;
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
        return 0;
      }

      const entityId = this.#resolveEntityId(entity, pathForLogging);

      if (entityId === null) {
        return 0;
      }

      return this.#evaluateInternal(entityId);
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
   * @returns {number} Predicted energy
   */
  #evaluateInternal(entityId) {
    // Get metabolic_store component (contains buffer_storage array)
    const store = this.#entityManager.getComponentData(
      entityId,
      'metabolism:metabolic_store'
    );

    // If no metabolic store, entity has no metabolic system
    if (!store) {
      this.#logger.debug(
        `${this.#operatorName}: Entity ${entityId} missing metabolism:metabolic_store component, returning 0`
      );
      return 0;
    }

    // Calculate buffered energy from buffer_storage array
    const bufferedEnergy = (store.buffer_storage || []).reduce(
      (sum, item) => sum + (item.energy_content || 0),
      0
    );

    // Total predicted energy
    const predicted = store.current_energy + bufferedEnergy;

    this.#logger.debug(
      `${this.#operatorName}: Entity ${entityId} predicted energy: ` +
        `current=${store.current_energy}, ` +
        `buffered=${bufferedEnergy.toFixed(1)}, ` +
        `predicted=${predicted.toFixed(1)}`
    );

    return predicted;
  }
}
