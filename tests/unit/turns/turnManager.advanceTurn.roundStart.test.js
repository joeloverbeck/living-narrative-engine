// src/tests/turns/turnManager.advanceTurn.roundStart.test.js
// --- FILE START (Entire file content with corrected assertions) ---

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import TurnManager from '../../../src/turns/turnManager.js';
import { ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_PROCESSING_STARTED,
} from '../../../src/constants/eventIds.js';

// Mocks for dependencies
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockDispatcher = {
  dispatch: jest.fn(),
  dispatch: jest.fn().mockResolvedValue(true),
  subscribe: jest.fn(),
};

const mockEntityManager = {
  activeEntities: new Map(),
  getEntityInstance: jest.fn(),
};

const mockTurnOrderService = {
  startNewRound: jest.fn(),
  getNextEntity: jest.fn(),
  isEmpty: jest.fn(),
  getCurrentOrder: jest.fn(),
  removeEntity: jest.fn(),
  addEntity: jest.fn(),
  clearCurrentRound: jest.fn(),
};

const mockTurnHandlerResolver = {
  resolveHandler: jest.fn(),
};

// Mock Entity class minimally
const mockEntity = (id, isActor) => ({
  id: id,
  hasComponent: jest.fn((componentId) =>
    componentId === ACTOR_COMPONENT_ID ? isActor : false
  ),
});

