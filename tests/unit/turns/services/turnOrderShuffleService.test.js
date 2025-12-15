/**
 * @file Unit tests for TurnOrderShuffleService
 * @see src/turns/services/turnOrderShuffleService.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the config module
jest.mock('../../../../src/turns/config/turnOrderShuffle.config.js', () => ({
  isShuffleEnabledForStrategy: jest.fn(),
  getDiagnosticsConfig: jest.fn(),
}));

// Mock actorTypeUtils
jest.mock('../../../../src/utils/actorTypeUtils.js', () => ({
  determineActorType: jest.fn(),
}));

import { TurnOrderShuffleService } from '../../../../src/turns/services/turnOrderShuffleService.js';
import {
  isShuffleEnabledForStrategy,
  getDiagnosticsConfig,
} from '../../../../src/turns/config/turnOrderShuffle.config.js';
import { determineActorType } from '../../../../src/utils/actorTypeUtils.js';
import { createSeededRandom } from '../../../../src/utils/shuffleUtils.js';

describe('TurnOrderShuffleService', () => {
  /** @type {TurnOrderShuffleService} */
  let service;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Default config returns
    isShuffleEnabledForStrategy.mockReturnValue(true);
    getDiagnosticsConfig.mockReturnValue({
      logShuffleResults: false,
      logOriginalOrder: false,
      includeActorNames: false,
    });

    // Default to non-human
    determineActorType.mockReturnValue('ai');

    service = new TurnOrderShuffleService({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should create instance with valid logger', () => {
      expect(service).toBeInstanceOf(TurnOrderShuffleService);
    });

    it('should throw if logger is missing', () => {
      expect(() => new TurnOrderShuffleService({})).toThrow(
        'TurnOrderShuffleService requires a valid ILogger instance.'
      );
    });

    it('should throw if logger.error is not a function', () => {
      expect(
        () => new TurnOrderShuffleService({ logger: { error: 'not a function' } })
      ).toThrow('TurnOrderShuffleService requires a valid ILogger instance.');
    });

    it('should handle logger with missing optional methods', () => {
      const minimalLogger = { error: jest.fn(), warn: jest.fn() };
      const service2 = new TurnOrderShuffleService({ logger: minimalLogger });
      expect(service2).toBeInstanceOf(TurnOrderShuffleService);
    });
  });

  describe('shuffleWithHumanPositionPreservation', () => {
    describe('input validation', () => {
      it('should return non-array input unchanged', () => {
        const result = service.shuffleWithHumanPositionPreservation(
          null,
          'round-robin'
        );
        expect(result).toBeNull();
      });

      it('should return undefined input unchanged', () => {
        const result = service.shuffleWithHumanPositionPreservation(
          undefined,
          'round-robin'
        );
        expect(result).toBeUndefined();
      });

      it('should return empty array unchanged', () => {
        const result = service.shuffleWithHumanPositionPreservation(
          [],
          'round-robin'
        );
        expect(result).toEqual([]);
      });

      it('should return single element array unchanged', () => {
        const entities = [{ id: 'entity1' }];
        const result = service.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin'
        );
        expect(result).toEqual([{ id: 'entity1' }]);
      });
    });

    describe('strategy check', () => {
      it('should not shuffle if strategy is disabled', () => {
        isShuffleEnabledForStrategy.mockReturnValue(false);

        const entities = [
          { id: 'npc1' },
          { id: 'npc2' },
          { id: 'npc3' },
        ];
        const original = [...entities];

        const result = service.shuffleWithHumanPositionPreservation(
          entities,
          'initiative'
        );

        expect(result).toEqual(original);
        expect(isShuffleEnabledForStrategy).toHaveBeenCalledWith('initiative');
      });
    });

    describe('all human actors', () => {
      it('should not shuffle if all entities are human', () => {
        determineActorType.mockReturnValue('human');

        const entities = [
          { id: 'human1' },
          { id: 'human2' },
          { id: 'human3' },
        ];
        const original = [...entities];

        const result = service.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin'
        );

        expect(result).toEqual(original);
      });
    });

    describe('all non-human actors', () => {
      it('should shuffle all entities if none are human', () => {
        determineActorType.mockReturnValue('ai');
        const seededRandom = createSeededRandom(42);

        const entities = [
          { id: 'npc1' },
          { id: 'npc2' },
          { id: 'npc3' },
          { id: 'npc4' },
          { id: 'npc5' },
        ];
        const originalIds = entities.map((e) => e.id);

        service.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin',
          seededRandom
        );

        // Should contain same elements
        expect(entities.map((e) => e.id).sort()).toEqual(originalIds.sort());
        // Should be shuffled (with high probability with seed 42)
        expect(entities.map((e) => e.id)).not.toEqual(originalIds);
      });

      it('should not shuffle if only one non-human', () => {
        determineActorType.mockReturnValue('ai');

        const entities = [{ id: 'npc1' }];

        const result = service.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin'
        );

        expect(result).toEqual([{ id: 'npc1' }]);
      });
    });

    describe('mixed human and non-human actors', () => {
      it('should preserve human at position 0', () => {
        determineActorType.mockImplementation((entity) =>
          entity.id.startsWith('human') ? 'human' : 'ai'
        );

        const entities = [
          { id: 'human1' },
          { id: 'npc1' },
          { id: 'npc2' },
          { id: 'npc3' },
        ];

        service.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin',
          createSeededRandom(42)
        );

        // Human should stay at position 0
        expect(entities[0].id).toBe('human1');
        // Non-humans should be somewhere in positions 1-3
        const nonHumanIds = entities.slice(1).map((e) => e.id);
        expect(nonHumanIds.sort()).toEqual(['npc1', 'npc2', 'npc3']);
      });

      it('should preserve human at last position', () => {
        determineActorType.mockImplementation((entity) =>
          entity.id.startsWith('human') ? 'human' : 'ai'
        );

        const entities = [
          { id: 'npc1' },
          { id: 'npc2' },
          { id: 'npc3' },
          { id: 'human1' },
        ];

        service.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin',
          createSeededRandom(42)
        );

        // Human should stay at last position
        expect(entities[3].id).toBe('human1');
        // Non-humans should be somewhere in positions 0-2
        const nonHumanIds = entities.slice(0, 3).map((e) => e.id);
        expect(nonHumanIds.sort()).toEqual(['npc1', 'npc2', 'npc3']);
      });

      it('should preserve multiple humans at their original positions', () => {
        determineActorType.mockImplementation((entity) =>
          entity.id.startsWith('human') ? 'human' : 'ai'
        );

        const entities = [
          { id: 'human1' },
          { id: 'npc1' },
          { id: 'npc2' },
          { id: 'human2' },
          { id: 'npc3' },
        ];

        service.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin',
          createSeededRandom(42)
        );

        // Humans stay at positions 0 and 3
        expect(entities[0].id).toBe('human1');
        expect(entities[3].id).toBe('human2');

        // Non-humans fill positions 1, 2, 4
        const nonHumanPositions = [1, 2, 4];
        const nonHumanIds = nonHumanPositions.map((i) => entities[i].id);
        expect(nonHumanIds.sort()).toEqual(['npc1', 'npc2', 'npc3']);
      });

      it('should not shuffle if only one non-human among humans', () => {
        determineActorType.mockImplementation((entity) =>
          entity.id.startsWith('human') ? 'human' : 'ai'
        );

        const entities = [
          { id: 'human1' },
          { id: 'npc1' },
          { id: 'human2' },
        ];
        const original = entities.map((e) => e.id);

        service.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin',
          createSeededRandom(42)
        );

        // Should remain unchanged - only one non-human
        expect(entities.map((e) => e.id)).toEqual(original);
      });
    });

    describe('deterministic behavior', () => {
      it('should produce same result with same seed', () => {
        determineActorType.mockReturnValue('ai');

        const entities1 = [
          { id: 'a' },
          { id: 'b' },
          { id: 'c' },
          { id: 'd' },
          { id: 'e' },
        ];
        const entities2 = [
          { id: 'a' },
          { id: 'b' },
          { id: 'c' },
          { id: 'd' },
          { id: 'e' },
        ];

        service.shuffleWithHumanPositionPreservation(
          entities1,
          'round-robin',
          createSeededRandom(123)
        );
        service.shuffleWithHumanPositionPreservation(
          entities2,
          'round-robin',
          createSeededRandom(123)
        );

        expect(entities1.map((e) => e.id)).toEqual(entities2.map((e) => e.id));
      });

      it('should produce different results with different seeds', () => {
        determineActorType.mockReturnValue('ai');

        const entities1 = [
          { id: 'a' },
          { id: 'b' },
          { id: 'c' },
          { id: 'd' },
          { id: 'e' },
        ];
        const entities2 = [
          { id: 'a' },
          { id: 'b' },
          { id: 'c' },
          { id: 'd' },
          { id: 'e' },
        ];

        service.shuffleWithHumanPositionPreservation(
          entities1,
          'round-robin',
          createSeededRandom(123)
        );
        service.shuffleWithHumanPositionPreservation(
          entities2,
          'round-robin',
          createSeededRandom(456)
        );

        // Very likely to be different
        expect(entities1.map((e) => e.id)).not.toEqual(
          entities2.map((e) => e.id)
        );
      });
    });

    describe('diagnostics logging', () => {
      it('should log original order when enabled', () => {
        getDiagnosticsConfig.mockReturnValue({
          logShuffleResults: false,
          logOriginalOrder: true,
          includeActorNames: false,
        });
        determineActorType.mockReturnValue('ai');

        const entities = [{ id: 'npc1' }, { id: 'npc2' }, { id: 'npc3' }];

        service.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin',
          createSeededRandom(42)
        );

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Original order')
        );
      });

      it('should log shuffle results when enabled', () => {
        getDiagnosticsConfig.mockReturnValue({
          logShuffleResults: true,
          logOriginalOrder: false,
          includeActorNames: false,
        });
        determineActorType.mockReturnValue('ai');

        const entities = [{ id: 'npc1' }, { id: 'npc2' }, { id: 'npc3' }];

        service.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin',
          createSeededRandom(42)
        );

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Shuffled order')
        );
      });

      it('should include actor names in logs when enabled', () => {
        getDiagnosticsConfig.mockReturnValue({
          logShuffleResults: true,
          logOriginalOrder: true,
          includeActorNames: true,
        });
        determineActorType.mockReturnValue('ai');

        const entities = [
          { id: 'npc1', name: 'Guard' },
          { id: 'npc2', name: 'Merchant' },
          { id: 'npc3', name: 'Thief' },
        ];

        service.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin',
          createSeededRandom(42)
        );

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Guard')
        );
      });
    });

    describe('error handling', () => {
      it('should handle determineActorType throwing', () => {
        determineActorType.mockImplementation(() => {
          throw new Error('Component not found');
        });

        const entities = [{ id: 'entity1' }, { id: 'entity2' }];
        const original = entities.map((e) => e.id);

        // Should not throw, should default to treating as human
        const result = service.shuffleWithHumanPositionPreservation(
          entities,
          'round-robin'
        );

        // All treated as human = no shuffle
        expect(result.map((e) => e.id)).toEqual(original);
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });
  });

  describe('isHumanPlayer', () => {
    it('should return true for human player', () => {
      determineActorType.mockReturnValue('human');

      const result = service.isHumanPlayer({ id: 'player1' });

      expect(result).toBe(true);
    });

    it('should return false for AI player', () => {
      determineActorType.mockReturnValue('ai');

      const result = service.isHumanPlayer({ id: 'npc1' });

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      determineActorType.mockImplementation(() => {
        throw new Error('Error');
      });

      // Should default to human
      const result = service.isHumanPlayer({ id: 'unknown' });

      expect(result).toBe(true);
    });
  });
});
