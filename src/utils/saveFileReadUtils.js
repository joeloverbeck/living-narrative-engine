// src/utils/saveFileReadUtils.js

import {
  MSG_FILE_READ_ERROR,
  MSG_EMPTY_FILE,
} from '../persistence/persistenceMessages.js';
import { PersistenceErrorCodes } from '../persistence/persistenceErrors.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
} from './persistenceResultUtils.js';
import { wrapPersistenceOperation } from './persistenceErrorUtils.js';

/**
 * Reads a file using a storage provider.
 *
 * @description Wrapper around {@link IStorageProvider.readFile} that handles
 * common error cases and logging.
 * @param {import('../interfaces/IStorageProvider.js').IStorageProvider} storageProvider - Storage provider instance.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics.
 * @param {string} filePath - Path to the file on disk.
 * @returns {Promise<import('../persistence/persistenceTypes.js').PersistenceResult<Uint8Array>>}
 *   File contents or error information.
 */
export async function readSaveFile(storageProvider, logger, filePath) {
  return wrapPersistenceOperation(logger, async () => {
    let fileContent;
    try {
      fileContent = await storageProvider.readFile(filePath);
    } catch (error) {
      const userMsg = MSG_FILE_READ_ERROR;
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
      const userMsg = MSG_EMPTY_FILE;
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
 * Decompresses and deserializes a save buffer.
 *
 * @param {import('../persistence/gameStateSerializer.js').default} serializer - Serializer instance.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics.
 * @param {Uint8Array} buffer - Compressed save data.
 * @returns {import('../persistence/persistenceTypes.js').PersistenceResult<object>}
 *   Parsed object or failure result.
 */
export function deserializeAndDecompress(serializer, logger, buffer) {
  const parseRes = serializer.decompressAndDeserialize(buffer);
  if (!parseRes.success) return parseRes;
  return createPersistenceSuccess(parseRes.data);
}

/**
 * Reads, decompresses and deserializes a save file.
 *
 * @param {import('../interfaces/IStorageProvider.js').IStorageProvider} storageProvider - Storage provider instance.
 * @param {import('../persistence/gameStateSerializer.js').default} serializer - Serializer used for decoding.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics.
 * @param {string} filePath - Path to the save file.
 * @returns {Promise<import('../persistence/persistenceTypes.js').PersistenceResult<object>>}
 *   Parsed object or failure result.
 */
export async function readAndDeserialize(
  storageProvider,
  serializer,
  logger,
  filePath
) {
  return wrapPersistenceOperation(logger, async () => {
    logger.debug(`Attempting to read and deserialize file: ${filePath}`);
    const readRes = await readSaveFile(storageProvider, logger, filePath);
    if (!readRes.success) return readRes;

    return deserializeAndDecompress(serializer, logger, readRes.data);
  });
}
