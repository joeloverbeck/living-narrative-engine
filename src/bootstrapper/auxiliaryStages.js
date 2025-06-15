// src/bootstrapper/auxiliaryStages.js

/**
 * Helper functions for initializing optional UI-related services.
 *
 * @module auxiliaryStages
 */

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
  const stage = 'EngineUIManager Init';
  try {
    logger.debug(`${stage}: Resolving EngineUIManager...`);
    const eum = container.resolve(tokens.EngineUIManager);
    if (!eum) {
      throw new Error(
        'EngineUIManager instance could not be resolved from container.'
      );
    }
    if (typeof eum.initialize !== 'function') {
      throw new Error('EngineUIManager does not expose initialize()');
    }
    eum.initialize();
    logger.debug(`${stage}: Initialized successfully.`);
  } catch (err) {
    logger.error(`${stage}: Failed to initialize.`, err);
  }
}

/**
 * Resolves SaveGameUI and calls its init method with the GameEngine instance.
 *
 * @param {AuxHelperDeps} deps
 * @returns {void}
 */
export function initSaveGameUI({ container, gameEngine, logger, tokens }) {
  const stage = 'SaveGameUI Init';
  try {
    logger.debug(`${stage}: Resolving SaveGameUI...`);
    const ui = container.resolve(tokens.SaveGameUI);
    if (ui) {
      if (typeof ui.init !== 'function') {
        throw new Error('SaveGameUI missing init(gameEngine)');
      }
      ui.init(gameEngine);
      logger.debug(`${stage}: Initialized with GameEngine.`);
    } else {
      logger.warn(`${stage}: SaveGameUI could not be resolved.`);
    }
  } catch (err) {
    logger.error(`${stage}: Error during initialization.`, err);
  }
}

/**
 * Resolves LoadGameUI and calls its init method with the GameEngine instance.
 *
 * @param {AuxHelperDeps} deps
 * @returns {void}
 */
export function initLoadGameUI({ container, gameEngine, logger, tokens }) {
  const stage = 'LoadGameUI Init';
  try {
    logger.debug(`${stage}: Resolving LoadGameUI...`);
    const ui = container.resolve(tokens.LoadGameUI);
    if (ui) {
      if (typeof ui.init !== 'function') {
        throw new Error('LoadGameUI missing init(gameEngine)');
      }
      ui.init(gameEngine);
      logger.debug(`${stage}: Initialized with GameEngine.`);
    } else {
      logger.warn(`${stage}: LoadGameUI could not be resolved.`);
    }
  } catch (err) {
    logger.error(`${stage}: Error during initialization.`, err);
  }
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
