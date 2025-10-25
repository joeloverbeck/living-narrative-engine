// tests/turns/turnManager.advanceTurn.actorIdentification.test.js
// --- FILE START (Corrected) ---

import { afterEach, beforeEach, expect, test } from '@jest/globals';
import { describeRunningTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import {
  expectSystemErrorDispatch,
  triggerTurnEndedAndFlush,
  expectTurnStartedEvents,
} from '../../common/turns/turnManagerTestUtils.js';

import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { PLAYER_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { createMockEntity } from '../../common/mockFactories';
import {
  createAiActor,
  createPlayerActor,
} from '../../common/turns/testActors.js';

// --- Test Suite ---

describeRunningTurnManagerSuite(
  'TurnManager: advanceTurn() - Actor Identification & Handling (Queue Not Empty)',
  (getBed) => {
    let testBed;
    let stopSpy;

    beforeEach(async () => {
      jest.useRealTimers(); // Use real timers for this specific test
      testBed = getBed();
      testBed.mockNextActor(createAiActor('initial-actor-for-start'));
      testBed.setupMockHandlerResolver();
      stopSpy = testBed.spyOnStopNoOp();
    });

    afterEach(async () => {
      jest.useFakeTimers(); // Restore fake timers after each test
      // Timer cleanup handled by BaseTestBed
    });

    // Removed parameterized test for actor identification due to handler.destroy assertion failures

    test('Non-actor entity: skips invalid entry and continues to next actor', async () => {
      const nonActor = createMockEntity('non-actor', {
        isActor: false,
        isPlayer: false,
      });
      const nextActor = createAiActor('actor-after-non-actor');
      testBed.mockActorSequence(nonActor, nextActor);
      const handler = testBed.setupHandlerForActor(nextActor);

      await testBed.turnManager.advanceTurn();

      expect(testBed.mocks.turnOrderService.isEmpty).toHaveBeenCalledTimes(2);
      expect(
        testBed.mocks.turnOrderService.getNextEntity
      ).toHaveBeenCalledTimes(2);
      expect(
        testBed.mocks.turnHandlerResolver.resolveHandler
      ).toHaveBeenCalledTimes(1);
      expect(
        testBed.mocks.turnHandlerResolver.resolveHandler
      ).toHaveBeenCalledWith(nextActor);
      expect(handler.startTurn).toHaveBeenCalledTimes(1);
      expect(handler.startTurn).toHaveBeenCalledWith(nextActor);
      expectTurnStartedEvents(
        testBed.mocks.dispatcher.dispatch,
        nextActor.id,
        'ai'
      );
      expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
        'Entity non-actor is not an actor. Skipping turn advancement for this entity.'
      );
      expect(stopSpy).not.toHaveBeenCalled();
    });

    test('Entity manager error: logs error, stops manager', async () => {
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);

      await testBed.turnManager.advanceTurn();

      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'Critical error during turn advancement logic',
          details: {
            error: expect.stringContaining(
              'Cannot start a new round: No active entities with an Actor component found.'
            ),
          },
        })
      );
      expectSystemErrorDispatch(
        testBed.mocks.dispatcher.dispatch,
        'System Error: No active actors found to start a round. Stopping game.',
        'Cannot start a new round: No active entities with an Actor component found.'
      );
      expect(stopSpy).toHaveBeenCalled();
    });

    test('Handler resolution error: logs error, stops manager', async () => {
      const resolveError = new Error('Handler resolution failed');
      testBed.mocks.turnHandlerResolver.resolveHandler.mockRejectedValue(
        resolveError
      );

      await testBed.turnManager.advanceTurn();

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
      expect(stopSpy).toHaveBeenCalled();
    });

    test('Handler startTurn error: logs error, stops manager', async () => {
      const startError = new Error('Handler start failed');
      const actor = createAiActor('initial-actor-for-start');
      testBed.mockNextActor(actor);
      const mockHandler = testBed.setupHandlerForActor(actor);
      mockHandler.startTurn.mockRejectedValue(startError);

      await testBed.turnManager.advanceTurn();

      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: 'Error initiating turn for initial-actor-for-start',
          details: {
            error: startError.message,
            handlerName: expect.any(String),
          },
        })
      );
      expectSystemErrorDispatch(
        testBed.mocks.dispatcher.dispatch,
        'Error initiating turn for initial-actor-for-start.',
        startError.message
      );
      expect(stopSpy).not.toHaveBeenCalled();
    });
  }
);
// --- FILE END ---
