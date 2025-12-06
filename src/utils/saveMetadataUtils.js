// src/utils/saveMetadataUtils.js

import { extractSaveName } from '../utils/savePathUtils.js';
import { safeStringify } from './safeStringify.js';

/**
 * @description Determines whether the provided metadata value is a plain object.
 * @param {unknown} metadata - Candidate metadata value.
 * @returns {metadata is Record<string, any>} True when `metadata` is a non-null object.
 */
function isMetadataObject(metadata) {
  return (
    Boolean(metadata) &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata)
  );
}

/**
 * @description Retrieves a usable identifier string from metadata or falls back to the file name.
 * @param {unknown} metadata - Parsed metadata object or primitive.
 * @param {string} fileName - Manual save file name for context.
 * @returns {string} Identifier suitable for logging and fallback metadata.
 */
function getMetadataIdentifier(metadata, fileName) {
  if (
    isMetadataObject(metadata) &&
    typeof metadata.identifier === 'string' &&
    metadata.identifier.trim() !== ''
  ) {
    return metadata.identifier;
  }

  if (typeof fileName === 'string' && fileName.trim() !== '') {
    return fileName.trim();
  }

  return 'unknown-manual-save';
}

/**
 * @description Builds a fallback save name when the metadata is incomplete.
 * @param {string} fileName - Manual save file name for context.
 * @returns {string} Fallback save name with a "Bad Metadata" suffix.
 */
function buildFallbackSaveName(fileName) {
  if (typeof fileName !== 'string' || fileName.trim() === '') {
    return 'Unknown Save (Bad Metadata)';
  }

  const baseName = extractSaveName(fileName);
  return baseName
    ? `${baseName} (Bad Metadata)`
    : 'Unknown Save (Bad Metadata)';
}

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
  const identifierForLog = getMetadataIdentifier(metadata, fileName);
  const serializedMetadata = safeStringify(metadata);

  if (!isMetadataObject(metadata)) {
    logger.warn(
      `Essential metadata missing or malformed in ${identifierForLog}. Contents: ${serializedMetadata}. Flagging as corrupted for listing.`
    );

    return {
      identifier: identifierForLog,
      saveName: buildFallbackSaveName(fileName),
      timestamp: 'N/A',
      playtimeSeconds: 0,
      isCorrupted: true,
    };
  }

  const { identifier, saveName, timestamp, playtimeSeconds } = metadata;

  if (
    typeof saveName !== 'string' ||
    !saveName ||
    typeof timestamp !== 'string' ||
    !timestamp ||
    typeof playtimeSeconds !== 'number' ||
    Number.isNaN(playtimeSeconds) ||
    !Number.isFinite(playtimeSeconds) ||
    playtimeSeconds < 0
  ) {
    logger.warn(
      `Essential metadata missing or malformed in ${
        identifier || identifierForLog
      }. Contents: ${serializedMetadata}. Flagging as corrupted for listing.`
    );
    return {
      identifier: identifier || identifierForLog,
      saveName:
        typeof saveName === 'string' && saveName
          ? saveName
          : buildFallbackSaveName(fileName),
      timestamp: timestamp || 'N/A',
      playtimeSeconds:
        typeof playtimeSeconds === 'number' &&
        Number.isFinite(playtimeSeconds) &&
        playtimeSeconds >= 0
          ? playtimeSeconds
          : 0,
      isCorrupted: true,
    };
  }

  return metadata;
}
