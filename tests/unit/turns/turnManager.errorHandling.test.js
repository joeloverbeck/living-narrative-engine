// src/tests/turns/turnManager.errorHandling.test.js
// --- FILE START ---

import TurnManager from '../../../src/turns/turnManager.js';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import {
  TURN_ENDED_ID,
  TURN_STARTED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';
import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
  afterEach,
} from '@jest/globals';
import { flushPromisesAndTimers } from '../../common/turns/turnManagerTestBed.js';

// --- Mock Implementations ---
class MockEntity {
  constructor(id, components = []) {
    this.id = id || `entity-${Math.random().toString(36).substr(2, 9)}`;
    this.name = id;
    this.components = new Map(components.map((c) => [c.componentId || c, {}]));
    this.hasComponent = jest.fn((componentId) =>
      this.components.has(componentId)
    );
    this.getComponent = jest.fn((componentId) =>
      this.components.get(componentId)
    );
  }
}

const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  createChildLogger: jest.fn(() => mockLogger()),
});

const mockTurnOrderService = () => ({
  clearCurrentRound: jest.fn(async () => {}),
  isEmpty: jest.fn(async () => true),
  startNewRound: jest.fn(async (actors, strategy) => {}),
  getNextEntity: jest.fn(async () => null),
  addEntity: jest.fn(),
  removeEntity: jest.fn(),
  peekNextEntity: jest.fn(async () => null),
  getCurrentOrder: jest.fn(() => []),
  size: jest.fn(() => 0),
});

// REVISED mockEntityManager to be self-contained
const mockEntityManager = () => {
  const instance = {
    activeEntities: new Map(),
    getEntityInstance: jest.fn((id) => {
      const entity = instance.activeEntities.get(id);
      return entity || new MockEntity(id);
    }),
    getEntitiesWithComponents: jest.fn((componentId) => {
      return Array.from(instance.activeEntities.values()).filter((entity) =>
        entity.hasComponent(componentId)
      );
    }),
    createEntity: jest.fn(),
    destroyEntity: jest.fn(),
  };
  return instance;
};

let mockUnsubscribeFunctionGlobal; // Renamed to avoid conflict if any
const mockValidatedEventDispatcher = () => {
  mockUnsubscribeFunctionGlobal = jest.fn();
  const dispatcher = {
    _subscriptions: {},
    dispatch: jest.fn(async (eventName, payload) => true),
    subscribe: jest.fn((eventName, callback) => {
      dispatcher._subscriptions[eventName] =
        dispatcher._subscriptions[eventName] || [];
      dispatcher._subscriptions[eventName].push(callback);
      return mockUnsubscribeFunctionGlobal;
    }),
    unsubscribe: jest.fn((eventName, callbackOrUnsubscribeFn) => {}),
  };
  return dispatcher;
};

const mockHandlerInstances = new Map();

class MockTurnHandler {
  constructor(actor) {
    this.actor = actor;
    this.startTurn = jest.fn(async (currentActor) => {
      // Consistently fail for the specific test that needs it
      throw new Error(
        `Simulated startTurn failure for ${currentActor?.id || 'unknown actor'}`
      );
    });
    this.destroy = jest.fn(async () => {});
    this.signalNormalApparentTermination = jest.fn(() => {});
    mockHandlerInstances.set(actor.id, this);
  }
}

const mockTurnHandlerResolver = () => ({
  resolveHandler: jest.fn(async (actor) => new MockTurnHandler(actor)),
});

