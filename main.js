// main.js

import GameEngine from './src/engine/gameEngine.js';
import AppContainer from './src/config/appContainer.js';
import {configureContainer} from './src/config/containerConfig.js';
import {tokens} from './src/config/tokens.js';

// --- Define the Active World ---
const ACTIVE_WORLD = 'demo'; // Specify the world to load

// --- Bootstrap the Game Engine ---
(async () => {
    console.log('main.js: Bootstrapping application...');

    const outputDiv = document.getElementById('outputDiv');
    const errorDiv = document.getElementById('error-output');
    const inputElement = document.getElementById('speech-input');
    const titleElement = document.querySelector('h1');

    if (!outputDiv || !inputElement || !errorDiv || !titleElement) {
        const missing = [
            !outputDiv ? 'outputDiv' : null,
            !inputElement ? 'speech-input' : null,
            !errorDiv ? 'error-output' : null,
            !titleElement ? 'h1 title' : null
        ].filter(Boolean).join(', ');
        const errorMsg = `Fatal Error: Cannot find required HTML elements: ${missing}. Application cannot start.`;
        console.error('main.js:', errorMsg);
        if (errorDiv) errorDiv.textContent = errorMsg; else alert(errorMsg);
        if (titleElement) titleElement.textContent = 'Fatal Error!';
        if (inputElement) inputElement.disabled = true;
        return;
    }

    const container = new AppContainer();

    try {
        configureContainer(container, {outputDiv, inputElement, titleElement, document: document});
    } catch (registrationError) {
        const errorMsgForAlert = `Fatal Error during service registration: ${registrationError.message}. Check console.`;
        console.error('Fatal Error: Failed to register core services:', registrationError);
        alert(errorMsgForAlert);
        if (titleElement) titleElement.textContent = 'Fatal Registration Error!';
        if (inputElement) {
            inputElement.disabled = true;
            inputElement.placeholder = 'Registration Failed.';
        }
        try {
            // Attempt to use logger if it was registered before failing
            const tempLogger = container.resolve(tokens.ILogger);
            if (tempLogger && typeof tempLogger.error === 'function') {
                tempLogger.error('Fatal Error: Failed to register core services:', registrationError);
            }
        } catch (_) { /* ignore if logger itself failed or wasn't part of successful registration */
        }
        return;
    }

    let gameEngine = null;
    let logger = null;

    try {
        logger = container.resolve(tokens.ILogger);
    } catch (resolveError) {
        console.error('Fatal Error: Could not resolve essential ILogger service:', resolveError);
        alert('Fatal Error resolving logger. Check console.');
        if (titleElement) titleElement.textContent = 'Fatal Logger Error!';
        if (inputElement) {
            inputElement.disabled = true;
            inputElement.placeholder = 'Logger Resolution Failed.';
        }
        return;
    }

    try {
        logger.info('main.js: Creating GameEngine instance...');
        gameEngine = new GameEngine({
            container: container
        });
        logger.info('main.js: GameEngine instance created.');

        // --- Initialize Save Game UI and Load Game UI ---
        // These UI components need a reference to the gameEngine for their internal handlers.
        try {
            const saveGameUIInstance = container.resolve(tokens.SaveGameUI);
            if (saveGameUIInstance) {
                saveGameUIInstance.init(gameEngine);
                logger.info('main.js: SaveGameUI initialized with GameEngine.');
            } else {
                logger.error('main.js: SaveGameUI instance could not be resolved from container for init.');
            }
        } catch (e) {
            logger.error('main.js: Error resolving or initializing SaveGameUI.', e);
        }

        try {
            const loadGameUIInstance = container.resolve(tokens.LoadGameUI);
            if (loadGameUIInstance) {
                loadGameUIInstance.init(gameEngine);
                logger.info('main.js: LoadGameUI initialized with GameEngine.');
            } else {
                logger.error('main.js: LoadGameUI instance could not be resolved from container for init.');
            }
        } catch (e) {
            logger.error('main.js: Error resolving or initializing LoadGameUI.', e);
        }


        // --- Hook up Menu Buttons to GameEngine methods ---
        // GameEngine will use DomUiFacade internally to show these UIs.
        const openSaveGameButton = document.getElementById('open-save-game-button');
        const openLoadGameButton = document.getElementById('open-load-game-button');

        if (openSaveGameButton && gameEngine) {
            openSaveGameButton.addEventListener('click', () => {
                logger.debug('main.js: "Open Save Game UI" button clicked.');
                gameEngine.showSaveGameUI(); // GameEngine handles showing the UI
            });
            logger.info('main.js: Save Game UI button listener attached.');
        } else {
            logger.error('main.js: Could not find #open-save-game-button or gameEngine not available for listener.');
        }

        if (openLoadGameButton && gameEngine) {
            openLoadGameButton.addEventListener('click', () => {
                logger.debug('main.js: "Open Load Game UI" button clicked.');
                gameEngine.showLoadGameUI(); // GameEngine handles showing the UI
            });
            logger.info('main.js: Load Game UI button listener attached.');
        } else {
            logger.error('main.js: Could not find #open-load-game-button or gameEngine not available for listener.');
        }

        // --- Start the Game ---
        // TODO: Future: Implement a main menu screen here. Options: "New Game", "Load Game".
        // "New Game" would call gameEngine.startNewGame(ACTIVE_WORLD).
        // "Load Game" would call gameEngine.showLoadGameUI() (allowing player to pick a save, then GameEngine.loadGame is called by LoadGameUI).
        // For now, it starts a new game directly as per previous behavior.

        logger.info(`main.js: Starting new game with world: ${ACTIVE_WORLD}...`);
        await gameEngine.startNewGame(ACTIVE_WORLD);
        // Errors from startNewGame are re-thrown and will be caught by the outer try-catch.

        window.addEventListener('beforeunload', () => {
            // beforeunload is synchronous, so async operations might not complete.
            // This is a best-effort attempt to stop the engine.
            if (gameEngine && gameEngine.getEngineStatus().isLoopRunning) {
                logger.info("main.js: 'beforeunload' event triggered. Attempting to stop game engine.");
                gameEngine.stop().catch(stopError => { // Call stop, but don't await; catch potential errors
                    logger.error("main.js: Error during gameEngine.stop() in beforeunload:", stopError);
                });
            }
        });

    } catch (engineError) {
        const errorMsgForUser = (engineError instanceof Error) ? engineError.message : String(engineError);
        logger.error('Fatal Error during GameEngine instantiation or start:', engineError);
        alert(`Fatal Error during game setup: ${errorMsgForUser}. Check console.`);
        if (titleElement) titleElement.textContent = 'Fatal Engine Setup Error!';
        if (inputElement) {
            inputElement.disabled = true;
            inputElement.placeholder = 'Game Setup Failed.';
        }
    }
})();