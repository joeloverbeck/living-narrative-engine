/**
 * @file Validation utilities for perception types
 * @description Provides validation with helpful error messages and suggestions
 * @see specs/perceptionType-consolidation.md
 */

import {
  isValidPerceptionType,
  isLegacyType,
  getLegacyTypeMapping,
  getAllValidTypes,
  suggestNearestType,
  normalizePerceptionType,
} from '../registries/perceptionTypeRegistry.js';

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the type is valid
 * @property {string|null} normalizedType - The normalized type (new format)
 * @property {boolean} isDeprecated - Whether the type is a deprecated legacy type
 * @property {string|null} suggestion - Suggested type for invalid inputs
 * @property {string|null} errorMessage - Human-readable error message
 */

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a perception type and return detailed validation result.
 * @param {string} type - The perception type to validate
 * @param {Object} [context={}] - Optional context for error messages
 * @param {string} [context.source] - Source of the type (e.g., 'rule file', 'handler')
 * @param {string} [context.file] - File path if applicable
 * @returns {ValidationResult} The validation result
 */
export function validatePerceptionType(type, context = {}) {
  const result = {
    isValid: false,
    normalizedType: null,
    isDeprecated: false,
    suggestion: null,
    errorMessage: null,
  };

  // Check for empty/invalid input
  if (!type || typeof type !== 'string') {
    result.errorMessage = createErrorMessage(
      'perception_type must be a non-empty string',
      context
    );
    return result;
  }

  const trimmedType = type.trim();
  if (!trimmedType) {
    result.errorMessage = createErrorMessage(
      'perception_type cannot be empty or whitespace',
      context
    );
    return result;
  }

  // Check if valid
  if (!isValidPerceptionType(trimmedType)) {
    const suggestion = suggestNearestType(trimmedType);
    result.suggestion = suggestion;
    result.errorMessage = createInvalidTypeMessage(trimmedType, suggestion, context);
    return result;
  }

  // Valid type - check if deprecated
  result.isValid = true;
  result.normalizedType = normalizePerceptionType(trimmedType);
  result.isDeprecated = isLegacyType(trimmedType);

  if (result.isDeprecated) {
    const newType = getLegacyTypeMapping(trimmedType);
    result.suggestion = newType;
  }

  return result;
}

/**
 * Create a detailed error message for an invalid perception type.
 * @param {string} invalidType - The invalid type
 * @param {string|null} suggestion - A suggested alternative
 * @param {Object} [context={}] - Optional context
 * @returns {string} The error message
 */
export function createInvalidTypeMessage(invalidType, suggestion, context = {}) {
  const parts = [`Invalid perception_type '${invalidType}'.`];

  if (suggestion) {
    parts.push(`Did you mean '${suggestion}'?`);
  }

  // Add sample of valid types
  const validTypes = getAllValidTypes();
  const sampleTypes = validTypes.slice(0, 8).join(', ');
  parts.push(`Valid types include: ${sampleTypes}...`);

  if (context.source) {
    parts.push(`(Source: ${context.source})`);
  }

  if (context.file) {
    parts.push(`(File: ${context.file})`);
  }

  return parts.join(' ');
}

/**
 * Create a deprecation warning message for a legacy type.
 * @param {string} legacyType - The deprecated legacy type
 * @param {string} newType - The new type to use instead
 * @param {Object} [context={}] - Optional context
 * @returns {string} The warning message
 */
export function createDeprecationWarning(legacyType, newType, context = {}) {
  const parts = [
    `Deprecated perception_type '${legacyType}' used.`,
    `Please migrate to '${newType}'.`,
    'Legacy types will be removed in a future version.',
  ];

  if (context.source) {
    parts.push(`(Source: ${context.source})`);
  }

  if (context.file) {
    parts.push(`(File: ${context.file})`);
  }

  return parts.join(' ');
}

/**
 * Create a generic error message with context.
 * @param {string} message - The base message
 * @param {Object} [context={}] - Optional context
 * @returns {string} The formatted message
 */
function createErrorMessage(message, context = {}) {
  const parts = [message];

  if (context.source) {
    parts.push(`(Source: ${context.source})`);
  }

  if (context.file) {
    parts.push(`(File: ${context.file})`);
  }

  return parts.join(' ');
}

/**
 * Format all valid types as a readable message.
 * Groups types by category for better readability.
 * @returns {string} Formatted message listing all valid types
 */
export function formatValidTypesMessage() {
  const validTypes = getAllValidTypes();
  const byCategory = {};

  for (const type of validTypes) {
    const [category] = type.split('.');
    if (!byCategory[category]) {
      byCategory[category] = [];
    }
    byCategory[category].push(type);
  }

  const lines = ['Valid perception types by category:'];

  for (const [category, types] of Object.entries(byCategory)) {
    lines.push(`  ${category}: ${types.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Validate perception type and throw if invalid.
 * Use this for strict validation where invalid types should halt execution.
 * @param {string} type - The perception type to validate
 * @param {Object} [context={}] - Optional context for error messages
 * @throws {Error} If the type is invalid
 * @returns {{normalizedType: string, isDeprecated: boolean}} Validation info
 */
export function assertValidPerceptionType(type, context = {}) {
  const result = validatePerceptionType(type, context);

  if (!result.isValid) {
    throw new Error(result.errorMessage);
  }

  return {
    normalizedType: result.normalizedType,
    isDeprecated: result.isDeprecated,
  };
}

/**
 * Batch validate multiple perception types.
 * Useful for validating entire files or configurations.
 * @param {string[]} types - Array of perception types to validate
 * @param {Object} [context={}] - Optional context for error messages
 * @returns {{valid: string[], invalid: Array<{type: string, error: string}>, deprecated: string[]}}
 */
export function validatePerceptionTypes(types, context = {}) {
  const result = {
    valid: [],
    invalid: [],
    deprecated: [],
  };

  for (const type of types) {
    const validation = validatePerceptionType(type, context);

    if (validation.isValid) {
      result.valid.push(validation.normalizedType);
      if (validation.isDeprecated) {
        result.deprecated.push(type);
      }
    } else {
      result.invalid.push({
        type,
        error: validation.errorMessage,
        suggestion: validation.suggestion,
      });
    }
  }

  return result;
}

export default {
  validatePerceptionType,
  createInvalidTypeMessage,
  createDeprecationWarning,
  formatValidTypesMessage,
  assertValidPerceptionType,
  validatePerceptionTypes,
};
