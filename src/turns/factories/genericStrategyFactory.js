// src/turns/factories/genericStrategyFactory.js
/**
 * @file Contains the factory for creating GenericTurnStrategy instances.
 * @module turns/factories/GenericStrategyFactory
 */

import { GenericTurnStrategy } from '../strategies/genericTurnStrategy.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../pipeline/turnActionChoicePipeline.js').TurnActionChoicePipeline} TurnActionChoicePipeline */
/** @typedef {import('../interfaces/ITurnDecisionProvider.js').ITurnDecisionProvider} ITurnDecisionProvider */
/** @typedef {import('../ports/ITurnActionFactory.js').ITurnActionFactory} ITurnActionFactory */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy */

/** @typedef {import('../interfaces/ITurnStrategyFactory.js').ITurnStrategyFactory} ITurnStrategyFactory */

/**
 * @class GenericStrategyFactory
 * @implements {ITurnStrategyFactory}
 * @description A unified factory that creates instances of GenericTurnStrategy.
 * It is configured with a specific decision provider (e.g., for a human or an LLM)
 * at construction time.
 */
export class GenericStrategyFactory extends ITurnStrategyFactory {
  /** @type {TurnActionChoicePipeline} */
  #choicePipeline;
  /** @type {ITurnDecisionProvider} */
  #decisionProvider;
  /** @type {ITurnActionFactory} */
  #turnActionFactory;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {TurnActionChoicePipeline} deps.choicePipeline
   * @param {ITurnDecisionProvider} deps.decisionProvider
   * @param {ITurnActionFactory} deps.turnActionFactory
   * @param {ILogger} deps.logger
   */
  constructor({ choicePipeline, decisionProvider, turnActionFactory, logger }) {
    if (!choicePipeline) {
      throw new Error('GenericStrategyFactory: choicePipeline is required');
    }
    if (!decisionProvider) {
      throw new Error('GenericStrategyFactory: decisionProvider is required');
    }
    if (!turnActionFactory) {
      throw new Error('GenericStrategyFactory: turnActionFactory is required');
    }
    if (!logger) {
      throw new Error('GenericStrategyFactory: logger is required');
    }

    this.#choicePipeline = choicePipeline;
    this.#decisionProvider = decisionProvider;
    this.#turnActionFactory = turnActionFactory;
    this.#logger = logger;
  }

  /**
   * Creates a GenericTurnStrategy for an actor.
   *
   * @param {string} actorId - The ID of the actor for whom the strategy is being created.
   * @returns {IActorTurnStrategy} A new instance of the generic turn strategy.
   */
  create(actorId) {
    this.#logger.debug(
      `GenericStrategyFactory: Creating new GenericTurnStrategy for actor ${actorId} using ${this.#decisionProvider.constructor.name}.`
    );
    return new GenericTurnStrategy({
      choicePipeline: this.#choicePipeline,
      decisionProvider: this.#decisionProvider,
      turnActionFactory: this.#turnActionFactory,
      logger: this.#logger,
    });
  }
}
