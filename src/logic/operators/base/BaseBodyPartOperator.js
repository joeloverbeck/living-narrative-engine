/**
 * @module BaseBodyPartOperator
 * @description Abstract base class for JSON Logic body part operators
 */

import {
  resolveEntityPath,
  hasValidEntityId,
} from '../../utils/entityPathResolver.js';
import {
  getBodyComponent,
  extractRootId,
} from '../../utils/bodyComponentUtils.js';

/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../anatomy/bodyGraphService.js').BodyGraphService} BodyGraphService */

/**
 * @abstract
 * @class BaseBodyPartOperator
 * @description Base class for all body part-related JSON Logic operators
 */
export class BaseBodyPartOperator {
  /** @protected @type {IEntityManager} */
  entityManager;
  /** @protected @type {BodyGraphService} */
  bodyGraphService;
  /** @protected @type {ILogger} */
  logger;
  /** @protected @type {string} */
  operatorName;

  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {BodyGraphService} dependencies.bodyGraphService
   * @param {ILogger} dependencies.logger
   * @param {string} operatorName - Name of the operator for logging
   */
  constructor({ entityManager, bodyGraphService, logger }, operatorName) {
    if (!entityManager || !bodyGraphService || !logger) {
      throw new Error('BaseBodyPartOperator: Missing required dependencies');
    }

    this.entityManager = entityManager;
    this.bodyGraphService = bodyGraphService;
    this.logger = logger;
    this.operatorName = operatorName;
  }

  /**
   * Main evaluation method called by JSON Logic
   *
   * @param {Array} params - Operator parameters
   * @param {object} context - Evaluation context
   * @returns {boolean} Result of the operator evaluation
   */
  evaluate(params, context) {
    try {
      // Validate parameters
      if (!params || !Array.isArray(params) || params.length < 2) {
        this.logger.warn(`${this.operatorName}: Invalid parameters`);
        return false;
      }

      const [entityPath, ...operatorParams] = params;

      // Clone context to avoid mutating the shared context object
      const localContext = { ...context };
      localContext._currentPath = entityPath;

      // Resolve entity from path
      const { entity, isValid } = resolveEntityPath(localContext, entityPath);

      if (!isValid) {
        this.logger.warn(
          `${this.operatorName}: No entity found at path ${entityPath}`
        );
        return false;
      }

      const entityId = this.#resolveEntityId(entity, entityPath);

      if (entityId === null) {
        return false;
      }

      // Get body component
      const bodyComponent = getBodyComponent(this.entityManager, entityId);
      if (!bodyComponent) {
        this.logger.debug(
          `${this.operatorName}: Entity ${entityId} has no anatomy:body component`
        );
        return false;
      }

      // Extract root ID
      const rootId = extractRootId(bodyComponent);
      if (!rootId) {
        this.logger.debug(
          `${this.operatorName}: Entity ${entityId} has no root in anatomy:body component`
        );
        return false;
      }

      // Delegate to subclass implementation
      return this.evaluateInternal(
        entityId,
        rootId,
        operatorParams,
        localContext,
        bodyComponent
      );
    } catch (error) {
      this.logger.error(`${this.operatorName}: Error during evaluation`, error);
      return false;
    }
  }

  /**
   * @abstract
   * @protected
   * @param {string} entityId - The resolved entity ID
   * @param {string} rootId - The root ID from body component
   * @param {Array} params - Operator-specific parameters
   * @param {object} context - Evaluation context
   * @param {object} bodyComponent - The body component
   * @returns {boolean} Result of the operator evaluation
   */
  evaluateInternal(entityId, rootId, params, context, bodyComponent) {
    throw new Error('evaluateInternal must be implemented by subclass');
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
    const hasEntityId = hasValidEntityId(entity);

    if (hasEntityId) {
      entityId = /** @type {{id: string|number}} */ (entity).id;
    } else if (entity && typeof entity === 'object') {
      entityId = /** @type {object} */ (entity);
    } else if (typeof entity === 'string') {
      entityId = entity;
    } else if (typeof entity === 'number') {
      if (entity === 0) {
        this.logger.warn(
          `${this.operatorName}: Invalid entity at path ${entityPath}`
        );
        return null;
      }

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
      (!hasEntityId &&
        typeof entityId === 'number' &&
        (Number.isNaN(entityId) || entityId === 0))
    ) {
      this.logger.warn(
        `${this.operatorName}: Invalid entity at path ${entityPath}`
      );
      return null;
    }

    return entityId;
  }
}
