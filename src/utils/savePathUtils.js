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
export const MANUAL_SAVE_PATTERN = /^manual_save_.*\.sav$/i;

/**
 * Builds a sanitized manual save filename.
 *
 * @param {string} saveName - Raw save name input.
 * @returns {string} Sanitized filename including prefix and extension.
 */
export function buildManualFileName(saveName) {
  const normalizedName =
    typeof saveName === 'string'
      ? saveName.trim()
      : saveName == null
        ? ''
        : String(saveName).trim();
  const sanitized = normalizedName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `manual_save_${sanitized}.sav`;
}

/**
 * Removes manual save prefix and suffix from a filename.
 *
 * @param {string} fileName - File name to clean.
 * @returns {string} Extracted save name.
 */
export function extractSaveName(fileName) {
  const stringValue =
    typeof fileName === 'string' ? fileName : String(fileName ?? '');
  const trimmedValue = stringValue.trim();

  if (!trimmedValue) {
    return '';
  }

  const segments = trimmedValue.split(/[/\\]+/).filter(Boolean);

  if (segments.length === 0) {
    return '';
  }

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i].trim();
    if (!segment) {
      continue;
    }

    const withoutPrefix = segment.replace(/^manual_save_/i, '');
    const withoutExtension = withoutPrefix.replace(/\.sav$/i, '');
    const candidate = withoutExtension.trim();

    if (!candidate) {
      continue;
    }

    if (candidate !== segment || segments.length === 1) {
      return candidate;
    }
  }

  return '';
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

/**
 * Creates the full path to a manual save from a raw save name.
 *
 * Combines {@link buildManualFileName} with {@link manualSavePath} for
 * convenience.
 *
 * @param {string} saveName - Raw save name provided by the user.
 * @returns {string} Fully-qualified manual save path.
 */
export function getManualSavePath(saveName) {
  return manualSavePath(buildManualFileName(saveName));
}
