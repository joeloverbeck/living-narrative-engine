// main.js

import DataManager from "./dataManager.js";
import EntityManager from "./src/entities/entityManager.js";
import GameLoop from "./gameLoop.js";
import InputHandler from "./inputHandler.js";
import DomRenderer from "./domRenderer.js";
import CommandParser from './commandParser.js';
import ActionExecutor from './src/actions/actionExecutor.js';
import GameStateManager from './gameStateManager.js';
import EventBus from './eventBus.js';
import TriggerSystem from './src/systems/triggerSystem.js';

// Import ALL component classes you need
import {AttackComponent} from './src/components/attackComponent.js';
import {ConnectionsComponent} from './src/components/connectionsComponent.js';
import {HealthComponent} from './src/components/healthComponent.js';
import {InventoryComponent} from './src/components/inventoryComponent.js';
import {ItemComponent} from './src/components/itemComponent.js';
import {NameComponent} from './src/components/nameComponent.js';
import {SkillComponent} from './src/components/skillComponent.js';
import {DescriptionComponent} from './src/components/descriptionComponent.js';
import {MetaDescriptionComponent} from './src/components/metaDescriptionComponent.js';
import {EntitiesPresentComponent} from './src/components/entitiesPresentComponent.js';
import {executeMove} from "./src/actions/handlers/moveActionHandler.js";
import {executeLook} from "./src/actions/handlers/lookActionHandler.js";
import {executeTake} from "./src/actions/handlers/takeActionHandler.js";
import {executeInventory} from "./src/actions/handlers/inventoryActionHandler.js";
import {executeAttack} from "./src/actions/handlers/attackActionHandler.js";
import {executeUse} from "./src/actions/handlers/useActionHandler.js";

const outputDiv = document.getElementById('output');
const errorDiv = document.getElementById('error-output');
const inputEl = document.getElementById('command-input');
const title = document.querySelector('h1');

