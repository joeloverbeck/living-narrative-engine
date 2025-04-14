// src/core/gameEngine.js

// --- Type Imports ---
/** @typedef {import('./appContainer.js').default} AppContainer */
/** @typedef {import('./eventBus.js').default} EventBus */
/** @typedef {import('./dataManager.js').default} DataManager */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('./gameStateManager.js').default} GameStateManager */
/** @typedef {import('./inputHandler.js').default} InputHandler */
/** @typedef {import('./gameLoop.js').default} GameLoop */
/** @typedef {import('../components/positionComponent.js').PositionComponent} PositionComponent */
/** @typedef {import('./gameStateInitializer.js').default} GameStateInitializer */
/** @typedef {import('./worldInitializer.js').default} WorldInitializer */


// --- Component Class Imports (needed for getComponent checks) ---
// Removed unused InventoryComponent, NameComponent class imports here
import RegistryInitializer from './registryInitializer.js';

/**
 * Encapsulates core game systems, manages initialization using a dependency container,
 * and orchestrates the game start.
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

        console.log("GameEngine: Instance created with AppContainer. Ready to initialize.");
    }

    /**
     * Initializes all core game systems asynchronously.
     * @param {string} worldName - The identifier of the world to load.
     * @returns {Promise<boolean>} True if initialization succeeded, false otherwise.
     * @private
     */
    async #initialize(worldName) {
        if (!worldName) {
            throw new Error("GameEngine.#initialize requires a worldName parameter.");
        }
        console.log(`GameEngine: Starting initialization sequence for world: ${worldName}...`);

        try {
            // --- Resolve core components early ---
            this.#eventBus = this.#container.resolve('EventBus');
            console.log("GameEngine: EventBus resolved.");
            this.#container.resolve('DomRenderer'); // Resolve early for UI updates
            console.log("GameEngine: DomRenderer resolved.");

            this.#eventBus.dispatch('ui:set_title', {text: "Initializing Engine..."});
            this.#eventBus.dispatch('ui:message_display', {text: "Initializing data manager...", type: 'info'});

            // --- Load Data ---
            this.#eventBus.dispatch('ui:set_title', {text: `Loading Game Data for ${worldName}...`});
            this.#eventBus.dispatch('ui:message_display', {
                text: `Loading data for world: ${worldName}...`,
                type: 'info'
            });
            const dataManager = this.#container.resolve('DataManager');
            await dataManager.loadAllData(worldName);
            console.log(`GameEngine: DataManager resolved and data loaded for world: ${worldName}.`);
            this.#eventBus.dispatch('ui:message_display', {
                text: `Game data for '${dataManager.getWorldName() || worldName}' loaded.`,
                type: 'info'
            });

            // --- Resolve Managers needed for setup ---
            this.#eventBus.dispatch('ui:set_title', {text: "Initializing Systems..."});
            const entityManager = this.#container.resolve('EntityManager');
            const actionExecutor = this.#container.resolve('ActionExecutor');
            console.log("GameEngine: EntityManager, and ActionExecutor resolved.");

            // ---> Initialize Registries <---
            console.log("GameEngine: Initializing component and action handler registries...");
            const registryInitializer = new RegistryInitializer();
            registryInitializer.initializeRegistries(entityManager, actionExecutor);
            console.log("GameEngine: Component and Action Handler registries initialized via RegistryInitializer.");

            // --- Initialize Systems that Require it ---
            const systemsToInitialize = [
                'GenericTriggerSystem', 'GameRuleSystem', 'EquipmentSystem', 'InventorySystem', 'CombatSystem',
                'DeathSystem',
                // Movement-related systems: Order might matter slightly if one depends on another's init,
                // but here the dependencies are handled at construction via DI.
                // Init order mainly affects event listener setup timing.
                'BlockerSystem',        // Initialize first (provides checks)
                'MovementSystem',       // Initialize next (performs action)
                'MoveCoordinatorSystem',// <<< ADDED KEY (TRG-9 AC2) Initialize last (coordinates others)
                'WorldPresenceSystem',  // Handles entity presence updates (related to movement)
                'DoorSystem',
                'QuestSystem', 'QuestStartTriggerSystem', 'NotificationUISystem'
            ];
            for (const key of systemsToInitialize) {
                const system = this.#container.resolve(key);
                if (system && typeof system.initialize === 'function') {
                    console.log(`GameEngine: Initializing system: ${key}...`);
                    system.initialize(); // Call initialize()
                } else {
                    // Log if resolved but no initialize or if resolve somehow returned null/undefined
                    console.warn(`GameEngine: Resolved system '${key}' but it lacks an initialize() method or could not be resolved properly.`);
                }
            }
            console.log("GameEngine: Core systems resolved and initialized.");


            // --- Core Game Setup (Player & Starting Location via Service) ---
            this.#eventBus.dispatch('ui:set_title', {text: "Setting Initial Game State..."});
            this.#eventBus.dispatch('ui:message_display', {text: "Setting initial game state...", type: 'info'});
            const gameStateInitializer = this.#container.resolve('GameStateInitializer');
            const setupSuccess = gameStateInitializer.setupInitialState();
            if (!setupSuccess) {
                throw new Error("Initial game state setup failed via GameStateInitializer. Check logs.");
            }
            console.log("GameEngine: Initial game state setup completed via GameStateInitializer.");

            // --- Instantiate Other Initial Entities & Build Spatial Index ---
            this.#eventBus.dispatch('ui:set_title', {text: "Initializing World Entities..."});
            this.#eventBus.dispatch('ui:message_display', {text: "Instantiating world entities...", type: 'info'});
            const worldInitializer = this.#container.resolve('WorldInitializer');
            const worldInitSuccess = worldInitializer.initializeWorldEntities();
            if (!worldInitSuccess) {
                throw new Error("World initialization failed via WorldInitializer.");
            }
            console.log("GameEngine: Initial world entities instantiated and spatial index built via WorldInitializer.");

            // --- Configure Input Handler ---
            const inputHandler = this.#container.resolve('InputHandler');
            const processInputCommand = (command) => {
                if (this.#eventBus) this.#eventBus.dispatch('ui:command_echo', {command});
                if (this.#gameLoop && this.#gameLoop.isRunning) {
                    this.#gameLoop.processSubmittedCommand(command);
                } else {
                    console.warn("GameEngine: Input received, but GameLoop is not ready/running.");
                    if (this.#eventBus) this.#eventBus.dispatch('ui:disable_input', {message: "Game not running."});
                }
            };
            inputHandler.setCommandCallback(processInputCommand);
            console.log("GameEngine: InputHandler resolved and configured.");

            // --- Resolve Game Loop ---
            this.#gameLoop = this.#container.resolve('GameLoop');
            console.log("GameEngine: GameLoop resolved.");

            console.log("GameEngine: No engine-level event subscriptions needed at this time.");

            // --- Initialization Complete ---
            this.#isInitialized = true;
            console.log(`GameEngine: Initialization sequence for world '${worldName}' completed successfully.`);
            this.#eventBus.dispatch('ui:set_title', {text: "Initialization Complete. Starting..."});
            this.#eventBus.dispatch('ui:message_display', {text: "Initialization complete.", type: 'success'});

            return true;

        } catch (error) {
            console.error(`GameEngine: CRITICAL ERROR during initialization sequence for world '${worldName}':`, error);
            const errorMsg = `Game initialization failed: ${error.message}. Check console (F12) for details.`;

            if (this.#eventBus) {
                try {
                    this.#eventBus.dispatch('ui:set_title', {text: "Fatal Initialization Error!"});
                    this.#eventBus.dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                    this.#eventBus.dispatch('ui:disable_input', {message: "Error during startup."});
                } catch (eventBusError) {
                    console.error("GameEngine: Failed to dispatch error messages via EventBus during initialization failure:", eventBusError);
                }
            } else {
                console.error("GameEngine: EventBus not available to display initialization error.");
            }

            try {
                const inputHandler = this.#container.resolve('InputHandler');
                if (inputHandler && typeof inputHandler.disable === 'function') {
                    inputHandler.disable();
                }
                const inputElement = this.#container.resolve('inputElement');
                if (inputElement) inputElement.disabled = true;
            } catch (disableError) {
                console.error("GameEngine: Could not resolve InputHandler or inputElement to disable on error during initialization failure.", disableError);
            }

            this.#isInitialized = false;
            throw error; // Propagate the error
        }
    }

    // --- start() method (no changes needed for TRG-9) ---
    async start(worldName) {
        if (!worldName) {
            console.error("GameEngine: Fatal Error - start() called without providing a worldName.");
            alert("Fatal Error: No world specified to start the game engine. Application cannot continue.");
            try {
                const inputElement = this.#container.resolve('inputElement');
                if (inputElement) inputElement.disabled = true;
                const titleElement = this.#container.resolve('titleElement');
                if (titleElement) titleElement.textContent = "Fatal Error!";
            } catch (e) { /* ignore */
            }
            throw new Error("GameEngine.start requires a worldName argument.");
        }

        try {
            const initSuccess = await this.#initialize(worldName);

            if (initSuccess && this.#isInitialized && this.#gameLoop && this.#eventBus) {
                console.log("GameEngine: Initialization successful. Starting GameLoop...");
                const dataManager = this.#container.resolve('DataManager');
                const loadedWorldName = dataManager.getWorldName() || worldName;
                this.#eventBus.dispatch('ui:set_title', {text: loadedWorldName});
                this.#eventBus.dispatch('ui:message_display', {text: `Welcome to ${loadedWorldName}!`, type: "info"});

                const gameStateManager = this.#container.resolve('GameStateManager');
                const player = gameStateManager.getPlayer();
                const startLocation = gameStateManager.getCurrentLocation();

                if (player && startLocation) {
                    this.#eventBus.dispatch('event:room_entered', {
                        playerEntity: player,
                        newLocation: startLocation,
                        previousLocation: null
                    });
                    console.log("GameEngine: Initial 'event:room_entered' dispatched.");
                } else {
                    console.error("GameEngine: Cannot dispatch initial room_entered event - player or start location missing after initialization.");
                    throw new Error("Game state inconsistent after initialization. Player or location missing.");
                }

                this.#gameLoop.start();
                console.log("GameEngine: GameLoop started.");
                this.#eventBus.dispatch('ui:message_display', {text: "Game loop started. Good luck!", type: 'info'});
            } else {
                console.error("GameEngine: Initialization reported success but essential components missing or state invalid. Cannot start GameLoop.");
                throw new Error("Inconsistent engine state after initialization. Cannot start.");
            }
        } catch (error) {
            console.error(`GameEngine: Error during the start process for world '${worldName}':`, error);
            try {
                const inputElement = this.#container.resolve('inputElement');
                if (inputElement) {
                    inputElement.placeholder = "Critical Start Error.";
                    inputElement.disabled = true;
                }
                const titleElement = this.#container.resolve('titleElement');
                if (titleElement) titleElement.textContent = "Fatal Start Error!";
                const inputHandler = this.#container.resolve('InputHandler');
                if (inputHandler && typeof inputHandler.disable === 'function') {
                    inputHandler.disable();
                }
            } catch (finalError) {
                console.error("GameEngine: Failed to disable input during final error handling in start().");
            }
            throw error;
        }
    }

    // --- stop() method (no changes needed for TRG-9) ---
    stop() {
        console.log("GameEngine: Stop requested.");
        if (this.#gameLoop && this.#gameLoop.isRunning) {
            this.#gameLoop.stop();
            console.log("GameEngine: GameLoop stopped.");
        } else {
            console.log("GameEngine: GameLoop already stopped or not initialized.");
        }

        try {
            const systemsWithShutdown = ['WorldPresenceSystem', 'DoorSystem']; // Add others if they implement shutdown
            for (const key of systemsWithShutdown) {
                const system = this.#container.resolve(key);
                if (system && typeof system.shutdown === 'function') {
                    console.log(`GameEngine: Shutting down system: ${key}...`);
                    system.shutdown();
                }
            }
        } catch (error) {
            console.error("GameEngine: Error during system shutdown:", error);
        }

        if (this.#container) {
            if (typeof this.#container.disposeSingletons === 'function') {
                this.#container.disposeSingletons();
            }
        }

        this.#isInitialized = false;
        this.#gameLoop = null;
        this.#eventBus = null;
        console.log("GameEngine: Engine stopped and container state potentially reset.");
    }
}

export default GameEngine;