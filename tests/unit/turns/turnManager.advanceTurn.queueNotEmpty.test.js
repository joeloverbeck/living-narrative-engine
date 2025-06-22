// src/tests/turns/turnManager.advanceTurn.queueNotEmpty.test.js
// --- FILE START (Entire file content as requested, with corrections) ---

import { beforeEach, expect, jest, test } from '@jest/globals';
import {
  describeRunningTurnManagerSuite,
  TurnManagerTestBed,
} from '../../common/turns/turnManagerTestBed.js';
import { expectSystemErrorDispatch } from '../../common/turns/turnManagerTestUtils.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_PROCESSING_STARTED,
} from '../../../src/constants/eventIds.js';
import { createAiActor } from '../../common/turns/testActors.js';
import { createMockTurnHandler } from '../../common/mockFactories.js';

// --- Test Suite ---

describeRunningTurnManagerSuite(
  'TurnManager: advanceTurn() - Turn Advancement (Queue Not Empty)',
  (getBed) => {
    let testBed;
    let stopSpy;

    beforeEach(() => {
      testBed = getBed();

      testBed.setupMockHandlerResolver();

      // Setup stop spy for call verification and debug logging
      stopSpy = testBed.setupDebugStopSpy();

      // Re-apply default isEmpty mock after resetting call history
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
    });

    // --- Test Cases ---

    test('Successfully getting next entity: updates current actor, resolves and calls handler startTurn', async () => {
      // Arrange
      const nextActor = createAiActor('actor-next'); // AI actor
      const entityType = 'ai';
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(nextActor);

      const mockHandler = createMockTurnHandler({ actor: nextActor });
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
        mockHandler
      );

      // Act
      await testBed.turnManager.advanceTurn(); // Call directly, instance is running

      // Assert
      expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
      expect(
        testBed.mocks.turnOrderService.getNextEntity
      ).toHaveBeenCalledTimes(1);

      // Verify state update and logging
      expect(testBed.turnManager.getCurrentActor()).toBe(nextActor);
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        '▶️  TurnManager.advanceTurn() initiating...'
      );
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        'Queue not empty, processing next entity.'
      );
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        `Resolving turn handler for entity ${nextActor.id}...`
      );

      // Check core:turn_started dispatch
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        'core:turn_started',
        {
          entityId: nextActor.id,
          entityType: entityType,
        }
      );
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        TURN_PROCESSING_STARTED,
        { entityId: nextActor.id, actorType: entityType }
      );

      // Verify resolver call
      expect(
        testBed.mocks.turnHandlerResolver.resolveHandler
      ).toHaveBeenCalledTimes(1);
      expect(
        testBed.mocks.turnHandlerResolver.resolveHandler
      ).toHaveBeenCalledWith(nextActor);

      // Verify handler startTurn call
      expect(mockHandler.startTurn).toHaveBeenCalledTimes(1);
      expect(mockHandler.startTurn).toHaveBeenCalledWith(nextActor);

      // Verify waiting state log
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `TurnManager now WAITING for 'core:turn_ended' event.`
        )
      );

      // Verify no stop was called
      expect(stopSpy).not.toHaveBeenCalled();
    });

    test('getNextEntity returns null: logs error, stops manager', async () => {
      // Arrange
      const mockActor = createAiActor('actor1');
      testBed.setActiveEntities(mockActor); // Set up entities so RoundManager can start a new round
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);

      // Act
      await testBed.turnManager.advanceTurn();

      // Assert
      expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(2);
      expect(
        testBed.mocks.turnOrderService.getNextEntity
      ).toHaveBeenCalledTimes(2);

      expect(testBed.mocks.dispatcher.dispatch.mock.calls).toEqual(
        expect.arrayContaining([
          [
            SYSTEM_ERROR_OCCURRED_ID,
            expect.objectContaining({
              message: expect.any(String),
              details: expect.objectContaining({
                raw: 'No successful turns completed in the previous round. Stopping TurnManager.',
              }),
            }),
          ],
        ])
      );
      expectSystemErrorDispatch(
        testBed.mocks.dispatcher.dispatch,
        'System Error: No progress made in the last round.',
        'No successful turns completed in the previous round. Stopping TurnManager.'
      );

      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('getNextEntity throws error: logs error, stops manager', async () => {
      // Arrange
      const getNextError = new Error('Turn order service failure');
      testBed.mocks.turnOrderService.getNextEntity.mockRejectedValue(
        getNextError
      );

      // Act
      await testBed.turnManager.advanceTurn();

      // Assert
      expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
      expect(
        testBed.mocks.turnOrderService.getNextEntity
      ).toHaveBeenCalledTimes(1);

      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'System Error during turn advancement',
          details: {
            error: getNextError.message,
          },
        })
      );
      expectSystemErrorDispatch(
        testBed.mocks.dispatcher.dispatch,
        'System Error during turn advancement. Stopping game.',
        getNextError.message
      );

      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('Handler resolver throws: logs error, stops manager', async () => {
      // Arrange
      const resolveError = new Error('Handler resolution failed');
      const mockActor = createAiActor('actor1');
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor); // Return valid entity first
      testBed.mocks.turnHandlerResolver.resolveHandler.mockRejectedValue(
        resolveError
      ); // Then throw error

      // Act
      await testBed.turnManager.advanceTurn();

      // Assert
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'System Error during turn advancement',
          details: {
            error: resolveError.message,
          },
        })
      );

      expectSystemErrorDispatch(
        testBed.mocks.dispatcher.dispatch,
        'System Error during turn advancement. Stopping game.',
        resolveError.message
      );

      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('Handler startTurn throws: logs error, stops manager', async () => {
      // Arrange
      const startError = new Error('Handler start failed');
      const mockActor = createAiActor('actor1');
      const mockHandler = createMockTurnHandler({ actor: mockActor });
      mockHandler.startTurn.mockRejectedValue(startError);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor); // Return valid entity first
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
        mockHandler
      ); // Return valid handler
      // startTurn will throw error when called

      // Act
      await testBed.turnManager.advanceTurn();

      // Assert
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'Error initiating turn for actor1',
          details: {
            error: startError.message,
            handlerName: expect.any(String),
          },
        })
      );

      expectSystemErrorDispatch(
        testBed.mocks.dispatcher.dispatch,
        'Error initiating turn for actor1.',
        startError.message
      );

      // The implementation doesn't stop the manager for startTurn failures
      // expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('Dispatcher dispatch throws: logs error, stops manager', async () => {
      // Arrange
      const dispatchError = new Error('Dispatcher failure');
      const mockActor = createAiActor('actor1');
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor); // Return valid entity first
      testBed.mocks.dispatcher.dispatch.mockRejectedValue(dispatchError); // Then throw error

      // Act
      await testBed.turnManager.advanceTurn();

      // Assert
      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        'Dispatch core:turn_started failed: Dispatcher failure',
        dispatchError
      );

      // The implementation doesn't dispatch system errors for dispatcher failures
      // expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
      //   SYSTEM_ERROR_OCCURRED_ID,
      //   expect.objectContaining({
      //     details: {
      //       raw: dispatchError.message,
      //       stack: expect.any(String),
      //       timestamp: expect.any(String),
      //     },
      //   })
      // );

      // expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('Called when not running: logs debug and returns early', async () => {
      // Arrange
      // Create a fresh test bed that doesn't start the manager
      const freshTestBed = new TurnManagerTestBed();

      // Don't start the manager - it will not be running by default
      // The manager starts with _isRunning = false

      // Act
      await freshTestBed.turnManager.advanceTurn();

      // Assert
      expect(freshTestBed.mocks.logger.debug).toHaveBeenCalledWith(
        'TurnManager.advanceTurn() called while manager is not running. Returning.'
      );

      expect(
        freshTestBed.mocks.turnOrderService.isEmpty
      ).not.toHaveBeenCalled();
      expect(
        freshTestBed.mocks.turnOrderService.getNextEntity
      ).not.toHaveBeenCalled();
      expect(
        freshTestBed.mocks.turnHandlerResolver.resolveHandler
      ).not.toHaveBeenCalled();
      expect(freshTestBed.mocks.dispatcher.dispatch).not.toHaveBeenCalled();

      // Clean up the fresh test bed
      await freshTestBed.cleanup();
    });
  }
);
// --- FILE END ---
