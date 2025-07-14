/**
 * @file Interface for clothing slot validation services
 */

/**
 * @typedef {object} SlotValidationResult
 * @property {boolean} valid - Whether the validation passed
 * @property {string} [reason] - Reason for validation failure
 */

/**
 * Interface for services that validate clothing slot compatibility
 *
 * @interface IClothingSlotValidator
 */

/**
 * Validates that a clothing item can be equipped in a slot
 *
 * @function
 * @name IClothingSlotValidator#validateSlotCompatibility
 * @param {string} entityId - Entity attempting to equip
 * @param {string} slotId - Target clothing slot
 * @param {string} itemId - Item to equip
 * @param {Map<string, object>} availableSlots - Map of available slots with their mappings
 * @param {Function} resolveAttachmentPoints - Function to resolve slot attachment points
 * @returns {Promise<SlotValidationResult>} Validation result
 */

export {};
