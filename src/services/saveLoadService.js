// src/services/saveLoadService.js

import {ISaveLoadService} from '../interfaces/ISaveLoadService.js';
import {encode} from '@msgpack/msgpack';
import pako from 'pako';
import {createHash} from 'crypto'; // Corrected import

// --- Type Imports ---
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IStorageProvider.js').IStorageProvider} IStorageProvider */

// --- Constants ---
const MAX_MANUAL_SAVES = 10; // [cite: 46, 53]
const MANUAL_SAVE_DIR = 'manual_saves'; // Conceptual directory
const MANUAL_SAVE_PATTERN = /^manual_save_.*\.sav$/; // Example pattern for listing
const TEMP_SAVE_SUFFIX = '.tmp';

/**
 * @implements {ISaveLoadService}
 */
class SaveLoadService extends ISaveLoadService {
    /** @private @type {ILogger} */
    #logger;
    /** @private @type {IStorageProvider} */
    #storageProvider; // Conceptual storage provider

    /**
     * Creates a new SaveLoadService instance.
     * @param {ILogger} logger - The logging service.
     * @param {IStorageProvider} storageProvider - The storage provider service.
     */
    constructor(logger, storageProvider) {
        super();
        if (!logger) throw new Error("SaveLoadService requires a valid ILogger instance.");
        if (!storageProvider) throw new Error("SaveLoadService requires a valid IStorageProvider instance.");
        this.#logger = logger;
        this.#storageProvider = storageProvider;
        this.#logger.info('SaveLoadService initialized.');
    }

    /**
     * Generates an SHA256 checksum for the given data.
     * For Uint8Array, it hashes directly. Otherwise, it stringifies to JSON.
     * @param {any} data - The data to hash.
     * @returns {string} The SHA256 hash as a hex string.
     * @private
     */
    #generateChecksum(data) {
        if (data instanceof Uint8Array) {
            return createHash('sha256').update(data).digest('hex');
        }
        const stringToHash = typeof data === 'string' ? data : JSON.stringify(data);
        return createHash('sha256').update(stringToHash).digest('hex');
    }

    /**
     * Deep clones an object using JSON stringify/parse.
     * Suitable for POJOs as used in the save game structure.
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
     * @param {object} gameStateObject - The full game state object to process.
     * @returns {{compressedData: Uint8Array, finalSaveObject: object}}
     * @private
     */
    #serializeAndCompress(gameStateObject) {
        const finalSaveObject = this.#deepClone(gameStateObject);

        // Calculate checksum for the gameState portion
        // Ensure gameState exists and is an object before encoding
        if (!finalSaveObject.gameState || typeof finalSaveObject.gameState !== 'object') {
            this.#logger.error('Invalid or missing gameState property in save object for checksum calculation.');
            throw new Error('Invalid gameState for checksum calculation.');
        }
        const gameStateMessagePack = encode(finalSaveObject.gameState);
        finalSaveObject.integrityChecks.gameStateChecksum = this.#generateChecksum(gameStateMessagePack); // [cite: 515]
        this.#logger.info(`Calculated gameStateChecksum: ${finalSaveObject.integrityChecks.gameStateChecksum}`);

        this.#logger.debug('Serializing full game state object to MessagePack...');
        const messagePackData = encode(finalSaveObject); // [cite: 434]
        this.#logger.info(`MessagePack Raw Size: ${messagePackData.byteLength} bytes`);

        this.#logger.debug('Compressing MessagePack data with Gzip...');
        const compressedData = pako.gzip(messagePackData); // [cite: 444]
        this.#logger.info(`Gzipped Size: ${compressedData.byteLength} bytes`);

        return {compressedData, finalSaveObject};
    }

    /**
     * @inheritdoc
     */
    async listManualSaveSlots() {
        try {
            // This is a conceptual implementation.
            // In a real scenario, this would interact with the file system or IndexedDB.
            const files = await this.#storageProvider.listFiles(MANUAL_SAVE_DIR, MANUAL_SAVE_PATTERN.source);
            this.#logger.info(`Found ${files.length} manual save slots.`);
            return files;
        } catch (error) {
            this.#logger.error('Error listing manual save slots:', error);
            return []; // Return empty on error to prevent blocking save functionality entirely
        }
    }

    /**
     * @inheritdoc
     */
    async saveManualGame(saveName, gameStateObject) { // [cite: 46]
        this.#logger.info(`Attempting to save manual game: "${saveName}"`);

        if (!saveName || typeof saveName !== 'string' || saveName.trim() === '') {
            this.#logger.error('Invalid saveName provided for manual save.');
            return {success: false, error: 'Invalid save name provided.'};
        }

        // For SL-T1.2, we assume a "new slot" context. Overwrite logic is more for SL-T1.4/UI.
        // The check for MAX_MANUAL_SAVES would typically happen before calling this,
        // or this function would need to know if it's an overwrite intent.
        // For now, let's assume this is a request to create or overwrite.
        // A full slot management (SL-T1.4) would handle if it's a *new* save and slots are full.

        const filePath = `${MANUAL_SAVE_DIR}/${saveName}.sav`; // Conceptual file path

        try {
            // 1. Prepare the final save object (cloning, adding checksum)
            const mutableGameState = this.#deepClone(gameStateObject);

            // Ensure metadata reflects the saveName for this specific save operation
            if (!mutableGameState.metadata) mutableGameState.metadata = {};
            mutableGameState.metadata.saveName = saveName; // [cite: 495]

            // Ensure integrityChecks object exists
            if (!mutableGameState.integrityChecks) mutableGameState.integrityChecks = {};

            // 2. Serialize and compress
            const {compressedData, finalSaveObject} = this.#serializeAndCompress(mutableGameState); // [cite: 52]

            // 3. Write to storage (atomically) [cite: 52]
            // The atomic write (SL-T4.1) is handled by the storage provider.
            const writeResult = await this.#storageProvider.writeFileAtomically(filePath, compressedData);

            if (writeResult.success) {
                this.#logger.info(`Manual game "${saveName}" saved successfully to ${filePath}.`);
                return {success: true, message: `Game saved as "${saveName}".`, filePath: filePath}; // [cite: 54]
            } else {
                this.#logger.error(`Failed to write manual save "${saveName}" to ${filePath}: ${writeResult.error}`);
                return {success: false, error: `Failed to write save file: ${writeResult.error}`}; // [cite: 54]
            }
        } catch (error) {
            this.#logger.error(`Error during manual save process for "${saveName}":`, error);
            return {success: false, error: `An unexpected error occurred: ${error.message}`}; // [cite: 54]
        }
    }
}

export default SaveLoadService;