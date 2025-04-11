// src/core/gameEngine.js

// --- Type Imports ---
/** @typedef {import('./appContainer.js').default} AppContainer */
/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../../dataManager.js').default} DataManager */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('../../gameStateManager.js').default} GameStateManager */
/** @typedef {import('../../inputHandler.js').default} InputHandler */
/** @typedef {import('../../gameLoop.js').default} GameLoop */
/** @typedef {import('../components/inventoryComponent.js').InventoryComponent} InventoryComponent */
/** @typedef {import('../components/nameComponent.js').NameComponent} NameComponent */
/** @typedef {import('../components/positionComponent.js').PositionComponent} PositionComponent */
/** @typedef {import('./gameStateInitializer.js').default} GameStateInitializer */
/** @typedef {import('./worldInitializer.js').default} WorldInitializer */


// --- Component Class Imports (needed for getComponent checks) ---
import { PositionComponent } from '../components/positionComponent.js';
import { InventoryComponent } from '../components/inventoryComponent.js';
import { NameComponent } from '../components/nameComponent.js';
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
    /** @type {HTMLElement} */
    #titleElement;

    /**
     * Creates a new GameEngine instance.
     * @param {object} options
     * @param {AppContainer} options.container - The application's dependency container.
     * @param {HTMLElement} options.titleElement - The H1 element for displaying titles/status.
     */
    constructor({ container, titleElement }) {
        if (!container) {
            throw new Error("GameEngine requires a valid AppContainer instance.");
        }
        if (!titleElement || !(titleElement instanceof HTMLHeadingElement)) {
            throw new Error("GameEngine requires a valid 'titleElement' HTMLHeadingElement (H1).");
        }
        this.#container = container;
        this.#titleElement = titleElement;

        console.log("GameEngine: Instance created with AppContainer. Ready to initialize.");
    }

    /**
     * Initializes all core game systems asynchronously.
     * @returns {Promise<boolean>} True if initialization succeeded, false otherwise.
     * @private
     */
    async #initialize() {
        console.log("GameEngine: Starting initialization sequence using container...");

        try {
            // --- Resolve core components early ---
            this.#eventBus = this.#container.resolve('EventBus');
            console.log("GameEngine: EventBus resolved.");
            this.#container.resolve('DomRenderer'); // Resolve early for UI updates
            console.log("GameEngine: DomRenderer resolved.");

            this.#eventBus.dispatch('ui:set_title', { text: "Initializing Engine..." });
            this.#eventBus.dispatch('ui:message_display', { text: "Initializing data manager...", type: 'info' });

            // --- Load Data ---
            this.#eventBus.dispatch('ui:set_title', { text: "Loading Game Data..." });
            const dataManager = this.#container.resolve('DataManager');
            await dataManager.loadAllData();
            console.log("GameEngine: DataManager resolved and data loaded.");
            this.#eventBus.dispatch('ui:message_display', { text: "Game data loaded.", type: 'info' });

            // --- Resolve Managers needed for setup ---
            this.#eventBus.dispatch('ui:set_title', { text: "Initializing Systems..." });
            const entityManager = this.#container.resolve('EntityManager'); // Keep resolving here if needed elsewhere
            const actionExecutor = this.#container.resolve('ActionExecutor'); // Keep resolving here
            const gameStateManager = this.#container.resolve('GameStateManager'); // Keep resolving here
            console.log("GameEngine: EntityManager, ActionExecutor, and GameStateManager resolved.");

            // ---> Initialize Registries <---
            console.log("GameEngine: Initializing component and action handler registries...");
            const registryInitializer = new RegistryInitializer();
            registryInitializer.initializeRegistries(entityManager, actionExecutor);
            console.log("GameEngine: Component and Action Handler registries initialized via RegistryInitializer.");

            // --- Initialize Systems that Require it ---
            const systemsToInitialize = [
                'TriggerSystem', 'EquipmentSystem', 'InventorySystem', 'CombatSystem',
                'DeathSystem', 'MovementSystem', 'WorldInteractionSystem', 'ItemUsageSystem',
                'DoorSystem', 'QuestSystem', 'QuestStartTriggerSystem', 'NotificationUISystem'
            ];
            // ... (system initialization loop remains the same) ...
            for (const key of systemsToInitialize) {
                const system = this.#container.resolve(key);
                if (system && typeof system.initialize === 'function') {
                    console.log(`GameEngine: Initializing system: ${key}...`);
                    system.initialize();
                } else {
                    console.log(`GameEngine: Resolved system: ${key} (no initialize method or already initialized).`);
                }
            }
            console.log("GameEngine: Core systems resolved and initialized.");


            // --- Core Game Setup (Player & Starting Location via Service) ---
            this.#eventBus.dispatch('ui:set_title', { text: "Setting Initial Game State..." });
            this.#eventBus.dispatch('ui:message_display', { text: "Setting initial game state...", type: 'info' });
            const gameStateInitializer = this.#container.resolve('GameStateInitializer');
            const setupSuccess = gameStateInitializer.setupInitialState();
            if (!setupSuccess) {
                throw new Error("Initial game state setup failed via GameStateInitializer.");
            }
            console.log("GameEngine: Initial game state setup completed via GameStateInitializer.");

            // --- Instantiate Other Initial Entities & Build Spatial Index (via NEW Service) --- // <-- MODIFIED SECTION
            this.#eventBus.dispatch('ui:set_title', { text: "Initializing World Entities..." });
            this.#eventBus.dispatch('ui:message_display', { text: "Instantiating world entities...", type: 'info' });
            // Resolve the new WorldInitializer service
            const worldInitializer = this.#container.resolve('WorldInitializer');
            // Call its method to perform the setup
            const worldInitSuccess = worldInitializer.initializeWorldEntities(); // Error handling is done via exceptions inside
            if (!worldInitSuccess) { // Should not happen if exceptions are used, but good safety check
                throw new Error("World initialization failed via WorldInitializer.");
            }
            console.log("GameEngine: Initial world entities instantiated and spatial index built via WorldInitializer.");
            // --- End Modified Section ---

            // --- Configure Input Handler ---
            const inputHandler = this.#container.resolve('InputHandler');
            const processInputCommand = (command) => {
                // ... (input handling logic remains the same) ...
                if (this.#eventBus) this.#eventBus.dispatch('ui:command_echo', { command });
                if (this.#gameLoop && this.#gameLoop.isRunning) {
                    this.#gameLoop.processSubmittedCommand(command);
                } else {
                    console.warn("GameEngine: Input received, but GameLoop is not ready/running.");
                    if (this.#eventBus) this.#eventBus.dispatch('ui:disable_input', { message: "Game not running." });
                }
            };
            inputHandler.setCommandCallback(processInputCommand);
            console.log("GameEngine: InputHandler resolved and configured.");

            // --- Resolve Game Loop ---
            this.#gameLoop = this.#container.resolve('GameLoop');
            console.log("GameEngine: GameLoop resolved.");

            // --- Subscribe to Engine-Level Events ---
            this.#eventBus.subscribe('ui:request_inventory_render', this.#handleInventoryRenderRequest.bind(this));
            console.log("GameEngine: Subscribed to 'ui:request_inventory_render'.");

            // --- Initialization Complete ---
            this.#isInitialized = true;
            console.log("GameEngine: Initialization sequence completed successfully.");
            this.#eventBus.dispatch('ui:set_title', { text: "Initialization Complete. Starting..." });
            this.#eventBus.dispatch('ui:message_display', { text: "Initialization complete.", type: 'success' });

            return true;

        } catch (error) {
            // ... (error handling remains the same) ...
            console.error("GameEngine: CRITICAL ERROR during initialization sequence:", error);
            const errorMsg = `Game initialization failed: ${error.message}. Check console (F12) for details.`;
            if (this.#eventBus) {
                try {
                    this.#eventBus.dispatch('ui:set_title', { text: "Fatal Initialization Error!" });
                    this.#eventBus.dispatch('ui:message_display', { text: errorMsg, type: 'error' });
                    this.#eventBus.dispatch('ui:disable_input', { message: "Error during startup." });
                } catch (eventBusError) {
                    console.error("GameEngine: Failed to dispatch error messages via EventBus:", eventBusError);
                    if (this.#titleElement) this.#titleElement.textContent = "Fatal Initialization Error!";
                }
            } else {
                console.error("GameEngine: EventBus not available to display initialization error.");
                if (this.#titleElement) this.#titleElement.textContent = "Fatal Initialization Error!";
                try {
                    const inputElement = this.#container.resolve('inputElement');
                    if (inputElement) inputElement.disabled = true;
                } catch (inputResolveError) {
                    console.error("GameEngine: Could not resolve inputElement to disable on error.");
                }
            }
            try {
                const inputHandler = this.#container.resolve('InputHandler');
                if (inputHandler && typeof inputHandler.disable === 'function') {
                    inputHandler.disable();
                }
            } catch(inputHandlerError) {
                console.error("GameEngine: Could not resolve InputHandler to disable on error during initialization failure.");
            }
            this.#isInitialized = false;
            return false;
        }
    }


    /**
     * Handles the 'ui:request_inventory_render' event.
     * (No changes needed in implementation)
     * @private
     */
    #handleInventoryRenderRequest() {
        // Implementation remains the same, relies on initialized entityManager
        if (!this.#isInitialized || !this.#eventBus) return;

        const gameStateManager = this.#container.resolve('GameStateManager');
        const entityManager = this.#container.resolve('EntityManager');

        const player = gameStateManager.getPlayer();
        if (!player) {
            console.error("GameEngine: Cannot render inventory, player entity not found in GameStateManager.");
            this.#eventBus.dispatch('ui:render_inventory', { items: [] });
            return;
        }

        const inventoryComp = player.getComponent(InventoryComponent);
        if (!inventoryComp) {
            console.log(`GameEngine: Player ${player.id} has no InventoryComponent. Rendering empty inventory.`);
            this.#eventBus.dispatch('ui:render_inventory', { items: [] });
            return;
        }

        const itemIds = inventoryComp.getItems();
        const itemsData = [];

        for (const itemId of itemIds) {
            const itemInstance = entityManager.getEntityInstance(itemId);
            if (!itemInstance) {
                console.warn(`GameEngine: Inventory contains item ID '${itemId}' but instance not found. Skipping.`);
                continue;
            }

            const nameComp = itemInstance.getComponent(NameComponent);
            const itemName = nameComp ? nameComp.value : '(Unknown Item)';
            const icon = null; // Placeholder
            // Example: trying to get description - assumes 'Description' is a registered component key
            const descriptionComp = itemInstance.getComponent('Description');
            const description = descriptionComp ? descriptionComp.value : '';

            itemsData.push({ id: itemId, name: itemName, icon: icon, description: description });
        }

        const payload = { items: itemsData };
        this.#eventBus.dispatch('ui:render_inventory', payload);
    }

    /**
     * Starts the game engine after successful initialization.
     * (No changes needed in implementation, but relies on correct initialization)
     * @returns {Promise<void>}
     */
    async start() {
        // Implementation remains the same
        try {
            const initSuccess = await this.#initialize(); // Calls the updated initialize method

            if (initSuccess && this.#isInitialized && this.#gameLoop && this.#eventBus) {
                console.log("GameEngine: Initialization successful. Starting GameLoop...");
                this.#eventBus.dispatch('ui:set_title', { text: "Dungeon Run Demo" });
                this.#eventBus.dispatch('ui:message_display', { text: "Welcome to Dungeon Run Demo!", type: "info" });

                const gameStateManager = this.#container.resolve('GameStateManager');
                const player = gameStateManager.getPlayer();
                const startLocation = gameStateManager.getCurrentLocation();

                // This check is now more critical as player/location come from GameStateInitializer
                if (player && startLocation) {
                    this.#eventBus.dispatch('event:room_entered', {
                        playerEntity: player,
                        newLocation: startLocation,
                        previousLocation: null
                    });
                    console.log("GameEngine: Initial 'event:room_entered' dispatched.");
                } else {
                    console.error("GameEngine: Cannot dispatch initial room_entered event - player or start location missing after initialization via GameStateInitializer.");
                    throw new Error("Game state inconsistent after initialization.");
                }

                this.#gameLoop.start();
                console.log("GameEngine: GameLoop started.");
                this.#eventBus.dispatch('ui:message_display', { text: "Game loop started. Good luck!", type: 'info' });
            } else {
                console.error("GameEngine: Initialization failed or essential components missing. Cannot start GameLoop. Check logs from #initialize.");
                // Potentially display a user-facing error if initSuccess is false
                if (!initSuccess && this.#titleElement) {
                    this.#titleElement.textContent = "Initialization Failed!";
                }
            }
        } catch (error) {
            console.error("GameEngine: Unexpected error during the start process:", error);
            const errorMsg = `A critical error occurred preventing the game from starting: ${error.message}`;
            if (this.#titleElement) this.#titleElement.textContent = "Fatal Start Error!";
            alert(errorMsg + " Check console (F12).");

            try {
                const inputElement = this.#container.resolve('inputElement');
                if (inputElement) {
                    inputElement.placeholder = "Critical Error.";
                    inputElement.disabled = true;
                }
            } catch (finalError) {
                console.error("GameEngine: Failed to disable input during final error handling.");
            }
        }
    }

    /**
     * Stops the game engine and performs cleanup.
     * (No changes needed in implementation)
     */
    stop() {
        // Implementation remains the same
        console.log("GameEngine: Stop requested.");
        if (this.#gameLoop && this.#gameLoop.isRunning) {
            this.#gameLoop.stop();
            console.log("GameEngine: GameLoop stopped.");
        } else {
            console.log("GameEngine: GameLoop already stopped or not initialized.");
        }

        try {
            const systemsWithShutdown = ['WorldInteractionSystem', 'DoorSystem'];
            for (const key of systemsWithShutdown) {
                // Check if resolved before calling shutdown
                if (this.#container.isResolved(key)) { // Assuming AppContainer has an isResolved method
                    const system = this.#container.resolve(key);
                    if (system && typeof system.shutdown === 'function') {
                        console.log(`GameEngine: Shutting down system: ${key}...`);
                        system.shutdown();
                    }
                } else {
                    console.log(`GameEngine: System ${key} not resolved, skipping shutdown.`);
                }
            }
        } catch (error) {
            console.error("GameEngine: Error during system shutdown:", error);
        }

        if (this.#container) {
            this.#container.disposeSingletons();
        }

        this.#isInitialized = false;
        this.#gameLoop = null;
        this.#eventBus = null; // Release reference
        console.log("GameEngine: Engine stopped and container singletons disposed.");
    }
}

export default GameEngine;