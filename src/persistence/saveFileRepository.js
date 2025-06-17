// src/persistence/saveFileRepository.js

import {
  FULL_MANUAL_SAVE_DIRECTORY_PATH,
  MANUAL_SAVE_PATTERN,
  extractSaveName,
} from '../utils/savePathUtils.js';
import { deserializeAndDecompress, parseManualSaveFile } from './saveFileIO.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from './persistenceErrors.js';
import { createPersistenceFailure } from './persistenceResultUtils.js';
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
    try {
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
    } catch (error) {
      this.#logger.error(`Error writing save file ${filePath}:`, error);
      return error instanceof PersistenceError
        ? { success: false, error }
        : createPersistenceFailure(
            PersistenceErrorCodes.UNEXPECTED_ERROR,
            `An unexpected error occurred while saving: ${error.message}`
          );
    }
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
    const { success, data: metadata } = await parseManualSaveFile(
      fileName,
      this.#storageProvider,
      this.#serializer,
      this.#logger
    );

    if (!success) {
      return metadata;
    }

    const { identifier, saveName, timestamp, playtimeSeconds } = metadata;

    if (
      typeof saveName !== 'string' ||
      !saveName ||
      typeof timestamp !== 'string' ||
      !timestamp ||
      typeof playtimeSeconds !== 'number' ||
      Number.isNaN(playtimeSeconds)
    ) {
      this.#logger.warn(
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

    this.#logger.debug(
      `Successfully parsed metadata for ${identifier}: Name="${saveName}", Timestamp="${timestamp}"`
    );
    return metadata;
  }

  /**
   * Reads and deserializes a manual save file.
   *
   * @param {string} filePath - Full path to the save file.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<object>>} Deserialized save data.
   */
  async readSaveFile(filePath) {
    return deserializeAndDecompress(
      this.#storageProvider,
      this.#serializer,
      filePath,
      this.#logger
    );
  }

  /**
   * Deletes a manual save file.
   *
   * @param {string} filePath - Full path to the save file.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<null>>} Result of deletion.
   */
  async deleteSaveFile(filePath) {
    try {
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
      } else {
        this.#logger.error(
          `Failed to delete manual save "${filePath}": ${deleteResult.error}`
        );
      }
      return deleteResult.success
        ? deleteResult
        : createPersistenceFailure(
            PersistenceErrorCodes.DELETE_FAILED,
            deleteResult.error || 'Unknown delete error'
          );
    } catch (error) {
      this.#logger.error(
        `Error during manual save deletion process for "${filePath}":`,
        error
      );
      return error instanceof PersistenceError
        ? { success: false, error }
        : createPersistenceFailure(
            PersistenceErrorCodes.UNEXPECTED_ERROR,
            `An unexpected error occurred during deletion: ${error.message}`
          );
    }
  }
}
