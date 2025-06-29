// src/bootstrapper/stages/auxiliary/initCurrentTurnActorRenderer.js

import {
  stageSuccess,
  stageFailure,
} from '../../../utils/bootstrapperHelpers.js';
import './typedefs.js';

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
      return stageSuccess();
    }
    logger.warn(`${stage}: CurrentTurnActorRenderer could not be resolved.`);
    return stageFailure(
      stage,
      'CurrentTurnActorRenderer could not be resolved.'
    );
  } catch (err) {
    logger.error(`${stage}: Error during resolution.`, err);
    return stageFailure(stage, err.message, err);
  }
}
