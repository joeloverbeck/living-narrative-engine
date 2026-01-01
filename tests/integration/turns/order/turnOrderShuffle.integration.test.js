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

  describe('input validation', () => {
    it('should return input unchanged when called with non-array object', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });
      const input = { notAnArray: true };

      const result = shuffleService.shuffleWithHumanPositionPreservation(
        input,
        'round-robin'
      );

      expect(result).toBe(input);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('non-array input')
      );
    });

    it('should return null when called with null', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });

      const result = shuffleService.shuffleWithHumanPositionPreservation(
        null,
        'round-robin'
      );

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('non-array input')
      );
    });

    it('should return undefined when called with undefined', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });

      const result = shuffleService.shuffleWithHumanPositionPreservation(
        undefined,
        'round-robin'
      );

      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('non-array input')
      );
    });
  });

  describe('strategy configuration', () => {
    it('should skip shuffle for unknown strategy', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });
      const entities = [
        createMockEntity('npc1', 'llm'),
        createMockEntity('npc2', 'llm'),
        createMockEntity('npc3', 'llm'),
      ];
      const originalOrder = entities.map((e) => e.id);

      const result = shuffleService.shuffleWithHumanPositionPreservation(
        entities,
        'unknown-strategy',
        createSeededRandom(42)
      );

      // Order should remain unchanged
      expect(result.map((e) => e.id)).toEqual(originalOrder);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Shuffling disabled for strategy "unknown-strategy"')
      );
    });

    it('should skip shuffle for null strategy', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });
      const entities = [
        createMockEntity('npc1', 'llm'),
        createMockEntity('npc2', 'llm'),
      ];
      const originalOrder = entities.map((e) => e.id);

      shuffleService.shuffleWithHumanPositionPreservation(entities, null);

      expect(entities.map((e) => e.id)).toEqual(originalOrder);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Shuffling disabled')
      );
    });
  });

  describe('isHumanPlayer method', () => {
    it('should return true for human entities', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });
      const humanEntity = createMockEntity('player1', 'human');

      expect(shuffleService.isHumanPlayer(humanEntity)).toBe(true);
    });

    it('should return false for AI entities', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });
      const aiEntity = createMockEntity('npc1', 'llm');

      expect(shuffleService.isHumanPlayer(aiEntity)).toBe(false);
    });

    it('should return false for goap type entities', () => {
      const shuffleService = new TurnOrderShuffleService({ logger: mockLogger });
      const goapEntity = createMockEntity('npc2', 'goap');

      expect(shuffleService.isHumanPlayer(goapEntity)).toBe(false);
    });
  });

  describe('diagnostics logging', () => {
    it('should log original and shuffled order when diagnostics are enabled', async () => {
      // Use jest.isolateModules to get a fresh import with mocked config
      await jest.isolateModulesAsync(async () => {
        // Mock the config module before importing the service
        jest.doMock(
          '../../../../src/turns/config/turnOrderShuffle.config.js',
          () => ({
            isShuffleEnabledForStrategy: jest.fn().mockReturnValue(true),
            getDiagnosticsConfig: jest.fn().mockReturnValue({
              logOriginalOrder: true,
              logShuffleResults: true,
              includeActorNames: true,
            }),
          })
        );

        // Dynamic import to get the mocked version
        const { TurnOrderShuffleService: MockedService } = await import(
          '../../../../src/turns/services/turnOrderShuffleService.js'
        );

        const testLogger = {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };

        const shuffleService = new MockedService({ logger: testLogger });

        const entities = [
          {
            id: 'npc1',
            name: 'Guard',
            hasComponent: jest.fn(() => true),
            getComponentData: jest.fn(() => ({ type: 'llm' })),
          },
          {
            id: 'npc2',
            name: 'Merchant',
            hasComponent: jest.fn(() => true),
            getComponentData: jest.fn(() => ({ type: 'llm' })),
          },
          {
            id: 'npc3',
            name: 'Villager',
            hasComponent: jest.fn(() => true),
            getComponentData: jest.fn(() => ({ type: 'llm' })),
          },
        ];

        const { createSeededRandom: seededRandom } = await import(
          '../../../../src/utils/shuffleUtils.js'
        );

        shuffleService.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin',
          seededRandom(42)
        );

        // Should log original order with names
        expect(testLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Original order')
        );

        // Should log shuffled order with names
        expect(testLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Shuffled order')
        );

        // Should log preservation count
        expect(testLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Preserved 0 human position(s)')
        );

        // Should include actor names in the format
        expect(testLogger.debug).toHaveBeenCalledWith(
          expect.stringMatching(/npc\d\([A-Za-z]+\)/)
        );
      });
    });

    it('should format entity list with IDs only when includeActorNames is false', async () => {
      await jest.isolateModulesAsync(async () => {
        jest.doMock(
          '../../../../src/turns/config/turnOrderShuffle.config.js',
          () => ({
            isShuffleEnabledForStrategy: jest.fn().mockReturnValue(true),
            getDiagnosticsConfig: jest.fn().mockReturnValue({
              logOriginalOrder: true,
              logShuffleResults: true,
              includeActorNames: false,
            }),
          })
        );

        const { TurnOrderShuffleService: MockedService } = await import(
          '../../../../src/turns/services/turnOrderShuffleService.js'
        );

        const testLogger = {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };

        const shuffleService = new MockedService({ logger: testLogger });

        const entities = [
          {
            id: 'npc1',
            name: 'Guard',
            hasComponent: jest.fn(() => true),
            getComponentData: jest.fn(() => ({ type: 'llm' })),
          },
          {
            id: 'npc2',
            name: 'Merchant',
            hasComponent: jest.fn(() => true),
            getComponentData: jest.fn(() => ({ type: 'llm' })),
          },
        ];

        const { createSeededRandom: seededRandom } = await import(
          '../../../../src/utils/shuffleUtils.js'
        );

        shuffleService.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin',
          seededRandom(42)
        );

        // Should log but without names (just IDs)
        expect(testLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Original order')
        );

        // Should NOT include parentheses (which would indicate names)
        const originalOrderCall = testLogger.debug.mock.calls.find((call) =>
          call[0].includes('Original order')
        );
        expect(originalOrderCall[0]).not.toMatch(/\([A-Za-z]+\)/);
      });
    });

    it('should log human position preservation count correctly', async () => {
      await jest.isolateModulesAsync(async () => {
        jest.doMock(
          '../../../../src/turns/config/turnOrderShuffle.config.js',
          () => ({
            isShuffleEnabledForStrategy: jest.fn().mockReturnValue(true),
            getDiagnosticsConfig: jest.fn().mockReturnValue({
              logOriginalOrder: false,
              logShuffleResults: true,
              includeActorNames: false,
            }),
          })
        );

        const { TurnOrderShuffleService: MockedService } = await import(
          '../../../../src/turns/services/turnOrderShuffleService.js'
        );

        const testLogger = {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };

        const shuffleService = new MockedService({ logger: testLogger });

        const entities = [
          {
            id: 'human1',
            name: 'Player',
            hasComponent: jest.fn(() => true),
            getComponentData: jest.fn(() => ({ type: 'human' })),
          },
          {
            id: 'npc1',
            name: 'Guard',
            hasComponent: jest.fn(() => true),
            getComponentData: jest.fn(() => ({ type: 'llm' })),
          },
          {
            id: 'human2',
            name: 'Player2',
            hasComponent: jest.fn(() => true),
            getComponentData: jest.fn(() => ({ type: 'human' })),
          },
          {
            id: 'npc2',
            name: 'Merchant',
            hasComponent: jest.fn(() => true),
            getComponentData: jest.fn(() => ({ type: 'llm' })),
          },
        ];

        const { createSeededRandom: seededRandom } = await import(
          '../../../../src/utils/shuffleUtils.js'
        );

        shuffleService.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin',
          seededRandom(42)
        );

        // Should log preservation of 2 human positions
        expect(testLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Preserved 2 human position(s)')
        );

        // Should log that 2 non-humans were shuffled
        expect(testLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('shuffled 2 non-human(s)')
        );
      });
    });
  });
});
