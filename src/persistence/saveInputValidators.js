// src/persistence/saveInputValidators.js

/**
 * @file Provides validation helpers for save operations.
 */

/**
 * Validates a manual save name.
 *
 * @param {*} saveName - The candidate save name.
 * @returns {boolean} `true` if the save name is a non-empty string.
 */
export function validateSaveName(saveName) {
  return typeof saveName === 'string' && saveName.trim() !== '';
}

/**
 * Validates a save identifier.
 *
 * @param {*} saveIdentifier - The identifier to validate.
 * @returns {boolean} `true` if the identifier is a non-empty string.
 */
export function validateSaveIdentifier(saveIdentifier) {
  return typeof saveIdentifier === 'string' && saveIdentifier.trim() !== '';
}
