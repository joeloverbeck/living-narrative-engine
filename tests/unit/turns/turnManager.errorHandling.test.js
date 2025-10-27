// src/tests/turns/turnManager.errorHandling.test.js
// --- FILE START ---

import { describeTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_ENDED_ID,
  TURN_PROCESSING_ENDED,
} from '../../../src/constants/eventIds.js';
import {
  expectSystemErrorDispatch,
  expectTurnStartedEvents,
} from '../../common/turns/turnManagerTestUtils.js';
import { beforeEach, expect, jest, test } from '@jest/globals';

// --- Mock Implementations ---

// --- Test Suite ---
describeTurnManagerSuite('TurnManager - Error Handling', (getBed) => {
  // Set a reasonable timeout, but hopefully the fixes prevent hitting it.
  jest.setTimeout(15000); // Slightly increased timeout just in case, but OOM is the main concern.

  let testBed;
  // eslint-disable-next-line no-unused-vars
  let ai1, ai2, player;

  beforeEach(() => {
    testBed = getBed();

    ({ ai1, ai2, player } = testBed.addDefaultActors());

    testBed.resetMocks();

    // Mock the stop method to prevent infinite loops in error scenarios
    const stopSpy = jest
      .spyOn(testBed.turnManager, 'stop')
      .mockImplementation(async () => {
        // Access private field through a workaround - mark manager as stopped
        testBed.turnManager.isRunning = false;
      });
  });

  test('should stop advancing if handlerResolver fails', async () => {
    // Get reference to the stop spy
    const stopSpy = testBed.turnManager.stop;

    // --- Test-Specific Mock Setup ---
    testBed.mockNextActor(ai1);
    const resolveError = new Error('Simulated Handler Resolution Failure');
    testBed.mocks.turnHandlerResolver.resolveHandler
      .mockReset()
      .mockRejectedValue(resolveError);
    // --- End Test-Specific Mock Setup ---

    // Manually set up entities and start
    testBed.setActiveEntities(ai1);

    // Call start which will trigger advanceTurn
    await testBed.turnManager.start();

    // Now run all the timers to ensure async operations complete
    jest.runAllTimers();

    // Let promises resolve
    await Promise.resolve();
    await Promise.resolve();

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

    // Verify stop was called due to the error
    expect(stopSpy).toHaveBeenCalled();
  });

  test('should handle handler startTurn failure gracefully', async () => {
    // Get reference to the stop spy
    const stopSpy = testBed.turnManager.stop;

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

    // Manually set up entities and start
    testBed.setActiveEntities(ai1);

    // Start the turn manager - this should trigger the handler failure
    await testBed.turnManager.start();

    // Now run all the timers to ensure async operations complete
    jest.runAllTimers();

    // Let promises resolve
    await Promise.resolve();
    await Promise.resolve();

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

    // Verify turn manager continues to next entity after error
    expect(testBed.mocks.turnOrderService.getNextEntity).toHaveBeenCalledTimes(
      2
    ); // Called twice - once for ai1, once for ai2
  });

  test('should handle turn order service errors', async () => {
    // Get reference to the stop spy
    const stopSpy = testBed.turnManager.stop;

    // Arrange
    const orderError = new Error('Turn order service failure');
    testBed.mockNextActor(ai1);
    testBed.mocks.turnOrderService.getNextEntity.mockRejectedValue(orderError);

    // Manually set up entities and start
    testBed.setActiveEntities(ai1);

    // Act - start which will fail
    await testBed.turnManager.start();

    // Now run all the timers to ensure async operations complete
    jest.runAllTimers();

    // Let promises resolve
    await Promise.resolve();
    await Promise.resolve();

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

    // Verify stop was called due to the error
    expect(stopSpy).toHaveBeenCalled();
  });

  test('should report synchronous dispatcher failures when finishing a turn', async () => {
    const dispatchError = new Error('Dispatcher refused to emit');

    ({ ai1 } = testBed.addDefaultActors());

    testBed.mocks.turnOrderService.isEmpty
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    testBed.mocks.turnOrderService.getNextEntity
      .mockResolvedValueOnce(ai1)
      .mockResolvedValue(null);

    testBed.setupHandlerForActor(ai1, {
      includeSignalTermination: true,
    });

    testBed.mocks.dispatcher.dispatch.mockImplementation((eventType) => {
      if (eventType === TURN_PROCESSING_ENDED) {
        throw dispatchError;
      }
      return Promise.resolve(true);
    });

    await testBed.turnManager.start();
    await Promise.resolve();
    await Promise.resolve();

    testBed.mocks.dispatcher._triggerEvent(TURN_ENDED_ID, {
      entityId: ai1.id,
      success: true,
    });

    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();

    expect(
      testBed.mocks.dispatcher.dispatch
    ).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: `Failed to dispatch ${TURN_PROCESSING_ENDED} for ${ai1.id}`,
        details: expect.objectContaining({
          entityId: ai1.id,
          actorType: 'ai',
          error: dispatchError.message,
        }),
      })
    );

    expect(testBed.turnManager.stop).not.toHaveBeenCalled();
  });
});

// --- FILE END ---
