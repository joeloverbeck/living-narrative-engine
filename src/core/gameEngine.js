// src/core/gameEngine.js

// --- Core System Imports ---
import DataManager from '../../dataManager.js';
import EventBus from '../../eventBus.js';
import EntityManager from '../entities/entityManager.js';
import GameStateManager from '../../gameStateManager.js';
import CommandParser from '../../commandParser.js';
import ActionExecutor from '../actions/actionExecutor.js';
import ActionResultProcessor from '../actions/actionResultProcessor.js';
import TriggerSystem from '../systems/triggerSystem.js';
import EquipmentSystem from '../systems/equipmentSystem.js';
// GameInitializer is being absorbed, so it's not imported here.
import DomRenderer from '../../domRenderer.js';
import InputHandler from '../../inputHandler.js';
import GameLoop from '../../gameLoop.js';

// --- Configuration Imports ---
import { componentRegistryConfig } from '../config/componentRegistry.config.js';
import { actionHandlerRegistryConfig } from '../config/actionHandlerRegistry.config.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */

const STARTING_PLAYER_ID = 'core:player';
const STARTING_LOCATION_ID = 'demo:room_entrance'; // Or fetch from config/dataManager

/**
 * Encapsulates core game systems, manages initialization, and orchestrates the game start.
 */
class GameEngine {
    // --- Essential External Dependencies ---
    #outputDiv;
    #inputElement;
    // Could add #errorDiv if specific fallback needed here

    // --- Core System Instances ---
    #dataManager = null;
    #eventBus = null;
    #entityManager = null;
    #gameStateManager = null;
    #commandParser = null;
    #actionExecutor = null;
    #actionResultProcessor = null;
    #triggerSystem = null;
    #equipmentSystem = null;
    #renderer = null;
    #inputHandler = null;
    #gameLoop = null;

    #isInitialized = false;

    /**
     * Creates a new GameEngine instance.
     * @param {object} options
     * @param {HTMLElement} options.outputDiv - The main DOM element for game output.
     * @param {HTMLInputElement} options.inputElement - The DOM input element for commands.
     */
    constructor({ outputDiv, inputElement }) {
        if (!outputDiv || !(outputDiv instanceof HTMLElement)) {
            throw new Error("GameEngine requires a valid 'outputDiv' HTMLElement.");
        }
        if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
            throw new Error("GameEngine requires a valid 'inputElement' HTMLInputElement.");
        }

        this.#outputDiv = outputDiv;
        this.#inputElement = inputElement;

