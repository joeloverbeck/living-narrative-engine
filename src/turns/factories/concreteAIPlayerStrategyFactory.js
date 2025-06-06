// src/turns/factories/ConcreteAIPlayerStrategyFactory.js
// --- FILE START ---

import { IAIPlayerStrategyFactory } from '../interfaces/IAIPlayerStrategyFactory.js';
import { AIPlayerStrategy } from '../strategies/aiPlayerStrategy.js';

/**
 * @typedef {import('../interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter
 * @typedef {import('../interfaces/IAIGameStateProvider.js').IAIGameStateProvider} IAIGameStateProvider
 * @typedef {import('../interfaces/IAIPromptContentProvider.js').IAIPromptContentProvider} IAIPromptContentProvider
 * @typedef {import('../../interfaces/IPromptBuilder.js').IPromptBuilder} IPromptBuilder
 * @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy
 * @typedef {import('../interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} IAIFallbackActionFactory
 */

/**
 * @class ConcreteAIPlayerStrategyFactory
 * @implements {IAIPlayerStrategyFactory}
 * @description
 * Concrete factory for creating AI player turn strategies.
 */
export class ConcreteAIPlayerStrategyFactory extends IAIPlayerStrategyFactory {
  /**
   * Creates an AIPlayerStrategy instance.
   *
   * @param {object} dependencies - The dependencies required by the AI player strategy.
   * @param {ILLMAdapter} dependencies.llmAdapter
   * @param {IAIGameStateProvider} dependencies.gameStateProvider
   * @param {IAIPromptContentProvider} dependencies.promptContentProvider
   * @param {IPromptBuilder} dependencies.promptBuilder
   * @param {ILLMResponseProcessor} dependencies.llmResponseProcessor
   * @param {IAIFallbackActionFactory} dependencies.aiFallbackActionFactory
   * @param {ILogger} dependencies.logger
   * @returns {IActorTurnStrategy} The created AIPlayerStrategy.
   */
  create({
    llmAdapter,
    gameStateProvider,
    promptContentProvider,
    promptBuilder,
    llmResponseProcessor,
    aiFallbackActionFactory,
    logger,
  }) {
    return new AIPlayerStrategy({
      llmAdapter,
      gameStateProvider,
      promptContentProvider,
      promptBuilder,
      llmResponseProcessor,
      aiFallbackActionFactory,
      logger,
    });
  }
}

// --- FILE END ---
