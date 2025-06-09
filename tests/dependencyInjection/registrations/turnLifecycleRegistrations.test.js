/**
 * @file Test suite for turnLifecycleRegistrations.
 * @see tests/dependencyInjection/registrations/turnLifecycleRegistrations.test.js
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { mock } from 'jest-mock-extended';

// SUT and DI
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { registerTurnLifecycle } from '../../../src/dependencyInjection/registrations/turnLifecycleRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  INITIALIZABLE,
  SHUTDOWNABLE,
} from '../../../src/dependencyInjection/tags.js';

// Concrete Classes
import { TurnOrderService } from '../../../src/turns/order/turnOrderService.js';
import TurnManager from '../../../src/turns/turnManager.js';
import PlayerTurnHandler from '../../../src/turns/handlers/playerTurnHandler.js';
import TurnHandlerResolver from '../../../src/turns/services/turnHandlerResolver.js';
import HumanPlayerPromptService from '../../../src/turns/services/humanPlayerPromptService.js';
import { ConcreteTurnStateFactory } from '../../../src/turns/factories/concreteTurnStateFactory.js';
import { ConcreteAIPlayerStrategyFactory } from '../../../src/turns/factories/concreteAIPlayerStrategyFactory.js';
import { ConcreteTurnContextFactory } from '../../../src/turns/factories/concreteTurnContextFactory.js';

describe('registerTurnLifecycle', () => {
  let container;
  let mockLogger;
  let mockActionDiscovery;
  let mockPromptOutput;
  let mockWorldContext;
  let mockEntityManager;
  let mockGameDataRepo;
  let mockValidatedDispatcher;
  let mockSafeDispatcher;
  let mockCommandProcessor;
  let mockTurnEndPort;
  let mockCommandOutcome;
  let mockCommandInput;
  let mockAiTurnHandler;
  let registerSpy;

  beforeEach(() => {
    container = new AppContainer();
    registerSpy = jest.spyOn(container, 'register');

    // Core mocks
    mockLogger = mock();
    mockActionDiscovery = mock();
    mockPromptOutput = mock();
    mockWorldContext = mock();
    mockEntityManager = mock();
    mockGameDataRepo = mock();
    mockValidatedDispatcher = mock();
    mockSafeDispatcher = mock();
    mockCommandProcessor = mock();
    mockTurnEndPort = mock();
    mockCommandOutcome = mock();
    mockCommandInput = mock();
    mockAiTurnHandler = mock();

    // Register necessary dependencies
    container.register(tokens.ILogger, () => mockLogger);
    container.register(
      tokens.IActionDiscoveryService,
      () => mockActionDiscovery
    );
    container.register(tokens.IPromptOutputPort, () => mockPromptOutput);
    container.register(tokens.IWorldContext, () => mockWorldContext);
    container.register(tokens.IEntityManager, () => mockEntityManager);
    container.register(tokens.IGameDataRepository, () => mockGameDataRepo);
    container.register(
      tokens.IValidatedEventDispatcher,
      () => mockValidatedDispatcher
    );
    container.register(tokens.ISafeEventDispatcher, () => mockSafeDispatcher);
    container.register(tokens.ICommandProcessor, () => mockCommandProcessor);
    container.register(tokens.ITurnEndPort, () => mockTurnEndPort);
    container.register(
      tokens.ICommandOutcomeInterpreter,
      () => mockCommandOutcome
    );
    container.register(tokens.ICommandInputPort, () => mockCommandInput);
    container.register(tokens.AITurnHandler, () => mockAiTurnHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('logs registration steps in proper order', () => {
    registerTurnLifecycle(container);

    const calls = mockLogger.debug.mock.calls.map((c) => c[0]);
    expect(calls[0]).toBe('Turn Lifecycle Registration: Starting...');
    expect(calls).toContain(
      'Turn Lifecycle Registration: Registered Turn services and factories.'
    );
    expect(calls).toContain(
      `Turn Lifecycle Registration: Registered ${tokens.PlayerTurnHandler} tagged ${SHUTDOWNABLE.join(', ')}.`
    );
    expect(calls).toContain(
      `Turn Lifecycle Registration: Registered ${tokens.TurnHandlerResolver} with singleton resolution.`
    );
    expect(calls).toContain(
      `Turn Lifecycle Registration: Registered ${tokens.ITurnManager} tagged ${INITIALIZABLE.join(', ')}.`
    );
    expect(calls).toContain(
      `Turn Lifecycle Registration: Registered transient factory for ${tokens.ITurnContext}.`
    );
    expect(calls[calls.length - 1]).toBe(
      'Turn Lifecycle Registration: Completed.'
    );
  });

  const services = [
    {
      token: tokens.ITurnOrderService,
      Class: TurnOrderService,
      lifecycle: 'singletonFactory',
    },
    {
      token: tokens.ITurnStateFactory,
      Class: ConcreteTurnStateFactory,
      lifecycle: 'singleton',
    },
    {
      token: tokens.IAIPlayerStrategyFactory,
      Class: ConcreteAIPlayerStrategyFactory,
      lifecycle: 'singleton',
    },
    {
      token: tokens.ITurnContextFactory,
      Class: ConcreteTurnContextFactory,
      lifecycle: 'singleton',
    },
    {
      token: tokens.IPlayerPromptService,
      Class: HumanPlayerPromptService,
      lifecycle: 'singletonFactory',
    },
    {
      token: tokens.PlayerTurnHandler,
      Class: PlayerTurnHandler,
      lifecycle: 'singletonFactory',
      tags: SHUTDOWNABLE,
    },
    {
      token: tokens.TurnHandlerResolver,
      Class: TurnHandlerResolver,
      lifecycle: 'singletonFactory',
    },
    {
      token: tokens.ITurnManager,
      Class: TurnManager,
      lifecycle: 'singletonFactory',
      tags: INITIALIZABLE,
    },
    // ITurnContext is transient; it resolves to null by default
  ];

  test.each(services)(
    'registers $token correctly',
    ({ token, Class, lifecycle, tags }) => {
      registerTurnLifecycle(container);

      const instance = container.resolve(token);
      expect(instance).toBeInstanceOf(Class);

      // singleton vs singletonFactory all produce same instance
      expect(container.resolve(token)).toBe(instance);

      const call = registerSpy.mock.calls.find((c) => c[0] === token);
      expect(call).toBeDefined();
      const opts = call[2] || {};
      expect(opts.lifecycle).toBe(lifecycle);
      if (tags) expect(opts.tags).toEqual(tags);
      else expect(opts.tags).toBeUndefined();
    }
  );

  test('ITurnContext resolves to null by default', () => {
    registerTurnLifecycle(container);
    expect(() => container.resolve(tokens.ITurnContext)).not.toThrow();
    expect(container.resolve(tokens.ITurnContext)).toBeNull();
  });
});
