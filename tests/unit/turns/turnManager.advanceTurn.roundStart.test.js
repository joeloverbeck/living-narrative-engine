// src/tests/turns/turnManager.advanceTurn.roundStart.test.js
// --- FILE START (Entire file content with corrected assertions) ---

import { beforeEach, expect, jest, test } from '@jest/globals';
import { describeTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_PROCESSING_STARTED,
} from '../../../src/constants/eventIds.js';
import { createMockEntity } from '../../common/mockFactories';

describeTurnManagerSuite(
  'TurnManager: advanceTurn() - Round Start (Queue Empty)',
  (getBed) => {
    let testBed;
    let stopSpy;
    let advanceTurnSpy; // General spy for advanceTurn

    beforeEach(() => {
      testBed = getBed();

      // Reset mock state
      testBed.mocks.turnOrderService.isEmpty.mockReset();
      testBed.mocks.turnOrderService.startNewRound
        .mockReset()
        .mockResolvedValue(undefined);
      testBed.mocks.turnOrderService.clearCurrentRound
        .mockReset()
        .mockResolvedValue(undefined);
      testBed.mocks.dispatcher.dispatch.mockReset().mockResolvedValue(true);
      testBed.mocks.dispatcher.subscribe.mockReset().mockReturnValue(jest.fn());
      testBed.mocks.turnHandlerResolver.resolveHandler
        .mockReset()
        .mockResolvedValue(null);

      // Define the spy here for the actual advanceTurn method
      advanceTurnSpy = jest.spyOn(testBed.turnManager, 'advanceTurn');

      // Spy on stop - Keep the condition to ensure start was called.
      stopSpy = jest
        .spyOn(testBed.turnManager, 'stop')
        .mockImplementation(async () => {
          testBed.mocks.logger.debug('Mocked instance.stop() called.');
        });

      // Clear constructor/setup logs AFTER instantiation and spy setup
      testBed.mocks.logger.info.mockClear();
      testBed.mocks.logger.debug.mockClear();
      testBed.mocks.logger.warn.mockClear();
      testBed.mocks.logger.error.mockClear();
    });

    // --- Test Cases ---

    test('advanceTurn() does nothing with a debug log if not running', async () => {
      // Arrange: #isRunning is false by default after construction before start()
      // Act: Call advanceTurn directly
      await testBed.turnManager.advanceTurn();

      // Assert
      expect(testBed.mocks.logger.debug).toHaveBeenCalledTimes(1);
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        'TurnManager.advanceTurn() called while manager is not running. Returning.'
      );
      expect(testBed.mocks.turnOrderService.isEmpty).not.toHaveBeenCalled();
      expect(stopSpy).not.toHaveBeenCalled();
      expect(testBed.mocks.dispatcher.dispatch).not.toHaveBeenCalled();
      expect(testBed.mocks.dispatcher.subscribe).not.toHaveBeenCalled(); // subscribe happens in start()
    });

    test('No active actors found: logs error, dispatches message, and stops', async () => {
      // Arrange
      const nonActorEntity = createMockEntity('nonActor1', {
        isActor: false,
        isPlayer: false,
      });
      testBed.setActiveEntities(nonActorEntity);
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true); // Queue is empty for the check inside advanceTurn
      const expectedErrorMsg =
        'Cannot start a new round: No active entities with an Actor component found.';

      // Act: Start the manager, which will call advanceTurn once.
      await testBed.turnManager.start(); // This calls advanceTurn.

      // Assert (on the results of the advanceTurn call triggered by start)
      expect(testBed.mocks.dispatcher.subscribe).toHaveBeenCalledTimes(1); // Ensure subscription happened in start()
      expect(advanceTurnSpy).toHaveBeenCalledTimes(1); // The call from start()

      // Check logs from the advanceTurn call triggered by start()
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        '▶️  TurnManager.advanceTurn() initiating...'
      );
      expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(1); // Called once, no recursive call when no actors
      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(expectedErrorMsg); // Error logged

      // Check dispatch and stop from the advanceTurn call
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
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
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        'Mocked instance.stop() called.'
      );
    });

    test('No active actors found (empty map): logs error, dispatches message, and stops', async () => {
      // Arrange
      testBed.setActiveEntities(); // Explicitly empty map
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true);
      const expectedErrorMsg =
        'Cannot start a new round: No active entities with an Actor component found.';

      // Act: Start the manager, which will immediately call advanceTurn and fail
      await testBed.turnManager.start();

      // Assert
      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(expectedErrorMsg);
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
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
    });

    test('Active actors found: starts new round and recursively calls advanceTurn', async () => {
      // Arrange
      const actor1 = createMockEntity('actor1', {
        isActor: true,
        isPlayer: false,
      });
      const actor2 = createMockEntity('actor2', {
        isActor: true,
        isPlayer: false,
      });
      testBed.setActiveEntities(actor1, actor2);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true); // Queue is empty
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValueOnce(
        actor1
      ); // First actor in new round

      const mockHandler = {
        startTurn: jest.fn().mockResolvedValue(undefined),
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
        mockHandler
      );

      // Act: Start the manager, which will call advanceTurn and start a new round
      await testBed.turnManager.start();

      // Assert
      expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(2); // Called once initially, then again in recursive advanceTurn
      expect(testBed.mocks.turnOrderService.startNewRound).toHaveBeenCalledWith(
        expect.arrayContaining([actor1, actor2]),
        'round-robin'
      );
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        'New round started, recursively calling advanceTurn() to process the first turn.'
      );

      // Verify the recursive advanceTurn call
      expect(
        testBed.mocks.turnOrderService.getNextEntity
      ).toHaveBeenCalledTimes(1);
      expect(
        testBed.mocks.turnHandlerResolver.resolveHandler
      ).toHaveBeenCalledWith(actor1);
      expect(mockHandler.startTurn).toHaveBeenCalledWith(actor1);
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        'core:turn_started',
        {
          entityId: actor1.id,
          entityType: 'ai',
        }
      );
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        TURN_PROCESSING_STARTED,
        { entityId: actor1.id, actorType: 'ai' }
      );
    });

    test('startNewRound throws error: logs error, dispatches message, and stops', async () => {
      // Arrange
      const actor1 = createMockEntity('actor1', {
        isActor: true,
        isPlayer: false,
      });
      testBed.setActiveEntities(actor1);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true);
      const roundError = new Error('Round start failed');
      testBed.mocks.turnOrderService.startNewRound.mockRejectedValue(
        roundError
      );

      // Act: Start the manager, which will call advanceTurn and fail to start a new round
      await testBed.turnManager.start();

      // Assert
      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        'CRITICAL Error during turn advancement logic (before handler initiation): Round start failed',
        roundError
      );
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          details: {
            raw: roundError.message,
            stack: expect.any(String),
            timestamp: expect.any(String),
          },
        })
      );
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('getNextEntity throws error after new round: logs error, dispatches message, and stops', async () => {
      // Arrange
      const actor1 = createMockEntity('actor1', {
        isActor: true,
        isPlayer: false,
      });
      testBed.setActiveEntities(actor1);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true);
      testBed.mocks.turnOrderService.getNextEntity.mockRejectedValue(
        new Error('Get next entity failed')
      );

      // Act: Start the manager, which will call advanceTurn, start a new round, then fail
      await testBed.turnManager.start();

      // Assert
      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        'CRITICAL Error during turn advancement logic (before handler initiation): Get next entity failed',
        expect.any(Error)
      );
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          details: {
            raw: 'Get next entity failed',
            stack: expect.any(String),
            timestamp: expect.any(String),
          },
        })
      );
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('Handler resolution fails after new round: logs error, dispatches message, and stops', async () => {
      // Arrange
      const actor1 = createMockEntity('actor1', {
        isActor: true,
        isPlayer: false,
      });
      testBed.setActiveEntities(actor1);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValueOnce(
        actor1
      );
      const resolveError = new Error('Handler resolution failed');
      testBed.mocks.turnHandlerResolver.resolveHandler.mockRejectedValue(
        resolveError
      );

      // Act: Start the manager, which will call advanceTurn, start a new round, then fail
      await testBed.turnManager.start();

      // Assert
      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        'CRITICAL Error during turn advancement logic (before handler initiation): Handler resolution failed',
        resolveError
      );
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          details: {
            raw: resolveError.message,
            stack: expect.any(String),
            timestamp: expect.any(String),
          },
        })
      );
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });
  }
);
// --- FILE END ---
