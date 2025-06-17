// src/bootstrapper/stages/engineStages.js

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../types/stageResult.js').StageResult} StageResult */
/** @typedef {import('../../engine/gameEngine.js').default} GameEngineInstance */
/** @typedef {import('../../engine/gameEngine.js').default} GameEngine */
/** @typedef {import('../../dependencyInjection/appContainer.js').default} AppContainer */
import { stageSuccess, stageFailure } from '../helpers.js';

/**
 * Bootstrap Stage: Initializes the GameEngine.
 * This function instantiates the GameEngine, passing it the DI container.
 *
 * @async
 * @param {AppContainer} container - The configured AppContainer instance.
 * @param {ILogger} logger - The resolved ILogger instance.
 * @param {{ createGameEngine: function(object): GameEngine }} options
 *  - Factory provider for a GameEngine instance.
 * @returns {Promise<StageResult>} Result object with the GameEngine instance on success.
 */
export async function initializeGameEngineStage(
  container,
  logger,
  { createGameEngine }
) {
  logger.debug('Bootstrap Stage: Initializing GameEngine...');
  const currentPhase = 'GameEngine Initialization';
  /** @type {GameEngineInstance} */
  let gameEngine;
  try {
    logger.debug('GameEngine Stage: Creating GameEngine instance...');
    gameEngine = createGameEngine({ container });
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
    return stageFailure(currentPhase, errorMsg, engineCreationError);
  }
  logger.debug(
    `Bootstrap Stage: Initializing GameEngine... DONE. GameEngine instance available.`
  );
  return stageSuccess(gameEngine);
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
    return stageFailure(
      stageName,
      'GameEngine not initialized before attempting to start game.'
    );
  }
  if (typeof activeWorldName !== 'string' || activeWorldName.trim() === '') {
    logger.error(
      `Bootstrap Stage: ${stageName} failed. activeWorldName is invalid or empty.`
    );
    return stageFailure(
      stageName,
      'activeWorldName is invalid or empty, cannot start game.'
    );
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
    return stageFailure(
      stageName,
      `Failed to start new game with world "${activeWorldName}": ${startGameError.message}`,
      startGameError
    );
  }
  logger.debug(`Bootstrap Stage: ${stageName} completed.`);
  return stageSuccess();
}
