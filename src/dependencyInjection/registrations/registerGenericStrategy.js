// src/dependencyInjection/registrations/registerGenericStrategy.js
/**
 * @file Helper for registering the GenericStrategyFactory and its prerequisites.
 */

/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../tokens.js').DiToken} DiToken */

import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { TurnActionChoicePipeline } from '../../turns/pipeline/turnActionChoicePipeline.js';
import { TurnActionFactory } from '../../turns/factories/turnActionFactory.js';
import { GenericStrategyFactory } from '../../turns/factories/genericStrategyFactory.js';

/**
 * Registers the {@link GenericStrategyFactory} and supporting services if needed.
 *
 * @param {AppContainer} container - The DI container.
 * @param {DiToken} decisionProviderToken - Token for the decision provider.
 * @returns {void}
 */
export function registerGenericStrategy(container, decisionProviderToken) {
  const r = new Registrar(container);
  const logger = container.resolve(tokens.ILogger);
  logger.debug('[registerGenericStrategy] Starting...');

  if (!container.isRegistered(tokens.TurnActionChoicePipeline)) {
    r.singletonFactory(tokens.TurnActionChoicePipeline, (c) => {
      return new TurnActionChoicePipeline({
        availableActionsProvider: c.resolve(tokens.IAvailableActionsProvider),
        logger: c.resolve(tokens.ILogger),
      });
    });
    logger.debug(
      `[registerGenericStrategy] Registered ${tokens.TurnActionChoicePipeline}.`
    );
  }

  if (!container.isRegistered(tokens.ITurnActionFactory)) {
    r.singletonFactory(
      tokens.ITurnActionFactory,
      () => new TurnActionFactory()
    );
    logger.debug(
      `[registerGenericStrategy] Registered ${tokens.ITurnActionFactory}.`
    );
  }

  if (!container.isRegistered(tokens.GenericStrategyFactory)) {
    r.singletonFactory(tokens.GenericStrategyFactory, (c) => {
      const opts = {
        choicePipeline: c.resolve(tokens.TurnActionChoicePipeline),
        decisionProvider: c.resolve(decisionProviderToken),
        turnActionFactory: c.resolve(tokens.ITurnActionFactory),
        logger: c.resolve(tokens.ILogger),
      };
      if (c.isRegistered(tokens.IAIFallbackActionFactory)) {
        opts.fallbackFactory = c.resolve(tokens.IAIFallbackActionFactory);
      }
      return new GenericStrategyFactory(opts);
    });
    logger.debug(
      `[registerGenericStrategy] Registered ${tokens.GenericStrategyFactory}.`
    );
  }

  logger.debug('[registerGenericStrategy] Completed.');
}
