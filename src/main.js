// main.js

import { configureContainer } from './dependencyInjection/containerConfig.js';
import { tokens } from './dependencyInjection/tokens.js';
import { displayFatalStartupError } from './utils/errorUtils.js';
import { UIBootstrapper } from './bootstrapper/UIBootstrapper.js';
import AppContainer from './dependencyInjection/appContainer.js';
import GameEngine from './engine/gameEngine.js';
// Import all necessary stages
import {
  ensureCriticalDOMElementsStage,
  setupDIContainerStage,
  resolveLoggerStage,
  initializeGameEngineStage,
  setupMenuButtonListenersStage,
  setupGlobalEventListenersStage,
  startGameStage,
} from './bootstrapper/stages/index.js';
import { initializeAuxiliaryServicesStage } from './bootstrapper/stages/auxiliary';

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
    const uiResult = await ensureCriticalDOMElementsStage(document, {
      createUIBootstrapper: () => new UIBootstrapper(),
    });
    if (!uiResult.success) throw uiResult.error;
    uiElements = uiResult.payload;

    // STAGE 2: Setup DI Container
    currentPhaseForError = 'DI Container Setup';
    const diResult = await setupDIContainerStage(
      uiElements,
      configureContainer,
      {
        createAppContainer: () => new AppContainer(),
      },
      console
    );
    if (!diResult.success) throw diResult.error;
    container = diResult.payload;

    // STAGE 3: Resolve Core Services (Logger)
    currentPhaseForError = 'Core Services Resolution';
    const coreServices = await resolveLoggerStage(container, tokens);
    if (!coreServices.success) throw coreServices.error;
    logger = coreServices.payload.logger; // Assign the resolved logger
    logger.debug(
      `main.js: ${currentPhaseForError} stage completed. Logger is now available.`
    );

    // STAGE 4: Initialize Game Engine
    currentPhaseForError = 'Game Engine Initialization';
    logger.debug(`main.js: Executing ${currentPhaseForError} stage...`);
    const engineResult = await initializeGameEngineStage(container, logger, {
      createGameEngine: (opts) => new GameEngine(opts),
    });
    if (!engineResult.success) throw engineResult.error;
    gameEngine = engineResult.payload;
    logger.debug(`main.js: ${currentPhaseForError} stage completed.`);

    // STAGE 5: Initialize Auxiliary Services
    currentPhaseForError = 'Auxiliary Services Initialization';
    logger.debug(`main.js: Executing ${currentPhaseForError} stage...`);
    const auxResult = await initializeAuxiliaryServicesStage(
      container,
      gameEngine,
      logger,
      tokens
    );
    if (!auxResult.success) throw auxResult.error;
    logger.debug(`main.js: ${currentPhaseForError} stage completed.`);

    // STAGE 6: Setup Menu Button Event Listeners
    currentPhaseForError = 'Menu Button Listeners Setup';
    logger.debug(`main.js: Executing ${currentPhaseForError} stage...`);
    const menuResult = await setupMenuButtonListenersStage(
      gameEngine,
      logger,
      document
    );
    if (!menuResult.success) throw menuResult.error;
    // The stage itself logs its completion.
    logger.debug(`main.js: ${currentPhaseForError} stage call completed.`);

    // STAGE 7: Setup Global Event Listeners (e.g., beforeunload)
    currentPhaseForError = 'Global Event Listeners Setup';
    logger.debug(`main.js: Executing ${currentPhaseForError} stage...`);
    // Pass gameEngine, logger, and the global window object
    const globalResult = await setupGlobalEventListenersStage(
      gameEngine,
      logger,
      window
    );
    if (!globalResult.success) throw globalResult.error;
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

    if (Array.isArray(bootstrapError.failures)) {
      bootstrapError.failures.forEach((f) => {
        logFn(`main.js: Failed to init ${f.service}`, f.error);
      });
    }

    displayFatalStartupError(
      uiElements || {
        // Provide default UI elements if uiElements is undefined
        outputDiv: document.getElementById('outputDiv'),
        errorDiv: document.getElementById('error-output'),
        titleElement: document.querySelector('h1'),
        inputElement: document.getElementById('speech-input'),
        document: document,
      },
      errorDetails,
      logger,
      {
        createElement: (tag) => document.createElement(tag),
        insertAfter: (ref, el) => ref.insertAdjacentElement('afterend', el),
        setTextContent: (el, text) => {
          el.textContent = text;
        },
        setStyle: (el, prop, val) => {
          el.style[prop] = val;
        },
        alert,
      }
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
    displayFatalStartupError(
      uiElements,
      {
        userMessage: errMsg,
        consoleMessage: errMsg,
        errorObject: errorObj,
        phase: currentPhaseForError,
      },
      logger,
      {
        createElement: (tag) => document.createElement(tag),
        insertAfter: (ref, el) => ref.insertAdjacentElement('afterend', el),
        setTextContent: (el, text) => {
          el.textContent = text;
        },
        setStyle: (el, prop, val) => {
          el.style[prop] = val;
        },
        alert,
      }
    );
    throw errorObj;
  }

  try {
    const startResult = await startGameStage(gameEngine, ACTIVE_WORLD, logger);
    if (!startResult.success) throw startResult.error;
    if (showLoadUI && typeof gameEngine.showLoadGameUI === 'function') {
      gameEngine.showLoadGameUI();
    }
  } catch (error) {
    displayFatalStartupError(
      uiElements,
      {
        userMessage: `Application failed to start due to a critical error: ${error.message}`,
        consoleMessage: `Critical error during application bootstrap in phase: ${currentPhaseForError}.`,
        errorObject: error,
        phase: currentPhaseForError,
      },
      logger,
      {
        createElement: (tag) => document.createElement(tag),
        insertAfter: (ref, el) => ref.insertAdjacentElement('afterend', el),
        setTextContent: (el, text) => {
          el.textContent = text;
        },
        setStyle: (el, prop, val) => {
          el.style[prop] = val;
        },
        alert,
      }
    );
    throw error;
  }
}

window.bootstrapApp = bootstrapApp;
window.beginGame = beginGame;
