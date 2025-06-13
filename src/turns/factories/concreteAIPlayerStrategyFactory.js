// src/turns/factories/ConcreteAIPlayerStrategyFactory.js

import { IAIPlayerStrategyFactory } from '../interfaces/IAIPlayerStrategyFactory.js';
import { GenericTurnStrategy } from '../strategies/genericTurnStrategy.js';

/**
 * @typedef {import('../pipeline/turnActionChoicePipeline.js').TurnActionChoicePipeline} TurnActionChoicePipeline
 * @typedef {import('../interfaces/ITurnDecisionProvider.js').ITurnDecisionProvider} ITurnDecisionProvider
 * @typedef {import('../ports/ITurnActionFactory.js').ITurnActionFactory} ITurnActionFactory
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @class ConcreteAIPlayerStrategyFactory
 * @implements {IAIPlayerStrategyFactory}
 * @description
 * Factory for creating GenericTurnStrategy instances.
 */
export class ConcreteAIPlayerStrategyFactory extends IAIPlayerStrategyFactory {
  /** @type {TurnActionChoicePipeline} */
  #choicePipeline;
  /** @type {ITurnDecisionProvider} */
  #llmProvider;
  /** @type {ITurnActionFactory} */
  #turnActionFactory;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {{
   *   choicePipeline: TurnActionChoicePipeline,
   *   llmProvider: ITurnDecisionProvider,
   *   turnActionFactory: ITurnActionFactory,
   *   logger: ILogger
   * }} deps
   */
  constructor({ choicePipeline, llmProvider, turnActionFactory, logger }) {
    super();

    if (!choicePipeline || typeof choicePipeline.buildChoices !== 'function') {
      throw new Error(
        'ConcreteAIPlayerStrategyFactory: choicePipeline is required and must implement buildChoices().'
      );
    }
    if (!llmProvider || typeof llmProvider.decide !== 'function') {
      throw new Error(
        'ConcreteAIPlayerStrategyFactory: llmProvider is required and must implement decide().'
      );
    }
    if (!turnActionFactory || typeof turnActionFactory.create !== 'function') {
      throw new Error(
        'ConcreteAIPlayerStrategyFactory: turnActionFactory is required and must implement create().'
      );
    }
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error(
        'ConcreteAIPlayerStrategyFactory: logger is required and must implement debug().'
      );
    }

    this.#choicePipeline = choicePipeline;
    this.#llmProvider = llmProvider;
    this.#turnActionFactory = turnActionFactory;
    this.#logger = logger;
  }

  /**
   * @returns {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy}
   */
  create() {
    return new GenericTurnStrategy({
      choicePipeline: this.#choicePipeline,
      decisionProvider: this.#llmProvider,
      turnActionFactory: this.#turnActionFactory,
      logger: this.#logger,
    });
  }
}
