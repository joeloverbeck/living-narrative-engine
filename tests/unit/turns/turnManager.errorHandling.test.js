// src/tests/turns/turnManager.errorHandling.test.js
// --- FILE START ---

import { describeRunningTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import {
  expectSystemErrorDispatch,
  expectTurnStartedEvents,
} from '../../common/turns/turnManagerTestUtils.js';
import { beforeEach, expect, jest, test } from '@jest/globals';

// --- Mock Implementations ---

// --- Test Suite ---
describeRunningTurnManagerSuite('TurnManager - Error Handling', (getBed) => {
  // Set a reasonable timeout, but hopefully the fixes prevent hitting it.
  jest.setTimeout(15000); // Slightly increased timeout just in case, but OOM is the main concern.

  let testBed;
  // eslint-disable-next-line no-unused-vars
  let ai1, ai2, player;

  beforeEach(() => {
    testBed = getBed();

    ({ ai1, ai2, player } = testBed.addDefaultActors());

    testBed.resetMocks();
  });

  test('should stop advancing if handlerResolver fails', async () => {
    // --- Test-Specific Mock Setup ---
    testBed.mockNextActor(ai1);
    const resolveError = new Error('Simulated Handler Resolution Failure');
    testBed.mocks.turnHandlerResolver.resolveHandler
      .mockReset()
      .mockRejectedValue(resolveError);
    // --- End Test-Specific Mock Setup ---

    // Start the turn manager
    await testBed.advanceAndFlush();

    // Verify safeDispatchError was called
    expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'System Error during turn advancement',
        details: {
          error: resolveError.message,
        },
      })
    );

    // Verify system error event was dispatched
    expectSystemErrorDispatch(
      testBed.mocks.dispatcher.dispatch,
      'System Error during turn advancement. Stopping game.',
      resolveError.message
    );

    // Verify turn manager stopped advancing
    expect(testBed.mocks.turnOrderService.getNextEntity).toHaveBeenCalledTimes(
      1
    );
  });

  test('should handle handler startTurn failure gracefully', async () => {
    // --- Test-Specific Mock Setup ---
    testBed.mockNextActor(ai1);
    testBed.mocks.turnOrderService.getNextEntity
      .mockResolvedValueOnce(ai1)
      .mockResolvedValueOnce(ai2);

    // Create a handler that will fail on startTurn
    const failingHandler = testBed.setupHandlerForActor(ai1, {
      failStart: true,
      includeSignalTermination: true,
    });
    const successHandler = testBed.setupHandlerForActor(ai2, {
      includeSignalTermination: true,
    });
    testBed.mocks.turnHandlerResolver.resolveHandler
      .mockReset()
      .mockResolvedValueOnce(failingHandler)
      .mockResolvedValueOnce(successHandler);
    // --- End Test-Specific Mock Setup ---

    // Advance turn - this should trigger the handler failure
    await testBed.advanceAndFlush();

    expectTurnStartedEvents(testBed.mocks.dispatcher.dispatch, ai1.id, 'ai');

    // Verify safeDispatchError was called
    expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'Error initiating turn for actor1',
        details: {
          error: expect.any(String),
          handlerName: expect.any(String),
        },
      })
    );

    // Verify system error event was dispatched
    expectSystemErrorDispatch(
      testBed.mocks.dispatcher.dispatch,
      'Error initiating turn for actor1.',
      'Simulated startTurn failure for actor1'
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
    testBed.mockNextActor(ai1);
    testBed.mocks.turnOrderService.getNextEntity.mockRejectedValue(orderError);

    // Act
    await testBed.advanceAndFlush();

    // Verify safeDispatchError was called
    expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'System Error during turn advancement',
        details: {
          error: orderError.message,
        },
      })
    );

    // Verify system error event was dispatched
    expectSystemErrorDispatch(
      testBed.mocks.dispatcher.dispatch,
      'System Error during turn advancement. Stopping game.',
      orderError.message
    );
  });
});

// --- FILE END ---
