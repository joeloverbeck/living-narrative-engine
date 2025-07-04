// src/dependencyInjection/registrations/registerActorAwareStrategy.js
/**
 * @file Helper for registering the ActorAwareStrategyFactory and prerequisites.
 */

/** @typedef {import('../appContainer.js').default} AppContainer */

import { tokens } from '../tokens.js';
import { Registrar, resolveOptional } from '../../utils/registrarHelpers.js';
import { TurnActionChoicePipeline } from '../../turns/pipeline/turnActionChoicePipeline.js';
import { TurnActionFactory } from '../../turns/factories/turnActionFactory.js';
import { ActorAwareStrategyFactory } from '../../turns/factories/actorAwareStrategyFactory.js';

/**
 * Registers the ActorAwareStrategyFactory and supporting services if needed.
 *
 * @param {AppContainer} container - The DI container.
 */
export function registerActorAwareStrategy(container) {
  const registrar = new Registrar(container);
  const logger = container.resolve(tokens.ILogger);
  logger.debug('[registerActorAwareStrategy] Starting...');

  if (!container.isRegistered(tokens.TurnActionChoicePipeline)) {
    registrar.singletonFactory(tokens.TurnActionChoicePipeline, (c) => {
      return new TurnActionChoicePipeline({
        availableActionsProvider: c.resolve(tokens.IAvailableActionsProvider),
        logger: c.resolve(tokens.ILogger),
      });
    });
    logger.debug(
      `[registerActorAwareStrategy] Registered ${tokens.TurnActionChoicePipeline}.`
    );
  }

  if (!container.isRegistered(tokens.ITurnActionFactory)) {
    registrar.singletonFactory(
      tokens.ITurnActionFactory,
      () => new TurnActionFactory()
    );
    logger.debug(
      `[registerActorAwareStrategy] Registered ${tokens.ITurnActionFactory}.`
    );
  }

  if (!container.isRegistered(tokens.TurnStrategyFactory)) {
    registrar.singletonFactory(tokens.TurnStrategyFactory, (c) => {
      const opts = {
        providers: {
          human: c.resolve(tokens.IHumanDecisionProvider),
          llm: c.resolve(tokens.ILLMDecisionProvider),
          goap: c.resolve(tokens.IGoapDecisionProvider),
        },
        logger: c.resolve(tokens.ILogger),
        choicePipeline: c.resolve(tokens.TurnActionChoicePipeline),
        turnActionFactory: c.resolve(tokens.ITurnActionFactory),
        actorLookup: (id) =>
          c.resolve(tokens.IEntityManager).getEntityInstance(id),
      };
      const fallbackFactory = resolveOptional(
        c,
        tokens.IAIFallbackActionFactory
      );
      if (fallbackFactory) {
        opts.fallbackFactory = fallbackFactory;
      }
      opts.providerResolver = (actor) => {
        // Check new player_type component first
        if (actor?.components?.['core:player_type']) {
          const playerType = actor.components['core:player_type'].type;
          return playerType; // 'human', 'llm', or 'goap'
        }

        // Fallback to old detection methods
        const type = actor?.aiType ?? actor?.components?.ai?.type;
        if (typeof type === 'string') return type.toLowerCase();

        // Legacy check for isAi property
        if (actor?.isAi === true) return 'llm';

        // Legacy check for core:player component
        if (actor?.components?.['core:player']) return 'human';

        // Default to human for actors without explicit type
        return 'human';
      };
      return new ActorAwareStrategyFactory(opts);
    });
    logger.debug(
      `[registerActorAwareStrategy] Registered ${tokens.TurnStrategyFactory}.`
    );
  }

  logger.debug('[registerActorAwareStrategy] Completed.');
}
