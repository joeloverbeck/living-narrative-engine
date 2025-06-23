// src/tests/turns/turnManager.roundLifecycle.test.js
// --- FILE START ---

import { describeRunningTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import { flushPromisesAndTimers } from '../../common/jestHelpers.js';
import {
  waitForCurrentActor,
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

    let ai1, ai2, player;

    beforeEach(() => {
      testBed = getBed();
      ({ ai1, ai2, player } = testBed.addDefaultActors());
      testBed.setupHandlerForActor(ai1);
      stopSpy = testBed.setupStopSpyNoOp();
      testBed.resetMocks();
    });

    test('Starts a new round when queue is empty and active actors exist', async () => {
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
      testBed.setActiveEntities(ai1, ai2);
      testBed.mockNextActor(ai1);
      testBed.mocks.turnOrderService.getNextEntity.mockImplementation(() => {
        const result =
          testBed.mocks.turnOrderService.getNextEntity.mock.calls.length === 1
            ? ai1
            : ai2;
        return Promise.resolve(result);
      });

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
        }
      );
    });

    describe('queue becomes empty after both actors act', () => {
      beforeEach(async () => {
        testBed.setActiveEntities(ai1, ai2);
        let isEmptyCallCount = 0;
        let getNextEntityCallCount = 0;
        testBed.mocks.turnOrderService.isEmpty.mockImplementation(() => {
          isEmptyCallCount++;
          return Promise.resolve(isEmptyCallCount >= 3);
        });
        testBed.mocks.turnOrderService.getNextEntity.mockImplementation(() => {
          getNextEntityCallCount++;
          if (getNextEntityCallCount === 1) return Promise.resolve(ai1);
          if (getNextEntityCallCount === 2) return Promise.resolve(ai2);
          return Promise.resolve(null);
        });
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
        const found = await waitForCurrentActor(testBed, ai2.id);
        expect(found).toBe(true);
      });
    });

    test('Handles turn advancement errors gracefully', async () => {
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
