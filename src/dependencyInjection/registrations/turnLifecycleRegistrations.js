// src/di/registrations/registerTurnLifecycle.js
/**
 * Registers core turn-lifecycle systems (player-agnostic).
 * Ensures ActionIndexingService is always present so PromptCoordinator
 * can resolve integer choices even when the AI setup hasn’t been wired.
 */

import TurnManager from '../../turns/turnManager.js';
import HumanTurnHandler from '../../turns/handlers/humanTurnHandler.js';
import TurnHandlerResolver from '../../turns/services/turnHandlerResolver.js';
import { TurnOrderService } from '../../turns/order/turnOrderService.js';
import PromptCoordinator from '../../turns/prompting/promptCoordinator.js';
import ActionContextBuilder from '../../turns/prompting/actionContextBuilder.js';
import ValidatedEventDispatcherAdapter from '../../turns/prompting/validatedEventDispatcherAdapter.js';
import { ConcreteTurnContextFactory } from '../../turns/factories/concreteTurnContextFactory.js';
import { ConcreteTurnStateFactory } from '../../turns/factories/concreteTurnStateFactory.js';

import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { INITIALIZABLE, SHUTDOWNABLE } from '../tags.js';
import {
  PLAYER_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { HumanDecisionProvider } from '../../turns/providers/humanDecisionProvider.js';
import { TurnContextBuilder } from '../../turns/builders/turnContextBuilder.js';
import { assertValidEntity } from '../../utils/entityAssertions.js';
import { registerGenericStrategy } from './registerGenericStrategy.js';

/**
 * @param {import('../appContainer.js').default} container
 */
export function registerTurnLifecycle(container) {
  const r = new Registrar(container);
  const logger = container.resolve(tokens.ILogger);
  logger.debug('Turn Lifecycle Registration: Starting...');

  // ───────────────────── Core singletons ─────────────────────
  r.singletonFactory(
    tokens.ITurnOrderService,
    (c) => new TurnOrderService({ logger: c.resolve(tokens.ILogger) })
  );
  r.single(tokens.ITurnStateFactory, ConcreteTurnStateFactory);

  // ─────────────────── Turn-context factory ──────────────────
  r.singletonFactory(
    tokens.ITurnContextFactory,
    (c) =>
      new ConcreteTurnContextFactory({
        logger: c.resolve(tokens.ILogger),
        gameWorldAccess: c.resolve(tokens.IWorldContext),
        turnEndPort: c.resolve(tokens.ITurnEndPort),
        commandProcessor: c.resolve(tokens.ICommandProcessor),
        commandOutcomeInterpreter: c.resolve(tokens.ICommandOutcomeInterpreter),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        entityManager: c.resolve(tokens.IEntityManager),
        actionDiscoverySystem: c.resolve(tokens.IActionDiscoveryService),
      })
  );

  // ────────────────── Prompt-layer services ──────────────────
  r.singletonFactory(
    tokens.ActionContextBuilder,
    (c) =>
      new ActionContextBuilder({
        worldContext: c.resolve(tokens.IWorldContext),
        entityManager: c.resolve(tokens.IEntityManager),
        gameDataRepository: c.resolve(tokens.IGameDataRepository),
        logger: c.resolve(tokens.ILogger),
      })
  );

  r.singletonFactory(
    tokens.IPlayerTurnEvents,
    (c) =>
      new ValidatedEventDispatcherAdapter({
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
      })
  );

  r.singletonFactory(
    tokens.IPromptCoordinator,
    (c) =>
      new PromptCoordinator({
        logger: c.resolve(tokens.ILogger),
        promptOutputPort: c.resolve(tokens.IPromptOutputPort),
        actionIndexingService: c.resolve(tokens.ActionIndexingService),
        playerTurnEvents: c.resolve(tokens.IPlayerTurnEvents),
      })
  );
  logger.debug(
    'Turn Lifecycle Registration: Registered Turn services and factories.'
  );

  r.transientFactory(
    tokens.IHumanDecisionProvider,
    (c) =>
      new HumanDecisionProvider({
        promptCoordinator: c.resolve(tokens.IPromptCoordinator),
        logger: c.resolve(tokens.ILogger),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );

  // ────────────────── Turn Strategy Factory ──────────────────
  registerGenericStrategy(
    container,
    tokens.IHumanDecisionProvider,
    tokens.HumanStrategyFactory
  );

  // ──────────────────── Validation Utils ─────────────────────
  r.singletonFactory(
    tokens.assertValidEntity,
    (c) => (entity, logger, contextName) =>
      assertValidEntity(
        entity,
        logger,
        contextName,
        c.resolve(tokens.ISafeEventDispatcher)
      )
  );

  // ───────────────── Turn Context Builder ────────────────────
  r.transientFactory(
    tokens.TurnContextBuilder,
    (c) =>
      new TurnContextBuilder({
        logger: c.resolve(tokens.ILogger),
        turnContextFactory: c.resolve(tokens.ITurnContextFactory),
        assertValidEntity: c.resolve(tokens.assertValidEntity),
      })
  );

  // ─────────────────── Player handler ────────────────────
  r.tagged(SHUTDOWNABLE).transientFactory(
    tokens.HumanTurnHandler,
    (c) =>
      new HumanTurnHandler({
        logger: c.resolve(tokens.ILogger),
        turnStateFactory: c.resolve(tokens.ITurnStateFactory),
        commandProcessor: c.resolve(tokens.ICommandProcessor),
        turnEndPort: c.resolve(tokens.ITurnEndPort),
        promptCoordinator: c.resolve(tokens.IPromptCoordinator),
        commandOutcomeInterpreter: c.resolve(tokens.ICommandOutcomeInterpreter),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        turnStrategyFactory: c.resolve(tokens.HumanStrategyFactory), // <-- Injected factory
        entityManager: c.resolve(tokens.IEntityManager),
        turnContextBuilder: c.resolve(tokens.TurnContextBuilder), // <-- Injected builder
      })
  );
  logger.debug(
    `Turn Lifecycle Registration: Registered HumanTurnHandler with new strategy deps tagged ${SHUTDOWNABLE.join(
      ', '
    )}.`
  );

  // ────────────────── Resolver & manager ──────────────────
  r.singletonFactory(
    tokens.TurnHandlerResolver,
    (c) =>
      new TurnHandlerResolver({
        logger: c.resolve(tokens.ILogger),
        handlerRules: [
          {
            name: 'Player',
            predicate: (actor) => actor.hasComponent(PLAYER_COMPONENT_ID),
            factory: () => c.resolve(tokens.HumanTurnHandler),
          },
          {
            name: 'AI',
            predicate: (actor) => actor.hasComponent(ACTOR_COMPONENT_ID),
            factory: () => c.resolve(tokens.AITurnHandler),
          },
        ],
      })
  );
  logger.debug(
    `Turn Lifecycle Registration: Registered ${tokens.TurnHandlerResolver} with singleton resolution.`
  );

  r.tagged(INITIALIZABLE).singletonFactory(
    tokens.ITurnManager,
    (c) =>
      new TurnManager({
        turnOrderService: c.resolve(tokens.ITurnOrderService),
        entityManager: c.resolve(tokens.IEntityManager),
        logger: c.resolve(tokens.ILogger),
        dispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        turnHandlerResolver: c.resolve(tokens.TurnHandlerResolver),
      })
  );
  logger.debug(
    `Turn Lifecycle Registration: Registered ${tokens.ITurnManager} tagged ${INITIALIZABLE.join(
      ', '
    )}.`
  );

  // ─────────────── ITurnContext façade (read-only) ───────────────
  r.transientFactory(tokens.ITurnContext, (c) => {
    const tm = c.resolve(tokens.ITurnManager);
    return tm?.getActiveTurnHandler?.()?.getTurnContext?.() ?? null;
  });
  logger.debug(
    `Turn Lifecycle Registration: Registered transient factory for ${tokens.ITurnContext}.`
  );

  logger.debug('Turn Lifecycle Registration: Completed.');
}
