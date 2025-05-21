// src/services/gamePersistenceService.js

import {IGamePersistenceService} from "../interfaces/IGamePersistenceService.js";

// --- JSDoc Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */
/** @typedef {import('../interfaces/ISaveLoadService.js').LoadGameResult} LoadGameResult */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('./playtimeTracker.js').default} PlaytimeTracker */ // Assuming this is the concrete type used internally, PlaytimeTracker interface is handled at injection point
/** @typedef {import('../core/config/appContainer.js').default} AppContainer */
/** @typedef {import('../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../core/services/worldLoader.js').default} WorldLoader */

// --- Interface Import for Implements ---
/** @typedef {import('../core/interfaces/IGamePersistenceService.js').IGamePersistenceService} IGamePersistenceService */
/** @typedef {import('../core/interfaces/IGamePersistenceService.js').LoadAndRestoreResult} LoadAndRestoreResult */


// --- Import Tokens ---
import {tokens} from '../config/tokens.js';

// Note: Assuming MissingDependencyError is a custom error. If not, a standard Error will be used.
// For now, we'll use a standard Error as MissingDependencyError is not defined in the provided context.

/**
 * Service responsible for orchestrating the capture and restoration of game state,
 * as well as interacting with the ISaveLoadService for file operations.
 * @implements {IGamePersistenceService}
 */
class GamePersistenceService extends IGamePersistenceService {
    /**
     * To store an ILogger instance.
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * To store an ISaveLoadService instance.
     * @private
     * @type {ISaveLoadService}
     */
    #saveLoadService;

    /**
     * To store an EntityManager instance.
     * @private
     * @type {EntityManager}
     */
    #entityManager;

    /**
     * To store an IDataRegistry instance.
     * @private
     * @type {IDataRegistry}
     */
    #dataRegistry;

    /**
     * To store a PlaytimeTracker instance.
     * @private
     * @type {PlaytimeTracker}
     */
    #playtimeTracker;

    /**
     * To store an AppContainer instance (for resolving other transient or less frequently used dependencies).
     * @private
     * @type {AppContainer}
     */
    #container;

    /**
     * Creates an instance of GamePersistenceService.
     * @param {object} dependencies - The dependencies for the service.
     * @param {ILogger} dependencies.logger - The logger service.
     * @param {ISaveLoadService} dependencies.saveLoadService - The save/load service.
     * @param {EntityManager} dependencies.entityManager - The entity manager.
     * @param {IDataRegistry} dependencies.dataRegistry - The data registry.
     * @param {PlaytimeTracker} dependencies.playtimeTracker - The playtime tracker.
     * @param {AppContainer} dependencies.container - The application container.
     * @throws {Error} If any required dependency is missing.
     */
    constructor({
                    logger,
                    saveLoadService,
                    entityManager,
                    dataRegistry,
                    playtimeTracker,
                    container
                }) {
        super();

        const missingDependencies = [];
        if (!logger) missingDependencies.push('logger');
        if (!saveLoadService) missingDependencies.push('saveLoadService');
        if (!entityManager) missingDependencies.push('entityManager');
        if (!dataRegistry) missingDependencies.push('dataRegistry');
        if (!playtimeTracker) missingDependencies.push('playtimeTracker');
        if (!container) missingDependencies.push('container');

        if (missingDependencies.length > 0) {
            const errorMessage = `GamePersistenceService: Fatal - Missing required dependencies: ${missingDependencies.join(', ')}.`;
            // Attempt to log if logger is available, otherwise console.error
            if (logger && typeof logger.error === 'function') {
                logger.error(errorMessage);
            } else {
                console.error(errorMessage);
            }
            throw new Error(errorMessage); // Using standard Error as MissingDependencyError is not defined.
        }

        this.#logger = logger;
        this.#saveLoadService = saveLoadService;
        this.#entityManager = entityManager;
        this.#dataRegistry = dataRegistry;
        this.#playtimeTracker = playtimeTracker;
        this.#container = container;

        this.#logger.info('GamePersistenceService: Instance created.');
    }

