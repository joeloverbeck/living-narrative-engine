import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { registerTurnLifecycle } from '../../src/dependencyInjection/registrations/turnLifecycleRegistrations.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import TurnManager from '../../src/turns/turnManager.js';
import { TurnOrderService } from '../../src/turns/order/turnOrderService.js';
import TurnHandlerResolver from '../../src/turns/services/turnHandlerResolver.js';
import { ConcreteTurnStateFactory } from '../../src/turns/factories/concreteTurnStateFactory.js';

import ActorTurnHandler from '../../src/turns/handlers/actorTurnHandler.js';

describe('registerTurnLifecycle', () => {
  /** @type {AppContainer} */
  let container;

  beforeEach(() => {
    container = new AppContainer();
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    container.register(tokens.ILogger, logger);
    container.register(tokens.IActionDiscoveryService, {
      getValidActions: jest.fn(),
    });
    container.register(tokens.IPromptOutputPort, { prompt: jest.fn() });
    container.register(tokens.IWorldContext, {});
    container.register(tokens.IEntityManager, {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    });
    container.register(tokens.IGameDataRepository, {});
    container.register(tokens.IValidatedEventDispatcher, {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    });
    container.register(tokens.ISafeEventDispatcher, {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    });
    container.register(tokens.ICommandProcessor, {});
    container.register(tokens.ITurnEndPort, {});
    container.register(tokens.ICommandOutcomeInterpreter, {});
    container.register(
      tokens.ActorTurnHandler,
      () => new ActorTurnHandler({ logger })
    );
    container.register(tokens.IActionIndexer, {
      index: jest.fn(),
      indexActions: jest.fn(),
      resolve: jest.fn(),
      beginTurn: jest.fn(),
    });
    container.register(tokens.ITurnActionFactory, {});
    container.register(tokens.IAvailableActionsProvider, { get: jest.fn() });
  });

  it('registers and resolves turn lifecycle services', () => {
    registerTurnLifecycle(container);

    const manager1 = container.resolve(tokens.ITurnManager);
    const manager2 = container.resolve(tokens.ITurnManager);
    expect(manager1).toBeInstanceOf(TurnManager);
    expect(manager1).toBe(manager2); // singleton

    const resolver = container.resolve(tokens.TurnHandlerResolver);
    expect(resolver).toBeInstanceOf(TurnHandlerResolver);

    const stateFactory = container.resolve(tokens.ITurnStateFactory);
    expect(stateFactory).toBeInstanceOf(ConcreteTurnStateFactory);

    const provider1 = container.resolve(tokens.IHumanDecisionProvider);
    const provider2 = container.resolve(tokens.IHumanDecisionProvider);
    expect(provider1).not.toBe(provider2); // transient
  });
});
