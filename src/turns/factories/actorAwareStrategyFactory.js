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
  /** @type {Record<string, ITurnDecisionProvider>} */
  #providers;
  /** @type {(actor:any)=>string} */
  #providerResolver;
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
   * @param {Record<string, ITurnDecisionProvider>} [deps.providers]
   *        Map of provider keys to decision providers.
   * @param {(actor:any)=>string} [deps.providerResolver]
   *        Resolves an actor to a provider key. Defaults to checking
   *        `actor.aiType` or falling back to `actor.isAi`.
   * @param {ILogger} deps.logger
   * @param {TurnActionChoicePipeline} deps.choicePipeline
   * @param {ITurnActionFactory} deps.turnActionFactory
   * @param {import('../interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} [deps.fallbackFactory]
   * @param {(id:string)=>any} [deps.actorLookup]
   * @param {IEntityManager} [deps.entityManager]
   * @param {ITurnDecisionProvider} [deps.humanProvider] Legacy provider for humans.
   * @param {ITurnDecisionProvider} [deps.aiProvider] Legacy provider for AI (llm).
   */
  constructor({
    providers = null,
    providerResolver = (actor) => {
      // Check new player_type component first
      if (actor?.components?.['core:player_type']) {
        return actor.components['core:player_type'].type;
      }

      // Check legacy aiType or ai component
      const type = actor?.aiType ?? actor?.components?.ai?.type;
      if (typeof type === 'string') return type.toLowerCase();

      // Check legacy isAi property
      if (actor?.isAi === true) return 'llm';

      // Default to human for actors without explicit type
      return 'human';
    },
    logger,
    choicePipeline,
    turnActionFactory,
    fallbackFactory = null,
    actorLookup = null,
    entityManager = null,
    humanProvider = null,
    aiProvider = null,
  }) {
    super();
    if (!providers) {
      if (humanProvider && aiProvider) {
        providers = { human: humanProvider, llm: aiProvider };
      } else {
        throw new Error('ActorAwareStrategyFactory: providers map is required');
      }
    }
    if (typeof providerResolver !== 'function')
      throw new Error(
        'ActorAwareStrategyFactory: providerResolver must be a function'
      );
    if (!logger)
      throw new Error('ActorAwareStrategyFactory: logger is required');
    if (!choicePipeline)
      throw new Error('ActorAwareStrategyFactory: choicePipeline is required');
    if (!turnActionFactory)
      throw new Error(
        'ActorAwareStrategyFactory: turnActionFactory is required'
      );

    this.#providers = providers;
    this.#providerResolver = providerResolver;
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
    const type = this.#providerResolver(actor);
    const decisionProvider = this.#providers[type];
    if (!decisionProvider) {
      throw new Error(
        `ActorAwareStrategyFactory: No decision provider for actor type "${type}"`
      );
    }
    this.#logger.debug(
      `ActorAwareStrategyFactory: Creating GenericTurnStrategy for ${actorId} using provider type ${type}.`
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
