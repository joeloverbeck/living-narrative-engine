// main.js

import { configureContainer } from './src/dependencyInjection/containerConfig.js';
import { tokens } from './src/dependencyInjection/tokens.js';
import { AppConfig } from './src/dependencyInjection/appConfig.js';
import { displayFatalStartupError } from './src/bootstrapper/errorUtils.js';
// Import all necessary stages
import {
  ensureCriticalDOMElementsStage,
  setupDIContainerStage,
  resolveCoreServicesStage,
  initializeGameEngineStage,
  initializeAuxiliaryServicesStage,
  setupMenuButtonListenersStage,
  setupGlobalEventListenersStage,
  startGameStage,
} from './src/bootstrapper/stages.js';

// --- Bootstrap the Application ---
(async () => {
  /** @type {import('./src/bootstrapper/UIBootstrapper.js').EssentialUIElements | undefined} */
  let uiElements;
  /** @type {import('./src/dependencyInjection/appContainer.js').default | undefined} */
  let container;
  /** @type {import('./src/interfaces/coreServices.js').ILogger | null} */
  let logger = null;
  /** @type {import('./src/engine/gameEngine.js').default | null} */ // Corrected type to import GameEngine directly
  let gameEngine = null; // Will be populated by initializeGameEngineStage

  let currentPhaseForError = 'Initial Setup'; // Generic phase before stages

  try {
    // STAGE 1: Ensure Critical DOM Elements
    currentPhaseForError = 'UI Element Validation';
    uiElements = await ensureCriticalDOMElementsStage(document);

    // STAGE 2: Setup DI Container
    currentPhaseForError = 'DI Container Setup';
    container = await setupDIContainerStage(uiElements, configureContainer);

    // STAGE 3: Resolve Core Services (Logger)
    currentPhaseForError = 'Core Services Resolution';
    const coreServices = await resolveCoreServicesStage(container, tokens);
    logger = coreServices.logger; // Assign the resolved logger
    logger.debug(
      `main.js: ${currentPhaseForError} stage completed. Logger is now available.`
    );

    // STAGE 4: Initialize Game Engine
    currentPhaseForError = 'Game Engine Initialization';
    logger.debug(`main.js: Executing ${currentPhaseForError} stage...`);
    gameEngine = await initializeGameEngineStage(container, logger);
    logger.debug(`main.js: ${currentPhaseForError} stage completed.`);

    // STAGE 5: Initialize Auxiliary Services
    currentPhaseForError = 'Auxiliary Services Initialization';
    logger.debug(`main.js: Executing ${currentPhaseForError} stage...`);
    await initializeAuxiliaryServicesStage(
      container,
      gameEngine,
      logger,
      tokens
    );
    logger.debug(`main.js: ${currentPhaseForError} stage completed.`);

    // STAGE 6: Setup Menu Button Event Listeners
    currentPhaseForError = 'Menu Button Listeners Setup';
    logger.debug(`main.js: Executing ${currentPhaseForError} stage...`);
    await setupMenuButtonListenersStage(gameEngine, logger, document);
    // The stage itself logs its completion.
    logger.debug(`main.js: ${currentPhaseForError} stage call completed.`);

    // STAGE 7: Setup Global Event Listeners (e.g., beforeunload)
    currentPhaseForError = 'Global Event Listeners Setup';
    logger.debug(`main.js: Executing ${currentPhaseForError} stage...`);
    // Pass gameEngine, logger, and the global window object
    await setupGlobalEventListenersStage(gameEngine, logger, window);
    // The stage itself logs its completion.
    logger.debug(`main.js: ${currentPhaseForError} stage call completed.`);

    // STAGE 8: Start Game
    currentPhaseForError = 'Start Game'; // Updated phase name
    logger.debug(`main.js: Executing ${currentPhaseForError} stage...`);
    if (!gameEngine) {
      // This check should be redundant if initializeGameEngineStage is robust
      const errMsg =
        'Critical: GameEngine not initialized before attempting Start Game stage.';
      logger.error(`main.js: ${errMsg}`);
      throw new Error(errMsg);
    }
    await startGameStage(gameEngine, AppConfig.ACTIVE_WORLD, logger);
    // The startGameStage function logs its own completion or errors.
    logger.debug(`main.js: ${currentPhaseForError} stage call completed.`);

    logger.debug('main.js: Application bootstrap completed successfully.');
  } catch (bootstrapError) {
    // Centralized error handling for all bootstrap stages
    const detectedPhase =
      bootstrapError.phase ||
      currentPhaseForError ||
      (uiElements && container && logger
        ? 'Application Logic/Runtime'
        : uiElements && container
          ? 'Core Services Resolution'
          : uiElements
            ? 'DI Container Setup'
            : 'UI Element Validation');

    const errorDetails = {
      userMessage: `Application failed to start due to a critical error: ${bootstrapError.message}`,
      consoleMessage: `Critical error during application bootstrap in phase: ${detectedPhase}.`,
      errorObject: bootstrapError,
      phase:
        bootstrapError.phase || `Bootstrap Orchestration - ${detectedPhase}`, // Prefer specific phase from error
    };

    const logFn = logger ? logger.error.bind(logger) : console.error;
    logFn(
      `main.js: Bootstrap error caught in main orchestrator. Error Phase: "${errorDetails.phase}"`,
      bootstrapError
    );

    displayFatalStartupError(
      uiElements || {
        // Provide default UI elements if uiElements is undefined
        outputDiv: document.getElementById('outputDiv'),
        errorDiv: document.getElementById('error-output'),
        titleElement: document.querySelector('h1'),
        inputElement: document.getElementById('speech-input'),
        document: document, // Ensure document is passed
      },
      errorDetails
    );
  }
})();
