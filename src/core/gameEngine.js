// src/core/gameEngine.js

// --- Type Imports ---
/** @typedef {import('./config/appContainer.js').default} AppContainer */
/** @typedef {import('./gameLoop.js').default} GameLoop */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
// --- Refactoring: Import new services ---
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Keep for local resolution in start/stop
/** @typedef {import('./initializers/services/initializationService.js').default} InitializationService */ // <<< ADDED for delegation
/** @typedef {import('./initializers/services/initializationService.js').InitializationResult} InitializationResult */ // <<< ADDED for delegation
/** @typedef {import('./shutdown/services/shutdownService.js').default} ShutdownService */ // <<< ADDED for delegation

// --- Import Tokens --- <<< ADDED
import {tokens} from './config/tokens.js';


/**
 * Encapsulates the core game engine, managing state, coordinating initialization
 * via InitializationService, starting the game loop, and coordinating shutdown
 * via ShutdownService.
 */
class GameEngine {
    /** @private @type {AppContainer} */
    #container;
    /** @private @type {GameLoop | null} */
    #gameLoop = null;
    /** @private @type {boolean} */
    #isInitialized = false;
    /** @private @type {ILogger | null} */
    #logger = null; // Use console as fallback if logger is not provided/resolved

    // --- REMOVED Member Variables (Ticket 8) ---
    // /** @private @type {GameDataRepository | null} */
    // #gameDataRepository = null; // Now handled transiently by InitializationService/ShutdownService
    // /** @private @type {ValidatedEventDispatcher | null} */
    // #validatedEventDispatcher = null; // Now resolved locally when needed or handled by services

    /**
     * Creates a new GameEngine instance.
     * @param {object} options
     * @param {AppContainer} options.container - The application's dependency container.
     */
    constructor({container}) {
        if (!container) {
            // Cannot use logger here as it's not resolved yet
            console.error('GameEngine requires a valid AppContainer instance.');
            throw new Error('GameEngine requires a valid AppContainer instance.');
        }
        this.#container = container;

        // --- Resolve logger early ---
        try {
            // Use a temporary variable in case resolution fails before assignment
            const loggerInstance = this.#container.resolve(tokens.ILogger); // Use token
            this.#logger = loggerInstance;
        } catch (error) {
            console.warn('GameEngine Constructor: Could not resolve ILogger dependency. Falling back to console for logging.', error);
            this.#logger = { // Basic fallback logger
                info: console.info, warn: console.warn, error: console.error, debug: console.debug,
            };
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

    /**
     * Gets the current GameLoop instance, or null if not initialized or stopped.
     * Primarily intended for testing or internal checks where direct access might be needed.
     * @returns {GameLoop | null} The current game loop instance or null.
     * @internal // Mark as internal if it's mainly for testing/advanced use
     */
    get gameLoop() {
        return this.#gameLoop;
    }

    /**
     * Initializes the game using InitializationService and then starts the game loop.
     * Handles errors during initialization setup and propagates errors from the initialization sequence.
     * Prevents the game loop from starting if initialization fails.
     * @param {string} worldName - The identifier of the world to load and start.
     * @returns {Promise<void>} A promise that resolves when the game loop has successfully started, or rejects if initialization or startup fails.
     * @throws {Error} Throws an error if the worldName is invalid, if the InitializationService cannot be resolved/executed, or if the initialization sequence itself fails (propagated from InitializationService).
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
        try {
            // --- Resolve and Run Initialization Service ---
            const initializationService = /** @type {InitializationService} */ (
                this.#container.resolve(tokens.InitializationService) // Use token
            );
            this.#logger?.debug('GameEngine: InitializationService resolved.');
            initResult = await initializationService.runInitializationSequence(worldName);

        } catch (error) {
            // --- Handle Critical Service Setup/Invocation Errors ---
            this.#logger?.error(`GameEngine: CRITICAL ERROR during initialization service setup or invocation for world '${worldName}'.`, error);
            this.#isInitialized = false; // Ensure state reflects failure
            this.#gameLoop = null;
            throw error; // Re-throw critical setup error
        }

