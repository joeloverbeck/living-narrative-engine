// src/tests/turns/turnManager.advanceTurn.roundStart.test.js
// --- FILE START (Entire file content with corrected assertions) ---

import { beforeEach, expect, jest, test } from '@jest/globals';
import { describeTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  TURN_PROCESSING_STARTED,
} from '../../../src/constants/eventIds.js';
import { createMockEntity } from '../../common/mockFactories';
import { createAiActor } from '../../common/turns/testActors.js';
import { createMockTurnHandler } from '../../common/mockFactories.js';
import { expectSystemErrorDispatch } from '../../common/turns/turnManagerTestUtils.js';

describeTurnManagerSuite(
  'TurnManager: advanceTurn() - Round Start (Queue Empty)',
  (getBed) => {
    let testBed;
    let stopSpy;
    let advanceTurnSpy; // General spy for advanceTurn

    beforeEach(() => {
      testBed = getBed();
      testBed.mocks.turnOrderService.isEmpty.mockReset();
      testBed.mocks.dispatcher.subscribe.mockReset().mockReturnValue(jest.fn());
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(null);

      // Define the spy here for the actual advanceTurn method
      advanceTurnSpy = testBed.spyOnAdvanceTurn();

      // Spy on stop with debug logging for verification
      stopSpy = testBed.setupDebugStopSpy();

      // Clear constructor/setup logs AFTER instantiation and spy setup
      testBed.resetMocks();
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
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true); // Queue is empty for TurnCycle.nextActor()
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
      expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(1); // Called once by TurnCycle.nextActor()
      expect(
        testBed.mocks.turnOrderService.getNextEntity
      ).toHaveBeenCalledTimes(0); // Not called when isEmpty returns true

      // Check dispatch and stop from the advanceTurn call
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledTimes(2); // safeDispatchError + #dispatchSystemError
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'Critical error during turn advancement logic',
          details: {
            error: expectedErrorMsg,
          },
        })
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
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'Critical error during turn advancement logic',
          details: {
            error: expectedErrorMsg,
          },
        })
      );
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('Active actors found: starts new round and recursively calls advanceTurn', async () => {
      // Arrange
      const actor1 = createAiActor('actor1');
      const actor2 = createAiActor('actor2');
      testBed.setActiveEntities(actor1, actor2);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true); // Queue is empty for TurnCycle.nextActor()
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValueOnce(
        actor1
      ); // First actor in new round

      const mockHandler = createMockTurnHandler({ actor: actor1 });
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
        mockHandler
      );

      // Act: Start the manager, which will call advanceTurn and start a new round
      await testBed.turnManager.start();

      // Assert
      expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(2); // Called once by TurnCycle.nextActor(), once by recursive advanceTurn
      expect(
        testBed.mocks.turnOrderService.getNextEntity
      ).toHaveBeenCalledTimes(1); // Called by recursive advanceTurn
      expect(testBed.mocks.turnOrderService.startNewRound).toHaveBeenCalledWith(
        expect.arrayContaining([actor1, actor2]),
        'round-robin'
      );
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        'New round started, recursively calling advanceTurn() to process the first turn.'
      );

      // Verify the recursive advanceTurn call
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
      const actor1 = createAiActor('actor1');
      testBed.setActiveEntities(actor1);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true);
      const roundError = new Error('Round start failed');
      testBed.mocks.turnOrderService.startNewRound.mockRejectedValue(
        roundError
      );

      // Act: Start the manager, which will call advanceTurn and fail to start a new round
      await testBed.turnManager.start();

      // Assert
      expectSystemErrorDispatch(
        testBed.mocks.dispatcher.dispatch,
        'System Error: No active actors found to start a round. Stopping game.',
        roundError.message
      );
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('getNextEntity throws error after new round: logs error, dispatches message, and stops', async () => {
      // Arrange
      const actor1 = createAiActor('actor1');
      testBed.setActiveEntities(actor1);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true); // First call by TurnCycle.nextActor()
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(false); // Second call by recursive advanceTurn
      testBed.mocks.turnOrderService.getNextEntity.mockRejectedValue(
        new Error('Get next entity failed')
      ); // Called by recursive advanceTurn

      // Act: Start the manager, which will call advanceTurn, start a new round, then fail
      await testBed.turnManager.start();

      // Assert
      expectSystemErrorDispatch(
        testBed.mocks.dispatcher.dispatch,
        'System Error during turn advancement. Stopping game.',
        'Get next entity failed'
      );
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('Handler resolution fails after new round: logs error, dispatches message, and stops', async () => {
      // Arrange
      const actor1 = createAiActor('actor1');
      testBed.setActiveEntities(actor1);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true); // First call by TurnCycle.nextActor()
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(false); // Second call by recursive advanceTurn
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValueOnce(
        actor1
      ); // Called by recursive advanceTurn
      const resolveError = new Error('Handler resolution failed');
      testBed.mocks.turnHandlerResolver.resolveHandler.mockRejectedValue(
        resolveError
      );

      // Act: Start the manager, which will call advanceTurn, start a new round, then fail
      await testBed.turnManager.start();

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
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });
  }
);
// --- FILE END ---
