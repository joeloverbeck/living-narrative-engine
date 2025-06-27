// src/tests/turns/turnManager.roundLifecycle.test.js
// --- FILE START ---

import { describeRunningTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import { flushPromisesAndTimers } from '../../common/jestHelpers.js';
import {
  expectSystemErrorDispatch,
  triggerTurnEndedAndFlush,
} from '../../common/turns/turnManagerTestUtils.js';
// import removed constant; not needed
import {
  TURN_ENDED_ID,
  TURN_STARTED_ID,
} from '../../../src/constants/eventIds.js';
import { beforeEach, expect, test } from '@jest/globals';
import { createAiActor } from '../../common/turns/testActors.js';

// --- Test Suite ---

describeRunningTurnManagerSuite(
  'TurnManager - Round Lifecycle and Turn Advancement',
  (getBed) => {
    let testBed;
    let stopSpy;

    beforeEach(() => {
      testBed = getBed();
      stopSpy = testBed.spyOnStopNoOp();
      testBed.resetMocks();
    });

    test('Starts a new round when queue is empty and active actors exist', async () => {
      const { ai1, player } = testBed.addDefaultActors();
      testBed.setupHandlerForActor(ai1);
      testBed.setActiveEntities(ai1, player);

      // Debug: verify actor references

      // Mock isEmpty to return true (queue is empty) before the first turn
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true);
      testBed.mocks.turnOrderService.startNewRound.mockResolvedValue();

      await testBed.advanceAndFlush();

      expect(testBed.entityManager.activeEntities.size).toBe(2);
      expect(testBed.mocks.turnOrderService.startNewRound).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: ai1.id }),
          expect.objectContaining({ id: player.id }),
        ]),
        'round-robin'
      );
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        'New round started, recursively calling advanceTurn() to process the first turn.'
      );
    });

    describe('when no active actors are found', () => {
      beforeEach(async () => {
        testBed.setActiveEntities();
        testBed.mockEmptyQueue();
        await testBed.advanceAndFlush();
      });

      test('logs and dispatches an error', () => {
        expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
          'Cannot start a new round: No active entities with an Actor component found.'
        );
        expectSystemErrorDispatch(
          testBed.mocks.dispatcher.dispatch,
          'System Error: No active actors found to start a round. Stopping game.',
          'Cannot start a new round: No active entities with an Actor component found.'
        );
      });

      test('stops the manager', () => {
        expect(stopSpy).toHaveBeenCalledTimes(1);
      });
    });

    test('Advances to next actor when current turn ends successfully', async () => {
      const { ai1, ai2 } = testBed.addDefaultActors();
      testBed.setActiveEntities(ai1, ai2);
      testBed.mockActorSequence(ai1, ai2);

      await testBed.advanceAndFlush();

      expect(testBed.turnManager.getCurrentActor()).toBe(ai1);

      // Simulate turn ending
      testBed.trigger(TURN_ENDED_ID, {
        entityId: ai1.id,
        success: true,
      });
      await flushPromisesAndTimers();

      expect(testBed.turnManager.getCurrentActor()).toBe(ai2);
    });

    test('Correctly identifies actor types for event dispatching', async () => {
      const { ai1, player } = testBed.addDefaultActors();
      testBed.setActiveEntities(player, ai1);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity
        .mockResolvedValueOnce(player)
        .mockResolvedValueOnce(ai1);

      await testBed.advanceAndFlush();

      // Check player actor event
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        {
          entityId: player.id,
          entityType: 'player',
          entity: expect.objectContaining({ id: player.id }),
        }
      );

      // Simulate turn ending and advancing to AI actor
      await triggerTurnEndedAndFlush(testBed, player.id);
      await flushPromisesAndTimers();

      // Check AI actor event
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        {
          entityId: ai1.id,
          entityType: 'ai',
          entity: expect.objectContaining({ id: ai1.id }),
        }
      );
    });

    describe('queue becomes empty after both actors act', () => {
      let ai1, ai2;

      beforeEach(async () => {
        ({ ai1, ai2 } = testBed.addDefaultActors());
        testBed.setActiveEntities(ai1, ai2);
        let isEmptyCallCount = 0;
        testBed.mocks.turnOrderService.isEmpty.mockImplementation(() => {
          isEmptyCallCount++;
          return Promise.resolve(isEmptyCallCount >= 3);
        });
        testBed.mockActorSequence(ai1, ai2, null);
        testBed.mocks.turnOrderService.clearCurrentRound.mockImplementation(
          () => {
            const newActor1 = createAiActor('actor1');
            const newActor2 = createAiActor('actor2');
            testBed.setActiveEntities(newActor1, newActor2);
            return Promise.resolve();
          }
        );
        await testBed.advanceAndFlush();
      });

      test('advances through both actors', async () => {
        expect(testBed.turnManager.getCurrentActor()?.id).toBe(ai1.id);
        await triggerTurnEndedAndFlush(testBed, ai1.id);
        await testBed.waitForCurrentActor(ai2.id);
      });
    });

    test('Handles turn advancement errors gracefully', async () => {
      const { ai1 } = testBed.addDefaultActors();
      testBed.setActiveEntities(ai1);

      testBed.mockNextActor(ai1);
      const advanceError = new Error('Turn advancement failed');
      testBed.mocks.turnHandlerResolver.resolveHandler.mockRejectedValue(
        advanceError
      );

      await testBed.advanceAndFlush();

      expectSystemErrorDispatch(
        testBed.mocks.dispatcher.dispatch,
        'System Error during turn advancement. Stopping game.',
        advanceError.message
      );
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('Handles round start errors gracefully', async () => {
      const { ai1 } = testBed.addDefaultActors();
      testBed.setActiveEntities(ai1);

      testBed.mockEmptyQueue();
      const roundError = new Error('Round start failed');
      testBed.mocks.turnOrderService.startNewRound.mockRejectedValue(
        roundError
      );

      await testBed.advanceAndFlush();

      expectSystemErrorDispatch(
        testBed.mocks.dispatcher.dispatch,
        'System Error: No active actors found to start a round. Stopping game.',
        roundError.message
      );
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });
  }
);

// --- FILE END ---
