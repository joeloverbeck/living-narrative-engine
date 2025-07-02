// src/bootstrapper/stages/initializeAuxiliaryServicesStage.js

import { stageSuccess, stageFailure } from '../../utils/bootstrapperHelpers.js';
import {
  initEngineUIManager,
  initSaveGameUI,
  initLoadGameUI,
  initLlmSelectionModal,
  initCurrentTurnActorRenderer,
  initSpeechBubbleRenderer,
  initProcessingIndicatorController,
} from './auxiliary/index.js';

/**
 * @typedef {import('../../dependencyInjection/appContainer.js').default} AppContainer
 * @typedef {import('../../engine/gameEngine.js').default} GameEngineInstance
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../dependencyInjection/tokens.js').tokens} TokensObject
 */

/**
 * Calls all auxiliary service initializers in sequence.
 *
 * @async
 * @param {AppContainer} container
 * @param {GameEngineInstance} gameEngine
 * @param {ILogger} logger
 * @param {TokensObject} tokens
 * @returns {Promise<import('../../types/stageResult.js').StageResult>} Result object indicating if all services initialized.
 */
export async function initializeAuxiliaryServicesStage(
  container,
  gameEngine,
  logger,
  tokens
) {
  const stageName = 'Auxiliary Services Initialization';
  logger.debug(`Bootstrap Stage: Starting ${stageName}...`);
  const results = [
    [
      'EngineUIManager',
      initEngineUIManager({
        container,
        gameEngine,
        logger,
        tokens,
      }),
    ],
    [
      'SaveGameUI',
      initSaveGameUI({
        container,
        gameEngine,
        logger,
        tokens,
      }),
    ],
    [
      'LoadGameUI',
      initLoadGameUI({
        container,
        gameEngine,
        logger,
        tokens,
      }),
    ],
    [
      'LlmSelectionModal',
      initLlmSelectionModal({
        container,
        gameEngine,
        logger,
        tokens,
      }),
    ],
    [
      'CurrentTurnActorRenderer',
      initCurrentTurnActorRenderer({
        container,
        gameEngine,
        logger,
        tokens,
      }),
    ],
    [
      'SpeechBubbleRenderer',
      initSpeechBubbleRenderer({
        container,
        gameEngine,
        logger,
        tokens,
      }),
    ],
    [
      'ProcessingIndicatorController',
      initProcessingIndicatorController({
        container,
        gameEngine,
        logger,
        tokens,
      }),
    ],
  ];

  const failures = results
    .filter(([, r]) => !r.success)
    .map(([name, r]) => ({ service: name, error: r.error }));

  if (failures.length > 0) {
    const failList = failures.map((f) => f.service).join(', ');
    const result = stageFailure(stageName, `Failed to initialize: ${failList}`);
    result.error.failures = failures;
    logger.error(
      `Bootstrap Stage: ${stageName} encountered failures: ${failList}`,
      result.error
    );
    return result;
  }

  logger.debug(`Bootstrap Stage: ${stageName} completed.`);
  return stageSuccess();
}
