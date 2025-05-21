// src/engine/gameEngine.js

import {tokens} from '../config/tokens.js';
import {
    GAME_LOADED_ID,
    GAME_SAVED_ID,
    NEW_GAME_STARTED_ID,
    LOADED_GAME_STARTED_ID,
    GAME_STOPPED_ID,
    ENGINE_INITIALIZING_UI,
    ENGINE_READY_UI,
    ENGINE_OPERATION_IN_PROGRESS_UI,
    ENGINE_OPERATION_FAILED_UI,
    ENGINE_STOPPED_UI,
    ENGINE_MESSAGE_DISPLAY_REQUESTED,
    REQUEST_SHOW_SAVE_GAME_UI,
    REQUEST_SHOW_LOAD_GAME_UI,
    CANNOT_SAVE_GAME_INFO
} from "../constants/eventIds.js";

// --- JSDoc Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../config/appContainer.js').default} AppContainer */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../interfaces/IGamePersistenceService.js').IGamePersistenceService} IGamePersistenceService */
/** @typedef {import('../interfaces/IGamePersistenceService.js').LoadAndRestoreResult} LoadAndRestoreResult */
/** @typedef {import('../interfaces/IPlaytimeTracker.js').default} IPlaytimeTracker */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/IInitializationService.js').IInitializationService} IInitializationService */

/** @typedef {import('../interfaces/IInitializationService.js').InitializationResult} InitializationResult */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */

class GameEngine {
    /** @type {AppContainer} */
    #container;
    /** @type {ILogger} */
    #logger;
    /** @type {IEntityManager} */
    #entityManager;
    /** @type {ITurnManager} */
    #turnManager;
    /** @type {IGamePersistenceService} */
    #gamePersistenceService;
    /** @type {IPlaytimeTracker} */
    #playtimeTracker;
    /** @type {ISafeEventDispatcher} */
    #safeEventDispatcher;

    /** @type {boolean} */
    #isEngineInitialized = false;
    /** @type {boolean} */
    #isGameLoopRunning = false;
    /** @type {string | null} */
    #activeWorld = null;

    constructor({container}) {
        this.#container = container;
        try {
            this.#logger = container.resolve(tokens.ILogger);
        } catch (e) {
            console.error("GameEngine: CRITICAL - Logger not resolved.", e);
            throw new Error("GameEngine requires a logger.");
        }
        this.#logger.info('GameEngine: Constructor called.');
        try {
            this.#entityManager = container.resolve(tokens.IEntityManager);
            this.#turnManager = container.resolve(tokens.ITurnManager);
            this.#gamePersistenceService = /** @type {IGamePersistenceService} */ (container.resolve(tokens.GamePersistenceService));
            this.#playtimeTracker = /** @type {IPlaytimeTracker} */ (container.resolve(tokens.PlaytimeTracker));
            this.#safeEventDispatcher = container.resolve(tokens.ISafeEventDispatcher);
        } catch (e) {
            this.#logger.error(`GameEngine: CRITICAL - Failed to resolve one or more core services. Error: ${e.message}`, e);
            throw new Error(`GameEngine: Failed to resolve core services. ${e.message}`);
        }
        this.#logger.info('GameEngine: Core services resolved.');
    }

