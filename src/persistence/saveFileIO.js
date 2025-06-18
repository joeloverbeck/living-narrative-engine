// src/persistence/saveFileIO.js

import {
  PersistenceError,
  PersistenceErrorCodes,
} from './persistenceErrors.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
} from '../utils/persistenceResultUtils.js';
import { manualSavePath, extractSaveName } from '../utils/savePathUtils.js';
import { validateSaveMetadataFields } from '../utils/saveMetadataUtils.js';
import { wrapPersistenceOperation } from '../utils/persistenceErrorUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IStorageProvider.js').IStorageProvider} IStorageProvider */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} SaveFileMetadata */
/** @typedef {import('./gameStateSerializer.js').default} GameStateSerializer */

/**
 * Reads a file using the provided storage provider.
 *
 * @param {IStorageProvider} storage - Storage provider instance.
 * @param {string} filePath - Path to the file.
 * @param {ILogger} logger - Logger for diagnostics.
 * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<Uint8Array>>}
 */
export async function readSaveFile(storage, filePath, logger) {
  return wrapPersistenceOperation(logger, async () => {
    let fileContent;
    try {
      fileContent = await storage.readFile(filePath);
    } catch (error) {
      const userMsg =
        'Could not access or read the selected save file. Please check file permissions or try another save.';
      logger.error(`Error reading file ${filePath}:`, error);
      return {
        ...createPersistenceFailure(
          PersistenceErrorCodes.FILE_READ_ERROR,
          userMsg
        ),
        userFriendlyError: userMsg,
      };
    }

    if (!fileContent || fileContent.byteLength === 0) {
      const userMsg =
        'The selected save file is empty or cannot be read. It might be corrupted or inaccessible.';
      logger.warn(`File is empty or could not be read: ${filePath}.`);
      return {
        ...createPersistenceFailure(PersistenceErrorCodes.EMPTY_FILE, userMsg),
        userFriendlyError: userMsg,
      };
    }

    return createPersistenceSuccess(fileContent);
  });
}

/**
 * Reads, decompresses and deserializes a save file.
 *
 * @param {IStorageProvider} storage - Storage provider.
 * @param {GameStateSerializer} serializer - Serializer instance.
 * @param {string} filePath - File path to read.
 * @param {ILogger} logger - Logger for diagnostics.
 * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<object>>}
 */
export async function deserializeAndDecompress(
  storage,
  serializer,
  filePath,
  logger
) {
  return wrapPersistenceOperation(logger, async () => {
    logger.debug(`Attempting to read and deserialize file: ${filePath}`);
    const readRes = await readSaveFile(storage, filePath, logger);
    if (!readRes.success) return readRes;

    const decompressRes = serializer.decompress(readRes.data);
    if (!decompressRes.success) return decompressRes;

    const deserializeRes = serializer.deserialize(decompressRes.data);
    if (!deserializeRes.success) return deserializeRes;

    return createPersistenceSuccess(deserializeRes.data);
  });
}

/**
 * Parses a manual save file and extracts metadata.
 *
 * @param {string} fileName - File name within manual saves directory.
 * @param {IStorageProvider} storage - Storage provider.
 * @param {GameStateSerializer} serializer - Serializer instance.
 * @param {ILogger} logger - Logger for diagnostics.
 * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<SaveFileMetadata>>}
 */
export async function parseManualSaveFile(
  fileName,
  storage,
  serializer,
  logger
) {
  return wrapPersistenceOperation(logger, async () => {
    const filePath = manualSavePath(fileName);
    logger.debug(`Processing file: ${filePath}`);

    const deserializationResult = await deserializeAndDecompress(
      storage,
      serializer,
      filePath,
      logger
    );

    if (!deserializationResult.success) {
      logger.warn(
        `Failed to deserialize ${filePath}: ${deserializationResult.error}. Flagging as corrupted for listing.`
      );
      return {
        success: false,
        data: {
          identifier: filePath,
          saveName: extractSaveName(fileName) + ' (Corrupted)',
          timestamp: 'N/A',
          playtimeSeconds: 0,
          isCorrupted: true,
        },
      };
    }

    const saveObject =
      /** @type {import('../interfaces/ISaveLoadService.js').SaveGameStructure | undefined} */ (
        deserializationResult.data
      );

    if (
      !saveObject ||
      typeof saveObject.metadata !== 'object' ||
      saveObject.metadata === null
    ) {
      logger.warn(
        `No metadata section found in ${filePath}. Flagging as corrupted for listing.`
      );
      return {
        success: false,
        data: {
          identifier: filePath,
          saveName: extractSaveName(fileName) + ' (No Metadata)',
          timestamp: 'N/A',
          playtimeSeconds: 0,
          isCorrupted: true,
        },
      };
    }

    const validated = validateSaveMetadataFields(
      {
        identifier: filePath,
        saveName: saveObject.metadata.saveName,
        timestamp: saveObject.metadata.timestamp,
        playtimeSeconds: saveObject.metadata.playtimeSeconds,
      },
      fileName,
      logger
    );

    return {
      success: !validated.isCorrupted,
      data: validated,
    };
  });
}
