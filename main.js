// main.js

// --- ONLY Import the Engine ---
import GameEngine from './src/core/gameEngine.js';

// --- Get Root DOM Elements needed by the Engine or for Fallback ---
const outputDiv = document.getElementById('output');
const errorDiv = document.getElementById('error-output'); // For fallback errors
const inputEl = document.getElementById('command-input');
const title = document.querySelector('h1'); // For fallback errors/status

// --- Bootstrap the Game Engine ---
// Use an async IIFE (Immediately Invoked Function Expression) or top-level await
(async () => {
    console.log("main.js: Bootstrapping application...");

    // Basic check if essential elements exist before even creating the engine
    if (!outputDiv || !inputEl || !errorDiv || !title) {
        const missing = [
            !outputDiv ? 'output' : null,
            !inputEl ? 'command-input' : null,
            !errorDiv ? 'error-output': null,
            !title ? 'h1 title': null
        ].filter(Boolean).join(', ');
        const errorMsg = `Fatal Error: Cannot find required HTML elements: ${missing}. Application cannot start.`;
        console.error("main.js:", errorMsg)
        if (errorDiv) errorDiv.textContent = errorMsg; else alert(errorMsg);
        if (title) title.textContent = "Fatal Error!";
        if (inputEl) inputEl.disabled = true;
        return; // Stop execution
    }


    let gameEngine = null;
    try {
        // --- Instantiate the Engine ---
        // Pass only the elements the engine constructor explicitly needs
        gameEngine = new GameEngine({
            outputDiv: outputDiv,
            inputElement: inputEl
        });

        // --- Start the Engine ---
        // This triggers initialization and then the game loop start internally.
        await gameEngine.start();

        // If start() completes without throwing, the game is running (or failed initialization softly)
        console.log("main.js: GameEngine start sequence initiated.");
        // The final title ("Dungeon Run Demo") should be set *internally* by the engine
        // after successful initialization, likely before calling gameLoop.start().

    } catch (error) {
        // --- Catch Catastrophic Errors During Engine Instantiation or Start ---
        // This is the *ultimate* fallback if the engine's internal error handling fails
        // or if the GameEngine constructor itself throws.
        console.error("main.js: CATASTROPHIC ERROR during GameEngine instantiation or start():", error);
        title.textContent = "FATAL ERROR!";

        // Use the fallback error display
        errorDiv.textContent = `A critical error occurred during application startup: ${error.message}. The game cannot run. Check console (F12).`;
        errorDiv.style.display = 'block'; // Ensure it's visible

        // Disable input as a fallback
        if (inputEl) {
            inputEl.placeholder = "Critical Error.";
            inputEl.disabled = true;
        }

        // Attempt to stop the game loop if the engine instance exists and has a loop
        // (Unlikely to be necessary if the error was in initialization, but safe)
        if (gameEngine && gameEngine.gameLoop && typeof gameEngine.gameLoop.stop === 'function') {
            try {
                gameEngine.gameLoop.stop();
            } catch (stopErr) {
                console.error("main.js: Error trying to stop game loop during catastrophic cleanup:", stopErr);
            }
        }
    }
})(); // Execute the async function immediately
