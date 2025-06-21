// src/tests/turns/turnManager.errorHandling.test.js
// --- FILE START ---

import { describeTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { beforeEach, expect, jest, test, afterEach } from '@jest/globals';
import { createMockTurnHandler } from '../../common/mockFactories';
import { createDefaultActors } from '../../common/turns/testActors.js';

// --- Mock Implementations ---

// --- Test Suite ---
describeTurnManagerSuite('TurnManager - Error Handling', (getBed) => {
  // Set a reasonable timeout, but hopefully the fixes prevent hitting it.
  jest.setTimeout(15000); // Slightly increased timeout just in case, but OOM is the main concern.

  let testBed;
  let ai1, ai2, player;

  beforeEach(() => {
    // Use MODERN fake timers explicitly
    jest.useFakeTimers({ legacyFakeTimers: false });

    testBed = getBed();

    // Setup actors and add to the specific entityManager instance used by TurnManager
    ({ ai1, ai2, player } = createDefaultActors());
    testBed.setActiveEntities(ai1, ai2, player);

    // Default Mocks setup - configure specifically within each test if needed
    // to avoid mock state leaking or becoming confusing.
  });

  afterEach(async () => {
    // Clears mock usage data between tests
    jest.clearAllMocks();
    // Timer cleanup handled by BaseTestBed
  });

  test('should stop advancing if handlerResolver fails', async () => {
    // --- Test-Specific Mock Setup ---
    testBed.mocks.turnOrderService.isEmpty.mockReset().mockResolvedValue(false);
    testBed.mocks.turnOrderService.getNextEntity
      .mockReset()
      .mockResolvedValueOnce(ai1);
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
      .mockResolvedValueOnce(ai1)
      .mockResolvedValueOnce(ai2);

    // Create a handler that will fail on startTurn
    const failingHandler = createMockTurnHandler({
      actor: ai1,
      failStart: true,
      includeSignalTermination: true,
    });
    // Ensure startTurn always returns a Promise
    failingHandler.startTurn = jest.fn().mockImplementation((currentActor) => {
      return Promise.reject(
        new Error(
          `Simulated startTurn failure for ${currentActor?.id || 'unknown actor'}`
        )
      );
    });
    const successHandler = createMockTurnHandler({
      actor: ai2,
      includeSignalTermination: true,
    });
    successHandler.startTurn = jest.fn().mockResolvedValue();
    testBed.mocks.turnHandlerResolver.resolveHandler
      .mockReset()
      .mockResolvedValueOnce(failingHandler)
      .mockResolvedValueOnce(successHandler);
    // --- End Test-Specific Mock Setup ---

    // Start the turn manager
    await testBed.turnManager.start();

    // Advance turn - this should trigger the handler failure
    await testBed.turnManager.advanceTurn();

    // Verify error was logged
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Error during handler.startTurn() initiation for entity actor1'
      ),
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
    testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
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
