// tests/dependencyInjection/registrations/turnLifecycleRegistrations.test.js

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
import { INITIALIZABLE } from '../../../src/dependencyInjection/tags.js';

// Concrete Classes
import { TurnOrderService } from '../../../src/turns/order/turnOrderService.js';
import TurnManager from '../../../src/turns/turnManager.js';
import TurnHandlerResolver from '../../../src/turns/services/turnHandlerResolver.js';
import { ConcreteTurnStateFactory } from '../../../src/turns/factories/concreteTurnStateFactory.js';
import { ConcreteTurnContextFactory } from '../../../src/turns/factories/concreteTurnContextFactory.js';
import PromptCoordinator from '../../../src/turns/prompting/promptCoordinator';

describe('registerTurnLifecycle', () => {
  let container;
  let registerSpy;
  let mockLogger,
    mockActionDiscovery,
    mockPromptOutput,
    mockWorldContext,
    mockEntityManager,
    mockGameDataRepo,
    mockValidatedDispatcher,
    mockSafeDispatcher,
    mockCommandProcessor,
    mockTurnEndPort,
    mockCommandOutcome,
    mockAiTurnHandler,
    mockActionIndexer,
    mockTurnActionFactory;

  beforeEach(() => {
    container = new AppContainer();
    registerSpy = jest.spyOn(container, 'register');

    // core mocks
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
    mockAiTurnHandler = mock();

    // register the bare‐minimum dependencies
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
    // stub out the Actor turn handler so that resolver factory has something to call
    mockAiTurnHandler = mock();
    container.register(tokens.ActorTurnHandler, () => mockAiTurnHandler);

    // Register a mock IActionIndexer for PromptCoordinator usage.

    // register action indexing interface for TurnActionChoicePipeline
    mockActionIndexer = mock();
    container.register(tokens.IActionIndexer, () => mockActionIndexer);

    // register turn action factory for ActorTurnHandler
    mockTurnActionFactory = mock();
    container.register(tokens.ITurnActionFactory, () => mockTurnActionFactory);

    container.register(tokens.IAvailableActionsProvider, () => ({
      get: jest.fn().mockResolvedValue([]),
    }));
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
      `Turn Lifecycle Registration: Registered ${tokens.TurnHandlerResolver} with singleton resolution.`
    );
    expect(calls).toContain(
      `Turn Lifecycle Registration: Registered ${tokens.ITurnManager} tagged ${INITIALIZABLE.join(
        ', '
      )}.`
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
      token: tokens.ITurnContextFactory,
      Class: ConcreteTurnContextFactory,
      lifecycle: 'singletonFactory',
    },
    {
      token: tokens.IPromptCoordinator,
      Class: PromptCoordinator,
      lifecycle: 'singletonFactory',
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
  ];

  test.each(services)(
    'registers $token correctly',
    ({ token, Class, lifecycle, tags }) => {
      registerTurnLifecycle(container);

      const instance = container.resolve(token);
      expect(instance).toBeInstanceOf(Class);

      const instance2 = container.resolve(token);
      expect(instance2).toBeInstanceOf(Class);
      if (lifecycle === 'transient') {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(instance2).not.toBe(instance);
      } else {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(instance2).toBe(instance);
      }

      const call = registerSpy.mock.calls.find((c) => c[0] === token);
      expect(call).toBeDefined();
      const opts = call[2] || {};
      expect(opts.lifecycle).toBe(lifecycle);

      const expectedTags = tags ?? undefined;
      expect(opts.tags).toEqual(expectedTags);
    }
  );

  test('ITurnContext resolves to null by default', () => {
    registerTurnLifecycle(container);
    expect(() => container.resolve(tokens.ITurnContext)).not.toThrow();
    expect(container.resolve(tokens.ITurnContext)).toBeNull();
  });
});
