// src/turns/services/AIFallbackActionFactory.js
// --- FILE START ---

import { IAIFallbackActionFactory } from '../interfaces/IAIFallbackActionFactory.js';
import { DEFAULT_FALLBACK_ACTION } from '../../llms/constants/llmConstants.js';

/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @class AIFallbackActionFactory
 * @augments {IAIFallbackActionFactory}
 * @description Concrete implementation that builds fallback actions when
 * AI processing fails.
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
   * @param {string} failureContext - Error context/type
   * @param {Error} error - Original error
   * @param {string} actorId - Actor ID
   * @param {object} [preservedData] - Optional LLM data to preserve
   * @param {string|null} [preservedData.speech] - LLM-generated speech
   * @param {string|null} [preservedData.thoughts] - LLM-generated thoughts
   * @param {Array|null} [preservedData.notes] - LLM-generated notes
   * @returns {ITurnAction}
   */
  create(failureContext, error, actorId, preservedData = {}) {
    // Determine if we have preserved speech to use
    const hasPreservedSpeech = Boolean(preservedData.speech);

    this.#logger.info(
      `AIFallbackActionFactory: Creating fallback for actor ${actorId} ` +
        `due to ${failureContext}. ` +
        `Preserved data: ${hasPreservedSpeech ? 'speech' : 'none'}`
    );

    if (hasPreservedSpeech) {
      this.#logger.debug(
        `AIFallbackActionFactory: Using preserved speech from LLM for actor ${actorId}`
      );
    }

    // Use preserved speech if available, otherwise generate fallback message
    let speechMessage;
    if (hasPreservedSpeech) {
      speechMessage = preservedData.speech;
    } else {
      let userFriendlyErrorBrief = 'an unexpected issue';
      if (
        typeof error.message === 'string' &&
        error.message.toLowerCase().includes('http error 500')
      ) {
        userFriendlyErrorBrief = 'a server connection problem';
      } else if (failureContext === 'llm_response_processing') {
        userFriendlyErrorBrief = 'a communication issue';
      }
      speechMessage = `I encountered ${userFriendlyErrorBrief} and will wait for a moment.`;
    }

    const diagnostics = {
      originalMessage: error.message,
      ...(error.details || {}),
      stack: error.stack?.split('\n'),
      preservedDataUsed: hasPreservedSpeech,
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
