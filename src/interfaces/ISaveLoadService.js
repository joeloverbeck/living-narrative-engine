// src/interfaces/ISaveLoadService.js

/**
 * @typedef {object} SaveFileMetadata
 * @property {string} identifier - The unique identifier for the save file (e.g., full filename like "manual_save_MySave.sav"). [cite: 105]
 * @property {string} saveName - User-defined name of the save, extracted from the save file's metadata. [cite: 104, 495]
 * @property {string} timestamp - ISO 8601 timestamp of when the save was created. [cite: 104, 493]
 * @property {number} playtimeSeconds - Total accumulated playtime in seconds up to the point of save. [cite: 104, 494]
 * @property {boolean} [isCorrupted] - Optional flag indicating if the file was found to be malformed or essential metadata was missing. [cite: 109]
 */

/**
 * @typedef {object} SaveGameStructure
 * @property {object} metadata - Contains information about the save file itself. [cite: 487, 934]
 * @property {string} metadata.saveFormatVersion - Version of the save file's own structural format. [cite: 488, 935]
 * @property {string} metadata.engineVersion - Version of the core game engine. [cite: 491, 936]
 * @property {string} metadata.gameTitle - Name of the game or world. [cite: 492, 937]
 * @property {string} metadata.timestamp - ISO 8601 timestamp of save creation. [cite: 493, 938]
 * @property {number} metadata.playtimeSeconds - Total accumulated playtime. [cite: 494, 939]
 * @property {string} metadata.saveName - User-defined name or internal slot identifier. [cite: 495, 940]
 * @property {string} [metadata.screenshotDataURI] - Optional base64 encoded screenshot. [cite: 496, 941]
 * @property {object} modManifest - Details the mod environment required for the save. [cite: 499, 942]
 * @property {Array<{modId: string, version: string, checksum?: string}>} modManifest.activeMods - List of active mods with their IDs, versions, and optional checksums. [cite: 500, 943]
 * @property {object} gameState - The core payload containing the dynamic state of the game. [cite: 504, 948]
 * @property {Array<object>} gameState.entities - Array of entity instances. [cite: 505, 949]
 * @property {object} gameState.playerState - Global player-specific data. [cite: 508, 952]
 * @property {object} gameState.worldState - Global world data. [cite: 509, 953]
 * @property {object} gameState.engineInternals - Engine-specific state. [cite: 511, 954]
 * @property {object} integrityChecks - Contains data for verifying save file integrity. [cite: 514, 956]
 * @property {string} integrityChecks.gameStateChecksum - Checksum of the serialized gameState section. [cite: 515, 956]
 */

/**
 * @typedef {object} LoadGameResult
 * @property {boolean} success - Whether the load operation was successful.
 * @property {SaveGameStructure} [data] - The loaded game state object, if successful.
 * @property {string} [error] - A user-friendly error message, if the operation failed. [cite: 144]
 */


/**
 * @interface ISaveLoadService
 * Defines the contract for a service that handles saving and loading game states.
 */
export class ISaveLoadService {
    /**
     * Saves the current game state to a specified manual save slot/name.
     * @param {string} saveName - The desired name for the save file (e.g., "Chapter1_End").
     * @param {object} gameStateObject - The complete game state object to be saved. This should conform to SaveGameStructure but without the checksum pre-calculated.
     * @returns {Promise<{success: boolean, message?: string, error?: string, filePath?: string}>} Feedback object.
     * @async
     */
    async saveManualGame(saveName, gameStateObject) {
        throw new Error("Not implemented");
    }

    /**
     * Lists available manual save files and their parsed metadata.
     * @returns {Promise<Array<SaveFileMetadata>>} A list of metadata objects for discovered manual save files.
     * @async
     */
    async listManualSaveSlots() {
        throw new Error("Not implemented");
    }

    /**
     * Loads game data from a specified save file identifier.
     * This method handles reading the file, decompression, deserialization, and basic integrity checks.
     * @param {string} saveIdentifier - The unique identifier for the save file (e.g., full file path).
     * @returns {Promise<LoadGameResult>} An object containing the success status, loaded data (if successful), or an error message.
     * @async
     */
    async loadGameData(saveIdentifier) { // [cite: 115]
        throw new Error("Not implemented");
    }

    /**
     * Deletes a manual save file.
     * @param {string} saveIdentifier - The identifier of the save file to delete (e.g., full filename or path).
     * @returns {Promise<{success: boolean, error?: string}>}
     * @async
     */
    async deleteManualSave(saveIdentifier) {
        throw new Error("Not implemented");
    }


    // Future methods for auto-saves, quick saves, etc.
}