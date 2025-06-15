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
 * @returns {void}
 */
export function initEngineUIManager({ container, logger, tokens }) {
  resolveAndInitialize(container, tokens.EngineUIManager, 'initialize', logger);
}

/**
 * Resolves SaveGameUI and calls its init method with the GameEngine instance.
 *
 * @param {AuxHelperDeps} deps
 * @returns {void}
 */
export function initSaveGameUI({ container, gameEngine, logger, tokens }) {
  resolveAndInitialize(
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
 * @returns {void}
 */
export function initLoadGameUI({ container, gameEngine, logger, tokens }) {
  resolveAndInitialize(
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
 * @returns {void}
 */
export function initLlmSelectionModal({ container, logger, tokens }) {
  const stage = 'LlmSelectionModal Init';
  try {
    logger.debug(`${stage}: Resolving LlmSelectionModal...`);
    const modal = container.resolve(tokens.LlmSelectionModal);
    if (modal) {
      logger.debug(`${stage}: Resolved successfully.`);
    } else {
      logger.warn(`${stage}: LlmSelectionModal could not be resolved.`);
    }
  } catch (err) {
    logger.error(`${stage}: Error during resolution.`, err);
  }
}

/**
 * Resolves CurrentTurnActorRenderer service.
 *
 * @param {AuxHelperDeps} deps
 * @returns {void}
 */
export function initCurrentTurnActorRenderer({ container, logger, tokens }) {
  const stage = 'CurrentTurnActorRenderer Init';
  try {
    logger.debug(`${stage}: Resolving CurrentTurnActorRenderer...`);
    const renderer = container.resolve(tokens.CurrentTurnActorRenderer);
    if (renderer) {
      logger.debug(`${stage}: Resolved successfully.`);
    } else {
      logger.warn(`${stage}: CurrentTurnActorRenderer could not be resolved.`);
    }
  } catch (err) {
    logger.error(`${stage}: Error during resolution.`, err);
  }
}

/**
 * Resolves SpeechBubbleRenderer service.
 *
 * @param {AuxHelperDeps} deps
 * @returns {void}
 */
export function initSpeechBubbleRenderer({ container, logger, tokens }) {
  const stage = 'SpeechBubbleRenderer Init';
  try {
    logger.debug(`${stage}: Resolving SpeechBubbleRenderer...`);
    const renderer = container.resolve(tokens.SpeechBubbleRenderer);
    if (renderer) {
      logger.debug(`${stage}: Resolved successfully.`);
    } else {
      logger.warn(`${stage}: SpeechBubbleRenderer could not be resolved.`);
    }
  } catch (err) {
    logger.error(`${stage}: Error during resolution.`, err);
  }
}

/**
 * Resolves ProcessingIndicatorController service.
 *
 * @param {AuxHelperDeps} deps
 * @returns {void}
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
    } else {
      logger.warn(
        `${stage}: ProcessingIndicatorController could not be resolved.`
      );
    }
  } catch (err) {
    logger.error(`${stage}: Error during resolution.`, err);
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
 * @returns {Promise<void>}
 */
export async function initializeAuxiliaryServicesStage(
  container,
  gameEngine,
  logger,
  tokens
) {
  const stageName = 'Auxiliary Services Initialization';
  logger.debug(`Bootstrap Stage: Starting ${stageName}...`);

  initEngineUIManager({ container, gameEngine, logger, tokens });
  initSaveGameUI({ container, gameEngine, logger, tokens });
  initLoadGameUI({ container, gameEngine, logger, tokens });
  initLlmSelectionModal({ container, gameEngine, logger, tokens });
  initCurrentTurnActorRenderer({ container, gameEngine, logger, tokens });
  initSpeechBubbleRenderer({ container, gameEngine, logger, tokens });
  initProcessingIndicatorController({ container, gameEngine, logger, tokens });

  logger.debug(`Bootstrap Stage: ${stageName} completed.`);
}
