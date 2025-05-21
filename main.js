// src/main.js

import GameEngine from './src/engine/gameEngine.js'; // Remains for now, future tickets will move to a stage
import {configureContainer} from './src/config/containerConfig.js';
import {tokens} from './src/config/tokens.js';
import {AppConfig} from './src/config/appConfig.js';
import {displayFatalStartupError} from './src/bootstrapper/errorUtils.js';
// Import all necessary stages
import {
    ensureCriticalDOMElementsStage,
    setupDIContainerStage,
    resolveCoreServicesStage,
    // Future stage imports will go here:
    // initializeGameEngineStage,
    // initializeAuxiliaryServicesStage,
    // setupApplicationEventListenersStage,
    // startGameStage
} from './src/bootstrapper/stages.js';

// --- Bootstrap the Application ---
(async () => {
    // Initial log, logger not available yet.
    console.log('main.js: Bootstrapping application...');

    /** @type {import('./src/bootstrapper/UIBootstrapper.js').EssentialUIElements | undefined} */
    let uiElements;
    /** @type {import('./src/config/appContainer.js').default | undefined} */
    let container;
    /** @type {import('./src/interfaces/coreServices.js').ILogger | null} */
    let logger = null;
    /** @type {GameEngine | null} */
    let gameEngine = null; // Will be populated by initializeGameEngineStage or current logic

    let currentPhaseForError = 'Initial Setup'; // Generic phase before stages

    try {
        // STAGE 1: Ensure Critical DOM Elements
        currentPhaseForError = 'UI Element Validation';
        // console.log is used here as logger is not yet available.
        console.log(`main.js: Executing ${currentPhaseForError} stage...`);
        uiElements = await ensureCriticalDOMElementsStage(document);
        console.log(`main.js: ${currentPhaseForError} stage completed.`);

        // STAGE 2: Setup DI Container
        currentPhaseForError = 'DI Container Setup';
        console.log(`main.js: Executing ${currentPhaseForError} stage...`);
        container = await setupDIContainerStage(uiElements, configureContainer);
        console.log(`main.js: ${currentPhaseForError} stage completed.`);

        // STAGE 3: Resolve Core Services (Logger)
        currentPhaseForError = 'Core Services Resolution';
        console.log(`main.js: Executing ${currentPhaseForError} stage...`);
        const coreServices = await resolveCoreServicesStage(container, tokens);
        logger = coreServices.logger; // Assign the resolved logger
        logger.info(`main.js: ${currentPhaseForError} stage completed. Logger is now available.`);

        // STAGE 4: Initialize Game Engine (Placeholder for initializeGameEngineStage)
        currentPhaseForError = 'Game Engine Initialization (Interim)';
        logger.info(`main.js: Executing ${currentPhaseForError}...`);
        // This entire block will be refactored into initializeGameEngineStage later.
        // Errors here will be caught by the main catch block.
        gameEngine = new GameEngine({
            container: container // GameEngine will resolve its own logger from the container
        });
        logger.info(`main.js: ${currentPhaseForError} completed.`);

        // STAGE 5: Initialize Auxiliary Services (Placeholder for initializeAuxiliaryServicesStage)
        currentPhaseForError = 'Auxiliary Services Initialization (Interim)';
        logger.info(`main.js: Executing ${currentPhaseForError}...`);
        // This block will be refactored into initializeAuxiliaryServicesStage later.
        try {
            logger.info('main.js: Initializing EngineUIManager...');
            const engineUIManager = container.resolve(tokens.EngineUIManager);
            if (!engineUIManager) {
                // This specific error should ideally be handled within initializeAuxiliaryServicesStage in the future
                // and provide its own phase. For now, it will use currentPhaseForError.
                throw new Error('EngineUIManager instance could not be resolved from container (resolved as null/undefined).');
            }
            engineUIManager.initialize();
            logger.info('main.js: EngineUIManager initialized successfully.');
        } catch (eumError) {
            // Re-throw to be caught by the main orchestrator's catch block.
            // The main catch block will use currentPhaseForError if eumError.phase is not set.
            throw new Error(`CRITICAL error during EngineUIManager resolution or initialization: ${eumError.message}`, {cause: eumError});
        }

        try {
            const saveGameUIInstance = container.resolve(tokens.SaveGameUI);
            if (saveGameUIInstance) {
                saveGameUIInstance.init(gameEngine);
                logger.info('main.js: SaveGameUI initialized with GameEngine.');
            } else {
                // Deemed fatal if the instance cannot be resolved for essential UI.
                throw new Error('SaveGameUI instance could not be resolved from container for init.');
            }
        } catch (sgUiError) {
            logger.error(`main.js: Error resolving or initializing SaveGameUI. This is considered a fatal bootstrap error.`, sgUiError);
            // Re-throw to be caught by the main orchestrator's catch block.
            throw new Error(`Failed to initialize SaveGameUI: ${sgUiError.message}`, {cause: sgUiError});
        }

        try {
            const loadGameUIInstance = container.resolve(tokens.LoadGameUI);
            if (loadGameUIInstance) {
                loadGameUIInstance.init(gameEngine);
                logger.info('main.js: LoadGameUI initialized with GameEngine.');
            } else {
                // Deemed fatal if the instance cannot be resolved for essential UI.
                throw new Error('LoadGameUI instance could not be resolved from container for init.');
            }
        } catch (lgUiError) {
            logger.error(`main.js: Error resolving or initializing LoadGameUI. This is considered a fatal bootstrap error.`, lgUiError);
            // Re-throw to be caught by the main orchestrator's catch block.
            throw new Error(`Failed to initialize LoadGameUI: ${lgUiError.message}`, {cause: lgUiError});
        }
        logger.info(`main.js: ${currentPhaseForError} completed.`);

        // STAGE 6: Setup Application Event Listeners (Placeholder for setupApplicationEventListenersStage)
        currentPhaseForError = 'Event Listener Setup (Interim)';
        logger.info(`main.js: Executing ${currentPhaseForError}...`);
        // This block will be refactored into setupApplicationEventListenersStage later.
        // Errors here are less likely to be throwers unless document structure is unexpectedly missing
        // and not caught by ensureCriticalDOMElementsStage.
        const openSaveGameButton = document.getElementById('open-save-game-button');
        const openLoadGameButton = document.getElementById('open-load-game-button');

        if (openSaveGameButton && gameEngine) {
            openSaveGameButton.addEventListener('click', () => {
                logger.debug('main.js: "Open Save Game UI" button clicked.');
                gameEngine.showSaveGameUI();
            });
            logger.info('main.js: Save Game UI button listener attached.');
        } else {
            if (!openSaveGameButton) logger.warn('main.js: Could not find #open-save-game-button.');
            if (!gameEngine) logger.warn('main.js: GameEngine not available for save game button listener.');
        }

        if (openLoadGameButton && gameEngine) {
            openLoadGameButton.addEventListener('click', () => {
                logger.debug('main.js: "Open Load Game UI" button clicked.');
                gameEngine.showLoadGameUI();
            });
            logger.info('main.js: Load Game UI button listener attached.');
        } else {
            if (!openLoadGameButton) logger.warn('main.js: Could not find #open-load-game-button.');
            if (!gameEngine) logger.warn('main.js: GameEngine not available for load game button listener.');
        }

        window.addEventListener('beforeunload', () => {
            if (gameEngine && gameEngine.getEngineStatus().isLoopRunning) {
                logger.info("main.js: 'beforeunload' event triggered. Attempting to stop game engine.");
                gameEngine.stop().catch(stopError => {
                    // Logger should still be available here
                    logger.error("main.js: Error during gameEngine.stop() in beforeunload:", stopError);
                });
            }
        });
        logger.info(`main.js: ${currentPhaseForError} completed.`);

        // STAGE 7: Start Game (Placeholder for startGameStage)
        currentPhaseForError = 'Game Start (Interim)';
        logger.info(`main.js: Executing ${currentPhaseForError} with world: ${AppConfig.ACTIVE_WORLD}...`);
        if (!gameEngine) {
            // This check is technically redundant if GameEngine initialization is fatal,
            // but kept for clarity during this interim phase.
            throw new Error("GameEngine not initialized before attempting to start game.");
        }
        await gameEngine.startNewGame(AppConfig.ACTIVE_WORLD);
        logger.info(`main.js: ${currentPhaseForError} completed.`);

        logger.info('main.js: Application bootstrap completed successfully.');

    } catch (bootstrapError) {
        // Centralized error handling for all bootstrap stages
        // Prioritize phase from the error object itself (set by stages)
        // Fallback to currentPhaseForError if error.phase is not set (e.g. for errors within interim blocks)
        // Further fallback if even currentPhaseForError was not updated before an early error.
        const detectedPhase = bootstrapError.phase || currentPhaseForError ||
            (uiElements && container && logger ? 'Application Logic/Runtime' :
                (uiElements && container ? 'Core Services Resolution' :
                    (uiElements ? 'DI Container Setup' :
                        'UI Element Validation')));

        const errorDetails = {
            userMessage: `Application failed to start due to a critical error: ${bootstrapError.message}`,
            consoleMessage: `Critical error during application bootstrap in phase: ${detectedPhase}.`,
            errorObject: bootstrapError,
            phase: `Bootstrap Orchestration - ${detectedPhase}`
            // pageTitle and inputPlaceholder will use defaults in displayFatalStartupError
        };

        // Log to console if logger isn't available, otherwise use logger
        const logFn = logger ? logger.error.bind(logger) : console.error;
        logFn(`main.js: Bootstrap error caught in main orchestrator. Error Phase: "${errorDetails.phase}"`, bootstrapError);

        // uiElements might be undefined if ensureCriticalDOMElementsStage failed.
        // displayFatalStartupError needs to be robust enough to handle this.
        displayFatalStartupError(
            uiElements || { // Provide a minimal structure if uiElements is undefined
                outputDiv: document.getElementById('outputDiv'), // Attempt to re-query
                errorDiv: document.getElementById('error-output'), // Attempt to re-query
                titleElement: document.querySelector('h1'), // Attempt to re-query
                inputElement: document.getElementById('speech-input'), // Attempt to re-query
                document: document
            },
            errorDetails
        );
    }
})();