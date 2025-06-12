// src/turns/factories/ConcreteAIPlayerStrategyFactory.js
import { IAIPlayerStrategyFactory } from '../interfaces/IAIPlayerStrategyFactory.js';
import { AIPlayerStrategy } from '../strategies/aiPlayerStrategy.js';

/**
 * @typedef {import('../interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter
 * @typedef {import('../../prompting/interfaces/IAIPromptPipeline.js').IAIPromptPipeline} IAIPromptPipeline
 * @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} IAIFallbackActionFactory
 * @typedef {import('../interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService
 * @typedef {import('../services/actionIndexingService.js').ActionIndexingService} ActionIndexingService
 * @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy
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
  /** @type {IActionDiscoveryService} */
  #actionDiscoveryService;
  /** @type {ActionIndexingService} */
  #actionIndexingService;
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
   * @param {IActionDiscoveryService} dependencies.actionDiscoveryService
   * @param {ActionIndexingService} dependencies.actionIndexingService
   * @param {ILogger} dependencies.logger
   */
  constructor({
    llmAdapter,
    aiPromptPipeline,
    llmResponseProcessor,
    aiFallbackActionFactory,
    actionDiscoveryService,
    actionIndexingService,
    logger,
  }) {
    super();

    if (!llmAdapter) throw new Error('llmAdapter is required.');
    if (!aiPromptPipeline) throw new Error('aiPromptPipeline is required.');
    if (!llmResponseProcessor)
      throw new Error('llmResponseProcessor is required.');
    if (!aiFallbackActionFactory)
      throw new Error('aiFallbackActionFactory is required.');
    if (!actionDiscoveryService)
      throw new Error('actionDiscoveryService is required.');
    if (!actionIndexingService)
      throw new Error('actionIndexingService is required.');
    if (!logger) throw new Error('logger is required.');

    this.#llmAdapter = llmAdapter;
    this.#aiPromptPipeline = aiPromptPipeline;
    this.#llmResponseProcessor = llmResponseProcessor;
    this.#aiFallbackActionFactory = aiFallbackActionFactory;
    this.#actionDiscoveryService = actionDiscoveryService;
    this.#actionIndexingService = actionIndexingService;
    this.#logger = logger;
  }

  /**
   * Creates a new AIPlayerStrategy instance using the cached dependencies.
   *
   * @returns {IActorTurnStrategy}
   */
  create() {
    return new AIPlayerStrategy({
      llmAdapter: this.#llmAdapter,
      aiPromptPipeline: this.#aiPromptPipeline,
      llmResponseProcessor: this.#llmResponseProcessor,
      aiFallbackActionFactory: this.#aiFallbackActionFactory,
      actionDiscoveryService: this.#actionDiscoveryService,
      actionIndexingService: this.#actionIndexingService,
      logger: this.#logger,
    });
  }
}
