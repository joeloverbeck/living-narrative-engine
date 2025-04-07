// main.js

import DataManager from "./DataManager.js";
import EntityManager from "./src/entities/entityManager.js";
import GameLoop from "./gameLoop.js";

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
    let gameLoop = null;

    try {
        title.textContent = "Loading Game Data...";
        await dataManager.loadAllData();
        title.textContent = "Game Data Loaded. Initializing Entities...";
        outputDiv.innerHTML = `<p>Data Manager ready. Schemas and definitions loaded.</p>`;

        // --- Instantiate EntityManager ---
        entityManager = new EntityManager(dataManager);
        // Components should be auto-registered in the constructor now
        outputDiv.innerHTML += `<p>Entity Manager initialized. Registering components...</p>`;

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

        outputDiv.innerHTML += `<p>Components registered.</p>`;

        // --- Instantiate CORE entities needed BEFORE game loop starts ---
        // Player is crucial for the loop
        const playerEntity = entityManager.createEntityInstance('core:player');
        if (!playerEntity) {
            throw new Error("Failed to instantiate player entity 'core:player'. Cannot start game.");
        }
        outputDiv.innerHTML += `<p>Player entity 'core:player' instantiated.</p>`;
        // You might instantiate starting location items/NPCs here too, or let GameLoop handle it

        // --- Initialize and Start the Game Loop ---
        title.textContent = "Starting Game Loop...";
        gameLoop = new GameLoop(dataManager, entityManager, outputDiv, inputEl);
        await gameLoop.initializeAndStart(); // Initialize player, starting location etc.

        title.textContent = "Dungeon Run Demo"; // Set final title

    } catch (error) {
        console.error("Game initialization failed:", error);
        title.textContent = "Fatal Error!";
        const errorMsg = `Game initialization failed. Check the console (F12) for details. Error: ${error.message}`;
        // Display error in dedicated init error div OR the main output
        errorDiv.textContent = errorMsg; // Use dedicated div
        // outputDiv.innerHTML = `<div class="message message-error">${errorMsg}</div>`; // Use main output
        inputEl.placeholder = "Error during startup.";
        inputEl.disabled = true;
        if (gameLoop && gameLoop.isRunning) {
            gameLoop.stop(); // Attempt to stop loop if it partially started
        }
    }
}

// Kick off the game initialization
initializeGame().then(() => {
    console.log("Game initialization sequence finished.");
}).catch(err => {
    console.error("Unhandled error during game initialization promise chain:", err);
    title.textContent = "Fatal Unhandled Error!";
    errorDiv.textContent = `An unexpected error occurred: ${err.message}. Check console.`;
    inputEl.placeholder = "Error during startup.";
    inputEl.disabled = true;
});