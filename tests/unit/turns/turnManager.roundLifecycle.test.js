// src/tests/turns/turnManager.roundLifecycle.test.js
// --- FILE START ---

import { describeTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import {
  TURN_ENDED_ID,
  TURN_STARTED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../../src/constants/eventIds.js';
import { beforeEach, expect, jest, test, afterEach } from '@jest/globals';
import { createMockEntity } from '../../common/mockFactories.js';

// --- Mock Implementations (Reusing from previous files) ---

class MockEntity {
  constructor(id, components = []) {
    this.id = id || `entity-${Math.random().toString(36).substr(2, 9)}`;
    this.components = new Map(components.map((c) => [c, {}]));
    this.hasComponent = jest.fn((componentId) =>
      this.components.has(componentId)
    );
    this.getComponent = jest.fn((componentId) =>
      this.components.get(componentId)
    );
  }
}

class MockTurnHandler {
  constructor(actor) {
    this.actor = actor;
    this.startTurn = jest.fn(async (currentActor) => {});
    this.destroy = jest.fn(async () => {});
    this.signalNormalApparentTermination = jest.fn();
  }
}

// --- Test Suite ---

describeTurnManagerSuite(
  'TurnManager - Round Lifecycle and Turn Advancement',
  (getBed) => {
    let testBed;
    let stopSpy;

    let mockActor1, mockActor2, mockPlayerActor;

    beforeEach(() => {
      jest.useFakeTimers();
      testBed = getBed();

      mockActor1 = createMockEntity('actor1', {
        isActor: true,
        isPlayer: false,
      });
      mockActor2 = createMockEntity('actor2', {
        isActor: true,
        isPlayer: false,
      });
      mockPlayerActor = createMockEntity('player1', {
        isActor: true,
        isPlayer: true,
      });

      // Configure handler resolver to return MockTurnHandler instances
      testBed.mocks.turnHandlerResolver.resolveHandler.mockImplementation(
        async (actor) => new MockTurnHandler(actor)
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
      testBed.setActiveEntities(mockActor1, mockPlayerActor);

      testBed.mocks.turnOrderService.isEmpty
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValueOnce(
        mockPlayerActor
      );

      await testBed.turnManager.start();
      jest.runAllTimers();
      await Promise.resolve();

      expect(testBed.mocks.entityManager.activeEntities.size).toBe(2);
      expect(testBed.mocks.turnOrderService.startNewRound).toHaveBeenCalledWith(
        expect.arrayContaining([mockActor1, mockPlayerActor]),
        'round-robin'
      );
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        'New round started, recursively calling advanceTurn() to process the first turn.'
      );
      expect(
        testBed.mocks.turnOrderService.getNextEntity
      ).toHaveBeenCalledTimes(1);
      expect(
        testBed.mocks.turnHandlerResolver.resolveHandler
      ).toHaveBeenCalledWith(mockPlayerActor);
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        {
          entityId: mockPlayerActor.id,
          entityType: 'player',
        }
      );
    });

    test('Fails to start a new round and stops if no active actors are found', async () => {
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(true);

      await testBed.turnManager.start();
      jest.runAllTimers();
      await Promise.resolve();

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
      // Use real timers for this test since turn advancement uses setTimeout
      jest.useRealTimers();

      testBed.setActiveEntities(mockActor1, mockActor2);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity
        .mockResolvedValueOnce(mockActor1)
        .mockResolvedValueOnce(mockActor2);

      await testBed.turnManager.start();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for initial turn advancement

      expect(testBed.turnManager.getCurrentActor()).toBe(mockActor1);

      // Simulate turn ending
      testBed.trigger(TURN_ENDED_ID, {
        entityId: mockActor1.id,
        success: true,
      });
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for async turn advancement
      await new Promise((resolve) => setTimeout(resolve, 10)); // Additional wait

      expect(testBed.turnManager.getCurrentActor()).toBe(mockActor2);
      expect(
        testBed.mocks.turnOrderService.getNextEntity
      ).toHaveBeenCalledTimes(2);
    });

    test('Starts new round when queue becomes empty after turn ends', async () => {
      testBed.setActiveEntities(mockActor1, mockActor2);

      testBed.mocks.turnOrderService.isEmpty
        .mockResolvedValueOnce(false) // Initial queue not empty
        .mockResolvedValueOnce(true); // Queue becomes empty after first turn
      testBed.mocks.turnOrderService.getNextEntity
        .mockResolvedValueOnce(mockActor1) // First actor
        .mockResolvedValueOnce(null); // No more actors

      await testBed.turnManager.start();
      jest.runAllTimers();
      await Promise.resolve();

      expect(testBed.turnManager.getCurrentActor()).toBe(mockActor1);

      // Simulate turn ending
      testBed.trigger(TURN_ENDED_ID, {
        entityId: mockActor1.id,
        success: true,
      });
      jest.runAllTimers();
      await Promise.resolve();

      expect(testBed.mocks.turnOrderService.startNewRound).toHaveBeenCalledWith(
        expect.arrayContaining([mockActor1, mockActor2]),
        'round-robin'
      );
    });

    test('Handles turn advancement errors gracefully', async () => {
      testBed.setActiveEntities(mockActor1);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(
        mockActor1
      );
      const advanceError = new Error('Turn advancement failed');
      testBed.mocks.turnHandlerResolver.resolveHandler.mockRejectedValue(
        advanceError
      );

      await testBed.turnManager.start();
      jest.runAllTimers();
      await Promise.resolve();

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
      testBed.setActiveEntities(mockActor1);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(true);
      const roundError = new Error('Round start failed');
      testBed.mocks.turnOrderService.startNewRound.mockRejectedValue(
        roundError
      );

      await testBed.turnManager.start();
      jest.runAllTimers();
      await Promise.resolve();

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

    test('Correctly identifies actor types for event dispatching', async () => {
      // Use real timers for this test since turn advancement uses setTimeout
      jest.useRealTimers();

      testBed.setActiveEntities(mockPlayerActor, mockActor1);

      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity
        .mockResolvedValueOnce(mockPlayerActor)
        .mockResolvedValueOnce(mockActor1);

      await testBed.turnManager.start();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for initial turn advancement

      // Check player actor event
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        {
          entityId: mockPlayerActor.id,
          entityType: 'player',
        }
      );

      // Simulate turn ending and advancing to AI actor
      testBed.trigger(TURN_ENDED_ID, {
        entityId: mockPlayerActor.id,
        success: true,
      });
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for async turn advancement
      await new Promise((resolve) => setTimeout(resolve, 10)); // Additional wait

      // Check AI actor event
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        {
          entityId: mockActor1.id,
          entityType: 'ai',
        }
      );
    });
  }
);

// --- FILE END ---