        // --- Process Initialization Result ---
        if (initResult.success) {
            // --- Handle Successful Initialization Report ---
            this.#logger?.info('GameEngine: Initialization sequence reported success.');

            // Explicitly check for the contract violation: success reported but no game loop provided.
            if (!initResult.gameLoop) {
                const inconsistentStateError = new Error('GameEngine: Inconsistent state - Initialization reported success but provided no GameLoop.');
                this.#logger?.error(inconsistentStateError.message);
                this.#isInitialized = false; // Reset state on inconsistency
                this.#gameLoop = null;
                throw inconsistentStateError; // Throw the specific error for this scenario
            }

            // --- Proceed with Valid Successful Initialization ---
            this.#isInitialized = true;
            this.#gameLoop = initResult.gameLoop; // Store the provided game loop

            // Start the game loop (using the getter for consistency)
            this.#logger?.info('GameEngine: Starting GameLoop...');
            await this.gameLoop.start();
            this.#logger?.info('GameEngine: GameLoop started successfully.');

            // --- Dispatch Post-Start Message (Optional) ---
            try {
                // --- FIXED: Use the correct token for resolution --- <<< FIXED
                const dispatcher = /** @type {ValidatedEventDispatcher} */ (
                    this.#container.resolve(tokens.IValidatedEventDispatcher)
                );
                await dispatcher.dispatchValidated('textUI:display_message', {
                    text: 'Game loop started.',
                    type: 'info'
                });
            } catch (dispatchError) {
                // Log failure but don't halt execution
                // --- FIXED: Update error message to reflect token usage --- <<< FIXED
                this.#logger?.error(`GameEngine: Failed to resolve or use ${tokens.IValidatedEventDispatcher} to send post-start message.`, dispatchError);
            }

        } else {
            // --- Handle Failed Initialization Report ---
            // Initialization failed as reported by InitializationService.
            // Logging/Events are assumed to be handled within the service.
            const failureReason = initResult.error?.message || 'Unknown initialization error';
            this.#logger?.error(`GameEngine: Initialization sequence failed for world '${worldName}'. Reason: ${failureReason}`, initResult.error);

            // Ensure engine state reflects failure.
            this.#isInitialized = false;
            this.#gameLoop = null;

            // Propagate the error reported by the InitializationService.
            throw initResult.error || new Error(`Game engine initialization failed: ${failureReason}`);
        }
    }


    /**
     * Stops the game engine by delegating to the ShutdownService and resetting internal state.
     * This includes stopping the game loop, cleaning up systems, and disposing resources.
     * Old complex shutdown logic is removed as per Ticket 11.
     */
    async stop() {
        // Log initiation (Task 6 - part 1)
        this.#logger?.info('GameEngine: Stop requested.');

        // Check if already stopped or never initialized - Use getters
        if (!this.isInitialized && !this.gameLoop) { // <<< Use getters
            this.#logger?.info('GameEngine: Stop requested, but engine is already stopped or was never initialized. No action needed.');
            return;
        }

        // --- Replace body with delegation (Task 1) ---
        try {
            // Resolve ShutdownService (Task 2)
            this.#logger?.debug('GameEngine: Resolving ShutdownService...');
            const shutdownService = /** @type {ShutdownService} */ (
                this.#container.resolve(tokens.ShutdownService) // Use token
            );
            this.#logger?.info('GameEngine: Executing shutdown sequence via ShutdownService...');

            // Call ShutdownService (Task 3)
            await shutdownService.runShutdownSequence(); // Delegates shutdown (AC2)

            this.#logger?.info('GameEngine: Shutdown sequence completed successfully via ShutdownService.');

        } catch (shutdownError) {
            // Log errors from the service call (Task 4)
            this.#logger?.error('GameEngine: Error resolving or running ShutdownService.', shutdownError);
            // Optional: Keep minimal fallback logic for robustness, although not strictly required by ticket.
            // This part is no longer the primary shutdown path (AC1)
            this.#logger?.warn('GameEngine: Attempting minimal fallback cleanup after ShutdownService error...');
            // Use getter to access gameLoop for check
            if (this.gameLoop && typeof this.gameLoop.stop === 'function' /* && this.gameLoop.isRunning */) { // isRunning might be on mock, not reliable here
                try {
                    this.gameLoop.stop(); // Use getter
                    this.#logger?.warn('GameEngine: Fallback - Manually stopped GameLoop.');
                } catch (loopStopError) {
                    this.#logger?.error('GameEngine: Fallback - Error stopping GameLoop directly.', loopStopError);
                }
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
            // --- Reset Internal State (Task 5 & AC3) ---
            this.#isInitialized = false;
            this.#gameLoop = null; // Release reference

            // Log completion (Task 6 - part 2)
            console.log('GameEngine: Engine stop sequence finished, internal state reset.'); // Keep console log for visibility
            this.#logger?.info('GameEngine: Engine stop sequence finished, internal state reset.');
        }
        // --- Complex shutdown logic (stopping loop, iterating systems, disposing container) is removed from primary path (AC1) ---
    }

    // --- REMOVED #initialize Method (Ticket 8) ---
    // The private #initialize method has been removed. Its responsibilities
    // are now handled by the InitializationService, which is called from the start() method.
}

export default GameEngine;