describe('TurnManager: advanceTurn() - Round Start (Queue Empty)', () => {
  let instance;
  let stopSpy;
  let advanceTurnSpy; // General spy for advanceTurn
  let turnEndedUnsubscribeMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock state
    mockEntityManager.activeEntities = new Map();
    mockTurnOrderService.isEmpty.mockReset();
    mockTurnOrderService.startNewRound.mockReset().mockResolvedValue(undefined);
    mockTurnOrderService.clearCurrentRound
      .mockReset()
      .mockResolvedValue(undefined);
    mockDispatcher.dispatch.mockReset().mockResolvedValue(true);
    mockDispatcher.subscribe
      .mockReset()
      .mockReturnValue(turnEndedUnsubscribeMock);
    mockTurnHandlerResolver.resolveHandler.mockReset().mockResolvedValue(null);
    turnEndedUnsubscribeMock.mockClear();

    instance = new TurnManager({
      logger: mockLogger,
      dispatcher: mockDispatcher,
      entityManager: mockEntityManager,
      turnOrderService: mockTurnOrderService,
      turnHandlerResolver: mockTurnHandlerResolver,
    });

    // Define the spy here for the actual advanceTurn method
    advanceTurnSpy = jest.spyOn(instance, 'advanceTurn');

    // Spy on stop - Keep the condition to ensure start was called.
    stopSpy = jest.spyOn(instance, 'stop').mockImplementation(async () => {
      mockLogger.debug('Mocked instance.stop() called.');
      // Check if start() was successfully logged before stop was invoked.
      const started = mockLogger.info.mock.calls.some(
        (call) => call[0] === 'Turn Manager started.'
      );
      mockLogger.debug(`Stop spy: Was manager started? ${started}`);
      if (started && typeof turnEndedUnsubscribeMock === 'function') {
        // Ensure it's callable
        mockLogger.debug('Stop spy: Calling turnEndedUnsubscribeMock');
        turnEndedUnsubscribeMock();
      } else {
        mockLogger.debug(
          'Stop spy: Not calling turnEndedUnsubscribeMock (manager start log not found or not callable)'
        );
      }
      // Minimal stop actions for spy - the real stop is more complex
      // Accessing private field directly is bad practice, but necessary for test simulation if needed
      // instance['#isRunning'] = false;
    });

    // Clear constructor/setup logs AFTER instantiation and spy setup
    mockLogger.info.mockClear();
    mockLogger.debug.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  afterEach(() => {
    // Restore all mocks ensures spies are handled correctly
    jest.restoreAllMocks();
    instance = null;
  });

  // --- Test Cases ---

  test('advanceTurn() does nothing with a debug log if not running', async () => {
    // Arrange: #isRunning is false by default after construction before start()
    // Act: Call advanceTurn directly
    await instance.advanceTurn();

    // Assert
    expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'TurnManager.advanceTurn() called while manager is not running. Returning.'
    );
    expect(mockTurnOrderService.isEmpty).not.toHaveBeenCalled();
    expect(stopSpy).not.toHaveBeenCalled();
    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    expect(mockDispatcher.subscribe).not.toHaveBeenCalled(); // subscribe happens in start()
    expect(turnEndedUnsubscribeMock).not.toHaveBeenCalled();
  });

  test('No active actors found: logs error, dispatches message, and stops', async () => {
    // Arrange
    const nonActorEntity = mockEntity('nonActor1', false);
    mockEntityManager.activeEntities.set('nonActor1', nonActorEntity);
    mockTurnOrderService.isEmpty.mockResolvedValueOnce(true); // Queue is empty for the check inside advanceTurn
    const expectedErrorMsg =
      'Cannot start a new round: No active entities with an Actor component found.';

    // Act: Start the manager, which will call advanceTurn once.
    await instance.start(); // This calls advanceTurn.

    // Assert (on the results of the advanceTurn call triggered by start)
    expect(mockDispatcher.subscribe).toHaveBeenCalledTimes(1); // Ensure subscription happened in start()
    expect(advanceTurnSpy).toHaveBeenCalledTimes(1); // The call from start()

    // Check logs from the advanceTurn call triggered by start()
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'TurnManager.advanceTurn() initiating...'
    );
    expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1); // Should be called now
    // --- END CORRECTION ---
    expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg); // Error logged

    // Check dispatch and stop from the advanceTurn call
    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      {
        message:
          'System Error: No active actors found to start a round. Stopping game.',
        details: {
          raw: expectedErrorMsg,
          stack: expect.any(String),
          timestamp: expect.any(String),
        },
      }
    );

    expect(stopSpy).toHaveBeenCalledTimes(1); // stop() called by the advanceTurn call
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Mocked instance.stop() called.'
    );
  });

  test('No active actors found (empty map): logs error, dispatches message, and stops', async () => {
    // Arrange
    mockEntityManager.activeEntities = new Map(); // Explicitly empty map
    mockTurnOrderService.isEmpty.mockResolvedValueOnce(true);
    const expectedErrorMsg =
      'Cannot start a new round: No active entities with an Actor component found.';

    // Act: Start the manager, which will immediately call advanceTurn and fail
    await instance.start();

    // Assert (on the results of the advanceTurn call triggered by start)
    expect(advanceTurnSpy).toHaveBeenCalledTimes(1); // Call from start()

    // Check logs from the advanceTurn call triggered by start()
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'TurnManager.advanceTurn() initiating...'
    );
    expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
    // --- END CORRECTION ---
    expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);

    // Check dispatch and stop from the advanceTurn call
    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      {
        message:
          'System Error: No active actors found to start a round. Stopping game.',
        details: {
          raw: expectedErrorMsg,
          stack: expect.any(String),
          timestamp: expect.any(String),
        },
      }
    );

    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Mocked instance.stop() called.'
    );
  });

  test('Actors found, successful round start: logs info, calls startNewRound, and recurses', async () => {
    // Arrange
    const actor1 = mockEntity('actor1', true);
    const actor2 = mockEntity('actor2', true);
    const nonActor = mockEntity('nonActor', false);
    mockEntityManager.activeEntities.set('actor1', actor1);
    mockEntityManager.activeEntities.set('nonActor', nonActor);
    mockEntityManager.activeEntities.set('actor2', actor2);

    // Setup mocks for the *first* call to advanceTurn (triggered by start)
    mockTurnOrderService.isEmpty.mockResolvedValueOnce(true); // Queue is empty initially
    mockTurnOrderService.startNewRound.mockResolvedValueOnce(undefined); // Success

    // Setup mocks for the *second* call to advanceTurn (recursive)
    mockTurnOrderService.isEmpty.mockResolvedValueOnce(false); // For the second call, queue is NOT empty
    mockTurnOrderService.getNextEntity.mockResolvedValueOnce(actor1); // It returns actor1

    // Mock a basic handler for actor1 to prevent the recursive call path from erroring
    const mockHandler = {
      startTurn: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn(),
    };
    mockTurnHandlerResolver.resolveHandler.mockResolvedValueOnce(mockHandler);

    // Act: Call start(), which triggers the first advanceTurn, which should succeed, start a round, and recurse.
    await instance.start();

    // Assert
    // Expect two calls: 1 from start(), 1 from successful round start recursion
    expect(advanceTurnSpy).toHaveBeenCalledTimes(2);

    // --- END CORRECTION ---
    // It finds actors... (Check presence and count)
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringMatching(
        /Found 2 actors to start the round: (actor1, actor2|actor2, actor1)/
      )
    );
    // It calls startNewRound...
    expect(mockTurnOrderService.startNewRound).toHaveBeenCalledTimes(1);
    expect(mockTurnOrderService.startNewRound).toHaveBeenCalledWith(
      expect.arrayContaining([actor1, actor2]),
      'round-robin' // Assuming default strategy
    );
    expect(mockTurnOrderService.startNewRound.mock.calls[0][0]).toHaveLength(2); // Ensure only actors passed
    // It logs the intent to recurse...
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'New round started, recursively calling advanceTurn() to process the first turn.'
    );

    // --- Assertions for the SECOND advanceTurn call (the recursion) ---
    expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(2); // First call true, second call false
    // It finds the queue NOT empty...
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Queue not empty, retrieving next entity.'
    ); // Log from second call
    // It gets the next entity...
    expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);

    // It dispatches turn started...
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith('core:turn_started', {
      entityId: actor1.id,
      entityType: 'ai',
    }); // Assuming AI
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      TURN_PROCESSING_STARTED,
      { entityId: actor1.id, actorType: 'ai' }
    );
    // It resolves the handler...
    expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledTimes(1);
    expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(actor1);
    // It calls startTurn on the handler...
    expect(mockHandler.startTurn).toHaveBeenCalledTimes(1);
    expect(mockHandler.startTurn).toHaveBeenCalledWith(actor1);
    // It logs waiting for the turn end event
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `TurnManager now WAITING for 'core:turn_ended' event.`
      )
    );

    // Ensure stop was NOT called and no system errors dispatched
    expect(stopSpy).not.toHaveBeenCalled();
    // Dispatch validated *was* called for core:turn_started, so check count or filter
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'core:turn_started',
      expect.anything()
    );
    // Ensure no system error dispatches
    expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.anything()
    );
  });
});
// --- FILE END ---
