// src/interfaces/IGamePersistenceService.js

/**
 * @fileoverview Defines the interface for a game persistence service.
 * This interface decouples game engine logic from concrete persistence implementations.
 */

// --- JSDoc Type Imports ---
/** @typedef {import('../../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */

// --- Interface Specific Types ---

/**
 * @typedef {object} LoadAndRestoreResult
 * @property {boolean} success - Indicates whether the load and restore operation was successful.
 * @property {SaveGameStructure | null} [data] - The restored game data structure if successful, otherwise null.
 * @property {string} [error] - An error message if the operation failed.
 */

/**
 * @interface IGamePersistenceService
 * Defines the contract for services responsible for saving and loading game states.
 */
class IGamePersistenceService {
    /**
     * Saves the current game state.
     * @param {string} saveName - The desired name for the save file.
     * @param {boolean} isEngineInitialized - Indicates if the game engine is fully initialized.
     * @returns {Promise<{success: boolean, message?: string, error?: string, filePath?: string}>}
     * A promise that resolves with the outcome of the save operation, including success status,
     * an optional message, an optional error, and an optional file path.
     * @abstract
     */
    async saveGame(saveName, isEngineInitialized) {
        throw new Error('IGamePersistenceService.saveGame not implemented');
    }

    /**
     * Loads a game from the specified save identifier and restores the game state.
     * @param {string} saveIdentifier - The unique identifier of the save file to load (e.g., filename or path).
     * @returns {Promise<LoadAndRestoreResult>} A promise that resolves with the result of the load and restore operation.
     * @abstract
     */
    async loadAndRestoreGame(saveIdentifier) {
        throw new Error('IGamePersistenceService.loadAndRestoreGame not implemented');
    }

    /**
     * Checks if saving the game is currently allowed.
     * @param {boolean} isEngineInitialized - Indicates if the game engine is fully initialized.
     * @returns {boolean} True if saving is allowed, false otherwise.
     * @abstract
     */
    isSavingAllowed(isEngineInitialized) {
        throw new Error('IGamePersistenceService.isSavingAllowed not implemented');
    }
}

// Export the type definitions and the interface itself if needed for runtime checks (though interfaces are typically design-time).
// For JSDoc purposes, the definitions above are sufficient.
// If this was TypeScript, we'd export the interface and type. For JSDoc, often just defining them is enough.
// However, to allow GameEngine to import LoadAndRestoreResult:
export {IGamePersistenceService}; // Exporting the class for type checking / @implements
// LoadAndRestoreResult is a @typedef, it will be available for import in JSDoc.
