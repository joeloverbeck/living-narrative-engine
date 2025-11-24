/**
 * @file ClothingSlotValidator - Validates clothing slot compatibility for entities
 *
 * Handles validation of clothing slots on entities, ensuring slots exist
 * and have valid attachment points before equipment operations.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} SlotValidationResult
 * @property {boolean} valid - Whether the validation passed
 * @property {string} [reason] - Reason for validation failure
 */

/**
 * Service for validating clothing slot compatibility
 *
 * Focuses on anatomy-specific validation, checking slot existence
 * and attachment point availability.
 */
export class ClothingSlotValidator {
  /** @type {ILogger} */
  #logger;

  /**
   * Creates an instance of ClothingSlotValidator
   *
   * @param {object} deps - Constructor dependencies
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger');

    this.#logger = logger;
  }

  /**
   * Validates that a clothing item can be equipped in a slot
   *
   * @param {string} entityId - Entity attempting to equip
   * @param {string} slotId - Target clothing slot
   * @param {string} itemId - Item to equip
   * @param {Map<string, object>} availableSlots - Map of available slots with their mappings
   * @param {Function} resolveAttachmentPoints - Function to resolve slot attachment points
   * @returns {Promise<SlotValidationResult>}
   */
  async validateSlotCompatibility(
    entityId,
    slotId,
    itemId,
    availableSlots,
    resolveAttachmentPoints
  ) {
    // Validate parameters
    if (!entityId || typeof entityId !== 'string') {
      throw new Error('Entity ID is required');
    }
    if (!slotId || typeof slotId !== 'string') {
      throw new Error('Slot ID is required');
    }
    if (!itemId || typeof itemId !== 'string') {
      throw new Error('Item ID is required');
    }

    this.#logger.debug(
      `ClothingSlotValidator: Validating slot '${slotId}' for entity '${entityId}' with item '${itemId}'`
    );

    // Check if entity has the requested slot
    if (!availableSlots || !availableSlots.has(slotId)) {
      return {
        valid: false,
        reason: `Entity lacks clothing slot '${slotId}'`,
      };
    }

    // Check if the slot has valid attachment points
    try {
      const attachmentPoints = await resolveAttachmentPoints(entityId, slotId);

      if (!attachmentPoints || attachmentPoints.length === 0) {
        const detailedReason = `Clothing slot '${slotId}' has no valid attachment points for entity '${entityId}' with item '${itemId}'. This usually means: 1) Socket index not populated yet, 2) Blueprint slot mapping incorrect, or 3) Anatomy part missing the required socket.`;

        this.#logger.warn(
          `ClothingSlotValidator: ${detailedReason}`
        );

        return {
          valid: false,
          reason: detailedReason,
        };
      }

      this.#logger.debug(
        `ClothingSlotValidator: Slot '${slotId}' has ${attachmentPoints.length} valid attachment points`
      );

      // All validations passed
      return { valid: true };
    } catch (error) {
      this.#logger.error(
        `ClothingSlotValidator: Error resolving attachment points for slot '${slotId}'`,
        { error }
      );
      return {
        valid: false,
        reason: `Failed to resolve attachment points: ${error.message}`,
      };
    }
  }
}

export default ClothingSlotValidator;
