// src/core/gameEngine.js

// --- Type Imports ---
/** @typedef {import('./appContainer.js').default} AppContainer */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./inputHandler.js').default} InputHandler */
/** @typedef {import('./gameLoop.js').default} GameLoop */
/** @typedef {import('./gameStateInitializer.js').default} GameStateInitializer */
/** @typedef {import('./worldInitializer.js').default} WorldInitializer */
/** @typedef {import('./services/worldLoader.js').default} WorldLoader */
/** @typedef {import('./services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
// --- Refactoring: Import new services ---
/** @typedef {import('../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('./initializers/systemInitializer.js').default} SystemInitializer */ // Added for type hinting
/** @typedef {import('./setup/inputSetupService.js').default} InputSetupService */ // AC2: Added JSDoc type import

/**
 * Encapsulates core game systems, manages initialization using a dependency container,
 * orchestrates the game start, and uses ValidatedEventDispatcher for event dispatches.
 */
class GameEngine {
    /** @type {AppContainer} */
    #container;
    // /** @type {EventBus | null} */ // REMOVED: No longer a member variable
    // #eventBus = null;
    /** @type {GameLoop | null} */
    #gameLoop = null;
    /** @type {boolean} */
    #isInitialized = false;

    // --- Core Service Dependencies ---
    /** @private @type {GameDataRepository | null} */
    #gameDataRepository = null;
    /** @private @type {ILogger | null} */
    #logger = null; // Use console as fallback if logger is not provided/resolved
    /** @private @type {ValidatedEventDispatcher | null} */ // Refactoring: Added
    #validatedDispatcher = null;


    /**
     * Creates a new GameEngine instance.
     * @param {object} options
     * @param {AppContainer} options.container - The application's dependency container.
     */
    constructor({container}) {
        if (!container) {
            throw new Error('GameEngine requires a valid AppContainer instance.');
        }
        this.#container = container;

        // --- Resolve logger early ---
        try {
            this.#logger = this.#container.resolve('ILogger');
        } catch (error) {
            console.warn('GameEngine Constructor: Could not resolve ILogger dependency. Falling back to console for logging.', error);
            this.#logger = { // Basic fallback logger
                info: console.info, warn: console.warn, error: console.error, debug: console.debug,
            };
        }

