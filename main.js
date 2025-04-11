// main.js

// --- ONLY Import the Engine ---
import GameEngine from './src/core/gameEngine.js';
import AppContainer from "./src/core/appContainer.js";
import {registerCoreServices} from "./src/core/containerConfig.js";

// --- Bootstrap the Game Engine ---
// Use an async IIFE (Immediately Invoked Function Expression) or top-level await
(async () => {
    console.log("main.js: Bootstrapping application...");

    // --- Get Root DOM Elements needed by the Engine or for Fallback (NOW LOCAL) ---
    const outputDiv = document.getElementById('output');
    const errorDiv = document.getElementById('error-output'); // For fallback errors
    const inputElement = document.getElementById('command-input');
    const titleElement = document.querySelector('h1'); // For fallback errors/status & passing to engine

    // --- Basic check if essential elements exist before even creating the engine ---
    // Uses the locally scoped variables now
    if (!outputDiv || !inputElement || !errorDiv || !titleElement) {
        const missing = [
            !outputDiv ? 'output' : null,
            !inputElement ? 'command-input' : null,
            !errorDiv ? 'error-output' : null,
            !titleElement ? 'h1 title' : null // Changed variable name here
        ].filter(Boolean).join(', ');
        const errorMsg = `Fatal Error: Cannot find required HTML elements: ${missing}. Application cannot start.`;
        console.error("main.js:", errorMsg)
        // Fallback using local variables
        if (errorDiv) errorDiv.textContent = errorMsg; else alert(errorMsg);
        if (titleElement) titleElement.textContent = "Fatal Error!"; // Changed variable name here
        if (inputElement) inputElement.disabled = true;
        return; // Stop execution
    }

    // --- Initialize Container ---
    const container = new AppContainer();

    // --- Register Services ---
    try {
        // Pass necessary external dependencies (like UI elements) during registration
        registerCoreServices(container, { outputDiv, inputElement, titleElement });
    } catch (registrationError) {
        console.error("Fatal Error: Failed to register core services:", registrationError);
        alert(`Fatal Error during service registration: ${registrationError.message}. Check console.`);
        titleElement.textContent = "Fatal Registration Error!";
        inputElement.disabled = true;
        inputElement.placeholder = "Registration Failed.";
        return; // Stop execution
    }

    // --- Create Game Engine with Container ---
    try {
        const gameEngine = new GameEngine({
            container: container,
            titleElement: titleElement // Pass title element for fallback errors
        });

        // --- Start the Game ---
        gameEngine.start().catch(startError => {
            // Catch potential unhandled promise rejections from async start()
            console.error("Fatal Error: Unhandled error during game engine start:", startError);
            alert(`Fatal Error during game start: ${startError.message}. Check console.`);
            titleElement.textContent = "Fatal Start Error!";
            inputElement.disabled = true;
        });

        // Optional: Add cleanup on window unload
        window.addEventListener('beforeunload', () => {
            if (gameEngine) {
                gameEngine.stop();
            }
        });

    } catch (engineCreationError) {
        console.error("Fatal Error: Failed to create GameEngine instance:", engineCreationError);
        alert(`Fatal Error creating game engine: ${engineCreationError.message}. Check console.`);
        titleElement.textContent = "Fatal Engine Error!";
        inputElement.disabled = true;
    }
})(); // Execute the async function immediately
