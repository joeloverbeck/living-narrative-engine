/**
 * @module HasClothingInSlotOperator
 * @description JSON Logic operator to check if an entity has clothing equipped in a specific slot
 */

import { BaseEquipmentOperator } from './base/BaseEquipmentOperator.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class HasClothingInSlotOperator
 * @augments BaseEquipmentOperator
 * @description Checks if an actor has any clothing equipped in a specific slot
 *
 * Usage: {"hasClothingInSlot": ["actor", "torso_upper"]}
 * Returns: true if the actor has any clothing item equipped in the specified slot
 */
export class HasClothingInSlotOperator extends BaseEquipmentOperator {
  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   */
  constructor({ entityManager, logger }) {
    super({ entityManager, logger }, 'hasClothingInSlot');
  }

  /**
   * Evaluates if the entity has clothing equipped in the specified slot
   *
   * @protected
   * @param {string} entityId - The entity ID to check
   * @param {Array} params - Parameters: [slotName]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if entity has clothing in the specified slot
   */
  evaluateInternal(entityId, params, context) {
    // Validate parameters
    if (!params || params.length < 1) {
      this.logger.warn(
        `${this.operatorName}: Missing required parameter: slotName`
      );
      return false;
    }

    const [slotName] = params;

    // Validate slot name
    if (!slotName || typeof slotName !== 'string') {
      this.logger.warn(
        `${this.operatorName}: Invalid slotName parameter: ${slotName}`
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

    // Check if slot has any items
    const hasItems = this.hasItemsInSlot(equipmentData, slotName);

    this.logger.debug(
      `${this.operatorName}: Entity ${entityId} slot '${slotName}' has items: ${hasItems}`
    );

    return hasItems;
  }
}
