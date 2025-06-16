// src/bootstrapper/auxiliaryStages.js

/**
 * Helper functions for initializing optional UI-related services.
 *
 * @module auxiliaryStages
 */
import { resolveAndInitialize } from './helpers.js';

/**
 * @typedef {import('../dependencyInjection/appContainer.js').default} AppContainer
 * @typedef {import('../engine/gameEngine.js').default} GameEngineInstance
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../dependencyInjection/tokens.js').tokens} TokensObject
 */

/**
 * Common dependencies object passed to helper functions.
 *
 * @typedef {object} AuxHelperDeps
 * @property {AppContainer} container
 * @property {GameEngineInstance} gameEngine
 * @property {ILogger} logger
 * @property {TokensObject} tokens
 */

/**
 * Resolves and initializes the EngineUIManager service.
 *
 * @param {AuxHelperDeps} deps
 * @returns {{success: boolean, error?: Error}}
 */
export function initEngineUIManager({ container, logger, tokens }) {
  return resolveAndInitialize(
    container,
    tokens.EngineUIManager,
    'initialize',
    logger
  );
}

/**
 * Resolves SaveGameUI and calls its init method with the GameEngine instance.
 *
 * @param {AuxHelperDeps} deps
 * @returns {{success: boolean, error?: Error}}
 */
export function initSaveGameUI({ container, gameEngine, logger, tokens }) {
  return resolveAndInitialize(
    container,
    tokens.SaveGameUI,
    'init',
    logger,
    gameEngine
  );
}

/**
 * Resolves LoadGameUI and calls its init method with the GameEngine instance.
 *
 * @param {AuxHelperDeps} deps
 * @returns {{success: boolean, error?: Error}}
 */
export function initLoadGameUI({ container, gameEngine, logger, tokens }) {
  return resolveAndInitialize(
    container,
    tokens.LoadGameUI,
    'init',
    logger,
    gameEngine
  );
}

/**
 * Resolves LlmSelectionModal service.
 *
 * @param {AuxHelperDeps} deps
 * @returns {{success: boolean, error?: Error}}
 */
export function initLlmSelectionModal({ container, logger, tokens }) {
  const stage = 'LlmSelectionModal Init';
  try {
    logger.debug(`${stage}: Resolving LlmSelectionModal...`);
    const modal = container.resolve(tokens.LlmSelectionModal);
    if (modal) {
      logger.debug(`${stage}: Resolved successfully.`);
      return { success: true };
    }
    const err = new Error('LlmSelectionModal could not be resolved.');
    logger.warn(`${stage}: ${err.message}`);
    return { success: false, error: err };
  } catch (err) {
    logger.error(`${stage}: Error during resolution.`, err);
    return { success: false, error: err };
  }
}

/**
 * Resolves CurrentTurnActorRenderer service.
 *
 * @param {AuxHelperDeps} deps
 * @returns {{success: boolean, error?: Error}}
 */
export function initCurrentTurnActorRenderer({ container, logger, tokens }) {
  const stage = 'CurrentTurnActorRenderer Init';
  try {
    logger.debug(`${stage}: Resolving CurrentTurnActorRenderer...`);
    const renderer = container.resolve(tokens.CurrentTurnActorRenderer);
    if (renderer) {
      logger.debug(`${stage}: Resolved successfully.`);
      return { success: true };
    }
    const err = new Error('CurrentTurnActorRenderer could not be resolved.');
    logger.warn(`${stage}: ${err.message}`);
    return { success: false, error: err };
  } catch (err) {
    logger.error(`${stage}: Error during resolution.`, err);
    return { success: false, error: err };
  }
}

/**
 * Resolves SpeechBubbleRenderer service.
 *
 * @param {AuxHelperDeps} deps
 * @returns {{success: boolean, error?: Error}}
 */
export function initSpeechBubbleRenderer({ container, logger, tokens }) {
  const stage = 'SpeechBubbleRenderer Init';
  try {
    logger.debug(`${stage}: Resolving SpeechBubbleRenderer...`);
    const renderer = container.resolve(tokens.SpeechBubbleRenderer);
    if (renderer) {
      logger.debug(`${stage}: Resolved successfully.`);
      return { success: true };
    }
    const err = new Error('SpeechBubbleRenderer could not be resolved.');
    logger.warn(`${stage}: ${err.message}`);
    return { success: false, error: err };
  } catch (err) {
    logger.error(`${stage}: Error during resolution.`, err);
    return { success: false, error: err };
  }
}

/**
 * Resolves ProcessingIndicatorController service.
 *
 * @param {AuxHelperDeps} deps
 * @returns {{success: boolean, error?: Error}}
 */
export function initProcessingIndicatorController({
  container,
  logger,
  tokens,
}) {
  const stage = 'ProcessingIndicatorController Init';
  try {
    logger.debug(`${stage}: Resolving ProcessingIndicatorController...`);
    const ctrl = container.resolve(tokens.ProcessingIndicatorController);
    if (ctrl) {
      logger.debug(`${stage}: Resolved successfully.`);
      return { success: true };
    }
    const err = new Error(
      'ProcessingIndicatorController could not be resolved.'
    );
    logger.warn(`${stage}: ${err.message}`);
    return { success: false, error: err };
  } catch (err) {
    logger.error(`${stage}: Error during resolution.`, err);
    return { success: false, error: err };
  }
}

/**
 * Calls all auxiliary service initializers in sequence.
 *
 * @async
 * @param {AppContainer} container
 * @param {GameEngineInstance} gameEngine
 * @param {ILogger} logger
 * @param {TokensObject} tokens
 * @returns {Promise<void>} Resolves when all auxiliary services initialize successfully.
 * @throws {Error} Aggregated error with `failures` array if critical services fail.
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
    const aggregatedError = new Error(`Failed to initialize: ${failList}`);
    aggregatedError.phase = stageName;
    aggregatedError.failures = failures;
    logger.error(
      `Bootstrap Stage: ${stageName} encountered failures: ${failList}`,
      aggregatedError
    );
    throw aggregatedError;
  }

  logger.debug(`Bootstrap Stage: ${stageName} completed.`);
}
