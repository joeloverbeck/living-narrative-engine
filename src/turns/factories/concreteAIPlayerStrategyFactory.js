// src/turns/factories/ConcreteAIPlayerStrategyFactory.js
import { IAIPlayerStrategyFactory } from '../interfaces/IAIPlayerStrategyFactory.js';
import { AIPlayerStrategy } from '../strategies/aiPlayerStrategy.js';

/**
 * @typedef {import('../ports/IAIDecisionOrchestrator.js').IAIDecisionOrchestrator} IAIDecisionOrchestrator
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @class ConcreteAIPlayerStrategyFactory
 * @implements {IAIPlayerStrategyFactory}
 * @description
 * Factory for creating AIPlayerStrategy instances.
 * Injects only the IAIDecisionOrchestrator and ILogger that the strategy requires.
 */
export class ConcreteAIPlayerStrategyFactory extends IAIPlayerStrategyFactory {
  /** @type {IAIDecisionOrchestrator} */
  #orchestrator;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {{ orchestrator: IAIDecisionOrchestrator, logger: ILogger }} deps
   */
  constructor({ orchestrator, logger }) {
    super();

    if (!orchestrator || typeof orchestrator.decideOrFallback !== 'function') {
      throw new Error(
        'ConcreteAIPlayerStrategyFactory: orchestrator is required and must implement decideOrFallback().'
      );
    }
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error(
        'ConcreteAIPlayerStrategyFactory: logger is required and must implement debug().'
      );
    }

    this.#orchestrator = orchestrator;
    this.#logger = logger;
  }

  /**
   * @returns {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy}
   */
  create() {
    return new AIPlayerStrategy({
      orchestrator: this.#orchestrator,
      logger: this.#logger,
    });
  }
}
