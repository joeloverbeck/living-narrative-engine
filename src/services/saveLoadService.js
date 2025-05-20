// src/services/saveLoadService.js

import {ISaveLoadService} from '../interfaces/ISaveLoadService.js';
import {encode, decode} from '@msgpack/msgpack'; // [cite: 748, 753, 804]
import pako from 'pako'; // [cite: 748, 753, 822]
import {createHash} from 'crypto';

// --- Type Imports ---
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IStorageProvider.js').IStorageProvider} IStorageProvider */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveFileMetadata} SaveFileMetadata */
/** @typedef {import('../interfaces/ISaveLoadService.js').LoadGameResult} LoadGameResult */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */


// --- Constants ---
// const MAX_MANUAL_SAVES = 10; // Not directly enforced by list/load, but by save UI/logic [cite: 153, 165]
const MANUAL_SAVE_DIR = 'manual_saves';
const MANUAL_SAVE_PATTERN = /^manual_save_.*\.sav$/; // Pattern to identify potential manual save files [cite: 105]
// const TEMP_SAVE_SUFFIX = '.tmp'; // [cite: 221] // Defined in writeFileAtomically in IStorageProvider context

/**
 * @implements {ISaveLoadService}
 */
class SaveLoadService extends ISaveLoadService {
    /** @private @type {ILogger} */
    #logger;
    /** @private @type {IStorageProvider} */
    #storageProvider;

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
        // For consistency with how it's likely generated if not Uint8Array (e.g. if gameState was JSON before MessagePack)
        // However, for gameStateChecksum, it's specifically calculated on the MessagePack bytes of gameState.
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

        if (!finalSaveObject.gameState || typeof finalSaveObject.gameState !== 'object') {
            this.#logger.error('Invalid or missing gameState property in save object for checksum calculation.');
            throw new Error('Invalid gameState for checksum calculation.');
        }
        // Calculate checksum on the MessagePack representation of ONLY the gameState section [cite: 515]
        const gameStateMessagePack = encode(finalSaveObject.gameState);
        finalSaveObject.integrityChecks.gameStateChecksum = this.#generateChecksum(gameStateMessagePack); // [cite: 515, 660, 956]
        this.#logger.info(`Calculated gameStateChecksum: ${finalSaveObject.integrityChecks.gameStateChecksum}`);

        this.#logger.debug('Serializing full game state object to MessagePack...');
        const messagePackData = encode(finalSaveObject); // [cite: 434, 753]
        this.#logger.info(`MessagePack Raw Size: ${messagePackData.byteLength} bytes`);

        this.#logger.debug('Compressing MessagePack data with Gzip...');
        const compressedData = pako.gzip(messagePackData); // [cite: 444, 753]
        this.#logger.info(`Gzipped Size: ${compressedData.byteLength} bytes`);

