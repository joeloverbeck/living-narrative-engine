// main.js

// --- ONLY Import the Engine ---
import GameEngine from './src/core/gameEngine.js';

// --- Bootstrap the Game Engine ---
// Use an async IIFE (Immediately Invoked Function Expression) or top-level await
(async () => {
    console.log("main.js: Bootstrapping application...");

    // --- Get Root DOM Elements needed by the Engine or for Fallback (NOW LOCAL) ---
    const outputDiv = document.getElementById('output');
    const errorDiv = document.getElementById('error-output'); // For fallback errors
    const inputEl = document.getElementById('command-input');
    const titleEl = document.querySelector('h1'); // For fallback errors/status & passing to engine

    // --- Basic check if essential elements exist before even creating the engine ---
    // Uses the locally scoped variables now
    if (!outputDiv || !inputEl || !errorDiv || !titleEl) {
        const missing = [
            !outputDiv ? 'output' : null,
            !inputEl ? 'command-input' : null,
            !errorDiv ? 'error-output' : null,
            !titleEl ? 'h1 title' : null // Changed variable name here
        ].filter(Boolean).join(', ');
        const errorMsg = `Fatal Error: Cannot find required HTML elements: ${missing}. Application cannot start.`;
        console.error("main.js:", errorMsg)
        // Fallback using local variables
        if (errorDiv) errorDiv.textContent = errorMsg; else alert(errorMsg);
        if (titleEl) titleEl.textContent = "Fatal Error!"; // Changed variable name here
        if (inputEl) inputEl.disabled = true;
        return; // Stop execution
    }


    let gameEngine = null;
    try {
        // --- Instantiate the Engine ---
        // Pass all required elements explicitly
        gameEngine = new GameEngine({
            outputDiv: outputDiv,
            inputElement: inputEl,
            titleElement: titleEl // Pass the title element
        });

        // --- Start the Engine ---
        // This triggers initialization and then the game loop start internally.
        await gameEngine.start();

        // If start() completes without throwing, the game is running (or failed initialization softly)
        console.log("main.js: GameEngine start sequence initiated.");
        // The final title ("Dungeon Run Demo") should be set *internally* by the engine
        // via an event handled by the renderer.

    } catch (error) {
        // --- Catch Catastrophic Errors During Engine Instantiation or Start ---
        // This is the *ultimate* fallback if the engine's internal error handling fails
        // or if the GameEngine constructor itself throws.
        console.error("main.js: CATASTROPHIC ERROR during GameEngine instantiation or start():", error);

        // Use the fallback error display (local variables)
        if (titleEl) titleEl.textContent = "FATAL ERROR!"; // Changed variable name here
        if (errorDiv) {
            errorDiv.textContent = `A critical error occurred during application startup: ${error.message}. The game cannot run. Check console (F12).`;
            errorDiv.style.display = 'block'; // Ensure it's visible
        } else {
            // Absolute fallback if errorDiv is missing too
            alert(`A critical error occurred during application startup: ${error.message}. The game cannot run. Check console (F12).`);
        }

        // Disable input as a fallback (local variable)
        if (inputEl) {
            inputEl.placeholder = "Critical Error.";
            inputEl.disabled = true;
        }

        // Attempt to stop the game loop (remains the same)
        if (gameEngine && gameEngine.gameLoop && typeof gameEngine.gameLoop.stop === 'function') {
            try {
                gameEngine.gameLoop.stop();
            } catch (stopErr) {
                console.error("main.js: Error trying to stop game loop during catastrophic cleanup:", stopErr);
            }
        }
    }
})(); // Execute the async function immediately
