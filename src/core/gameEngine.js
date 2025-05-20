// src/core/gameEngine.js

// --- Type Imports ---
/** @typedef {import('./config/appContainer.js').default} AppContainer */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('./initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('./initializers/services/initializationService.js').InitializationResult} InitializationResult */
/** @typedef {import('./shutdown/services/shutdownService.js').default} ShutdownService */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */ // Type hint for the concrete class
/** @typedef {import('../entities/interfaces/IEntityManager.js').IEntityManager} IEntityManagerResolved */ // Type hint for the resolved interface
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../services/playtimeTracker.js').default} PlaytimeTracker */
/** @typedef {import('../services/gamePersistenceService.js').default} GamePersistenceService */
/** @typedef {import('../services/gamePersistenceService.js').LoadAndRestoreResult} LoadAndRestoreResult */


// --- Import Tokens ---
import {tokens} from './config/tokens.js';
// OriginalEntity import remains if EntityManager or other parts still conceptually use it,
// even if not directly instantiated in this file after restoreState removal.
// For now, assuming it might be needed by other parts of the system that GameEngine interacts with.
import OriginalEntity from '../entities/entity.js';

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
    /** @private @type {IEntityManagerResolved | null} */ // Changed to use the interface type for the resolved instance
    #entityManager = null;
    /** @private @type {PlaytimeTracker | null} */
    #playtimeTracker = null;
    /** @private @type {GamePersistenceService | null} */
    #gamePersistenceService = null;

    /**
     * @private
     * @method #resolveDependency
     * @description Resolves a dependency from the AppContainer, with standardized error handling and fallback.
     * @param {symbol} token - The token to resolve.
     * @param {string} serviceNameString - A string representation of the service name for error messages.
     * @param {(message: string, error?: Error) => void} errorHandlerCallback - Callback to handle errors.
     * @param {boolean} [isLoggerFallback=false] - If true and token is ILogger, falls back to console on error.
     * @returns {any | null} The resolved service or null/console fallback on error.
     */
    #resolveDependency(token, serviceNameString, errorHandlerCallback, isLoggerFallback = false) {
        try {
            return this.#container.resolve(token);
        } catch (error) {
            const errorMessage = `GameEngine Constructor: Could not resolve ${serviceNameString}.`;
            if (isLoggerFallback && token === tokens.ILogger) {
                console.warn(`${errorMessage} Falling back to console for initial error logging.`, error);
                return {
                    info: console.info,
                    warn: console.warn,
                    error: console.error,
                    debug: console.debug
                };
            }
            // Use the provided errorHandlerCallback, which should ideally use an already resolved logger or console.
            errorHandlerCallback(`${errorMessage} Dependent features may not function.`, error);
            return null; // Indicate resolution failure
        }
    }

    /**
     * Creates a new GameEngine instance.
     * @param {object} options
     * @param {AppContainer} options.container - The application's dependency container.
     */
    constructor({container}) {
        if (!container) {
            // Fallback to console.error if logger is not even attempted to be resolved.
            console.error('GameEngine requires a valid AppContainer instance.');
            throw new Error('GameEngine requires a valid AppContainer instance.');
        }
        this.#container = container;

        // --- Resolve Logger First (with special fallback handling) ---
        this.#logger = /** @type {ILogger} */ (this.#resolveDependency(
            tokens.ILogger,
            'ILogger',
            (msg, err) => console.warn(msg, err), // Fallback error handler for the logger itself
            true // isLoggerFallback = true
        ));

        // --- Resolve Other Core Dependencies ---
        this.#entityManager = /** @type {IEntityManagerResolved} */ (this.#resolveDependency(
            tokens.IEntityManager, // <<< CORRECTED TOKEN
            'IEntityManager', // Changed string to reflect interface token
            (msg, err) => this.#logger.error(msg, err)
        ));
        if (!this.#entityManager) {
            const errorMsg = 'GameEngine Constructor: CRITICAL - IEntityManager failed to resolve. New game start will fail.';
            this.#logger.error(errorMsg); // Log using the potentially fallback logger
            throw new Error('Critical: IEntityManager failed to resolve.'); // Updated error message
        }

        this.#playtimeTracker = /** @type {PlaytimeTracker} */ (this.#resolveDependency(
            tokens.PlaytimeTracker,
            'PlaytimeTracker',
            (msg, err) => this.#logger.error(msg, err)
        ));
        if (!this.#playtimeTracker) {
            const errorMsg = 'GameEngine Constructor: CRITICAL - Could not resolve PlaytimeTracker. Playtime features and save/load will fail.';
            this.#logger.error(errorMsg);
            throw new Error('Critical: PlaytimeTracker failed to resolve.');
        }

        this.#gamePersistenceService = /** @type {GamePersistenceService} */ (this.#resolveDependency(
            tokens.GamePersistenceService,
            'GamePersistenceService',
            (msg, err) => this.#logger.error(msg, err)
        ));
        if (!this.#gamePersistenceService) {
            const errorMsg = 'GameEngine Constructor: CRITICAL - Could not resolve GamePersistenceService. Manual save operations will fail.';
            this.#logger.error(errorMsg);
            throw new Error('Critical: GamePersistenceService failed to resolve.');
        } else {
            // Re-added log message for GamePersistenceService successful resolution
            this.#logger.info('GameEngine Constructor: GamePersistenceService resolved successfully.');
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
            return;
        }

        this.#logger?.info(`GameEngine: Starting NEW GAME initialization sequence for world: ${worldName}...`);

        try {
            if (this.#entityManager) {
                this.#logger?.debug('GameEngine: Clearing EntityManager before new game initialization.');
                this.#entityManager.clearAll();
            } else {
                // This case should ideally not be reached if constructor throws on failed EntityManager resolution.
                this.#logger?.error('GameEngine: EntityManager is not available. Cannot clear before new game.');
                throw new Error('EntityManager not available for new game start.');
            }

            const initializationService = /** @type {InitializationService} */ (
                this.#container.resolve(tokens.InitializationService)
            );
            this.#logger?.debug('GameEngine: InitializationService resolved for new game.');
            const initResult = await initializationService.runInitializationSequence(worldName);

            if (!initResult.success) {
                const failureReason = initResult.error?.message || 'Unknown initialization error';
                this.#logger?.error(`GameEngine: New game initialization sequence failed for world '${worldName}'. Reason: ${failureReason}`, initResult.error);
                this.#isInitialized = false;
                if (this.#playtimeTracker) {
                    this.#logger?.debug('GameEngine: Resetting PlaytimeTracker due to failed initialization sequence.');
                    this.#playtimeTracker.reset();
                }
                throw initResult.error || new Error(`Game engine new game initialization failed: ${failureReason}`);
            }

            this.#logger?.info('GameEngine: New game initialization sequence reported success.');

            if (this.#playtimeTracker) {
                this.#logger?.debug('GameEngine: Resetting PlaytimeTracker for new game session.');
                this.#playtimeTracker.reset();
                this.#logger?.debug('GameEngine: Starting new PlaytimeTracker session.');
                this.#playtimeTracker.startSession();
            } else {
                this.#logger?.warn('GameEngine: PlaytimeTracker not available, cannot reset or start session for new game.');
            }

            this.#logger?.info('GameEngine: Finalizing new game setup via #onGameReady...');
            await this.#onGameReady();
            this.#logger?.info(`GameEngine: New game '${worldName}' started successfully and is ready.`);

        } catch (error) {
            this.#logger?.error(`GameEngine: CRITICAL ERROR during new game initialization or startup for world '${worldName}'.`, error);
            this.#isInitialized = false;
            if (this.#playtimeTracker) {
                this.#logger?.debug('GameEngine: Resetting PlaytimeTracker due to critical error during new game start.');
                this.#playtimeTracker.reset();
            }
            throw error;
        }
    }

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
                const errorMsg = `GameEngine.loadGame: GamePersistenceService is not available. Cannot load game for ${saveIdentifier}.`;
                this.#logger?.error(errorMsg);
                throw new Error('GamePersistenceService is not available for loading game.');
            }
            loadRestoreResult = await this.#gamePersistenceService.loadAndRestoreGame(saveIdentifier);

        } catch (error) {
            this.#logger?.error(`GameEngine.loadGame: Error during loadAndRestoreGame for ${saveIdentifier}. ${error.message}.`, error);
            this.#isInitialized = false;
            if (this.#playtimeTracker) {
                this.#logger?.debug(`GameEngine.loadGame: Resetting PlaytimeTracker due to error in loadAndRestoreGame.`);
                this.#playtimeTracker.reset();
            }
            return {success: false, error: `Error during game load/restore: ${error.message}`};
        }

        if (loadRestoreResult && loadRestoreResult.success) {
            this.#logger?.info(`GameEngine.loadGame: Successfully loaded and restored state from ${saveIdentifier} via GamePersistenceService.`);

            if (this.#playtimeTracker) {
                this.#logger?.debug(`GameEngine.loadGame: Starting PlaytimeTracker session after successful load.`);
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
                const fallbackTurnManager = /** @type {ITurnManager} */ (this.#container.resolve(tokens.ITurnManager));
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