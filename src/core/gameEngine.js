// src/core/gameEngine.js

// --- Type Imports ---
/** @typedef {import('./config/appContainer.js').default} AppContainer */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('./initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('./initializers/services/initializationService.js').InitializationResult} InitializationResult */
/** @typedef {import('./shutdown/services/shutdownService.js').default} ShutdownService */
// ISaveLoadService import will be removed as per ticket if no longer used
// /** @typedef {import('../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */
/** @typedef {import('./interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../services/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../services/gamePersistenceService.js').default} GamePersistenceService */
/** @typedef {import('../services/gamePersistenceService.js').LoadAndRestoreResult} LoadAndRestoreResult */ // Assuming GamePersistenceService exports this type


// --- Import Tokens ---
import {tokens} from './config/tokens.js';
import OriginalEntity from '../entities/entity.js'; // Assuming Entity class is default export

/**
 * Encapsulates the core game engine, managing state, coordinating initialization
 * via InitializationService, starting the game via TurnManager, and coordinating shutdown
 * via ShutdownService. Also handles triggering save operations via GamePersistenceService and loading games.
 */
class GameEngine {
    /** @private @type {AppContainer} */
    #container;
    /** @private @type {boolean} */
    #isInitialized = false;
    /** @private @type {ILogger | null} */
    #logger = null;
    /** @private @type {IDataRegistry | null} */
    #dataRegistry = null;
    /** @private @type {EntityManager | null} */
    #entityManager = null;
    /** @private @type {PlaytimeTracker | null} */
    #playtimeTracker = null;
    /** @private @type {GamePersistenceService | null} */
    #gamePersistenceService = null;


    /**
     * Creates a new GameEngine instance.
     * @param {object} options
     * @param {AppContainer} options.container - The application's dependency container.
     */
    constructor({container}) {
        if (!container) {
            console.error('GameEngine requires a valid AppContainer instance.');
            throw new Error('GameEngine requires a valid AppContainer instance.');
        }
        this.#container = container;

        try {
            this.#logger = this.#container.resolve(tokens.ILogger);
        } catch (error) {
            console.warn('GameEngine Constructor: Could not resolve ILogger dependency. Falling back to console.', error);
            this.#logger = {info: console.info, warn: console.warn, error: console.error, debug: console.debug};
        }

        try {
            this.#playtimeTracker = /** @type {PlaytimeTracker} */ (this.#container.resolve(tokens.PlaytimeTracker));
        } catch (error) {
            this.#logger.error('GameEngine Constructor: CRITICAL - Could not resolve PlaytimeTracker. Playtime features and save/load will fail.', error);
            throw new Error('GameEngine failed to initialize PlaytimeTracker.'); // Make it fatal
        }

        try {
            this.#gamePersistenceService = /** @type {GamePersistenceService} */ (this.#container.resolve(tokens.GamePersistenceService));
            this.#logger.info('GameEngine Constructor: GamePersistenceService resolved successfully.');
        } catch (error) {
            this.#logger.error('GameEngine Constructor: CRITICAL - Could not resolve GamePersistenceService. Manual save operations will fail.', error);
            throw new Error('GameEngine failed to initialize GamePersistenceService.'); // Make it fatal
        }

        try {
            this.#dataRegistry = this.#container.resolve(tokens.IDataRegistry);
        } catch (error) {
            this.#logger.warn('GameEngine Constructor: Could not resolve IDataRegistry. Mod manifest capture will fail.', error);
        }
        try {
            this.#entityManager = this.#container.resolve(tokens.EntityManager); // Assuming concrete EntityManager token for now
        } catch (error) {
            this.#logger.warn('GameEngine Constructor: Could not resolve EntityManager. Game state capture/restore will fail.', error);
        }


        this.#logger.info('GameEngine: Instance created. Ready to start.');
    }

    /**
     * Checks if the game engine has been successfully initialized and hasn't been stopped.
     * @returns {boolean} True if the engine is considered initialized, false otherwise.
     */
    get isInitialized() {
        return this.#isInitialized;
    }

    /**
     * @async
     * @private
     * @method #onGameReady
     * @description Centralizes the common final steps required to make the game engine active and playable
     * after either a new game has been initialized or a saved game has been successfully loaded and restored.
     * Sets the engine to initialized, resolves and starts the TurnManager.
     * @throws {Error} If ITurnManager cannot be resolved or fails to start.
     */
    async #onGameReady() {
        this.#isInitialized = true;
        this.#logger?.info("GameEngine: Game data processed. Engine is now initialized.");

        let turnManager = null;
        try {
            turnManager = /** @type {ITurnManager} */ (this.#container.resolve(tokens.ITurnManager));
        } catch (error) {
            this.#logger?.error("GameEngine.#onGameReady: Failed to resolve ITurnManager. Cannot start turns.", error);
            this.#isInitialized = false; // Mark as not initialized if we can't get turn manager
            throw new Error('Failed to resolve ITurnManager in #onGameReady.');
        }

        try {
            this.#logger?.info("GameEngine.#onGameReady: Starting TurnManager...");
            await turnManager.start(); // Assuming start() is general enough for new/resume
            this.#logger?.info("GameEngine.#onGameReady: TurnManager started successfully.");
        } catch (error) {
            this.#logger?.error("GameEngine.#onGameReady: CRITICAL ERROR starting TurnManager.", error);
            this.#isInitialized = false; // Mark as not initialized if turn manager fails to start
            if (turnManager && typeof turnManager.stop === 'function') {
                try {
                    await turnManager.stop();
                    this.#logger?.warn("GameEngine.#onGameReady: Attempted to stop TurnManager after startup error.");
                } catch (stopError) {
                    this.#logger?.error("GameEngine.#onGameReady: Error stopping TurnManager during error handling.", stopError);
                }
            }
            throw error; // Re-throw the original error from turnManager.start()
        }
    }


    /**
     * Initializes the game using InitializationService and then starts the turn processing via TurnManager.
     * This is for starting a NEW game.
     * @param {string} worldName - The identifier of the world to load and start.
     * @returns {Promise<void>} A promise that resolves when the turn manager has successfully started, or rejects if initialization or startup fails.
     */
    async startNewGame(worldName) {
        if (!worldName || typeof worldName !== 'string' || worldName.trim() === '') {
            this.#logger?.error('GameEngine: Fatal Error - startNewGame() called without a valid worldName.');
            throw new Error('GameEngine.startNewGame requires a valid non-empty worldName argument.');
        }

        if (this.isInitialized) {
            this.#logger?.warn(`GameEngine: startNewGame('${worldName}') called, but engine is already initialized. Please stop the engine first.`);
            // Consider calling await this.stop(); here if auto-stop is desired,
            // or throw an error to enforce manual stop. For now, returning as per original logic.
            return;
        }

        this.#logger?.info(`GameEngine: Starting NEW GAME initialization sequence for world: ${worldName}...`);

        try {
            if (this.#entityManager) {
                this.#logger?.debug('GameEngine: Clearing EntityManager before new game initialization.');
                this.#entityManager.clearAll();
            } else {
                this.#logger?.error('GameEngine: EntityManager is not available. Cannot clear before new game.');
                throw new Error('EntityManager not available for new game start.');
            }

            // PlaytimeTracker reset is now handled *after* successful initialization.
            // The old reset call that was here has been removed.

            const initializationService = /** @type {InitializationService} */ (
                this.#container.resolve(tokens.InitializationService)
            );
            this.#logger?.debug('GameEngine: InitializationService resolved for new game.');
            const initResult = await initializationService.runInitializationSequence(worldName);

            if (!initResult.success) {
                const failureReason = initResult.error?.message || 'Unknown initialization error';
                this.#logger?.error(`GameEngine: New game initialization sequence failed for world '${worldName}'. Reason: ${failureReason}`, initResult.error);
                this.#isInitialized = false; // Ensure state is false if init failed
                // Playtime should be reset on failure if it was somehow started or carried over.
                // The main catch block handles this, but being explicit here too for init failure.
                if (this.#playtimeTracker) {
                    this.#logger?.debug('GameEngine: Resetting PlaytimeTracker due to failed initialization sequence.');
                    this.#playtimeTracker.reset();
                }
                throw initResult.error || new Error(`Game engine new game initialization failed: ${failureReason}`);
            }

            this.#logger?.info('GameEngine: New game initialization sequence reported success.');

            // Reset playtime tracker for the new game *after* successful initialization
            if (this.#playtimeTracker) {
                this.#logger?.debug('GameEngine: Resetting PlaytimeTracker for new game session.');
                this.#playtimeTracker.reset();
            } else {
                this.#logger?.warn('GameEngine: PlaytimeTracker not available, cannot reset for new game.');
            }

            // Start session timer after successful new game init and playtime reset
            if (this.#playtimeTracker) {
                this.#logger?.debug('GameEngine: Starting new PlaytimeTracker session.');
                this.#playtimeTracker.startSession();
            } else {
                this.#logger?.warn('GameEngine: PlaytimeTracker not available, cannot start session.');
            }

            this.#logger?.info('GameEngine: Finalizing new game setup via #onGameReady...');
            await this.#onGameReady();
            this.#logger?.info(`GameEngine: New game '${worldName}' started successfully and is ready.`);

        } catch (error) {
            this.#logger?.error(`GameEngine: CRITICAL ERROR during new game initialization or startup for world '${worldName}'.`, error);
            this.#isInitialized = false; // Ensure engine is marked as not initialized on any critical failure
            if (this.#playtimeTracker) {
                this.#logger?.debug('GameEngine: Resetting PlaytimeTracker due to critical error during new game start.');
                this.#playtimeTracker.reset(); // Reset playtime on any critical failure during new game start
            }
            throw error; // Re-throw the error to be handled by the caller
        }
    }

    /**
     * Restores the game state from a deserialized save game object.
     * This method assumes mod definitions have already been loaded into DataRegistry
     * based on the save file's mod manifest *before* this method is called.
     * The actual restoration of game data components (entities, playtime, turn number etc.)
     * is expected to be handled by GamePersistenceService.loadAndRestoreGame, which then
     * provides the deserializedSaveData. This method applies that data.
     * @param {SaveGameStructure} deserializedSaveData - The full save game object.
     * @returns {Promise<void>}
     * @throws {Error} If restoration fails or if #onGameReady fails.
     * @deprecated This method's core logic has been moved to GamePersistenceService.restoreGameState.
     * GameEngine.loadGame() should be used as the public API for loading, which orchestrates
     * GamePersistenceService. This method may be removed in future versions.
     */
    async restoreState(deserializedSaveData) {
        this.#logger?.warn('GameEngine.restoreState is deprecated. GamePersistenceService.restoreGameState should be used internally by loadGame flow.');
        this.#logger?.info('GameEngine: Restoring game state from save data (via deprecated method)...');

        if (!deserializedSaveData || typeof deserializedSaveData !== 'object') {
            this.#logger?.error('GameEngine.restoreState: Invalid or null deserializedSaveData provided.');
            throw new Error('Invalid save data provided for state restoration.');
        }
        if (!this.#entityManager) {
            this.#logger?.error('GameEngine.restoreState: EntityManager is not available. Cannot restore entities.');
            throw new Error('EntityManager not available for state restoration.');
        }
        if (!this.#dataRegistry) {
            this.#logger?.warn('GameEngine.restoreState: DataRegistry is not available. This might be an issue if further definition lookups were needed.');
        }

        this.#logger?.debug('GameEngine.restoreState: Clearing existing entity state via EntityManager.clearAll() before applying loaded state.');
        this.#entityManager.clearAll();

        this.#logger?.info(`GameEngine.restoreState: Restoring ${deserializedSaveData.gameState.entities?.length || 0} entities.`);
        if (deserializedSaveData.gameState?.entities) {
            for (const savedEntityData of deserializedSaveData.gameState.entities) {
                if (!savedEntityData.instanceId || !savedEntityData.definitionId || typeof savedEntityData.components !== 'object') {
                    this.#logger?.warn('GameEngine.restoreState: Skipping invalid entity data in save:', savedEntityData);
                    continue;
                }
                const entity = new OriginalEntity(savedEntityData.instanceId);
                this.#logger?.debug(`GameEngine.restoreState: Re-registering entity instance ${entity.id} (definition: ${savedEntityData.definitionId}).`);
                this.#entityManager.activeEntities.set(entity.id, entity);

                for (const [componentTypeId, componentData] of Object.entries(savedEntityData.components)) {
                    try {
                        this.#entityManager.addComponent(entity.id, componentTypeId, componentData);
                        this.#logger?.debug(`GameEngine.restoreState: Added/Restored component ${componentTypeId} to entity ${entity.id}.`);
                    } catch (compError) {
                        this.#logger?.error(`GameEngine.restoreState: Failed to add/restore component ${componentTypeId} to entity ${entity.id}. Error: ${compError.message}. Skipping component.`, compError);
                    }
                }
                this.#logger?.debug(`GameEngine.restoreState: Finished restoring components for entity ${entity.id}.`);
            }
        }
        this.#logger?.info('GameEngine.restoreState: Entity restoration process in GameEngine scope complete.');

        if (deserializedSaveData.metadata && typeof deserializedSaveData.metadata.playtimeSeconds === 'number') {
            this.#logger?.info(`GameEngine.restoreState: PlaytimeTracker should have been updated by GamePersistenceService to ${deserializedSaveData.metadata.playtimeSeconds}s.`);
            if (this.#playtimeTracker) { // Manually setting it here since this is a deprecated path
                this.#playtimeTracker.setAccumulatedPlaytime(deserializedSaveData.metadata.playtimeSeconds);
            }
        } else {
            this.#logger?.warn('GameEngine.restoreState: Playtime data not found or invalid in save data; PlaytimeTracker state depends on GamePersistenceService.');
        }

        try {
            const turnManager = /** @type {ITurnManager} */ (this.#container.resolve(tokens.ITurnManager));
            if (turnManager && deserializedSaveData.gameState?.engineInternals && typeof deserializedSaveData.gameState.engineInternals.currentTurn === 'number') {
                if (typeof turnManager.setCurrentTurn === 'function') {
                    turnManager.setCurrentTurn(deserializedSaveData.gameState.engineInternals.currentTurn);
                    this.#logger?.info(`GameEngine.restoreState: Set current turn on TurnManager to ${deserializedSaveData.gameState.engineInternals.currentTurn}.`);
                } else {
                    this.#logger?.warn('GameEngine.restoreState: TurnManager does not have setCurrentTurn method. Cannot restore turn count directly here.');
                }
            } else {
                this.#logger?.info('GameEngine.restoreState: Current turn data not found in save or TurnManager not resolved for setCurrentTurn.');
            }
        } catch (error) {
            this.#logger?.error('GameEngine.restoreState: Failed to resolve ITurnManager for setting current turn. Turn state may not be fully restored.', error);
        }

        if (deserializedSaveData.gameState?.playerState) {
            this.#logger?.debug('GameEngine.restoreState: PlayerState data was present in save. Restoration depends on GamePersistenceService/other services.');
        }

        if (deserializedSaveData.gameState?.worldState) {
            this.#logger?.debug('GameEngine.restoreState: WorldState data was present in save. Restoration depends on GamePersistenceService/other services.');
        }
        try {
            await this.#onGameReady(); // This will set #isInitialized = true
            this.#logger?.info('GameEngine: State restoration and engine readiness complete (via deprecated method).');
        } catch (error) {
            this.#logger?.error('GameEngine.restoreState: CRITICAL ERROR during #onGameReady after state restoration (via deprecated method).', error);
            this.#isInitialized = false;
            throw error;
        }
    }

    /**
     * Loads a game from a save identifier.
     * This method orchestrates stopping any current game, delegating to GamePersistenceService
     * to load and restore data, and then finalizing the engine state using #onGameReady().
     *
     * @param {string} saveIdentifier - The identifier for the save game to load.
     * @returns {Promise<{success: boolean, error?: string}>} A promise resolving to an object
     * indicating the success or failure of the load operation.
     * On success: `{ success: true }`.
     * On failure: `{ success: false, error: "Error message" }`.
     */
    async loadGame(saveIdentifier) {
        this.#logger?.info(`GameEngine: loadGame called for identifier: ${saveIdentifier}.`);

        if (!saveIdentifier || typeof saveIdentifier !== 'string' || saveIdentifier.trim() === '') {
            const errorMsg = 'GameEngine.loadGame requires a valid non-empty saveIdentifier argument.';
            this.#logger?.error(errorMsg);
            return {success: false, error: errorMsg};
        }

        if (this.isInitialized) {
            this.#logger?.warn("GameEngine.loadGame: Engine is already initialized. Stopping current game before loading.");
            await this.stop();
        }

        /** @type {LoadAndRestoreResult | undefined} */
        let loadRestoreResult;
        try {
            if (!this.#gamePersistenceService) {
                this.#logger?.error(`GameEngine.loadGame: GamePersistenceService is not available. Cannot load game for ${saveIdentifier}.`);
                throw new Error('GamePersistenceService is not available for loading game.');
            }
            loadRestoreResult = await this.#gamePersistenceService.loadAndRestoreGame(saveIdentifier);
        } catch (error) {
            this.#logger?.error(`GameEngine.loadGame: Unexpected error during loadAndRestoreGame for ${saveIdentifier}. ${error.message}.`, error);
            this.#isInitialized = false;
            if (this.#playtimeTracker) {
                this.#logger?.debug(`GameEngine.loadGame: Resetting PlaytimeTracker due to error in loadAndRestoreGame.`);
                this.#playtimeTracker.reset();
            }
            throw error;
        }

        if (loadRestoreResult && loadRestoreResult.success) {
            this.#logger?.info(`GameEngine.loadGame: Successfully loaded and restored state from ${saveIdentifier}.`);

            if (this.#playtimeTracker) {
                this.#logger?.debug(`GameEngine.loadGame: Starting new PlaytimeTracker session after successful load.`);
                this.#playtimeTracker.startSession();
            } else {
                this.#logger?.warn('GameEngine.loadGame: PlaytimeTracker not available, cannot start session after load.');
            }

            this.#logger?.info(`GameEngine.loadGame: Finalizing loaded game setup via #onGameReady...`);
            await this.#onGameReady();
            this.#logger?.info(`GameEngine.loadGame: Game ready with loaded state from ${saveIdentifier}.`);
            return {success: true};
        } else {
            const reason = loadRestoreResult?.error || 'Unknown failure from GamePersistenceService.loadAndRestoreGame.';
            this.#logger?.error(`GameEngine.loadGame: Failed to load game from ${saveIdentifier}. Reason: ${reason}`);
            this.#isInitialized = false;
            if (this.#playtimeTracker) {
                this.#logger?.debug(`GameEngine.loadGame: Resetting PlaytimeTracker due to failed game load.`);
                this.#playtimeTracker.reset();
            }
            return {success: false, error: reason};
        }
    }

    /**
     * Stops the game engine by delegating to the ShutdownService and resetting internal state.
     */
    async stop() {
        this.#logger?.info('GameEngine: Stop requested.');

        if (!this.isInitialized) {
            this.#logger?.info('GameEngine: Stop requested, but engine is not initialized. No action needed.');
            return;
        }

        if (this.#playtimeTracker) {
            this.#logger?.debug('GameEngine.stop: Ending current PlaytimeTracker session and accumulating time.');
            this.#playtimeTracker.endSessionAndAccumulate();
        }

        try {
            this.#logger?.debug('GameEngine: Resolving ShutdownService...');
            const shutdownService = /** @type {ShutdownService} */ (
                this.#container.resolve(tokens.ShutdownService)
            );
            this.#logger?.info('GameEngine: Executing shutdown sequence via ShutdownService...');
            await shutdownService.runShutdownSequence();
            this.#logger?.info('GameEngine: Shutdown sequence completed successfully via ShutdownService.');
        } catch (shutdownError) {
            this.#logger?.error('GameEngine: Error resolving or running ShutdownService.', shutdownError);
            this.#logger?.warn('GameEngine: Attempting minimal fallback cleanup after ShutdownService error...');
            try {
                const fallbackTurnManager = this.#container.resolve(tokens.ITurnManager);
                if (fallbackTurnManager && typeof fallbackTurnManager.stop === 'function') {
                    await fallbackTurnManager.stop();
                    this.#logger?.warn('GameEngine: Fallback - Manually stopped TurnManager.');
                }
            } catch (tmStopError) {
                this.#logger?.error('GameEngine: Fallback - Error stopping TurnManager directly.', tmStopError);
            }
            if (this.#container && typeof this.#container.disposeSingletons === 'function') {
                try {
                    this.#container.disposeSingletons();
                    this.#logger?.warn('GameEngine: Fallback - Manually disposed container singletons.');
                } catch (disposeError) {
                    this.#logger?.error('GameEngine: Fallback - Error disposing container singletons.', disposeError);
                }
            }
        } finally {
            this.#isInitialized = false;
            this.#logger?.info('GameEngine: Engine stop sequence finished, internal state reset (isInitialized = false).');
        }
    }

    /**
     * Triggers a manual save operation by delegating to GamePersistenceService.
     * @param {string} saveName - The desired name for the save file.
     * @returns {Promise<{success: boolean, message?: string, error?: string, filePath?: string}>}
     * A promise resolving to the outcome of the save operation.
     */
    async triggerManualSave(saveName) {
        this.#logger?.info(`GameEngine: Manual save triggered for name: "${saveName}"`);

        if (!this.#gamePersistenceService) {
            const errorMsg = 'GamePersistenceService is not available. Cannot save game.';
            this.#logger?.error(`GameEngine.triggerManualSave: ${errorMsg}`);
            return {success: false, error: errorMsg};
        }

        try {
            return await this.#gamePersistenceService.saveGame(saveName, this.isInitialized);
        } catch (error) {
            const errorMessage = (error && error.message) ? error.message : 'An unknown error occurred.';
            this.#logger?.error(`GameEngine.triggerManualSave: An unexpected error occurred while calling GamePersistenceService.saveGame for "${saveName}": ${errorMessage}`, error);
            return {success: false, error: `Unexpected error during save delegation: ${errorMessage}`};
        }
    }
}

export default GameEngine;