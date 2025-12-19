/**
 * @module BaseFurnitureOperator
 * @description Abstract base class for JSON Logic furniture/positioning operators
 */

import {
  resolveEntityPath,
  hasValidEntityId,
} from '../../utils/entityPathResolver.js';

/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @abstract
 * @class BaseFurnitureOperator
 * @description Base class for all furniture/positioning-related JSON Logic operators
 */
export class BaseFurnitureOperator {
  /** @protected @type {IEntityManager} */
  entityManager;
  /** @protected @type {ILogger} */
  logger;
  /** @protected @type {string} */
  operatorName;

  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   * @param {string} operatorName - Name of the operator for logging
   */
  constructor({ entityManager, logger }, operatorName) {
    if (!entityManager || !logger) {
      throw new Error('BaseFurnitureOperator: Missing required dependencies');
    }

    this.entityManager = entityManager;
    this.logger = logger;
    this.operatorName = operatorName;
  }

  /**
   * Main evaluation method called by JSON Logic
   *
   * @param {Array} params - Operator parameters: [entityPath, targetPath, ...operatorParams]
   * @param {object} context - Evaluation context
   * @returns {boolean} Result of the operator evaluation
   */
  evaluate(params, context) {
    try {
      // Validate parameters
      if (!params || !Array.isArray(params) || params.length < 2) {
        this.logger.warn(
          `${this.operatorName}: Invalid parameters - expected at least [entityPath, targetPath]`
        );
        return false;
      }

      const [entityPath, targetPath, ...operatorParams] = params;

      // Clone context to avoid mutating the shared context object
      const localContext = { ...context };
      localContext._currentPath = entityPath;

      // Resolve entity from path
      const { entity, isValid: entityValid } = resolveEntityPath(
        localContext,
        entityPath
      );

      if (!entityValid) {
        this.logger.warn(
          `${this.operatorName}: No entity found at path ${entityPath}`
        );
        return false;
      }

      const entityId = this.#resolveEntityId(entity, entityPath);

      if (entityId === null) {
        return false;
      }

      // Resolve target from path
      const { entity: target, isValid: targetValid } = resolveEntityPath(
        localContext,
        targetPath
      );

      if (!targetValid) {
        this.logger.warn(
          `${this.operatorName}: No target found at path ${targetPath}`
        );
        return false;
      }

      const targetId = this.#resolveEntityId(target, targetPath);

      if (targetId === null) {
        return false;
      }

      // Delegate to subclass implementation
      return this.evaluateInternal(entityId, targetId, operatorParams, localContext);
    } catch (error) {
      this.logger.error(`${this.operatorName}: Error during evaluation`, error);
      return false;
    }
  }

  /**
   * Resolves a usable entity identifier from the resolved entity path value.
   * Logs warnings when the resolved entity is invalid.
   *
   * @private
   * @param {any} entity - The resolved entity value from the context.
   * @param {string} entityPath - The JSON Logic path used to resolve the entity.
   * @returns {string|number|null} A valid entity identifier or null when invalid.
   */
  #resolveEntityId(entity, entityPath) {
    let entityId = null;

    if (hasValidEntityId(entity)) {
      entityId = /** @type {{id: string|number}} */ (entity).id;
    } else if (typeof entity === 'string' || typeof entity === 'number') {
      entityId = entity;
    } else {
      this.logger.warn(
        `${this.operatorName}: Invalid entity at path ${entityPath}`
      );
      return null;
    }

    if (
      entityId === undefined ||
      entityId === null ||
      (typeof entityId === 'string' && entityId.trim() === '') ||
      (typeof entityId === 'number' && Number.isNaN(entityId))
    ) {
      this.logger.warn(
        `${this.operatorName}: Invalid entity at path ${entityPath}`
      );
      return null;
    }

    return entityId;
  }

  /**
   * @abstract
   * @protected
   * @param {string} entityId - The resolved entity ID
   * @param {string} targetId - The resolved target ID (typically furniture)
   * @param {Array} params - Operator-specific parameters
   * @param {object} context - Evaluation context
   * @returns {boolean} Result of the operator evaluation
   */
  evaluateInternal(entityId, targetId, params, context) {
    throw new Error('evaluateInternal must be implemented by subclass');
  }

  /**
   * Utility method to get sitting_on component data for an entity
   *
   * @protected
   * @param {string} entityId - The entity ID
   * @returns {object|null} Sitting_on component data or null if not found
   */
  getSittingOnData(entityId) {
    const sittingOnData = this.entityManager.getComponentData(
      entityId,
      'sitting-states:sitting_on'
    );

    return sittingOnData || null;
  }

  /**
   * Utility method to get allows_sitting component data for furniture
   *
   * @protected
   * @param {string} furnitureId - The furniture entity ID
   * @returns {object|null} Allows_sitting component data or null if not found
   */
  getAllowsSittingData(furnitureId) {
    const allowsSittingData = this.entityManager.getComponentData(
      furnitureId,
      'sitting:allows_sitting'
    );

    return allowsSittingData || null;
  }

  /**
   * Utility method to check if an entity is sitting on specific furniture
   *
   * @protected
   * @param {string} entityId - The entity ID
   * @param {string} furnitureId - The furniture entity ID
   * @returns {boolean} True if entity is sitting on the furniture
   */
  isSittingOn(entityId, furnitureId) {
    const sittingOn = this.getSittingOnData(entityId);
    if (!sittingOn) {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} has no sitting_on component`
      );
      return false;
    }

    const isSitting = sittingOn.furniture_id === furnitureId;
    this.logger.debug(
      `${this.operatorName}: Entity ${entityId} ${isSitting ? 'is' : 'is not'} sitting on furniture ${furnitureId}`
    );

    return isSitting;
  }

  /**
   * Utility method to get the spot configuration for furniture
   *
   * @protected
   * @param {string} furnitureId - The furniture entity ID
   * @returns {{spots: Array, isValid: boolean}} Spots array and validity flag
   */
  getFurnitureSpots(furnitureId) {
    const allowsSitting = this.getAllowsSittingData(furnitureId);
    if (!allowsSitting) {
      this.logger.debug(
        `${this.operatorName}: Furniture ${furnitureId} has no allows_sitting component`
      );
      return { spots: [], isValid: false };
    }

    if (!Array.isArray(allowsSitting.spots)) {
      this.logger.warn(
        `${this.operatorName}: Furniture ${furnitureId} has invalid spots property (not an array)`
      );
      return { spots: [], isValid: false };
    }

    return { spots: allowsSitting.spots, isValid: true };
  }
}
