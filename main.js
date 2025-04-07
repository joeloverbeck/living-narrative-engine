// main.js

import DataManager from "./dataManager.js";
import EntityManager from "./src/entities/entityManager.js";
import GameLoop from "./gameLoop.js";
import InputHandler from "./inputHandler.js";
import DomRenderer from "./domRenderer.js";
import CommandParser from './commandParser.js';
import ActionExecutor from './src/actions/actionExecutor.js';
import GameStateManager from './gameStateManager.js';

// Import ALL component classes you need
import { AttackComponent } from './src/components/attackComponent.js';
import { ConnectionsComponent } from './src/components/connectionsComponent.js';
import { HealthComponent } from './src/components/healthComponent.js';
import { InventoryComponent } from './src/components/inventoryComponent.js';
import { ItemComponent } from './src/components/itemComponent.js';
import { NameComponent } from './src/components/nameComponent.js';
import { SkillComponent } from './src/components/skillComponent.js';
import { DescriptionComponent } from './src/components/descriptionComponent.js';
import { MetaDescriptionComponent } from './src/components/metaDescriptionComponent.js';
import { EntitiesPresentComponent } from './src/components/entitiesPresentComponent.js';
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

        // --- Initialize Input Handler ---
        inputHandler = new InputHandler(inputEl, (command) => {
            if (gameLoop) {
                gameLoop.processSubmittedCommand(command); // Renamed method
            } else {
                console.error("InputHandler callback triggered, but GameLoop is not ready!");
                errorDiv.textContent = "Error: Input handling called before game loop was ready.";
                if(renderer) renderer.setInputState(false, "Error: Game loop unavailable.");
            }
        });
        renderer.renderMessage("<p>Input Handler initialized.</p>");

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

        // --- Initialize and Start the Game Loop ---
        title.textContent = "Starting Game Loop...";

        gameLoop = new GameLoop(dataManager, entityManager, gameStateManager, renderer, inputHandler, commandParser, actionExecutor);

        await gameLoop.initializeAndStart(); // Initialize player, starting location etc.

        title.textContent = "Dungeon Run Demo"; // Set final title

    } catch (error) {
        console.error("Game initialization failed:", error);
        title.textContent = "Fatal Error!";
        const errorMsg = `Game initialization failed. Check console (F12). Error: ${error.message}`;
        if (renderer) {
            renderer.renderMessage(errorMsg, "error");
        } else {
            errorDiv.textContent = errorMsg; // Fallback
        }

        // Disable input etc. (using renderer if possible)
        if (inputHandler) inputHandler.disable();
        if (renderer) {
            renderer.setInputState(false, "Error during startup.");
        } else if (inputEl) {
            inputEl.placeholder = "Error during startup.";
            inputEl.disabled = true;
        }
        if (gameLoop && gameLoop.isRunning) {
            gameLoop.stop();
        }
    }
}

// Kick off the game initialization
initializeGame().then(() => {
    console.log("Game initialization sequence finished.");
}).catch(err => {
    console.error("Unhandled error during game initialization promise chain:", err);
    title.textContent = "Fatal Unhandled Error!";
    // Simplified error display for unhandled promise rejection
    const errorMsg = `An unexpected error occurred: ${err.message}. Check console.`;
    if (document.getElementById('error-output')) { // Use errorDiv if available
        document.getElementById('error-output').textContent = errorMsg;
    } else {
        alert(errorMsg); // Crude fallback
    }
    if (inputEl) {
        inputEl.placeholder = "Error during startup.";
        inputEl.disabled = true;
    }
    // Attempt to access and disable handlers/renderers might be complex here
    // depending on how they are exposed or stored globally (if at all).
});