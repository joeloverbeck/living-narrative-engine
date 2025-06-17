// src/services/saveLoadService.js

import { ISaveLoadService } from '../interfaces/ISaveLoadService.js';
import GameStateSerializer from './gameStateSerializer.js';
import SaveValidationService from './saveValidationService.js';
import { buildManualFileName, manualSavePath } from '../utils/savePathUtils.js';
import SaveFileRepository from './saveFileRepository.js';
import { setupService } from '../utils/serviceInitializerUtils.js';
import { safeDeepClone } from '../utils/objectUtils.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from './persistenceErrors.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
} from './persistenceResultUtils.js';
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
  #fileRepository;
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
    saveFileRepository = null,
  }) {
    super();
    if (!logger) {
      throw new Error('SaveLoadService requires a logger.');
    }
    if (!saveFileRepository && !storageProvider) {
      throw new Error(
        'SaveLoadService requires a storageProvider or saveFileRepository.'
      );
    }
    this.#serializer =
      gameStateSerializer || new GameStateSerializer({ logger, crypto });
    this.#validationService =
      saveValidationService ||
      new SaveValidationService({
        logger,
        gameStateSerializer: this.#serializer,
      });

    this.#fileRepository =
      saveFileRepository ||
      new SaveFileRepository({
        logger,
        storageProvider,
        serializer: this.#serializer,
      });

    this.#logger = setupService('SaveLoadService', logger, {
      fileRepository: {
        value: this.#fileRepository,
        requiredMethods: [
          'ensureSaveDirectory',
          'writeSaveFile',
          'listManualSaveFiles',
          'parseManualSaveMetadata',
          'readSaveFile',
          'deleteSaveFile',
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
      return createPersistenceFailure(
        cloneResult.error.code,
        cloneResult.error.message
      );
    }

    /** @type {SaveGameStructure} */
    const cloned = cloneResult.data;
    cloned.metadata = { ...(cloned.metadata || {}), saveName };
    cloned.integrityChecks = { ...(cloned.integrityChecks || {}) };
    return createPersistenceSuccess(cloned);
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

  /**
   * @inheritdoc
   * @returns {Promise<Array<SaveFileMetadata>>} Parsed metadata entries.
   */
  async listManualSaveSlots() {
    this.#logger.debug('Listing manual save slots...');
    const files = await this.#fileRepository.listManualSaveFiles();

    const metadataList = await Promise.all(
      files.map((name) => this.#fileRepository.parseManualSaveMetadata(name))
    );

    this.#logger.debug(
      `Finished listing manual save slots. Returning ${metadataList.length} items.`
    );
    return metadataList;
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
    const deserializationResult =
      await this.#fileRepository.readSaveFile(saveIdentifier);

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
    return createPersistenceSuccess(loadedObject);
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

    const dirResult = await this.#fileRepository.ensureSaveDirectory();
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

    const writeResult = await this.#fileRepository.writeSaveFile(
      filePath,
      compressedData
    );
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

    return this.#fileRepository.deleteSaveFile(saveIdentifier);
  }
}

export default SaveLoadService;
