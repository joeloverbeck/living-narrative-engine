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
/** @typedef {import('./services/worldLoader.js').default} WorldLoader */ // <-- Present (Correct)
/** @typedef {import('./services/gameDataRepository.js').GameDataRepository} GameDataRepository */ // <-- Task 3: Verified Present (Correct)


// --- Component Class Imports (needed for getComponent checks) ---
// Removed unused InventoryComponent, NameComponent class imports here
import RegistryInitializer from './registryInitializer.js';
import {EVENT_DISPLAY_MESSAGE} from "../types/eventTypes.js";

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
     * (No changes in this method for REFACTOR-014-SUB-06)
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
            this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: "Initializing core systems...", type: 'info'});


            // --- Load Data (using WorldLoader - Implemented in previous ticket SUB-03) ---
            this.#eventBus.dispatch('ui:set_title', {text: `Loading Game Data for ${worldName}...`});
            this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                text: `Loading world data for '${worldName}' via WorldLoader...`,
                type: 'info'
            });

            const worldLoader = this.#container.resolve('WorldLoader');
            await worldLoader.loadWorld(worldName);

            console.log(`GameEngine: WorldLoader resolved and finished loading for world: ${worldName}.`);
            this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                text: `World data for '${worldName}' loading process complete.`,
                type: 'info'
            });
            // --- End Load Data Block ---


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
                'TriggerDispatcher', 'GameRuleSystem', 'EquipmentEffectSystem', 'EquipmentSlotSystem',
                'InventorySystem', 'CombatSystem', 'DeathSystem', 'HealthSystem', 'StatusEffectSystem',
                'LockSystem', 'OpenableSystem', 'WorldPresenceSystem', 'ItemUsageSystem',
                'NotificationUISystem', 'PerceptionSystem', 'BlockerSystem', 'MovementSystem',
                'MoveCoordinatorSystem', 'QuestSystem', 'QuestStartTriggerSystem',
            ];
            for (const key of systemsToInitialize) {
                const system = this.#container.resolve(key);
                if (system && typeof system.initialize === 'function') {
                    console.log(`GameEngine: Initializing system: ${key}...`);
                    system.initialize();
                } else {
                    console.warn(`GameEngine: Resolved system '${key}' but it lacks an initialize() method or could not be resolved properly.`);
                }
            }
            console.log("GameEngine: Core systems resolved and initialized.");


            // --- Core Game Setup (Player & Starting Location via Service) ---
            this.#eventBus.dispatch('ui:set_title', {text: "Setting Initial Game State..."});
            this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: "Setting initial game state...", type: 'info'});
            const gameStateInitializer = this.#container.resolve('GameStateInitializer');
            const setupSuccess = gameStateInitializer.setupInitialState();
            if (!setupSuccess) {
                throw new Error("Initial game state setup failed via GameStateInitializer. Check logs.");
            }
            console.log("GameEngine: Initial game state setup completed via GameStateInitializer.");

            // --- Instantiate Other Initial Entities & Build Spatial Index ---
            this.#eventBus.dispatch('ui:set_title', {text: "Initializing World Entities..."});
            this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: "Instantiating world entities...", type: 'info'});
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
            this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: "Initialization complete.", type: 'success'});

            return true;

        } catch (error) {
            console.error(`GameEngine: CRITICAL ERROR during initialization sequence for world '${worldName}':`, error);
            const errorMsg = `Game initialization failed: ${error.message}. Check console (F12) for details.`;

            if (this.#eventBus) {
                try {
                    this.#eventBus.dispatch('ui:set_title', {text: "Fatal Initialization Error!"});
                    this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: errorMsg, type: 'error'});
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

    /**
     * Starts the game engine after successful initialization.
     * Retrieves world name using GameDataRepository.
     * @param {string} worldName - The identifier of the world that was loaded.
     * @returns {Promise<void>}
     */
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

                // --- Task 4: Modify start Method ---
                // Retrieve World Name using GameDataRepository instead of GameDataRepository
                console.log("GameEngine: Initialization successful. Starting GameLoop...");

                // Resolve the new repository (AC1)
                const gameDataRepository = this.#container.resolve('GameDataRepository');
                // Get world name from the repository (AC2)
                const loadedWorldName = gameDataRepository.getWorldName();
                // Added clarifying log as per refined ticket
                console.log(`GameEngine: Resolved GameDataRepository to get world name: ${loadedWorldName || 'Not Found in Repo'}.`);

                // Verify Cleanup (AC3): No GameDataRepository resolution/usage should exist here.

                // Fallback logic remains the same
                if (!loadedWorldName) {
                    // Handle case where manifest might be missing the worldName property after loading
                    console.warn(`GameEngine: Could not retrieve world name from GameDataRepository. Falling back to input name: ${worldName}`);
                    this.#eventBus.dispatch('ui:set_title', {text: worldName}); // Fallback title
                    this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                        text: `Welcome to ${worldName}! (Name from input)`,
                        type: "info"
                    });
                } else {
                    this.#eventBus.dispatch('ui:set_title', {text: loadedWorldName});
                    this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                        text: `Welcome to ${loadedWorldName}!`,
                        type: "info"
                    });
                }
                // --- End Task 4 Modification ---

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
                this.#eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: "Game loop started. Good luck!", type: 'info'});
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

    /**
     * Stops the game loop and performs necessary cleanup.
     * (No changes in this method for REFACTOR-014-SUB-06)
     */
    stop() {
        console.log("GameEngine: Stop requested.");
        if (this.#gameLoop && this.#gameLoop.isRunning) {
            this.#gameLoop.stop();
            console.log("GameEngine: GameLoop stopped.");
        } else {
            console.log("GameEngine: GameLoop already stopped or not initialized.");
        }

        try {
            const systemsWithShutdown = ['WorldPresenceSystem']; // Add others if they implement shutdown
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