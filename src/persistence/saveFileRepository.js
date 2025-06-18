// src/persistence/saveFileRepository.js

import {
  FULL_MANUAL_SAVE_DIRECTORY_PATH,
  MANUAL_SAVE_PATTERN,
  extractSaveName,
  manualSavePath,
} from '../utils/savePathUtils.js';
import { validateSaveMetadataFields } from '../utils/saveMetadataUtils.js';
import { MSG_FILE_READ_ERROR, MSG_EMPTY_FILE } from './persistenceMessages.js';
import { PersistenceErrorCodes } from './persistenceErrors.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
} from '../utils/persistenceResultUtils.js';
import { wrapPersistenceOperation } from '../utils/persistenceErrorUtils.js';
import { setupService } from '../utils/serviceInitializerUtils.js';

/**
 * @class SaveFileRepository
 * @description Handles file system interactions for manual save files.
 */
export default class SaveFileRepository {
  /** @type {import('../interfaces/coreServices.js').ILogger} */
  #logger;
  /** @type {import('../interfaces/IStorageProvider.js').IStorageProvider} */
  #storageProvider;
  /** @type {import('./gameStateSerializer.js').default} */
  #serializer;

  /**
   * @param {object} deps
   * @param {import('../interfaces/coreServices.js').ILogger} deps.logger - Logger instance.
   * @param {import('../interfaces/IStorageProvider.js').IStorageProvider} deps.storageProvider - Storage provider.
   * @param {import('./gameStateSerializer.js').default} deps.serializer - Serializer used for reading/writing saves.
   */
  constructor({ logger, storageProvider, serializer }) {
    this.#serializer = serializer;
    this.#logger = setupService('SaveFileRepository', logger, {
      storageProvider: {
        value: storageProvider,
        requiredMethods: [
          'writeFileAtomically',
          'listFiles',
          'readFile',
          'deleteFile',
          'fileExists',
        ],
      },
    });
    this.#storageProvider = storageProvider;
  }

  /**
   * Ensures the manual save directory exists if supported.
   *
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<null>>} Result of directory creation.
   */
  async ensureSaveDirectory() {
    if (typeof this.#storageProvider.ensureDirectoryExists !== 'function') {
      return { success: true };
    }

    try {
      await this.#storageProvider.ensureDirectoryExists(
        FULL_MANUAL_SAVE_DIRECTORY_PATH
      );
      this.#logger.debug(
        `Ensured directory exists: ${FULL_MANUAL_SAVE_DIRECTORY_PATH}`
      );
      return { success: true };
    } catch (dirError) {
      this.#logger.error(
        `Failed to ensure directory ${FULL_MANUAL_SAVE_DIRECTORY_PATH} exists:`,
        dirError
      );
      return createPersistenceFailure(
        PersistenceErrorCodes.DIRECTORY_CREATION_FAILED,
        `Failed to create save directory: ${dirError.message}`
      );
    }
  }

  /**
   * Writes a save file to disk.
   *
   * @param {string} filePath - Full path for the save file.
   * @param {Uint8Array} data - Serialized and compressed data.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<null>>} Result of the write operation.
   */
  async writeSaveFile(filePath, data) {
    return wrapPersistenceOperation(this.#logger, async () => {
      const writeResult = await this.#storageProvider.writeFileAtomically(
        filePath,
        data
      );
      if (writeResult.success) {
        return { success: true };
      }

      this.#logger.error(
        `Failed to write manual save to ${filePath}: ${writeResult.error}`
      );
      let userError = `Failed to save game: ${writeResult.error}`;
      if (
        writeResult.error &&
        writeResult.error.toLowerCase().includes('disk full')
      ) {
        userError = 'Failed to save game: Not enough disk space.';
      }
      return createPersistenceFailure(
        PersistenceErrorCodes.WRITE_ERROR,
        userError
      );
    });
  }

  /**
   * Lists manual save filenames in the save directory.
   *
   * @returns {Promise<Array<string>>} Array of file names.
   */
  async listManualSaveFiles() {
    try {
      const files = await this.#storageProvider.listFiles(
        FULL_MANUAL_SAVE_DIRECTORY_PATH,
        MANUAL_SAVE_PATTERN.source
      );
      this.#logger.debug(
        `Found ${files.length} potential manual save files in ${FULL_MANUAL_SAVE_DIRECTORY_PATH}.`
      );
      return files;
    } catch (listError) {
      if (
        listError.message &&
        listError.message.toLowerCase().includes('not found')
      ) {
        this.#logger.debug(
          `${FULL_MANUAL_SAVE_DIRECTORY_PATH} not found. Assuming no manual saves yet.`
        );
        return [];
      }
      this.#logger.error(
        `Error listing files in ${FULL_MANUAL_SAVE_DIRECTORY_PATH}:`,
        listError
      );
      return [];
    }
  }

  /**
   * Parses and validates metadata from a manual save file.
   *
   * @param {string} fileName - File name within the manual save directory.
   * @returns {Promise<import('../interfaces/ISaveLoadService.js').SaveFileMetadata>} Parsed metadata.
   */
  async parseManualSaveMetadata(fileName) {
    const { data: metadata } = await this.#parseManualSaveFile(fileName);

    if (!metadata.isCorrupted) {
      this.#logger.debug(
        `Successfully parsed metadata for ${metadata.identifier}: Name="${metadata.saveName}", Timestamp="${metadata.timestamp}"`
      );
    }

    return metadata;
  }

  /**
   * Reads and deserializes a manual save file.
   *
   * @param {string} filePath - Full path to the save file.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<object>>} Deserialized save data.
   */
  async readSaveFile(filePath) {
    return this.#deserializeAndDecompress(filePath);
  }

  /**
   * Reads a file using the configured storage provider.
   *
   * @param {string} filePath - Path to the file.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<Uint8Array>>}
   */
  async #readSaveFile(filePath) {
    return wrapPersistenceOperation(this.#logger, async () => {
      let fileContent;
      try {
        fileContent = await this.#storageProvider.readFile(filePath);
      } catch (error) {
        const userMsg = MSG_FILE_READ_ERROR;
        this.#logger.error(`Error reading file ${filePath}:`, error);
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
        this.#logger.warn(`File is empty or could not be read: ${filePath}.`);
        return {
          ...createPersistenceFailure(
            PersistenceErrorCodes.EMPTY_FILE,
            userMsg
          ),
          userFriendlyError: userMsg,
        };
      }

      return createPersistenceSuccess(fileContent);
    });
  }

  /**
   * Reads, decompresses and deserializes a save file.
   *
   * @param {string} filePath - File path to read.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<object>>}
   */
  async #deserializeAndDecompress(filePath) {
    return wrapPersistenceOperation(this.#logger, async () => {
      this.#logger.debug(
        `Attempting to read and deserialize file: ${filePath}`
      );
      const readRes = await this.#readSaveFile(filePath);
      if (!readRes.success) return readRes;

      const decompressRes = this.#serializer.decompress(readRes.data);
      if (!decompressRes.success) return decompressRes;

      const deserializeRes = this.#serializer.deserialize(decompressRes.data);
      if (!deserializeRes.success) return deserializeRes;

      return createPersistenceSuccess(deserializeRes.data);
    });
  }

  /**
   * Parses a manual save file and extracts metadata.
   *
   * @param {string} fileName - File name within manual saves directory.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<import('../interfaces/ISaveLoadService.js').SaveFileMetadata>>}
   */
  async #parseManualSaveFile(fileName) {
    return wrapPersistenceOperation(this.#logger, async () => {
      const filePath = manualSavePath(fileName);
      this.#logger.debug(`Processing file: ${filePath}`);

      const deserializationResult =
        await this.#deserializeAndDecompress(filePath);

      if (!deserializationResult.success) {
        this.#logger.warn(
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
        this.#logger.warn(
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
        this.#logger
      );

      return {
        success: !validated.isCorrupted,
        data: validated,
      };
    });
  }

  /**
   * Deletes a manual save file.
   *
   * @param {string} filePath - Full path to the save file.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<null>>} Result of deletion.
   */
  async deleteSaveFile(filePath) {
    return wrapPersistenceOperation(this.#logger, async () => {
      const exists = await this.#storageProvider.fileExists(filePath);
      if (!exists) {
        const msg = `Save file "${filePath}" not found for deletion.`;
        const userMsg = 'Cannot delete: Save file not found.';
        this.#logger.warn(msg);
        return createPersistenceFailure(
          PersistenceErrorCodes.DELETE_FILE_NOT_FOUND,
          userMsg
        );
      }

      const deleteResult = await this.#storageProvider.deleteFile(filePath);
      if (deleteResult.success) {
        this.#logger.debug(`Manual save "${filePath}" deleted successfully.`);
        return deleteResult;
      }

      this.#logger.error(
        `Failed to delete manual save "${filePath}": ${deleteResult.error}`
      );
      return createPersistenceFailure(
        PersistenceErrorCodes.DELETE_FAILED,
        deleteResult.error || 'Unknown delete error'
      );
    });
  }
}
