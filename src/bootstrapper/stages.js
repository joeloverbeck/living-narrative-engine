// src/bootstrapper/stages.js
/* eslint-disable no-console */
// --- FILE START ---
import { UIBootstrapper } from './UIBootstrapper.js';
import AppContainer from '../dependencyInjection/appContainer.js';
import GameEngine from '../engine/gameEngine.js';

import { initializeAuxiliaryServicesStage } from './auxiliaryStages.js';
import {
  setupButtonListener,
  shouldStopEngine,
  attachBeforeUnload,
} from './helpers.js';
export { initializeAuxiliaryServicesStage };
// eslint-disable-next-line no-unused-vars
import { tokens } from '../dependencyInjection/tokens.js'; // Corrected path assuming tokens.js is in ../dependencyInjection/

/**
 * @typedef {import('./UIBootstrapper.js').EssentialUIElements} EssentialUIElements
 */

/**
 * @typedef {import('../dependencyInjection/containerConfig.js').ConfigureContainerFunction} ConfigureContainerFunction
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {typeof tokens} TokensObject */

/** @typedef {import('../engine/gameEngine.js').default} GameEngineInstance */
/** @typedef {import('../types/stageResult.js').StageResult} StageResult */

/**
 * Bootstrap Stage: Ensures critical DOM elements are present.
 * This function utilizes the UIBootstrapper to gather essential elements.
 * If elements are missing, UIBootstrapper's gatherEssentialElements method will throw an error.
 * This stage catches that error and re-throws it with a specific phase.
 *
 * @async
 * @param {Document} doc - The global document object.
 * @param {(UIBootstrapper|function(): UIBootstrapper)} [uiBootstrapperOrFactory]
 *  - Instance or factory for a UIBootstrapper.
 * @returns {Promise<StageResult>} Result object with gathered DOM elements on success.
 */
export async function ensureCriticalDOMElementsStage(
  doc,
  uiBootstrapperOrFactory = () => new UIBootstrapper()
) {
  const uiBootstrapper =
    typeof uiBootstrapperOrFactory === 'function'
      ? uiBootstrapperOrFactory()
      : uiBootstrapperOrFactory;
  try {
    const essentialUIElements = uiBootstrapper.gatherEssentialElements(doc);
    return { success: true, payload: essentialUIElements };
  } catch (error) {
    const stageError = new Error(
      `UI Element Validation Failed: ${error.message}`,
      { cause: error }
    );
    stageError.phase = 'UI Element Validation';
    console.error(
      `Bootstrap Stage: ensureCriticalDOMElementsStage failed. ${stageError.message}`,
      error
    );
    return { success: false, error: stageError };
  }
}

/**
 * Bootstrap Stage: Sets up the Dependency Injection (DI) container.
 * This function instantiates AppContainer and calls the provided configuration function.
 *
 * @async
 * @param {EssentialUIElements} uiReferences - The object containing DOM element references.
 * @param {ConfigureContainerFunction} containerConfigFunc - A reference to the configureContainer function.
 * @param {(AppContainer|function(): AppContainer)} [containerOrFactory]
 *  - Instance or factory for an AppContainer.
 * @returns {Promise<StageResult>} Result object with the configured AppContainer on success.
 */
export async function setupDIContainerStage(
  uiReferences,
  containerConfigFunc,
  containerOrFactory = () => new AppContainer()
) {
  const container =
    typeof containerOrFactory === 'function'
      ? containerOrFactory()
      : containerOrFactory;

  try {
    containerConfigFunc(container, uiReferences);
  } catch (registrationError) {
    const errorMsg = `Fatal Error during service registration: ${registrationError.message}.`;
    const stageError = new Error(errorMsg, { cause: registrationError });
    stageError.phase = 'DI Container Setup';
    console.error(
      `Bootstrap Stage: setupDIContainerStage failed. ${errorMsg}`,
      registrationError
    );
    return { success: false, error: stageError };
  }
  return { success: true, payload: container };
}

/**
 * Bootstrap Stage: Resolves core services.
 * Currently only the logger is required, but additional core services will be added soon.
 *
 * Upcoming core services:
 * - Event bus
 * - Configuration access
 *
 * @async
 * @param {AppContainer} container - The configured AppContainer instance.
 * @param {TokensObject} diTokens - The DI tokens object.
 * @returns {Promise<StageResult>} Result object with the resolved logger on success.
 */
