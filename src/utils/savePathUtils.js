// src/utils/savePathUtils.js

/**
 * Directory name for all saved games.
 *
 * @type {string}
 */
export const BASE_SAVE_DIRECTORY = 'saves';

/**
 * Subdirectory that contains manual save files.
 *
 * @type {string}
 */
export const MANUAL_SAVES_SUBDIRECTORY = 'manual_saves';

/**
 * Combined path to the manual save directory.
 *
 * @type {string}
 */
export const FULL_MANUAL_SAVE_DIRECTORY_PATH = `${BASE_SAVE_DIRECTORY}/${MANUAL_SAVES_SUBDIRECTORY}`;

/**
 * Regular expression to match manual save filenames.
 *
 * @type {RegExp}
 */
export const MANUAL_SAVE_PATTERN = /^manual_save_.*\.sav$/;

/**
 * Builds a sanitized manual save filename.
 *
 * @param {string} saveName - Raw save name input.
 * @returns {string} Sanitized filename including prefix and extension.
 */
export function buildManualFileName(saveName) {
  const sanitized = saveName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `manual_save_${sanitized}.sav`;
}

/**
 * Removes manual save prefix and suffix from a filename.
 *
 * @param {string} fileName - File name to clean.
 * @returns {string} Extracted save name.
 */
export function extractSaveName(fileName) {
  return fileName.replace(/^manual_save_/, '').replace(/\.sav$/, '');
}

/**
 * Builds the full path for a manual save file.
 *
 * @param {string} fileName - File name inside the manual saves directory.
 * @returns {string} The fully-qualified path for the file.
 */
export function manualSavePath(fileName) {
  return `${FULL_MANUAL_SAVE_DIRECTORY_PATH}/${fileName}`;
}
