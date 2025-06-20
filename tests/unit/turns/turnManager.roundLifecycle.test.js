// src/tests/turns/turnManager.roundLifecycle.test.js
// --- FILE START ---

import {
  describeTurnManagerSuite,
  flushPromisesAndTimers,
} from '../../common/turns/turnManagerTestBed.js';
import { ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import {
  TURN_ENDED_ID,
  TURN_STARTED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';
import { beforeEach, expect, jest, test, afterEach } from '@jest/globals';
import {
  createDefaultActors,
  createAiActor,
} from '../../common/turns/testActors.js';
import {
  createMockEntity,
  createMockTurnHandler,
} from '../../common/mockFactories.js';

// --- Test Suite ---

describeTurnManagerSuite(
  'TurnManager - Round Lifecycle and Turn Advancement',
  (getBed) => {
    let testBed;
    let stopSpy;

    let ai1, ai2, player;

    beforeEach(() => {
      jest.useFakeTimers();
      testBed = getBed();

      testBed.initializeDefaultMocks();
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);

      ({ ai1, ai2, player } = createDefaultActors());

      // Configure handler resolver to return MockTurnHandler instances
      testBed.mocks.turnHandlerResolver.resolveHandler.mockImplementation(
        async (actor) => {
          const handler = createMockTurnHandler({ actor });
          handler.startTurn = (_currentActor) => Promise.resolve();

          return handler;
        }
      );

      stopSpy = jest.spyOn(testBed.turnManager, 'stop');

      testBed.mocks.logger.info.mockClear();
      testBed.mocks.logger.debug.mockClear();
      testBed.mocks.logger.warn.mockClear();
      testBed.mocks.logger.error.mockClear();
    });

    afterEach(async () => {
      jest.clearAllMocks();
      jest.clearAllTimers();
    });

    test('Starts a new round when queue is empty and active actors exist', async () => {
      testBed.setActiveEntities(ai1, player);

      // Debug: verify actors
      const entities = Array.from(testBed.entityManager.entities);

      // Entities have ACTOR_COMPONENT_ID component or not; not logged

      // Mock isEmpty to return true (queue is empty) before the first turn
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValueOnce(true);
      testBed.mocks.turnOrderService.startNewRound.mockResolvedValue();

      await testBed.turnManager.start();
      await flushPromisesAndTimers();

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

    test('Fails to start a new round and stops if no active actors are found', async () => {
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(true);

      await testBed.turnManager.start();
      await flushPromisesAndTimers();

      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        'Cannot start a new round: No active entities with an Actor component found.'
      );
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        {
          message:
            'System Error: No active actors found to start a round. Stopping game.',
          details: {
            raw: 'Cannot start a new round: No active entities with an Actor component found.',
            stack: expect.any(String),
            timestamp: expect.any(String),
          },
        }
      );
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('Advances to next actor when current turn ends successfully', async () => {
      testBed.setActiveEntities(ai1, ai2);

      // Debug: print references
      testBed.mocks.turnOrderService.getNextEntity.mockImplementation(() => {
        const result =
          testBed.mocks.turnOrderService.getNextEntity.mock.calls.length === 1
            ? ai1
            : ai2;
        return Promise.resolve(result);
      });

      await testBed.turnManager.start();
      await flushPromisesAndTimers();

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
      // Use real timers for this test since turn advancement uses setTimeout
      jest.useRealTimers();

      testBed.setActiveEntities(player, ai1);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity
        .mockResolvedValueOnce(player)
        .mockResolvedValueOnce(ai1);

      await testBed.turnManager.start();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for initial turn advancement

      // Check player actor event
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        {
          entityId: player.id,
          entityType: 'player',
        }
      );

      // Simulate turn ending and advancing to AI actor
      testBed.trigger(TURN_ENDED_ID, {
        entityId: player.id,
        success: true,
      });
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for async turn advancement
      await new Promise((resolve) => setTimeout(resolve, 10)); // Additional wait

      // Check AI actor event
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        {
          entityId: ai1.id,
          entityType: 'ai',
        }
      );
    });

    test('Starts new round when queue becomes empty after turn ends', async () => {
      // Use real timers for this test since turn advancement uses setTimeout
      jest.useRealTimers();

      testBed.setActiveEntities(ai1, ai2);

      // Set up mocks to simulate the queue state changes
      let isEmptyCallCount = 0;
      let getNextEntityCallCount = 0;

      testBed.mocks.turnOrderService.isEmpty.mockImplementation(() => {
        isEmptyCallCount++;
        // First call: queue not empty (during initial turn advancement)
        // Second call: queue not empty (after first actor's turn ends)
        // Third call: queue empty (after second actor's turn ends)
        return Promise.resolve(isEmptyCallCount >= 3);
      });

      testBed.mocks.turnOrderService.getNextEntity.mockImplementation(() => {
        getNextEntityCallCount++;
        // First call: return first actor
        // Second call: return second actor
        if (getNextEntityCallCount === 1) {
          return Promise.resolve(ai1);
        } else if (getNextEntityCallCount === 2) {
          return Promise.resolve(ai2);
        }
        return Promise.resolve(null);
      });

      // Mock clearCurrentRound to repopulate activeEntities for the new round
      testBed.mocks.turnOrderService.clearCurrentRound.mockImplementation(
        () => {
          // Create fresh mock actors for the new round
          const newActor1 = createAiActor('actor1');
          const newActor2 = createAiActor('actor2');
          testBed.setActiveEntities(newActor1, newActor2);
          return Promise.resolve();
        }
      );

      await testBed.turnManager.start();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for initial turn advancement

      // Verify first actor is current
      expect(testBed.turnManager.getCurrentActor()?.id).toBe(ai1.id);

      // Simulate turn ending for actor1 (success: true)
      testBed.trigger(TURN_ENDED_ID, { entityId: ai1.id, success: true });

      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for async turn advancement

      // Wait for TurnManager to advance to ai2
      let found = false;
      for (let i = 0; i < 50; i++) {
        if (testBed.turnManager.getCurrentActor()?.id === ai2.id) {
          found = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(found).toBe(true);

      // Simulate turn ending for actor2 (success: true)
      testBed.trigger(TURN_ENDED_ID, { entityId: ai2.id, success: true });

      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for async turn advancement

      // Wait for the TurnManager to process and start a new round
      let roundStarted = false;
      for (let i = 0; i < 50; i++) {
        if (
          testBed.mocks.turnOrderService.startNewRound.mock.calls.length > 0
        ) {
          roundStarted = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(roundStarted).toBe(true);
    });

    test('Handles turn advancement errors gracefully', async () => {
      testBed.setActiveEntities(ai1);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(ai1);
      const advanceError = new Error('Turn advancement failed');
      testBed.mocks.turnHandlerResolver.resolveHandler.mockRejectedValue(
        advanceError
      );

      await testBed.turnManager.start();
      await flushPromisesAndTimers();

      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        'CRITICAL Error during turn advancement logic (before handler initiation): Turn advancement failed',
        advanceError
      );
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          details: {
            raw: advanceError.message,
            stack: expect.any(String),
            timestamp: expect.any(String),
          },
        })
      );
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('Handles round start errors gracefully', async () => {
      testBed.setActiveEntities(ai1);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(true);
      const roundError = new Error('Round start failed');
      testBed.mocks.turnOrderService.startNewRound.mockRejectedValue(
        roundError
      );

      await testBed.turnManager.start();
      await flushPromisesAndTimers();

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
  }
);

// --- FILE END ---
