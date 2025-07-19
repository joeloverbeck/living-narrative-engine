/**
 * @module BaseEquipmentOperator
 * @description Abstract base class for JSON Logic equipment operators
 */

import {
  resolveEntityPath,
  hasValidEntityId,
} from '../../utils/entityPathResolver.js';

/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @abstract
 * @class BaseEquipmentOperator
 * @description Base class for all equipment-related JSON Logic operators
 */
export class BaseEquipmentOperator {
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
      throw new Error('BaseEquipmentOperator: Missing required dependencies');
    }

    this.entityManager = entityManager;
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

      // Store the entity path for logging
      context._currentPath = entityPath;

      // Resolve entity from path
      const { entity, isValid } = resolveEntityPath(context, entityPath);

      if (!isValid) {
        this.logger.warn(
          `${this.operatorName}: No entity found at path ${entityPath}`
        );
        return false;
      }

      // For special "." path, entity might be the ID directly
      const entityId = entity?.id || entity;

      if (!entityId || (typeof entityId === 'object' && !entityId.id)) {
        this.logger.warn(
          `${this.operatorName}: Invalid entity at path ${entityPath}`
        );
        return false;
      }

      // Delegate to subclass implementation
      return this.evaluateInternal(entityId, operatorParams, context);
    } catch (error) {
      this.logger.error(`${this.operatorName}: Error during evaluation`, error);
      return false;
    }
  }

  /**
   * @abstract
   * @protected
   * @param {string} entityId - The resolved entity ID
   * @param {Array} params - Operator-specific parameters
   * @param {object} context - Evaluation context
   * @returns {boolean} Result of the operator evaluation
   */
  evaluateInternal(entityId, params, context) {
    throw new Error('evaluateInternal must be implemented by subclass');
  }

  /**
   * Utility method to get equipment data for an entity
   *
   * @protected
   * @param {string} entityId - The entity ID
   * @returns {object|null} Equipment data or null if not found
   */
  getEquipmentData(entityId) {
    const equipmentData = this.entityManager.getComponentData(
      entityId,
      'clothing:equipment'
    );

    return equipmentData || null;
  }

  /**
   * Utility method to check if a slot exists and has any items
   *
   * @protected
   * @param {object} equipmentData - Equipment component data
   * @param {string} slotName - Name of the equipment slot
   * @returns {boolean} True if slot exists and has items
   */
  hasItemsInSlot(equipmentData, slotName) {
    if (!equipmentData?.equipped) return false;

    const slot = equipmentData.equipped[slotName];
    if (!slot) return false;

    // Check if any layer has items
    return Object.values(slot).some((items) =>
      Array.isArray(items) ? items.length > 0 : Boolean(items)
    );
  }

  /**
   * Utility method to check if a specific layer in a slot has items
   *
   * @protected
   * @param {object} equipmentData - Equipment component data
   * @param {string} slotName - Name of the equipment slot
   * @param {string} layerName - Name of the layer (underwear, base, outer, accessories)
   * @returns {boolean} True if layer exists and has items
   */
  hasItemsInSlotLayer(equipmentData, slotName, layerName) {
    if (!equipmentData?.equipped) return false;

    const slot = equipmentData.equipped[slotName];
    if (!slot) return false;

    const layerItems = slot[layerName];
    return Array.isArray(layerItems)
      ? layerItems.length > 0
      : Boolean(layerItems);
  }

  /**
   * Utility method to validate layer names against schema
   *
   * @protected
   * @param {string} layerName - Layer name to validate
   * @returns {boolean} True if layer name is valid
   */
  isValidLayerName(layerName) {
    const validLayers = ['underwear', 'base', 'outer', 'accessories'];
    return validLayers.includes(layerName);
  }
}
