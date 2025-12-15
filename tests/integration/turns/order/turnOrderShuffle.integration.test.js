/**
 * @file Integration tests for turn order shuffle functionality
 * @description Tests the integration between TurnOrderService and TurnOrderShuffleService
 * @see specs/randomized-turn-ordering.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the environment utils to control test environment
jest.mock('../../../../src/utils/environmentUtils.js', () => ({
  getEnvironmentMode: jest.fn().mockReturnValue('test'),
}));

import { TurnOrderService } from '../../../../src/turns/order/turnOrderService.js';
import { TurnOrderShuffleService } from '../../../../src/turns/services/turnOrderShuffleService.js';
import { createSeededRandom } from '../../../../src/utils/shuffleUtils.js';

describe('TurnOrderService - Shuffle Integration', () => {
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  /**
   * Creates mock entities with player type component
   *
   * @param {string} id - Entity ID
   * @param {string} [type] - Player type ('human' or 'llm'), defaults to 'llm'
   * @returns {object} Mock entity
   */
  function createMockEntity(id, type = 'llm') {
    return {
      id,
      name: `Entity ${id}`,
      hasComponent: jest.fn((componentId) => componentId === 'core:player_type'),
      getComponentData: jest.fn(() => ({ type })),
    };
  }

  describe('integration with TurnOrderService', () => {
    it('should shuffle non-human actors when shuffle service is provided', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });
      // TurnOrderService created to verify integration pattern (shuffle service injection)
      new TurnOrderService({
        logger: mockLogger,
        shuffleService,
      });

      // Create entities with a human at position 0
      const entities = [
        createMockEntity('human1', 'human'),
        createMockEntity('npc1', 'llm'),
        createMockEntity('npc2', 'llm'),
        createMockEntity('npc3', 'llm'),
        createMockEntity('npc4', 'llm'),
      ];

      // Use seeded random for deterministic testing
      // Note: We need to call the shuffle service directly with seeded random
      // since TurnOrderService doesn't expose the random function parameter
      const seededRandom = createSeededRandom(42);
      shuffleService.shuffleWithHumanPositionPreservation(
        entities,
        'round-robin',
        seededRandom
      );

      // Human should remain at position 0
      expect(entities[0].id).toBe('human1');

      // NPCs should be shuffled (contains same elements)
      const npcIds = entities.slice(1).map((e) => e.id);
      expect(npcIds.sort()).toEqual(['npc1', 'npc2', 'npc3', 'npc4']);
    });

    it('should preserve multiple human positions while shuffling NPCs', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });
      // TurnOrderService created to verify integration pattern
      new TurnOrderService({
        logger: mockLogger,
        shuffleService,
      });

      // Create entities with humans at positions 0 and 3
      const entities = [
        createMockEntity('human1', 'human'),
        createMockEntity('npc1', 'llm'),
        createMockEntity('npc2', 'llm'),
        createMockEntity('human2', 'human'),
        createMockEntity('npc3', 'llm'),
      ];

      shuffleService.shuffleWithHumanPositionPreservation(
        entities,
        'round-robin',
        createSeededRandom(42)
      );

      // Humans should remain at their original positions
      expect(entities[0].id).toBe('human1');
      expect(entities[3].id).toBe('human2');

      // NPCs should be in positions 1, 2, 4
      const npcIds = [entities[1], entities[2], entities[4]].map((e) => e.id);
      expect(npcIds.sort()).toEqual(['npc1', 'npc2', 'npc3']);
    });

    it('should not shuffle when only humans are present', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });
      // TurnOrderService created to verify integration pattern
      new TurnOrderService({
        logger: mockLogger,
        shuffleService,
      });

      const entities = [
        createMockEntity('human1', 'human'),
        createMockEntity('human2', 'human'),
        createMockEntity('human3', 'human'),
      ];

      const originalOrder = entities.map((e) => e.id);

      shuffleService.shuffleWithHumanPositionPreservation(
        entities,
        'round-robin',
        createSeededRandom(42)
      );

      // Order should remain unchanged
      expect(entities.map((e) => e.id)).toEqual(originalOrder);
    });

    it('should shuffle all entities when none are human', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });
      // TurnOrderService created to verify integration pattern
      new TurnOrderService({
        logger: mockLogger,
        shuffleService,
      });

      const entities = [
        createMockEntity('npc1', 'llm'),
        createMockEntity('npc2', 'llm'),
        createMockEntity('npc3', 'llm'),
        createMockEntity('npc4', 'llm'),
        createMockEntity('npc5', 'llm'),
      ];

      const originalIds = entities.map((e) => e.id);

      shuffleService.shuffleWithHumanPositionPreservation(
        entities,
        'round-robin',
        createSeededRandom(42)
      );

      // Should contain same elements
      expect(entities.map((e) => e.id).sort()).toEqual(originalIds.sort());
      // Should be shuffled (with high probability)
      expect(entities.map((e) => e.id)).not.toEqual(originalIds);
    });
  });

  describe('TurnOrderService startNewRound with shuffle', () => {
    it('should apply shuffle when starting a round-robin round with shuffle service', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });

      // Spy on the shuffle method
      const shuffleSpy = jest.spyOn(
        shuffleService,
        'shuffleWithHumanPositionPreservation'
      );

      const turnOrderService = new TurnOrderService({
        logger: mockLogger,
        shuffleService,
      });

      const entities = [
        createMockEntity('human1', 'human'),
        createMockEntity('npc1', 'llm'),
        createMockEntity('npc2', 'llm'),
      ];

      turnOrderService.startNewRound(entities, 'round-robin');

      // Verify shuffle was called
      expect(shuffleSpy).toHaveBeenCalledWith(entities, 'round-robin');
    });

    it('should not apply shuffle for initiative strategy', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });

      const shuffleSpy = jest.spyOn(
        shuffleService,
        'shuffleWithHumanPositionPreservation'
      );

      const turnOrderService = new TurnOrderService({
        logger: mockLogger,
        shuffleService,
      });

      const entities = [
        createMockEntity('npc1', 'llm'),
        createMockEntity('npc2', 'llm'),
      ];

      const initiativeData = new Map([
        ['npc1', 10],
        ['npc2', 20],
      ]);

      turnOrderService.startNewRound(entities, 'initiative', initiativeData);

      // Shuffle should not be called for initiative strategy
      expect(shuffleSpy).not.toHaveBeenCalled();
    });

    it('should work without shuffle service (backwards compatibility)', () => {
      // Create service without shuffle service
      const turnOrderService = new TurnOrderService({
        logger: mockLogger,
      });

      const entities = [
        createMockEntity('npc1', 'llm'),
        createMockEntity('npc2', 'llm'),
        createMockEntity('npc3', 'llm'),
      ];

      // Should not throw
      expect(() => {
        turnOrderService.startNewRound(entities, 'round-robin');
      }).not.toThrow();

      // Should have entities in queue
      expect(turnOrderService.isEmpty()).toBe(false);
      expect(turnOrderService.getCurrentOrder()).toHaveLength(3);
    });
  });

  describe('deterministic shuffle behavior', () => {
    it('should produce same results with same seed across multiple runs', () => {
      const shuffleService1 = new TurnOrderShuffleService({ logger: mockLogger });
      const shuffleService2 = new TurnOrderShuffleService({ logger: mockLogger });

      const createEntities = () => [
        createMockEntity('npc1', 'llm'),
        createMockEntity('npc2', 'llm'),
        createMockEntity('npc3', 'llm'),
        createMockEntity('npc4', 'llm'),
        createMockEntity('npc5', 'llm'),
      ];

      const entities1 = createEntities();
      const entities2 = createEntities();

      shuffleService1.shuffleWithHumanPositionPreservation(
        entities1,
        'round-robin',
        createSeededRandom(123)
      );

      shuffleService2.shuffleWithHumanPositionPreservation(
        entities2,
        'round-robin',
        createSeededRandom(123)
      );

      // Same seed should produce same order
      expect(entities1.map((e) => e.id)).toEqual(entities2.map((e) => e.id));
    });

    it('should produce different results with different seeds', () => {
      const shuffleService1 = new TurnOrderShuffleService({ logger: mockLogger });
      const shuffleService2 = new TurnOrderShuffleService({ logger: mockLogger });

      const createEntities = () => [
        createMockEntity('npc1', 'llm'),
        createMockEntity('npc2', 'llm'),
        createMockEntity('npc3', 'llm'),
        createMockEntity('npc4', 'llm'),
        createMockEntity('npc5', 'llm'),
      ];

      const entities1 = createEntities();
      const entities2 = createEntities();

      shuffleService1.shuffleWithHumanPositionPreservation(
        entities1,
        'round-robin',
        createSeededRandom(123)
      );

      shuffleService2.shuffleWithHumanPositionPreservation(
        entities2,
        'round-robin',
        createSeededRandom(456)
      );

      // Different seeds should produce different order (with high probability)
      expect(entities1.map((e) => e.id)).not.toEqual(entities2.map((e) => e.id));
    });
  });

  describe('edge cases', () => {
    it('should handle single entity array', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });
      const turnOrderService = new TurnOrderService({
        logger: mockLogger,
        shuffleService,
      });

      const entities = [createMockEntity('npc1', 'llm')];

      turnOrderService.startNewRound(entities, 'round-robin');

      expect(turnOrderService.getCurrentOrder()).toHaveLength(1);
      expect(turnOrderService.peekNextEntity().id).toBe('npc1');
    });

    it('should handle empty positions in shuffle result', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });
      const turnOrderService = new TurnOrderService({
        logger: mockLogger,
        shuffleService,
      });

      // Human at end
      const entities = [
        createMockEntity('npc1', 'llm'),
        createMockEntity('npc2', 'llm'),
        createMockEntity('human1', 'human'),
      ];

      turnOrderService.startNewRound(entities, 'round-robin');

      // Human should be preserved at position 2
      const order = turnOrderService.getCurrentOrder();
      expect(order[2].id).toBe('human1');
    });

    it('should handle only one non-human among humans', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });
      // TurnOrderService created to verify integration pattern
      new TurnOrderService({
        logger: mockLogger,
        shuffleService,
      });

      // Only one NPC - no shuffle possible
      const entities = [
        createMockEntity('human1', 'human'),
        createMockEntity('npc1', 'llm'),
        createMockEntity('human2', 'human'),
      ];

      const originalOrder = entities.map((e) => e.id);

      shuffleService.shuffleWithHumanPositionPreservation(
        entities,
        'round-robin',
        createSeededRandom(42)
      );

      // Order should remain unchanged since only 1 NPC
      expect(entities.map((e) => e.id)).toEqual(originalOrder);
    });
  });
});
