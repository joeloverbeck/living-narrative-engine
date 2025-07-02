/**
 * @file Utility functions for working with filename lists in mod manifests.
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
import { resolvePath } from './objectUtils.js';

/**
 * Safely extracts and validates filenames from the manifest for a given content key.
 *
 * @param {object | null | undefined} manifest - Parsed mod manifest object.
 * @param {string} contentKey - Key within manifest.content.
 * @param {string} modId - ID of the mod being processed.
 * @param {ILogger} logger - Logger for warnings/debug messages.
 * @returns {string[]} Array of valid, trimmed filenames.
 */
export function extractValidFilenames(manifest, contentKey, modId, logger) {
  const filenames = resolvePath(manifest?.content, contentKey);
  if (filenames === null || filenames === undefined) {
    logger.debug(
      `Mod '${modId}': Content key '${contentKey}' not found or is null/undefined in manifest. Skipping.`
    );
    return [];
  }
  if (!Array.isArray(filenames)) {
    logger.warn(
      `Mod '${modId}': Expected an array for content key '${contentKey}' but found type '${typeof filenames}'. Skipping.`
    );
    return [];
  }
  const validFilenames = filenames
    .filter((element) => {
      if (typeof element !== 'string') {
        logger.warn(
          `Mod '${modId}': Invalid non-string entry found in '${contentKey}' list:`,
          element
        );
        return false;
      }
      const trimmedElement = element.trim();
      if (trimmedElement === '') {
        logger.warn(
          `Mod '${modId}': Empty string filename found in '${contentKey}' list after trimming. Skipping.`
        );
        return false;
      }
      return true;
    })
    .map((element) => element.trim());
  return validFilenames;
}

export default extractValidFilenames;
