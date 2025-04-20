// src/core/gameEngine.js

// --- Type Imports ---
/** @typedef {import('./appContainer.js').default} AppContainer */
/** @typedef {import('./eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./inputHandler.js').default} InputHandler */
/** @typedef {import('./gameLoop.js').default} GameLoop */
/** @typedef {import('../components/positionComponent.js').PositionComponent} PositionComponent */
/** @typedef {import('./gameStateInitializer.js').default} GameStateInitializer */
/** @typedef {import('./worldInitializer.js').default} WorldInitializer */
/** @typedef {import('./services/worldLoader.js').default} WorldLoader */
/** @typedef {import('./services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('./interfaces/coreServices.js').ILogger} ILogger */
// --- Refactoring: Import new service ---
/** @typedef {import('./services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

// --- Component Class Imports ---
import RegistryInitializer from './registryInitializer.js';

/**
 * Encapsulates core game systems, manages initialization using a dependency container,
 * orchestrates the game start, and uses ValidatedEventDispatcher for event dispatches.
 */
class GameEngine {
    /** @type {AppContainer} */
    #container;
    /** @type {EventBus | null} */
    #eventBus = null;
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
            throw new Error("GameEngine requires a valid AppContainer instance.");
        }
        this.#container = container;

        // --- Resolve logger early ---
        try {
            this.#logger = this.#container.resolve('ILogger');
        } catch (error) {
            console.warn("GameEngine Constructor: Could not resolve ILogger dependency. Falling back to console for logging.", error);
            this.#logger = { // Basic fallback logger
                info: console.info, warn: console.warn, error: console.error, debug: console.debug,
            };
        }

        this.#logger.info("GameEngine: Instance created with AppContainer. Ready to initialize.");
    }

    /**
     * Initializes all core game systems asynchronously.
     * @param {string} worldName - The identifier of the world to load.
     * @returns {Promise<boolean>} True if initialization succeeded, false otherwise.
     * @private
     */
    async #initialize(worldName) {
        if (!worldName) {
            (this.#logger || console).error("GameEngine.#initialize requires a worldName parameter.");
            throw new Error("GameEngine.#initialize requires a worldName parameter.");
        }
        this.#logger?.info(`GameEngine: Starting initialization sequence for world: ${worldName}...`);

        try {
            // --- Resolve core components early ---
            if (!this.#logger) {
                console.error("GameEngine.#initialize: Logger is unexpectedly null. Initialization cannot reliably proceed.");
                throw new Error("Logger unavailable during initialization.");
            }

            this.#eventBus = this.#container.resolve('EventBus');
            this.#logger.info("GameEngine: EventBus resolved.");
            this.#gameDataRepository = this.#container.resolve('GameDataRepository');
            this.#logger.info("GameEngine: GameDataRepository resolved.");
            // --- Refactoring: Resolve new dispatcher, remove direct schema validator if unused ---
            this.#validatedDispatcher = this.#container.resolve('ValidatedEventDispatcher');
            this.#logger.info("GameEngine: ValidatedEventDispatcher resolved.");

            this.#container.resolve('DomRenderer'); // Resolve early for UI updates
            this.#logger.info("GameEngine: DomRenderer resolved.");

            // --- Use ValidatedEventDispatcher WITH OPTION for early events ---
            const earlyDispatchOptions = {allowSchemaNotFound: true}; // Define once

            // --- Use ValidatedEventDispatcher ---
            await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: "Initializing Engine..."}, earlyDispatchOptions);
            await this.#validatedDispatcher.dispatchValidated("event:display_message", {
                text: "Initializing core systems...",
                type: 'info'
            }, earlyDispatchOptions);


            // --- Load Data (using WorldLoader) ---
            await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: `Loading Game Data for ${worldName}...`}, earlyDispatchOptions);
            await this.#validatedDispatcher.dispatchValidated("event:display_message", {
                text: `Loading world data for '${worldName}' via WorldLoader...`,
                type: 'info'
            }, earlyDispatchOptions);

            const worldLoader = this.#container.resolve('WorldLoader');
            await worldLoader.loadWorld(worldName);

            this.#logger.info(`GameEngine: WorldLoader resolved and finished loading for world: ${worldName}.`);
            await this.#validatedDispatcher.dispatchValidated("event:display_message", {
                text: `World data for '${worldName}' loading process complete.`,
                type: 'info'
            });
            // --- End Load Data Block ---


            // --- Resolve Managers needed for setup ---
            await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: "Initializing Systems..."});

            const entityManager = this.#container.resolve('EntityManager');
            const actionExecutor = this.#container.resolve('ActionExecutor');
            this.#logger.info("GameEngine: EntityManager, and ActionExecutor resolved.");

            // ---> Initialize Registries <---
            this.#logger.info("GameEngine: Initializing component and action handler registries...");
            const registryInitializer = new RegistryInitializer();
            registryInitializer.initializeRegistries(entityManager, actionExecutor);
            this.#logger.info("GameEngine: Component and Action Handler registries initialized via RegistryInitializer.");


            // --- Initialize Systems that Require it ---
            const systemsToInitialize = [
                'TriggerDispatcher', 'GameRuleSystem', 'EquipmentEffectSystem', 'EquipmentSlotSystem',
                'InventorySystem', 'CombatSystem', 'DeathSystem', 'HealthSystem', 'StatusEffectSystem',
                'LockSystem', 'OpenableSystem', 'WorldPresenceSystem', 'ItemUsageSystem',
                'NotificationUISystem', 'PerceptionSystem', 'BlockerSystem', 'MovementSystem',
                'MoveCoordinatorSystem', 'QuestSystem', 'QuestStartTriggerSystem',
                'ActionDiscoverySystem'
            ];
            for (const key of systemsToInitialize) {
                const system = this.#container.resolve(key);
                if (system && typeof system.initialize === 'function') {
                    this.#logger.info(`GameEngine: Initializing system: ${key}...`);
                    await system.initialize();
                } else {
                    this.#logger.debug(`GameEngine: Resolved system '${key}' has no initialize() method or could not be resolved properly.`);
                }
            }
            this.#logger.info("GameEngine: Core systems resolved and initialized.");


            // --- Core Game Setup (Player & Starting Location via Service) ---
            await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: "Setting Initial Game State..."});
            await this.#validatedDispatcher.dispatchValidated("event:display_message", {
                text: "Setting initial game state...",
                type: 'info'
            });

            const gameStateInitializer = this.#container.resolve('GameStateInitializer');
            const setupSuccess = gameStateInitializer.setupInitialState();
            if (!setupSuccess) {
                throw new Error("Initial game state setup failed via GameStateInitializer. Check logs.");
            }
            this.#logger.info("GameEngine: Initial game state setup completed via GameStateInitializer.");

            // --- Instantiate Other Initial Entities & Build Spatial Index ---
            await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: "Initializing World Entities..."});
            await this.#validatedDispatcher.dispatchValidated("event:display_message", {
                text: "Instantiating world entities...",
                type: 'info'
            });

            const worldInitializer = this.#container.resolve('WorldInitializer');
            const worldInitSuccess = worldInitializer.initializeWorldEntities();
            if (!worldInitSuccess) {
                throw new Error("World initialization failed via WorldInitializer.");
            }
            this.#logger.info("GameEngine: Initial world entities instantiated and spatial index built via WorldInitializer.");


            // --- Configure Input Handler ---
            const inputHandler = this.#container.resolve('InputHandler');
            const processInputCommand = async (command) => {
                // --- Use ValidatedEventDispatcher ---
                if (this.#validatedDispatcher) {
                    await this.#validatedDispatcher.dispatchValidated('ui:command_echo', {command});
                } else {
                    this.#logger?.error("GameEngine: ValidatedEventDispatcher not available in processInputCommand.");
                }

                if (this.#gameLoop && this.#gameLoop.isRunning) {
                    this.#gameLoop.processSubmittedCommand(command);
                } else {
                    this.#logger?.warn("GameEngine: Input received, but GameLoop is not ready/running.");
                    // --- Use ValidatedEventDispatcher ---
                    if (this.#validatedDispatcher) {
                        await this.#validatedDispatcher.dispatchValidated('ui:disable_input', {message: "Game not running."});
                    }
                }
            };
            inputHandler.setCommandCallback(processInputCommand);
            this.#logger.info("GameEngine: InputHandler resolved and configured.");

            // --- Resolve Game Loop ---
            this.#gameLoop = this.#container.resolve('GameLoop');
            this.#logger.info("GameEngine: GameLoop resolved.");

            this.#logger.info("GameEngine: Engine-level event subscriptions setup (if any were needed).");

            // --- Initialization Complete ---
            this.#isInitialized = true;
            this.#logger.info(`GameEngine: Initialization sequence for world '${worldName}' completed successfully.`);
            // --- Use ValidatedEventDispatcher ---
            await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: "Initialization Complete. Starting..."});
            await this.#validatedDispatcher.dispatchValidated("event:display_message", {
                text: "Initialization complete.",
                type: 'success'
            });

            return true;

        } catch (error) {
            (this.#logger || console).error(`GameEngine: CRITICAL ERROR during initialization sequence for world '${worldName}':`, error);
            const errorMsg = `Game initialization failed: ${error.message}. Check console (F12) for details.`;

            // Attempt to display error via UI events, using the dispatcher
            if (this.#validatedDispatcher) { // Check if dispatcher was resolved before error
                try {
                    // --- Use ValidatedEventDispatcher ---
                    await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: "Fatal Initialization Error!"});
                    await this.#validatedDispatcher.dispatchValidated("event:display_message", {
                        text: errorMsg,
                        type: 'error'
                    });
                    await this.#validatedDispatcher.dispatchValidated('ui:disable_input', {message: "Error during startup."});
                } catch (dispatchError) {
                    (this.#logger || console).error("GameEngine: Failed to dispatch error messages via ValidatedDispatcher during initialization failure:", dispatchError);
                }
            } else {
                (this.#logger || console).error("GameEngine: ValidatedEventDispatcher not available to display initialization error.");
            }

            // Attempt to disable UI elements directly as a last resort
            try {
                const inputHandler = this.#container.resolve('InputHandler');
                if (inputHandler && typeof inputHandler.disable === 'function') inputHandler.disable();
                const inputElement = this.#container.resolve('inputElement');
                if (inputElement) inputElement.disabled = true;
            } catch (disableError) {
                (this.#logger || console).error("GameEngine: Could not resolve InputHandler or inputElement to disable on error during initialization failure.", disableError);
            }

            this.#isInitialized = false;
            throw error; // Propagate the original error
        }
    }

    /**
     * Starts the game engine after successful initialization.
     * Retrieves world name using GameDataRepository.
     * @param {string} worldName - The identifier of the world that was loaded.
     * @returns {Promise<void>}
     */
    async start(worldName) {
        // Argument validation
        if (!worldName) {
            this.#logger?.error("GameEngine: Fatal Error - start() called without providing a worldName.");
            // Attempt to inform user and disable UI
            alert("Fatal Error: No world specified to start the game engine. Application cannot continue.");
            try {
                const inputElement = this.#container.resolve('inputElement');
                if (inputElement) inputElement.disabled = true;
                const titleElement = this.#container.resolve('titleElement');
                if (titleElement) titleElement.textContent = "Fatal Error!";
            } catch (e) {
                this.#logger?.error("GameEngine start(): Failed to disable UI elements on missing worldName error.", e);
            }
            throw new Error("GameEngine.start requires a worldName argument.");
        }

        try {
            const initSuccess = await this.#initialize(worldName);

            // Check state: Include validatedDispatcher check
            if (initSuccess && this.#isInitialized && this.#gameLoop && this.#eventBus && this.#gameDataRepository && this.#validatedDispatcher && this.#logger) {
                this.#logger.info("GameEngine: Initialization successful. Starting GameLoop...");

                const loadedWorldName = this.#gameDataRepository.getWorldName(); // Still need GameDataRepository
                this.#logger.info(`GameEngine: Retrieved world name from GameDataRepository: ${loadedWorldName || 'Not Found'}.`);

                // --- Use ValidatedEventDispatcher ---
                if (!loadedWorldName) {
                    this.#logger.warn(`GameEngine: Could not retrieve world name. Falling back to input name: ${worldName}`);
                    await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: worldName});
                    await this.#validatedDispatcher.dispatchValidated("event:display_message", {
                        text: `Welcome to ${worldName}! (Name from input)`, type: "info"
                    });
                } else {
                    await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: loadedWorldName});
                    await this.#validatedDispatcher.dispatchValidated("event:display_message", {
                        text: `Welcome to ${loadedWorldName}!`, type: "info"
                    });
                }

                const gameStateManager = this.#container.resolve('GameStateManager');
                const player = gameStateManager.getPlayer();
                const startLocation = gameStateManager.getCurrentLocation();

                if (player && startLocation) {
                    // --- Use ValidatedEventDispatcher ---
                    await this.#validatedDispatcher.dispatchValidated('event:room_entered', {
                        playerId: player.id,
                        newLocationId: startLocation.id,
                        previousLocationId: null
                    });
                    this.#logger.info("GameEngine: Initial 'event:room_entered' dispatch attempted.");
                } else {
                    this.#logger.error("GameEngine: Cannot dispatch initial room_entered event - player or start location missing. Aborting start.");
                    throw new Error("Game state inconsistent after initialization.");
                }

                this.#gameLoop.start();
                this.#logger.info("GameEngine: GameLoop started.");

                // --- Use ValidatedEventDispatcher ---
                await this.#validatedDispatcher.dispatchValidated("event:display_message", {
                    text: "Game loop started. Good luck!", type: 'info'
                });

            } else {
                this.#logger.error("GameEngine: Initialization failed OR essential components missing/state invalid post-init. Cannot start GameLoop.");
                if (this.#validatedDispatcher) { // Attempt feedback if dispatcher is available
                    await this.#validatedDispatcher.dispatchValidated("event:display_message", {
                        text: "Engine failed to start post-initialization. Check logs.", type: 'error'
                    });
                    await this.#validatedDispatcher.dispatchValidated('event:set_title', {text: "Engine Start Failed"});
                }
                throw new Error("Inconsistent engine state after initialization.");
            }
        } catch (error) {
            this.#logger?.error(`GameEngine: Error during the start process for world '${worldName}':`, error);
            // Final attempt to disable UI
            try { /* UI disable */
            } catch (finalError) { /* log */
            }
            throw error; // Re-throw
        }
    }

    /**
     * Stops the game loop and performs necessary cleanup.
     */
    stop() {
        this.#logger?.info("GameEngine: Stop requested.");
        if (this.#gameLoop && this.#gameLoop.isRunning) {
            this.#gameLoop.stop();
            this.#logger?.info("GameEngine: GameLoop stopped.");
        } else {
            this.#logger?.info("GameEngine: GameLoop already stopped or not initialized.");
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
            this.#logger?.error("GameEngine: Error during system shutdown:", error);
        }

        // Dispose container singletons if method exists
        if (this.#container) {
            if (typeof this.#container.disposeSingletons === 'function') {
                this.#logger?.info("GameEngine: Disposing container singletons...");
                try {
                    this.#container.disposeSingletons();
                } catch (disposeError) {
                    this.#logger?.error("GameEngine: Error during container singleton disposal:", disposeError);
                }
            } else {
                this.#logger?.warn("GameEngine: Container does not have a disposeSingletons method.");
            }
        }

        // Reset internal state
        this.#isInitialized = false;
        this.#gameLoop = null;
        this.#eventBus = null;
        this.#gameDataRepository = null;
        this.#validatedDispatcher = null; // Refactoring: Clear new service
        // Logger persists potentially
        console.log("GameEngine: Engine stopped and internal state reset.");
    }
}

export default GameEngine;