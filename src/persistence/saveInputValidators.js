// src/persistence/saveInputValidators.js

/**
 * @file Provides validation helpers for save operations.
 */

import { isNonBlankString } from '../utils/textUtils.js';

/**
 * @description Determines if the provided value is a valid save-related string.
 *
 * Both manual save slot names and save file identifiers are considered valid
 * when they are non-blank strings. This function acts as the single entry point
 * for validating either scenario.
 * @param {*} value - Candidate save string to validate.
 * @returns {boolean} `true` if the value is a non-empty string.
 */
export function isValidSaveString(value) {
  return isNonBlankString(value);
}