        this.#logger.info('GameEngine: Instance created with AppContainer. Ready to initialize.');
    }

    /**
     * Initializes all core game systems asynchronously.
     * @param {string} worldName - The identifier of the world to load.
     * @returns {Promise<boolean>} True if initialization succeeded, false otherwise.
     * @private
     */
    async #initialize(worldName) {
        if (!worldName) {
            (this.#logger || console).error('GameEngine.#initialize requires a worldName parameter.');
            throw new Error('GameEngine.#initialize requires a worldName parameter.');
        }
        this.#logger?.info(`GameEngine: Starting initialization sequence for world: ${worldName}...`);

        try {
            // --- Resolve core components early ---
            if (!this.#logger) {
                console.error('GameEngine.#initialize: Logger is unexpectedly null. Initialization cannot reliably proceed.');
                throw new Error('Logger unavailable during initialization.');
            }

            this.#gameDataRepository = this.#container.resolve('GameDataRepository');
            this.#logger.info('GameEngine: GameDataRepository resolved.');
            this.#validatedDispatcher = this.#container.resolve('ValidatedEventDispatcher');
            this.#logger.info('GameEngine: ValidatedEventDispatcher resolved.');

            this.#container.resolve('DomRenderer'); // Resolve early for UI updates
            this.#logger.info('GameEngine: DomRenderer resolved.');

            const earlyDispatchOptions = {allowSchemaNotFound: true};
            await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: 'Initializing Engine...'}, earlyDispatchOptions);
            await this.#validatedDispatcher.dispatchValidated('event:display_message', {
                text: 'Initializing core systems...',
                type: 'info'
            }, earlyDispatchOptions);


            // --- Load Data (using WorldLoader) ---
            await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: `Loading Game Data for ${worldName}...`}, earlyDispatchOptions);
            await this.#validatedDispatcher.dispatchValidated('event:display_message', {
                text: `Loading world data for '${worldName}' via WorldLoader...`,
                type: 'info'
            }, earlyDispatchOptions);

            const worldLoader = this.#container.resolve('WorldLoader');
            await worldLoader.loadWorld(worldName);

            this.#logger.info(`GameEngine: WorldLoader resolved and finished loading for world: ${worldName}.`);
            await this.#validatedDispatcher.dispatchValidated('event:display_message', {
                text: `World data for '${worldName}' loading process complete.`,
                type: 'info'
            });

            // --- Core Game Setup (Player & Starting Location via Service) ---
            await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: 'Setting Initial Game State...'});
            await this.#validatedDispatcher.dispatchValidated('event:display_message', {
                text: 'Setting initial game state...',
                type: 'info'
            });

            const gameStateInitializer = this.#container.resolve('GameStateInitializer');
            // *** NOTE: GameStateInitializer.setupInitialState now handles the initial event:room_entered dispatch ***
            const setupSuccess = await gameStateInitializer.setupInitialState(); // Await the async setup
            if (!setupSuccess) {
                throw new Error('Initial game state setup failed via GameStateInitializer. Check logs.');
            }
            this.#logger.info('GameEngine: Initial game state setup completed via GameStateInitializer.');

            // --- Instantiate Other Initial Entities & Build Spatial Index ---
            await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: 'Initializing World Entities...'});
            await this.#validatedDispatcher.dispatchValidated('event:display_message', {
                text: 'Instantiating world entities...',
                type: 'info'
            });

            const worldInitializer = this.#container.resolve('WorldInitializer');
            const worldInitSuccess = worldInitializer.initializeWorldEntities();
            if (!worldInitSuccess) {
                throw new Error('World initialization failed via WorldInitializer.');
            }
            this.#logger.info('GameEngine: Initial world entities instantiated and spatial index built via WorldInitializer.');


            // --- Configure Input Handler ---
            this.#logger.info('GameEngine: Delegating input handler setup to InputSetupService...');
            const inputSetupService = /** @type {InputSetupService} */ (this.#container.resolve('InputSetupService'));
            inputSetupService.configureInputHandler(); // AC2 Location Dependency


            // --- Resolve Game Loop ---
            this.#gameLoop = this.#container.resolve('GameLoop'); // AC2 Location Dependency
            this.#logger.info('GameEngine: GameLoop resolved.');


            // --- Dispatch event:engine_initialized Event (Ticket 6.2 START) ---
            // This event now triggers WelcomeMessageService to handle the welcome messages.
            this.#logger.info('GameEngine: Dispatching event:engine_initialized event...');
            await this.#validatedDispatcher.dispatchValidated(
                'event:engine_initialized', // Event Name
                {inputWorldName: worldName}, // Payload
                {} // Options
            );
            // --- Dispatch event:engine_initialized Event (Ticket 6.2 END) ---


            this.#isInitialized = true;
            this.#logger.info(`GameEngine: Initialization sequence for world '${worldName}' completed successfully.`);
            // Note: The final "Initialization Complete. Starting..." title/message might be quickly overwritten
            // by the WelcomeMessageService triggered by event:engine_initialized, which is expected.
            await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: 'Initialization Complete. Starting...'});
            await this.#validatedDispatcher.dispatchValidated('event:display_message', {
                text: 'Initialization complete.',
                type: 'success'
            });

            return true;

        } catch (error) {
            // AC6: Existing error handling is untouched
            (this.#logger || console).error(`GameEngine: CRITICAL ERROR during initialization sequence for world '${worldName}':`, error);
            const errorMsg = `Game initialization failed: ${error.message}. Check console (F12) for details.`;

            if (this.#validatedDispatcher) {
                try {
                    await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: 'Fatal Initialization Error!'});
                    await this.#validatedDispatcher.dispatchValidated('event:display_message', {
                        text: errorMsg,
                        type: 'error'
                    });
                    await this.#validatedDispatcher.dispatchValidated('ui:disable_input', {message: 'Error during startup.'});
                } catch (dispatchError) {
                    (this.#logger || console).error('GameEngine: Failed to dispatch error messages via ValidatedDispatcher during initialization failure:', dispatchError);
                }
            } else {
                (this.#logger || console).error('GameEngine: ValidatedEventDispatcher not available to display initialization error.');
            }

            try {
                const inputHandler = this.#container.resolve('InputHandler');
                if (inputHandler && typeof inputHandler.disable === 'function') inputHandler.disable();
                const inputElement = this.#container.resolve('inputElement');
                if (inputElement) inputElement.disabled = true;
            } catch (disableError) {
                (this.#logger || console).error('GameEngine: Could not resolve InputHandler or inputElement to disable on error during initialization failure.', disableError);
            }

            this.#isInitialized = false;
            throw error;
        }
    }

    /**
     * Starts the game engine after successful initialization.
     * Retrieves world name using GameDataRepository.
     * @param {string} worldName - The identifier of the world that was loaded.
     * @returns {Promise<void>}
     */
    async start(worldName) {
        // Argument validation (remains the same)
        if (!worldName) {
            this.#logger?.error('GameEngine: Fatal Error - start() called without providing a worldName.');
            alert('Fatal Error: No world specified to start the game engine. Application cannot continue.');
            try {
                const inputElement = this.#container.resolve('inputElement');
                if (inputElement) inputElement.disabled = true;
                const titleElement = this.#container.resolve('titleElement');
                if (titleElement) titleElement.textContent = 'Fatal Error!';
            } catch (e) {
                this.#logger?.error('GameEngine start(): Failed to disable UI elements on missing worldName error.', e);
            }
            throw new Error('GameEngine.start requires a worldName argument.');
        }

        try {
            // Call initialize. If it throws, the outer catch will handle it.
            await this.#initialize(worldName);

            // --- Simplified Post-Initialization Check (Ticket 5 / AC1) ---
            if (this.#isInitialized && this.#gameLoop) {
                // Dependencies like logger, gameDataRepository, validatedDispatcher are assumed
                // to be present if #isInitialized is true, as #initialize should have thrown otherwise.
                this.#logger.info('GameEngine: Initialization successful. Starting GameLoop...');

                // Start the game loop
                this.#gameLoop.start(); // Start the loop using the guaranteed #gameLoop reference
                this.#logger.info('GameEngine: GameLoop started.');

                // Display message indicating the loop has started (this is different from the welcome message)
                await this.#validatedDispatcher.dispatchValidated('event:display_message', {
                    text: 'Game loop started. Good luck!', type: 'info'
                });

            } else {
                // --- Simplified Else Block (Ticket 5 / AC2 - Remains Intact) ---
                const failureReason = !this.#isInitialized
                    ? '#isInitialized is false (initialization likely failed or incomplete)'
                    : '#gameLoop is null post-initialization';

                this.#logger.error(`GameEngine: Cannot start GameLoop. ${failureReason}.`);

                if (this.#validatedDispatcher) {
                    try {
                        await this.#validatedDispatcher.dispatchValidated('event:display_message', {
                            text: `Engine failed to start: ${failureReason}. Check logs.`, type: 'error'
                        });
                        await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: 'Engine Start Failed'});
                    } catch (dispatchError) {
                        this.#logger.error('GameEngine: Failed to dispatch error message in start() else block:', dispatchError);
                    }
                }
                throw new Error(`Inconsistent engine state after initialization: ${failureReason}.`);
            }
        } catch (error) {
            // Outer catch handles errors from #initialize() or from the post-init logic block
            this.#logger?.error(`GameEngine: Error during the start process for world '${worldName}':`, error);
            // Final attempt to disable UI (remains the same)
            try { /* UI disable */
                const inputElement = this.#container.resolve('inputElement');
                if (inputElement) inputElement.disabled = true;
                const titleElement = this.#container.resolve('titleElement');
                if (titleElement) titleElement.textContent = 'Fatal Start Error!';
            } catch (finalError) { /* log */
                this.#logger?.error('GameEngine start(): Failed to disable UI elements on start error.', finalError);
            }
            throw error; // Re-throw the original error
        }
    }

    /**
     * Stops the game loop and performs necessary cleanup.
     */
    stop() {
        this.#logger?.info('GameEngine: Stop requested.');
        if (this.#gameLoop && this.#gameLoop.isRunning) {
            this.#gameLoop.stop();
            this.#logger?.info('GameEngine: GameLoop stopped.');
        } else {
            this.#logger?.info('GameEngine: GameLoop already stopped or not initialized.');
        }

        // Call shutdown on systems that might need it
        try {
            const systemsWithShutdown = ['WorldPresenceSystem']; // Add others if needed
            for (const key of systemsWithShutdown) {
                try {
                    const system = this.#container.resolve(key);
                    if (system && typeof system.shutdown === 'function') {
                        this.#logger?.info(`GameEngine: Shutting down system: ${key}...`);
                        system.shutdown(); // Assuming synchronous
                    }
                } catch (resolveError) {
                    this.#logger?.warn(`GameEngine: Could not resolve system '${key}' during shutdown.`, resolveError);
                }
            }
        } catch (error) {
            this.#logger?.error('GameEngine: Error during system shutdown:', error);
        }

        // Dispose container singletons if method exists
        if (this.#container) {
            if (typeof this.#container.disposeSingletons === 'function') {
                this.#logger?.info('GameEngine: Disposing container singletons...');
                try {
                    this.#container.disposeSingletons();
                } catch (disposeError) {
                    this.#logger?.error('GameEngine: Error during container singleton disposal:', disposeError);
                }
            } else {
                this.#logger?.warn('GameEngine: Container does not have a disposeSingletons method.');
            }
        }

        // Reset internal state
        this.#isInitialized = false;
        this.#gameLoop = null;
        this.#gameDataRepository = null;
        this.#validatedDispatcher = null; // Refactoring: Clear new service
        // Logger persists potentially
        console.log('GameEngine: Engine stopped and internal state reset.'); // Keep console log for clarity during stop
        this.#logger?.info('GameEngine: Engine stopped and internal state reset.'); // Also log via logger if available
    }
}

export default GameEngine;