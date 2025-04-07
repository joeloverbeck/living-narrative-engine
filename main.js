// main.js

import DataManager from "./dataManager.js";
import EntityManager from "./src/entities/entityManager.js";
import GameLoop from "./gameLoop.js";
import InputHandler from "./inputHandler.js";
import DomRenderer from "./domRenderer.js";
import CommandParser from './commandParser.js';

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

const outputDiv = document.getElementById('output');
const errorDiv = document.getElementById('error-output');
const inputEl = document.getElementById('command-input');
const title = document.querySelector('h1');

async function initializeGame() {
    const dataManager = new DataManager();
    let entityManager = null; // Initialize entityManager
    let gameLoop = null;      // Initialize gameLoop
    let inputHandler = null;  // Initialize inputHandler
    let renderer = null;

    try {
        title.textContent = "Loading Game Data...";
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
        // ... register any other components ...

        renderer.renderMessage("<p>Components registered.</p>");

        // --- Instantiate CORE entities needed BEFORE game loop starts ---
        const playerEntity = entityManager.createEntityInstance('core:player');
        if (!playerEntity) {
            throw new Error("Failed to instantiate player entity 'core:player'. Cannot start game.");
        }

        renderer.renderMessage("<p>Player entity 'core:player' instantiated.</p>");

        // --- Initialize Input Handler ---
        // Now InputHandler only handles events and focus, not placeholder/disabled state
        inputHandler = new InputHandler(inputEl, (command) => {
            if (gameLoop) {
                gameLoop.processSubmittedCommand(command);
            } else {
                console.error("InputHandler callback triggered, but GameLoop is not yet initialized!");
                errorDiv.textContent = "Error: Input handling called before game loop was ready.";
                if(renderer) renderer.setInputState(false, "Error: Game loop unavailable."); // Use renderer to update state
            }
        });

        renderer.renderMessage("<p>Input Handler initialized.</p>");

        const commandParser = new CommandParser();

        // --- Initialize and Start the Game Loop ---
        title.textContent = "Starting Game Loop...";

        gameLoop = new GameLoop(dataManager, entityManager, renderer, inputHandler, commandParser);

        await gameLoop.initializeAndStart(); // Initialize player, starting location etc.

        title.textContent = "Dungeon Run Demo"; // Set final title

    } catch (error) {
        console.error("Game initialization failed:", error);
        title.textContent = "Fatal Error!";
        const errorMsg = `Game initialization failed. Check the console (F12) for details. Error: ${error.message}`;
        errorDiv.textContent = errorMsg; // Keep errorDiv for critical failures before renderer might be ready

        // Use renderer if available to update input state, otherwise fallback
        if (renderer) {
            // Also tell input handler to stop listening etc.
            if (inputHandler) inputHandler.disable();
            renderer.setInputState(false, "Error during startup.");
        } else if (inputHandler) {
            inputHandler.disable("Error during startup."); // Handler might still manage its own state
        } else {
            inputEl.placeholder = "Error during startup."; // Fallback
            inputEl.disabled = true;
        }
        if (gameLoop && gameLoop.isRunning) {
            gameLoop.stop(); // Attempt to stop loop if it partially started
        }
    }
}

// Kick off the game initialization
initializeGame().then(() => {
    console.log("Game initialization sequence finished.");
}).catch(err => {
    // Similar error handling as above, prioritizing renderer if available
    console.error("Unhandled error during game initialization promise chain:", err);
    title.textContent = "Fatal Unhandled Error!";
    errorDiv.textContent = `An unexpected error occurred: ${err.message}. Check console.`;

    // Attempt to disable input via handler and renderer if they exist
    // Access instance if made global or retrieve otherwise (this part is complex, assumes access exists)
    const handler = window.inputHandler; // Example access
    const rendr = window.renderer; // Example access (need to expose renderer globally or pass refs)

    // Best effort disable
    if (handler) handler.disable(); // Stop listening
    if (rendr) { // Update visuals via renderer
        rendr.setInputState(false, "Error during startup.");
    } else { // Fallback direct DOM manipulation
        inputEl.placeholder = "Error during startup.";
        inputEl.disabled = true;
    }
});