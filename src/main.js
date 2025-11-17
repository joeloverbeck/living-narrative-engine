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
  initializeGlobalConfigStage,
  initializeGameEngineStage,
  setupMenuButtonListenersStage,
  setupGlobalEventListenersStage,
  startGameStage,
  initializeAuxiliaryServicesStage,
} from './bootstrapper/stages/index.js';

/** @type {string | undefined} */
let startWorld;

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
 * @description Resolves UI elements for fatal error handling, performing DOM lookups when bootstrap data is unavailable.
 * @returns {import('./utils/errorTypes.js').FatalErrorUIElements} References to UI elements used during fatal error display.
 */
function resolveFatalErrorUIElements() {
  if (uiElements) {
    return uiElements;
  }

  return {
    outputDiv: document.getElementById('outputDiv'),
    errorDiv: document.getElementById('error-output'),
    inputElement: document.getElementById('speech-input'),
    document,
  };
}

/**
 * @description Test-only helper to override the tracked bootstrap phase.
 * @param {string | null | undefined} phase - Phase label to assign for coverage scenarios.
 * @returns {void}
 */
export function __TEST_ONLY__setCurrentPhaseForError(phase) {
  currentPhaseForError = phase;
}

/**
 * @description Test-only helper to override the cached start world identifier.
 * @param {string | null | undefined} value - Start world value to assign; falsy values trigger the default fallback.
 * @returns {void}
 */
export function __TEST_ONLY__setStartWorld(value) {
  startWorld = value;
}

/**
 * @description Loads the game configuration and extracts the startWorld value.
 * @returns {Promise<string>} The startWorld value from game.json, or 'default' if not specified.
 */
async function loadStartWorld() {
  try {
    const response = await fetch('./data/game.json');
    if (!response.ok) {
      throw new Error(
        `Failed to load game configuration: ${response.status} ${response.statusText}`
      );
    }
    const gameConfig = await response.json();
    return gameConfig.startWorld || 'default';
  } catch (error) {
    console.error('Failed to load startWorld from game.json:', error);
    // Return a default world name if loading fails
    return 'default';
  }
}

/**
 * @description Runs bootstrap stages 1–7 and stores resulting instances.
 * @returns {Promise<void>} Resolves when bootstrap stages complete.
 */
export async function bootstrapApp() {
  currentPhaseForError = 'Initial Setup';

  try {
    // Load startWorld from game configuration
    startWorld = await loadStartWorld();

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

    // STAGE 3.5: Initialize Global Configuration
    currentPhaseForError = 'Global Configuration Initialization';
    logger.debug(`main.js: Executing ${currentPhaseForError} stage...`);
    const configResult = await initializeGlobalConfigStage(logger);
    if (!configResult.success) throw configResult.error;
    logger.debug(`main.js: ${currentPhaseForError} stage completed.`);

    // STAGE 4: Initialize Game Engine
    currentPhaseForError = 'Game Engine Initialization';
    logger.debug(`main.js: Executing ${currentPhaseForError} stage...`);
    const engineResult = await initializeGameEngineStage(container, logger, {
      createGameEngine: (opts) => new GameEngine({ ...opts, logger }),
    });
    if (!engineResult.success) throw engineResult.error;
    gameEngine = engineResult.payload;
    logger.debug(`main.js: ${currentPhaseForError} stage completed.`);

    // STAGE 5: Initialize Auxiliary Services (includes entity cache invalidation setup)
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

    logger.debug('main.js: Bootstrap stages completed successfully.');
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
      resolveFatalErrorUIElements(),
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
      resolveFatalErrorUIElements(),
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
    // Use the startWorld loaded from game configuration
    const worldToLoad = startWorld || 'default';
    logger.debug(`Starting game with world: ${worldToLoad}`);

    const startResult = await startGameStage(gameEngine, worldToLoad, logger);
    if (!startResult.success) throw startResult.error;
    if (showLoadUI && typeof gameEngine.showLoadGameUI === 'function') {
      await gameEngine.showLoadGameUI();
    }
  } catch (error) {
    displayFatalStartupError(
      uiElements || {
        // Provide default UI elements if uiElements is undefined
        outputDiv: document.getElementById('outputDiv'),
        errorDiv: document.getElementById('error-output'),
        inputElement: document.getElementById('speech-input'),
        document: document,
      },
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

if (typeof window !== 'undefined') {
  window.bootstrapApp = bootstrapApp;
  window.beginGame = beginGame;
}
