// src/dependencyInjection/registrations/registerActorAwareStrategy.js
/**
 * @file Helper for registering the ActorAwareStrategyFactory and prerequisites.
 */

/** @typedef {import('../appContainer.js').default} AppContainer */

import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { TurnActionChoicePipeline } from '../../turns/pipeline/turnActionChoicePipeline.js';
import { TurnActionFactory } from '../../turns/factories/turnActionFactory.js';
import { ActorAwareStrategyFactory } from '../../turns/factories/actorAwareStrategyFactory.js';

/**
 * Registers the ActorAwareStrategyFactory and supporting services if needed.
 *
 * @param {AppContainer} container - The DI container.
 */
export function registerActorAwareStrategy(container) {
  const r = new Registrar(container);
  const logger = container.resolve(tokens.ILogger);
  logger.debug('[registerActorAwareStrategy] Starting...');

  if (!container.isRegistered(tokens.TurnActionChoicePipeline)) {
    r.singletonFactory(tokens.TurnActionChoicePipeline, (c) => {
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
    r.singletonFactory(
      tokens.ITurnActionFactory,
      () => new TurnActionFactory()
    );
    logger.debug(
      `[registerActorAwareStrategy] Registered ${tokens.ITurnActionFactory}.`
    );
  }

  if (!container.isRegistered(tokens.TurnStrategyFactory)) {
    r.singletonFactory(tokens.TurnStrategyFactory, (c) => {
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
      if (c.isRegistered(tokens.IAIFallbackActionFactory)) {
        opts.fallbackFactory = c.resolve(tokens.IAIFallbackActionFactory);
      }
      opts.providerResolver = (actor) => {
        const type = actor?.aiType ?? actor?.components?.ai?.type;
        if (typeof type === 'string') return type.toLowerCase();
        return actor?.isAi === true ? 'llm' : 'human';
      };
      return new ActorAwareStrategyFactory(opts);
    });
    logger.debug(
      `[registerActorAwareStrategy] Registered ${tokens.TurnStrategyFactory}.`
    );
  }

  logger.debug('[registerActorAwareStrategy] Completed.');
}
