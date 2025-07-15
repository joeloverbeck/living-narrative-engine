/**
 * @file Error classes for clothing slot resolution
 * @see src/anatomy/integration/strategies/ClothingSlotMappingStrategy.js
 */

/**
 * Error thrown when a clothing slot is not found in blueprint's clothingSlotMappings
 */
export class ClothingSlotNotFoundError extends Error {
  constructor(message, slotId, blueprintId) {
    super(message);
    this.name = 'ClothingSlotNotFoundError';
    this.slotId = slotId;
    this.blueprintId = blueprintId;
    
    // Maintains proper stack trace for where our error was thrown (only V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClothingSlotNotFoundError);
    }
  }
}

/**
 * Error thrown when a clothing slot mapping has invalid structure
 */
export class InvalidClothingSlotMappingError extends Error {
  constructor(message, slotId, mapping) {
    super(message);
    this.name = 'InvalidClothingSlotMappingError';
    this.slotId = slotId;
    this.mapping = mapping;
    
    // Maintains proper stack trace for where our error was thrown (only V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidClothingSlotMappingError);
    }
  }
}