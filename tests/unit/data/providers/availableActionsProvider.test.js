/**
 * @file Test suite for AvailableActionsProvider.
 * @see tests/unit/data/providers/availableActionsProvider.test.js
 */

import {
  jest,
  describe,
  beforeEach,
  test,
  expect,
  afterEach,
} from '@jest/globals';
import { AvailableActionsProvider } from '../../../../src/data/providers/availableActionsProvider.js';
import { TurnContext } from '../../../../src/turns/context/turnContext.js';

jest.mock(
  '../../../../src/anatomy/slotGenerator.js',
  () => ({ default: class SlotGenerator {} }),
  { virtual: true }
);
import { POSITION_COMPONENT_ID } from '../../../../src/constants/componentIds.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../../../src/constants/core.js';
// We import these to have handles to the mocked functions.

// --- Mock Implementations ---

const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

class MockEntity {
  constructor(id, componentsData = {}) {
    this.id = id;
    this._componentsData = componentsData;
    this.getComponentData = jest.fn((compId) => this._componentsData[compId]);
  }
}

const mockEntityManager = () => ({
  getEntityInstance: jest.fn(),
});

const mockActionDiscoveryService = () => ({
  getValidActions: jest.fn(),
});

const mockActionIndexer = () => ({
  index: jest.fn(),
});

const mockJsonLogicService = () => ({
  evaluate: jest.fn(),
});

const mockEventBus = () => ({
  subscribe: jest.fn().mockImplementation(() => jest.fn()),
  unsubscribe: jest.fn(),
});

// --- Test Suite ---