async function initializeGame() {
    let dataManager = null;
    let entityManager = null; // Initialize entityManager
    let gameStateManager = null;
    let renderer = null;
    let inputHandler = null;  // Initialize inputHandler
    let commandParser = null;
    let actionExecutor = null;
    let eventBus = null;
    let triggerSystem = null;
    let gameLoop = null;      // Initialize gameLoop

    try {
        title.textContent = "Loading Game Data...";
        dataManager = new DataManager(); // Instantiate DM first
        await dataManager.loadAllData();
        title.textContent = "Game Data Loaded. Initializing Entities...";
        // Use a temporary message area or console for pre-renderer output
        console.log("Data Manager ready. Schemas and definitions loaded.");

        // +++ Instantiate Renderer FIRST (needs DOM elements) +++
        renderer = new DomRenderer(outputDiv, inputEl);
        renderer.renderMessage("<p>Data Manager ready. Schemas and definitions loaded.</p>"); //

        // --- Instantiate EntityManager ---
        entityManager = new EntityManager(dataManager);
        renderer.renderMessage("<p>Entity Manager initialized. Registering components...</p>");

        // --- Manually Register Components ---
        // The first argument is the EXACT key used in your JSON files' "components" object
        // The second argument is the imported class constructor
        entityManager.registerComponent('Attack', AttackComponent);
        entityManager.registerComponent('Connections', ConnectionsComponent);
        entityManager.registerComponent('Health', HealthComponent);
        entityManager.registerComponent('Inventory', InventoryComponent);
        entityManager.registerComponent('Item', ItemComponent);
        entityManager.registerComponent('Name', NameComponent);
        entityManager.registerComponent('Skill', SkillComponent);
        entityManager.registerComponent('Description', DescriptionComponent);
        entityManager.registerComponent('MetaDescription', MetaDescriptionComponent);
        entityManager.registerComponent('EntitiesPresent', EntitiesPresentComponent);
        // ... register any other components ...

        renderer.renderMessage("<p>Components registered.</p>");

        // --- Instantiate CORE entities (Player) ---
        const playerEntity = entityManager.createEntityInstance('core:player');
        if (!playerEntity) {
            throw new Error("Failed to instantiate player entity 'core:player'. Cannot start game.");
        }
        renderer.renderMessage("<p>Player entity instantiated.</p>");

        // +++ Instantiate Game State Manager +++
        gameStateManager = new GameStateManager();
        renderer.renderMessage("<p>Game State Manager initialized.</p>");

        // --- Initialize Command Parser ---
        commandParser = new CommandParser();
        renderer.renderMessage("<p>Command Parser initialized.</p>");

        // +++ Initialize Action Executor and Register Handlers +++
        actionExecutor = new ActionExecutor();
        renderer.renderMessage("<p>Action Executor initialized. Registering handlers...</p>");

        actionExecutor.registerHandler('core:action_move', executeMove);
        actionExecutor.registerHandler('core:action_look', executeLook);
        actionExecutor.registerHandler('core:action_take', executeTake);
        actionExecutor.registerHandler('core:action_inventory', executeInventory);
        actionExecutor.registerHandler('core:action_attack', executeAttack);
        actionExecutor.registerHandler('core:action_use', executeUse);
        // Register other handlers as they are implemented
        renderer.renderMessage("<p>Action Handlers registered.</p>");

        // --- Instantiate Event Bus ---
        eventBus = new EventBus();
        renderer.renderMessage("<p>Event Bus initialized.</p>");

        // --- Instantiate Trigger System ---
        triggerSystem = new TriggerSystem(eventBus, dataManager, entityManager, gameStateManager);
        renderer.renderMessage("<p>Trigger System initialized.</p>");

        // --- Initialize Trigger System (Subscribes to events) ---
        triggerSystem.initialize();
        renderer.renderMessage("<p>Trigger System subscriptions active.</p>");

        eventBus.subscribe('ui:message_display', (message) => {
            if (renderer && message && typeof message.text === 'string') {
                // Use renderer directly here as this IS the UI update layer
                renderer.renderMessage(message.text, message.type || 'info');
            } else {
                console.warn("Received ui:message_display event but renderer or message format is invalid.", message);
            }
        });
        renderer.renderMessage("<p>Renderer subscribed to UI messages.</p>");

        // Command Echo Listener
        eventBus.subscribe('ui:command_echo', (data) => {
            if (renderer && data && typeof data.command === 'string') {
                renderer.renderMessage(`> ${data.command}`, 'command');
            } else {
                console.warn("Received ui:command_echo event but renderer or data format is invalid.", data);
            }
        });
        renderer.renderMessage("<p>Renderer subscribed to Command Echo.</p>");

        // Input Enable Listener
        eventBus.subscribe('ui:enable_input', (data) => {
            if (renderer && data && typeof data.placeholder === 'string') {
                renderer.setInputState(true, data.placeholder);
                // Focus is still handled by InputHandler.enable()
            } else {
                console.warn("Received ui:enable_input event but renderer or data format is invalid.", data);
            }
        });
        renderer.renderMessage("<p>Renderer subscribed to Input Enable.</p>");

        // Input Disable Listener
        eventBus.subscribe('ui:disable_input', (data) => {
            if (renderer && data && typeof data.message === 'string') {
                renderer.setInputState(false, data.message);
            } else {
                console.warn("Received ui:disable_input event but renderer or data format is invalid.", data);
            }
        });
        renderer.renderMessage("<p>Renderer subscribed to Input Disable.</p>");

        // --- Initialize Input Handler ---
        inputHandler = new InputHandler(inputEl, (command) => {
            // Dispatch command echo FIRST
            if (eventBus) { // Ensure eventBus is initialized
                eventBus.dispatch('ui:command_echo', {command});
            } else {
                console.error("InputHandler: Cannot dispatch command echo, EventBus not ready.");
            }

            // Then process command via GameLoop
            if (gameLoop?.isRunning) {
                gameLoop.processSubmittedCommand(command);
            } else if (!gameLoop) {
                console.error("InputHandler callback triggered, but GameLoop is not yet initialized!");
                // Use event bus for UI update if possible, fallback to direct renderer
                if (eventBus) {
                    eventBus.dispatch('ui:disable_input', {message: "Error: Game systems not ready."});
                } else if (renderer) {
                    renderer.setInputState(false, "Error: Game systems not ready.");
                }
            } else {
                console.log("InputHandler callback ignored: GameLoop is not running.");
            }
        });
        renderer.renderMessage("<p>Input Handler initialized.</p>");

        // --- Initialize and Start the Game Loop ---
        title.textContent = "Starting Game Loop...";

        // Create GameLoop WITHOUT the renderer dependency
        gameLoop = new GameLoop(
            dataManager,
            entityManager,
            gameStateManager,
            inputHandler,
            commandParser,
            actionExecutor,
            eventBus
        );

        await gameLoop.initializeAndStart(); // Initialize player, starting location etc.

        title.textContent = "Dungeon Run Demo"; // Set final title

    } catch (error) {
        console.error("Game initialization failed:", error);
        title.textContent = "Fatal Error During Startup!";
        const errorMsg = `Game initialization failed: ${error.message}. Check console (F12) for details.`;

        // Error handling remains largely the same, trying to use renderer if available
        if (renderer) {
            renderer.renderMessage(errorMsg, "error");
            renderer.setInputState(false, "Error during startup.");
        } else if (errorDiv) {
            errorDiv.textContent = errorMsg;
            if (inputEl) {
                inputEl.placeholder = "Error during startup.";
                inputEl.disabled = true;
            }
        } else {
            alert(errorMsg);
        }

        // Attempt cleanup/stop
        if (inputHandler) inputHandler.disable();
        // GameLoop stop now uses events, so calling it is safe even if renderer failed,
        // as long as eventBus was likely initialized before the error.
        if (gameLoop?.stop) { // Check if stop method exists before calling
            try {
                gameLoop.stop();
            } catch (stopErr) {
                console.error("Error during gameLoop.stop():", stopErr);
            }
        } else if (gameLoop?.isRunning) { // Fallback check if stop doesn't exist for some reason
            console.warn("GameLoop exists but stop method not found or failed.")
        }
    }
}

// Kick off the game initialization
initializeGame().then(() => {
    console.log("Game initialization sequence finished.");
}).catch(err => {
    // This catch block handles errors *not* caught within the initializeGame try/catch
    // (e.g., errors in the promise chain setup itself, though less likely here)
    console.error("Unhandled error during game initialization promise chain:", err);
    title.textContent = "Fatal Unhandled Error!";
    const errorMsg = `An unexpected critical error occurred: ${err.message}. Check console.`;
    if (document.getElementById('error-output')) {
        document.getElementById('error-output').textContent = errorMsg;
    } else {
        alert(errorMsg);
    }
    if (inputEl) {
        inputEl.placeholder = "Critical Error.";
        inputEl.disabled = true;
    }
});