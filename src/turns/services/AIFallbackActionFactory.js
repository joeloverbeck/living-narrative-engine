// src/turns/services/AIFallbackActionFactory.js
// --- FILE START ---

import { ILogger } from '../../interfaces/iLogger.js';
import { ISafeEventDispatcher } from '../../interfaces/iSafeEventDispatcher.js';
import { IAIFallbackActionFactory } from '../interfaces/iAIFallbackActionFactory.js';
import { DEFAULT_FALLBACK_ACTION } from '../../llms/constants/llmConstants.js';

/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Factory for creating fallback actions when AI processing fails.
 * 
 * @augments {IAIFallbackActionFactory}
 */
export class AIFallbackActionFactory extends IAIFallbackActionFactory {
  #logger;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger - Logger instance.
   */
  constructor({ logger }) {
    super();
    if (!logger) {
      throw new Error('AIFallbackActionFactory requires a logger.');
    }
    this.#logger = logger;
  }

  /**
   * @override
   * @param {string} failureContext
   * @param {Error} error
   * @param {string} actorId
   * @returns {ITurnAction}
   */
  create(failureContext, error, actorId) {
    this.#logger.error(
      `AIFallbackActionFactory: Creating fallback for actor ${actorId} due to ${failureContext}.`,
      { actorId, error, errorMessage: error.message, stack: error.stack }
    );

    let userFriendlyErrorBrief = 'an unexpected issue';
    if (
      typeof error.message === 'string' &&
      error.message.toLowerCase().includes('http error 500')
    ) {
      userFriendlyErrorBrief = 'a server connection problem';
    } else if (failureContext === 'llm_response_processing') {
      userFriendlyErrorBrief = 'a communication issue';
    }

    const speechMessage = `I encountered ${userFriendlyErrorBrief} and will wait for a moment.`;
    const diagnostics = {
      originalMessage: error.message,
      ...(error.details || {}),
      stack: error.stack?.split('\n'),
    };

    return {
      actionDefinitionId: DEFAULT_FALLBACK_ACTION.actionDefinitionId,
      commandString: DEFAULT_FALLBACK_ACTION.commandString,
      speech: speechMessage,
      resolvedParameters: {
        actorId,
        isFallback: true,
        failureReason: failureContext,
        diagnostics,
      },
    };
  }
}

// --- FILE END ---
