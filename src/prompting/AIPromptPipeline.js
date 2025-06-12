// src/prompting/AIPromptPipeline.js
// --- FILE START ---

import { IAIPromptPipeline } from './interfaces/IAIPromptPipeline.js';

/** @typedef {import('../turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../turns/interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider */
/** @typedef {import('../turns/interfaces/IAIPromptContentProvider.js').IAIPromptContentProvider} IAIPromptContentProvider */
/** @typedef {import('../interfaces/IPromptBuilder.js').IPromptBuilder} IPromptBuilder */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../turns/dtos/actionComposite.js').ActionComposite} ActionComposite */

export class AIPromptPipeline extends IAIPromptPipeline {
  #llmAdapter;
  #gameStateProvider;
  #promptContentProvider;
  #promptBuilder;
  #logger;

  /**
   * @param {object} dependencies
   * @param {ILLMAdapter} dependencies.llmAdapter
   * @param {IAIGameStateProvider} dependencies.gameStateProvider
   * @param {IAIPromptContentProvider} dependencies.promptContentProvider
   * @param {IPromptBuilder} dependencies.promptBuilder
   * @param {ILogger} dependencies.logger
   */
  constructor({
    llmAdapter,
    gameStateProvider,
    promptContentProvider,
    promptBuilder,
    logger,
  }) {
    super();

    if (
      !llmAdapter ||
      typeof llmAdapter.getAIDecision !== 'function' ||
      typeof llmAdapter.getCurrentActiveLlmId !== 'function'
    ) {
      throw new Error(
        'AIPromptPipeline: Constructor requires a valid ILLMAdapter.'
      );
    }
    if (
      !gameStateProvider ||
      typeof gameStateProvider.buildGameState !== 'function'
    ) {
      throw new Error(
        'AIPromptPipeline: Constructor requires a valid IAIGameStateProvider.'
      );
    }
    if (
      !promptContentProvider ||
      typeof promptContentProvider.getPromptData !== 'function'
    ) {
      throw new Error(
        'AIPromptPipeline: Constructor requires a valid IAIPromptContentProvider instance with a getPromptData method.'
      );
    }
    if (!promptBuilder || typeof promptBuilder.build !== 'function') {
      throw new Error(
        'AIPromptPipeline: Constructor requires a valid IPromptBuilder instance with a build method.'
      );
    }
    if (!logger || typeof logger.info !== 'function') {
      throw new Error(
        'AIPromptPipeline: Constructor requires a valid ILogger instance.'
      );
    }

    this.#llmAdapter = llmAdapter;
    this.#gameStateProvider = gameStateProvider;
    this.#promptContentProvider = promptContentProvider;
    this.#promptBuilder = promptBuilder;
    this.#logger = logger;
  }

  /**
   * Generates the final prompt string for an AI actor.
   *
   * @param {Entity} actor
   * @param {ITurnContext} context
   * @param {ActionComposite[]} availableActions - The definitive, indexed list of actions.
   * @returns {Promise<string>}
   */
  async generatePrompt(actor, context, availableActions) {
    const actorId = actor.id;
    this.#logger.debug(
      `AIPromptPipeline: Generating prompt for actor ${actorId}.`
    );

    const currentLlmId = await this.#llmAdapter.getCurrentActiveLlmId();
    if (!currentLlmId) throw new Error('Could not determine active LLM ID.');

    // Build the base game state, which no longer includes actions
    const gameStateDto = await this.#gameStateProvider.buildGameState(
      actor,
      context,
      this.#logger
    );

    // Augment the DTO with the definitive list of actions passed as a parameter
    gameStateDto.availableActions = availableActions;

    const promptData = await this.#promptContentProvider.getPromptData(
      gameStateDto,
      this.#logger
    );
    const finalPromptString = await this.#promptBuilder.build(
      currentLlmId,
      promptData
    );

    if (!finalPromptString)
      throw new Error('PromptBuilder returned an empty or invalid prompt.');
    this.#logger.debug(
      `AIPromptPipeline: Generated final prompt string for actor ${actorId} using LLM config for '${currentLlmId}'.`
    );
    return finalPromptString;
  }
}
// --- FILE END ---
