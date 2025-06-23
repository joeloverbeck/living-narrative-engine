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

    beforeEach(() => {
      testBed = getBed();
      testBed.mocks.turnOrderService.isEmpty.mockReset();
      testBed.mocks.dispatcher.subscribe.mockReset().mockReturnValue(jest.fn());
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(null);

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

    describe('No active actors found', () => {
      beforeEach(async () => {
        const nonActorEntity = createMockEntity('nonActor1', {
          isActor: false,
          isPlayer: false,
        });
        testBed.setActiveEntities(nonActorEntity);
        testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true);
        await testBed.turnManager.start();
      });

      test('logs initiation and checks the queue once', () => {
        expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
          '▶️  TurnManager.advanceTurn() initiating...'
        );
        expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(
          testBed.mocks.turnOrderService.getNextEntity
        ).not.toHaveBeenCalled();
      });

      test('dispatches system error when round cannot start', () => {
        expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
          SYSTEM_ERROR_OCCURRED_ID,
          expect.objectContaining({
            message: 'Critical error during turn advancement logic',
            details: {
              error:
                'Cannot start a new round: No active entities with an Actor component found.',
            },
          })
        );
      });

      test('stops the manager when no actors are active', () => {
        expect(stopSpy).toHaveBeenCalledTimes(1);
      });
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

    describe('Active actors found', () => {
      let actor1;
      let actor2;
      let mockHandler;

      beforeEach(async () => {
        actor1 = createAiActor('actor1');
        actor2 = createAiActor('actor2');
        testBed.setActiveEntities(actor1, actor2);
        testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true);
        testBed.mocks.turnOrderService.getNextEntity.mockResolvedValueOnce(
          actor1
        );
        mockHandler = createMockTurnHandler({ actor: actor1 });
        testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
          mockHandler
        );
        await testBed.turnManager.start();
      });

      test('starts a new round and logs the action', () => {
        expect(
          testBed.mocks.turnOrderService.startNewRound
        ).toHaveBeenCalledWith(
          expect.arrayContaining([actor1, actor2]),
          'round-robin'
        );
        expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
          'New round started, recursively calling advanceTurn() to process the first turn.'
        );
      });

      test('processes the first actor in the new round', () => {
        expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(2);
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
    });

    describe('startNewRound throws error', () => {
      let roundError;

      beforeEach(async () => {
        const actor1 = createAiActor('actor1');
        testBed.setActiveEntities(actor1);
        testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true);
        roundError = new Error('Round start failed');
        testBed.mocks.turnOrderService.startNewRound.mockRejectedValue(
          roundError
        );
        await testBed.turnManager.start();
      });

      test('dispatches a system error', () => {
        expectSystemErrorDispatch(
          testBed.mocks.dispatcher.dispatch,
          'System Error: No active actors found to start a round. Stopping game.',
          roundError.message
        );
        expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalled();
      });

      test('stops the manager', () => {
        expect(stopSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('getNextEntity fails after starting a new round', () => {
      beforeEach(async () => {
        const actor1 = createAiActor('actor1');
        testBed.setActiveEntities(actor1);
        testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true);
        testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(false);
        testBed.mocks.turnOrderService.getNextEntity.mockRejectedValue(
          new Error('Get next entity failed')
        );
        await testBed.turnManager.start();
      });

      test('dispatches a system error', () => {
        expectSystemErrorDispatch(
          testBed.mocks.dispatcher.dispatch,
          'System Error during turn advancement. Stopping game.',
          'Get next entity failed'
        );
        expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalled();
      });

      test('stops the manager', () => {
        expect(stopSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('handler resolution fails after a new round starts', () => {
      let resolveError;

      beforeEach(async () => {
        const actor1 = createAiActor('actor1');
        testBed.setActiveEntities(actor1);
        testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true);
        testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(false);
        testBed.mocks.turnOrderService.getNextEntity.mockResolvedValueOnce(
          actor1
        );
        resolveError = new Error('Handler resolution failed');
        testBed.mocks.turnHandlerResolver.resolveHandler.mockRejectedValue(
          resolveError
        );
        await testBed.turnManager.start();
      });

      test('dispatches a system error', () => {
        expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
          SYSTEM_ERROR_OCCURRED_ID,
          expect.objectContaining({
            message: 'System Error during turn advancement',
            details: { error: resolveError.message },
          })
        );
      });

      test('stops the manager', () => {
        expect(stopSpy).toHaveBeenCalledTimes(1);
      });
    });
  }
);
// --- FILE END ---
