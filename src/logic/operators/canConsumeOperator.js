/**
 * @file JSON Logic operator that validates consumption safety
 * @module CanConsumeOperator
 * @description Validates if consumer can safely consume an item (fuel tags + buffer capacity)
 */

import { resolveEntityPath, hasValidEntityId } from '../utils/entityPathResolver.js';
import jsonLogic from 'json-logic-js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class CanConsumeOperator
 * @description Validates consumption safety through fuel tag and capacity checks
 *
 * Usage: {"can_consume": ["actor", "bread"]}
 * Usage: {"can_consume": ["self", {"var": "event.payload.itemId"}]}
 * Returns: true if fuel tags match AND buffer has capacity
 */
export class CanConsumeOperator {
  /** @private @type {IEntityManager} */
  #entityManager;
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {string} */
  #operatorName = 'can_consume';

  /**
   * Creates a new CanConsumeOperator instance
   *
   * @param {object} dependencies - The dependencies object
   * @param {IEntityManager} dependencies.entityManager - The entity manager service
   * @param {ILogger} dependencies.logger - The logger service
   */
  constructor({ entityManager, logger }) {
    if (!entityManager || !logger) {
      throw new Error('CanConsumeOperator: Missing required dependencies');
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Main evaluation method called by JSON Logic
   *
   * @param {Array} params - Operator parameters [consumerPath, itemPath]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if can safely consume
   */
  evaluate(params, context) {
    try {
      // Validate parameters
      if (!params || !Array.isArray(params) || params.length !== 2) {
        this.#logger.error(
          `${this.#operatorName}: Invalid parameters. Expected [consumerPath, itemPath], got ${JSON.stringify(params)}`
        );
        return false;
      }

      const consumerId = this.#resolveEntityId(params[0], context, 'consumer');
      const itemId = this.#resolveEntityId(params[1], context, 'item');

      if (!consumerId || !itemId) {
        return false;
      }

      return this.#evaluateInternal(consumerId, itemId);
    } catch (error) {
      this.#logger.error(
        `${this.#operatorName}: Error during evaluation`,
        error
      );
      return false;
    }
  }

  /**
   * Resolves entity ID from entity path parameter
   *
   * @private
   * @param {unknown} entityPath - The entity path parameter
   * @param {object} context - Evaluation context
   * @param {string} role - Role for logging (consumer/item)
   * @returns {string|number|null} Resolved entity ID or null
   */
  #resolveEntityId(entityPath, context, role) {
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
          `${this.#operatorName}: Received ${role} entity object directly: ${pathForLogging}`
        );
      } else {
        // JSON Logic expression - evaluate it
        entity = jsonLogic.apply(entityPath, context);
        pathForLogging = JSON.stringify(entityPath);
        this.#logger.debug(
          `${this.#operatorName}: Evaluated ${role} JSON Logic expression ${pathForLogging}, result: ${JSON.stringify(entity)}`
        );
      }
    } else if (typeof entityPath === 'string') {
      // Try to resolve as a path first
      const resolved = resolveEntityPath(context, entityPath);
      pathForLogging = entityPath;

      if (!resolved.isValid) {
        // Check if this looks like a context path
        const commonContextKeys = ['entity', 'actor', 'location', 'target', 'targets', 'event', 'self'];
        const looksLikeContextPath =
          commonContextKeys.includes(entityPath) ||
          entityPath.includes('.');

        if (looksLikeContextPath) {
          this.#logger.warn(
            `${this.#operatorName}: No ${role} entity found at path ${entityPath}`
          );
          return null;
        } else {
          // Treat as entity ID directly
          this.#logger.debug(
            `${this.#operatorName}: Could not resolve "${entityPath}" as path, treating as ${role} entity ID`
          );
          entity = entityPath;
        }
      } else {
        // Check if resolved to object without id
        if (typeof resolved.entity === 'object' && !hasValidEntityId(resolved.entity)) {
          this.#logger.debug(
            `${this.#operatorName}: Resolved "${entityPath}" to object without id, treating original path as ${role} entity ID`
          );
          entity = entityPath;
        } else {
          entity = resolved.entity;
        }
      }
    } else {
      this.#logger.warn(
        `${this.#operatorName}: Invalid ${role} entityPath type: ${typeof entityPath}`
      );
      return null;
    }

    let entityId = null;

    if (hasValidEntityId(entity)) {
      entityId = /** @type {{id: string|number}} */ (entity).id;
    } else if (typeof entity === 'string' || typeof entity === 'number') {
      entityId = entity;
    } else {
      this.#logger.warn(
        `${this.#operatorName}: Invalid ${role} entity at path ${pathForLogging}`
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
        `${this.#operatorName}: Invalid ${role} entity ID at path ${pathForLogging}: ${entityId}`
      );
      return null;
    }

    return entityId;
  }

  /**
   * Internal evaluation logic
   *
   * @private
   * @param {string|number} consumerId - The consumer entity ID
   * @param {string|number} itemId - The item entity ID
   * @returns {boolean} True if can consume
   */
  #evaluateInternal(consumerId, itemId) {
    // Get required components
    const converter = this.#entityManager.getComponentData(
      consumerId,
      'metabolism:fuel_converter'
    );
    const store = this.#entityManager.getComponentData(
      consumerId,
      'metabolism:metabolic_store'
    );
    const fuelSource = this.#entityManager.getComponentData(
      itemId,
      'metabolism:fuel_source'
    );

    // Missing components = cannot consume
    if (!converter || !store || !fuelSource) {
      this.#logger.debug(
        `${this.#operatorName}: Missing components: ` +
          `converter=${!!converter}, store=${!!store}, fuel=${!!fuelSource}`
      );
      return false;
    }

    // Check fuel tags compatibility
    const fuelTags = fuelSource.fuel_tags || [];
    const hasMatchingTag = fuelTags.some(tag =>
      converter.accepted_fuel_tags.includes(tag)
    );

    if (!hasMatchingTag) {
      this.#logger.debug(
        `${this.#operatorName}: Fuel tags incompatible: ` +
          `item=[${fuelTags.join(',')}], ` +
          `accepts=[${converter.accepted_fuel_tags.join(',')}]`
      );
      return false;
    }

    // Check buffer capacity (sum bulk from buffer_storage array)
    const currentBulk = (store.buffer_storage || []).reduce(
      (sum, item) => sum + (item.bulk || 0),
      0
    );
    const availableSpace = store.buffer_capacity - currentBulk;
    const hasRoom = fuelSource.bulk <= availableSpace;

    if (!hasRoom) {
      this.#logger.debug(
        `${this.#operatorName}: Insufficient buffer capacity: ` +
          `need=${fuelSource.bulk}, ` +
          `available=${availableSpace.toFixed(1)}`
      );
      return false;
    }

    // All checks passed
    this.#logger.debug(
      `${this.#operatorName}: Can consume: consumer=${consumerId}, item=${itemId}`
    );
    return true;
  }
}
