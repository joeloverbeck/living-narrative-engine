// src/tests/turns/turnManager.errorHandling.test.js
// --- FILE START ---

import {
  describeTurnManagerSuite,
  flushPromisesAndTimers,
} from '../../common/turns/turnManagerTestBed.js';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import {
  TURN_ENDED_ID,
  TURN_STARTED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';
import { beforeEach, expect, jest, test, afterEach } from '@jest/globals';
import { createMockEntity } from '../../common/mockFactories.js';

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

// --- Test Suite ---
describeTurnManagerSuite('TurnManager - Error Handling', (getBed) => {
  // Set a reasonable timeout, but hopefully the fixes prevent hitting it.
  jest.setTimeout(15000); // Slightly increased timeout just in case, but OOM is the main concern.

  let testBed;
  let mockActor1, mockActor2, mockActor3;

  beforeEach(() => {
    // Use MODERN fake timers explicitly
    jest.useFakeTimers({ legacyFakeTimers: false });
    mockHandlerInstances.clear();

    testBed = getBed();

    // Setup actors and add to the specific entityManager instance used by TurnManager
    mockActor1 = new MockEntity('actor1', [ACTOR_COMPONENT_ID]);
    mockActor2 = new MockEntity('actor2', [ACTOR_COMPONENT_ID]);
    mockActor3 = new MockEntity('actor3', [ACTOR_COMPONENT_ID]);
    testBed.setActiveEntities(mockActor1, mockActor2, mockActor3);

    // Default Mocks setup - configure specifically within each test if needed
    // to avoid mock state leaking or becoming confusing.
  });

  afterEach(async () => {
    mockHandlerInstances.clear();
    // Clears mock usage data (calls, instances) between tests
    jest.clearAllMocks();
    // Restore real timers after each test
    jest.useRealTimers();
  });

  test('should stop advancing if handlerResolver fails', async () => {
    // --- Test-Specific Mock Setup ---
    testBed.mocks.turnOrderService.isEmpty.mockReset().mockResolvedValue(false);
    testBed.mocks.turnOrderService.getNextEntity
      .mockReset()
      .mockResolvedValueOnce(mockActor1);
    const resolveError = new Error('Simulated Handler Resolution Failure');
    testBed.mocks.turnHandlerResolver.resolveHandler
      .mockReset()
      .mockRejectedValue(resolveError);
    // --- End Test-Specific Mock Setup ---

    // Start the turn manager
    await testBed.turnManager.start();

    // Advance turn - this should trigger the error
    await testBed.turnManager.advanceTurn();

    // Verify error was logged
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
      'CRITICAL Error during turn advancement logic (before handler initiation): Simulated Handler Resolution Failure',
      resolveError
    );

    // Verify system error event was dispatched
    expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'System Error during turn advancement. Stopping game.',
        details: {
          raw: resolveError.message,
          stack: expect.any(String),
          timestamp: expect.any(String),
        },
      })
    );

    // Verify turn manager stopped advancing
    expect(testBed.mocks.turnOrderService.getNextEntity).toHaveBeenCalledTimes(
      1
    );
  });

  test('should handle handler startTurn failure gracefully', async () => {
    // --- Test-Specific Mock Setup ---
    testBed.mocks.turnOrderService.isEmpty.mockReset().mockResolvedValue(false);
    testBed.mocks.turnOrderService.getNextEntity
      .mockReset()
      .mockResolvedValueOnce(mockActor1)
      .mockResolvedValueOnce(mockActor2);

    // Create a handler that will fail on startTurn
    const failingHandler = new MockTurnHandler(mockActor1);
    testBed.mocks.turnHandlerResolver.resolveHandler
      .mockReset()
      .mockResolvedValueOnce(failingHandler)
      .mockResolvedValueOnce(new MockTurnHandler(mockActor2));
    // --- End Test-Specific Mock Setup ---

    // Start the turn manager
    await testBed.turnManager.start();

    // Advance turn - this should trigger the handler failure
    await testBed.turnManager.advanceTurn();

    // Verify error was logged
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
      'Error during handler.startTurn() initiation for entity actor1 (MockTurnHandler): Simulated startTurn failure for actor1',
      expect.any(Error)
    );

    // Verify system error event was dispatched
    expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'Error initiating turn for actor1.',
        details: {
          raw: expect.any(String),
          stack: expect.any(String),
          timestamp: expect.any(String),
        },
      })
    );

    // Verify handler was destroyed
    expect(failingHandler.destroy).toHaveBeenCalled();

    // Verify turn manager stopped advancing
    expect(testBed.mocks.turnOrderService.getNextEntity).toHaveBeenCalledTimes(
      2
    ); // Called twice due to retry logic
  });

  test('should handle turn order service errors', async () => {
    // Arrange
    const orderError = new Error('Turn order service failure');
    testBed.mocks.turnOrderService.getNextEntity.mockRejectedValue(orderError);

    // Act
    await testBed.turnManager.start();

    // Verify error was logged
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
      'CRITICAL Error during turn advancement logic (before handler initiation): Turn order service failure',
      orderError
    );

    // Verify system error event was dispatched
    expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'System Error during turn advancement. Stopping game.',
        details: {
          raw: orderError.message,
          stack: expect.any(String),
          timestamp: expect.any(String),
        },
      })
    );
  });
});

// --- FILE END ---
