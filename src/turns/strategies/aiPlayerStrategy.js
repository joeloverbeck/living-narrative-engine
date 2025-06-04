// src/turns/strategies/aiPlayerStrategy.js
// --- FILE START ---

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IPromptBuilder.js').IPromptBuilder} IPromptBuilder */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
/** @typedef {import('../../types/promptData.js').PromptData} PromptData */
/** @typedef {import('../interfaces/IAIPromptContentProvider.js').IAIPromptContentProvider} IAIPromptContentProvider */

import { IActorTurnStrategy } from '../interfaces/IActorTurnStrategy.js';
import { ILLMAdapter } from '../interfaces/ILLMAdapter.js';
import { IAIGameStateProvider } from '../interfaces/IAIGameStateProvider.js';
import { ILLMResponseProcessor } from '../interfaces/ILLMResponseProcessor.js';
import { DEFAULT_FALLBACK_ACTION } from '../../llms/constants/llmConstants.js';

/**
 * @class AIPlayerStrategy
 * @implements {IActorTurnStrategy}
 * @description Implements the IActorTurnStrategy for AI-controlled actors.
 */
export class AIPlayerStrategy extends IActorTurnStrategy {
     * @private
  #llmAdapter;
     * @private
  #gameStateProvider;
  // MODIFICATION: Updated type to IAIPromptContentProvider
     * @private
  #promptContentProvider;
  // MODIFICATION: Updated type to IPromptBuilder
     * @private
  #promptBuilder;
     * @private
  #llmResponseProcessor;
     * @private
  #logger;

  /**
   * Creates an instance of AIPlayerStrategy.
   * @param {object} dependencies - The dependencies for this strategy.
   * @param {ILLMAdapter} dependencies.llmAdapter - Adapter for LLM communication.
   * @param {IAIGameStateProvider} dependencies.gameStateProvider - Provider for AI game state.
   * @param {IAIPromptContentProvider} dependencies.promptContentProvider - Provider for prompt content pieces.
   * @param {IPromptBuilder} dependencies.promptBuilder - Builder for assembling the final prompt string.
   * @param {ILLMResponseProcessor} dependencies.llmResponseProcessor - Processor for LLM responses.
   * @param {ILogger} dependencies.logger - Logger instance.
   * @throws {Error} If any dependency is invalid.
   */
  constructor({
    llmAdapter,
    gameStateProvider,
    promptContentProvider,
    promptBuilder,
    llmResponseProcessor,
    logger,
  }) {
    super();

    if (
      !llmAdapter ||
      typeof llmAdapter.getAIDecision !== 'function' ||
      typeof llmAdapter.getCurrentActiveLlmId !== 'function'
    ) {
      throw new Error(
        'AIPlayerStrategy: Constructor requires a valid ILLMAdapter.'
      );
    }
    if (
      !gameStateProvider ||
      typeof gameStateProvider.buildGameState !== 'function'
    ) {
      throw new Error(
        'AIPlayerStrategy: Constructor requires a valid IAIGameStateProvider.'
      );
    }
    // MODIFICATION: Updated validation for promptContentProvider
    // The constructor check should ensure promptContentProvider has getPromptData.
    // If validateGameStateForPrompting needed to be called directly by AIPlayerStrategy,
    // we'd add a check for it here, but it's internal to getPromptData now.
    if (
      !promptContentProvider ||
      typeof promptContentProvider.getPromptData !== 'function'
    ) {
      throw new Error(
        'AIPlayerStrategy: Constructor requires a valid IAIPromptContentProvider instance with a getPromptData method.'
      );
    }
    // MODIFICATION: Updated validation for promptBuilder
    if (!promptBuilder || typeof promptBuilder.build !== 'function') {
      throw new Error(
        'AIPlayerStrategy: Constructor requires a valid IPromptBuilder instance with a build method.'
      );
    }
    if (
      !llmResponseProcessor ||
      typeof llmResponseProcessor.processResponse !== 'function'
    ) {
      throw new Error(
        'AIPlayerStrategy: Constructor requires a valid ILLMResponseProcessor.'
      );
    }
    if (!logger || typeof logger.info !== 'function') {
      throw new Error(
        'AIPlayerStrategy: Constructor requires a valid ILogger instance.'
      );
    }

    this.#llmAdapter = llmAdapter;
    this.#gameStateProvider = gameStateProvider;
    this.#promptContentProvider = promptContentProvider;
    this.#promptBuilder = promptBuilder;
    this.#llmResponseProcessor = llmResponseProcessor;
    this.#logger = logger;
  }

