// main.js

import { configureContainer } from './dependencyInjection/containerConfig.js';
import { tokens } from './dependencyInjection/tokens.js';
import { displayFatalStartupError } from './bootstrapper/errorUtils.js';
// Import all necessary stages
import {
  ensureCriticalDOMElementsStage,
  setupDIContainerStage,
  resolveCoreServicesStage,
  initializeGameEngineStage,
  setupMenuButtonListenersStage,
  setupGlobalEventListenersStage,
  startGameStage,
} from './bootstrapper/stages.js';
import { initializeAuxiliaryServicesStage } from './bootstrapper/auxiliaryStages.js';

const ACTIVE_WORLD = 'demo';

/** @type {import('./bootstrapper/UIBootstrapper.js').EssentialUIElements | undefined} */
let uiElements;
/** @type {import('./dependencyInjection/appContainer.js').default | undefined} */
let container;
/** @type {import('./interfaces/coreServices.js').ILogger | null} */
let logger = null;
/** @type {import('./engine/gameEngine.js').default | null} */
let gameEngine = null; // Will be populated by initializeGameEngineStage

let currentPhaseForError = 'Initial Setup';

/**
 * @description Runs bootstrap stages 1–7 and stores resulting instances.
 * @returns {Promise<void>} Resolves when bootstrap stages complete.
 */
export async function bootstrapApp() {
  currentPhaseForError = 'Initial Setup';

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

    logger.debug('main.js: Bootstrap stages 1-7 completed successfully.');
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
        document: document,
      },
      errorDetails
    );
  }
}

/**
 * @description Starts the game if bootstrap completed.
 * @param {boolean} [showLoadUI] - When true, opens the Load Game UI after starting.
 * @returns {Promise<void>} Resolves when the game has started.
 */
export async function beginGame(showLoadUI = false) {
  currentPhaseForError = 'Start Game';

  if (!gameEngine) {
    const errMsg =
      'Critical: GameEngine not initialized before attempting Start Game stage.';
    const errorObj = new Error(errMsg);
    (logger || console).error(`main.js: ${errMsg}`);
    displayFatalStartupError(uiElements, {
      userMessage: errMsg,
      consoleMessage: errMsg,
      errorObject: errorObj,
      phase: currentPhaseForError,
    });
    throw errorObj;
  }

  try {
    await startGameStage(gameEngine, ACTIVE_WORLD, logger);
    if (showLoadUI && typeof gameEngine.showLoadGameUI === 'function') {
      gameEngine.showLoadGameUI();
    }
  } catch (error) {
    displayFatalStartupError(uiElements, {
      userMessage: `Application failed to start due to a critical error: ${error.message}`,
      consoleMessage: `Critical error during application bootstrap in phase: ${currentPhaseForError}.`,
      errorObject: error,
      phase: currentPhaseForError,
    });
    throw error;
  }
}

window.bootstrapApp = bootstrapApp;
window.beginGame = beginGame;
