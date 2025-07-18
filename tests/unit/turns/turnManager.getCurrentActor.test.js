// src/tests/turns/turnManager.getCurrentActor.test.js
// --- FILE START (Entire file content, Corrected) ---

import { describeTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import { flushPromisesAndTimers } from '../../common/jestHelpers.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { expectTurnStartedEvents } from '../../common/turns/turnManagerTestUtils.js';
import { beforeEach, expect, test } from '@jest/globals';
import { createMockEntity } from '../../common/mockFactories';
import {
  createAiActor,
  createPlayerActor,
} from '../../common/turns/testActors.js';
import { createMockTurnHandler } from '../../common/mockFactories.js';

// Mock Turn Handlers
const mockPlayerHandler = createMockTurnHandler();
const mockAiHandler = createMockTurnHandler();

describeTurnManagerSuite('TurnManager', (getBed) => {
  let testBed;

  beforeEach(() => {
    testBed = getBed();

    testBed.addDefaultActors();
    testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
      mockAiHandler
    );

    // Clear handler mocks
    mockPlayerHandler.startTurn.mockClear().mockResolvedValue();
    mockAiHandler.startTurn.mockClear().mockResolvedValue();
    mockPlayerHandler.destroy.mockClear().mockResolvedValue();
    mockAiHandler.destroy.mockClear().mockResolvedValue();
  });

  afterEach(() => {
    // Timer cleanup handled by BaseTestBed
  });

  // Basic sanity tests are covered by tests/unit/turns/turnManager.base.test.js

  // --- Tests for getCurrentActor() ---
  describe('getCurrentActor()', () => {
    test('should return null initially', () => {
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
    });

    test('should return the assigned actor after start and advanceTurn assigns one', async () => {
      const mockActor = createAiActor('actor-test');
      const entityType = 'ai'; // Define expected type

      // --- Setup mocks for start() -> advanceTurn() path ---
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false); // Queue not empty
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor); // Return our actor
      // Configure resolver to return the AI handler WHEN called with this specific actor
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
        mockAiHandler
      );

      // --- Execute ---
      await testBed.turnManager.start(); // Calls advanceTurn internally

      // --- Assert ---
      expect(testBed.turnManager.getCurrentActor()).toBe(mockActor);
      expect(
        testBed.mocks.turnHandlerResolver.resolveHandler
      ).toHaveBeenCalledWith(mockActor);
      expect(mockAiHandler.startTurn).toHaveBeenCalledWith(mockActor);
      expectTurnStartedEvents(
        testBed.mocks.dispatcher.dispatch,
        mockActor.id,
        entityType
      );
    });

    test('should return null after stop() clears the current actor', async () => {
      const mockActor = createAiActor('actor-test');

      // --- Setup mocks ---
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor);
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
        mockAiHandler
      );

      // --- Execute ---
      await testBed.turnManager.start();
      expect(testBed.turnManager.getCurrentActor()).toBe(mockActor);

      await testBed.turnManager.stop();

      // --- Assert ---
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
      expect(mockAiHandler.destroy).toHaveBeenCalled();
    });

    test('should return the correct actor when multiple actors are in the queue', async () => {
      const mockActor1 = createAiActor('actor1');
      const mockActor2 = createAiActor('actor2');

      // --- Setup mocks for sequential actors ---
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity
        .mockResolvedValueOnce(mockActor1)
        .mockResolvedValueOnce(mockActor2);
      testBed.mocks.turnHandlerResolver.resolveHandler
        .mockResolvedValueOnce(mockAiHandler)
        .mockResolvedValueOnce(mockAiHandler);

      // --- Execute ---
      await testBed.turnManager.start();
      expect(testBed.turnManager.getCurrentActor()).toBe(mockActor1);

      // Simulate turn ending and advancing to next actor
      testBed.trigger('core:turn_ended', {
        entityId: mockActor1.id,
        success: true,
      });
      await flushPromisesAndTimers();
      await flushPromisesAndTimers();

      // --- Assert ---
      expect(testBed.turnManager.getCurrentActor()).toBe(mockActor2);
    });

    test('should return null when queue becomes empty', async () => {
      const mockActor = createAiActor('actor-test');

      // --- Setup mocks ---
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor);
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
        mockAiHandler
      );

      // --- Execute ---
      await testBed.turnManager.start();
      expect(testBed.turnManager.getCurrentActor()).toBe(mockActor);

      // Simulate queue becoming empty
      testBed.mockEmptyQueue();
      testBed.setActiveEntities();

      // Simulate turn ending
      testBed.trigger('core:turn_ended', {
        entityId: mockActor.id,
        success: true,
      });
      await flushPromisesAndTimers();
      await flushPromisesAndTimers();

      // --- Assert ---
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
    });

    test('should handle player vs AI actor types correctly', async () => {
      const mockPlayerActor = createPlayerActor('player-actor');
      const mockAiActor = createAiActor('ai-actor');

      // Test player actor
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(
        mockPlayerActor
      );
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
        mockPlayerHandler
      );

      await testBed.turnManager.start();
      expect(testBed.turnManager.getCurrentActor()).toBe(mockPlayerActor);
      expectTurnStartedEvents(
        testBed.mocks.dispatcher.dispatch,
        mockPlayerActor.id,
        'player'
      );

      await testBed.turnManager.stop();

      // Test AI actor
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(
        mockAiActor
      );
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(
        mockAiHandler
      );

      await testBed.turnManager.start();
      expect(testBed.turnManager.getCurrentActor()).toBe(mockAiActor);
      expectTurnStartedEvents(
        testBed.mocks.dispatcher.dispatch,
        mockAiActor.id,
        'ai'
      );
    });

    test('should return null when no valid actor is found', async () => {
      const mockNonActor = createMockEntity('non-actor', {
        isActor: false,
        isPlayer: false,
      });

      // --- Setup mocks ---
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(
        mockNonActor
      );

      // --- Execute ---
      await testBed.turnManager.start();

      // --- Assert ---
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
      expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
        'Entity non-actor is not an actor. Skipping turn advancement for this entity.'
      );
    });

    test('should handle entity manager errors gracefully', async () => {
      // --- Setup mocks ---
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      // Simulate getNextEntity returning null to trigger the error condition
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);
      testBed.setActiveEntities();

      // --- Execute ---
      await testBed.turnManager.start();

      // --- Assert ---
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
      expect(testBed.mocks.dispatcher.dispatch.mock.calls).toEqual(
        expect.arrayContaining([
          [
            SYSTEM_ERROR_OCCURRED_ID,
            expect.objectContaining({
              message: expect.any(String),
              details: expect.objectContaining({
                error: expect.stringContaining(
                  'Cannot start a new round: No active entities with an Actor component found.'
                ),
              }),
            }),
          ],
        ])
      );
    });
  });
});
// --- FILE END ---
