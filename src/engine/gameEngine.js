// src/engine/gameEngine.js

import {tokens} from '../config/tokens.js'; // Assuming tokens.IInitializationService exists and others are correct
import {
    GAME_LOADED_ID,
    GAME_SAVED_ID,
    NEW_GAME_STARTED_ID,
    LOADED_GAME_STARTED_ID,
    GAME_STOPPED_ID
} from "../constants/eventIds.js";

// --- JSDoc Type Imports ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../config/appContainer.js').default} AppContainer */
// Assuming IEntityManager is the intended type for #entityManager
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../interfaces/IGamePersistenceService.js').IGamePersistenceService} IGamePersistenceService */
/** @typedef {import('../interfaces/IGamePersistenceService.js').LoadAndRestoreResult} LoadAndRestoreResult */
/** @typedef {import('../interfaces/IPlaytimeTracker.js').default} IPlaytimeTracker */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../domUI/domUiFacade.js').DomUiFacade} DomUiFacade */

// Corrected path based on user's GameEngine.js version used in tests
/** @typedef {import('../interfaces/IInitializationService.js').IInitializationService} IInitializationService */
/** @typedef {import('../interfaces/IInitializationService.js').InitializationResult} InitializationResult */

// REMOVED: /** @typedef {import('../loaders/worldLoader.js').default} WorldLoader */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */

/**
 * @class GameEngine
 * Main orchestrator for the game. Manages game state, game loop, and core service interactions.
 */
class GameEngine {
    /** @type {AppContainer} */
    #container;
    /** @type {ILogger} */
    #logger;
    /** @type {DomUiFacade} */
    #domUiFacade;
    // REMOVED: /** @type {WorldLoader} */
    // REMOVED: #worldLoader;
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