describe('AvailableActionsProvider', () => {
  // The System Under Test (SUT)
  let provider;

  // Mocks for all dependencies
  let logger;
  let mockActor;
  let entityManager;
  let actionDiscoveryService;
  let actionIndexer;
  let eventBus;
  let serviceSetup;

  beforeEach(() => {
    serviceSetup = {
      setupService: jest.fn((serviceName, logger, deps) => {
        serviceSetup.validateDeps(serviceName, logger, deps);
        return logger;
      }),
      validateDeps: jest.fn(),
    };

    // 1. Arrange: Instantiate all mocks
    logger = mockLogger();
    entityManager = mockEntityManager();
    actionDiscoveryService = mockActionDiscoveryService();
    actionIndexer = mockActionIndexer();
    eventBus = mockEventBus();

    mockActor = new MockEntity('actor-1', {
      [POSITION_COMPONENT_ID]: { locationId: 'location-1' },
    });

    // 2. Arrange: Instantiate the SUT. This will trigger the constructor,
    // which calls our mocked `setupService` from above.
    provider = new AvailableActionsProvider({
      actionDiscoveryService,
      actionIndexingService: actionIndexer,
      entityManager,
      eventBus,
      logger,
      serviceSetup,
    });

    // 3. Arrange: Set default behaviors for other mocks
    const mockLocationEntity = new MockEntity('location-1');
    entityManager.getEntityInstance.mockResolvedValue(mockLocationEntity);
    actionDiscoveryService.getValidActions.mockResolvedValue({
      actions: [],
      errors: [],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    serviceSetup.setupService.mockClear();
    serviceSetup.validateDeps.mockClear();
  });

  describe('constructor', () => {
    test('should validate its dependencies upon initialization', () => {
      expect(serviceSetup.validateDeps).toHaveBeenCalledTimes(1);
      expect(serviceSetup.validateDeps).toHaveBeenCalledWith(
        'AvailableActionsProvider',
        logger,
        expect.objectContaining({
          actionDiscoveryService: expect.any(Object),
          actionIndexer: expect.any(Object),
          entityManager: expect.any(Object),
        })
      );
    });
  });

  describe('Context Integrity', () => {
    const turnContext = { game: { worldId: 'test-world-1' } };

    test('should pass a lean context with only dynamic state to ActionDiscoveryService', async () => {
      // Arrange (already done in beforeEach)

      // Act
      await provider.get(mockActor, turnContext, logger);

      // Assert
      expect(actionDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);

      // Check the context object passed to getValidActions
      const passedContext =
        actionDiscoveryService.getValidActions.mock.calls[0][1];

      expect(passedContext).toBeDefined();
      expect(passedContext.currentLocation).toBeDefined();
      expect(passedContext.worldContext).toEqual(turnContext.game);
      // Verify that service dependencies are NOT in the context (API improvement)
      expect(passedContext.jsonLogicEval).toBeUndefined();
      expect(passedContext.actingEntity).toBeUndefined();
      expect(passedContext.entityManager).toBeUndefined();
    });

    test('should read world context from concrete TurnContext instances', async () => {
      const worldContext = { worldId: 'ctx-from-turn-context' };
      const handlerStub = {
        requestIdleStateTransition: jest.fn(),
        requestAwaitingInputStateTransition: jest.fn(),
        requestProcessingCommandStateTransition: jest.fn(),
        requestAwaitingExternalTurnEndStateTransition: jest.fn(),
      };
      const concreteContext = new TurnContext({
        actor: mockActor,
        logger,
        services: {
          game: worldContext,
          turnEndPort: { notifyTurnEnded: jest.fn() },
          safeEventDispatcher: { dispatch: jest.fn() },
          entityManager,
        },
        strategy: { decideAction: jest.fn() },
        onEndTurnCallback: jest.fn(),
        handlerInstance: handlerStub,
      });

      await provider.get(mockActor, concreteContext, logger);

      const passedContext =
        actionDiscoveryService.getValidActions.mock.calls[1]?.[1] ??
        actionDiscoveryService.getValidActions.mock.calls[0][1];

      expect(passedContext.worldContext).toBe(worldContext);
    });
  });

  // --- Feature Tests based on Ticket ---
  describe('Feature: Action List Provision', () => {
    const turnContext1 = { game: { worldId: 'test-world-1', turn: 1 } };
    const turnContext2 = { game: { worldId: 'test-world-1', turn: 2 } };

    test('AC1: should return the same cached list when get() is called twice in the same turn', async () => {
      // Arrange: Set up the expected data flow for the first call
      const discoveredActions = [
        {
          id: 'core:wait',
          command: 'wait command',
          params: {},
          description: 'Wait a turn',
        },
      ];
      const indexedActions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait command',
          params: {},
          description: 'Wait a turn',
        },
      ];
      actionDiscoveryService.getValidActions.mockResolvedValue({
        actions: discoveredActions,
        errors: [],
      });
      actionIndexer.index.mockReturnValue(indexedActions);

      // Act: Call the provider twice within the same turn context
      const result1 = await provider.get(mockActor, turnContext1, logger);
      const result2 = await provider.get(mockActor, turnContext1, logger);

      // Assert: Verify that caching prevented redundant service calls
      expect(actionDiscoveryService.getValidActions).toHaveBeenCalledTimes(1);
      expect(actionIndexer.index).toHaveBeenCalledTimes(1);
      expect(result1).toBe(indexedActions); // Should be the exact same object from cache
      expect(result2).toBe(indexedActions);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Cache Hit]')
      );
    });

    test('gracefully handles a non-array actions payload from discovery', async () => {
      actionDiscoveryService.getValidActions.mockResolvedValueOnce({
        actions: null,
        errors: [],
      });

      const result = await provider.get(mockActor, turnContext1, logger);

      expect(result).toEqual([]);
      expect(actionIndexer.index).toHaveBeenCalledWith([], mockActor.id);
      expect(logger.warn).toHaveBeenCalledWith(
        'AvailableActionsProvider: Discovery service returned a non-array "actions" result. Treating as empty list.',
        expect.objectContaining({
          actorId: mockActor.id,
          receivedType: 'null',
        })
      );
    });

    test('AC2: should re-index actions and restart indices in a new turn', async () => {
      // Arrange: Mock services for two separate turns
      const discoveredActions = [
        { id: 'core:wait', command: 'wait command', description: 'desc' },
      ];
      actionDiscoveryService.getValidActions.mockResolvedValue({
        actions: discoveredActions,
        errors: [],
      });
      // The indexing service will be called for each turn, returning a fresh list
      actionIndexer.index
        .mockReturnValueOnce([
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait command',
            description: 'desc',
            params: {},
          },
        ]) // Turn 1
        .mockReturnValueOnce([
          {
            index: 1,
            actionId: 'core:wait',
            commandString: 'wait command',
            description: 'desc',
            params: {},
          },
        ]); // Turn 2 (indices restart)

      // Act: Call the provider across two different turn contexts
      await provider.get(mockActor, turnContext1, logger);
      await provider.get(mockActor, turnContext2, logger);

      // Assert: Verify the cache was flushed and services were called again
      expect(logger.debug).toHaveBeenCalledWith(
        'New turn detected. Clearing AvailableActionsProvider cache.'
      );
      expect(actionDiscoveryService.getValidActions).toHaveBeenCalledTimes(2);
      expect(actionIndexer.index).toHaveBeenCalledTimes(2);
    });

    test('AC3: should cap the action list and log a warning on overflow', async () => {
      // Arrange: Discover more actions than the allowed maximum
      const requestedCount = MAX_AVAILABLE_ACTIONS_PER_TURN + 5;
      const discoveredActions = Array.from(
        { length: requestedCount },
        (_, i) => ({
          id: `action-${i}`,
          command: `command-${i}`,
          params: { p: i },
          description: `desc-${i}`,
        })
      );
      // Mock the indexing service to return a capped list
      const cappedActions = discoveredActions
        .slice(0, MAX_AVAILABLE_ACTIONS_PER_TURN)
        .map((a, i) => ({
          index: i + 1,
          actionId: a.id,
          commandString: a.command,
          params: a.params,
          description: a.description,
        }));

      actionDiscoveryService.getValidActions.mockResolvedValue({
        actions: discoveredActions,
        errors: [],
      });
      actionIndexer.index.mockReturnValue(cappedActions);

      // Act
      const result = await provider.get(mockActor, turnContext1, logger);

      // Assert: Verify the list is capped and a warning was logged
      expect(result.length).toBe(MAX_AVAILABLE_ACTIONS_PER_TURN);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        `[Overflow] actor=${mockActor.id} requested=${requestedCount} capped=${MAX_AVAILABLE_ACTIONS_PER_TURN}`
      );
    });

    test('AC4: should suppress duplicate actions from the final list', async () => {
      // Arrange: Discover a list containing duplicate actions
      const duplicateDiscoveredActions = [
        {
          id: 'core:attack',
          command: 'attack goblin',
          params: { targetId: 'goblin-1' },
          description: 'Attack the goblin',
        },
        {
          id: 'core:wait',
          command: 'wait',
          params: {},
          description: 'Wait a turn',
        },
        {
          id: 'core:attack',
          command: 'attack goblin',
          params: { targetId: 'goblin-1' },
          description: 'Attack the goblin',
        }, // Duplicate
      ];
      // Mock the indexing service to return the de-duplicated and indexed list
      const dedupedIndexedActions = [
        {
          index: 1,
          actionId: 'core:attack',
          commandString: 'attack goblin',
          params: { targetId: 'goblin-1' },
          description: 'Attack the goblin',
        },
        {
          index: 2,
          actionId: 'core:wait',
          commandString: 'wait',
          params: {},
          description: 'Wait a turn',
        },
      ];
      actionDiscoveryService.getValidActions.mockResolvedValue({
        actions: duplicateDiscoveredActions,
        errors: [],
      });
      actionIndexer.index.mockReturnValue(dedupedIndexedActions);

      // Act
      const result = await provider.get(mockActor, turnContext1, logger);

      // Assert: Verify the final list is de-duplicated
      expect(result.length).toBe(2);
      expect(actionIndexer.index).toHaveBeenCalledWith(
        duplicateDiscoveredActions,
        'actor-1'
      );
      expect(result).toEqual(dedupedIndexedActions);
    });
  });

  // --- General & Error Case Tests ---
  describe('General Behavior', () => {
    const turnContext = { game: { worldId: 'test-world-1' } };

    test('should return an empty array and log an error if action discovery fails', async () => {
      // Arrange
      const discoveryError = new Error('Discovery Service Offline');
      actionDiscoveryService.getValidActions.mockRejectedValue(discoveryError);

      // Act
      const result = await provider.get(mockActor, turnContext, logger);

      // Assert
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Error discovering/indexing actions for ${mockActor.id}`
        ),
        discoveryError
      );
      expect(actionIndexer.index).not.toHaveBeenCalled();
    });

    test('should NOT log an overflow warning if list is reduced but not capped', async () => {
      // Arrange
      const discoveredCount = MAX_AVAILABLE_ACTIONS_PER_TURN + 5;
      const finalCount = MAX_AVAILABLE_ACTIONS_PER_TURN - 5; // De-duplicated below cap

      const discoveredActions = Array.from(
        { length: discoveredCount },
        (_, i) => ({
          id: `action-${i}`,
          command: `command-${i}`,
          params: {},
          description: `desc-${i}`,
        })
      );
      const reducedActions = discoveredActions
        .slice(0, finalCount)
        .map((a, i) => ({
          index: i + 1,
          actionId: a.id,
          commandString: a.command,
          params: a.params,
          description: a.description,
        }));

      actionDiscoveryService.getValidActions.mockResolvedValue({
        actions: discoveredActions,
        errors: [],
      });
      actionIndexer.index.mockReturnValue(reducedActions);

      // Act
      await provider.get(mockActor, turnContext, logger);

      // Assert
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    test('calls unsubscribe functions returned by the event bus', () => {
      // Ensure the constructor subscribed twice
      expect(eventBus.subscribe).toHaveBeenCalledTimes(2);

      const unsubscribeFns = eventBus.subscribe.mock.results
        .map((result) => result.value)
        .filter((fn) => typeof fn === 'function');

      provider.destroy();

      unsubscribeFns.forEach((fn) => {
        expect(fn).toHaveBeenCalledTimes(1);
      });
      expect(eventBus.unsubscribe).not.toHaveBeenCalled();
    });

    test('falls back to eventBus.unsubscribe when subscribe returns null', () => {
      const fallbackBus = mockEventBus();
      fallbackBus.subscribe
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(jest.fn());

      provider = new AvailableActionsProvider({
        actionDiscoveryService,
        actionIndexingService: actionIndexer,
        entityManager,
        eventBus: fallbackBus,
        logger,
        serviceSetup,
      });

      provider.destroy();

      expect(fallbackBus.unsubscribe).toHaveBeenCalledTimes(1);
      const [eventName, listener] = fallbackBus.unsubscribe.mock.calls[0];
      expect(typeof eventName).toBe('string');
      expect(typeof listener).toBe('function');
    });
  });
});
