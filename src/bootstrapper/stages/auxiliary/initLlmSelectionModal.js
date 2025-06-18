// src/bootstrapper/stages/auxiliary/initLlmSelectionModal.js

import { stageSuccess, stageFailure } from '../../helpers.js';
import './typedefs.js';

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
      return stageSuccess();
    }
    logger.warn(`${stage}: LlmSelectionModal could not be resolved.`);
    return stageFailure(stage, 'LlmSelectionModal could not be resolved.');
  } catch (err) {
    logger.error(`${stage}: Error during resolution.`, err);
    return stageFailure(stage, err.message, err);
  }
}