export async function resolveLoggerStage(container, diTokens) {
  console.log('Bootstrap Stage: Resolving logger service...');
  /** @type {ILogger} */
  let logger;

  try {
    logger = container.resolve(diTokens.ILogger);
    if (!logger) {
      throw new Error('ILogger resolved to an invalid object.');
    }
  } catch (resolveError) {
    const errorMsg = `Fatal Error: Could not resolve essential ILogger service: ${resolveError.message}.`;
    const stageError = new Error(errorMsg, { cause: resolveError });
    stageError.phase = 'Core Services Resolution';
    console.error(
      `Bootstrap Stage: resolveLoggerStage failed. ${errorMsg}`,
      resolveError
    );
    return { success: false, error: stageError };
  }
  logger.debug(
    'Bootstrap Stage: Resolving logger service... DONE. Logger resolved successfully.'
  );
  return { success: true, payload: { logger } };
}

/**
 * Bootstrap Stage: Initializes the GameEngine.
 * This function instantiates the GameEngine, passing it the DI container.
 *
 * @async
 * @param {AppContainer} container - The configured AppContainer instance.
 * @param {ILogger} logger - The resolved ILogger instance.
 * @param {(function(new:GameEngine,object):GameEngine)|function(object):GameEngine|typeof GameEngine} [GameEngineCtorOrFactory]
 *  - GameEngine class or factory to instantiate.
 * @returns {Promise<StageResult>} Result object with the GameEngine instance on success.
 */
export async function initializeGameEngineStage(
  container,
  logger,
  GameEngineCtorOrFactory = GameEngine
) {
  logger.debug('Bootstrap Stage: Initializing GameEngine...');
  const currentPhase = 'GameEngine Initialization';
  /** @type {GameEngineInstance} */
  let gameEngine;
  try {
    logger.debug('GameEngine Stage: Creating GameEngine instance...');
    if (
      GameEngineCtorOrFactory &&
      GameEngineCtorOrFactory.prototype &&
      GameEngineCtorOrFactory.prototype.constructor
    ) {
      gameEngine = new GameEngineCtorOrFactory({ container });
    } else {
      gameEngine = GameEngineCtorOrFactory({ container });
    }
    if (!gameEngine) {
      throw new Error('GameEngine constructor returned null or undefined.');
    }
    logger.debug('GameEngine Stage: GameEngine instance created successfully.');
  } catch (engineCreationError) {
    logger.error(
      'GameEngine Stage: Fatal error during GameEngine instantiation.',
      engineCreationError
    );
    const errorMsg = `Fatal Error during GameEngine instantiation: ${engineCreationError.message}.`;
    const stageError = new Error(errorMsg, { cause: engineCreationError });
    stageError.phase = currentPhase;
    return { success: false, error: stageError };
  }
  logger.debug(
    `Bootstrap Stage: Initializing GameEngine... DONE. GameEngine instance available.`
  );
  return { success: true, payload: gameEngine };
}
/**
 * Bootstrap Stage: Initializes auxiliary services (imported from auxiliaryStages.js).
 */

/**
 * Bootstrap Stage: Sets up event listeners for main menu buttons like "Open Save Game UI" and "Open Load Game UI".
 *
 * @async
 * @param {GameEngineInstance} gameEngine - The instantiated GameEngine instance.
 * @param {ILogger} logger - The resolved ILogger instance.
 * @param {Document} documentRef - A reference to the global document object.
 * @returns {Promise<StageResult>} Result object indicating success of listener setup.
 */
export async function setupMenuButtonListenersStage(
  gameEngine,
  logger,
  documentRef
) {
  const stageName = 'Menu Button Listeners Setup';
  logger.debug(`Bootstrap Stage: Starting ${stageName}...`);

  try {
    if (gameEngine) {
      setupButtonListener(
        documentRef,
        'open-save-game-button',
        () => {
          logger.debug(`${stageName}: "Open Save Game UI" button clicked.`);
          gameEngine.showSaveGameUI();
        },
        logger,
        stageName
      );

      setupButtonListener(
        documentRef,
        'open-load-game-button',
        () => {
          logger.debug(`${stageName}: "Open Load Game UI" button clicked.`);
          gameEngine.showLoadGameUI();
        },
        logger,
        stageName
      );
    } else {
      setupButtonListener(
        documentRef,
        'open-save-game-button',
        () => {},
        logger,
        stageName
      );
      logger.warn(
        `${stageName}: GameEngine not available for #open-save-game-button listener.`
      );
      setupButtonListener(
        documentRef,
        'open-load-game-button',
        () => {},
        logger,
        stageName
      );
      logger.warn(
        `${stageName}: GameEngine not available for #open-load-game-button listener.`
      );
    }
    logger.debug(`Bootstrap Stage: ${stageName} completed successfully.`);
    return { success: true };
  } catch (error) {
    logger.error(
      `Bootstrap Stage: ${stageName} encountered an unexpected error during listener setup.`,
      error
    );
    const stageError = new Error(
      `Unexpected error during ${stageName}: ${error.message}`,
      { cause: error }
    );
    stageError.phase = stageName;
    return { success: false, error: stageError };
  }
}

