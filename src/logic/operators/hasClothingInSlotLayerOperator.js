/**
 * @module HasClothingInSlotLayerOperator
 * @description JSON Logic operator to check if an entity has clothing equipped in a specific slot and layer
 */

import { BaseEquipmentOperator } from './base/BaseEquipmentOperator.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class HasClothingInSlotLayerOperator
 * @augments BaseEquipmentOperator
 * @description Checks if an actor has clothing equipped in a specific slot and layer
 *
 * Usage: {"hasClothingInSlotLayer": ["actor", "torso_upper", "base"]}
 * Returns: true if the actor has clothing item(s) equipped in the specified slot and layer
 */
export class HasClothingInSlotLayerOperator extends BaseEquipmentOperator {
  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   */
  constructor({ entityManager, logger }) {
    super({ entityManager, logger }, 'hasClothingInSlotLayer');
  }

  /**
   * Evaluates if the entity has clothing equipped in the specified slot and layer
   *
   * @protected
   * @param {string} entityId - The entity ID to check
   * @param {Array} params - Parameters: [slotName, layerName]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if entity has clothing in the specified slot and layer
   */
  evaluateInternal(entityId, params, context) {
    // Validate parameters
    if (!params || params.length < 2) {
      this.logger.warn(
        `${this.operatorName}: Missing required parameters: slotName, layerName`
      );
      return false;
    }

    const [slotName, layerName] = params;

    // Validate slot name
    if (!slotName || typeof slotName !== 'string') {
      this.logger.warn(
        `${this.operatorName}: Invalid slotName parameter: ${slotName}`
      );
      return false;
    }

    // Validate layer name
    if (!layerName || typeof layerName !== 'string') {
      this.logger.warn(
        `${this.operatorName}: Invalid layerName parameter: ${layerName}`
      );
      return false;
    }

    // Validate layer name against schema
    if (!this.isValidLayerName(layerName)) {
      this.logger.warn(
        `${this.operatorName}: Invalid layer name '${layerName}'. Valid layers: underwear, base, outer, accessories, armor`
      );
      return false;
    }

    // Get equipment data
    const equipmentData = this.getEquipmentData(entityId);
    if (!equipmentData) {
      this.logger.debug(
        `${this.operatorName}: Entity ${entityId} has no clothing:equipment component`
      );
      return false;
    }

    // Check if slot and layer have items
    const hasItems = this.hasItemsInSlotLayer(
      equipmentData,
      slotName,
      layerName
    );

    this.logger.debug(
      `${this.operatorName}: Entity ${entityId} slot '${slotName}' layer '${layerName}' has items: ${hasItems}`
    );

    return hasItems;
  }
}
