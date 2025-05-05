// src/core/gameEngine.js

// --- Type Imports ---
/** @typedef {import('./config/appContainer.js').default} AppContainer */
// GameLoop import removed as it's no longer directly referenced or returned
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./interfaces/ITurnManager.js').ITurnManager} ITurnManager */ // <<< ADDED for start/stop
// --- Refactoring: Import new services ---
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Keep for local resolution in start/stop
/** @typedef {import('./initializers/services/initializationService.js').default} InitializationService */
/** @typedef {import('./initializers/services/initializationService.js').InitializationResult} InitializationResult */
/** @typedef {import('./shutdown/services/shutdownService.js').default} ShutdownService */

// --- Import Tokens ---
import {tokens} from './config/tokens.js';


/**
 * Encapsulates the core game engine, managing state, coordinating initialization
 * via InitializationService, starting the game via TurnManager, and coordinating shutdown
 * via ShutdownService.
 */
class GameEngine {
    /** @private @type {AppContainer} */
    #container;
    // REMOVED: #gameLoop is no longer directly managed or started by GameEngine
    /** @private @type {boolean} */
    #isInitialized = false;
    /** @private @type {ILogger | null} */
    #logger = null; // Use console as fallback if logger is not provided/resolved

    // --- REMOVED Member Variables (Ticket 8) ---

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
            const loggerInstance = this.#container.resolve(tokens.ILogger);
            this.#logger = loggerInstance;
        } catch (error) {
            console.warn('GameEngine Constructor: Could not resolve ILogger dependency. Falling back to console for logging.', error);
            this.#logger = {info: console.info, warn: console.warn, error: console.error, debug: console.debug};
        }

        this.#logger.info('GameEngine: Instance created with AppContainer. Ready to start.');
    }

    /**
     * Checks if the game engine has been successfully initialized and hasn't been stopped.
     * @returns {boolean} True if the engine is considered initialized, false otherwise.
     */
    get isInitialized() {
        return this.#isInitialized;
    }

    // --- DELETED get gameLoop() method ---
    // /**
    //  * Gets the current GameLoop instance, or null if not initialized or stopped.
    //  * Primarily intended for testing or internal checks where direct access might be needed.
    //  * @returns {GameLoop | null} The current game loop instance or null.
    //  * @internal // Mark as internal if it's mainly for testing/advanced use
    //  * @deprecated Direct access to GameLoop is discouraged. Interact via events/TurnManager.
    //  */
    // get gameLoop() {
    //     // GameLoop is no longer stored directly in GameEngine after initialization.
    //     // If needed for tests, resolve it transiently.
    //     try {
    //         return this.#container.resolve(tokens.GameLoop);
    //     } catch (e) {
    //         this.#logger?.warn('GameEngine.gameLoop getter: Failed to resolve GameLoop. Engine might not be initialized or GameLoop registration is missing.', e);
    //         return null;
    //     }
    // }
    // --- End Deletion ---

    /**
     * Initializes the game using InitializationService and then starts the turn processing via TurnManager.
     * Handles errors during initialization setup and propagates errors from the initialization sequence.
     * Prevents turn processing from starting if initialization fails.
     * @param {string} worldName - The identifier of the world to load and start.
     * @returns {Promise<void>} A promise that resolves when the turn manager has successfully started, or rejects if initialization or startup fails.
     * @throws {Error} Throws an error if the worldName is invalid, if required services cannot be resolved/executed, or if the initialization sequence itself fails.
     */
    async start(worldName) {
        // --- Argument Validation ---
        if (!worldName || typeof worldName !== 'string' || worldName.trim() === '') {
            this.#logger?.error('GameEngine: Fatal Error - start() called without a valid worldName.');
            throw new Error('GameEngine.start requires a valid non-empty worldName argument.');
        }

        // --- Prevent Re-initialization ---
        if (this.isInitialized) {
            this.#logger?.warn(`GameEngine: start('${worldName}') called, but engine is already initialized. Ignoring.`);
            return;
        }

        this.#logger?.info(`GameEngine: Starting initialization sequence for world: ${worldName}...`);

        let initResult;
        let turnManager = null; // <<< Defined here for access in finally/catch
        try {
            // --- Resolve and Run Initialization Service ---
            const initializationService = /** @type {InitializationService} */ (
                this.#container.resolve(tokens.InitializationService)
            );
            this.#logger?.debug('GameEngine: InitializationService resolved.');
            initResult = await initializationService.runInitializationSequence(worldName);

            // --- Process Initialization Result ---
            if (!initResult.success) {
                // Initialization failed as reported by InitializationService.
                const failureReason = initResult.error?.message || 'Unknown initialization error';
                this.#logger?.error(`GameEngine: Initialization sequence failed for world '${worldName}'. Reason: ${failureReason}`, initResult.error);
                this.#isInitialized = false;
                // Propagate the error reported by the InitializationService.
                throw initResult.error || new Error(`Game engine initialization failed: ${failureReason}`);
            }

            // --- Handle Successful Initialization ---
            this.#logger?.info('GameEngine: Initialization sequence reported success.');
            this.#isInitialized = true;
            // REMOVED: Storing gameLoop locally

            // Resolve and Start TurnManager (Ticket 2.2 Task 3)
            this.#logger?.info('GameEngine: Resolving TurnManager...');
            turnManager = /** @type {ITurnManager} */ (
                this.#container.resolve(tokens.ITurnManager)
            );
            this.#logger?.info('GameEngine: Starting TurnManager...');
            await turnManager.start(); // Start turns via TurnManager
        } catch (error) {
            // --- Handle Critical Service Setup/Invocation or Initialization Errors ---
            this.#logger?.error(`GameEngine: CRITICAL ERROR during initialization or TurnManager startup for world '${worldName}'.`, error);
            this.#isInitialized = false; // Ensure state reflects failure
            // Attempt to stop TurnManager if it was resolved before error
            if (turnManager && typeof turnManager.stop === 'function') {
                try {
                    await turnManager.stop();
                    this.#logger.warn("GameEngine: Attempted to stop TurnManager after startup error.");
                } catch (stopError) {
                    this.#logger.error("GameEngine: Error stopping TurnManager during error handling.", stopError);
                }
            }
            throw error; // Re-throw critical setup/initialization/startup error
        }
    }


    /**
     * Stops the game engine by delegating to the ShutdownService and resetting internal state.
     * This includes stopping the turn processing (via TurnManager), cleaning up systems, and disposing resources.
     */
    async stop() {
        this.#logger?.info('GameEngine: Stop requested.');

        // Use getter - check initialization state
        if (!this.isInitialized) {
            this.#logger?.info('GameEngine: Stop requested, but engine is not initialized. No action needed.');
            return;
        }

        // --- Delegate to Shutdown Service ---
        try {
            this.#logger?.debug('GameEngine: Resolving ShutdownService...');
            const shutdownService = /** @type {ShutdownService} */ (
                this.#container.resolve(tokens.ShutdownService)
            );
            this.#logger?.info('GameEngine: Executing shutdown sequence via ShutdownService...');

            await shutdownService.runShutdownSequence(); // Delegates shutdown

            this.#logger?.info('GameEngine: Shutdown sequence completed successfully via ShutdownService.');

        } catch (shutdownError) {
            this.#logger?.error('GameEngine: Error resolving or running ShutdownService.', shutdownError);
            // Optional: Minimal fallback could try resolving TurnManager directly, but ShutdownService should handle internal errors.
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
            // --- Reset Internal State ---
            this.#isInitialized = false;
            // REMOVED: #gameLoop = null;

            console.log('GameEngine: Engine stop sequence finished, internal state reset.');
            this.#logger?.info('GameEngine: Engine stop sequence finished, internal state reset.');
        }
    }

    // --- REMOVED #initialize Method (Ticket 8) ---
}

export default GameEngine;