/**
 * Bootstrap Stage: Sets up global event listeners, specifically the 'beforeunload' event.
 *
 * @async
 * @param {GameEngineInstance} gameEngine - The instantiated GameEngine instance.
 * @param {ILogger} logger - The resolved ILogger instance.
 * @param {Window} windowRef - A reference to the global window object.
 * @returns {Promise<StageResult>} Result object indicating success of listener setup.
 */
export async function setupGlobalEventListenersStage(
  gameEngine,
  logger,
  windowRef
) {
  const stageName = 'Global Event Listeners Setup';
  const eventName = 'beforeunload';
  logger.debug(
    `Bootstrap Stage: Setting up global event listeners (${eventName})...`
  );

  try {
    if (!windowRef) {
      logger.error(
        `${stageName}: windowRef is not available. Cannot attach '${eventName}' listener.`
      );
      throw new Error(
        'windowRef was not provided to setupGlobalEventListenersStage.'
      );
    }

    attachBeforeUnload(windowRef, () => {
      if (!gameEngine) {
        logger.warn(
          `${stageName}: '${eventName}' event triggered, but gameEngine instance is not available. Cannot attempt graceful shutdown.`
        );
        return;
      }

      if (!shouldStopEngine(gameEngine)) {
        logger.debug(
          `${stageName}: '${eventName}' event triggered, but game engine loop is not running. No action taken to stop.`
        );
        return;
      }

      logger.debug(
        `${stageName}: '${eventName}' event triggered. Attempting to stop game engine.`
      );
      gameEngine.stop().catch((stopError) => {
        logger.error(
          `${stageName}: Error during gameEngine.stop() in '${eventName}':`,
          stopError
        );
      });
    });

    logger.debug(
      `${stageName}: '${eventName}' event listener attached successfully.`
    );
    logger.debug(`Bootstrap Stage: ${stageName} completed.`);
    return { success: true };
  } catch (error) {
    logger.error(
      `Bootstrap Stage: ${stageName} encountered an unexpected error during '${eventName}' listener setup.`,
      error
    );
    const stageError = new Error(
      `Unexpected error during ${stageName} for '${eventName}': ${error.message}`,
      { cause: error }
    );
    stageError.phase = stageName;
    return { success: false, error: stageError };
  }
}

/**
 * Bootstrap Stage: Starts the new game via gameEngine.startNewGame().
 * This is typically the final active stage in the bootstrap process.
 *
 * @async
 * @param {GameEngineInstance} gameEngine - The instantiated GameEngine instance.
 * @param {string} activeWorldName - The name of the world to start (e.g., from AppConfig.ACTIVE_WORLD).
 * @param {ILogger} logger - The resolved ILogger instance.
 * @returns {Promise<StageResult>} Result object indicating if the game was started.
 */
export async function startGameStage(gameEngine, activeWorldName, logger) {
  const stageName = 'Start Game';
  logger.debug(
    `Bootstrap Stage: ${stageName}: Starting new game with world: ${activeWorldName}...`
  );

  if (!gameEngine) {
    logger.error(
      `Bootstrap Stage: ${stageName} failed. GameEngine instance is not available.`
    );
    const criticalError = new Error(
      'GameEngine not initialized before attempting to start game.'
    );
    criticalError.phase = stageName;
    return { success: false, error: criticalError };
  }
  if (typeof activeWorldName !== 'string' || activeWorldName.trim() === '') {
    logger.error(
      `Bootstrap Stage: ${stageName} failed. activeWorldName is invalid or empty.`
    );
    const criticalError = new Error(
      'activeWorldName is invalid or empty, cannot start game.'
    );
    criticalError.phase = stageName;
    return { success: false, error: criticalError };
  }

  try {
    await gameEngine.startNewGame(activeWorldName);
    logger.debug(
      `Bootstrap Stage: ${stageName}: Game started successfully with world: ${activeWorldName}.`
    );
  } catch (startGameError) {
    logger.error(
      `Bootstrap Stage: ${stageName}: Error during gameEngine.startNewGame for world "${activeWorldName}".`,
      startGameError
    );
    const stageError = new Error(
      `Failed to start new game with world "${activeWorldName}": ${startGameError.message}`,
      { cause: startGameError }
    );
    stageError.phase = stageName;
    return { success: false, error: stageError };
  }
  logger.debug(`Bootstrap Stage: ${stageName} completed.`);
  return { success: true };
}

// --- FILE END ---
