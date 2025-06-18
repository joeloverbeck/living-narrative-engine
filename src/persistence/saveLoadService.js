import { ISaveLoadService } from '../interfaces/ISaveLoadService.js';
import GameStateSerializer from './gameStateSerializer.js';
import SaveValidationService from './saveValidationService.js';
import { buildManualFileName, manualSavePath } from '../utils/savePathUtils.js';
import SaveFileRepository from './saveFileRepository.js';
import BaseService from '../utils/serviceBase.js';
import { prepareState } from './savePreparation.js';
import { PersistenceErrorCodes } from './persistenceErrors.js';
import {
  createPersistenceFailure,
  createPersistenceSuccess,
  normalizePersistenceFailure,
} from '../utils/persistenceResultUtils.js';
import { isValidSaveString } from './saveInputValidators.js';

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
class SaveLoadService extends BaseService {
  #logger;
  #fileRepository;
  #serializer;
  #validationService;

  /**
   * Creates a new SaveLoadService instance.
   *
   * @param {object} dependencies - The dependencies object.
   * @param {ILogger} dependencies.logger - The logging service.
   * @param {SaveFileRepository} dependencies.saveFileRepository - Repository for save files.
   * @param {GameStateSerializer} dependencies.gameStateSerializer - Serializer instance.
   * @param {SaveValidationService} dependencies.saveValidationService - Validation service.
   */
  constructor({
    logger,
    saveFileRepository,
    gameStateSerializer,
    saveValidationService,
  }) {
    super();
    if (!logger) {
      throw new Error('SaveLoadService requires a logger.');
    }
    if (!saveFileRepository) {
      throw new Error('SaveLoadService requires a saveFileRepository.');
    }
    if (!gameStateSerializer) {
      throw new Error('SaveLoadService requires a gameStateSerializer.');
    }
    if (!saveValidationService) {
      throw new Error('SaveLoadService requires a saveValidationService.');
    }

    this.#serializer = gameStateSerializer;
    this.#validationService = saveValidationService;

    this.#fileRepository = saveFileRepository;
    this.#logger = this._init('SaveLoadService', logger, {
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
    if (!isValidSaveString(id)) {
      this.#logger.error('Invalid saveIdentifier provided.');
      return createPersistenceFailure(
        PersistenceErrorCodes.INVALID_SAVE_IDENTIFIER,
        'A valid save file identifier must be provided.'
      );
    }
    return { success: true };
  }

  /**
   * Ensures the manual save directory exists.
   *
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<null>>}
   *   Result of the directory creation operation.
   * @private
   */
  async #ensureSaveDirectory() {
    return this.#fileRepository.ensureSaveDirectory();
  }

  /**
   * Prepares and serializes game state data for saving.
   *
   * @param {string} saveName - Name of the save slot.
   * @param {SaveGameStructure} gameStateObject - Raw game state object.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<Uint8Array>>}
   *   Result containing compressed data.
   * @private
   */
  async #prepareState(saveName, gameStateObject) {
    return prepareState(
      saveName,
      gameStateObject,
      this.#serializer,
      this.#logger
    );
  }

  /**
   * Writes serialized data to disk.
   *
   * @param {string} filePath - Full path for the save file.
   * @param {Uint8Array} compressedData - Serialized data buffer.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<null>>}
   *   Result of the write operation.
   * @private
   */
  async #writeManualSave(filePath, compressedData) {
    return this.#fileRepository.writeSaveFile(filePath, compressedData);
  }

  /**
   * @inheritdoc
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<Array<SaveFileMetadata>>>}
   *   Parsed metadata entries wrapped in a PersistenceResult.
   */
  async listManualSaveSlots() {
    this.#logger.debug('Listing manual save slots...');
    const fileListResult = await this.#fileRepository.listManualSaveFiles();

    if (!fileListResult.success) {
      return fileListResult;
    }

    const files = fileListResult.data || [];
    const parsedList = await Promise.all(
      files.map((name) => this.#fileRepository.parseManualSaveMetadata(name))
    );

    const metadataList = parsedList.map((res) =>
      res.isCorrupted ? { ...res.metadata, isCorrupted: true } : res.metadata
    );

    this.#logger.debug(
      `Finished listing manual save slots. Returning ${metadataList.length} items.`
    );
    return { success: true, data: metadataList };
  }

  /**
   * @inheritdoc
   * @param {string} saveIdentifier - The full path or unique ID of the save file to load (e.g., "saves/manual_saves/my_save.sav").
   * @returns {Promise<LoadGameResult>} Loaded game data or error info.
   */
  async loadGameData(saveIdentifier) {
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
      return normalizePersistenceFailure(
        deserializationResult,
        PersistenceErrorCodes.DESERIALIZATION_ERROR,
        deserializationResult.userFriendlyError ||
          'Unknown deserialization error'
      );
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

    if (!isValidSaveString(saveName)) {
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

    const prepResult = await this.#prepareState(saveName, gameStateObject);
    if (!prepResult.success || !prepResult.data) {
      return { success: false, error: prepResult.error };
    }

    const writeResult = await this.#writeManualSave(filePath, prepResult.data);
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

  /**
   * Creates a SaveLoadService with default dependencies.
   *
   * @param {object} deps - Factory dependencies.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {IStorageProvider} deps.storageProvider - Storage provider for files.
   * @param {Crypto} [deps.crypto] - Optional Web Crypto implementation.
   * @returns {SaveLoadService} Configured SaveLoadService instance.
   */
  static createDefault({
    logger,
    storageProvider,
    crypto = globalThis.crypto,
  }) {
    const serializer = new GameStateSerializer({ logger, crypto });
    const validationService = new SaveValidationService({
      logger,
      gameStateSerializer: serializer,
    });
    const repository = new SaveFileRepository({
      logger,
      storageProvider,
      serializer,
    });
    return new SaveLoadService({
      logger,
      saveFileRepository: repository,
      gameStateSerializer: serializer,
      saveValidationService: validationService,
    });
  }
}

export default SaveLoadService;