        console.log("GameEngine: Instance created. Ready to initialize.");
    }

    /**
     * Initializes all core game systems asynchronously.
     * This includes loading data, setting up dependencies, registering components/handlers,
     * and configuring the initial game state.
     * @returns {Promise<boolean>} True if initialization succeeded, false otherwise.
     * @private
     */
    async #initialize() {
        console.log("GameEngine: Starting initialization sequence...");
        // --- TEMP: Update title via direct DOM manipulation during init ---
        // Ideally, this would use eventBus.dispatch('ui:set_title', ...)
        const titleElement = document.querySelector('h1'); // Quick access for now
        if (titleElement) titleElement.textContent = "Initializing Engine...";

        try {
            // --- 1. Instantiate Event Bus (Needed early) ---
            this.#eventBus = new EventBus();
            console.log("GameEngine: EventBus instantiated.");

            // --- 2. Instantiate Renderer (Needs DOM elements & EventBus) ---
            // Renderer subscribes to events internally now.
            this.#renderer = new DomRenderer(this.#outputDiv, this.#inputElement, this.#eventBus);
            console.log("GameEngine: DomRenderer instantiated.");
            // Use EventBus for early messages if Renderer exists
            this.#eventBus.dispatch('ui:message_display', { text: "Initializing data manager...", type: 'info' });
            if (titleElement) titleElement.textContent = "Loading Game Data...";

            // --- 3. Instantiate and Load Data Manager ---
            this.#dataManager = new DataManager();
            await this.#dataManager.loadAllData(); // Critical async step
            console.log("GameEngine: DataManager instantiated and data loaded.");
            this.#eventBus.dispatch('ui:message_display', { text: "Game data loaded.", type: 'info' });
            if (titleElement) titleElement.textContent = "Initializing Systems...";

            // --- 4. Instantiate EntityManager & Register Components ---
            this.#entityManager = new EntityManager(this.#dataManager);
            console.log("GameEngine: EntityManager instantiated.");
            this.#registerComponents(); // Use helper
            console.log("GameEngine: Components registered.");

            // --- 5. Instantiate ActionExecutor & Register Handlers ---
            this.#actionExecutor = new ActionExecutor();
            console.log("GameEngine: ActionExecutor instantiated.");
            this.#registerActionHandlers(); // Use helper
            console.log("GameEngine: Action Handlers registered.");

            // --- 6. Instantiate State Manager ---
            this.#gameStateManager = new GameStateManager();
            console.log("GameEngine: GameStateManager instantiated.");

            // --- 7. Instantiate Command Parser ---
            this.#commandParser = new CommandParser();
            console.log("GameEngine: CommandParser instantiated.");


            // --- 8. Instantiate and Initialize Systems (Order might matter) ---
            this.#triggerSystem = new TriggerSystem({
                eventBus: this.#eventBus,
                dataManager: this.#dataManager,
                entityManager: this.#entityManager,
                gameStateManager: this.#gameStateManager,
                actionExecutor: this.#actionExecutor
            });
            this.#triggerSystem.initialize(); // Connects listeners
            console.log("GameEngine: TriggerSystem instantiated and initialized.");

            this.#equipmentSystem = new EquipmentSystem({
                eventBus: this.#eventBus,
                entityManager: this.#entityManager,
                dataManager: this.#dataManager
            });
            this.#equipmentSystem.initialize(); // Connects listeners
            console.log("GameEngine: EquipmentSystem instantiated and initialized.");

            // --- 9. *** Core Game Setup (Absorbing GameInitializer logic) *** ---
            if (titleElement) titleElement.textContent = "Setting Initial Game State...";
            this.#eventBus.dispatch('ui:message_display', { text: "Setting initial game state...", type: 'info' });

            const setupSuccess = this.#setupInitialGameState();
            if (!setupSuccess) {
                // Error messages already dispatched by setupInitialGameState
                console.error("GameEngine: Initial game state setup failed. Aborting initialization.");
                if (titleElement) titleElement.textContent = "Initialization Failed!";
                return false; // Indicate failure
            }
            console.log("GameEngine: Initial game state setup complete.");

            // --- 10. Instantiate ActionResultProcessor ---
            this.#actionResultProcessor = new ActionResultProcessor({
                gameStateManager: this.#gameStateManager,
                entityManager: this.#entityManager,
                eventBus: this.#eventBus
            });
            console.log("GameEngine: ActionResultProcessor instantiated.");


            // --- 11. Instantiate Input Handler (Needs callback referencing GameLoop) ---
            // Define the callback that InputHandler will use.
            // It needs access to the GameLoop instance which isn't created yet,
            // but `this` inside the arrow function will correctly refer to the GameEngine instance.
            const processInputCommand = (command) => {
                // Echo command via event bus (Renderer listens)
                if (this.#eventBus) {
                    this.#eventBus.dispatch('ui:command_echo', { command });
                }
                // Check if game loop is ready and running before processing
                if (this.#gameLoop && this.#gameLoop.isRunning) {
                    this.#gameLoop.processSubmittedCommand(command);
                } else {
                    console.warn("GameEngine: Input received, but GameLoop is not ready or not running.", { gameLoopExists: !!this.#gameLoop, isRunning: this.#gameLoop?.isRunning });
                    if (this.#eventBus) this.#eventBus.dispatch('ui:disable_input', { message: "Game not running or ready." });
                }
            };

            this.#inputHandler = new InputHandler(this.#inputElement, processInputCommand);
            console.log("GameEngine: InputHandler instantiated.");


            // --- 12. Instantiate Game Loop (Needs most other systems) ---
            this.#gameLoop = new GameLoop({
                dataManager: this.#dataManager,
                entityManager: this.#entityManager,
                gameStateManager: this.#gameStateManager,
                inputHandler: this.#inputHandler, // Pass the instantiated handler
                commandParser: this.#commandParser,
                actionExecutor: this.#actionExecutor,
                actionResultProcessor: this.#actionResultProcessor,
                eventBus: this.#eventBus
            });
            console.log("GameEngine: GameLoop instantiated.");


            // --- Initialization Complete ---
            this.#isInitialized = true;
            console.log("GameEngine: Initialization sequence completed successfully.");
            if (titleElement) titleElement.textContent = "Initialization Complete. Starting...";
            this.#eventBus.dispatch('ui:message_display', { text: "Initialization complete.", type: 'success' }); // Use 'success' type
            return true;

        } catch (error) {
            console.error("GameEngine: CRITICAL ERROR during initialization sequence:", error);
            if (titleElement) titleElement.textContent = "Fatal Initialization Error!";
            const errorMsg = `Game initialization failed: ${error.message}. Check console (F12) for details.`;

            // Try to use the renderer/eventBus if available, otherwise fallback
            if (this.#renderer) {
                try {
                    // Use event bus first, as renderer might listen successfully
                    if (this.#eventBus) {
                        this.#eventBus.dispatch('ui:message_display', { text: errorMsg, type: 'error' });
                        // Ensure input is disabled visually via event
                        this.#eventBus.dispatch('ui:disable_input', { message: "Error during startup." });
                    } else {
                        // Fallback to direct renderer call if eventbus failed somehow
                        this.#renderer.renderMessage(errorMsg, "error");
                        this.#renderer.setInputState(false, "Error during startup.");
                    }
                } catch (renderError) {
                    console.error("GameEngine: Failed to display initialization error via Renderer/EventBus:", renderError);
                    // Fallback handled outside in main.js if engine itself fails to construct or start
                }
            } else {
                console.error("GameEngine: Renderer not available to display initialization error.");
                // Fallback handled outside in main.js
            }

            // Attempt to disable input directly as a last resort if handler exists
            if (this.#inputHandler && typeof this.#inputHandler.disable === 'function') {
                this.#inputHandler.disable(); // Logical disable
            } else if(this.#inputElement) {
                this.#inputElement.disabled = true; // Direct DOM fallback
            }


            this.#isInitialized = false; // Ensure state reflects failure
            return false; // Indicate failure
        }
    }

    /** Helper to register components */
    #registerComponents() {
        if (!this.#entityManager) throw new Error("EntityManager not initialized before registering components.");
        console.log("GameEngine: Registering components from configuration...");
        if (!componentRegistryConfig || componentRegistryConfig.size === 0) {
            console.error("GameEngine: Component registry configuration is empty or not loaded!");
            throw new Error("Component registry configuration failed to load.");
        }
        for (const [jsonKey, componentClass] of componentRegistryConfig.entries()) {
            this.#entityManager.registerComponent(jsonKey, componentClass);
        }
        console.log(`GameEngine: Component registration complete. ${this.#entityManager.componentRegistry.size} components registered.`);
    }

    /** Helper to register action handlers */
    #registerActionHandlers() {
        if (!this.#actionExecutor) throw new Error("ActionExecutor not initialized before registering handlers.");
        console.log("GameEngine: Registering action handlers from configuration...");
        if (!actionHandlerRegistryConfig || actionHandlerRegistryConfig.size === 0) {
            console.error("GameEngine: Action handler registry configuration is empty or not loaded!");
            throw new Error("Action handler registry configuration failed to load.");
        }
        for (const [actionId, handlerFunction] of actionHandlerRegistryConfig.entries()) {
            this.#actionExecutor.registerHandler(actionId, handlerFunction);
        }
        console.log(`GameEngine: Action handler registration complete. ${this.#actionExecutor.handlers.size} handlers registered from config.`);
    }

    /**
     * Sets up the initial player and location state within the GameStateManager.
     * Includes initial message dispatch and 'look' action.
     * (Formerly the logic within GameInitializer.initializeGame)
     * @returns {boolean} True if setup was successful, false otherwise.
     * @private
     */
    #setupInitialGameState() {
        try {
            // --- 1. Retrieve/Create Player Entity ---
            // Ensure player *definition* exists before trying to create instance
            if (!this.#dataManager.getEntityDefinition(STARTING_PLAYER_ID)) {
                throw new Error(`Player definition '${STARTING_PLAYER_ID}' not found in DataManager.`);
            }
            const player = this.#entityManager.createEntityInstance(STARTING_PLAYER_ID);
            if (!player) {
                // createEntityInstance logs details, throw a more specific error here
                throw new Error(`Failed to instantiate player entity '${STARTING_PLAYER_ID}'.`);
            }
            this.#gameStateManager.setPlayer(player);
            console.log("GameEngine: Player entity retrieved/created and set in GameStateManager.");

            // --- 2. Retrieve/Create Starting Location Entity ---
            if (!this.#dataManager.getEntityDefinition(STARTING_LOCATION_ID)) {
                throw new Error(`Starting location definition '${STARTING_LOCATION_ID}' not found in DataManager.`);
            }
            const startLocation = this.#entityManager.createEntityInstance(STARTING_LOCATION_ID);
            if (!startLocation) {
                throw new Error(`Failed to instantiate starting location entity '${STARTING_LOCATION_ID}'.`);
            }
            this.#gameStateManager.setCurrentLocation(startLocation);
            console.log(`GameEngine: Starting location '${startLocation.id}' retrieved/created and set in GameStateManager.`);

            // Explicitly ensure entities in the starting location are loaded (e.g. NPCs, items)
            this.#entityManager.ensureLocationEntitiesInstantiated(startLocation);

            // --- 3. Dispatch Welcome Message ---
            this.#eventBus.dispatch('ui:message_display', {
                text: "Welcome to Dungeon Run Demo!",
                type: "info"
            });


            // --- 4. Dispatch Initial Room Entered Event ---
            // Crucial for triggers and potentially other systems reacting to the start
            this.#eventBus.dispatch('event:room_entered', {
                playerEntity: player,
                newLocation: startLocation,
                previousLocation: null // Important differentiator for initial entry
            });
            console.log("GameEngine: Initial 'event:room_entered' dispatched.");

            // --- 5. Execute Initial 'look' Action ---
            console.log("GameEngine: Executing initial 'core:action_look'.");
            /** @type {ActionContext} */
            const lookContext = {
                playerEntity: player,
                currentLocation: startLocation,
                targets: [],
                dataManager: this.#dataManager,
                entityManager: this.#entityManager,
                // Provide the dispatch function correctly bound to the eventBus instance
                dispatch: this.#eventBus.dispatch.bind(this.#eventBus)
            };
            const lookResult = this.#actionExecutor.executeAction('core:action_look', lookContext);

            if (!lookResult.success) {
                // Look action handler should ideally dispatch its own error messages via eventBus
                console.warn("GameEngine: Initial 'look' action reported failure. Handler should provide user feedback.");
                // Don't treat as fatal unless necessary
            }

            return true; // Initial state setup successful

        } catch (error) {
            console.error(`GameEngine: CRITICAL ERROR during initial game state setup: ${error.message}`, error);
            const errorMsg = `Failed to set up initial game state: ${error.message}`;
            // Ensure error is visible to user via event bus
            if (this.#eventBus) {
                this.#eventBus.dispatch('ui:message_display', { text: errorMsg, type: 'error' });
                this.#eventBus.dispatch('ui:disable_input', { message: "Game state setup failed." });
            }
            return false; // Indicate failure
        }
    }


    /**
     * Starts the game engine.
     * This involves running the asynchronous initialization process
     * and then starting the main game loop if initialization was successful.
     * @returns {Promise<void>}
     */
    async start() {
        console.log("GameEngine: Start requested.");
        try {
            const initSuccess = await this.#initialize();

            if (initSuccess && this.#isInitialized && this.#gameLoop) {
                console.log("GameEngine: Initialization successful. Starting GameLoop...");
                const titleElement = document.querySelector('h1'); // Quick access
                if (titleElement) titleElement.textContent = "Dungeon Run Demo"; // Set final title

                this.#gameLoop.start(); // This enables input via eventBus ('ui:enable_input')
                console.log("GameEngine: GameLoop started.");
                this.#eventBus.dispatch('ui:message_display', { text: "Game loop started. Good luck!", type: 'info' });
            } else {
                console.error("GameEngine: Initialization failed. Cannot start GameLoop.");
                // Error messages should have been displayed during #initialize() failure
                // No need to start the loop
            }
        } catch (error) {
            // Catch errors specifically from the #initialize() call itself if it threw unexpectedly
            console.error("GameEngine: Unexpected error during the start process (potentially post-initialization):", error);
            const errorMsg = `A critical error occurred preventing the game from starting: ${error.message}`;
            const titleElement = document.querySelector('h1');
            if (titleElement) titleElement.textContent = "Fatal Start Error!";
            // Use fallback mechanisms as the engine state is uncertain
            alert(errorMsg + " Check console (F12)."); // Use alert as a robust fallback
            if (this.#inputElement) {
                this.#inputElement.placeholder = "Critical Error.";
                this.#inputElement.disabled = true;
            }
        }
    }

    stop() {
        console.log("GameEngine: Stop requested.");
        if (this.#gameLoop && this.#gameLoop.isRunning) {
            this.#gameLoop.stop();
        }
        // Add any other cleanup (e.g., unsubscribe listeners?)
        this.#isInitialized = false;
    }
}

export default GameEngine;