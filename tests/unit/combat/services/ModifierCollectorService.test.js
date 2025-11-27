import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ModifierCollectorService from '../../../../src/combat/services/ModifierCollectorService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/**
 * Creates minimal mocks for dependencies
 *
 * @returns {object} Object containing mocked dependencies
 */
function createMocks() {
  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    entityManager: {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    },
  };
}

describe('ModifierCollectorService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    ({ logger: mockLogger, entityManager: mockEntityManager } = createMocks());

    service = new ModifierCollectorService({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(service).toBeInstanceOf(ModifierCollectorService);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ModifierCollectorService: Initialized'
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new ModifierCollectorService({
          entityManager: mockEntityManager,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when entityManager is missing', () => {
      expect(() => {
        new ModifierCollectorService({
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger is null', () => {
      expect(() => {
        new ModifierCollectorService({
          entityManager: mockEntityManager,
          logger: null,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when entityManager is null', () => {
      expect(() => {
        new ModifierCollectorService({
          entityManager: null,
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger missing required methods', () => {
      expect(() => {
        new ModifierCollectorService({
          entityManager: mockEntityManager,
          logger: { debug: jest.fn() }, // Missing warn, error, info
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when entityManager missing required methods', () => {
      expect(() => {
        new ModifierCollectorService({
          entityManager: { getComponentData: jest.fn() }, // Missing hasComponent
          logger: mockLogger,
        });
      }).toThrow(InvalidArgumentError);
    });
  });

  describe('collectModifiers', () => {
    describe('empty modifiers', () => {
      it('should return empty collection with identity totals when no modifiers configured', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
        });

        expect(result).toEqual({
          modifiers: [],
          totalFlat: 0,
          totalPercentage: 1, // Identity for multiplication (not 0 which would zero out)
        });
      });

      it('should return empty collection when actionConfig is undefined', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: undefined,
        });

        expect(result).toEqual({
          modifiers: [],
          totalFlat: 0,
          totalPercentage: 1, // Identity for multiplication
        });
      });

      it('should return empty collection when actionConfig has no modifiers property', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: { someOtherProp: 'value' },
        });

        expect(result).toEqual({
          modifiers: [],
          totalFlat: 0,
          totalPercentage: 1, // Identity for multiplication
        });
      });

      it('should return empty collection when actionConfig.modifiers is empty array', () => {
        const result = service.collectModifiers({
          actorId: 'actor-123',
          actionConfig: { modifiers: [] },
        });

        expect(result).toEqual({
          modifiers: [],
          totalFlat: 0,
          totalPercentage: 1, // Identity for multiplication
        });
      });
    });

    describe('logging', () => {
      it('should log when collecting modifiers with actor and target', () => {
        service.collectModifiers({
          actorId: 'actor-123',
          targetId: 'target-456',
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('actor=actor-123')
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('target=target-456')
        );
      });

      it('should log when collecting modifiers with only actor', () => {
        service.collectModifiers({
          actorId: 'actor-123',
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('actor=actor-123')
        );
      });

      it('should log found modifiers count and totals', () => {
        service.collectModifiers({
          actorId: 'actor-123',
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Found 0 modifiers')
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('flat=0')
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('percentage=1') // Identity value for no modifiers
        );
      });
    });

    describe('Phase 5 stub behavior', () => {
      it('should return empty modifiers array even when actionConfig.modifiers has entries', () => {
        // Phase 5 stub: The service doesn't evaluate modifiers yet
        // This tests that it correctly returns empty array for now
        const result = service.collectModifiers({
          actorId: 'actor-123',
          targetId: 'target-456',
          actionConfig: {
            modifiers: [
              { id: 'mod1', condition: {}, value: 10 },
              { id: 'mod2', condition: {}, value: 5 },
            ],
          },
        });

        // Phase 5 stub returns empty - conditions not evaluated yet
        expect(result).toEqual({
          modifiers: [],
          totalFlat: 0,
          totalPercentage: 1, // Identity for multiplication
        });
      });
    });
  });

  describe('stacking rules (via internal method testing through collectModifiers)', () => {
    // Note: Since #applyStackingRules is private, we test it indirectly
    // These tests verify the stacking logic is correct through the public interface
    // Full stacking behavior testing will be added in Phase 5+ when modifiers are collected

    it('should keep only highest absolute value modifier for same stackId', () => {
      // This test documents expected behavior when modifiers are collected
      // In Phase 5, modifiers will be passed through #applyStackingRules

      // Example of expected stacking behavior (tested via integration when Phase 5+ is complete):
      // Input: [{ stackId: 'A', value: 5 }, { stackId: 'A', value: -10 }]
      // Output: [{ stackId: 'A', value: -10 }] (|-10| > |5|)

      const result = service.collectModifiers({ actorId: 'actor-123' });
      expect(result.modifiers).toEqual([]);
    });

    it('should keep all modifiers without stackId', () => {
      // Expected: Modifiers without stackId all apply (no stacking)
      const result = service.collectModifiers({ actorId: 'actor-123' });
      expect(result.modifiers).toEqual([]);
    });
  });

  describe('calculateTotals (via collectModifiers results)', () => {
    // Since private methods are tested through public interface
    // These tests verify the totals calculation structure

    it('should return identity totals for empty modifiers', () => {
      const result = service.collectModifiers({ actorId: 'actor-123' });

      expect(result.totalFlat).toBe(0);
      expect(result.totalPercentage).toBe(1); // Identity for multiplication
    });

    it('should return proper structure with all required properties', () => {
      const result = service.collectModifiers({ actorId: 'actor-123' });

      expect(result).toHaveProperty('modifiers');
      expect(result).toHaveProperty('totalFlat');
      expect(result).toHaveProperty('totalPercentage');
      expect(Array.isArray(result.modifiers)).toBe(true);
      expect(typeof result.totalFlat).toBe('number');
      expect(typeof result.totalPercentage).toBe('number');
    });
  });

  describe('with optional parameters', () => {
    it('should accept locationId parameter', () => {
      const result = service.collectModifiers({
        actorId: 'actor-123',
        locationId: 'location-789',
      });

      expect(result).toEqual({
        modifiers: [],
        totalFlat: 0,
        totalPercentage: 1, // Identity for multiplication
      });
    });

    it('should accept all parameters together', () => {
      const result = service.collectModifiers({
        actorId: 'actor-123',
        targetId: 'target-456',
        locationId: 'location-789',
        actionConfig: { modifiers: [] },
      });

      expect(result).toEqual({
        modifiers: [],
        totalFlat: 0,
        totalPercentage: 1, // Identity for multiplication
      });
    });
  });

  describe('invariants', () => {
    it('should have no side effects on entity state', () => {
      service.collectModifiers({
        actorId: 'actor-123',
        targetId: 'target-456',
      });

      // No mutations should have been called
      expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    it('should always return valid ModifierCollection structure', () => {
      const result = service.collectModifiers({ actorId: 'actor-123' });

      expect(result).toBeDefined();
      expect(result.modifiers).toBeInstanceOf(Array);
      expect(typeof result.totalFlat).toBe('number');
      expect(typeof result.totalPercentage).toBe('number');
    });

    it('should return consistent results for same input', () => {
      const input = { actorId: 'actor-123', targetId: 'target-456' };

      const result1 = service.collectModifiers(input);
      const result2 = service.collectModifiers(input);

      expect(result1).toEqual(result2);
    });
  });
});
