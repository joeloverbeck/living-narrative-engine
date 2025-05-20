// main.js

import GameEngine from './src/core/gameEngine.js';
import AppContainer from './src/core/config/appContainer.js';
import {configureContainer} from './src/core/config/containerConfig.js';

// --- Define the Active World ---
const ACTIVE_WORLD = 'demo'; // Specify the world to load

// --- Bootstrap the Game Engine ---
// Use an async IIFE (Immediately Invoked Function Expression) or top-level await
(async () => {
    console.log('main.js: Bootstrapping application...');

    // --- Get Root DOM Elements ---
    const outputDiv = document.getElementById('outputDiv');
    const errorDiv = document.getElementById('error-output'); // For fallback errors
    const inputElement = document.getElementById('speech-input');
    const titleElement = document.querySelector('h1'); // For engine status and fallback errors

    // --- Basic check if essential elements exist ---
    if (!outputDiv || !inputElement || !errorDiv || !titleElement) {
        const missing = [
            !outputDiv ? 'output' : null,
            !inputElement ? 'speech-input' : null,
            !errorDiv ? 'error-output' : null,
            !titleElement ? 'h1 title' : null
        ].filter(Boolean).join(', ');
        const errorMsg = `Fatal Error: Cannot find required HTML elements: ${missing}. Application cannot start.`;
        console.error('main.js:', errorMsg);
        if (errorDiv) errorDiv.textContent = errorMsg; else alert(errorMsg);
        if (titleElement) titleElement.textContent = 'Fatal Error!';
        if (inputElement) inputElement.disabled = true;
        return; // Stop execution
    }

    // --- Initialize Container ---
    const container = new AppContainer();

    // --- Register Services ---
    try {
        configureContainer(container, {outputDiv, inputElement, titleElement});
    } catch (registrationError) {
        console.error('Fatal Error: Failed to register core services:', registrationError);
        const errorMsg = `Fatal Error during service registration: ${registrationError.message}. Check console.`;
        alert(errorMsg);
        // Use local variables for fallback UI update
        if (titleElement) titleElement.textContent = 'Fatal Registration Error!';
        if (inputElement) {
            inputElement.disabled = true;
            inputElement.placeholder = 'Registration Failed.';
        }
        // Attempt to log using the container if logger registered, otherwise use console
        try {
            container.resolve('ILogger').error('Fatal Error: Failed to register core services:', registrationError);
        } catch (_) {
            // Ignore if logger itself failed or wasn't registered
        }
        return; // Stop execution
    }

    let gameEngine = null; // Declare outside try block for use in unload listener
    let logger = null; // Declare logger for broader use

    try {
        logger = container.resolve('ILogger'); // Resolve logger for use in this scope
    } catch (resolveError) {
        console.error('Fatal Error: Could not resolve essential ILogger service:', resolveError);
        // Can't use logger here, fallback to console
        alert('Fatal Error resolving logger. Check console.');
        if (titleElement) titleElement.textContent = 'Fatal Logger Error!';
        if (inputElement) {
            inputElement.disabled = true;
            inputElement.placeholder = 'Logger Resolution Failed.';
        }
        return; // Stop execution
    }


    // --- Create Game Engine with Container ---
    try {
        logger.info('main.js: Creating GameEngine instance...');
        gameEngine = new GameEngine({
            container: container
            // Pass logger explicitly if GameEngine needs it directly in constructor
            // logger: logger
        });
        logger.info('main.js: GameEngine instance created.');


        // --- Start the Game ---
        logger.info(`main.js: Starting game engine with world: ${ACTIVE_WORLD}...`);
        // The catch block here will handle errors thrown from gameEngine.start()
        // which includes errors propagated from gameEngine.#initialize() and world loading
        // AC2: Pass ACTIVE_WORLD to start()
        gameEngine.start(ACTIVE_WORLD).catch(startError => {
            logger.error('Fatal Error: Unhandled error during game engine start:', startError);
            const errorMsg = `Fatal Error during game start: ${startError.message}. Check console for details.`;
            alert(errorMsg); // Show simplified error to user
            // Use local variables for fallback UI update
            if (titleElement) titleElement.textContent = 'Fatal Start Error!';
            if (inputElement) {
                inputElement.disabled = true;
                inputElement.placeholder = 'Game Failed to Start';
            }
            // The engine's error handler might provide more specific UI updates
        });

        // Optional: Add cleanup on window unload
        window.addEventListener('beforeunload', () => {
            // Check if gameEngine was successfully created before trying to stop
            if (gameEngine) {
                logger.info("main.js: 'beforeunload' event triggered. Stopping game engine.");
                gameEngine.stop();
            }
        });

    } catch (engineCreationError) {
        // Catch errors during the GameEngine *constructor* itself
        logger.error('Fatal Error: Failed to create GameEngine instance:', engineCreationError);
        const errorMsg = `Fatal Error creating game engine: ${engineCreationError.message}. Check console.`;
        alert(errorMsg);
        // Use local variables for fallback UI update
        if (titleElement) titleElement.textContent = 'Fatal Engine Error!';
        if (inputElement) {
            inputElement.disabled = true;
            inputElement.placeholder = 'Engine Creation Failed.';
        }
    }
})(); // Execute the async function immediately