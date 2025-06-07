// src/services/saveLoadService.js

import { ISaveLoadService } from '../interfaces/ISaveLoadService.js';
import { encode, decode } from '@msgpack/msgpack'; //
import pako from 'pako'; //
// REMOVED: import {createHash} from 'crypto';

// --- Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IStorageProvider.js').IStorageProvider} IStorageProvider */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} SaveFileMetadata */
/** @typedef {import('../interfaces/ISaveLoadService.js').LoadGameResult} LoadGameResult */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */

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

  /**
   * Creates a new SaveLoadService instance.
   *
   * @param {object} dependencies - The dependencies object.
   * @param {ILogger} dependencies.logger - The logging service.
   * @param {IStorageProvider} dependencies.storageProvider - The storage provider service.
   */
  constructor({ logger, storageProvider }) {
    // <<< MODIFIED SIGNATURE with destructuring
    super();
    if (!logger)
      throw new Error(
        'SaveLoadService requires a valid ILogger instance (after destructuring).'
      );
    if (!storageProvider)
      throw new Error(
        'SaveLoadService requires a valid IStorageProvider instance (after destructuring).'
      );
    this.#logger = logger;
    this.#storageProvider = storageProvider;
    this.#logger.debug('SaveLoadService initialized.');
  }

  /**
   * Converts an ArrayBuffer to a hexadecimal string.
   *
   * @param {ArrayBuffer} buffer - The buffer to convert.
   * @returns {string} The hexadecimal string.
   * @private
   */
  #arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generates an SHA256 checksum for the given data using Web Crypto API.
   * For Uint8Array, it hashes directly. Otherwise, it stringifies to JSON then encodes to UTF-8.
   *
   * @param {any} data - The data to hash.
   * @returns {Promise<string>} The SHA256 hash as a hex string.
   * @private
   */
  async #generateChecksum(data) {
    let dataToHash;
    if (data instanceof Uint8Array) {
      dataToHash = data;
    } else {
      // For consistency with how it's likely generated if not Uint8Array
      // (e.g. if gameState was JSON before MessagePack)
      // However, for gameStateChecksum, it's specifically calculated on the MessagePack bytes of gameState.
      const stringToHash =
        typeof data === 'string' ? data : JSON.stringify(data);
      dataToHash = new TextEncoder().encode(stringToHash);
    }

    try {
      const hashBuffer = await window.crypto.subtle.digest(
        'SHA-256',
        dataToHash
      );
      return this.#arrayBufferToHex(hashBuffer);
    } catch (error) {
      this.#logger.error(
        'Error generating checksum using Web Crypto API:',
        error
      );
      throw new Error(`Checksum generation failed: ${error.message}`);
    }
  }

  /**
   * Deep clones an object using JSON stringify/parse.
   * Suitable for POJOs as used in the save game structure.
   *
   * @param {object} obj - The object to clone.
   * @returns {object} The cloned object.
   * @private
   */
  #deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      this.#logger.error('DeepClone failed:', e);
      throw new Error('Failed to deep clone object for saving.');
    }
  }

  /**
   * Serializes the game state to MessagePack and then compresses it with Gzip.
   * Calculates and embeds the gameStateChecksum before full serialization.
   * This method is now asynchronous due to #generateChecksum being async.
   *
   * @param {object} gameStateObject - The full game state object to process.
   * @returns {Promise<{compressedData: Uint8Array, finalSaveObject: object}>}
   * @private
   */
  async #serializeAndCompress(gameStateObject) {
    const finalSaveObject = this.#deepClone(gameStateObject);

    if (
      !finalSaveObject.gameState ||
      typeof finalSaveObject.gameState !== 'object'
    ) {
      this.#logger.error(
        'Invalid or missing gameState property in save object for checksum calculation.'
      );
      throw new Error('Invalid gameState for checksum calculation.');
    }
    // Calculate checksum on the MessagePack representation of ONLY the gameState section
    const gameStateMessagePack = encode(finalSaveObject.gameState);
    finalSaveObject.integrityChecks.gameStateChecksum =
      await this.#generateChecksum(gameStateMessagePack); //
    this.#logger.debug(
      `Calculated gameStateChecksum: ${finalSaveObject.integrityChecks.gameStateChecksum}`
    );

    this.#logger.debug('Serializing full game state object to MessagePack...');
    const messagePackData = encode(finalSaveObject); //
    this.#logger.debug(
      `MessagePack Raw Size: ${messagePackData.byteLength} bytes`
    );

    this.#logger.debug('Compressing MessagePack data with Gzip...');
    const compressedData = pako.gzip(messagePackData); //
    this.#logger.debug(`Gzipped Size: ${compressedData.byteLength} bytes`);

    return { compressedData, finalSaveObject };
  }

  /**
   * Reads a save file, decompresses Gzip, and deserializes from MessagePack.
   * Implements basic failure handling as per SL-T2.4.
   *
   * @param {string} filePath - The path to the save file.
   * @returns {Promise<{success: boolean, data?: object, error?: string, userFriendlyError?: string}>}
   * @private
   */
  async #deserializeAndDecompress(filePath) {
    //
    this.#logger.debug(`Attempting to read and deserialize file: ${filePath}`);
    let fileContent;
    try {
      fileContent = await this.#storageProvider.readFile(filePath); //
      if (!fileContent || fileContent.byteLength === 0) {
        // Basic integrity check: file size too small
        const userMsg =
          'The selected save file is empty or cannot be read. It might be corrupted or inaccessible.'; //
        this.#logger.warn(
          `File is empty or could not be read: ${filePath}. User message: "${userMsg}"`
        );
        return {
          success: false,
          error: 'File is empty or unreadable.',
          userFriendlyError: userMsg,
        }; //
      }
    } catch (readError) {
      const userMsg =
        'Could not access or read the selected save file. Please check file permissions or try another save.'; //
      this.#logger.error(`Error reading file ${filePath}:`, readError);
      return {
        success: false,
        error: `File read error: ${readError.message}`,
        userFriendlyError: userMsg,
      }; //
    }

    let decompressedData;
    try {
      decompressedData = pako.ungzip(fileContent); //
      this.#logger.debug(
        `Decompressed data size for ${filePath}: ${decompressedData.byteLength} bytes`
      );
    } catch (gzipError) {
      const userMsg =
        'The save file appears to be corrupted (could not decompress). Please try another save.'; //
      this.#logger.error(
        `Gzip decompression failed for ${filePath}:`,
        gzipError
      );
      return {
        success: false,
        error: `Gzip decompression error: ${gzipError.message}`,
        userFriendlyError: userMsg,
      };
    }

    let deserializedObject;
    try {
      deserializedObject = decode(decompressedData); //
      this.#logger.debug(
        `Successfully deserialized MessagePack for ${filePath}`
      );
    } catch (msgpackError) {
      const userMsg =
        'The save file appears to be corrupted (could not understand file content). Please try another save.'; //
      this.#logger.error(
        `MessagePack deserialization failed for ${filePath}:`,
        msgpackError
      );
      return {
        success: false,
        error: `MessagePack deserialization error: ${msgpackError.message}`,
        userFriendlyError: userMsg,
      };
    }

    return { success: true, data: deserializedObject };
  }

  /**
   * @inheritdoc
   * @returns {Promise<Array<SaveFileMetadata>>}
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
      const filePath = `${FULL_MANUAL_SAVE_DIRECTORY_PATH}/${fileName}`;
      this.#logger.debug(`Processing file: ${filePath}`);

      const deserializationResult =
        await this.#deserializeAndDecompress(filePath);

      if (!deserializationResult.success) {
        this.#logger.warn(
          `Failed to deserialize ${filePath}: ${deserializationResult.error}. Flagging as corrupted for listing.`
        );
        collectedMetadata.push({
          identifier: filePath, // identifier is now the full path
          saveName:
            fileName.replace(/\.sav$/, '').replace(/^manual_save_/, '') +
            ' (Corrupted)',
          timestamp: 'N/A',
          playtimeSeconds: 0,
          isCorrupted: true,
        });
        continue;
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
        collectedMetadata.push({
          identifier: filePath, // identifier is now the full path
          saveName:
            fileName.replace(/\.sav$/, '').replace(/^manual_save_/, '') +
            ' (No Metadata)',
          timestamp: 'N/A',
          playtimeSeconds: 0,
          isCorrupted: true,
        });
        continue;
      }

      const { saveName, timestamp, playtimeSeconds } = saveObject.metadata;

      if (
        typeof saveName !== 'string' ||
        !saveName ||
        typeof timestamp !== 'string' ||
        !timestamp ||
        typeof playtimeSeconds !== 'number' ||
        isNaN(playtimeSeconds)
      ) {
        this.#logger.warn(
          `Essential metadata missing or malformed in ${filePath}. Contents: ${JSON.stringify(saveObject.metadata)}. Flagging as corrupted for listing.`
        );
        collectedMetadata.push({
          identifier: filePath, // identifier is now the full path
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

      collectedMetadata.push({
        identifier: filePath, // identifier is now the full path
        saveName: saveName,
        timestamp: timestamp,
        playtimeSeconds: playtimeSeconds,
      });
      this.#logger.debug(
        `Successfully parsed metadata for ${filePath}: Name="${saveName}", Timestamp="${timestamp}"`
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
   * @returns {Promise<LoadGameResult>}
   */
  async loadGameData(saveIdentifier) {
    //
    this.#logger.debug(
      `Attempting to load game data from: "${saveIdentifier}"`
    );

    if (
      !saveIdentifier ||
      typeof saveIdentifier !== 'string' ||
      saveIdentifier.trim() === ''
    ) {
      const errorMsg = 'Invalid saveIdentifier provided for loading.';
      const userMsg = 'Cannot load game: No save file was specified.';
      this.#logger.error(errorMsg);
      return { success: false, error: userMsg, data: null };
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
          deserializationResult.userFriendlyError ||
          'Unknown deserialization error',
        data: null,
      };
    }

    const loadedObject = /** @type {SaveGameStructure} */ (
      deserializationResult.data
    );

    const requiredSections = [
      'metadata',
      'modManifest',
      'gameState',
      'integrityChecks',
    ];
    for (const section of requiredSections) {
      if (
        !(section in loadedObject) ||
        typeof loadedObject[section] !== 'object' ||
        loadedObject[section] === null
      ) {
        const devMsg = `Save file ${saveIdentifier} is missing or has invalid section: '${section}'.`;
        const userMsg =
          'The save file is incomplete or has an unknown format. It might be corrupted or from an incompatible game version.';
        this.#logger.error(devMsg + ` User message: "${userMsg}"`);
        return { success: false, error: userMsg, data: null };
      }
    }
    this.#logger.debug(
      `Basic structure validation passed for ${saveIdentifier}. All required sections present.`
    );

    const storedChecksum = loadedObject.integrityChecks.gameStateChecksum;
    if (!storedChecksum || typeof storedChecksum !== 'string') {
      const devMsg = `Save file ${saveIdentifier} is missing gameStateChecksum.`;
      const userMsg =
        'The save file is missing integrity information and cannot be safely loaded. It might be corrupted or from an incompatible older version.';
      this.#logger.error(devMsg + ` User message: "${userMsg}"`);
      return { success: false, error: userMsg, data: null };
    }

    let recalculatedChecksum;
    try {
      const gameStateMessagePack = encode(loadedObject.gameState);
      recalculatedChecksum = await this.#generateChecksum(gameStateMessagePack);
    } catch (checksumError) {
      const devMsg = `Error calculating checksum for gameState in ${saveIdentifier}: ${checksumError.message}.`;
      const userMsg =
        'Could not verify the integrity of the save file due to an internal error. The file might be corrupted.';
      this.#logger.error(devMsg + ` User message: "${userMsg}"`, checksumError);
      return { success: false, error: userMsg, data: null };
    }

    if (storedChecksum !== recalculatedChecksum) {
      const devMsg = `Checksum mismatch for ${saveIdentifier}. Stored: ${storedChecksum}, Calculated: ${recalculatedChecksum}.`;
      const userMsg =
        'The save file appears to be corrupted (integrity check failed). Please try another save or a backup.';
      this.#logger.error(devMsg + ` User message: "${userMsg}"`);
      return { success: false, error: userMsg, data: null };
    }
    this.#logger.debug(`Checksum VERIFIED for ${saveIdentifier}.`);

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

    if (!saveName || typeof saveName !== 'string' || saveName.trim() === '') {
      const userMsg = 'Invalid save name provided. Please enter a valid name.';
      this.#logger.error('Invalid saveName provided for manual save.');
      return { success: false, error: userMsg };
    }

    const fileName = `manual_save_${saveName.replace(/[^a-zA-Z0-9_-]/g, '_')}.sav`;
    // Ensure the directory structure exists before writing.
    // Some IStorageProvider implementations might handle this in writeFileAtomically,
    // others might need an explicit ensureDirectoryExists call.
    // Example: await this.#storageProvider.ensureDirectoryExists(FULL_MANUAL_SAVE_DIRECTORY_PATH);
    const filePath = `${FULL_MANUAL_SAVE_DIRECTORY_PATH}/${fileName}`;

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
            error: `Failed to create save directory: ${dirError.message}`,
          };
        }
      }

      const mutableGameState = this.#deepClone(gameStateObject);

      if (!mutableGameState.metadata) mutableGameState.metadata = {};
      mutableGameState.metadata.saveName = saveName;

      if (!mutableGameState.integrityChecks)
        mutableGameState.integrityChecks = {};

      const { compressedData } =
        await this.#serializeAndCompress(mutableGameState);

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
        return { success: false, error: userError };
      }
    } catch (error) {
      this.#logger.error(
        `Error during manual save process for "${saveName}":`,
        error
      );
      return {
        success: false,
        error: `An unexpected error occurred while saving: ${error.message}`,
      };
    }
  }

  /**
   * @inheritdoc
   * @param {string} saveIdentifier - The full path to the save file to delete (e.g., "saves/manual_saves/my_save.sav").
   */
  async deleteManualSave(saveIdentifier) {
    this.#logger.debug(`Attempting to delete manual save: "${saveIdentifier}"`);
    if (
      !saveIdentifier ||
      typeof saveIdentifier !== 'string' ||
      saveIdentifier.trim() === ''
    ) {
      const msg = 'Invalid saveIdentifier provided for deletion.';
      const userMsg = 'Cannot delete: No save file specified.';
      this.#logger.error(msg);
      return { success: false, error: userMsg };
    }

    // saveIdentifier is expected to be the full path, e.g., "saves/manual_saves/file.sav"
    const filePath = saveIdentifier;

    try {
      const exists = await this.#storageProvider.fileExists(filePath);
      if (!exists) {
        const msg = `Save file "${filePath}" not found for deletion.`;
        const userMsg = 'Cannot delete: Save file not found.';
        this.#logger.warn(msg);
        return { success: false, error: userMsg };
      }

      const deleteResult = await this.#storageProvider.deleteFile(filePath);
      if (deleteResult.success) {
        this.#logger.debug(`Manual save "${filePath}" deleted successfully.`);
      } else {
        this.#logger.error(
          `Failed to delete manual save "${filePath}": ${deleteResult.error}`
        );
      }
      return deleteResult;
    } catch (error) {
      this.#logger.error(
        `Error during manual save deletion process for "${filePath}":`,
        error
      );
      return {
        success: false,
        error: `An unexpected error occurred during deletion: ${error.message}`,
      };
    }
  }
}

export default SaveLoadService;