  _createFallbackAction(errorContext, actorId = 'UnknownActor') {
    const detailedErrorContext = `AI Error for ${actorId}: ${errorContext}. Waiting.`;
    this.#logger.debug(
      `AIPlayerStrategy: Creating fallback action. Error: "${errorContext}", Actor: ${actorId}`
    );
    let userFriendlyErrorBrief = 'an unexpected issue';
    if (
      typeof errorContext === 'string' &&
      errorContext.toLowerCase().includes('http error 500')
    ) {
      userFriendlyErrorBrief = 'a connection problem';
    }
    const speechMessage = `I encountered ${userFriendlyErrorBrief} and will wait.`;
    return {
      actionDefinitionId: DEFAULT_FALLBACK_ACTION.actionDefinitionId,
      commandString: DEFAULT_FALLBACK_ACTION.commandString,
      speech: speechMessage,
      resolvedParameters: {
        errorContext: detailedErrorContext,
        actorId: actorId,
      },
    };
  }

  async decideAction(context) {
    let actor;
    let actorId = 'UnknownActor';

    try {
      if (!context) {
        this.#logger.error(
          'AIPlayerStrategy: Critical - ITurnContext is null.'
        );
        return this._createFallbackAction('null_turn_context');
      }
      actor = context.getActor();
      if (!actor || !actor.id) {
        this.#logger.error(
          'AIPlayerStrategy: Critical - Actor not available in context.'
        );
        return this._createFallbackAction('missing_actor_in_context');
      }
      actorId = actor.id;
      this.#logger.info(`AIPlayerStrategy: decideAction for actor ${actorId}.`);

      // 1. Get current LLM ID for PromptBuilder
      const currentLlmId = await this.#llmAdapter.getCurrentActiveLlmId();
      if (!currentLlmId) {
        this.#logger.error(
          `AIPlayerStrategy: Could not determine active LLM ID for actor ${actorId}. Cannot build prompt.`
        );
        return this._createFallbackAction('missing_active_llm_id', actorId);
      }
      this.#logger.debug(
        `AIPlayerStrategy: Active LLM ID for prompt construction: ${currentLlmId}`
      );

      // 2. Build Game State DTO
      const gameStateDto = await this.#gameStateProvider.buildGameState(
        actor,
        context,
        this.#logger
      );

      // The call to AIPromptContentProvider.checkCriticalGameState(gameStateDto, this.#logger);
      // has been REMOVED from here. Validation is now handled internally by getPromptData.

      // 3. Assemble promptData using AIPromptContentProvider
      this.#logger.debug(
        `AIPlayerStrategy: Requesting PromptData from AIPromptContentProvider for actor ${actorId}.`
      );
      // The call to getPromptData will now internally validate gameStateDto and throw an error if it's invalid.
      const promptData = await this.#promptContentProvider.getPromptData(
        gameStateDto,
        this.#logger
      );
      this.#logger.debug(
        `AIPlayerStrategy: promptData received for actor ${actorId}. Keys: ${Object.keys(promptData).join(', ')}`
      );

      // 4. Build the final prompt string using PromptBuilder
      const finalPromptString = await this.#promptBuilder.build(
        currentLlmId,
        promptData
      );

      if (!finalPromptString) {
        // Covers null, undefined, and empty string ''
        this.#logger.error(
          `AIPlayerStrategy: PromptBuilder returned an empty or invalid prompt for LLM ${currentLlmId}, actor ${actorId}.`
        );
        return this._createFallbackAction(
          'prompt_builder_empty_result',
          actorId
        );
      }
      this.#logger.info(
        `AIPlayerStrategy: Generated final prompt string for actor ${actorId} using LLM config for '${currentLlmId}'. Length: ${finalPromptString.length}.`
      );
      this.#logger.debug(
        `AIPlayerStrategy: Final Prompt String for ${actorId} (LLM: ${currentLlmId}):\n${finalPromptString}`
      );

      // 5. Call LLM Adapter with the final prompt string
      const llmJsonResponse =
        await this.#llmAdapter.getAIDecision(finalPromptString);
      this.#logger.debug(
        `AIPlayerStrategy: Received LLM JSON response for actor ${actorId}: ${llmJsonResponse}`
      );

      // 6. Process LLM Response
      return await this.#llmResponseProcessor.processResponse(
        llmJsonResponse,
        actorId,
        this.#logger
      );
    } catch (error) {
      const errorMessage = error?.message || 'Unknown error object';
      this.#logger.error(
        `AIPlayerStrategy: Unhandled error for actor ${actorId}: ${errorMessage}`,
        {
          errorDetails: error,
          stack: error?.stack,
        }
      );
      // The existing try...catch block will catch errors thrown by getPromptData (due to validation failure)
      // or any other part of the process.
      return this._createFallbackAction(
        `unhandled_orchestration_error: ${errorMessage}`,
        actorId
      );
    }
  }
}

// --- FILE END ---
