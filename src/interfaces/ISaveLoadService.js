// src/interfaces/ISaveLoadService.js

/**
 * @interface ISaveLoadService
 * Defines the contract for a service that handles saving and loading game states.
 */
export class ISaveLoadService {
    /**
     * Saves the current game state to a specified manual save slot/name.
     * @param {string} saveName - The desired name for the save file (e.g., "Chapter1_End").
     * @param {object} gameStateObject - The complete game state object to be saved.
     * @returns {Promise<{success: boolean, message?: string, error?: string, filePath?: string}>} Feedback object.
     * @async
     */
    async saveManualGame(saveName, gameStateObject) {
        throw new Error("Not implemented");
    }

    /**
     * Lists available manual save files/metadata.
     * In a real implementation, this would return more detailed metadata.
     * For this ticket's scope, it might return just names or a count.
     * @returns {Promise<Array<string>>} A list of manual save identifiers.
     * @async
     */
    async listManualSaveSlots() {
        throw new Error("Not implemented");
    }

    // Future methods: loadGame, deleteSave, etc.
}