    _resetCoreGameState() {
        if (this.#entityManager) this.#entityManager.clearAll();
        else this.#logger.warn('GameEngine._resetCoreGameState: EntityManager not available.');
        if (this.#playtimeTracker) this.#playtimeTracker.reset();
        else this.#logger.warn('GameEngine._resetCoreGameState: PlaytimeTracker not available.');
        this.#logger.debug('GameEngine: Core game state (EntityManager, PlaytimeTracker) cleared/reset.');
    }

    async startNewGame(worldName) {
        if (this.#isEngineInitialized) {
            // Corrected typo in the log message below
            this.#logger.warn('GameEngine.startNewGame: Engine already initialized. Stopping existing game before starting new.');
            await this.stop();
        }
        this.#activeWorld = worldName;
        this.#logger.info(`GameEngine: Starting new game with world "${worldName}"...`);

        await this.#safeEventDispatcher.dispatchSafely(ENGINE_INITIALIZING_UI, {worldName});

        let initResult = null;

        try {
            this._resetCoreGameState();
            const initializationService = /** @type {IInitializationService} */ (this.#container.resolve(tokens.IInitializationService));
            initResult = /** @type {InitializationResult} */ (await initializationService.runInitializationSequence(worldName));

            if (!initResult.success) {
                const error = initResult.error || new Error('Unknown initialization failure from InitializationService.');
                const errorMessageText = `Initialization failed: ${error.message}`;
                this.#logger.error(`GameEngine: InitializationService failed for world "${worldName}". Error: ${error.message}`, error);
                await this.#safeEventDispatcher.dispatchSafely(ENGINE_OPERATION_FAILED_UI, {
                    errorMessage: errorMessageText,
                    errorTitle: "Initialization Error"
                });
                this.#isEngineInitialized = false;
                this.#isGameLoopRunning = false;
                throw error;
            }
            this.#logger.info(`GameEngine: InitializationService completed successfully for world "${worldName}". Game state initialized.`);
            this.#isEngineInitialized = true;
            this.#isGameLoopRunning = true;
            this.#playtimeTracker.startSession();
            await this.#safeEventDispatcher.dispatchSafely(NEW_GAME_STARTED_ID, {worldName});
            this.#logger.info('GameEngine: Engine initialized and new game started (post-InitializationService).');
            await this.#safeEventDispatcher.dispatchSafely(ENGINE_READY_UI, {
                activeWorld: this.#activeWorld,
                message: 'Enter command...'
            });
            await this.#turnManager.start();
        } catch (error) {
            const baseErrorMessage = error instanceof Error ? error.message : String(error);
            const fullErrorMessage = `GameEngine: Failed to start new game with world "${worldName}". Error: ${baseErrorMessage}`;
            this.#logger.error(fullErrorMessage, error);
            let alreadyDispatchedForInitFailure = false;
            if (initResult && initResult.error === error && !initResult.success) {
                alreadyDispatchedForInitFailure = true;
            }
            if (!alreadyDispatchedForInitFailure) {
                await this.#safeEventDispatcher.dispatchSafely(ENGINE_OPERATION_FAILED_UI, {
                    errorMessage: baseErrorMessage,
                    errorTitle: "Error Starting Game"
                });
            }
            this.#isEngineInitialized = false;
            this.#isGameLoopRunning = false;
            if (error instanceof Error) throw error;
            throw new Error(fullErrorMessage);
        }
    }

    async stop() {
        if (!this.#isEngineInitialized && !this.#isGameLoopRunning) {
            this.#logger.info('GameEngine.stop: Engine not running or already stopped.');
            return;
        }
        this.#logger.info('GameEngine: Stopping...');
        this.#isGameLoopRunning = false;
        if (this.#playtimeTracker && typeof this.#playtimeTracker.endSessionAndAccumulate === 'function') {
            this.#playtimeTracker.endSessionAndAccumulate();
        } else {
            this.#logger.warn('GameEngine.stop: PlaytimeTracker not available or endSessionAndAccumulate not a function.');
        }
        await this.#safeEventDispatcher.dispatchSafely(ENGINE_STOPPED_UI, {inputDisabledMessage: 'Game stopped.'});
        if (this.#turnManager && typeof this.#turnManager.stop === 'function') await this.#turnManager.stop();
        if (this.#safeEventDispatcher) await this.#safeEventDispatcher.dispatchSafely(GAME_STOPPED_ID, {});
        this.#logger.info('GameEngine: Stopped.');
        this.#isEngineInitialized = false;
        this.#activeWorld = null;
    }

    async triggerManualSave(saveName) {
        this.#logger.info(`GameEngine: Manual save process initiated with name: "${saveName}"`);
        if (!this.#isEngineInitialized) {
            const errorMsg = 'Game engine is not initialized. Cannot save game.';
            this.#logger.error(`GameEngine.triggerManualSave: ${errorMsg}`);
            await this.#safeEventDispatcher.dispatchSafely(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: errorMsg,
                type: 'error'
            });
            return {success: false, error: errorMsg};
        }
        if (!this.#gamePersistenceService) {
            const errorMsg = 'GamePersistenceService is not available. Cannot save game.';
            this.#logger.error(`GameEngine.triggerManualSave: ${errorMsg}`);
            await this.#safeEventDispatcher.dispatchSafely(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: errorMsg,
                type: 'error'
            });
            return {success: false, error: errorMsg};
        }
        const saveResult = await this.#gamePersistenceService.saveGame(saveName, this.#isEngineInitialized);
        if (saveResult.success) {
            const successMsg = `Game "${saveName}" saved successfully.`;
            this.#logger.info(`GameEngine: Manual save successful. Name: "${saveName}", Path: ${saveResult.filePath || 'N/A'}`);
            await this.#safeEventDispatcher.dispatchSafely(GAME_SAVED_ID, {
                saveName: saveName,
                path: saveResult.filePath,
                type: 'manual'
            });
            await this.#safeEventDispatcher.dispatchSafely(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: successMsg,
                type: 'info'
            });
        } else {
            const errorMsg = `Manual save failed for "${saveName}". Error: ${saveResult.error || 'Unknown error'}`;
            this.#logger.error(`GameEngine: Manual save failed. Name: "${saveName}". Error: ${saveResult.error}`);
            await this.#safeEventDispatcher.dispatchSafely(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: errorMsg,
                type: 'error'
            });
        }
        return saveResult;
    }

    async loadGame(saveIdentifier) {
        this.#logger.info(`GameEngine: Load game process initiated from identifier: ${saveIdentifier}`);
        if (!this.#gamePersistenceService) {
            const errorMsg = 'GamePersistenceService is not available. Cannot load game.';
            this.#logger.error(`GameEngine.loadGame: ${errorMsg}`);
            await this.#safeEventDispatcher.dispatchSafely(ENGINE_OPERATION_FAILED_UI, {
                errorMessage: errorMsg,
                errorTitle: "Load Failed"
            });
            return {success: false, error: errorMsg, data: null};
        }
        await this.stop();
        this._resetCoreGameState();
        const shortSaveName = saveIdentifier.split(/[/\\]/).pop() || saveIdentifier;
        await this.#safeEventDispatcher.dispatchSafely(ENGINE_OPERATION_IN_PROGRESS_UI, {
            titleMessage: `Loading ${shortSaveName}...`,
            inputDisabledMessage: `Loading ${shortSaveName}...`
        });
        const restoreOutcome = await this.#gamePersistenceService.loadAndRestoreGame(saveIdentifier);
        if (restoreOutcome.success && restoreOutcome.data) {
            const loadedSaveData = /** @type {SaveGameStructure} */ (restoreOutcome.data);
            this.#logger.info(`GameEngine: Game state restored successfully from ${saveIdentifier}.`);
            this.#activeWorld = loadedSaveData.metadata?.gameTitle || 'Restored Game';
            this.#isEngineInitialized = true;
            this.#isGameLoopRunning = true;
            this.#playtimeTracker.startSession();
            await this.#safeEventDispatcher.dispatchSafely(GAME_LOADED_ID, {saveIdentifier});
            await this.#safeEventDispatcher.dispatchSafely(LOADED_GAME_STARTED_ID, {
                saveIdentifier,
                worldName: this.#activeWorld
            });
            await this.#turnManager.start();
            await this.#safeEventDispatcher.dispatchSafely(ENGINE_READY_UI, {
                activeWorld: this.#activeWorld,
                message: 'Enter command...'
            });
            this.#logger.info(`GameEngine: Game loaded from "${saveIdentifier}" (World: ${this.#activeWorld}) and resumed.`);
            return {success: true, data: loadedSaveData};
        } else {
            const errorMsg = `Failed to load and restore game from ${saveIdentifier}. Error: ${restoreOutcome.error || 'Restored data was missing or load operation failed.'}`;
            this.#logger.error(`GameEngine.loadGame: ${errorMsg}`);
            await this.#safeEventDispatcher.dispatchSafely(ENGINE_OPERATION_FAILED_UI, {
                errorMessage: errorMsg,
                errorTitle: "Load Failed"
            });
            this.#isEngineInitialized = false;
            this.#isGameLoopRunning = false;
            return {
                success: false,
                error: restoreOutcome.error || "Unknown error during load or missing data.",
                data: null
            };
        }
    }

    async showSaveGameUI() {
        if (!this.#gamePersistenceService) {
            this.#logger.error("GameEngine.showSaveGameUI: GamePersistenceService not available. Cannot determine if saving is allowed or show UI.");
            await this.#safeEventDispatcher.dispatchSafely(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: "Cannot open save menu: persistence service error.",
                type: 'error'
            });
            return;
        }
        if (this.#gamePersistenceService.isSavingAllowed(this.#isEngineInitialized)) {
            this.#logger.info("GameEngine: Requesting to show Save Game UI.");
            await this.#safeEventDispatcher.dispatchSafely(REQUEST_SHOW_SAVE_GAME_UI);
        } else {
            this.#logger.warn("GameEngine.showSaveGameUI: Saving is not currently allowed.");
            await this.#safeEventDispatcher.dispatchSafely(CANNOT_SAVE_GAME_INFO);
        }
    }

    async showLoadGameUI() {
        if (!this.#gamePersistenceService) {
            this.#logger.error("GameEngine.showLoadGameUI: GamePersistenceService not available. Load Game UI might not function correctly.");
            await this.#safeEventDispatcher.dispatchSafely(ENGINE_MESSAGE_DISPLAY_REQUESTED, {
                message: "Cannot open load menu: persistence service error.",
                type: 'error'
            });
            return;
        }
        this.#logger.info("GameEngine: Requesting to show Load Game UI.");
        await this.#safeEventDispatcher.dispatchSafely(REQUEST_SHOW_LOAD_GAME_UI);
    }

    getEngineStatus() {
        return {
            isInitialized: this.#isEngineInitialized,
            isLoopRunning: this.#isGameLoopRunning,
            activeWorld: this.#activeWorld,
        };
    }
}

export default GameEngine;