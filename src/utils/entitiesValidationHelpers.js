// src/entities/utils/validationHelpers.js

/**
 * @module validationHelpers
 * @description
 * Utility functions used to normalize validation results and format
 * validation error details for logging.
 */

/**
 * Normalize any validator return shape to a simple boolean indicating success.
 *
 * Legacy validators may return `undefined`, `null`, or a bare boolean. Newer
 * validators should return `{ isValid: boolean, errors?: any }`.
 *
 * @param {undefined|null|boolean|import('../../interfaces/coreServices.js').ValidationResult} rawResult
 *   The raw validation result from a schema validator.
 * @returns {boolean} `true` if validation succeeded, `false` otherwise.
 */
export function validationSucceeded(rawResult) {
  if (rawResult === undefined || rawResult === null) return true;
  if (typeof rawResult === 'boolean') return rawResult;
  return !!rawResult.isValid;
}

/**
 * Convert a validation result into a readable string for logs.
 *
 * @param {import('../../interfaces/coreServices.js').ValidationResult|boolean|undefined|null} rawResult
 *   The raw validation result.
 * @returns {string} Stringified error details or a fallback message.
 */
export function formatValidationErrors(rawResult) {
  if (rawResult && typeof rawResult === 'object' && rawResult.errors) {
    return JSON.stringify(rawResult.errors, null, 2);
  }
  return '(validator returned false)';
}

// --- FILE END ---
