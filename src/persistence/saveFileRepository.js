// src/persistence/saveFileRepository.js

import {
  FULL_MANUAL_SAVE_DIRECTORY_PATH,
  MANUAL_SAVE_PATTERN,
} from '../utils/savePathUtils.js';
import SaveFileParser from './saveFileParser.js';
import { PersistenceErrorCodes } from './persistenceErrors.js';
import { createPersistenceFailure } from '../utils/persistenceResultUtils.js';
import { wrapPersistenceOperation } from '../utils/persistenceErrorUtils.js';
import { BaseService } from '../utils/serviceBase.js';

// Precompile manual save file regex once for reuse
const manualSaveRegex = MANUAL_SAVE_PATTERN;

/**
 * @class SaveFileRepository
 * @description
 *   Acts as the single entry point for manual save storage operations. All
 *   reads, writes, listings and deletions of save files are funneled through
 *   this repository which delegates parsing logic to {@link SaveFileParser}.
 */
export default class SaveFileRepository extends BaseService {
  /** @type {import('../interfaces/coreServices.js').ILogger} */
  #logger;
  /** @type {import('../interfaces/IStorageProvider.js').IStorageProvider} */
  #storageProvider;
  /** @type {SaveFileParser} */
  #parser;

  /**
   * Creates a new repository instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {import('../interfaces/coreServices.js').ILogger} deps.logger - Logger instance.
   * @param {import('../interfaces/IStorageProvider.js').IStorageProvider} deps.storageProvider - Storage provider.
   * @param {SaveFileParser} deps.parser - Parser for reading save metadata.
   */
  constructor({ logger, storageProvider, parser }) {
    super();
    this.#logger = this._init('SaveFileRepository', logger, {
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
      parser: {
        value: parser,
        requiredMethods: ['parseManualSaveFile', 'readAndDeserialize'],
      },
    });
    this.#storageProvider = storageProvider;
    this.#parser = parser;
  }

  /**
   * Helper to wrap persistence operations with logging.
   *
   * @param {() => Promise<any>} operationFn - Operation to execute.
   * @returns {Promise<any>} Result of the wrapped operation.
   * @private
   */
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
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<string[]>>}
   *   Array of file names wrapped in a PersistenceResult.
   */
  async listManualSaveFiles() {
    try {
      const files = await this.#storageProvider.listFiles(
        FULL_MANUAL_SAVE_DIRECTORY_PATH,
        manualSaveRegex.source
      );
      this.#logger.debug(
        `Found ${files.length} potential manual save files in ${FULL_MANUAL_SAVE_DIRECTORY_PATH}.`
      );
      return { success: true, data: files };
    } catch (listError) {
      if (
        listError.message &&
        listError.message.toLowerCase().includes('not found')
      ) {
        this.#logger.debug(
          `${FULL_MANUAL_SAVE_DIRECTORY_PATH} not found. Assuming no manual saves yet.`
        );
        return { success: true, data: [] };
      }

      this.#logger.error(
        `Error listing files in ${FULL_MANUAL_SAVE_DIRECTORY_PATH}:`,
        listError
      );
      return createPersistenceFailure(
        PersistenceErrorCodes.FILE_READ_ERROR,
        `Failed to list save files: ${listError.message}`
      );
    }
  }

  /**
   * Parses and validates metadata from a manual save file.
   *
   * @param {string} fileName - File name within the manual save directory.
   * @returns {Promise<import('./persistenceTypes.js').ParseSaveFileResult>} Parsed metadata result.
   */
  async parseManualSaveMetadata(fileName) {
    const result = await this.#parser.parseManualSaveFile(fileName);

    if (!result.isCorrupted) {
      this.#logger.debug(
        `Successfully parsed metadata for ${result.metadata.identifier}: Name="${result.metadata.saveName}", Timestamp="${result.metadata.timestamp}"`
      );
    }

    return result;
  }

  /**
   * Reads and deserializes a manual save file.
   *
   * @param {string} filePath - Full path to the save file.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<object>>} Deserialized save data.
   */
  async readSaveFile(filePath) {
    return this.#parser.readAndDeserialize(filePath);
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
