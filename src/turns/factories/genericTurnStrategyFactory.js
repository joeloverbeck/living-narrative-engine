/**
 * @file Contains the concrete factory for creating GenericTurnStrategy instances.
 * @module turns/factories/genericTurnStrategyFactory
 */

import { ITurnStrategyFactory } from '../interfaces/ITurnStrategyFactory.js';
import { GenericTurnStrategy } from '../strategies/genericTurnStrategy.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../pipeline/turnActionChoicePipeline.js').TurnActionChoicePipeline} TurnActionChoicePipeline */
/** @typedef {import('../interfaces/ITurnDecisionProvider.js').ITurnDecisionProvider} IHumanDecisionProvider */

/** @typedef {import('../ports/ITurnActionFactory.js').ITurnActionFactory} ITurnActionFactory */

/**
 * @class GenericTurnStrategyFactory
 * @implements {ITurnStrategyFactory}
 * @description A concrete factory that creates instances of GenericTurnStrategy,
 * primarily for use by human-controlled actors. It bundles the
 * necessary dependencies for the strategy.
 */
export class GenericTurnStrategyFactory extends ITurnStrategyFactory {
  /** @type {TurnActionChoicePipeline} */
  #choicePipeline;
  /** @type {IHumanDecisionProvider} */
  #humanDecisionProvider;
  /** @type {ITurnActionFactory} */
  #turnActionFactory;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {TurnActionChoicePipeline} deps.choicePipeline
   * @param {IHumanDecisionProvider} deps.humanDecisionProvider
   * @param {ITurnActionFactory} deps.turnActionFactory
   * @param {ILogger} deps.logger
   */
  constructor({
    choicePipeline,
    humanDecisionProvider,
    turnActionFactory,
    logger,
  }) {
    super();
    if (!choicePipeline)
      throw new Error('GenericTurnStrategyFactory: choicePipeline is required');
    if (!humanDecisionProvider)
      throw new Error(
        'GenericTurnStrategyFactory: humanDecisionProvider is required'
      );
    if (!turnActionFactory)
      throw new Error(
        'GenericTurnStrategyFactory: turnActionFactory is required'
      );
    if (!logger)
      throw new Error('GenericTurnStrategyFactory: logger is required');

    this.#choicePipeline = choicePipeline;
    this.#humanDecisionProvider = humanDecisionProvider;
    this.#turnActionFactory = turnActionFactory;
    this.#logger = logger;
  }

  /**
   * Creates a GenericTurnStrategy for a human-controlled or LLM-controlled actor.
   *
   * @override
   * @param {string} actorId - The ID of the actor.
   * @returns {GenericTurnStrategy} A new instance of the generic turn strategy.
   */
  createForHuman(actorId) {
    this.#logger.debug(
      `GenericTurnStrategyFactory: Creating new GenericTurnStrategy for human actor ${actorId}.`
    );
    return new GenericTurnStrategy({
      choicePipeline: this.#choicePipeline,
      decisionProvider: this.#humanDecisionProvider, // Specifically the human one
      turnActionFactory: this.#turnActionFactory,
      logger: this.#logger,
    });
  }
}