    /**
     * Deep clones an object using JSON stringify/parse.
     * Suitable for POJOs (Plain Old JavaScript Objects) as used in game state.
     * This method is primarily used for creating independent copies of component data
     * during state capture and restoration.
     *
     * Note: This method will not correctly clone complex objects containing Dates,
     * Maps, Sets, functions, undefined, or circular references. It is intended
     * for simple, serializable data structures.
     *
     * @param {any} obj - The object or value to clone. If not an object, it's returned as is.
     * @returns {any} The cloned object, or the original value if not an object or if cloning fails.
     * @throws {Error} If `JSON.stringify` fails on the object, indicating it's not suitable for this cloning method.
     * @private
     */
    #deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (e) {
            // Use the injected logger instance
            this.#logger.error('GamePersistenceService.#deepClone failed:', e, obj);
            throw new Error('Failed to deep clone object data.');
        }
    }

    /**
     * Captures the current, comprehensive game state into a structured object
     * conforming to the SaveGameStructure.
     * This method gathers data from various services and structures it appropriately.
     * @returns {SaveGameStructure} The structured game state object.
     * @throws {Error} If critical services like EntityManager or DataRegistry are unavailable at the time of calling,
     * or if resolving dependencies like ITurnManager or WorldLoader fails critically.
     */
    captureCurrentGameState() {
        this.#logger.info('GamePersistenceService: Capturing current game state...');

        if (!this.#entityManager) {
            this.#logger.error('GamePersistenceService.captureCurrentGameState: EntityManager is not available!');
            throw new Error('EntityManager not available for capturing game state.');
        }
        if (!this.#dataRegistry) {
            this.#logger.error('GamePersistenceService.captureCurrentGameState: DataRegistry is not available!');
            throw new Error('DataRegistry not available for capturing mod manifest.');
        }
        if (!this.#playtimeTracker) {
            this.#logger.error('GamePersistenceService.captureCurrentGameState: PlaytimeTracker is not available!');
            throw new Error('PlaytimeTracker not available for capturing game state.');
        }
        if (!this.#container) {
            this.#logger.error('GamePersistenceService.captureCurrentGameState: AppContainer is not available!');
            throw new Error('AppContainer not available for resolving dependencies.');
        }

        const entitiesData = [];
        for (const entity of this.#entityManager.activeEntities.values()) {
            const components = {};
            for (const [componentTypeId, componentData] of entity.componentEntries) {
                components[componentTypeId] = this.#deepClone(componentData);
            }
            entitiesData.push({
                instanceId: entity.id,
                definitionId: entity.definitionId || (this.#entityManager.getEntityDefinition?.(entity.id)?.id || 'unknown:definition'),
                components: components,
            });
        }
        this.#logger.debug(`GamePersistenceService: Captured ${entitiesData.length} entities.`);

        let activeModsManifest = [];
        if (typeof this.#dataRegistry.getLoadedModManifests === 'function') {
            activeModsManifest = this.#dataRegistry.getLoadedModManifests().map(mod => ({
                modId: mod.modId,
                version: mod.version,
            }));
            this.#logger.debug(`GamePersistenceService: Captured ${activeModsManifest.length} active mods from DataRegistry.`);
        } else {
            this.#logger.warn('GamePersistenceService: DataRegistry does not have getLoadedModManifests. Mod manifest in save may be incomplete or basic.');
            const coreModDef = this.#dataRegistry.getModDefinition?.('core');
            if (coreModDef) {
                activeModsManifest = [{modId: 'core', version: coreModDef.version || 'unknown'}];
            } else {
                activeModsManifest = [{modId: 'core', version: 'unknown_fallback'}];
            }
            this.#logger.debug('GamePersistenceService: Used fallback for mod manifest.');
        }

        let turnManager = null;
        let currentTurn = 0;
        try {
            turnManager = /** @type {ITurnManager} */ (this.#container.resolve(tokens.ITurnManager));
            currentTurn = turnManager?.currentTurn ?? 0;
        } catch (error) {
            this.#logger.warn('GamePersistenceService.captureCurrentGameState: Failed to resolve ITurnManager. Current turn will be default (0).', error);
        }

        let worldLoader = null;
        let currentWorldName = 'Unknown Game';
        try {
            worldLoader = /** @type {WorldLoader} */ (this.#container.resolve(tokens.WorldLoader));
            currentWorldName = worldLoader?.getActiveWorldName() || 'Unknown Game';
        } catch (error) {
            this.#logger.warn(`GamePersistenceService.captureCurrentGameState: Failed to resolve WorldLoader or get active world name. Using default ('${currentWorldName}').`, error);
        }

        const currentTotalPlaytime = this.#playtimeTracker.getTotalPlaytime();
        this.#logger.debug(`GamePersistenceService: Fetched total playtime: ${currentTotalPlaytime}s.`);

        const gameStateObject = {
            metadata: {
                saveFormatVersion: '1.0.0',
                engineVersion: '0.1.0-stub',
                gameTitle: currentWorldName,
                timestamp: new Date().toISOString(),
                playtimeSeconds: currentTotalPlaytime,
                saveName: '',
            },
            modManifest: {
                activeMods: activeModsManifest,
            },
            gameState: {
                entities: entitiesData,
                playerState: {},
                worldState: {},
                engineInternals: {
                    currentTurn: currentTurn,
                },
            },
            integrityChecks: {
                gameStateChecksum: 'PENDING_CALCULATION',
            },
        };

        this.#logger.info(`GamePersistenceService: Game state capture complete. ${entitiesData.length} entities captured. Playtime: ${currentTotalPlaytime}s. Current turn: ${currentTurn}.`);
        return gameStateObject;
    }

    /**
     * Determines if the game is currently in a state where saving is permissible.
     * @param {boolean} isEngineInitialized - Indicates whether the core game engine is initialized.
     * @returns {boolean} True if saving is allowed, false otherwise.
     */
    isSavingAllowed(isEngineInitialized) {
        if (!isEngineInitialized) {
            this.#logger.warn('GamePersistenceService.isSavingAllowed: Save attempt while engine not initialized.');
            return false;
        }
        // TODO: Implement actual logic to check if game is in a "non-critical moment".
        this.#logger.debug('GamePersistenceService.isSavingAllowed: Check returned true (currently a basic stub).');
        return true;
    }

    /**
     * Orchestrates the process of saving the game.
     * @async
     * @public
     * @param {string} saveName - The desired name for the save.
     * @param {boolean} isEngineInitialized - The current initialized state of the GameEngine.
     * @returns {Promise<{success: boolean, message?: string, error?: string, filePath?: string}>}
     * Outcome of the save operation.
     */
    async saveGame(saveName, isEngineInitialized) {
        this.#logger.info(`GamePersistenceService: Manual save triggered with name: "${saveName}".`);

        if (!this.#saveLoadService) {
            const errorMsg = 'SaveLoadService is not available. Cannot save game.';
            this.#logger.error(`GamePersistenceService.saveGame: ${errorMsg}`);
            return {success: false, error: errorMsg};
        }

        if (!this.isSavingAllowed(isEngineInitialized)) {
            const errorMsg = 'Saving is not currently allowed.';
            this.#logger.warn(`GamePersistenceService.saveGame: Saving is not currently allowed (e.g., engine not ready or critical moment in game).`);
            return {success: false, error: errorMsg};
        }

        try {
            this.#logger.debug(`GamePersistenceService.saveGame: Capturing current game state for save "${saveName}".`);
            const gameStateObject = this.captureCurrentGameState();
            if (!gameStateObject.metadata) {
                this.#logger.warn(`GamePersistenceService.saveGame: gameStateObject from captureCurrentGameState was missing 'metadata' property. Initializing it for saveName.`);
                gameStateObject.metadata = {};
            }
            gameStateObject.metadata.saveName = saveName;
            this.#logger.debug(`GamePersistenceService.saveGame: Set saveName "${saveName}" in gameStateObject.metadata.`);

            this.#logger.info(`GamePersistenceService.saveGame: Delegating to ISaveLoadService.saveManualGame for "${saveName}".`);
            const result = await this.#saveLoadService.saveManualGame(saveName, gameStateObject);

            if (result.success) {
                this.#logger.info(`GamePersistenceService.saveGame: Manual save successful: ${result.message || `Save "${saveName}" completed.`}`);
            } else {
                this.#logger.error(`GamePersistenceService.saveGame: Manual save failed: ${result.error || 'Unknown error from SaveLoadService.'}`);
            }
            return result;

        } catch (error) {
            const errorMessage = (error && error.message) ? error.message : 'An unknown error occurred.';
            this.#logger.error(`GamePersistenceService.saveGame: An unexpected error occurred during saveGame for "${saveName}": ${errorMessage}`, error);
            return {success: false, error: `Unexpected error during save: ${errorMessage}`};
        }
    }

    /**
     * Orchestrates the full restoration of the game state from a SaveGameStructure object.
     * Uses EntityManager.reconstructEntity() and other services to repopulate the game world.
     * This logic is ported and adapted from the original GameEngine.restoreState().
     * @async
     * @public
     * @param {SaveGameStructure} deserializedSaveData - The complete SaveGameStructure object.
     * @returns {Promise<{success: boolean, error?: string}>} A promise resolving to an object indicating the outcome.
     * On success: { success: true }
     * On critical failure: { success: false, error: "Detailed critical error message" }
     */
    async restoreGameState(deserializedSaveData) {
        this.#logger.info('GamePersistenceService.restoreGameState: Starting game state restoration...');

        // Input Validation
        if (!deserializedSaveData || typeof deserializedSaveData !== 'object') {
            const errorMsg = "Invalid save data structure provided to restoreGameState: deserializedSaveData is null or not an object.";
            this.#logger.error(`GamePersistenceService.restoreGameState: ${errorMsg}`);
            return {success: false, error: "Invalid save data structure provided to restoreGameState."};
        }
        if (!deserializedSaveData.gameState || typeof deserializedSaveData.gameState !== 'object') {
            const errorMsg = "Invalid save data structure provided to restoreGameState: deserializedSaveData.gameState is null or not an object.";
            this.#logger.error(`GamePersistenceService.restoreGameState: ${errorMsg}`);
            return {success: false, error: "Invalid save data structure provided to restoreGameState."};
        }

        // Service Availability Check
        if (!this.#entityManager) {
            const errorMsg = "EntityManager is not available for state restoration.";
            this.#logger.error(`GamePersistenceService.restoreGameState: ${errorMsg}`);
            return {success: false, error: errorMsg};
        }
        if (!this.#playtimeTracker) {
            const errorMsg = "PlaytimeTracker is not available for state restoration.";
            this.#logger.error(`GamePersistenceService.restoreGameState: ${errorMsg}`);
            return {success: false, error: errorMsg};
        }
        // AppContainer (#container) is implicitly checked by its usage later & constructor.

        // Clear Existing State
        try {
            this.#entityManager.clearAll();
            this.#logger.debug('GamePersistenceService.restoreGameState: Existing entity state has been cleared.');
        } catch (error) {
            const errorMsg = `Failed to clear existing entity state: ${error.message}`;
            this.#logger.error(`GamePersistenceService.restoreGameState: ${errorMsg}`, error);
            return {success: false, error: `Critical error during state clearing: ${errorMsg}`};
        }

        // Restore Entities
        this.#logger.info('GamePersistenceService.restoreGameState: Restoring entities...');
        const entitiesToRestore = deserializedSaveData.gameState.entities;

        if (!Array.isArray(entitiesToRestore)) {
            this.#logger.warn('GamePersistenceService.restoreGameState: deserializedSaveData.gameState.entities is not an array. Treating as empty. No entities will be restored.');
        } else {
            for (const savedEntityData of entitiesToRestore) {
                if (!savedEntityData || typeof savedEntityData.instanceId !== 'string' || !savedEntityData.instanceId) {
                    this.#logger.warn(`GamePersistenceService.restoreGameState: Invalid entity data found in save (missing or invalid instanceId, or data is null/undefined). Skipping. Data: ${JSON.stringify(savedEntityData)}`);
                    continue;
                }
                try {
                    // reconstructEntity itself is synchronous in the provided code, but await handles both sync/async.
                    const restoredEntity = await this.#entityManager.reconstructEntity(savedEntityData);
                    if (!restoredEntity) {
                        // This condition means reconstructEntity itself determined a failure for this entity
                        // and returned a falsy value (e.g. null). It should have logged the specifics.
                        this.#logger.warn(`GamePersistenceService.restoreGameState: Failed to restore entity with instanceId: ${savedEntityData.instanceId}. reconstructEntity indicated failure. Skipping.`);
                    }
                    // Successful reconstruction is logged within reconstructEntity.
                } catch (entityError) {
                    // This catch block handles errors thrown by reconstructEntity itself (e.g., invalid base savedEntityData structure)
                    this.#logger.warn(`GamePersistenceService.restoreGameState: Error during reconstructEntity for instanceId: ${savedEntityData.instanceId}. Error: ${entityError.message}. Skipping.`, entityError);
                }
            }
        }
        this.#logger.info('GamePersistenceService.restoreGameState: Entity restoration complete.');

        // Restore Playtime
        if (deserializedSaveData.metadata && typeof deserializedSaveData.metadata.playtimeSeconds === 'number') {
            try {
                this.#playtimeTracker.setAccumulatedPlaytime(deserializedSaveData.metadata.playtimeSeconds);
                this.#logger.info(`GamePersistenceService.restoreGameState: Restored accumulated playtime: ${deserializedSaveData.metadata.playtimeSeconds} seconds.`);
            } catch (playtimeError) {
                this.#logger.error(`GamePersistenceService.restoreGameState: Error setting accumulated playtime (${deserializedSaveData.metadata.playtimeSeconds}s): ${playtimeError.message}. Resetting playtime.`, playtimeError);
                this.#playtimeTracker.setAccumulatedPlaytime(0); // Default to 0 on error
            }
        } else {
            this.#logger.warn('GamePersistenceService.restoreGameState: Playtime data not found or invalid in save data. Resetting playtime.');
            this.#playtimeTracker.setAccumulatedPlaytime(0); // Or this.#playtimeTracker.reset() if it exists and is preferred
        }

        // Restore TurnManager State
        let turnManager = null;
        try {
            turnManager = /** @type {ITurnManager} */ (this.#container.resolve(tokens.ITurnManager));
        } catch (resolveError) {
            this.#logger.error(`GamePersistenceService.restoreGameState: Failed to resolve ITurnManager: ${resolveError.message}. Cannot restore turn count.`, resolveError);
        }

        if (turnManager) {
            if (deserializedSaveData.gameState.engineInternals && typeof deserializedSaveData.gameState.engineInternals.currentTurn === 'number') {
                if (typeof turnManager.setCurrentTurn === 'function') {
                    try {
                        turnManager.setCurrentTurn(deserializedSaveData.gameState.engineInternals.currentTurn);
                        this.#logger.info(`GamePersistenceService.restoreGameState: Restored current turn to ${deserializedSaveData.gameState.engineInternals.currentTurn}.`);
                    } catch (turnError) {
                        this.#logger.error(`GamePersistenceService.restoreGameState: Error calling turnManager.setCurrentTurn(${deserializedSaveData.gameState.engineInternals.currentTurn}): ${turnError.message}. Turn count not restored.`, turnError);
                    }
                } else {
                    this.#logger.warn('GamePersistenceService.restoreGameState: TurnManager does not have a setCurrentTurn method. Cannot restore turn count.');
                }
            } else {
                this.#logger.info('GamePersistenceService.restoreGameState: Current turn data not found or invalid in deserializedSaveData.gameState.engineInternals. Turn count not restored from save.');
            }
        } // If turnManager resolution failed, error already logged.

        // Restore Other Game States (Placeholder Logic)
        if (deserializedSaveData.gameState.playerState) {
            this.#logger.debug(`GamePersistenceService.restoreGameState: Processing playerState from save: ${JSON.stringify(deserializedSaveData.gameState.playerState, null, 2)}`);
            // TODO: Implement actual player state restoration logic, likely delegating to a PlayerStateService.
        } else {
            this.#logger.debug('GamePersistenceService.restoreGameState: No playerState found in save data.');
        }

        if (deserializedSaveData.gameState.worldState) {
            this.#logger.debug(`GamePersistenceService.restoreGameState: Processing worldState from save: ${JSON.stringify(deserializedSaveData.gameState.worldState, null, 2)}`);
            // TODO: Implement actual world state restoration logic, likely delegating to a WorldStateService.
        } else {
            this.#logger.debug('GamePersistenceService.restoreGameState: No worldState found in save data.');
        }

        this.#logger.info('GamePersistenceService.restoreGameState: Game state restoration process complete.');
        return {success: true};
    }

    /**
     * Loads raw game data from a save identifier using ISaveLoadService,
     * then restores the game state using that data.
     * @async
     * @public
     * @param {string} saveIdentifier - The unique identifier for the save file to be loaded (e.g., a filename or path).
     * @returns {Promise<LoadAndRestoreResult>} A promise resolving to an object indicating the outcome
     * of the entire load and restore operation.
     */
    async loadAndRestoreGame(saveIdentifier) {
        this.#logger.info(`GamePersistenceService: Attempting to load and restore game from identifier: ${saveIdentifier}.`);

        if (!this.#saveLoadService) {
            const errorMsg = 'SaveLoadService is not available. Cannot load game.';
            this.#logger.error(`GamePersistenceService.loadAndRestoreGame: ${errorMsg}`);
            return {success: false, error: errorMsg, data: null};
        }

        /** @type {LoadGameResult} */
        let loadResult;
        try {
            loadResult = await this.#saveLoadService.loadGameData(saveIdentifier);
        } catch (serviceError) {
            const errorMsg = `An unexpected error occurred while calling SaveLoadService.loadGameData for "${saveIdentifier}": ${serviceError.message}`;
            this.#logger.error(`GamePersistenceService.loadAndRestoreGame: ${errorMsg}`, serviceError);
            return {success: false, error: `Unexpected error during data loading: ${serviceError.message}`, data: null};
        }

        if (!loadResult || !loadResult.success || !loadResult.data) {
            const reason = loadResult?.error || 'No data returned from loadGameData or load failed.';
            this.#logger.error(`GamePersistenceService.loadAndRestoreGame: Failed to load raw game data from ${saveIdentifier}. Reason: ${reason}`);
            return {
                success: false,
                error: loadResult?.error || "Failed to load raw game data from storage.",
                data: null
            };
        }

        this.#logger.info(`GamePersistenceService.loadAndRestoreGame: Raw game data successfully loaded from ${saveIdentifier}. Proceeding with state restoration.`);
        const gameDataToRestore = /** @type {SaveGameStructure} */ (loadResult.data);
        const restoreResult = await this.restoreGameState(gameDataToRestore);

        if (restoreResult.success) {
            this.#logger.info(`GamePersistenceService.loadAndRestoreGame: Game state restored successfully for ${saveIdentifier}.`);
            return {success: true, data: gameDataToRestore};
        } else {
            this.#logger.error(`GamePersistenceService.loadAndRestoreGame: Failed to restore game state for ${saveIdentifier}. Error: ${restoreResult.error}`);
            return {success: false, error: restoreResult.error || "Failed to restore game state.", data: null};
        }
    }
}

export default GamePersistenceService;