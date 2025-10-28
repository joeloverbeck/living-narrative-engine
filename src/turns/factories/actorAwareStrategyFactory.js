// src/turns/factories/actorAwareStrategyFactory.js
/**
 * @file Factory that chooses between human or AI decision providers
 * based on an actor's properties.
 */

import { ITurnStrategyFactory } from '../interfaces/ITurnStrategyFactory.js';
import { GenericTurnStrategy } from '../strategies/genericTurnStrategy.js';

/**
 * Normalises raw values from the `core:player_type` component.
 *
 * @param {unknown} rawType - Raw type value read from component data.
 * @returns {string} Trimmed, lower-cased type identifier or an empty string when invalid.
 */
function normalisePlayerType(rawType) {
  if (typeof rawType !== 'string') {
    return '';
  }

  const trimmed = rawType.trim();
  return trimmed ? trimmed.toLowerCase() : '';
}

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
      // Check new player_type component first using Entity API
      if (actor && typeof actor.getComponentData === 'function') {
        try {
          const playerTypeData = actor.getComponentData('core:player_type');
          const normalisedType = normalisePlayerType(playerTypeData?.type);
          if (normalisedType) {
            return normalisedType;
          }
        } catch (error) {
          // If getComponentData throws, fall through to other checks
        }
      }

      // Fallback: Check if actor has components property (old style)
      if (actor?.components?.['core:player_type']) {
        const normalisedType = normalisePlayerType(
          actor.components['core:player_type'].type
        );
        if (normalisedType) {
          return normalisedType;
        }
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
    this.#logger.debug(
      `ActorAwareStrategyFactory: Actor lookup result for ${actorId}:`,
      {
        hasActor: !!actor,
        hasComponents: !!actor?.components,
        playerTypeComponent: actor?.components?.['core:player_type'],
        componentKeys: actor?.components ? Object.keys(actor.components) : [],
      }
    );
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
