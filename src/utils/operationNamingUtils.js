/**
 * @file operationNamingUtils.js
 * @description Naming convention utilities for operation handlers, schemas, and tokens.
 * Extracted to break circular dependency between operationValidationError.js and preValidationUtils.js
 */

/**
 * Converts operation type to expected schema file name
 *
 * Browser-safe helper that converts operation type constant to camelCase schema file name.
 * Does not check if file exists - only performs naming convention conversion.
 *
 * Examples:
 * - ADD_COMPONENT -> addComponent.schema.json
 * - VALIDATE_INVENTORY_CAPACITY -> validateInventoryCapacity.schema.json
 *
 * @param {string} operationType - Operation type constant (e.g., 'ADD_COMPONENT')
 * @returns {string} Expected schema file name
 */
export function toSchemaFileName(operationType) {
  return operationType.toLowerCase().split('_').map((word, idx) =>
    idx === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join('') + '.schema.json';
}

/**
 * Converts operation type to expected DI token name
 *
 * Browser-safe helper that converts operation type constant to PascalCase token name.
 * Does not check if token exists - only performs naming convention conversion.
 *
 * NOTE: Operation handlers DO NOT use "I" prefix (unlike other service interfaces).
 * This matches the convention in tokens-core.js.
 *
 * Examples:
 * - ADD_COMPONENT -> AddComponentHandler
 * - VALIDATE_INVENTORY_CAPACITY -> ValidateInventoryCapacityHandler
 *
 * @param {string} operationType - Operation type constant (e.g., 'ADD_COMPONENT')
 * @returns {string} Expected DI token name (without "I" prefix)
 */
export function toTokenName(operationType) {
  // NO "I" prefix for operation handlers (see tokens-core.js convention)
  return operationType.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join('') + 'Handler';
}

/**
 * Converts operation type to expected handler class name
 *
 * Browser-safe helper that converts operation type constant to expected handler class name.
 * For operation handlers, the class name matches the token name (no "I" prefix).
 *
 * Examples:
 * - ADD_COMPONENT -> AddComponentHandler
 * - VALIDATE_INVENTORY_CAPACITY -> ValidateInventoryCapacityHandler
 *
 * @param {string} operationType - Operation type constant (e.g., 'ADD_COMPONENT')
 * @returns {string} Expected handler class name
 */
export function toHandlerClassName(operationType) {
  // Handler class name is the same as token name for operation handlers
  return toTokenName(operationType);
}
