// src/turns/factories/actorAwareStrategyFactory.js
/**
 * @file Factory that chooses between human or AI decision providers
 * based on an actor's properties.
 */

import { ITurnStrategyFactory } from '../interfaces/ITurnStrategyFactory.js';
import { GenericTurnStrategy } from '../strategies/genericTurnStrategy.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../pipeline/turnActionChoicePipeline.js').TurnActionChoicePipeline} TurnActionChoicePipeline */
/** @typedef {import('../interfaces/ITurnDecisionProvider.js').ITurnDecisionProvider} ITurnDecisionProvider */
/** @typedef {import('../ports/ITurnActionFactory.js').ITurnActionFactory} ITurnActionFactory */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

export class ActorAwareStrategyFactory extends ITurnStrategyFactory {
  /** @type {ITurnDecisionProvider} */
  #humanProvider;
  /** @type {ITurnDecisionProvider} */
  #aiProvider;
  /** @type {ILogger} */
  #logger;
  /** @type {TurnActionChoicePipeline} */
  #choicePipeline;
  /** @type {ITurnActionFactory} */
  #turnActionFactory;
  /** @type {import('../interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory|null} */
  #fallbackFactory;
  /** @type {(id:string)=>any} */
  #actorLookup;

  /**
   * @param {object} deps
   * @param {ITurnDecisionProvider} deps.humanProvider
   * @param {ITurnDecisionProvider} deps.aiProvider
   * @param {ILogger} deps.logger
   * @param {TurnActionChoicePipeline} deps.choicePipeline
   * @param {ITurnActionFactory} deps.turnActionFactory
   * @param {import('../interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} [deps.fallbackFactory]
   * @param {(id:string)=>any} [deps.actorLookup]
   * @param {IEntityManager} [deps.entityManager]
   */
  constructor({
    humanProvider,
    aiProvider,
    logger,
    choicePipeline,
    turnActionFactory,
    fallbackFactory = null,
    actorLookup = null,
    entityManager = null,
  }) {
    super();
    if (!humanProvider)
      throw new Error('ActorAwareStrategyFactory: humanProvider is required');
    if (!aiProvider)
      throw new Error('ActorAwareStrategyFactory: aiProvider is required');
    if (!logger)
      throw new Error('ActorAwareStrategyFactory: logger is required');
    if (!choicePipeline)
      throw new Error('ActorAwareStrategyFactory: choicePipeline is required');
    if (!turnActionFactory)
      throw new Error(
        'ActorAwareStrategyFactory: turnActionFactory is required'
      );

    this.#humanProvider = humanProvider;
    this.#aiProvider = aiProvider;
    this.#logger = logger;
    this.#choicePipeline = choicePipeline;
    this.#turnActionFactory = turnActionFactory;
    this.#fallbackFactory = fallbackFactory;

    if (typeof actorLookup === 'function') {
      this.#actorLookup = actorLookup;
    } else if (
      entityManager &&
      typeof entityManager.getEntityInstance === 'function'
    ) {
      this.#actorLookup = (id) => entityManager.getEntityInstance(id);
    } else {
      throw new Error(
        'ActorAwareStrategyFactory: actorLookup callback or entityManager is required'
      );
    }
  }

  /**
   * Creates an appropriate GenericTurnStrategy for the given actor ID.
   *
   * @param {string} actorId
   * @returns {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy}
   */
  create(actorId) {
    const actor = this.#actorLookup(actorId);
    const isAi = actor && actor.isAi === true;
    const decisionProvider = isAi ? this.#aiProvider : this.#humanProvider;
    this.#logger.debug(
      `ActorAwareStrategyFactory: Creating GenericTurnStrategy for ${actorId} using ${isAi ? 'AI' : 'Human'} provider.`
    );
    return new GenericTurnStrategy({
      choicePipeline: this.#choicePipeline,
      decisionProvider,
      turnActionFactory: this.#turnActionFactory,
      logger: this.#logger,
      fallbackFactory: this.#fallbackFactory,
    });
  }
}
