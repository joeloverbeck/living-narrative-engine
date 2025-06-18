// src/utils/saveMetadataUtils.js

import { extractSaveName } from '../utils/savePathUtils.js';

/**
 * Validates essential save metadata fields.
 *
 * @description Ensures metadata contains required values. Logs and marks
 * corrupted metadata when fields are missing or malformed.
 * @param {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} metadata - Parsed metadata object.
 * @param {string} fileName - Manual save file name for context.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for warnings.
 * @returns {import('../interfaces/ISaveLoadService.js').SaveFileMetadata & {isCorrupted?: boolean}}
 * The validated metadata, possibly marked as corrupted.
 */
export function validateSaveMetadataFields(metadata, fileName, logger) {
  const { identifier, saveName, timestamp, playtimeSeconds } = metadata;

  if (
    typeof saveName !== 'string' ||
    !saveName ||
    typeof timestamp !== 'string' ||
    !timestamp ||
    typeof playtimeSeconds !== 'number' ||
    Number.isNaN(playtimeSeconds)
  ) {
    logger.warn(
      `Essential metadata missing or malformed in ${identifier}. Contents: ${JSON.stringify(
        metadata
      )}. Flagging as corrupted for listing.`
    );
    return {
      identifier,
      saveName: saveName || `${extractSaveName(fileName)} (Bad Metadata)`,
      timestamp: timestamp || 'N/A',
      playtimeSeconds:
        typeof playtimeSeconds === 'number' ? playtimeSeconds : 0,
      isCorrupted: true,
    };
  }

  return metadata;
}

export default validateSaveMetadataFields;
