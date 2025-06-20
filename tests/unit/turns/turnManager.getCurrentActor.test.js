// src/tests/turns/turnManager.getCurrentActor.test.js
// --- FILE START (Entire file content, Corrected) ---

import { TurnManagerTestBed } from '../../common/turns/turnManagerTestBed.js';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { TURN_PROCESSING_STARTED } from '../../../src/constants/eventIds.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { createMockEntity } from '../../common/mockFactories.js';

// Mock Turn Handlers - ADD startTurn and destroy
const mockPlayerHandler = {
  constructor: { name: 'MockPlayerHandler' },
  startTurn: jest.fn().mockResolvedValue(),
  destroy: jest.fn().mockResolvedValue(),
};
const mockAiHandler = {
  constructor: { name: 'MockAiHandler' },
  startTurn: jest.fn().mockResolvedValue(),
  destroy: jest.fn().mockResolvedValue(),
};

describe('TurnManager', () => {
  let testBed;
  let mockPlayerEntity;
  let mockAiEntity1;
  let mockAiEntity2;

  beforeEach(() => {
    testBed = new TurnManagerTestBed();

    // Create fresh mock entities
    mockPlayerEntity = createMockEntity('player-1', { isActor: true, isPlayer: true });
    mockAiEntity1 = createMockEntity('ai-1', { isActor: true, isPlayer: false });
    mockAiEntity2 = createMockEntity('ai-2', { isActor: true, isPlayer: false });

    // Configure default mock behaviors
    testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(true);
    testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);
    testBed.mocks.turnOrderService.startNewRound.mockResolvedValue();
    testBed.mocks.turnOrderService.clearCurrentRound.mockResolvedValue();
    testBed.mocks.dispatcher.dispatch.mockReset().mockResolvedValue(true);
    testBed.mocks.turnHandlerResolver.resolveHandler
      .mockReset()
      .mockResolvedValue(mockAiHandler);

    // Clear handler mocks
    mockPlayerHandler.startTurn.mockClear().mockResolvedValue();
    mockAiHandler.startTurn.mockClear().mockResolvedValue();
    mockPlayerHandler.destroy.mockClear().mockResolvedValue();
    mockAiHandler.destroy.mockClear().mockResolvedValue();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  // --- Basic Setup Tests ---
  test('should exist and be a class', () => {
    const instance = new TurnManagerTestBed().turnManager;
    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(testBed.turnManager.constructor);
  });

  test('mock entities should behave as configured', () => {
    expect(mockPlayerEntity.id).toBe('player-1');
    expect(mockPlayerEntity.hasComponent(ACTOR_COMPONENT_ID)).toBe(true);
    expect(mockPlayerEntity.hasComponent(PLAYER_COMPONENT_ID)).toBe(true);
    expect(mockAiEntity1.hasComponent(PLAYER_COMPONENT_ID)).toBe(false);
  });

  test('EntityManager mock allows setting active entities', () => {
    const entities = [mockPlayerEntity, mockAiEntity1];
    testBed.setActiveEntities(...entities);
    expect(Array.from(testBed.mocks.entityManager.activeEntities.values())).toEqual(
      entities
    );
    expect(testBed.mocks.entityManager.activeEntities.get('player-1')).toBe(
      mockPlayerEntity
    );
  });

  // --- Tests for getCurrentActor() ---
  describe('getCurrentActor()', () => {
    test('should return null initially', () => {
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
    });

    test('should return the assigned actor after start and advanceTurn assigns one', async () => {
      const mockActor = createMockEntity('actor-test', { isActor: true, isPlayer: false });
      const entityType = 'ai'; // Define expected type

      // --- Setup mocks for start() -> advanceTurn() path ---
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false); // Queue not empty
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor); // Return our actor
      // Configure resolver to return the AI handler WHEN called with this specific actor
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(mockAiHandler);

      // --- Execute ---
      await testBed.turnManager.start(); // Calls advanceTurn internally

      // --- Assert ---
      expect(testBed.turnManager.getCurrentActor()).toBe(mockActor);
      expect(testBed.mocks.turnHandlerResolver.resolveHandler).toHaveBeenCalledWith(mockActor);
      expect(mockAiHandler.startTurn).toHaveBeenCalledWith(mockActor);
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        TURN_PROCESSING_STARTED,
        { entityId: mockActor.id, actorType: entityType }
      );
    });

    test('should return null after stop() clears the current actor', async () => {
      const mockActor = createMockEntity('actor-test', { isActor: true, isPlayer: false });

      // --- Setup mocks ---
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor);
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(mockAiHandler);

      // --- Execute ---
      await testBed.turnManager.start();
      expect(testBed.turnManager.getCurrentActor()).toBe(mockActor);

      await testBed.turnManager.stop();

      // --- Assert ---
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
      expect(mockAiHandler.destroy).toHaveBeenCalled();
    });

    test('should return the correct actor when multiple actors are in the queue', async () => {
      const mockActor1 = createMockEntity('actor1', { isActor: true, isPlayer: false });
      const mockActor2 = createMockEntity('actor2', { isActor: true, isPlayer: false });

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
      testBed.trigger('core:turn_ended', { entityId: mockActor1.id, success: true });
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow async operations
      await new Promise(resolve => setTimeout(resolve, 10)); // Additional wait for advanceTurn

      // --- Assert ---
      expect(testBed.turnManager.getCurrentActor()).toBe(mockActor2);
    });

    test('should return null when queue becomes empty', async () => {
      const mockActor = createMockEntity('actor-test', { isActor: true, isPlayer: false });

      // --- Setup mocks ---
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockActor);
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(mockAiHandler);

      // --- Execute ---
      await testBed.turnManager.start();
      expect(testBed.turnManager.getCurrentActor()).toBe(mockActor);

      // Simulate queue becoming empty
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(true);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);

      // Simulate turn ending
      testBed.trigger('core:turn_ended', { entityId: mockActor.id, success: true });
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow async operations
      await new Promise(resolve => setTimeout(resolve, 10)); // Additional wait for advanceTurn

      // --- Assert ---
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
    });

    test('should handle player vs AI actor types correctly', async () => {
      const mockPlayerActor = createMockEntity('player-actor', { isActor: true, isPlayer: true });
      const mockAiActor = createMockEntity('ai-actor', { isActor: true, isPlayer: false });

      // Test player actor
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockPlayerActor);
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(mockPlayerHandler);

      await testBed.turnManager.start();
      expect(testBed.turnManager.getCurrentActor()).toBe(mockPlayerActor);
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        TURN_PROCESSING_STARTED,
        { entityId: mockPlayerActor.id, actorType: 'player' }
      );

      await testBed.turnManager.stop();

      // Test AI actor
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockAiActor);
      testBed.mocks.turnHandlerResolver.resolveHandler.mockResolvedValue(mockAiHandler);

      await testBed.turnManager.start();
      expect(testBed.turnManager.getCurrentActor()).toBe(mockAiActor);
      expect(testBed.mocks.dispatcher.dispatch).toHaveBeenCalledWith(
        TURN_PROCESSING_STARTED,
        { entityId: mockAiActor.id, actorType: 'ai' }
      );
    });

    test('should return null when no valid actor is found', async () => {
      const mockNonActor = createMockEntity('non-actor', { isActor: false, isPlayer: false });

      // --- Setup mocks ---
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(mockNonActor);

      // --- Execute ---
      await testBed.turnManager.start();

      // --- Assert ---
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
      expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
        'Entity non-actor is not an actor. Skipping turn advancement for this entity.'
      );
    });

    test('should handle entity manager errors gracefully', async () => {
      const mockActor = createMockEntity('actor-test', { isActor: true, isPlayer: false });

      // --- Setup mocks ---
      testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
      // Simulate getNextEntity returning null to trigger the error condition
      testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(null);

      // --- Execute ---
      await testBed.turnManager.start();

      // --- Assert ---
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        'Turn order inconsistency: getNextEntity() returned null/undefined when queue was not empty.'
      );
    });
  });
});
// --- FILE END ---
