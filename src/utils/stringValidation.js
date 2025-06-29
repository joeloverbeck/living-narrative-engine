// src/utils/stringValidation.js
/**
 * @file Utility validation helpers for common string checks.
 */

import { isNonBlankString } from './textUtils.js';

/**
 * Validate that a value is a non-empty string.
 *
 * @param {string} name - Name of the parameter being validated.
 * @param {any} value - Value to check.
 * @returns {string|null} Trimmed string when valid, otherwise null.
 */
export function validateNonEmptyString(name, value) {
  return typeof value === 'string' && isNonBlankString(value)
    ? value.trim()
    : null;
}

export default { validateNonEmptyString };
