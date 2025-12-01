/**
 * @file Unit tests for turnLifecycleRegistrations module.
 * @see tests/unit/dependencyInjection/registrations/turnLifecycleRegistrations.test.js
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

// SUT
import { registerTurnLifecycle } from '../../../../src/dependencyInjection/registrations/turnLifecycleRegistrations.js';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { INITIALIZABLE } from '../../../../src/dependencyInjection/tags.js';

// Constants for testing
import {
  PLAYER_COMPONENT_ID,
  PLAYER_TYPE_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

describe('registerTurnLifecycle - Unit Tests', () => {
  let container;
  let mockLogger;
  let mockDependencies;
  let resolveCalls;

  beforeEach(() => {
    container = new AppContainer();
    mockLogger = mock();
    mockDependencies = {};
    resolveCalls = [];

    // Track resolve calls
    const originalResolve = container.resolve.bind(container);
    container.resolve = jest.fn((token) => {
      resolveCalls.push(token);
      return originalResolve(token);
    });

    // Optional tryResolve method
    container.tryResolve = jest.fn((token) => {
      try {
        return container.resolve(token);
      } catch {
        return undefined;
      }
    });

    // Pre-register the logger
    container.register(tokens.ILogger, () => mockLogger);

    // Create all required mock dependencies
    mockDependencies = {
      logger: mockLogger,
      commandProcessor: mock(),
      commandOutcomeInterpreter: mock(),
      commandDispatcher: mock(),
      resultInterpreter: mock(),
      directiveExecutor: mock(),
      gameWorldAccess: mock(),
      turnEndPort: mock(),
      safeEventDispatcher: mock(),
      entityManager: mock(),
      gameDataRepository: mock(),
      validatedEventDispatcher: mock(),
      promptOutputPort: mock(),
      actionIndexingService: mock(),
      promptCoordinator: mock(),
      turnOrderService: mock(),
      turnHandlerResolver: mock(),
      turnContextFactory: mock(),
      turnStateFactory: mock(),
      actorTurnHandler: { startTurn: jest.fn() },
    };

    // Register all dependencies
    container.register(
      tokens.ICommandProcessor,
      () => mockDependencies.commandProcessor
    );
    container.register(
      tokens.ICommandOutcomeInterpreter,
      () => mockDependencies.commandOutcomeInterpreter
    );
    container.register(
      tokens.CommandDispatcher,
      () => mockDependencies.commandDispatcher
    );
    container.register(
      tokens.ResultInterpreter,
      () => mockDependencies.resultInterpreter
    );
    container.register(
      tokens.DirectiveExecutor,
      () => mockDependencies.directiveExecutor
    );
    container.register(
      tokens.IWorldContext,
      () => mockDependencies.gameWorldAccess
    );
    container.register(tokens.ITurnEndPort, () => mockDependencies.turnEndPort);
    container.register(
      tokens.ISafeEventDispatcher,
      () => mockDependencies.safeEventDispatcher
    );
    container.register(
      tokens.IEntityManager,
      () => mockDependencies.entityManager
    );
    container.register(
      tokens.IGameDataRepository,
      () => mockDependencies.gameDataRepository
    );
    container.register(
      tokens.IValidatedEventDispatcher,
      () => mockDependencies.validatedEventDispatcher
    );
    container.register(
      tokens.IPromptOutputPort,
      () => mockDependencies.promptOutputPort
    );
    container.register(
      tokens.IActionIndexer,
      () => mockDependencies.actionIndexingService
    );
    container.register(
      tokens.ActorTurnHandler,
      () => mockDependencies.actorTurnHandler
    );
    // Add missing IEventBus registration (required by TurnManager)
    mockDependencies.eventBus = mock();
    container.register(tokens.IEventBus, () => mockDependencies.eventBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('registers all turn lifecycle services', () => {
    registerTurnLifecycle(container);

    // Verify all services are registered
    expect(() => container.resolve(tokens.ITurnOrderService)).not.toThrow();
    expect(() => container.resolve(tokens.ITurnStateFactory)).not.toThrow();
    expect(() => container.resolve(tokens.ITurnContextFactory)).not.toThrow();
    expect(() => container.resolve(tokens.ActionContextBuilder)).not.toThrow();
    expect(() => container.resolve(tokens.IPlayerTurnEvents)).not.toThrow();
    expect(() => container.resolve(tokens.IPromptCoordinator)).not.toThrow();
    expect(() =>
      container.resolve(tokens.IHumanDecisionProvider)
    ).not.toThrow();
    expect(() => container.resolve(tokens.assertValidEntity)).not.toThrow();
    expect(() => container.resolve(tokens.TurnContextBuilder)).not.toThrow();
    expect(() => container.resolve(tokens.TurnHandlerResolver)).not.toThrow();
    expect(() => container.resolve(tokens.ITurnManager)).not.toThrow();
    expect(() => container.resolve(tokens.ITurnContext)).not.toThrow();
  });

  describe('ITurnOrderService factory', () => {
    test('creates TurnOrderService with correct dependencies', () => {
      registerTurnLifecycle(container);

      const service = container.resolve(tokens.ITurnOrderService);
      expect(service).toBeDefined();
      expect(service.constructor.name).toBe('TurnOrderService');
    });

    test('factory function passes logger dependency', () => {
      // Spy on the constructor
      const TurnOrderService = jest.fn(function () {});
      jest.doMock('../../../../src/turns/order/turnOrderService.js', () => ({
        TurnOrderService,
      }));

      registerTurnLifecycle(container);
      container.resolve(tokens.ITurnOrderService);

      // Verify logger was passed
      expect(resolveCalls).toContain(tokens.ILogger);
    });
  });

  describe('ITurnStateFactory factory', () => {
    test('creates ConcreteTurnStateFactory with required dependencies', () => {
      registerTurnLifecycle(container);

      const factory = container.resolve(tokens.ITurnStateFactory);
      expect(factory).toBeDefined();
      expect(factory.constructor.name).toBe('ConcreteTurnStateFactory');
    });

    test('factory function resolves optional dependencies using tryResolve', () => {
      // Remove optional dependencies to test tryResolve
      container.register(tokens.CommandDispatcher, null);
      container.register(tokens.ResultInterpreter, null);
      container.register(tokens.DirectiveExecutor, null);

      registerTurnLifecycle(container);

      // Should not throw even with missing optional dependencies
      expect(() => container.resolve(tokens.ITurnStateFactory)).not.toThrow();

      // Verify tryResolve was called for optional dependencies
      expect(container.tryResolve).toHaveBeenCalledWith(
        tokens.CommandDispatcher
      );
      expect(container.tryResolve).toHaveBeenCalledWith(
        tokens.ResultInterpreter
      );
      expect(container.tryResolve).toHaveBeenCalledWith(
        tokens.DirectiveExecutor
      );
    });
  });

  describe('ITurnContextFactory factory', () => {
    test('creates ConcreteTurnContextFactory with all dependencies', () => {
      registerTurnLifecycle(container);

      const factory = container.resolve(tokens.ITurnContextFactory);
      expect(factory).toBeDefined();
      expect(factory.constructor.name).toBe('ConcreteTurnContextFactory');

      // Verify all dependencies were resolved
      expect(resolveCalls).toContain(tokens.ILogger);
      expect(resolveCalls).toContain(tokens.IWorldContext);
      expect(resolveCalls).toContain(tokens.ITurnEndPort);
      expect(resolveCalls).toContain(tokens.ISafeEventDispatcher);
      expect(resolveCalls).toContain(tokens.IEntityManager);
      expect(resolveCalls).toContain(tokens.IPromptCoordinator);
    });
  });

  describe('ActionContextBuilder factory', () => {
    test('creates ActionContextBuilder with correct dependencies', () => {
      registerTurnLifecycle(container);

      const builder = container.resolve(tokens.ActionContextBuilder);
      expect(builder).toBeDefined();
      expect(builder.constructor.name).toBe('ActionContextBuilder');

      // Verify dependencies
      expect(resolveCalls).toContain(tokens.IWorldContext);
      expect(resolveCalls).toContain(tokens.IEntityManager);
      expect(resolveCalls).toContain(tokens.IGameDataRepository);
      expect(resolveCalls).toContain(tokens.ILogger);
    });
  });

  describe('IPlayerTurnEvents factory', () => {
    test('creates ValidatedEventDispatcherAdapter', () => {
      registerTurnLifecycle(container);

      const events = container.resolve(tokens.IPlayerTurnEvents);
      expect(events).toBeDefined();
      expect(events.constructor.name).toBe('ValidatedEventDispatcherAdapter');

      // Verify dependency
      expect(resolveCalls).toContain(tokens.IValidatedEventDispatcher);
    });
  });

  describe('IPromptCoordinator factory', () => {
    test('creates PromptCoordinator with all dependencies', () => {
      registerTurnLifecycle(container);

      const coordinator = container.resolve(tokens.IPromptCoordinator);
      expect(coordinator).toBeDefined();
      expect(coordinator.constructor.name).toBe('PromptCoordinator');

      // Verify all dependencies
      expect(resolveCalls).toContain(tokens.ILogger);
      expect(resolveCalls).toContain(tokens.IPromptOutputPort);
      expect(resolveCalls).toContain(tokens.IActionIndexer);
      expect(resolveCalls).toContain(tokens.IPlayerTurnEvents);
    });
  });

  describe('IHumanDecisionProvider factory', () => {
    test('creates HumanDecisionProvider with dependencies', () => {
      registerTurnLifecycle(container);

      const provider = container.resolve(tokens.IHumanDecisionProvider);
      expect(provider).toBeDefined();
      expect(provider.constructor.name).toBe('HumanDecisionProvider');

      // Verify dependencies
      expect(resolveCalls).toContain(tokens.IPromptCoordinator);
      expect(resolveCalls).toContain(tokens.ILogger);
      expect(resolveCalls).toContain(tokens.ISafeEventDispatcher);
    });

    test('is registered as transient', () => {
      registerTurnLifecycle(container);

      const instance1 = container.resolve(tokens.IHumanDecisionProvider);
      const instance2 = container.resolve(tokens.IHumanDecisionProvider);

      // Transient services should return different instances
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('assertValidEntity factory', () => {
    test('creates function that uses assertValidEntity utility', () => {
      registerTurnLifecycle(container);

      const assertFunc = container.resolve(tokens.assertValidEntity);
      expect(assertFunc).toBeDefined();
      expect(typeof assertFunc).toBe('function');

      // The factory itself doesn't resolve ISafeEventDispatcher immediately
      // It's resolved when creating the closure
    });

    test('returned function has correct signature', () => {
      registerTurnLifecycle(container);

      const assertFunc = container.resolve(tokens.assertValidEntity);

      // Test the function can be called with expected parameters
      const mockEntity = { id: 'test' };
      const mockLogger = mock();
      const contextName = 'TestContext';

      // Should not throw when called with valid parameters
      expect(() =>
        assertFunc(mockEntity, mockLogger, contextName)
      ).not.toThrow();
    });
  });

  describe('TurnContextBuilder factory', () => {
    test('creates TurnContextBuilder with dependencies', () => {
      registerTurnLifecycle(container);

      const builder = container.resolve(tokens.TurnContextBuilder);
      expect(builder).toBeDefined();
      expect(builder.constructor.name).toBe('TurnContextBuilder');

      // Verify dependencies
      expect(resolveCalls).toContain(tokens.ILogger);
      expect(resolveCalls).toContain(tokens.ITurnContextFactory);
      expect(resolveCalls).toContain(tokens.assertValidEntity);
    });

    test('is registered as transient', () => {
      registerTurnLifecycle(container);

      const instance1 = container.resolve(tokens.TurnContextBuilder);
      const instance2 = container.resolve(tokens.TurnContextBuilder);

      // Transient services should return different instances
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('TurnHandlerResolver factory', () => {
    test('creates TurnHandlerResolver with handler rules', () => {
      registerTurnLifecycle(container);

      const resolver = container.resolve(tokens.TurnHandlerResolver);
      expect(resolver).toBeDefined();
      expect(resolver.constructor.name).toBe('TurnHandlerResolver');
    });

    test('player handler rule prioritizes PLAYER_TYPE component', async () => {
      registerTurnLifecycle(container);

      const resolver = container.resolve(tokens.TurnHandlerResolver);
      const actor = {
        id: 'player-actor',
        hasComponent: jest.fn((componentId) => {
          if (componentId === PLAYER_TYPE_COMPONENT_ID) {
            return true;
          }
          if (componentId === PLAYER_COMPONENT_ID) {
            return false;
          }
          if (componentId === ACTOR_COMPONENT_ID) {
            return false;
          }
          return false;
        }),
        getComponentData: jest.fn(() => ({ type: 'human' })),
      };

      const handler = await resolver.resolveHandler(actor);

      expect(actor.hasComponent).toHaveBeenCalledWith(PLAYER_TYPE_COMPONENT_ID);
      expect(actor.getComponentData).toHaveBeenCalledWith(
        PLAYER_TYPE_COMPONENT_ID
      );
      expect(actor.hasComponent).not.toHaveBeenCalledWith(
        PLAYER_COMPONENT_ID
      );
      expect(handler).toBe(mockDependencies.actorTurnHandler);
    });

    test('player handler rule falls back to PLAYER component when needed', async () => {
      registerTurnLifecycle(container);

      const resolver = container.resolve(tokens.TurnHandlerResolver);
      const actor = {
        id: 'legacy-player-actor',
        hasComponent: jest.fn((componentId) => {
          if (componentId === PLAYER_TYPE_COMPONENT_ID) {
            return false;
          }
          if (componentId === PLAYER_COMPONENT_ID) {
            return true;
          }
          if (componentId === ACTOR_COMPONENT_ID) {
            return false;
          }
          return false;
        }),
        getComponentData: jest.fn(),
      };

      const handler = await resolver.resolveHandler(actor);

      expect(actor.getComponentData).not.toHaveBeenCalled();
      expect(actor.hasComponent).toHaveBeenCalledWith(PLAYER_COMPONENT_ID);
      expect(handler).toBe(mockDependencies.actorTurnHandler);
    });

    test('AI handler rule matches actors with ACTOR component', async () => {
      registerTurnLifecycle(container);

      const resolver = container.resolve(tokens.TurnHandlerResolver);
      const actor = {
        id: 'ai-actor',
        hasComponent: jest.fn((componentId) => {
          if (componentId === PLAYER_TYPE_COMPONENT_ID) {
            return false;
          }
          if (componentId === PLAYER_COMPONENT_ID) {
            return false;
          }
          if (componentId === ACTOR_COMPONENT_ID) {
            return true;
          }
          return false;
        }),
        getComponentData: jest.fn(),
      };

      const handler = await resolver.resolveHandler(actor);

      expect(actor.hasComponent).toHaveBeenCalledWith(ACTOR_COMPONENT_ID);
      expect(handler).toBe(mockDependencies.actorTurnHandler);
    });
  });

  describe('ITurnManager factory', () => {
    test('creates TurnManager with all dependencies', () => {
      registerTurnLifecycle(container);

      const manager = container.resolve(tokens.ITurnManager);
      expect(manager).toBeDefined();
      expect(manager.constructor.name).toBe('TurnManager');

      // Verify all dependencies
      expect(resolveCalls).toContain(tokens.ITurnOrderService);
      expect(resolveCalls).toContain(tokens.IEntityManager);
      expect(resolveCalls).toContain(tokens.ILogger);
      expect(resolveCalls).toContain(tokens.IValidatedEventDispatcher);
      expect(resolveCalls).toContain(tokens.TurnHandlerResolver);
    });

    test('is tagged with INITIALIZABLE', () => {
      const registerSpy = jest.spyOn(container, 'register');

      registerTurnLifecycle(container);

      // Find the registration call for ITurnManager
      const turnManagerCall = registerSpy.mock.calls.find(
        (call) => call[0] === tokens.ITurnManager
      );

      expect(turnManagerCall).toBeDefined();
      expect(turnManagerCall[2]).toBeDefined();
      expect(turnManagerCall[2].tags).toEqual(INITIALIZABLE);
    });
  });

  describe('ITurnContext factory', () => {
    test('returns null when turn manager has no active handler', () => {
      registerTurnLifecycle(container);

      // Mock turn manager without active handler
      const mockTurnManager = {
        getActiveTurnHandler: jest.fn(() => null),
      };
      container.register(tokens.ITurnManager, () => mockTurnManager);

      const context = container.resolve(tokens.ITurnContext);
      expect(context).toBeNull();
    });

    test('returns null when turn handler has no context', () => {
      registerTurnLifecycle(container);

      // Mock turn manager with handler that has no context
      const mockTurnManager = {
        getActiveTurnHandler: jest.fn(() => ({
          getTurnContext: jest.fn(() => null),
        })),
      };
      container.register(tokens.ITurnManager, () => mockTurnManager);

      const context = container.resolve(tokens.ITurnContext);
      expect(context).toBeNull();
    });

    test('returns context from active turn handler', () => {
      registerTurnLifecycle(container);

      // Mock turn context
      const mockContext = { id: 'test-context' };

      // Mock turn manager with active handler
      const mockTurnManager = {
        getActiveTurnHandler: jest.fn(() => ({
          getTurnContext: jest.fn(() => mockContext),
        })),
      };
      container.register(tokens.ITurnManager, () => mockTurnManager);

      const context = container.resolve(tokens.ITurnContext);
      expect(context).toBe(mockContext);
    });

    test('handles optional chaining correctly', () => {
      registerTurnLifecycle(container);

      // Test various undefined scenarios
      const scenarios = [
        { getActiveTurnHandler: undefined },
        { getActiveTurnHandler: () => ({ getTurnContext: undefined }) },
        { getActiveTurnHandler: () => undefined },
      ];

      scenarios.forEach((mockTurnManager) => {
        container.register(tokens.ITurnManager, () => mockTurnManager);

        const context = container.resolve(tokens.ITurnContext);
        expect(context).toBeNull();
      });
    });

    test('is registered as transient', () => {
      registerTurnLifecycle(container);

      // Even though it might return the same value, the factory itself is transient
      const registerSpy = jest.spyOn(container, 'register');
      registerTurnLifecycle(container);

      const contextCall = registerSpy.mock.calls.find(
        (call) => call[0] === tokens.ITurnContext
      );

      expect(contextCall[2].lifecycle).toBe('transient');
    });
  });

  describe('logging', () => {
    test('logs debug messages in correct order', () => {
      registerTurnLifecycle(container);

      const debugCalls = mockLogger.debug.mock.calls.map((call) => call[0]);

      expect(debugCalls[0]).toBe('Turn Lifecycle Registration: Starting...');
      expect(debugCalls).toContain(
        'Turn Lifecycle Registration: Registered Turn services and factories.'
      );
      expect(debugCalls).toContain(
        `Turn Lifecycle Registration: Registered ${tokens.TurnHandlerResolver} with singleton resolution.`
      );
      expect(debugCalls).toContain(
        `Turn Lifecycle Registration: Registered ${tokens.ITurnManager} tagged ${INITIALIZABLE.join(', ')}.`
      );
      expect(debugCalls).toContain(
        `Turn Lifecycle Registration: Registered transient factory for ${tokens.ITurnContext}.`
      );
      expect(debugCalls[debugCalls.length - 1]).toBe(
        'Turn Lifecycle Registration: Completed.'
      );
    });
  });
});
