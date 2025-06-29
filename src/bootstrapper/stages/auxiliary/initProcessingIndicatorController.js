// src/bootstrapper/stages/auxiliary/initProcessingIndicatorController.js

import {
  stageSuccess,
  stageFailure,
} from '../../../utils/bootstrapperHelpers.js';
import './typedefs.js';

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
      return stageSuccess();
    }
    logger.warn(
      `${stage}: ProcessingIndicatorController could not be resolved.`
    );
    return stageFailure(
      stage,
      'ProcessingIndicatorController could not be resolved.'
    );
  } catch (err) {
    logger.error(`${stage}: Error during resolution.`, err);
    return stageFailure(stage, err.message, err);
  }
}
