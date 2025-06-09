/**
 * @file Registers core turn-based systems, including the TurnManager, PlayerTurnHandler, and the resolver that selects the active handler.
 * @see src/dependencyInjection/registrations/turnLifecycleRegistrations.js
 */

/* eslint-env node */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../turns/interfaces/ITurnManager.js').ITurnManager} ITurnManager */
/** @typedef {import('../../turns/interfaces/ITurnOrderService.js').ITurnOrderService} ITurnOrderService */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../commands/interfaces/ICommandProcessor.js').ICommandProcessor} ICommandProcessor */
/** @typedef {import('../../turns/ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../../turns/handlers/playerTurnHandler.js').default} PlayerTurnHandler_Concrete */
/** @typedef {import('../../turns/services/turnHandlerResolver.js').default} TurnHandlerResolver_Concrete */
/** @typedef {import('../../turns/interfaces/IHumanPlayerPromptService.js').IHumanPlayerPromptService} IPlayerPromptService */
/** @typedef {import('../../commands/interfaces/ICommandOutcomeInterpreter.js').ICommandOutcomeInterpreter} ICommandOutcomeInterpreter */
/** @typedef {import('../../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../turns/interfaces/factories/ITurnStateFactory.js').ITurnStateFactory} ITurnStateFactory */
/** @typedef {import('../../turns/interfaces/factories/IAIPlayerStrategyFactory.js').IAIPlayerStrategyFactory} IAIPlayerStrategyFactory */
/** @typedef {import('../../turns/interfaces/factories/ITurnContextFactory.js').ITurnContextFactory} ITurnContextFactory */
/** @typedef {import('../../interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService */
/** @typedef {import('../../turns/ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */

// --- System & Service Imports ---
import TurnManager from '../../turns/turnManager.js';
import PlayerTurnHandler from '../../turns/handlers/playerTurnHandler.js';
import TurnHandlerResolver from '../../turns/services/turnHandlerResolver.js';
import { TurnOrderService } from '../../turns/order/turnOrderService.js';
import HumanPlayerPromptService from '../../turns/services/humanPlayerPromptService.js';
import { ConcreteTurnContextFactory } from '../../turns/factories/concreteTurnContextFactory.js';
import { ConcreteAIPlayerStrategyFactory } from '../../turns/factories/concreteAIPlayerStrategyFactory.js';
import { ConcreteTurnStateFactory } from '../../turns/factories/concreteTurnStateFactory.js';

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { INITIALIZABLE, SHUTDOWNABLE } from '../tags.js';

/**
 * Registers turn lifecycle systems.
 *
 * @param {AppContainer} container - The DI container.
 */
export function registerTurnLifecycle(container) {
  const r = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('Turn Lifecycle Registration: Starting...');

  // --- Turn System Services & Factories ---

  r.singletonFactory(
    tokens.ITurnOrderService,
    (c) => new TurnOrderService({ logger: c.resolve(tokens.ILogger) })
  );
  r.single(tokens.ITurnStateFactory, ConcreteTurnStateFactory);
  r.single(tokens.IAIPlayerStrategyFactory, ConcreteAIPlayerStrategyFactory);
  r.single(tokens.ITurnContextFactory, ConcreteTurnContextFactory);

  r.singletonFactory(tokens.IPlayerPromptService, (c) => {
    return new HumanPlayerPromptService({
      logger: c.resolve(tokens.ILogger),
      actionDiscoverySystem: c.resolve(tokens.IActionDiscoveryService),
      promptOutputPort: c.resolve(tokens.IPromptOutputPort),
      worldContext: c.resolve(tokens.IWorldContext),
      entityManager: c.resolve(tokens.IEntityManager),
      gameDataRepository: c.resolve(tokens.IGameDataRepository),
      validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
    });
  });

  logger.debug(
    `Turn Lifecycle Registration: Registered Turn services and factories.`
  );

  // --- Player Turn Handler ---

  r.tagged(SHUTDOWNABLE).transientFactory(
    // ⬅️  was singletonFactory
    tokens.PlayerTurnHandler,
    (c) =>
      new PlayerTurnHandler({
        logger: c.resolve(tokens.ILogger),
        turnStateFactory: c.resolve(tokens.ITurnStateFactory),
        commandProcessor: c.resolve(tokens.ICommandProcessor),
        turnEndPort: c.resolve(tokens.ITurnEndPort),
        playerPromptService: c.resolve(tokens.IPlayerPromptService),
        commandOutcomeInterpreter: c.resolve(tokens.ICommandOutcomeInterpreter),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      })
  );
  logger.debug(
    `Turn Lifecycle Registration: Registered ${tokens.PlayerTurnHandler} tagged ${SHUTDOWNABLE.join(', ')}.`
  );

  // --- Turn Handler Resolver (Corrected Logic) ---

  r.singletonFactory(tokens.TurnHandlerResolver, (c) => {
    // This corrected implementation resolves the singleton handlers from the container,
    // avoiding duplication and respecting the singleton pattern.
    const createPlayerHandlerFactory = () =>
      c.resolve(tokens.PlayerTurnHandler);
    const createAiHandlerFactory = () => c.resolve(tokens.AITurnHandler);

    return new TurnHandlerResolver({
      logger: c.resolve(tokens.ILogger),
      createPlayerTurnHandler: createPlayerHandlerFactory,
      createAiTurnHandler: createAiHandlerFactory,
    });
  });
  logger.debug(
    `Turn Lifecycle Registration: Registered ${tokens.TurnHandlerResolver} with singleton resolution.`
  );

  // --- Turn Manager ---

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
    `Turn Lifecycle Registration: Registered ${tokens.ITurnManager} tagged ${INITIALIZABLE.join(', ')}.`
  );

  // --- Turn Context Provider ---

  r.transientFactory(tokens.ITurnContext, (c) => {
    const turnManager = c.resolve(tokens.ITurnManager);
    if (!turnManager) {
      return null;
    }
    const activeHandler = turnManager.getActiveTurnHandler();
    if (activeHandler && typeof activeHandler.getTurnContext === 'function') {
      return activeHandler.getTurnContext();
    }
    return null;
  });
  logger.debug(
    `Turn Lifecycle Registration: Registered transient factory for ${tokens.ITurnContext}.`
  );

  logger.debug('Turn Lifecycle Registration: Completed.');
}