    /**
     * @param {object} options
     * @param {AppContainer} options.container - The application's dependency injection container.
     */
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
            this.#domUiFacade = container.resolve(tokens.DomUiFacade);
            // REMOVED: this.#worldLoader = container.resolve(tokens.WorldLoader);
            this.#entityManager = container.resolve(tokens.IEntityManager);
            this.#turnManager = container.resolve(tokens.ITurnManager);
            // Assuming GamePersistenceService (concrete) is registered with tokens.GamePersistenceService
            // and IPlaytimeTracker (concrete) is registered with tokens.PlaytimeTracker
            this.#gamePersistenceService = /** @type {IGamePersistenceService} */ (container.resolve(tokens.GamePersistenceService));
            this.#playtimeTracker = /** @type {IPlaytimeTracker} */ (container.resolve(tokens.PlaytimeTracker));
            this.#safeEventDispatcher = container.resolve(tokens.ISafeEventDispatcher);
        } catch (e) {
            this.#logger.error(`GameEngine: CRITICAL - Failed to resolve one or more core services. Error: ${e.message}`, e);
            throw new Error(`GameEngine: Failed to resolve core services. ${e.message}`);
        }
        this.#logger.info('GameEngine: Core services resolved.');
    }

    /**
     * @private
     * Resets core game state components like the EntityManager and PlaytimeTracker.
     * This method centralizes the reset logic used by startNewGame and loadGame.
     * It includes checks for service existence and logs appropriate messages.
     */
    _resetCoreGameState() {
        if (this.#entityManager) { // Assumes IEntityManager interface
            this.#entityManager.clearAll();
        } else {
            this.#logger.warn('GameEngine._resetCoreGameState: EntityManager not available.');
        }
        if (this.#playtimeTracker) { // Assumes IPlaytimeTracker interface
            this.#playtimeTracker.reset();
        } else {
            this.#logger.warn('GameEngine._resetCoreGameState: PlaytimeTracker not available.');
        }
        this.#logger.debug('GameEngine: Core game state (EntityManager, PlaytimeTracker) cleared/reset.');
    }

    /**
     * Initializes the game engine and loads the necessary world data by orchestrating
     * the InitializationService.
     * @async
     * @param {string} worldName - The name of the world to load and initialize.
     * @throws {Error} Propagates errors from the initialization process.
     */
    async startNewGame(worldName) {
        if (this.#isEngineInitialized) {
            // CORRECTED LOG MESSAGE (typo: startNewNewGame -> startNewGame)
            this.#logger.warn('GameEngine.startNewGame: Engine already initialized. Stopping existing game before starting new.');
            await this.stop();
        }
        this.#activeWorld = worldName;
        this.#logger.info(`GameEngine: Starting new game with world "${worldName}"...`);

        try {
            this.#domUiFacade.title.set(`Initializing ${worldName}...`);
            this.#domUiFacade.input.setEnabled(false, `Initializing ${worldName}...`);

            this._resetCoreGameState(); // GE-REFAC-005: Consolidated call

            this.#logger.info('GameEngine: Resolving InitializationService...');
            // Using tokens.IInitializationService for resolution as per user's latest info
            const initializationService = /** @type {IInitializationService} */ (this.#container.resolve(tokens.IInitializationService));

            this.#logger.info(`GameEngine: Invoking InitializationService.runInitializationSequence for world "${worldName}"...`);
            const initResult = /** @type {InitializationResult} */ (await initializationService.runInitializationSequence(worldName));

            if (!initResult.success) {
                const error = initResult.error || new Error('Unknown initialization failure from InitializationService.');
                this.#logger.error(`GameEngine: InitializationService failed for world "${worldName}". Error: ${error.message}`, error);
                this.#domUiFacade.messages.render(`Initialization failed: ${error.message}`, 'fatal');
                this.#domUiFacade.input.setEnabled(false, 'Error initializing game.');
                this.#domUiFacade.title.set("Initialization Error");
                this.#isEngineInitialized = false;
                this.#isGameLoopRunning = false;
                throw error;
            }
            this.#logger.info(`GameEngine: InitializationService completed successfully for world "${worldName}". Game state initialized.`);

            this.#isEngineInitialized = true;
            this.#isGameLoopRunning = true;
            this.#playtimeTracker.startSession();

            await this.#safeEventDispatcher.dispatchSafely(NEW_GAME_STARTED_ID, {worldName});
            // REVERTED LOG MESSAGE to include "(post-InitializationService)" as expected by the test
            this.#logger.info('GameEngine: Engine initialized and new game started (post-InitializationService).');

            this.#domUiFacade.title.set(this.#activeWorld || "Game Ready");
            this.#domUiFacade.input.setEnabled(true, 'Enter command...');

            this.#logger.info('GameEngine: Starting TurnManager...');
            await this.#turnManager.start();

        } catch (error) {
            const errorMessage = `GameEngine: Failed to start new game with world "${worldName}". Error: ${error instanceof Error ? error.message : String(error)}`;
            this.#logger.error(errorMessage, error);

            if (this.#domUiFacade && this.#domUiFacade.messages) {
                this.#domUiFacade.messages.render(errorMessage, 'fatal');
                this.#domUiFacade.input.setEnabled(false, 'Error starting game.');
                this.#domUiFacade.title.set("Error Starting Game");
            }

            this.#isEngineInitialized = false;
            this.#isGameLoopRunning = false;
            if (error instanceof Error) throw error;
            throw new Error(errorMessage);
        }
    }

    /**
     * Stops the game engine and performs cleanup.
     * @async
     */
    async stop() {
        if (!this.#isEngineInitialized && !this.#isGameLoopRunning) {
            this.#logger.info('GameEngine.stop: Engine not running or already stopped.');
            return;
        }
        this.#logger.info('GameEngine: Stopping...');
        this.#isGameLoopRunning = false; // Set this first

        if (this.#playtimeTracker && typeof this.#playtimeTracker.endSessionAndAccumulate === 'function') {
            this.#playtimeTracker.endSessionAndAccumulate();
        } else {
            this.#logger.warn('GameEngine.stop: PlaytimeTracker not available or endSessionAndAccumulate not a function.');
        }

        if (this.#domUiFacade && this.#domUiFacade.input) {
            this.#domUiFacade.input.setEnabled(false, 'Game stopped.');
        } else {
            this.#logger.warn('GameEngine.stop: DomUiFacade or input controller not available for disabling input.');
        }


        if (this.#turnManager && typeof this.#turnManager.stop === 'function') {
            await this.#turnManager.stop();
        }

        if (this.#safeEventDispatcher) {
            await this.#safeEventDispatcher.dispatchSafely(GAME_STOPPED_ID, {});
        }

        this.#logger.info('GameEngine: Stopped.');
        this.#isEngineInitialized = false; // Mark as not initialized after all stop operations
        this.#activeWorld = null;
    }


    /**
     * Triggers a manual save of the current game state.
     * @async
     * @param {string} saveName - The desired name for the save file.
     * @returns {Promise<{success: boolean, message?: string, error?: string, filePath?: string}>}
     */
    async triggerManualSave(saveName) {
        this.#logger.info(`GameEngine: Manual save process initiated with name: "${saveName}"`);

        if (!this.#isEngineInitialized) {
            const errorMsg = 'Game engine is not initialized. Cannot save game.';
            this.#logger.error(`GameEngine.triggerManualSave: ${errorMsg}`);
            return {success: false, error: errorMsg};
        }
        if (!this.#gamePersistenceService) {
            // This check should ideally not be needed if constructor guarantees resolution,
            // but kept for robustness or if the service could be unset.
            const errorMsg = 'GamePersistenceService is not available. Cannot save game.';
            this.#logger.error(`GameEngine.triggerManualSave: ${errorMsg}`);
            return {success: false, error: errorMsg};
        }

        const saveResult = await this.#gamePersistenceService.saveGame(saveName, this.#isEngineInitialized);

        if (saveResult.success) {
            this.#logger.info(`GameEngine: Manual save successful. Name: "${saveName}", Path: ${saveResult.filePath || 'N/A'}`);
            await this.#safeEventDispatcher.dispatchSafely(GAME_SAVED_ID, {
                saveName: saveName,
                path: saveResult.filePath,
                type: 'manual'
            });
        } else {
            this.#logger.error(`GameEngine: Manual save failed. Name: "${saveName}". Error: ${saveResult.error}`);
        }
        return saveResult;
    }

    /**
     * Loads a game from the specified save identifier.
     * @async
     * @param {string} saveIdentifier - The unique identifier of the save file to load.
     * @returns {Promise<LoadAndRestoreResult>}
     */
    async loadGame(saveIdentifier) {
        this.#logger.info(`GameEngine: Load game process initiated from identifier: ${saveIdentifier}`);

        if (!this.#gamePersistenceService) {
            const errorMsg = 'GamePersistenceService is not available. Cannot load game.';
            this.#logger.error(`GameEngine.loadGame: ${errorMsg}`);
            return {success: false, error: errorMsg, data: null}; // Ensure LoadAndRestoreResult structure
        }

        await this.stop();
        this._resetCoreGameState(); // GE-REFAC-005: Consolidated call
        // The debug log from _resetCoreGameState will indicate "EntityManager and PlaytimeTracker cleared/reset."
        // The specific log "GameEngine.loadGame: Existing game stopped, EntityManager and PlaytimeTracker cleared/reset." is now partially covered.
        // If the exact log message is critical for tests, it might need adjustment or the test needs to be updated.
        // For now, we'll rely on the debug log from the helper.

        const shortSaveName = saveIdentifier.split(/[/\\]/).pop() || saveIdentifier;
        this.#domUiFacade.title.set(`Loading ${shortSaveName}...`);
        this.#domUiFacade.input.setEnabled(false, `Loading ${shortSaveName}...`);

        const restoreOutcome = await this.#gamePersistenceService.loadAndRestoreGame(saveIdentifier);

        if (restoreOutcome.success && restoreOutcome.data) {
            const loadedSaveData = /** @type {SaveGameStructure} */ (restoreOutcome.data);
            this.#logger.info(`GameEngine: Game state restored successfully from ${saveIdentifier}.`);

            this.#activeWorld = loadedSaveData.metadata?.gameTitle || 'Restored Game';
            this.#isEngineInitialized = true;
            this.#isGameLoopRunning = true;

            this.#playtimeTracker.startSession(); // Start session after successful load & state restoration

            this.#domUiFacade.title.set(this.#activeWorld);

            await this.#safeEventDispatcher.dispatchSafely(GAME_LOADED_ID, {saveIdentifier});
            await this.#safeEventDispatcher.dispatchSafely(LOADED_GAME_STARTED_ID, {
                saveIdentifier,
                worldName: this.#activeWorld
            });

            this.#logger.info(`GameEngine: Starting TurnManager for loaded game...`);
            await this.#turnManager.start();
            this.#domUiFacade.input.setEnabled(true, 'Enter command...');

            this.#logger.info(`GameEngine: Game loaded from "${saveIdentifier}" (World: ${this.#activeWorld}) and resumed.`);
            return {success: true, data: loadedSaveData};
        } else {
            const errorMsg = `GameEngine: Failed to load and restore game from ${saveIdentifier}. Error: ${restoreOutcome.error || 'Restored data was missing or load operation failed.'}`;
            this.#logger.error(errorMsg);
            this.#domUiFacade.messages.render(errorMsg, 'fatal');
            this.#domUiFacade.input.setEnabled(false, 'Failed to load game.');
            this.#domUiFacade.title.set('Load Failed');

            this.#isEngineInitialized = false;
            this.#isGameLoopRunning = false;
            return {
                success: false,
                error: restoreOutcome.error || "Unknown error during load or missing data.",
                data: null
            };
        }
    }

    /**
     * Shows the Save Game UI if saving is currently allowed.
     */
    showSaveGameUI() {
        const saveGameUI = this.#domUiFacade.saveGame;
        if (!saveGameUI) {
            this.#logger.warn("GameEngine.showSaveGameUI: SaveGameUI component not available via facade.");
            if (this.#domUiFacade && this.#domUiFacade.messages) {
                this.#domUiFacade.messages.render("Save Game UI is currently unavailable.", 'error');
            }
            return;
        }
        if (!this.#gamePersistenceService) {
            this.#logger.error("GameEngine.showSaveGameUI: GamePersistenceService not available. Cannot determine if saving is allowed.");
            if (this.#domUiFacade && this.#domUiFacade.messages) {
                this.#domUiFacade.messages.render("Cannot open save menu: persistence service error.", 'error');
            }
            return;
        }

        if (this.#gamePersistenceService.isSavingAllowed(this.#isEngineInitialized)) {
            this.#logger.info("GameEngine: Showing Save Game UI.");
            saveGameUI.show();
        } else {
            this.#logger.warn("GameEngine.showSaveGameUI: Saving is not currently allowed.");
            if (this.#domUiFacade && this.#domUiFacade.messages) {
                this.#domUiFacade.messages.render("Cannot save at this moment (e.g. game not fully initialized or in a critical state).", 'info');
            }
        }
    }

    /**
     * Shows the Load Game UI.
     */
    showLoadGameUI() {
        const loadGameUI = this.#domUiFacade.loadGame;
        if (!loadGameUI) {
            this.#logger.warn("GameEngine.showLoadGameUI: LoadGameUI component not available via facade.");
            if (this.#domUiFacade && this.#domUiFacade.messages) {
                this.#domUiFacade.messages.render("Load Game UI is currently unavailable.", 'error');
            }
            return;
        }
        this.#logger.info("GameEngine: Showing Load Game UI.");
        loadGameUI.show();
    }


    /**
     * Gets the current status of the game engine.
     * @returns {{isInitialized: boolean, isLoopRunning: boolean, activeWorld: string|null}}
     */
    getEngineStatus() {
        return {
            isInitialized: this.#isEngineInitialized,
            isLoopRunning: this.#isGameLoopRunning,
            activeWorld: this.#activeWorld,
        };
    }
}

export default GameEngine;