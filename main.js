// main.js

import GameEngine from './src/core/gameEngine.js';
import AppContainer from './src/core/config/appContainer.js';
import {configureContainer} from './src/core/config/containerConfig.js';
import {tokens} from './src/core/config/tokens.js';

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
        configureContainer(container, {outputDiv, inputElement, titleElement, document: document}); // Pass document
    } catch (registrationError) {
        console.error('Fatal Error: Failed to register core services:', registrationError);
        const errorMsg = `Fatal Error during service registration: ${registrationError.message}. Check console.`;
        alert(errorMsg);
        if (titleElement) titleElement.textContent = 'Fatal Registration Error!';
        if (inputElement) {
            inputElement.disabled = true;
            inputElement.placeholder = 'Registration Failed.';
        }
        try {
            container.resolve('ILogger').error('Fatal Error: Failed to register core services:', registrationError);
        } catch (_) {
            // Ignore if logger itself failed or wasn't registered
        }
        return; // Stop execution
    }

    let gameEngine = null;
    let saveGameUI = null;
    let loadGameUI = null; // <<< ADDED
    let logger = null;

    try {
        logger = container.resolve('ILogger');
    } catch (resolveError) {
        console.error('Fatal Error: Could not resolve essential ILogger service:', resolveError);
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
        });
        logger.info('main.js: GameEngine instance created.');

        // --- Initialize Save Game UI ---
        saveGameUI = container.resolve(tokens.SaveGameUI);
        if (saveGameUI && gameEngine) {
            saveGameUI.init(gameEngine);
            logger.info('main.js: SaveGameUI initialized with GameEngine.');
        } else {
            logger.error('main.js: Failed to obtain SaveGameUI or GameEngine for SaveGameUI initialization.');
        }

        // --- Initialize Load Game UI ---
        loadGameUI = container.resolve(tokens.LoadGameUI);
        if (loadGameUI && gameEngine) {
            loadGameUI.init(gameEngine);
            logger.info('main.js: LoadGameUI initialized with GameEngine.');
        } else {
            logger.error('main.js: Failed to obtain LoadGameUI or GameEngine for LoadGameUI initialization.');
        }


        // --- Start the Game ---
        // TODO: Modify this to show a main menu first, then start new or load.
        // For now, starts new game directly.
        logger.info(`main.js: Starting game engine with world: ${ACTIVE_WORLD}...`);
        gameEngine.startNewGame(ACTIVE_WORLD).catch(startError => { // Changed from start() to startNewGame()
            logger.error('Fatal Error: Unhandled error during game engine start:', startError);
            const errorMsg = `Fatal Error during game start: ${startError.message}. Check console for details.`;
            alert(errorMsg);
            if (titleElement) titleElement.textContent = 'Fatal Start Error!';
            if (inputElement) {
                inputElement.disabled = true;
                inputElement.placeholder = 'Game Failed to Start';
            }
        });

        window.addEventListener('beforeunload', () => {
            if (gameEngine) {
                logger.info("main.js: 'beforeunload' event triggered. Stopping game engine.");
                gameEngine.stop();
            }
        });

    } catch (engineCreationError) {
        logger.error('Fatal Error: Failed to create GameEngine instance:', engineCreationError);
        const errorMsg = `Fatal Error creating game engine: ${engineCreationError.message}. Check console.`;
        alert(errorMsg);
        if (titleElement) titleElement.textContent = 'Fatal Engine Error!';
        if (inputElement) {
            inputElement.disabled = true;
            inputElement.placeholder = 'Engine Creation Failed.';
        }
    }
})();