// src/prompting/MoodUpdatePromptPipeline.js
// --- FILE START ---

/**
 * @file Pipeline for generating mood-only prompts (Phase 1 of two-phase flow).
 * This pipeline generates prompts that only request mood/emotional state updates,
 * without action selection or speech/thought generation.
 */

import { validateDependencies } from '../utils/dependencyUtils.js';

/** @typedef {import('../turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../turns/interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider */
/** @typedef {import('../turns/interfaces/IAIPromptContentProvider.js').IAIPromptContentProvider} IAIPromptContentProvider */
/** @typedef {import('../interfaces/IPromptBuilder.js').IPromptBuilder} IPromptBuilder */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */

/**
 * @class MoodUpdatePromptPipeline
 * @description Generates mood-only prompts for Phase 1 of the two-phase emotional state update flow.
 * Unlike AIPromptPipeline, this pipeline does not include available actions in the prompt,
 * focusing solely on updating the character's mood and sexual state based on recent events.
 */
export class MoodUpdatePromptPipeline {
  /** @type {ILLMAdapter} */
  #llmAdapter;
  /** @type {IAIGameStateProvider} */
  #gameStateProvider;
  /** @type {IAIPromptContentProvider} */
  #promptContentProvider;
  /** @type {IPromptBuilder} */
  #promptBuilder;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} dependencies
   * @param {ILLMAdapter} dependencies.llmAdapter - Adapter for LLM interactions.
   * @param {IAIGameStateProvider} dependencies.gameStateProvider - Provider for game state data.
   * @param {IAIPromptContentProvider} dependencies.promptContentProvider - Provider for prompt content assembly.
   * @param {IPromptBuilder} dependencies.promptBuilder - Builder for constructing final prompts.
   * @param {ILogger} dependencies.logger - Logger instance.
   */
  constructor({
    llmAdapter,
    gameStateProvider,
    promptContentProvider,
    promptBuilder,
    logger,
  }) {
    validateDependencies(
      [
        {
          dependency: llmAdapter,
          name: 'MoodUpdatePromptPipeline: llmAdapter',
          methods: ['getCurrentActiveLlmId'],
        },
        {
          dependency: gameStateProvider,
          name: 'MoodUpdatePromptPipeline: gameStateProvider',
          methods: ['buildGameState'],
        },
        {
          dependency: promptContentProvider,
          name: 'MoodUpdatePromptPipeline: promptContentProvider',
          methods: ['getMoodUpdatePromptData'],
        },
        {
          dependency: promptBuilder,
          name: 'MoodUpdatePromptPipeline: promptBuilder',
          methods: ['build'],
        },
        {
          dependency: logger,
          name: 'MoodUpdatePromptPipeline: logger',
          methods: ['info', 'debug', 'warn', 'error'],
        },
      ],
      logger
    );

    this.#llmAdapter = llmAdapter;
    this.#gameStateProvider = gameStateProvider;
    this.#promptContentProvider = promptContentProvider;
    this.#promptBuilder = promptBuilder;
    this.#logger = logger;

    this.#logger.debug('MoodUpdatePromptPipeline initialized.');
  }

  /**
   * Generates a mood-only prompt for Phase 1 of the two-phase flow.
   * This prompt requests only mood/sexual state updates without action selection.
   *
   * @param {Entity} actor - The actor entity.
   * @param {ITurnContext} context - Turn context.
   * @returns {Promise<string>} The formatted prompt string.
   * @throws {Error} If actor is missing or LLM ID cannot be determined.
   */
  async generateMoodUpdatePrompt(actor, context) {
    if (!actor) {
      const errorMsg =
        'MoodUpdatePromptPipeline.generateMoodUpdatePrompt: actor is required.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    const actorId = actor.id;
    this.#logger.debug(
      `MoodUpdatePromptPipeline: Generating mood update prompt for actor ${actorId}.`
    );

    const currentLlmId = await this.#llmAdapter.getCurrentActiveLlmId();
    if (!currentLlmId) {
      const errorMsg =
        'MoodUpdatePromptPipeline: Could not determine active LLM ID.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Build game state without available actions
    const gameStateDto = await this.#gameStateProvider.buildGameState(
      actor,
      context,
      this.#logger
    );

    // Get mood-specific prompt data (no actions)
    const promptData = await this.#promptContentProvider.getMoodUpdatePromptData(
      gameStateDto,
      this.#logger
    );

    const finalPromptString = await this.#promptBuilder.build(
      currentLlmId,
      promptData
    );

    if (!finalPromptString) {
      const errorMsg =
        'MoodUpdatePromptPipeline: PromptBuilder returned an empty or invalid prompt.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    this.#logger.debug(
      `MoodUpdatePromptPipeline: Generated mood update prompt for actor ${actorId} using LLM config for '${currentLlmId}'.`
    );

    return finalPromptString;
  }
}

// --- FILE END ---
