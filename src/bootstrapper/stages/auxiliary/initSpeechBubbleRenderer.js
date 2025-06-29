// src/bootstrapper/stages/auxiliary/initSpeechBubbleRenderer.js

import { stageSuccess, stageFailure } from '../../../utils/bootstrapperHelpers.js';
import './typedefs.js';

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
      return stageSuccess();
    }
    logger.warn(`${stage}: SpeechBubbleRenderer could not be resolved.`);
    return stageFailure(stage, 'SpeechBubbleRenderer could not be resolved.');
  } catch (err) {
    logger.error(`${stage}: Error during resolution.`, err);
    return stageFailure(stage, err.message, err);
  }
}