        return {compressedData, finalSaveObject};
    }

    /**
     * Reads a save file, decompresses Gzip, and deserializes from MessagePack.
     * Implements basic failure handling as per SL-T2.4.
     * @param {string} filePath - The path to the save file.
     * @returns {Promise<{success: boolean, data?: object, error?: string, userFriendlyError?: string}>}
     * @private
     */
    async #deserializeAndDecompress(filePath) { // [cite: 115]
        this.#logger.debug(`Attempting to read and deserialize file: ${filePath}`);
        let fileContent;
        try {
            fileContent = await this.#storageProvider.readFile(filePath); // [cite: 117]
            if (!fileContent || fileContent.byteLength === 0) { // Basic integrity check: file size too small [cite: 141]
                const userMsg = "The selected save file is empty or cannot be read. It might be corrupted or inaccessible."; // [cite: 144]
                this.#logger.warn(`File is empty or could not be read: ${filePath}. User message: "${userMsg}"`);
                return {success: false, error: 'File is empty or unreadable.', userFriendlyError: userMsg}; // [cite: 139, 140]
            }
        } catch (readError) {
            const userMsg = "Could not access or read the selected save file. Please check file permissions or try another save."; // [cite: 140, 144]
            this.#logger.error(`Error reading file ${filePath}:`, readError);
            return {success: false, error: `File read error: ${readError.message}`, userFriendlyError: userMsg}; // [cite: 139]
        }

        let decompressedData;
        try {
            decompressedData = pako.ungzip(fileContent); // [cite: 444]
            this.#logger.debug(`Decompressed data size for ${filePath}: ${decompressedData.byteLength} bytes`);
        } catch (gzipError) {
            const userMsg = "The save file appears to be corrupted (could not decompress). Please try another save."; // [cite: 120, 144]
            this.#logger.error(`Gzip decompression failed for ${filePath}:`, gzipError);
            return {
                success: false,
                error: `Gzip decompression error: ${gzipError.message}`,
                userFriendlyError: userMsg
            };
        }

        let deserializedObject;
        try {
            deserializedObject = decode(decompressedData); // [cite: 434, 118]
            this.#logger.debug(`Successfully deserialized MessagePack for ${filePath}`);
        } catch (msgpackError) {
            const userMsg = "The save file appears to be corrupted (could not understand file content). Please try another save."; // [cite: 120, 144]
            this.#logger.error(`MessagePack deserialization failed for ${filePath}:`, msgpackError);
            return {
                success: false,
                error: `MessagePack deserialization error: ${msgpackError.message}`,
                userFriendlyError: userMsg
            };
        }

        return {success: true, data: deserializedObject};
    }


    /**
     * @inheritdoc
     * @returns {Promise<Array<SaveFileMetadata>>}
     */
    async listManualSaveSlots() {
        this.#logger.info('Listing manual save slots...');
        const collectedMetadata = [];

        let files;
        try {
            files = await this.#storageProvider.listFiles(MANUAL_SAVE_DIR, MANUAL_SAVE_PATTERN.source); // [cite: 105]
            this.#logger.info(`Found ${files.length} potential manual save files in ${MANUAL_SAVE_DIR}.`);
        } catch (listError) {
            this.#logger.error(`Error listing files in ${MANUAL_SAVE_DIR}:`, listError);
            // UI should be able to indicate that listing failed, though this ticket focuses on load.
            return [];
        }

        for (const fileName of files) {
            const filePath = `${MANUAL_SAVE_DIR}/${fileName}`;
            this.#logger.debug(`Processing file: ${filePath}`);

            // For listing, we might not need full userFriendlyError, just flag as corrupted.
            // The full error handling is more critical for `loadGameData`.
            const deserializationResult = await this.#deserializeAndDecompress(filePath);

            if (!deserializationResult.success) {
                this.#logger.warn(`Failed to deserialize ${filePath}: ${deserializationResult.error}. Flagging as corrupted for listing.`);
                collectedMetadata.push({
                    identifier: filePath,
                    saveName: fileName.replace(/\.sav$/, '').replace(/^manual_save_/, '') + ' (Corrupted)',
                    timestamp: 'N/A',
                    playtimeSeconds: 0,
                    isCorrupted: true, // [cite: 109]
                });
                continue;
            }

            const saveObject = /** @type {SaveGameStructure | undefined} */ (deserializationResult.data);

            if (!saveObject || typeof saveObject.metadata !== 'object' || saveObject.metadata === null) { // [cite: 109]
                this.#logger.warn(`No metadata section found in ${filePath}. Flagging as corrupted for listing.`);
                collectedMetadata.push({
                    identifier: filePath,
                    saveName: fileName.replace(/\.sav$/, '').replace(/^manual_save_/, '') + ' (No Metadata)',
                    timestamp: 'N/A',
                    playtimeSeconds: 0,
                    isCorrupted: true,
                });
                continue;
            }

            const {saveName, timestamp, playtimeSeconds} = saveObject.metadata;

            if (typeof saveName !== 'string' || !saveName ||
                typeof timestamp !== 'string' || !timestamp ||
                typeof playtimeSeconds !== 'number' || isNaN(playtimeSeconds)) { // [cite: 106, 109]
                this.#logger.warn(`Essential metadata missing or malformed in ${filePath}. Contents: ${JSON.stringify(saveObject.metadata)}. Flagging as corrupted for listing.`);
                collectedMetadata.push({
                    identifier: filePath,
                    saveName: saveName || fileName.replace(/\.sav$/, '').replace(/^manual_save_/, '') + ' (Bad Metadata)',
                    timestamp: timestamp || 'N/A',
                    playtimeSeconds: typeof playtimeSeconds === 'number' ? playtimeSeconds : 0,
                    isCorrupted: true,
                });
                continue;
            }

            collectedMetadata.push({ // [cite: 107]
                identifier: filePath,
                saveName: saveName,
                timestamp: timestamp,
                playtimeSeconds: playtimeSeconds,
            });
            this.#logger.info(`Successfully parsed metadata for ${filePath}: Name="${saveName}", Timestamp="${timestamp}"`);
        }

        this.#logger.info(`Finished listing manual save slots. Returning ${collectedMetadata.length} items.`); // [cite: 108]
        return collectedMetadata;
    }

    /**
     * @inheritdoc
     * @param {string} saveIdentifier - The full path or unique ID of the save file to load.
     * @returns {Promise<LoadGameResult>}
     */
    async loadGameData(saveIdentifier) { // [cite: 115]
        this.#logger.info(`Attempting to load game data from: "${saveIdentifier}"`);

        if (!saveIdentifier || typeof saveIdentifier !== 'string' || saveIdentifier.trim() === '') {
            const errorMsg = 'Invalid saveIdentifier provided for loading.';
            const userMsg = "Cannot load game: No save file was specified."; // [cite: 144]
            this.#logger.error(errorMsg);
            return {success: false, error: userMsg, data: null}; //
        }

        // 1. Read and deserialize the file content (includes basic I/O and format checks)
        const deserializationResult = await this.#deserializeAndDecompress(saveIdentifier); // [cite: 117, 118]

        if (!deserializationResult.success || !deserializationResult.data) {
            this.#logger.warn(`Failed to deserialize ${saveIdentifier}: ${deserializationResult.error}`);
            // Return the user-friendly error from #deserializeAndDecompress
            return {
                success: false,
                error: deserializationResult.userFriendlyError || 'Unknown deserialization error',
                data: null
            }; // [cite: 139, 140, 142, 144]
        }

        const loadedObject = /** @type {SaveGameStructure} */ (deserializationResult.data);

        // 2. Basic Structure Validation (Integrity Check before full deserialization of gameState)
        // Check for the presence of key sections as defined in PRD Table 3 / Tech Spike V.C. [cite: 484, 933]
        const requiredSections = ['metadata', 'modManifest', 'gameState', 'integrityChecks'];
        for (const section of requiredSections) {
            if (!(section in loadedObject) || typeof loadedObject[section] !== 'object' || loadedObject[section] === null) {
                const devMsg = `Save file ${saveIdentifier} is missing or has invalid section: '${section}'.`;
                const userMsg = "The save file is incomplete or has an unknown format. It might be corrupted or from an incompatible game version."; // [cite: 141, 144]
                this.#logger.error(devMsg + ` User message: "${userMsg}"`);
                return {success: false, error: userMsg, data: null}; // [cite: 120, 142]
            }
        }
        this.#logger.debug(`Basic structure validation passed for ${saveIdentifier}. All required sections present.`);

        // 3. Integrity Check: Verify gameStateChecksum [cite: 244, 516, 660, 956]
        // This is a more specific integrity check after the basic structure is confirmed. SL-E04 will handle more advanced corruption.
        const storedChecksum = loadedObject.integrityChecks.gameStateChecksum;
        if (!storedChecksum || typeof storedChecksum !== 'string') {
            const devMsg = `Save file ${saveIdentifier} is missing gameStateChecksum.`;
            const userMsg = "The save file is missing integrity information and cannot be safely loaded. It might be corrupted or from an incompatible older version."; // [cite: 141, 144]
            this.#logger.error(devMsg + ` User message: "${userMsg}"`);
            return {success: false, error: userMsg, data: null}; // [cite: 246, 142]
        }

        let recalculatedChecksum;
        try {
            // The checksum is calculated on the MessagePack representation of the gameState object.
            const gameStateMessagePack = encode(loadedObject.gameState); // [cite: 119] implicitly tests if gameState is serializable
            recalculatedChecksum = this.#generateChecksum(gameStateMessagePack);
        } catch (checksumError) {
            const devMsg = `Error calculating checksum for gameState in ${saveIdentifier}: ${checksumError.message}.`;
            const userMsg = "Could not verify the integrity of the save file due to an internal error. The file might be corrupted."; // [cite: 144]
            this.#logger.error(devMsg + ` User message: "${userMsg}"`, checksumError);
            return {success: false, error: userMsg, data: null}; // [cite: 120, 142]
        }


        if (storedChecksum !== recalculatedChecksum) {
            const devMsg = `Checksum mismatch for ${saveIdentifier}. Stored: ${storedChecksum}, Calculated: ${recalculatedChecksum}.`;
            const userMsg = "The save file appears to be corrupted (integrity check failed). Please try another save or a backup."; // [cite: 141, 144]
            this.#logger.error(devMsg + ` User message: "${userMsg}"`);
            return {success: false, error: userMsg, data: null}; // [cite: 245, 246, 142]
        }
        this.#logger.info(`Checksum VERIFIED for ${saveIdentifier}.`);

        // Performance: Deserialization performance is primarily dependent on MessagePack library & Gzip library efficiency. [cite: 121]
        // These are generally fast. Explicit profiling would be part of a broader performance optimization task.

        // All checks passed
        this.#logger.info(`Game data loaded and validated successfully from: "${saveIdentifier}"`);
        return {success: true, data: loadedObject, error: null}; // [cite: 118]
    }


    /**
     * @inheritdoc
     */
    async saveManualGame(saveName, gameStateObject) {
        this.#logger.info(`Attempting to save manual game: "${saveName}"`);

        if (!saveName || typeof saveName !== 'string' || saveName.trim() === '') {
            const userMsg = "Invalid save name provided. Please enter a valid name.";
            this.#logger.error('Invalid saveName provided for manual save.');
            return {success: false, error: userMsg}; // [cite: 198] (implicitly)
        }

        const fileName = `manual_save_${saveName.replace(/[^a-zA-Z0-9_-]/g, '_')}.sav`;
        const filePath = `${MANUAL_SAVE_DIR}/${fileName}`;

        try {
            const mutableGameState = this.#deepClone(gameStateObject);

            if (!mutableGameState.metadata) mutableGameState.metadata = {};
            mutableGameState.metadata.saveName = saveName; // [cite: 495]

            if (!mutableGameState.integrityChecks) mutableGameState.integrityChecks = {};

            const {compressedData} = this.#serializeAndCompress(mutableGameState); // [cite: 434, 444]

            const writeResult = await this.#storageProvider.writeFileAtomically(filePath, compressedData); // [cite: 221, 222, 665]

            if (writeResult.success) {
                this.#logger.info(`Manual game "${saveName}" saved successfully to ${filePath}.`);
                return {success: true, message: `Game saved as "${saveName}".`, filePath: filePath}; // [cite: 197, 363]
            } else {
                this.#logger.error(`Failed to write manual save "${saveName}" to ${filePath}: ${writeResult.error}`);
                // Example of a more user-friendly message if a specific error was identifiable
                let userError = `Failed to save game: ${writeResult.error}`; // [cite: 198]
                if (writeResult.error && writeResult.error.toLowerCase().includes('disk full')) { // Hypothetical error check
                    userError = "Failed to save game: Not enough disk space."; // [cite: 265, 198]
                }
                return {success: false, error: userError}; // [cite: 363]
            }
        } catch (error) {
            this.#logger.error(`Error during manual save process for "${saveName}":`, error);
            return {success: false, error: `An unexpected error occurred while saving: ${error.message}`}; // [cite: 198, 363]
        }
    }

    /**
     * @inheritdoc
     */
    async deleteManualSave(saveIdentifier) {
        this.#logger.info(`Attempting to delete manual save: "${saveIdentifier}"`);
        if (!saveIdentifier || typeof saveIdentifier !== 'string' || saveIdentifier.trim() === '') {
            const msg = 'Invalid saveIdentifier provided for deletion.';
            const userMsg = "Cannot delete: No save file specified.";
            this.#logger.error(msg);
            return {success: false, error: userMsg};
        }

        const filePath = saveIdentifier;

        try {
            const exists = await this.#storageProvider.fileExists(filePath);
            if (!exists) {
                const msg = `Save file "${filePath}" not found for deletion.`;
                const userMsg = "Cannot delete: Save file not found.";
                this.#logger.warn(msg);
                return {success: false, error: userMsg};
            }

            const deleteResult = await this.#storageProvider.deleteFile(filePath);
            if (deleteResult.success) {
                this.#logger.info(`Manual save "${filePath}" deleted successfully.`);
                // UI will provide confirmation message
            } else {
                this.#logger.error(`Failed to delete manual save "${filePath}": ${deleteResult.error}`);
                // UI will provide error message
            }
            return deleteResult; // Propagate result, UI handles user message based on success/error
        } catch (error) {
            this.#logger.error(`Error during manual save deletion process for "${filePath}":`, error);
            return {success: false, error: `An unexpected error occurred during deletion: ${error.message}`};
        }
    }
}

export default SaveLoadService;