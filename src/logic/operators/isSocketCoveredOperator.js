/**
 * @module IsSocketCoveredOperator
 * @description JSON Logic operator to check if a specific anatomical socket is covered by clothing
 */

import { BaseEquipmentOperator } from './base/BaseEquipmentOperator.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class IsSocketCoveredOperator
 * @augments BaseEquipmentOperator
 * @description Checks if a specific anatomical socket is covered by any equipped clothing
 *
 * Usage: {"isSocketCovered": ["actor", "vagina"]}
 * Returns: true if the socket is covered by any clothing item
 */
export class IsSocketCoveredOperator extends BaseEquipmentOperator {
  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   */
  constructor({ entityManager, logger }) {
    super({ entityManager, logger }, 'isSocketCovered');
  }

  /**
   * Evaluates if the entity has the specified socket covered by clothing
   *
   * @protected
   * @param {string} entityId - The entity ID to check
   * @param {Array} params - Parameters: [socketId]
   * @param {object} context - Evaluation context
   * @returns {boolean} True if socket is covered by any equipped clothing
   */
  evaluateInternal(entityId, params, context) {
    // Validate parameters
    if (!params || params.length < 1) {
      this.logger.warn(
        `${this.operatorName}: Missing required parameter: socketId`
      );
      return false;
    }

    const [socketId] = params;

    // Validate socket ID
    if (!socketId || typeof socketId !== 'string') {
      this.logger.warn(
        `${this.operatorName}: Invalid socketId parameter: ${socketId}`
      );
      return false;
    }

    try {
      // For now, implement a simple approach by checking if the socket matches common slot mappings
      // This is a simplified version that can be enhanced later with proper blueprint caching

      // Get equipment data first
      const equipmentData = this.getEquipmentData(entityId);
      if (!equipmentData) {
        this.logger.debug(
          `${this.operatorName}: Entity ${entityId} has no clothing:equipment component`
        );
        return false;
      }

      // Use hardcoded mapping for common sockets - can be made dynamic later
      const socketToSlotMapping = this.#getSocketToSlotMapping();
      const potentialSlots = socketToSlotMapping[socketId] || [];

      if (potentialSlots.length === 0) {
        this.logger.debug(
          `${this.operatorName}: No known clothing slots cover socket '${socketId}' for entity ${entityId}`
        );
        return false;
      }

      // Check if any potential slot has equipped items
      const isCovered = potentialSlots.some((slotName) =>
        this.hasItemsInSlot(equipmentData, slotName)
      );

      this.logger.debug(
        `${this.operatorName}: Socket '${socketId}' for entity ${entityId} is ${isCovered ? 'covered' : 'not covered'} by clothing`
      );

      return isCovered;
    } catch (error) {
      this.logger.error(
        `${this.operatorName}: Error checking socket coverage for entity ${entityId}, socket ${socketId}`,
        error
      );
      return false;
    }
  }

  /**
   * Gets a mapping from socket IDs to the clothing slots that cover them
   * Based on common anatomy patterns from the blueprints
   *
   * @private
   * @returns {object} Socket to slot mapping
   */
  #getSocketToSlotMapping() {
    // Based on human_female.blueprint.json and human_male.blueprint.json
    return {
      // Female anatomy sockets
      vagina: ['torso_lower'],
      left_breast: ['torso_upper'],
      right_breast: ['torso_upper'],
      pubic_hair: ['torso_lower'],

      // Male anatomy sockets
      penis: ['torso_lower'],
      left_testicle: ['torso_lower'],
      right_testicle: ['torso_lower'],

      // Common anatomy sockets
      left_hip: ['torso_lower'],
      right_hip: ['torso_lower'],
      left_chest: ['torso_upper'],
      right_chest: ['torso_upper'],
      chest_center: ['torso_upper'],
      left_shoulder: ['torso_upper'],
      right_shoulder: ['torso_upper'],
      upper_back: ['back_accessory'],
      lower_back: ['back_accessory'],
      asshole: ['torso_lower'],
      left_ass: ['torso_lower'],
      right_ass: ['torso_lower'],
    };
  }
}
