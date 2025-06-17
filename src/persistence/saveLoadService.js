// src/services/saveLoadService.js

import { ISaveLoadService } from '../interfaces/ISaveLoadService.js';
import GameStateSerializer from './gameStateSerializer.js';
import SaveValidationService from './saveValidationService.js';
import {
  buildManualFileName,
  manualSavePath,
  FULL_MANUAL_SAVE_DIRECTORY_PATH,
  MANUAL_SAVE_PATTERN,
} from '../utils/savePathUtils.js';
import { deserializeAndDecompress, parseManualSaveFile } from './saveFileIO.js';
import { setupService } from '../utils/serviceInitializerUtils.js';
import { safeDeepClone } from '../utils/objectUtils.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from './persistenceErrors.js';
import { createPersistenceFailure } from './persistenceResultUtils.js';
import {
  validateSaveName,
  validateSaveIdentifier,
} from './saveInputValidators.js';
// REMOVED: import {createHash} from 'crypto';

// --- Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IStorageProvider.js').IStorageProvider} IStorageProvider */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} SaveFileMetadata */
/** @typedef {import('../interfaces/ISaveLoadService.js').LoadGameResult} LoadGameResult */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */
/** @typedef {import('./gameStateSerializer.js').default} GameStateSerializer */

// --- Constants ---
// const MAX_MANUAL_SAVES = 10; // Not directly enforced by list/load, but by save UI/logic
// Constants defining the manual save directory live in savePathUtils
// const TEMP_SAVE_SUFFIX = '.tmp'; // Defined in writeFileAtomically in IStorageProvider context

/**
 * @implements {ISaveLoadService}
 */
class SaveLoadService extends ISaveLoadService {
  #logger;
  #storageProvider;
  #serializer;
  #validationService;

