// --- FILE START: src/turns/strategies/aiPlayerStrategy.js ---

/**
 * @file This module implements the IActorTurnStrategy for AI-controlled characters
 * @see src/turns/strategies/aiPlayerStrategy.js
 */

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../prompting/interfaces/IAIPromptPipeline.js').IAIPromptPipeline} IAIPromptPipeline */
/** @typedef {import('../../interfaces/coreServices.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} IAIFallbackActionFactory */

import { IActorTurnStrategy } from '../interfaces/IActorTurnStrategy.js';
import { ILLMAdapter } from '../interfaces/ILLMAdapter.js';
import { ILLMResponseProcessor } from '../interfaces/ILLMResponseProcessor.js';
import { IAIPromptPipeline } from '../../prompting/interfaces/IAIPromptPipeline.js';

/**
 * @class AIPlayerStrategy
 * @implements {IActorTurnStrategy}
 * @description Implements the IActorTurnStrategy for AI-controlled actors.
 */
export class AIPlayerStrategy extends IActorTurnStrategy {
  #llmAdapter;
  #aiPromptPipeline;
  #llmResponseProcessor;
  #logger;
  #aiFallbackActionFactory;

  /**
   * Creates an instance of AIPlayerStrategy.
   *
   * @param {object} dependencies - The dependencies for this strategy.
   * @param {ILLMAdapter} dependencies.llmAdapter - Adapter for LLM communication.
   * @param {IAIPromptPipeline} dependencies.aiPromptPipeline - Facade for generating the final prompt.
   * @param {ILLMResponseProcessor} dependencies.llmResponseProcessor - Processor for LLM responses.
   * @param {ILogger} dependencies.logger - Logger instance.
   * @throws {Error} If any dependency is invalid.
   */
  constructor({
    llmAdapter,
    aiPromptPipeline,
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
      !aiPromptPipeline ||
      typeof aiPromptPipeline.generatePrompt !== 'function'
    ) {
      throw new Error(
        'AIPlayerStrategy: Constructor requires a valid IAIPromptPipeline.'
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
    if (!logger) {
      throw new Error(
        'AIPlayerStrategy: Constructor requires a valid ILogger instance.'
      );
    }

    this.#llmAdapter = llmAdapter;
    this.#aiPromptPipeline = aiPromptPipeline;
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
      this.#logger.debug(
        `AIPlayerStrategy: decideAction for actor ${actorId}.`
      );

      const finalPromptString = await this.#aiPromptPipeline.generatePrompt(
        actor,
        context
      );

      if (!finalPromptString) {
        throw new Error('PromptBuilder returned an empty or invalid prompt.');
      }
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
