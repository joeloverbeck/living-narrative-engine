// main.js

import GameEngine from './src/core/gameEngine.js';
import AppContainer from "./src/core/appContainer.js";
import {registerCoreServices} from "./src/core/containerConfig.js";

// --- Define the Active World ---
const ACTIVE_WORLD = 'demo'; // Specify the world to load

// --- Bootstrap the Game Engine ---
// Use an async IIFE (Immediately Invoked Function Expression) or top-level await
(async () => {
    console.log("main.js: Bootstrapping application...");

    // --- Get Root DOM Elements ---
    const outputDiv = document.getElementById('output');
    const errorDiv = document.getElementById('error-output'); // For fallback errors
    const inputElement = document.getElementById('command-input');
    const titleElement = document.querySelector('h1'); // For engine status and fallback errors

    // --- Basic check if essential elements exist ---
    if (!outputDiv || !inputElement || !errorDiv || !titleElement) {
        const missing = [
            !outputDiv ? 'output' : null,
            !inputElement ? 'command-input' : null,
            !errorDiv ? 'error-output' : null,
            !titleElement ? 'h1 title' : null
        ].filter(Boolean).join(', ');
        const errorMsg = `Fatal Error: Cannot find required HTML elements: ${missing}. Application cannot start.`;
        console.error("main.js:", errorMsg)
        if (errorDiv) errorDiv.textContent = errorMsg; else alert(errorMsg);
        if (titleElement) titleElement.textContent = "Fatal Error!";
        if (inputElement) inputElement.disabled = true;
        return; // Stop execution
    }

    // --- Initialize Container ---
    const container = new AppContainer();

    // --- Register Services ---
    try {
        registerCoreServices(container, { outputDiv, inputElement, titleElement });
    } catch (registrationError) {
        console.error("Fatal Error: Failed to register core services:", registrationError);
        const errorMsg = `Fatal Error during service registration: ${registrationError.message}. Check console.`;
        alert(errorMsg);
        // Use local variables for fallback UI update
        if (titleElement) titleElement.textContent = "Fatal Registration Error!";
        if (inputElement) {
            inputElement.disabled = true;
            inputElement.placeholder = "Registration Failed.";
        }
        return; // Stop execution
    }

    let gameEngine = null; // Declare outside try block for use in unload listener

    // --- Create Game Engine with Container ---
    try {
        gameEngine = new GameEngine({
            container: container
        });

        // --- Start the Game ---
        // The catch block here will handle errors thrown from gameEngine.start()
        // which includes errors propagated from gameEngine.#initialize()
        // --- <<< CHANGE: Pass ACTIVE_WORLD to start() (AC2) >>> ---
        gameEngine.start(ACTIVE_WORLD).catch(startError => {
            console.error("Fatal Error: Unhandled error during game engine start:", startError);
            const errorMsg = `Fatal Error during game start: ${startError.message}. Check console.`;
            alert(errorMsg);
            // Use local variables for fallback UI update
            if (titleElement) titleElement.textContent = "Fatal Start Error!";
            if (inputElement) {
                inputElement.disabled = true;
                // The placeholder might already be set by the engine's error handler
                // if it managed to resolve the inputElement via the container,
                // but setting it here ensures it's disabled.
                inputElement.placeholder = "Game Failed to Start";
            }
        });

        // Optional: Add cleanup on window unload
        window.addEventListener('beforeunload', () => {
            // Check if gameEngine was successfully created before trying to stop
            if (gameEngine) {
                gameEngine.stop();
            }
        });

    } catch (engineCreationError) {
        // Catch errors during the GameEngine *constructor* itself
        console.error("Fatal Error: Failed to create GameEngine instance:", engineCreationError);
        const errorMsg = `Fatal Error creating game engine: ${engineCreationError.message}. Check console.`;
        alert(errorMsg);
        // Use local variables for fallback UI update
        if (titleElement) titleElement.textContent = "Fatal Engine Error!";
        if (inputElement) {
            inputElement.disabled = true;
            inputElement.placeholder = "Engine Creation Failed.";
        }
    }
})(); // Execute the async function immediately