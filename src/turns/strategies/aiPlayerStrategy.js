// --- FILE START: src/turns/strategies/aiPlayerStrategy.js ---

/**
 * @file This module implements the IActorTurnStrategy for AI-controlled characters
 * @see src/turns/strategies/aiPlayerStrategy.js
 */

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IPromptBuilder.js').IPromptBuilder} IPromptBuilder */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
/** @typedef {import('../../types/promptData.js').PromptData} PromptData */
/** @typedef {import('../interfaces/IAIPromptContentProvider.js').IAIPromptContentProvider} IAIPromptContentProvider */
/** @typedef {import('../../interfaces/coreServices.js').IEntityManager} IEntityManager */

import { IActorTurnStrategy } from '../interfaces/IActorTurnStrategy.js';
import { ILLMAdapter } from '../interfaces/ILLMAdapter.js';
import { IAIGameStateProvider } from '../interfaces/IAIGameStateProvider.js';
import { ILLMResponseProcessor } from '../interfaces/ILLMResponseProcessor.js';
import { DEFAULT_FALLBACK_ACTION } from '../../llms/constants/llmConstants.js';
import { persistThoughts } from '../../ai/thoughtPersistenceHook.js';
import { persistNotes } from '../../ai/notesPersistenceHook.js';

/**
 * @class AIPlayerStrategy
 * @implements {IActorTurnStrategy}
 * @description Implements the IActorTurnStrategy for AI-controlled actors.
 */
export class AIPlayerStrategy extends IActorTurnStrategy {
  #llmAdapter;
  #gameStateProvider;
  #promptContentProvider;
  #promptBuilder;
  #llmResponseProcessor;
  #logger;

  /**
   * Creates an instance of AIPlayerStrategy.
   *
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

  /**
   * Creates a single, canonical fallback action when any part of the AI
   * decision-making pipeline fails. This method centralizes fallback logic.
   *
   * @private
   * @param {string} failureContext - A high-level string describing where the failure occurred.
   * @param {Error} error - The caught error object.
   * @param {string} actorId - The ID of the actor for whom the action failed.
   * @returns {ITurnAction} The canonical fallback action.
   */
  _createCanonicalFallbackAction(failureContext, error, actorId) {
    this.#logger.error(
      `AIPlayerStrategy: Creating canonical fallback action for actor ${actorId} due to ${failureContext}.`,
      {
        actorId,
        error,
        errorMessage: error.message,
        stack: error.stack,
      }
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

    // Construct a detailed diagnostics object for logging and debugging.
    const diagnostics = {
      originalMessage: error.message,
      ...(error.details || {}), // Spread details from LLMProcessingError if present
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

  async decideAction(context) {
    let actor;
    let actorId = 'UnknownActor';

    try {
      if (!context) {
        throw new Error('Critical - ITurnContext is null.');
      }
      actor = context.getActor();
      if (!actor || !actor.id) {
        throw new Error('Critical - Actor not available in context.');
      }
      actorId = actor.id;
      this.#logger.info(`AIPlayerStrategy: decideAction for actor ${actorId}.`);

      // 1. Get current LLM ID for PromptBuilder
      const currentLlmId = await this.#llmAdapter.getCurrentActiveLlmId();
      if (!currentLlmId) {
        throw new Error('Could not determine active LLM ID.');
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

      // 3. Assemble promptData using AIPromptContentProvider
      // The call to getPromptData will now internally validate gameStateDto and throw an error if it's invalid.
      const promptData = await this.#promptContentProvider.getPromptData(
        gameStateDto,
        this.#logger
      );
      this.#logger.debug(
        `AIPlayerStrategy: promptData received for actor ${actorId}.`
      );

      // 4. Build the final prompt string using PromptBuilder
      const finalPromptString = await this.#promptBuilder.build(
        currentLlmId,
        promptData
      );

      if (!finalPromptString) {
        throw new Error('PromptBuilder returned an empty or invalid prompt.');
      }
      this.#logger.info(
        `AIPlayerStrategy: Generated final prompt string for actor ${actorId} using LLM config for '${currentLlmId}'.`
      );
      this.#logger.debug(
        `AIPlayerStrategy: Final Prompt String for ${actorId}:\n${finalPromptString}`
      );

      // 5. Call LLM Adapter with the final prompt string
      const llmJsonResponse =
        await this.#llmAdapter.getAIDecision(finalPromptString);
      this.#logger.debug(
        `AIPlayerStrategy: Received LLM JSON response for actor ${actorId}: ${llmJsonResponse}`
      );

      // 6. Process LLM Response. This now throws a detailed error on failure.
      const { action, extractedData } =
        await this.#llmResponseProcessor.processResponse(
          llmJsonResponse,
          actorId,
          this.#logger
        );

      // 7. Handle successful result and persist data
      const entityManager = context.getEntityManager();
      const actorEntity = entityManager?.getEntityInstance(actorId);

      if (actorEntity && extractedData) {
        this.#logger.debug(
          `Persisting thoughts and notes for actor ${actorId}.`
        );
        try {
          if (extractedData.thoughts) {
            persistThoughts(
              { thoughts: extractedData.thoughts },
              actorEntity,
              this.#logger
            );
          }
          if (extractedData.notes && extractedData.notes.length > 0) {
            persistNotes(
              { notes: extractedData.notes },
              actorEntity,
              this.#logger
            );
          }
        } catch (e) {
          this.#logger.warn(
            'Persistence of thoughts or notes failed post-processing',
            { actorId, err: e }
          );
        }
      }

      return action; // Return the clean action on success
    } catch (error) {
      // MASTER ERROR HANDLER: All errors from the try block are caught here.
      // This includes prompt building, LLM calls, and response processing.
      const failureContext =
        error.name === 'LLMProcessingError'
          ? 'llm_response_processing'
          : 'unhandled_orchestration_error';

      // The canonical fallback action is created here, centralizing all fallback logic.
      return this._createCanonicalFallbackAction(
        failureContext,
        error,
        actorId
      );
    }
  }
}
