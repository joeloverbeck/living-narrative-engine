// src/bootstrapper/stages.js
/* eslint-disable no-console */
// --- FILE START ---
import { UIBootstrapper } from './UIBootstrapper.js';
import AppContainer from '../dependencyInjection/appContainer.js'; // Corrected path assuming appContainer.js is in ../dependencyInjection/
import GameEngine from '../engine/gameEngine.js';

import { initializeAuxiliaryServicesStage } from './auxiliaryStages.js';
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

/**
 * Bootstrap Stage: Ensures critical DOM elements are present.
 * This function utilizes the UIBootstrapper to gather essential elements.
 * If elements are missing, UIBootstrapper's gatherEssentialElements method will throw an error.
 * This stage catches that error and re-throws it with a specific phase.
 *
 * @async
 * @param uiBootstrapperOrFactory
 * @param {Document} doc - The global document object.
 * @returns {Promise<EssentialUIElements>} A promise that resolves with an object containing references to the DOM elements if found.
 * @throws {Error} If `gatherEssentialElements` (called internally) fails because elements are missing. The error will have a `phase` property set to 'UI Element Validation'.
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
    return essentialUIElements;
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
    throw stageError;
  }
}

/**
 * Bootstrap Stage: Sets up the Dependency Injection (DI) container.
 * This function instantiates AppContainer and calls the provided configuration function.
 *
 * @async
 * @param {EssentialUIElements} uiReferences - The object containing DOM element references.
 * @param containerOrFactory
 * @param {ConfigureContainerFunction} containerConfigFunc - A reference to the configureContainer function.
 * @returns {Promise<AppContainer>} A promise that resolves with the configured AppContainer instance.
 * @throws {Error} If DI container configuration fails. The error will have a `phase` property set to 'DI Container Setup'.
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
    throw stageError;
  }

  return container;
}

/**
 * Bootstrap Stage: Resolves essential core services, particularly the logger.
 *
 * @async
 * @param {AppContainer} container - The configured AppContainer instance.
 * @param {TokensObject} diTokens - The DI tokens object.
 * @returns {Promise<{logger: ILogger}>} An object containing the resolved logger.
 * @throws {Error} If the ILogger service cannot be resolved or is invalid. The error will have a `phase` property set to 'Core Services Resolution'.
 */
export async function resolveCoreServicesStage(container, diTokens) {
  console.log('Bootstrap Stage: Resolving core services (Logger)...');
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
      `Bootstrap Stage: resolveCoreServicesStage failed. ${errorMsg}`,
      resolveError
    );
    throw stageError;
  }
  logger.debug(
    'Bootstrap Stage: Resolving core services (Logger)... DONE. Logger resolved successfully.'
  );
  return { logger };
}

/**
 * Bootstrap Stage: Initializes the GameEngine.
 * This function instantiates the GameEngine, passing it the DI container.
 *
 * @async
 * @param {AppContainer} container - The configured AppContainer instance.
 * @param GameEngineCtorOrFactory
 * @param {ILogger} logger - The resolved ILogger instance.
 * @returns {Promise<GameEngineInstance>} A promise that resolves with the GameEngine instance.
 * @throws {Error} If GameEngine instantiation fails. The error will have a `phase` property set to 'GameEngine Initialization'.
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
    throw stageError;
  }
  logger.debug(
    `Bootstrap Stage: Initializing GameEngine... DONE. GameEngine instance available.`
  );
  return gameEngine;
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
 * @returns {Promise<void>} A promise that resolves when the listeners are set up.
 */
export async function setupMenuButtonListenersStage(
  gameEngine,
  logger,
  documentRef
) {
  const stageName = 'Menu Button Listeners Setup';
  logger.debug(`Bootstrap Stage: Starting ${stageName}...`);

  try {
    const openSaveGameButton = documentRef.getElementById(
      'open-save-game-button'
    );
    if (openSaveGameButton && gameEngine) {
      openSaveGameButton.addEventListener('click', () => {
        logger.debug(`${stageName}: "Open Save Game UI" button clicked.`);
        gameEngine.showSaveGameUI();
      });
      logger.debug(
        `${stageName}: Save Game UI button listener attached to #open-save-game-button.`
      );
    } else {
      if (!openSaveGameButton)
        logger.warn(
          `${stageName}: Could not find #open-save-game-button. Save listener not attached.`
        );
      if (!gameEngine)
        logger.warn(
          `${stageName}: GameEngine not available for #open-save-game-button listener.`
        );
    }

    const openLoadGameButton = documentRef.getElementById(
      'open-load-game-button'
    );
    if (openLoadGameButton && gameEngine) {
      openLoadGameButton.addEventListener('click', () => {
        logger.debug(`${stageName}: "Open Load Game UI" button clicked.`);
        gameEngine.showLoadGameUI();
      });
      logger.debug(
        `${stageName}: Load Game UI button listener attached to #open-load-game-button.`
      );
    } else {
      if (!openLoadGameButton)
        logger.warn(
          `${stageName}: Could not find #open-load-game-button. Load listener not attached.`
        );
      if (!gameEngine)
        logger.warn(
          `${stageName}: GameEngine not available for #open-load-game-button listener.`
        );
    }
    logger.debug(`Bootstrap Stage: ${stageName} completed successfully.`);
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
    throw stageError;
  }
}

/**
 * Bootstrap Stage: Sets up global event listeners, specifically the 'beforeunload' event.
 *
 * @async
 * @param {GameEngineInstance} gameEngine - The instantiated GameEngine instance.
 * @param {ILogger} logger - The resolved ILogger instance.
 * @param {Window} windowRef - A reference to the global window object.
 * @returns {Promise<void>} A promise that resolves when the listener is set up.
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

    windowRef.addEventListener(eventName, () => {
      if (
        gameEngine &&
        gameEngine.getEngineStatus &&
        typeof gameEngine.getEngineStatus === 'function' &&
        gameEngine.getEngineStatus().isLoopRunning
      ) {
        logger.debug(
          `${stageName}: '${eventName}' event triggered. Attempting to stop game engine.`
        );
        gameEngine.stop().catch((stopError) => {
          logger.error(
            `${stageName}: Error during gameEngine.stop() in '${eventName}':`,
            stopError
          );
        });
      } else if (
        gameEngine &&
        gameEngine.getEngineStatus &&
        typeof gameEngine.getEngineStatus === 'function' &&
        !gameEngine.getEngineStatus().isLoopRunning
      ) {
        logger.debug(
          `${stageName}: '${eventName}' event triggered, but game engine loop is not running. No action taken to stop.`
        );
      } else if (!gameEngine) {
        logger.warn(
          `${stageName}: '${eventName}' event triggered, but gameEngine instance is not available. Cannot attempt graceful shutdown.`
        );
      }
    });

    logger.debug(
      `${stageName}: '${eventName}' event listener attached successfully.`
    );
    logger.debug(`Bootstrap Stage: ${stageName} completed.`);
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
    throw stageError;
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
 * @returns {Promise<void>} A promise that resolves if the game starts successfully.
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
    throw criticalError;
  }
  if (typeof activeWorldName !== 'string' || activeWorldName.trim() === '') {
    logger.error(
      `Bootstrap Stage: ${stageName} failed. activeWorldName is invalid or empty.`
    );
    const criticalError = new Error(
      'activeWorldName is invalid or empty, cannot start game.'
    );
    criticalError.phase = stageName;
    throw criticalError;
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
    throw stageError;
  }
  logger.debug(`Bootstrap Stage: ${stageName} completed.`);
}

// --- FILE END ---
