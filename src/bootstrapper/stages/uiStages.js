// src/bootstrapper/stages/uiStages.js
/* eslint-disable no-console */

import { setupButtonListener, stageSuccess, stageFailure } from '../helpers.js';

// eslint-disable-next-line no-unused-vars
import { tokens } from '../../dependencyInjection/tokens.js';

/**
 * @typedef {import('../UIBootstrapper.js').EssentialUIElements} EssentialUIElements
 */
/** @typedef {import('../UIBootstrapper.js').UIBootstrapper} UIBootstrapper */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../engine/gameEngine.js').default} GameEngineInstance */
/** @typedef {import('../../types/stageResult.js').StageResult} StageResult */

/**
 * Bootstrap Stage: Ensures critical DOM elements are present.
 * This function utilizes the UIBootstrapper to gather essential elements.
 * If elements are missing, UIBootstrapper's gatherEssentialElements method will throw an error.
 * This stage catches that error and re-throws it with a specific phase.
 *
 * @async
 * @param {Document} doc - The global document object.
 * @param {{ createUIBootstrapper: function(): UIBootstrapper }} options
 *  - Factory provider for a UIBootstrapper instance.
 * @returns {Promise<StageResult>} Result object with gathered DOM elements on success.
 */
export async function ensureCriticalDOMElementsStage(
  doc,
  { createUIBootstrapper }
) {
  const uiBootstrapper = createUIBootstrapper();
  try {
    const essentialUIElements = uiBootstrapper.gatherEssentialElements(doc);
    return stageSuccess(essentialUIElements);
  } catch (error) {
    const message = `UI Element Validation Failed: ${error.message}`;
    console.error(
      `Bootstrap Stage: ensureCriticalDOMElementsStage failed. ${message}`,
      error
    );
    return stageFailure('UI Element Validation', message, error);
  }
}

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
    if (!gameEngine) {
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
      logger.debug(`Bootstrap Stage: ${stageName} completed successfully.`);
      return { success: true };
    }

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

    logger.debug(`Bootstrap Stage: ${stageName} completed successfully.`);
    return stageSuccess();
  } catch (error) {
    logger.error(
      `Bootstrap Stage: ${stageName} encountered an unexpected error during listener setup.`,
      error
    );
    return stageFailure(
      stageName,
      `Unexpected error during ${stageName}: ${error.message}`,
      error
    );
  }
}
