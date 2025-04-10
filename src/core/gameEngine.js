// src/core/gameEngine.js

// --- Core System Imports ---
import DataManager from '../../dataManager.js';
import EventBus from '../../eventBus.js';
import EntityManager from '../entities/entityManager.js';
import GameStateManager from '../../gameStateManager.js';
import CommandParser from '../../commandParser.js';
import ActionExecutor from '../actions/actionExecutor.js';
import TriggerSystem from '../systems/triggerSystem.js';
import EquipmentSystem from '../systems/equipmentSystem.js';
import InventorySystem from '../systems/inventorySystem.js';
import CombatSystem from '../systems/combatSystem.js';
import DeathSystem from "../systems/deathSystem.js";
import MovementSystem from "../systems/movementSystem.js";
import WorldInteractionSystem from "../systems/worldInteractionSystem.js";
import ItemUsageSystem from "../systems/itemUsageSystem.js";
import QuestSystem from '../systems/questSystem.js';
import {NotificationUISystem} from "../systems/notificationUISystem.js";
import DomRenderer from '../../domRenderer.js';
import InputHandler from '../../inputHandler.js';
import GameLoop from '../../gameLoop.js';

// --- Configuration Imports ---
import {componentRegistryConfig} from '../config/componentRegistry.config.js';
import {actionHandlerRegistryConfig} from '../config/actionHandlerRegistry.config.js';
import {PositionComponent} from "../components/positionComponent.js";
import {NameComponent} from "../components/nameComponent.js";
import {InventoryComponent} from "../components/inventoryComponent.js";

// --- Service Imports ---
import { QuestPrerequisiteService } from '../services/questPrerequisiteService.js';
import { QuestRewardService } from '../services/questRewardService.js';
import { ObjectiveEventListenerService } from '../services/objectiveEventListenerService.js';
import { ObjectiveStateCheckerService } from '../services/objectiveStateCheckerService.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../eventBus.js').default} EventBus */ // Added for clarity

const STARTING_PLAYER_ID = 'core:player';
const STARTING_LOCATION_ID = 'demo:room_entrance'; // Or fetch from config/dataManager

/**
 * Encapsulates core game systems, manages initialization, and orchestrates the game start.
 */
class GameEngine {
    // --- Essential External Dependencies ---
    #outputDiv;
    #inputElement;
    #titleElement;

    // --- Core System Instances ---
    #dataManager = null;
    #eventBus = null;
    #entityManager = null;
    #gameStateManager = null;
    #commandParser = null;
    #actionExecutor = null;
    #triggerSystem = null;
    #equipmentSystem = null;
    #inventorySystem = null;
    #combatSystem = null;
    #deathSystem = null;
    #movementSystem = null;
    #worldInteractionSystem = null;
    #itemUsageSystem = null;
    #questSystem = null;
    #notificationUISystem = null;
    #renderer = null;
    #inputHandler = null;
    #gameLoop = null;

    #questPrerequisiteService = null;
    #questRewardService = null;
    #objectiveEventListenerService = null;
    #objectiveStateCheckerService = null;

    #isInitialized = false;

    /**
     * Creates a new GameEngine instance.
     * @param {object} options
     * @param {HTMLElement} options.outputDiv - The main DOM element for game output.
     * @param {HTMLInputElement} options.inputElement - The DOM input element for commands.
     * @param {HTMLHeadingElement} options.titleElement - The H1 element for displaying titles/status.
     */
    constructor({outputDiv, inputElement, titleElement}) { // Added titleElement
        if (!outputDiv || !(outputDiv instanceof HTMLElement)) {
            throw new Error("GameEngine requires a valid 'outputDiv' HTMLElement.");
        }
        if (!inputElement || !(inputElement instanceof HTMLInputElement)) {
            throw new Error("GameEngine requires a valid 'inputElement' HTMLInputElement.");
        }
        // --- Added Validation for titleElement ---
        if (!titleElement || !(titleElement instanceof HTMLHeadingElement)) {
            throw new Error("GameEngine requires a valid 'titleElement' HTMLHeadingElement (H1).");
        }

        this.#outputDiv = outputDiv;
        this.#inputElement = inputElement;
        this.#titleElement = titleElement; // Store title element

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

            // --- Dispatch Initial Title Update via EventBus ---
            this.#eventBus.dispatch('ui:set_title', {text: "Initializing Engine..."});

            // --- 2. Instantiate Renderer (Needs DOM elements & EventBus) ---
            // Renderer subscribes to events internally now.
            this.#renderer = new DomRenderer(
                this.#outputDiv,
                this.#inputElement,
                this.#titleElement,
                this.#eventBus
            );
            console.log("GameEngine: DomRenderer instantiated.");

