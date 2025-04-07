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
import GameInitializer from "./src/core/gameInitializer.js";

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
    let gameInitializer = null;
    let gameLoop = null;      // Initialize gameLoop

    try {
        title.textContent = "Loading Game Data...";
        dataManager = new DataManager(); // Instantiate DM first
        await dataManager.loadAllData();
        title.textContent = "Game Data Loaded. Initializing Entities...";

        // +++ Instantiate Renderer FIRST (needs DOM elements) +++
        renderer = new DomRenderer(outputDiv, inputEl);

        // --- Instantiate Core Systems (order matters for dependencies) ---

        // --- Instantiate Event Bus ---
        eventBus = new EventBus();

        // --- Subscribe Renderer to EventBus Events EARLY ---
        // (Do this *before* initializer runs so init messages are caught)
        eventBus.subscribe('ui:message_display', (message) => {
            if (renderer && message && typeof message.text === 'string') {
                renderer.renderMessage(message.text, message.type || 'info');
            } else { /* console warning */
            }
        });
        eventBus.subscribe('ui:command_echo', (data) => {
            if (renderer && data && typeof data.command === 'string') {
                renderer.renderMessage(`> ${data.command}`, 'command');
            } else { /* console warning */
            }
        });
        eventBus.subscribe('ui:enable_input', (data) => {
            if (renderer && data && typeof data.placeholder === 'string') {
                renderer.setInputState(true, data.placeholder);
            } else { /* console warning */
            }
        });
        eventBus.subscribe('ui:disable_input', (data) => {
            if (renderer && data && typeof data.message === 'string') {
                renderer.setInputState(false, data.message);
            } else { /* console warning */
            }
        });

        // --- Instantiate EntityManager ---
        entityManager = new EntityManager(dataManager);

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

        // --- Instantiate CORE entities (Player) ---
        // CRITICAL: Do this *before* GameInitializer needs it.
        const playerEntity = entityManager.createEntityInstance('core:player');
        if (!playerEntity) {
            // This is a pre-initialization failure, handle directly
            throw new Error("Fatal: Failed to instantiate core player entity 'core:player'. Cannot proceed.");
        }
        // +++ Instantiate Game State Manager +++
        gameStateManager = new GameStateManager();

        // --- Initialize Command Parser ---
        commandParser = new CommandParser();

        // +++ Initialize Action Executor and Register Handlers +++
        actionExecutor = new ActionExecutor();

        actionExecutor.registerHandler('core:action_move', executeMove);
        actionExecutor.registerHandler('core:action_look', executeLook);
        actionExecutor.registerHandler('core:action_take', executeTake);
        actionExecutor.registerHandler('core:action_inventory', executeInventory);
        actionExecutor.registerHandler('core:action_attack', executeAttack);
        actionExecutor.registerHandler('core:action_use', executeUse);
        // Register other handlers as they are implemented

        // --- Instantiate Trigger System ---
        triggerSystem = new TriggerSystem(eventBus, dataManager, entityManager, gameStateManager);

        // --- Initialize Trigger System (Subscribes to events) ---
        triggerSystem.initialize();

        // --- *** GAME INITIALIZATION *** ---
        title.textContent = "Initializing Game State...";

        gameInitializer = new GameInitializer({ // <--- Instantiate Initializer
            dataManager,
            entityManager,
            gameStateManager,
            eventBus,
            actionExecutor
        });

        const initializationSuccess = await gameInitializer.initializeGame();

        if (!initializationSuccess) { // <--- Check Result
            // Error message should have been dispatched via EventBus by GameInitializer
            title.textContent = "Game Initialization Failed!";
            renderer.renderMessage("<p>Game Initialization failed. See messages above. Cannot start game loop.</p>", "error");
            // Ensure input remains disabled (renderer should catch disable event if needed)
            if (inputHandler) inputHandler.disable(); // Belt-and-suspenders
            else if (renderer) renderer.setInputState(false, "Initialization Failed.");

            console.error("main.js: GameInitializer.initializeGame() returned false. Aborting game start.");
            return; // Stop execution here
        }

        title.textContent = "Starting Game Loop...";

        // --- Initialize Input Handler (AFTER successful init) ---
        // Pass GameLoop instance lazily via callback closure
        inputHandler = new InputHandler(inputEl, (command) => {
            if (eventBus) {
                eventBus.dispatch('ui:command_echo', {command});
            }
            // Check gameLoop instance and its running state *inside* the callback
            if (gameLoop && gameLoop.isRunning) {
                gameLoop.processSubmittedCommand(command);
            } else {
                console.warn("Input received, but GameLoop is not ready or not running.", {
                    gameLoopExists: !!gameLoop,
                    isRunning: gameLoop?.isRunning
                });
                // Optionally disable input again if this happens unexpectedly
                if (eventBus) eventBus.dispatch('ui:disable_input', {message: "Game not running."});
            }
        });

        gameLoop = new GameLoop({
            dataManager,
            entityManager,
            gameStateManager,
            inputHandler,
            commandParser,
            actionExecutor,
            eventBus
        });

        gameLoop.start(); // Initialize player, starting location etc.

        title.textContent = "Dungeon Run Demo"; // Set final title

    } catch (error) {
        // --- Keep Existing Catch Block ---
        // This catches errors during setup *before* or *outside* GameInitializer.initializeGame's try/catch
        console.error("Game initialization failed:", error);
        title.textContent = "Fatal Error During Startup!";
        const errorMsg = `Game initialization failed: ${error.message}. Check console (F12) for details.`;

        if (renderer) {
            // Attempt to use renderer even if some parts failed, it might still work
            renderer.renderMessage(errorMsg, "error");
            // Check if message_display listener is working
            if (!eventBus?.dispatch) {
                console.warn("EventBus not available for final error message.");
            }
            renderer.setInputState(false, "Error during startup.");
        } else if (errorDiv) { /* Fallback */
        } else {
            alert(errorMsg);
        }

        if (inputHandler) inputHandler.disable();
        // Attempt to stop gameLoop if it was somehow partially created and running
        if (gameLoop?.stop) {
            try {
                gameLoop.stop();
            } catch (stopErr) { /* Log stop error */
            }
        }
    }
}

// Kick off the game initialization
initializeGame().then(() => {
    console.log("main.js: initializeGame sequence finished (either successfully started or aborted after init failure).");
}).catch(err => {
    // Catches errors *outside* the main try/catch in initializeGame
    console.error("Unhandled error during initializeGame promise chain:", err);
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