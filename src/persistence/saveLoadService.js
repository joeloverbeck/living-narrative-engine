// src/services/saveLoadService.js

import { ISaveLoadService } from '../interfaces/ISaveLoadService.js';
import { encode } from '@msgpack/msgpack';
import { deepClone } from '../utils/objectUtils.js';
import GameStateSerializer from './gameStateSerializer.js';
import { setupService } from '../utils/serviceInitializer.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from './persistenceErrors.js';
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
const BASE_SAVE_DIRECTORY = 'saves'; // New root directory for all saves
const MANUAL_SAVES_SUBDIRECTORY = 'manual_saves'; // Subdirectory for manual saves
const FULL_MANUAL_SAVE_DIRECTORY_PATH = `${BASE_SAVE_DIRECTORY}/${MANUAL_SAVES_SUBDIRECTORY}`; // Combined path
const MANUAL_SAVE_PATTERN = /^manual_save_.*\.sav$/; // Pattern to identify potential manual save files
// const TEMP_SAVE_SUFFIX = '.tmp'; // // Defined in writeFileAtomically in IStorageProvider context

/**
 * @implements {ISaveLoadService}
 */
class SaveLoadService extends ISaveLoadService {
  #logger;
  #storageProvider;
  #serializer;

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
  }) {
    // <<< MODIFIED SIGNATURE with destructuring
    super();
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
    });
    this.#storageProvider = storageProvider;
    this.#serializer =
      gameStateSerializer || new GameStateSerializer({ logger, crypto });
    this.#logger.debug('SaveLoadService initialized.');
  }

  /**
   * Reads the save file from storage provider.
   *
   * @param {string} filePath - Path to the save file.
   * @returns {Promise<{success: boolean, data?: Uint8Array, error?: PersistenceError, userFriendlyError?: string}>} Outcome of the read.
   * @private
   */
  async #readSaveFile(filePath) {
    try {
      const fileContent = await this.#storageProvider.readFile(filePath);
      if (!fileContent || fileContent.byteLength === 0) {
        const userMsg =
          'The selected save file is empty or cannot be read. It might be corrupted or inaccessible.';
        this.#logger.warn(
          `File is empty or could not be read: ${filePath}. User message: "${userMsg}"`
        );
        return {
          success: false,
          error: new PersistenceError(
            PersistenceErrorCodes.EMPTY_FILE,
            userMsg
          ),
          userFriendlyError: userMsg,
        };
      }
      return { success: true, data: fileContent };
    } catch (error) {
      const userMsg =
        'Could not access or read the selected save file. Please check file permissions or try another save.';
      this.#logger.error(`Error reading file ${filePath}:`, error);
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.FILE_READ_ERROR,
          userMsg
        ),
        userFriendlyError: userMsg,
      };
    }
  }

  /**
   * Reads a save file, decompresses Gzip, and deserializes from MessagePack.
   * Implements basic failure handling as per SL-T2.4.
   *
   * @param {string} filePath - The path to the save file.
   * @returns {Promise<{success: boolean, data?: object, error?: PersistenceError, userFriendlyError?: string}>} Resulting object or error info.
   * @private
   */
  async #deserializeAndDecompress(filePath) {
    this.#logger.debug(`Attempting to read and deserialize file: ${filePath}`);

    const readRes = await this.#readSaveFile(filePath);
    if (!readRes.success) return readRes;

    const decompressRes = this.#serializer.decompress(readRes.data);
    if (!decompressRes.success) return decompressRes;

    const deserializeRes = this.#serializer.deserialize(decompressRes.data);
    if (!deserializeRes.success) return deserializeRes;

    return { success: true, data: deserializeRes.data };
  }

  /**
   * Builds the full path for a manual save file.
   *
   * @param {string} fileName - File name inside the manual saves directory.
   * @returns {string} The fully-qualified path for the file.
   * @private
   */
  #manualSavePath(fileName) {
    return `${FULL_MANUAL_SAVE_DIRECTORY_PATH}/${fileName}`;
  }

  /**
   * Attempts to parse a manual save file and extract its metadata.
   *
   * @param {string} fileName - The file name within the manual saves directory.
   * @returns {Promise<{success: boolean, metadata: SaveFileMetadata}>}
   *   Parsing outcome and extracted (or fallback) metadata.
   * @private
   */
  async #parseManualSaveFile(fileName) {
    const filePath = this.#manualSavePath(fileName);
    this.#logger.debug(`Processing file: ${filePath}`);

    const deserializationResult =
      await this.#deserializeAndDecompress(filePath);

    if (!deserializationResult.success) {
      this.#logger.warn(
        `Failed to deserialize ${filePath}: ${deserializationResult.error}. Flagging as corrupted for listing.`
      );
      return {
        success: false,
        metadata: {
          identifier: filePath,
          saveName:
            fileName.replace(/\.sav$/, '').replace(/^manual_save_/, '') +
            ' (Corrupted)',
          timestamp: 'N/A',
          playtimeSeconds: 0,
          isCorrupted: true,
        },
      };
    }

    const saveObject = /** @type {SaveGameStructure | undefined} */ (
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
        metadata: {
          identifier: filePath,
          saveName:
            fileName.replace(/\.sav$/, '').replace(/^manual_save_/, '') +
            ' (No Metadata)',
          timestamp: 'N/A',
          playtimeSeconds: 0,
          isCorrupted: true,
        },
      };
    }

    return {
      success: true,
      metadata: {
        identifier: filePath,
        saveName: saveObject.metadata.saveName,
        timestamp: saveObject.metadata.timestamp,
        playtimeSeconds: saveObject.metadata.playtimeSeconds,
      },
    };
  }

  /**
   * Validates that a loaded save object contains required sections and that the
   * stored checksum matches the recalculated checksum.
   *
   * @param {SaveGameStructure} obj - The deserialized save object.
   * @param {string} identifier - Identifier used for logging.
   * @returns {Promise<{success: boolean, error?: PersistenceError}>} Result.
   * @private
   */
  async #validateLoadedSaveObject(obj, identifier) {
    const requiredSections = [
      'metadata',
      'modManifest',
      'gameState',
      'integrityChecks',
    ];
    for (const section of requiredSections) {
      if (
        !(section in obj) ||
        typeof obj[section] !== 'object' ||
        obj[section] === null
      ) {
        const devMsg = `Save file ${identifier} is missing or has invalid section: '${section}'.`;
        const userMsg =
          'The save file is incomplete or has an unknown format. It might be corrupted or from an incompatible game version.';
        this.#logger.error(devMsg + ` User message: "${userMsg}"`);
        return {
          success: false,
          error: new PersistenceError(
            PersistenceErrorCodes.INVALID_GAME_STATE,
            userMsg
          ),
        };
      }
    }
    this.#logger.debug(
      `Basic structure validation passed for ${identifier}. All required sections present.`
    );

    const storedChecksum = obj.integrityChecks.gameStateChecksum;
    if (!storedChecksum || typeof storedChecksum !== 'string') {
      const devMsg = `Save file ${identifier} is missing gameStateChecksum.`;
      const userMsg =
        'The save file is missing integrity information and cannot be safely loaded. It might be corrupted or from an incompatible older version.';
      this.#logger.error(devMsg + ` User message: "${userMsg}"`);
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.INVALID_GAME_STATE,
          userMsg
        ),
      };
    }

    let recalculatedChecksum;
    try {
      const gameStateMessagePack = encode(obj.gameState);
      recalculatedChecksum =
        await this.#serializer.generateChecksum(gameStateMessagePack);
    } catch (checksumError) {
      const devMsg = `Error calculating checksum for gameState in ${identifier}: ${checksumError.message}.`;
      const userMsg =
        'Could not verify the integrity of the save file due to an internal error. The file might be corrupted.';
      this.#logger.error(devMsg + ` User message: "${userMsg}"`, checksumError);
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.CHECKSUM_CALCULATION_ERROR,
          userMsg
        ),
      };
    }

    if (storedChecksum !== recalculatedChecksum) {
      const devMsg = `Checksum mismatch for ${identifier}. Stored: ${storedChecksum}, Calculated: ${recalculatedChecksum}.`;
      const userMsg =
        'The save file appears to be corrupted (integrity check failed). Please try another save or a backup.';
      this.#logger.error(devMsg + ` User message: "${userMsg}"`);
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.CHECKSUM_MISMATCH,
          userMsg
        ),
      };
    }
    this.#logger.debug(`Checksum VERIFIED for ${identifier}.`);

    return { success: true };
  }

  /**
   * @inheritdoc
   * @returns {Promise<Array<SaveFileMetadata>>} Parsed metadata entries.
   */
  async listManualSaveSlots() {
    this.#logger.debug(
      `Listing manual save slots from ${FULL_MANUAL_SAVE_DIRECTORY_PATH}...`
    );
    const collectedMetadata = [];

    let files;
    try {
      // Ensure the base 'saves' directory and 'manual_saves' subdirectory exist
      // Some storage providers might require directories to be explicitly created or
      // handle it gracefully. Assuming listFiles can target nested paths.
      // If IStorageProvider.ensureDirectoryExists is available, it could be called here:
      // await this.#storageProvider.ensureDirectoryExists(FULL_MANUAL_SAVE_DIRECTORY_PATH);

      files = await this.#storageProvider.listFiles(
        FULL_MANUAL_SAVE_DIRECTORY_PATH,
        MANUAL_SAVE_PATTERN.source
      );
      this.#logger.debug(
        `Found ${files.length} potential manual save files in ${FULL_MANUAL_SAVE_DIRECTORY_PATH}.`
      );
    } catch (listError) {
      // Check if the error is because the directory doesn't exist
      if (
        listError.message &&
        listError.message.toLowerCase().includes('not found')
      ) {
        // Example check
        this.#logger.debug(
          `${FULL_MANUAL_SAVE_DIRECTORY_PATH} not found. Assuming no manual saves yet.`
        );
        return []; // No directory means no saves
      }
      this.#logger.error(
        `Error listing files in ${FULL_MANUAL_SAVE_DIRECTORY_PATH}:`,
        listError
      );
      return [];
    }

    for (const fileName of files) {
      const { success, metadata } = await this.#parseManualSaveFile(fileName);

      if (!success) {
        collectedMetadata.push(metadata);
        continue;
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
        collectedMetadata.push({
          identifier,
          saveName:
            saveName ||
            fileName.replace(/\.sav$/, '').replace(/^manual_save_/, '') +
              ' (Bad Metadata)',
          timestamp: timestamp || 'N/A',
          playtimeSeconds:
            typeof playtimeSeconds === 'number' ? playtimeSeconds : 0,
          isCorrupted: true,
        });
        continue;
      }

      collectedMetadata.push(metadata);
      this.#logger.debug(
        `Successfully parsed metadata for ${identifier}: Name="${saveName}", Timestamp="${timestamp}"`
      );
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

    if (!validateSaveIdentifier(saveIdentifier)) {
      const errorMsg = 'Invalid saveIdentifier provided for loading.';
      const userMsg = 'Cannot load game: No save file was specified.';
      this.#logger.error(errorMsg);
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.INVALID_SAVE_IDENTIFIER,
          userMsg
        ),
        data: null,
      };
    }

    // saveIdentifier is expected to be the full path including "saves/manual_saves/"
    const deserializationResult =
      await this.#deserializeAndDecompress(saveIdentifier);

    if (!deserializationResult.success || !deserializationResult.data) {
      this.#logger.warn(
        `Failed to deserialize ${saveIdentifier}: ${deserializationResult.error}`
      );
      return {
        success: false,
        error:
          deserializationResult.error instanceof PersistenceError
            ? deserializationResult.error
            : new PersistenceError(
                PersistenceErrorCodes.DESERIALIZATION_ERROR,
                deserializationResult.userFriendlyError ||
                  'Unknown deserialization error'
              ),
        data: null,
      };
    }

    const loadedObject = /** @type {SaveGameStructure} */ (
      deserializationResult.data
    );

    const validationResult = await this.#validateLoadedSaveObject(
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
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.INVALID_SAVE_NAME,
          userMsg
        ),
      };
    }

    const fileName = `manual_save_${saveName.replace(/[^a-zA-Z0-9_-]/g, '_')}.sav`;
    // Ensure the directory structure exists before writing.
    // Some IStorageProvider implementations might handle this in writeFileAtomically,
    // others might need an explicit ensureDirectoryExists call.
    // Example: await this.#storageProvider.ensureDirectoryExists(FULL_MANUAL_SAVE_DIRECTORY_PATH);
    const filePath = this.#manualSavePath(fileName);

    try {
      // Potentially create the directory if it doesn't exist.
      // This is important for the first save.
      // Check if storageProvider has a method like ensureDirectoryExists
      if (typeof this.#storageProvider.ensureDirectoryExists === 'function') {
        try {
          await this.#storageProvider.ensureDirectoryExists(
            FULL_MANUAL_SAVE_DIRECTORY_PATH
          );
          this.#logger.debug(
            `Ensured directory exists: ${FULL_MANUAL_SAVE_DIRECTORY_PATH}`
          );
        } catch (dirError) {
          this.#logger.error(
            `Failed to ensure directory ${FULL_MANUAL_SAVE_DIRECTORY_PATH} exists:`,
            dirError
          );
          return {
            success: false,
            error: new PersistenceError(
              PersistenceErrorCodes.DIRECTORY_CREATION_FAILED,
              `Failed to create save directory: ${dirError.message}`
            ),
          };
        }
      }

      let mutableGameState;
      try {
        mutableGameState = deepClone(gameStateObject);
      } catch (e) {
        this.#logger.error('DeepClone failed:', e);
        throw new PersistenceError(
          PersistenceErrorCodes.DEEP_CLONE_FAILED,
          'Failed to deep clone object for saving.'
        );
      }

      if (!mutableGameState.metadata) mutableGameState.metadata = {};
      mutableGameState.metadata.saveName = saveName;

      if (!mutableGameState.integrityChecks)
        mutableGameState.integrityChecks = {};

      const { compressedData } =
        await this.#serializer.serializeAndCompress(mutableGameState);

      const writeResult = await this.#storageProvider.writeFileAtomically(
        filePath,
        compressedData
      );

      if (writeResult.success) {
        this.#logger.debug(
          `Manual game "${saveName}" saved successfully to ${filePath}.`
        );
        return {
          success: true,
          message: `Game saved as "${saveName}".`,
          filePath: filePath,
        };
      } else {
        this.#logger.error(
          `Failed to write manual save "${saveName}" to ${filePath}: ${writeResult.error}`
        );
        let userError = `Failed to save game: ${writeResult.error}`;
        if (
          writeResult.error &&
          writeResult.error.toLowerCase().includes('disk full')
        ) {
          userError = 'Failed to save game: Not enough disk space.';
        }
        return {
          success: false,
          error: new PersistenceError(
            PersistenceErrorCodes.WRITE_ERROR,
            userError
          ),
        };
      }
    } catch (error) {
      this.#logger.error(
        `Error during manual save process for "${saveName}":`,
        error
      );
      return {
        success: false,
        error:
          error instanceof PersistenceError
            ? error
            : new PersistenceError(
                PersistenceErrorCodes.UNEXPECTED_ERROR,
                `An unexpected error occurred while saving: ${error.message}`
              ),
      };
    }
  }

  /**
   * @inheritdoc
   * @param {string} saveIdentifier - The full path to the save file to delete (e.g., "saves/manual_saves/my_save.sav").
   */
  async deleteManualSave(saveIdentifier) {
    this.#logger.debug(`Attempting to delete manual save: "${saveIdentifier}"`);
    if (!validateSaveIdentifier(saveIdentifier)) {
      const msg = 'Invalid saveIdentifier provided for deletion.';
      const userMsg = 'Cannot delete: No save file specified.';
      this.#logger.error(msg);
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.INVALID_SAVE_IDENTIFIER,
          userMsg
        ),
      };
    }

    // saveIdentifier is expected to be the full path, e.g., "saves/manual_saves/file.sav"
    const filePath = saveIdentifier;

    try {
      const exists = await this.#storageProvider.fileExists(filePath);
      if (!exists) {
        const msg = `Save file "${filePath}" not found for deletion.`;
        const userMsg = 'Cannot delete: Save file not found.';
        this.#logger.warn(msg);
        return {
          success: false,
          error: new PersistenceError(
            PersistenceErrorCodes.DELETE_FILE_NOT_FOUND,
            userMsg
          ),
        };
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
        : {
            success: false,
            error: new PersistenceError(
              PersistenceErrorCodes.DELETE_FAILED,
              deleteResult.error || 'Unknown delete error'
            ),
          };
    } catch (error) {
      this.#logger.error(
        `Error during manual save deletion process for "${filePath}":`,
        error
      );
      return {
        success: false,
        error:
          error instanceof PersistenceError
            ? error
            : new PersistenceError(
                PersistenceErrorCodes.UNEXPECTED_ERROR,
                `An unexpected error occurred during deletion: ${error.message}`
              ),
      };
    }
  }
}

export default SaveLoadService;