  /**
   * Creates a new SaveLoadService instance.
   *
   * @param {object} dependencies - The dependencies object.
   * @param {ILogger} dependencies.logger - The logging service.
   * @param {IStorageProvider} dependencies.storageProvider - The storage provider service.
   * @param {Crypto} [dependencies.crypto] - Web Crypto implementation.
   * @param {GameStateSerializer} [dependencies.gameStateSerializer] - Optional serializer instance.
   */
  constructor({
    logger,
    storageProvider,
    crypto = globalThis.crypto,
    gameStateSerializer = null,
    saveValidationService = null,
  }) {
    // <<< MODIFIED SIGNATURE with destructuring
    super();
    this.#serializer =
      gameStateSerializer || new GameStateSerializer({ logger, crypto });
    this.#validationService =
      saveValidationService ||
      new SaveValidationService({
        logger,
        gameStateSerializer: this.#serializer,
      });
    this.#logger = setupService('SaveLoadService', logger, {
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
      saveValidationService: {
        value: this.#validationService,
        requiredMethods: [
          'validateStructure',
          'verifyChecksum',
          'validateLoadedSaveObject',
        ],
      },
    });
    this.#storageProvider = storageProvider;
    this.#logger.debug('SaveLoadService initialized.');
  }
  /**
   * Ensures the provided save identifier is valid.
   *
   * @param {*} id - Candidate save identifier.
   * @returns {import('./persistenceTypes.js').PersistenceResult<null>} Result.
   * @private
   */
  #assertValidIdentifier(id) {
    if (!validateSaveIdentifier(id)) {
      this.#logger.error('Invalid saveIdentifier provided.');
      return createPersistenceFailure(
        PersistenceErrorCodes.INVALID_SAVE_IDENTIFIER,
        'A valid save file identifier must be provided.'
      );
    }
    return { success: true };
  }

  /**
   * Ensures the manual save directory exists if the storage provider supports it.
   *
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<null>>}
   *   Result of the directory creation attempt.
   * @private
   */
  async #ensureSaveDirectory() {
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
   * Deep clones and augments the provided game state for saving.
   *
   * @param {string} saveName - Name of the save slot.
   * @param {SaveGameStructure} obj - Original game state object.
   * @returns {import('./persistenceTypes.js').PersistenceResult<SaveGameStructure>}
   *   Result containing the cloned object or error.
   * @private
   */
  #cloneAndPrepareState(saveName, obj) {
    const cloneResult = safeDeepClone(obj, this.#logger);
    if (!cloneResult.success || !cloneResult.data) {
      return { success: false, error: cloneResult.error };
    }

    /** @type {SaveGameStructure} */
    const cloned = cloneResult.data;
    cloned.metadata = { ...(cloned.metadata || {}), saveName };
    cloned.integrityChecks = { ...(cloned.integrityChecks || {}) };
    return { success: true, data: cloned };
  }

  /**
   * Writes compressed save data to disk and handles common error cases.
   *
   * @param {string} filePath - Path to write the save file.
   * @param {Uint8Array} data - Serialized and compressed data.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<null>>}
   *   Result of the write operation.
   * @private
   */
  async #writeSaveFile(filePath, data) {
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
   * Retrieves manual save file names from the storage provider.
   * Handles missing directory or listing errors gracefully.
   *
   * @returns {Promise<Array<string>>} List of file names.
   * @private
   */
  async #getManualSaveFiles() {
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
   * Parses and validates metadata for a single manual save file.
   *
   * @param {string} fileName - File name within the manual saves directory.
   * @returns {Promise<SaveFileMetadata>} Parsed metadata object.
   * @private
   */
  async #parseManualSaveMetadata(fileName) {
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
      isNaN(playtimeSeconds)
    ) {
      this.#logger.warn(
        `Essential metadata missing or malformed in ${identifier}. Contents: ${JSON.stringify(
          metadata
        )}. Flagging as corrupted for listing.`
      );
      return {
        identifier,
        saveName:
          saveName ||
          fileName.replace(/\.sav$/, '').replace(/^manual_save_/, '') +
            ' (Bad Metadata)',
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
   * @inheritdoc
   * @returns {Promise<Array<SaveFileMetadata>>} Parsed metadata entries.
   */
  async listManualSaveSlots() {
    this.#logger.debug(
      `Listing manual save slots from ${FULL_MANUAL_SAVE_DIRECTORY_PATH}...`
    );
    const files = await this.#getManualSaveFiles();
    const collectedMetadata = [];

    for (const fileName of files) {
      const metadata = await this.#parseManualSaveMetadata(fileName);
      collectedMetadata.push(metadata);
    }

    this.#logger.debug(
      `Finished listing manual save slots. Returning ${collectedMetadata.length} items.`
    );
    return collectedMetadata;
  }

  /**
   * @inheritdoc
   * @param {string} saveIdentifier - The full path or unique ID of the save file to load (e.g., "saves/manual_saves/my_save.sav").
   * @returns {Promise<LoadGameResult>} Loaded game data or error info.
   */
  async loadGameData(saveIdentifier) {
    //
    this.#logger.debug(
      `Attempting to load game data from: "${saveIdentifier}"`
    );

    const idResult = this.#assertValidIdentifier(saveIdentifier);
    if (!idResult.success) {
      return { success: false, error: idResult.error, data: null };
    }

    // saveIdentifier is expected to be the full path including "saves/manual_saves/"
    const deserializationResult = await deserializeAndDecompress(
      this.#storageProvider,
      this.#serializer,
      saveIdentifier,
      this.#logger
    );

    if (!deserializationResult.success || !deserializationResult.data) {
      this.#logger.warn(
        `Failed to deserialize ${saveIdentifier}: ${deserializationResult.error}`
      );
      return {
        ...(deserializationResult.error instanceof PersistenceError
          ? { success: false, error: deserializationResult.error }
          : createPersistenceFailure(
              PersistenceErrorCodes.DESERIALIZATION_ERROR,
              deserializationResult.userFriendlyError ||
                'Unknown deserialization error'
            )),
        data: null,
      };
    }

    const loadedObject = /** @type {SaveGameStructure} */ (
      deserializationResult.data
    );

    const validationResult =
      await this.#validationService.validateLoadedSaveObject(
        loadedObject,
        saveIdentifier
      );
    if (!validationResult.success) {
      return { success: false, error: validationResult.error, data: null };
    }

    this.#logger.debug(
      `Game data loaded and validated successfully from: "${saveIdentifier}"`
    );
    return { success: true, data: loadedObject, error: null };
  }

  /**
   * @inheritdoc
   */
  async saveManualGame(saveName, gameStateObject) {
    this.#logger.debug(`Attempting to save manual game: "${saveName}"`);

    if (!validateSaveName(saveName)) {
      const userMsg = 'Invalid save name provided. Please enter a valid name.';
      this.#logger.error('Invalid saveName provided for manual save.');
      return createPersistenceFailure(
        PersistenceErrorCodes.INVALID_SAVE_NAME,
        userMsg
      );
    }

    const fileName = buildManualFileName(saveName);
    const filePath = manualSavePath(fileName);

    const dirResult = await this.#ensureSaveDirectory();
    if (!dirResult.success) {
      return dirResult;
    }

    const cloneResult = this.#cloneAndPrepareState(saveName, gameStateObject);
    if (!cloneResult.success || !cloneResult.data) {
      return { success: false, error: cloneResult.error };
    }

    let compressedData;
    try {
      ({ compressedData } = await this.#serializer.serializeAndCompress(
        cloneResult.data
      ));
    } catch (error) {
      this.#logger.error(
        `Error during manual save process for "${saveName}":`,
        error
      );
      return error instanceof PersistenceError
        ? { success: false, error }
        : createPersistenceFailure(
            PersistenceErrorCodes.UNEXPECTED_ERROR,
            `An unexpected error occurred while saving: ${error.message}`
          );
    }

    const writeResult = await this.#writeSaveFile(filePath, compressedData);
    if (!writeResult.success) {
      return writeResult;
    }

    this.#logger.debug(
      `Manual game "${saveName}" saved successfully to ${filePath}.`
    );
    return {
      success: true,
      message: `Game saved as "${saveName}".`,
      filePath,
    };
  }

  /**
   * @inheritdoc
   * @param {string} saveIdentifier - The full path to the save file to delete (e.g., "saves/manual_saves/my_save.sav").
   */
  async deleteManualSave(saveIdentifier) {
    this.#logger.debug(`Attempting to delete manual save: "${saveIdentifier}"`);
    const idResult = this.#assertValidIdentifier(saveIdentifier);
    if (!idResult.success) {
      return idResult;
    }

    // saveIdentifier is expected to be the full path, e.g., "saves/manual_saves/file.sav"
    const filePath = saveIdentifier;

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

export default SaveLoadService;
