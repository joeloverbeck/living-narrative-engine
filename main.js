import DataManager from "./DataManager.js";
import EntityManager from "./src/entities/entityManager.js";

// Import ALL component classes you need
import { AttackComponent } from './src/components/attackComponent.js';
import { ConnectionsComponent } from './src/components/connectionsComponent.js';
import { HealthComponent } from './src/components/healthComponent.js';
import { InventoryComponent } from './src/components/inventoryComponent.js';
import { ItemComponent } from './src/components/itemComponent.js';
import { NameComponent } from './src/components/nameComponent.js';
import { SkillComponent } from './src/components/skillComponent.js';
import { DescriptionComponent } from './src/components/descriptionComponent.js';

const outputDiv = document.getElementById('output');
const errorDiv = document.getElementById('error-output');
const title = document.querySelector('h1');

async function initializeGame() {
    const dataManager = new DataManager();
    let entityManager = null; // Initialize entityManager

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
        // ... register any other components ...

        outputDiv.innerHTML += `<p>Components registered.</p>`;

        // --- Instantiate the Player Entity ---
        const playerEntity = entityManager.createEntityInstance('core:player');

        if (playerEntity) {
            // Access components using the imported class names
            outputDiv.innerHTML += `<h2>Player Entity Instantiated:</h2>`;
            outputDiv.innerHTML += `<pre>${playerEntity.toString()}</pre>`;

            // --- Demonstrate Accessing Components ---
            const playerNameComp = playerEntity.getComponent(NameComponent);
            const playerHealthComp = playerEntity.getComponent(HealthComponent);
            const playerInvComp = playerEntity.getComponent(InventoryComponent);

            if (playerNameComp) {
                outputDiv.innerHTML += `<p>Player Name: ${playerNameComp.value}</p>`;
            }
            if (playerHealthComp) {
                outputDiv.innerHTML += `<p>Player HP: ${playerHealthComp.current} / ${playerHealthComp.max}</p>`;
            }
            if (playerInvComp) {
                outputDiv.innerHTML += `<p>Player Inventory: ${playerInvComp.items.length > 0 ? playerInvComp.items.join(', ') : 'Empty'}</p>`;
            }

            outputDiv.innerHTML += `<p>Attempting to get non-existent component (AttackComponent): ${playerEntity.getComponent(AttackComponent)}</p>`; // Example

        } else {
            outputDiv.innerHTML += `<p class="error">Failed to instantiate player entity 'core:player'. Check console.</p>`;
        }

        // --- Instantiate another entity (e.g., an item) ---
        const keyEntity = entityManager.createEntityInstance('demo:item_key');
        if (keyEntity) {
            outputDiv.innerHTML += `<h2>Key Entity Instantiated:</h2>`;
            outputDiv.innerHTML += `<pre>${keyEntity.toString()}</pre>`;
            const keyItemComp = keyEntity.getComponent(ItemComponent);
            const keyNameComp = keyEntity.getComponent(NameComponent);
            const descriptionComp = keyEntity.getComponent(DescriptionComponent);

            if (keyNameComp) {
                outputDiv.innerHTML += `<p>Key Name: ${keyNameComp.value}</p>`;
            }
            if (keyItemComp) {
                outputDiv.innerHTML += `<p>Key Description: ${keyItemComp.description}</p>`;
            }
            if (descriptionComp) {
                outputDiv.innerHTML += `<p>Key's Full Description: ${descriptionComp.text}</p>`;
            } else {
                // This shouldn't happen now if registration worked
                outputDiv.innerHTML += `<p>Key has no DescriptionComponent instance (unexpected).</p>`;
            }
        } else {
            outputDiv.innerHTML += `<p class="error">Failed to instantiate item entity 'demo:item_key'. Check console.</p>`;
        }


        // --- Ready for Game Loop ---
        title.textContent = "Game Ready!";
        outputDiv.innerHTML += `<p>Game systems can now use the EntityManager to get entity instances.</p>`;
        // ... proceed with game setup / game loop ...

    } catch (error) {
        console.error("Game initialization failed:", error);
        title.textContent = "Fatal Error!";
        errorDiv.textContent = `Game initialization failed. Check the console (F12) for details. Error: ${error.message}`;
        // Optional: Log specific manager states if they exist
        if (dataManager) {
            console.log("DataManager state at error:", dataManager);
        }
        if (entityManager) {
            console.log("EntityManager state at error:", entityManager);
        }
    }
}

// Kick off the game initialization
initializeGame().then(() => {
    console.log("Game initialization sequence finished.");
}).catch(err => {
    console.error("Unhandled error during game initialization promise chain:", err);
});