// src/turns/factories/ConcreteAIPlayerStrategyFactory.js
// ****** MODIFIED FILE ******
import { IAIPlayerStrategyFactory } from '../interfaces/IAIPlayerStrategyFactory.js';
import { AIPlayerStrategy } from '../strategies/aiPlayerStrategy.js';

/**
 * @typedef {import('../interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter
 * @typedef {import('../../prompting/interfaces/IAIPromptPipeline.js').IAIPromptPipeline} IAIPromptPipeline
 * @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy
 * @typedef {import('../interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} IAIFallbackActionFactory
 */

/**
 * @class ConcreteAIPlayerStrategyFactory
 * @implements {IAIPlayerStrategyFactory}
 * @description
 * Concrete factory for creating AIPlayerStrategy instances. This factory
 * caches dependencies in its constructor to simplify strategy creation.
 */
export class ConcreteAIPlayerStrategyFactory extends IAIPlayerStrategyFactory {
  /** @type {ILLMAdapter} */
  #llmAdapter;
  /** @type {IAIPromptPipeline} */
  #aiPromptPipeline;
  /** @type {ILLMResponseProcessor} */
  #llmResponseProcessor;
  /** @type {IAIFallbackActionFactory} */
  #aiFallbackActionFactory;
  /** @type {ILogger} */
  #logger;

  /**
   * Constructs the factory and caches all necessary dependencies.
   *
   * @param {object} dependencies - The dependencies required by the AIPlayerStrategy.
   * @param {ILLMAdapter} dependencies.llmAdapter
   * @param {IAIPromptPipeline} dependencies.aiPromptPipeline
   * @param {ILLMResponseProcessor} dependencies.llmResponseProcessor
   * @param {IAIFallbackActionFactory} dependencies.aiFallbackActionFactory
   * @param {ILogger} dependencies.logger
   */
  constructor({
    llmAdapter,
    aiPromptPipeline,
    llmResponseProcessor,
    aiFallbackActionFactory,
    logger,
  }) {
    super();

    // Add robust validation for each dependency
    if (!llmAdapter)
      throw new Error('AIPlayerStrategyFactory: llmAdapter is required.');
    if (!aiPromptPipeline)
      throw new Error('AIPlayerStrategyFactory: aiPromptPipeline is required.');
    if (!llmResponseProcessor)
      throw new Error(
        'AIPlayerStrategyFactory: llmResponseProcessor is required.'
      );
    if (!aiFallbackActionFactory)
      throw new Error(
        'AIPlayerStrategyFactory: aiFallbackActionFactory is required.'
      );
    if (!logger)
      throw new Error('AIPlayerStrategyFactory: logger is required.');

    this.#llmAdapter = llmAdapter;
    this.#aiPromptPipeline = aiPromptPipeline;
    this.#llmResponseProcessor = llmResponseProcessor;
    this.#aiFallbackActionFactory = aiFallbackActionFactory;
    this.#logger = logger;
  }

  /**
   * Creates a new AIPlayerStrategy instance using the cached dependencies.
   * The method signature is now parameter-less.
   *
   * @returns {IActorTurnStrategy}
   */
  create() {
    return new AIPlayerStrategy({
      llmAdapter: this.#llmAdapter,
      aiPromptPipeline: this.#aiPromptPipeline,
      llmResponseProcessor: this.#llmResponseProcessor,
      aiFallbackActionFactory: this.#aiFallbackActionFactory,
      logger: this.#logger,
    });
  }
}