// --- Test Suite ---
describe('TurnManager - Error Handling', () => {
  // Set a reasonable timeout, but hopefully the fixes prevent hitting it.
  jest.setTimeout(15000); // Slightly increased timeout just in case, but OOM is the main concern.

  let turnManager;
  let logger;
  let turnOrderService;
  let entityManager;
  let dispatcher;
  let turnHandlerResolver;
  let mockActor1, mockActor2, mockActor3;

  beforeEach(() => {
    // Use MODERN fake timers explicitly
    jest.useFakeTimers({ legacyFakeTimers: false });
    mockHandlerInstances.clear();

    // Create instances of mocks that will be passed to TurnManager
    const currentTurnOrderService = mockTurnOrderService();
    const currentEntityManager = mockEntityManager();
    const currentLogger = mockLogger();
    const currentDispatcher = mockValidatedEventDispatcher();
    const currentTurnHandlerResolver = mockTurnHandlerResolver();

    // Assign to module-scoped variables if they are used directly in tests
    turnOrderService = currentTurnOrderService;
    entityManager = currentEntityManager;
    logger = currentLogger;
    dispatcher = currentDispatcher;
    turnHandlerResolver = currentTurnHandlerResolver;

    const validOptions = {
      turnOrderService: currentTurnOrderService,
      entityManager: currentEntityManager,
      logger: currentLogger,
      dispatcher: currentDispatcher,
      turnHandlerResolver: currentTurnHandlerResolver,
    };

    turnManager = new TurnManager(validOptions);

    // Setup actors and add to the specific entityManager instance used by TurnManager
    mockActor1 = new MockEntity('actor1', [ACTOR_COMPONENT_ID]);
    mockActor2 = new MockEntity('actor2', [ACTOR_COMPONENT_ID]);
    mockActor3 = new MockEntity('actor3', [ACTOR_COMPONENT_ID]);
    currentEntityManager.activeEntities.set(mockActor1.id, mockActor1);
    currentEntityManager.activeEntities.set(mockActor2.id, mockActor2);
    currentEntityManager.activeEntities.set(mockActor3.id, mockActor3);

    // Default Mocks setup - configure specifically within each test if needed
    // to avoid mock state leaking or becoming confusing.
  });

  afterEach(async () => {
    // Make afterEach async if TurnManager.stop() is consistently async
    // Attempt to stop the turn manager if it exists and might be running
    if (turnManager && typeof turnManager.stop === 'function') {
      try {
        await turnManager.stop(); // Ensure stop completes if it involves async operations
      } catch (e) {
        // console.warn("Error stopping TurnManager in afterEach:", e);
        // Ignore errors during cleanup
      }
    }
    turnManager = null; // Help GC

    mockHandlerInstances.clear();
    // Clears mock usage data (calls, instances) between tests
    jest.clearAllMocks();
    // Restore real timers after each test
    jest.useRealTimers();
  });

  test('should stop advancing if handlerResolver fails', async () => {
    // --- Test-Specific Mock Setup ---
    turnOrderService.isEmpty.mockReset().mockResolvedValue(false);
    turnOrderService.getNextEntity
      .mockReset()
      .mockResolvedValueOnce(mockActor1);
    const resolveError = new Error('Simulated Handler Resolution Failure');
    turnHandlerResolver.resolveHandler
      .mockReset()
      .mockRejectedValue(resolveError);
    // --- End Test-Specific Mock Setup ---

    turnManager.start(); // Initiates advanceTurn
    await flushPromisesAndTimers(); // Run the first advanceTurn attempt which should fail during resolve

    // Assertions
    expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
    expect(turnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
    expect(turnHandlerResolver.resolveHandler).toHaveBeenCalledWith(mockActor1);
    expect(logger.error).toHaveBeenCalledWith(
      // Match the critical error log message format
      `CRITICAL Error during turn advancement logic (before handler initiation): ${resolveError.message}`,
      resolveError // Check that the error object itself is logged
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'System Error during turn advancement. Stopping game.',
        details: {
          raw: resolveError.message,
          timestamp: expect.any(String),
          stack: expect.any(String),
        },
      })
    );
    // stop() calls clearCurrentRound
    expect(turnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);

    // Ensure it didn't try to advance further
    // Reset mocks and flush again to see if anything happens
    jest.clearAllMocks(); // Clear calls like clearCurrentRound
    await flushPromisesAndTimers();
    expect(turnOrderService.getNextEntity).not.toHaveBeenCalled();
    expect(turnHandlerResolver.resolveHandler).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled(); // No new errors
    expect(turnOrderService.clearCurrentRound).not.toHaveBeenCalled(); // stop not called again
  });

  test('should stop advancing and log error if getNextEntity returns null unexpectedly', async () => {
    // --- Test-Specific Mock Setup ---
    turnOrderService.isEmpty.mockReset().mockResolvedValue(false); // Simulate queue NOT being empty
    turnOrderService.getNextEntity.mockReset().mockResolvedValue(null); // Simulate error condition
    // --- End Test-Specific Mock Setup ---

    turnManager.start(); // Initiates advanceTurn
    await flushPromisesAndTimers(); // Run the turn advancement where getNextEntity fails

    // Assertions
    expect(turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
    expect(turnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.'
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message:
          'Internal Error: Turn order inconsistency detected. Stopping game.',
        details: {
          raw: 'Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.',
          stack: expect.any(String),
          timestamp: expect.any(String),
        },
      })
    );
    // stop() calls clearCurrentRound
    expect(turnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);

    // Ensure it didn't try to advance further
    jest.clearAllMocks();
    await flushPromisesAndTimers();
    expect(turnOrderService.isEmpty).not.toHaveBeenCalled();
    expect(turnOrderService.getNextEntity).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(turnOrderService.clearCurrentRound).not.toHaveBeenCalled();
  });
});

// --- FILE END ---
