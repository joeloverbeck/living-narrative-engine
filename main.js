// main.js
import DataManager from './DataManager.js';

const outputDiv = document.getElementById('output');
const errorDiv = document.getElementById('error-output');
const title = document.querySelector('h1');

async function initializeGame() {
    const dataManager = new DataManager();

    try {
        title.textContent = "Loading Game Data...";
        await dataManager.loadAllData();

        // Now the rest of the game can use the dataManager
        title.textContent = "Game Data Loaded Successfully!";
        outputDiv.innerHTML = `<p>Data Manager is ready.</p>`;

        const playerDef = dataManager.getEntityDefinition('core:player');
        outputDiv.innerHTML += `<p>Player Definition:</p><pre>${JSON.stringify(playerDef, null, 2)}</pre>`;

        const startLocation = dataManager.getLocation('demo:room_entrance');
        outputDiv.innerHTML += `<p>Start Location:</p><pre>${JSON.stringify(startLocation, null, 2)}</pre>`;

        // ... proceed with game setup ...

    } catch (error) {
        console.error("Game initialization failed due to data loading errors.", error);
        title.textContent = "Fatal Error!";
        errorDiv.textContent = `Game initialization failed due to data loading errors. Check the console (F12) for details. Error: ${error.message}`;
        // Display a user-friendly error message on the page
        // document.body.innerHTML = `<h1>Fatal Error</h1><p>Could not load game data. Please check the console for details.</p>`;
    }
}

// Kick off the game initialization
initializeGame().then(r => console.log("Game exited."));