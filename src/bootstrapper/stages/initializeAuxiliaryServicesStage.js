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
  initCriticalLogNotifier,
  initActorParticipationController,
  initPerceptibleEventSenderController,
} from './auxiliary/index.js';
import { setupEntityCacheInvalidation } from '../../scopeDsl/core/entityHelpers.js';

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
  const serviceInitializers = [
    [
      'EngineUIManager',
      () =>
        initEngineUIManager({
          container,
          gameEngine,
          logger,
          tokens,
        }),
    ],
    [
      'SaveGameUI',
      () =>
        initSaveGameUI({
          container,
          gameEngine,
          logger,
          tokens,
        }),
    ],
    [
      'LoadGameUI',
      () =>
        initLoadGameUI({
          container,
          gameEngine,
          logger,
          tokens,
        }),
    ],
    [
      'LlmSelectionModal',
      () =>
        initLlmSelectionModal({
          container,
          gameEngine,
          logger,
          tokens,
        }),
    ],
    [
      'CurrentTurnActorRenderer',
      () =>
        initCurrentTurnActorRenderer({
          container,
          gameEngine,
          logger,
          tokens,
        }),
    ],
    [
      'SpeechBubbleRenderer',
      () =>
        initSpeechBubbleRenderer({
          container,
          gameEngine,
          logger,
          tokens,
        }),
    ],
    [
      'ProcessingIndicatorController',
      () =>
        initProcessingIndicatorController({
          container,
          gameEngine,
          logger,
          tokens,
        }),
    ],
    [
      'CriticalLogNotifier',
      () =>
        initCriticalLogNotifier({
          container,
          gameEngine,
          logger,
          tokens,
        }),
    ],
    [
      'ActorParticipationController',
      () =>
        initActorParticipationController({
          container,
          gameEngine,
          logger,
          tokens,
        }),
    ],
    [
      'PerceptibleEventSenderController',
      () =>
        initPerceptibleEventSenderController({
          container,
          gameEngine,
          logger,
          tokens,
        }),
    ],
  ];

  const results = [];
  for (const [name, initializer] of serviceInitializers) {
    const result = await initializer();
    results.push([name, result]);
  }

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

  // Setup entity cache invalidation after all auxiliary services are initialized
  // This ensures EventBus is registered in the container before setup
  try {
    logger.debug('Setting up entity cache invalidation...');
    const eventBus = container.resolve(tokens.IEventBus);

    if (!eventBus) {
      const errorMsg =
        'EventBus resolution returned undefined. Cannot setup cache invalidation.';
      logger.error(`Bootstrap Stage: ${stageName} - ${errorMsg}`);
      return stageFailure(stageName, errorMsg);
    }

    setupEntityCacheInvalidation(eventBus);
    logger.debug('Entity cache invalidation setup completed successfully.');
  } catch (error) {
    logger.error(
      `Bootstrap Stage: ${stageName} - Failed to setup entity cache invalidation:`,
      error
    );
    return stageFailure(
      stageName,
      `Failed to setup entity cache invalidation: ${error.message}`
    );
  }

  logger.debug(`Bootstrap Stage: ${stageName} completed.`);
  return stageSuccess();
}
