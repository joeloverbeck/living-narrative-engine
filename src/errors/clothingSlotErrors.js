/**
 * @file Error classes for clothing slot resolution
 * @see src/anatomy/integration/strategies/ClothingSlotMappingStrategy.js
 */

import BaseError from './baseError.js';

/**
 * Error thrown when a clothing slot is not found in blueprint's clothingSlotMappings
 */
export class ClothingSlotNotFoundError extends BaseError {
  constructor(message, slotId, blueprintId) {
    const context = { slotId, blueprintId };
    super(message, 'CLOTHING_SLOT_NOT_FOUND_ERROR', context);
    this.name = 'ClothingSlotNotFoundError';
    // Backward compatibility
    this.slotId = slotId;
    this.blueprintId = blueprintId;
  }

  /**
   * @returns {string} Severity level for clothing slot errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Clothing slot errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}

/**
 * Error thrown when a clothing slot mapping has invalid structure
 */
export class InvalidClothingSlotMappingError extends BaseError {
  constructor(message, slotId, mapping) {
    const context = { slotId, mapping };
    super(message, 'INVALID_CLOTHING_SLOT_MAPPING_ERROR', context);
    this.name = 'InvalidClothingSlotMappingError';
    // Backward compatibility
    this.slotId = slotId;
    this.mapping = mapping;
  }

  /**
   * @returns {string} Severity level for clothing slot mapping errors
   */
  getSeverity() {
    return 'warning';
  }

  /**
   * @returns {boolean} Clothing slot mapping errors are recoverable
   */
  isRecoverable() {
    return true;
  }
}