            // Use EventBus for early messages if Renderer exists
            this.#eventBus.dispatch('ui:message_display', {text: "Initializing data manager...", type: 'info'});
            if (titleElement) titleElement.textContent = "Loading Game Data...";

            // --- 3. Instantiate and Load Data Manager ---
            this.#dataManager = new DataManager();
            await this.#dataManager.loadAllData(); // Critical async step
            console.log("GameEngine: DataManager instantiated and data loaded.");
            this.#eventBus.dispatch('ui:message_display', {text: "Game data loaded.", type: 'info'});
            // Update title via event
            this.#eventBus.dispatch('ui:set_title', {text: "Initializing Systems..."});

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

            // --- 8a. Instantiate Quest Services (Needed by QuestSystem) ---
            // +++ Instantiate Quest Services +++
            this.#questPrerequisiteService = new QuestPrerequisiteService(); // No constructor deps
            console.log("GameEngine: QuestPrerequisiteService instantiated.");

            this.#questRewardService = new QuestRewardService({
                dataManager: this.#dataManager,
                eventBus: this.#eventBus,
                gameStateManager: this.#gameStateManager
            });
            console.log("GameEngine: QuestRewardService instantiated.");

            this.#objectiveEventListenerService = new ObjectiveEventListenerService({
                eventBus: this.#eventBus,
                dataManager: this.#dataManager
            });
            console.log("GameEngine: ObjectiveEventListenerService instantiated.");

            this.#objectiveStateCheckerService = new ObjectiveStateCheckerService({
                eventBus: this.#eventBus,
                dataManager: this.#dataManager,
                entityManager: this.#entityManager,
                gameStateManager: this.#gameStateManager
            });
            console.log("GameEngine: ObjectiveStateCheckerService instantiated.");

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

            this.#inventorySystem = new InventorySystem({
                eventBus: this.#eventBus,
                entityManager: this.#entityManager,
                dataManager: this.#dataManager
            });
            this.#inventorySystem.initialize();
            console.log("GameEngine: InventorySystem instantiated and initialized.");

            this.#combatSystem = new CombatSystem({
                eventBus: this.#eventBus,
                entityManager: this.#entityManager,
                dataManager: this.#dataManager
            });
            this.#combatSystem.initialize(); // Don't forget to initialize
            console.log("GameEngine: CombatSystem instantiated and initialized.");

            this.#deathSystem = new DeathSystem({
                eventBus: this.#eventBus,
                entityManager: this.#entityManager,
            });
            this.#deathSystem.initialize();
            console.log("GameEngine: DeathSystem instantiated and initialized.");

            this.#movementSystem = new MovementSystem({
                eventBus: this.#eventBus,
                entityManager: this.#entityManager,
            });
            this.#movementSystem.initialize();
            console.log("GameEngine: Movement System instantiated and initialized.");

            this.#worldInteractionSystem = new WorldInteractionSystem({
                eventBus: this.#eventBus,
                entityManager: this.#entityManager
            });
            this.#worldInteractionSystem.initialize(); // Don't forget to initialize!
            console.log("GameEngine: WorldInteractionSystem instantiated and initialized.");

            this.#itemUsageSystem = new ItemUsageSystem({
                eventBus: this.#eventBus,
                entityManager: this.#entityManager,
                dataManager: this.#dataManager
            });
            console.log("GameEngine: ItemUsageSystem instantiated and initialized.");

            this.#questSystem = new QuestSystem({
                dataManager: this.#dataManager,
                eventBus: this.#eventBus,
                entityManager: this.#entityManager,
                gameStateManager: this.#gameStateManager,
                questPrerequisiteService: this.#questPrerequisiteService,
                questRewardService: this.#questRewardService,
                objectiveEventListenerService: this.#objectiveEventListenerService,
                objectiveStateCheckerService: this.#objectiveStateCheckerService
            });
            this.#questSystem.initialize();
            console.log("GameEngine: QuestSystem instantiated and initialized.");

            this.#notificationUISystem = new NotificationUISystem({
                eventBus: this.#eventBus,
                dataManager: this.#dataManager,
            });
            this.#notificationUISystem.initialize();
            console.log("GameEngine: NotificationUISystem initialized.");

            // --- 9. Core Game Setup (Player & Starting Location) ---
            this.#eventBus.dispatch('ui:set_title', {text: "Setting Initial Game State..."});
            this.#eventBus.dispatch('ui:message_display', {text: "Setting initial game state...", type: 'info'});
            const setupSuccess = this.#setupInitialGameState();
            if (!setupSuccess) {
                console.error("GameEngine: Initial game state setup failed. Aborting initialization.");
                this.#eventBus.dispatch('ui:set_title', {text: "Initialization Failed!"});
                return false;
            }
            console.log("GameEngine: Initial game state setup complete.");

            // --- 10. Instantiate Other Initial Entities & Build Spatial Index ---
            this.#instantiateInitialWorldEntities(); // New dedicated method
            // Spatial index build is now handled within #instantiateInitialWorldEntities

            // --- 11. Input Handler ---
            // Define the callback for command submission
            const processInputCommand = (command) => {
                if (this.#eventBus) this.#eventBus.dispatch('ui:command_echo', {command});
                if (this.#gameLoop && this.#gameLoop.isRunning) {
                    this.#gameLoop.processSubmittedCommand(command);
                } else {
                    console.warn("GameEngine: Input received, but GameLoop is not ready/running.");
                    if (this.#eventBus) this.#eventBus.dispatch('ui:disable_input', {message: "Game not running."});
                }
            };
            this.#inputHandler = new InputHandler(
                this.#inputElement,
                processInputCommand,
                this.#eventBus // Pass the event bus instance
            );
            console.log("GameEngine: InputHandler instantiated.");


            // --- 12. Instantiate Game Loop (Needs most other systems) ---
            this.#gameLoop = new GameLoop({
                dataManager: this.#dataManager,
                entityManager: this.#entityManager,
                gameStateManager: this.#gameStateManager,
                inputHandler: this.#inputHandler, // Pass the instantiated handler
                commandParser: this.#commandParser,
                actionExecutor: this.#actionExecutor,
                eventBus: this.#eventBus
            });
            console.log("GameEngine: GameLoop instantiated.");

            this.#eventBus.subscribe('ui:request_inventory_render', this.#handleInventoryRenderRequest.bind(this));
            console.log("GameEngine: Subscribed to 'ui:request_inventory_render'.");

            // --- Initialization Complete ---
            this.#isInitialized = true;
            console.log("GameEngine: Initialization sequence completed successfully.");
            this.#eventBus.dispatch('ui:set_title', {text: "Initialization Complete. Starting..."});
            this.#eventBus.dispatch('ui:message_display', {text: "Initialization complete.", type: 'success'});

            return true;

        } catch (error) {
            console.error("GameEngine: CRITICAL ERROR during initialization sequence:", error);
            // Update title via event (if eventBus is available)
            if (this.#eventBus) {
                this.#eventBus.dispatch('ui:set_title', {text: "Fatal Initialization Error!"});
            } else {
                // Fallback if event bus itself failed - use passed element directly
                if (this.#titleElement) this.#titleElement.textContent = "Fatal Initialization Error!";
            }

            const errorMsg = `Game initialization failed: ${error.message}. Check console (F12) for details.`;

            // Try to use the renderer/eventBus (logic remains similar)
            if (this.#renderer) { // Renderer check implies eventBus likely exists too
                try {
                    this.#eventBus.dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                    this.#eventBus.dispatch('ui:disable_input', {message: "Error during startup."});
                } catch (renderError) {
                    console.error("GameEngine: Failed to display initialization error via EventBus:", renderError);
                }
            } else {
                console.error("GameEngine: Renderer/EventBus not available to display initialization error.");
            }

            // Attempt to disable input (logic remains similar)
            if (this.#inputHandler && typeof this.#inputHandler.disable === 'function') {
                this.#inputHandler.disable();
            } else if (this.#inputElement) {
                this.#inputElement.disabled = true;
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
     * Does NOT dispatch the initial look or welcome message; these happen later or via events.
     * @returns {boolean} True if setup was successful, false otherwise.
     * @private
     */
    #setupInitialGameState() {
        try {
            // --- 1. Retrieve/Create Player Entity ---
            if (!this.#dataManager.getEntityDefinition(STARTING_PLAYER_ID)) {
                throw new Error(`Player definition '${STARTING_PLAYER_ID}' not found in DataManager.`);
            }
            const player = this.#entityManager.createEntityInstance(STARTING_PLAYER_ID);
            if (!player) {
                throw new Error(`Failed to instantiate player entity '${STARTING_PLAYER_ID}'.`);
            }
            this.#gameStateManager.setPlayer(player);
            console.log("GameEngine: Player entity created and set in GameStateManager.");

            // --- 2. Retrieve/Create Starting Location Entity ---
            if (!this.#dataManager.getEntityDefinition(STARTING_LOCATION_ID)) {
                throw new Error(`Starting location definition '${STARTING_LOCATION_ID}' not found in DataManager.`);
            }
            const startLocation = this.#entityManager.createEntityInstance(STARTING_LOCATION_ID);
            if (!startLocation) {
                throw new Error(`Failed to instantiate starting location entity '${STARTING_LOCATION_ID}'.`);
            }
            this.#gameStateManager.setCurrentLocation(startLocation);
            console.log(`GameEngine: Starting location '${startLocation.id}' created and set in GameStateManager.`);

            // --- 3. Place Player in Starting Location (Essential for Spatial Index!) ---
            // This assumes the player definition itself doesn't have a PositionComponent,
            // or if it does, we override it here to ensure they start correctly.
            const playerPos = player.getComponent('Position');
            if (playerPos) {
                // Update player's position component to match the starting location ID
                playerPos.setLocation(startLocation.id, 0, 0); // Assume 0,0 coords for now
                console.log(`GameEngine: Updated player's PositionComponent to location ${startLocation.id}`);
            } else {
                // If the player definition *doesn't* have a PositionComponent, add one.
                // This requires knowing the JSON key for PositionComponent ("Position").
                try {
                    console.log(`GameEngine: Player missing PositionComponent, attempting to add one for location ${startLocation.id}`);
                    player.addComponent('Position', {locationId: startLocation.id, x: 0, y: 0});
                } catch (addCompError) {
                    console.error(`GameEngine: Failed to add PositionComponent to player: ${addCompError.message}`, addCompError);
                    throw new Error(`Could not set player's initial position in ${startLocation.id}`);
                }
            }

            // --- NOTE: Welcome message and initial 'look' are triggered by events later ---
            // The 'event:room_entered' dispatch is moved to the START of the game loop or post-init
            // to ensure all entities are present *before* the first description/look.

            return true; // Initial state setup successful

        } catch (error) {
            console.error(`GameEngine: CRITICAL ERROR during initial game state setup: ${error.message}`, error);
            const errorMsg = `Failed to set up initial game state: ${error.message}`;
            if (this.#eventBus) {
                this.#eventBus.dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                this.#eventBus.dispatch('ui:disable_input', {message: "Game state setup failed."});
            }
            return false; // Indicate failure
        }
    }

    /**
     * Iterates through entity definitions and instantiates those with a PositionComponent,
     * skipping the player and starting location which are handled separately.
     * Finally, builds the initial spatial index.
     * @private
     */
    #instantiateInitialWorldEntities() {
        console.log("GameEngine: Instantiating initial non-location world entities...");
        if (!this.#entityManager || !this.#dataManager || !this.#gameStateManager) {
            console.error("GameEngine: Cannot instantiate world entities - core managers missing.");
            throw new Error("Core managers not initialized before world entity instantiation.");
        }

        let initialEntityCount = 0;
        const player = this.#gameStateManager.getPlayer();
        const startLocation = this.#gameStateManager.getCurrentLocation();

        if (!player || !startLocation) {
            throw new Error("Player or starting location not set before instantiating world entities.");
        }

        try {
            // Iterate through all loaded entity *definitions*
            for (const entityDef of this.#dataManager.entities.values()) {
                // Skip player and starting location (already instantiated)
                if (entityDef.id === player.id || entityDef.id === startLocation.id) {
                    continue;
                }

                // Check if the definition includes a Position component configuration
                // Use the actual key from your JSON data (e.g., "Position")
                // This check happens *before* instantiation.
                if (entityDef.components && entityDef.components.Position) {
                    // Check if it's already somehow active (shouldn't happen here, but safety check)
                    if (this.#entityManager.activeEntities.has(entityDef.id)) {
                        console.warn(`GameEngine: Entity ${entityDef.id} requested for initial instantiation but already exists. Skipping.`);
                        continue;
                    }

                    console.log(`GameEngine: Found initial entity definition with Position: ${entityDef.id}. Instantiating...`);
                    const instance = this.#entityManager.createEntityInstance(entityDef.id);
                    if (instance) {
                        // Verify it has the PositionComponent after creation (should always be true if definition had it)
                        if (!instance.hasComponent(PositionComponent)) {
                            console.error(`GameEngine: CRITICAL - Instantiated ${instance.id} but it lacks the expected PositionComponent!`);
                            // Decide how to handle this - throw? log?
                        }
                        initialEntityCount++;
                    } else {
                        // createEntityInstance should log details, but add a warning here too
                        console.warn(`GameEngine: Failed to instantiate initial entity from definition: ${entityDef.id}`);
                        // Consider if this failure should halt initialization. For now, just warn.
                    }
                }
            }
            console.log(`GameEngine: Instantiated ${initialEntityCount} additional initial world entities.`);

            // --- Build Spatial Index AFTER all initial entities are created ---
            console.log("GameEngine: Building initial spatial index...");
            this.#entityManager.buildInitialSpatialIndex(); // Call the method on EntityManager
            console.log("GameEngine: Initial spatial index built successfully.");

        } catch (error) {
            console.error("GameEngine: Error during initial world entity instantiation or spatial index build:", error);
            // This is likely a critical failure
            if (this.#eventBus) {
                this.#eventBus.dispatch('ui:message_display', {
                    text: `Fatal Error setting up world: ${error.message}`,
                    type: 'error'
                });
                this.#eventBus.dispatch('ui:set_title', {text: "Initialization Failed!"});
                this.#eventBus.dispatch('ui:disable_input', {message: "World setup failed."});
            }
            throw error; // Re-throw to halt initialization
        }
    }

    /**
     * Handles the 'ui:request_inventory_render' event.
     * Fetches player inventory data and dispatches 'ui:render_inventory'.
     * @private
     */
    #handleInventoryRenderRequest() {
        if (!this.#isInitialized) return; // Don't process if not ready

        const player = this.#gameStateManager.getPlayer();
        if (!player) {
            console.error("GameEngine: Cannot render inventory, player entity not found.");
            // Optionally dispatch render with error state
            this.#eventBus.dispatch('ui:render_inventory', { items: [] }); // Send empty on error
            return;
        }

        const inventoryComp = player.getComponent(InventoryComponent);
        if (!inventoryComp) {
            console.log(`GameEngine: Player ${player.id} has no InventoryComponent. Rendering empty inventory.`);
            this.#eventBus.dispatch('ui:render_inventory', { items: [] }); // Player might not have inventory
            return;
        }

        const itemIds = inventoryComp.getItems();
        /** @type {ItemUIData[]} */
        const itemsData = [];

        for (const itemId of itemIds) {
            const itemInstance = this.#entityManager.getEntityInstance(itemId);
            if (!itemInstance) {
                console.warn(`GameEngine: Inventory contains item ID '${itemId}' but instance not found. Skipping.`);
                continue;
            }

            const nameComp = itemInstance.getComponent(NameComponent);
            const itemName = nameComp ? nameComp.value : '(Unknown Item)';

            // Placeholder for icon/description - fetch from ItemComponent or definition if needed
            // const itemComp = itemInstance.getComponent(ItemComponent);
            // const itemDef = this.#dataManager.getEntityDefinition(itemId);
            // const icon = itemComp?.icon || itemDef?.components?.Item?.icon || null;
            // const description = itemComp?.description || itemDef?.components?.Item?.description || '';
            const icon = null; // Placeholder
            const description = ''; // Placeholder

            itemsData.push({
                id: itemId,
                name: itemName,
                icon: icon,
                description: description
            });
        }

        /** @type {InventoryRenderPayload} */
        const payload = { items: itemsData };

        // Dispatch the event for the DomRenderer to handle
        this.#eventBus.dispatch('ui:render_inventory', payload);
        console.log(`GameEngine: Dispatched 'ui:render_inventory' with ${itemsData.length} items.`);
    }


    /**
     * Starts the game engine after successful initialization.
     * @returns {Promise<void>}
     */
    async start() {
        console.log("GameEngine: Start requested.");
        try {
            const initSuccess = await this.#initialize();

            if (initSuccess && this.#isInitialized && this.#gameLoop) {
                console.log("GameEngine: Initialization successful. Starting GameLoop...");
                // --- Set final title via event ---
                this.#eventBus.dispatch('ui:set_title', {text: "Dungeon Run Demo"});

                // --- Dispatch Welcome Message & Initial Room Event ---
                // Moved here to ensure all entities are placed before first description
                this.#eventBus.dispatch('ui:message_display', {
                    text: "Welcome to Dungeon Run Demo!",
                    type: "info"
                });

                const player = this.#gameStateManager.getPlayer();
                const startLocation = this.#gameStateManager.getCurrentLocation();
                if (player && startLocation) {
                    this.#eventBus.dispatch('event:room_entered', {
                        playerEntity: player,
                        newLocation: startLocation,
                        previousLocation: null // Important differentiator for initial entry
                    });
                    console.log("GameEngine: Initial 'event:room_entered' dispatched after initialization.");
                } else {
                    console.error("GameEngine: Cannot dispatch initial room_entered event - player or start location missing.");
                    // This indicates a problem earlier in initialization.
                }


                this.#gameLoop.start(); // This enables input via eventBus ('ui:enable_input')
                console.log("GameEngine: GameLoop started.");
                this.#eventBus.dispatch('ui:message_display', {text: "Game loop started. Good luck!", type: 'info'});
            } else {
                console.error("GameEngine: Initialization failed or incomplete. Cannot start GameLoop.");
                // Error messages/title updates should have been handled during #initialize() failure
            }
        } catch (error) {
            // Catch errors specifically from the #initialize() call itself if it threw unexpectedly
            console.error("GameEngine: Unexpected error during the start process (potentially post-initialization):", error);
            const errorMsg = `A critical error occurred preventing the game from starting: ${error.message}`;
            // --- Use direct title element access ONLY as final fallback ---
            if (this.#titleElement) this.#titleElement.textContent = "Fatal Start Error!";

            // Use alert as a robust fallback (remains the same)
            alert(errorMsg + " Check console (F12).");
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