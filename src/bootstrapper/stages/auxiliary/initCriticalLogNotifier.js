// src/bootstrapper/stages/auxiliary/initCriticalLogNotifier.js

import {
  stageSuccess,
  stageFailure,
} from '../../../utils/bootstrapperHelpers.js';
import './typedefs.js';

/**
 * Resolves and initializes CriticalLogNotifier service.
 *
 * @param {AuxHelperDeps} deps
 * @returns {{success: boolean, error?: Error}}
 */
export function initCriticalLogNotifier({ container, logger, tokens }) {
  const stage = 'CriticalLogNotifier Init';
  try {
    logger.debug(`${stage}: Resolving CriticalLogNotifier...`);
    const notifier = container.resolve(tokens.ICriticalLogNotifier);
    if (notifier) {
      logger.debug(`${stage}: Resolved successfully.`);
      return stageSuccess();
    }
    logger.warn(`${stage}: CriticalLogNotifier could not be resolved.`);
    return stageFailure(stage, 'CriticalLogNotifier could not be resolved.');
  } catch (err) {
    logger.error(`${stage}: Error during resolution.`, err);
    return stageFailure(stage, err.message, err);
  }
}
