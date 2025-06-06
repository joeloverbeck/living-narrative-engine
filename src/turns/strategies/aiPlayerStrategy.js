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
/** @typedef {import('../interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} IAIFallbackActionFactory */

import { IActorTurnStrategy } from '../interfaces/IActorTurnStrategy.js';
import { ILLMAdapter } from '../interfaces/ILLMAdapter.js';
import { IAIGameStateProvider } from '../interfaces/IAIGameStateProvider.js';
import { ILLMResponseProcessor } from '../interfaces/ILLMResponseProcessor.js';

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
  #aiFallbackActionFactory;

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
    aiFallbackActionFactory,
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
    if (
      !aiFallbackActionFactory ||
      typeof aiFallbackActionFactory.create !== 'function'
    ) {
      throw new Error(
        'AIPlayerStrategy: Constructor requires a valid IAIFallbackActionFactory.'
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
    this.#aiFallbackActionFactory = aiFallbackActionFactory;
    this.#logger = logger;
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

      return { action, extractedData };
    } catch (error) {
      // MASTER ERROR HANDLER: All errors from the try block are caught here.
      // This includes prompt building, LLM calls, and response processing.
      const failureContext =
        error.name === 'LLMProcessingError'
          ? 'llm_response_processing'
          : 'unhandled_orchestration_error';

      const fallbackAction = this.#aiFallbackActionFactory.create(
        failureContext,
        error,
        actorId
      );
      return { action: fallbackAction, extractedData: null };
    }
  }
}
