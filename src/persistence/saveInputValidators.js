// src/persistence/saveInputValidators.js

/**
 * @file Provides validation helpers for save operations.
 */

import { isNonBlankString } from '../utils/textUtils.js';

/**
 * Validates a manual save name.
 *
 * @param {*} saveName - The candidate save name.
 * @returns {boolean} `true` if the save name is a non-empty string.
 */
export function validateSaveName(saveName) {
  return isNonBlankString(saveName);
}

/**
 * Validates a save identifier.
 *
 * @param {*} saveIdentifier - The identifier to validate.
 * @returns {boolean} `true` if the identifier is a non-empty string.
 */
export function validateSaveIdentifier(saveIdentifier) {
  return isNonBlankString(saveIdentifier);
}
