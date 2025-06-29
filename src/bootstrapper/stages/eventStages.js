// src/bootstrapper/stages/eventStages.js

import {
  shouldStopEngine,
  attachBeforeUnload,
  stageSuccess,
  stageFailure,
} from '../../utils/bootstrapperHelpers.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../engine/gameEngine.js').default} GameEngineInstance */
/** @typedef {import('../../types/stageResult.js').StageResult} StageResult */

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
    return stageSuccess();
  } catch (error) {
    logger.error(
      `Bootstrap Stage: ${stageName} encountered an unexpected error during '${eventName}' listener setup.`,
      error
    );
    return stageFailure(
      stageName,
      `Unexpected error during ${stageName} for '${eventName}': ${error.message}`,
      error
    );
  }
}
