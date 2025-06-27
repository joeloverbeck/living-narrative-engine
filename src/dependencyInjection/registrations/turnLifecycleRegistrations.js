// src/di/registrations/registerTurnLifecycle.js
/**
 * Registers core turn-lifecycle systems (player-agnostic).
 * Ensures ActionIndexingService is always present so PromptCoordinator
 * can resolve integer choices even when the AI setup hasn't been wired.
 */

import TurnManager from '../../turns/turnManager.js';
import TurnHandlerResolver from '../../turns/services/turnHandlerResolver.js';
import { TurnOrderService } from '../../turns/order/turnOrderService.js';
import PromptCoordinator from '../../turns/prompting/promptCoordinator.js';
import ActionContextBuilder from '../../turns/prompting/actionContextBuilder.js';
import ValidatedEventDispatcherAdapter from '../../turns/prompting/validatedEventDispatcherAdapter.js';
import { ConcreteTurnContextFactory } from '../../turns/factories/concreteTurnContextFactory.js';
import { ConcreteTurnStateFactory } from '../../turns/factories/concreteTurnStateFactory.js';

import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { INITIALIZABLE } from '../tags.js';
import {
  PLAYER_COMPONENT_ID,
  PLAYER_TYPE_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { HumanDecisionProvider } from '../../turns/providers/humanDecisionProvider.js';
import { TurnContextBuilder } from '../../turns/builders/turnContextBuilder.js';
import { assertValidEntity } from '../../utils/entityAssertionsUtils.js';

/**
 * @param {import('../appContainer.js').default} container
 */
export function registerTurnLifecycle(container) {
  const registrar = new Registrar(container);
  const logger = container.resolve(tokens.ILogger);
  logger.debug('Turn Lifecycle Registration: Starting...');

  // ───────────────────── Core singletons ─────────────────────
  registrar.singletonFactory(
    tokens.ITurnOrderService,
    (c) => new TurnOrderService({ logger: c.resolve(tokens.ILogger) })
  );
  registrar.singletonFactory(tokens.ITurnStateFactory, 
    (c) => new ConcreteTurnStateFactory({
      commandProcessor: c.resolve(tokens.ICommandProcessor),
      commandOutcomeInterpreter: c.resolve(tokens.ICommandOutcomeInterpreter)
    })
  );

  // ─────────────────── Turn-context factory ──────────────────
  registrar.singletonFactory(
    tokens.ITurnContextFactory,
    (c) =>
      new ConcreteTurnContextFactory({
        logger: c.resolve(tokens.ILogger),
        gameWorldAccess: c.resolve(tokens.IWorldContext),
        turnEndPort: c.resolve(tokens.ITurnEndPort),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        entityManager: c.resolve(tokens.IEntityManager),
      })
  );

  // ────────────────── Prompt-layer services ──────────────────
  registrar.singletonFactory(
    tokens.ActionContextBuilder,
    (c) =>
      new ActionContextBuilder({
        worldContext: c.resolve(tokens.IWorldContext),
        entityManager: c.resolve(tokens.IEntityManager),
        gameDataRepository: c.resolve(tokens.IGameDataRepository),
        logger: c.resolve(tokens.ILogger),
      })
  );

  registrar.singletonFactory(
    tokens.IPlayerTurnEvents,
    (c) =>
      new ValidatedEventDispatcherAdapter({
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
      })
  );

  registrar.singletonFactory(
    tokens.IPromptCoordinator,
    (c) =>
      new PromptCoordinator({
        logger: c.resolve(tokens.ILogger),
        promptOutputPort: c.resolve(tokens.IPromptOutputPort),
        actionIndexingService: c.resolve(tokens.IActionIndexer),
        playerTurnEvents: c.resolve(tokens.IPlayerTurnEvents),
      })
  );
  logger.debug(
    'Turn Lifecycle Registration: Registered Turn services and factories.'
  );

  registrar.transientFactory(
    tokens.IHumanDecisionProvider,
    (c) =>
      new HumanDecisionProvider({
        promptCoordinator: c.resolve(tokens.IPromptCoordinator),
        logger: c.resolve(tokens.ILogger),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );

  // ──────────────────── Validation Utils ─────────────────────
  registrar.singletonFactory(
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
  registrar.transientFactory(
    tokens.TurnContextBuilder,
    (c) =>
      new TurnContextBuilder({
        logger: c.resolve(tokens.ILogger),
        turnContextFactory: c.resolve(tokens.ITurnContextFactory),
        assertValidEntity: c.resolve(tokens.assertValidEntity),
      })
  );

  // ────────────────── Resolver & manager ──────────────────
  registrar.singletonFactory(
    tokens.TurnHandlerResolver,
    (c) =>
      new TurnHandlerResolver({
        logger: c.resolve(tokens.ILogger),
        handlerRules: [
          {
            name: 'Player',
            predicate: (actor) => {
              // Check new player_type component first
              if (actor.hasComponent(PLAYER_TYPE_COMPONENT_ID)) {
                const playerType = actor.getComponentData(PLAYER_TYPE_COMPONENT_ID);
                return playerType?.type === 'human';
              }
              // Fallback to old player component for backward compatibility
              return actor.hasComponent(PLAYER_COMPONENT_ID);
            },
            factory: () => c.resolve(tokens.ActorTurnHandler),
          },
          {
            name: 'AI',
            predicate: (actor) => actor.hasComponent(ACTOR_COMPONENT_ID),
            factory: () => c.resolve(tokens.ActorTurnHandler),
          },
        ],
      })
  );
  logger.debug(
    `Turn Lifecycle Registration: Registered ${tokens.TurnHandlerResolver} with singleton resolution.`
  );

  registrar.tagged(INITIALIZABLE).singletonFactory(
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
  registrar.transientFactory(tokens.ITurnContext, (c) => {
    const tm = c.resolve(tokens.ITurnManager);
    return tm?.getActiveTurnHandler?.()?.getTurnContext?.() ?? null;
  });
  logger.debug(
    `Turn Lifecycle Registration: Registered transient factory for ${tokens.ITurnContext}.`
  );

  logger.debug('Turn Lifecycle Registration: Completed.');
}
