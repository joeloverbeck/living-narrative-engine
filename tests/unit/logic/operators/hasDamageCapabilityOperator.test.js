/**
 * @file Unit tests for HasDamageCapabilityOperator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { HasDamageCapabilityOperator } from '../../../../src/logic/operators/hasDamageCapabilityOperator.js';

describe('HasDamageCapabilityOperator', () => {
  let testBed;
  let operator;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = testBed.createMock('entityManager', [
      'hasComponent',
      'getComponentData',
    ]);

    operator = new HasDamageCapabilityOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(operator).toBeDefined();
    });

    it('should throw error if entityManager is missing', () => {
      expect(() => {
        new HasDamageCapabilityOperator({ logger: mockLogger });
      }).toThrow('HasDamageCapabilityOperator: Missing required dependencies');
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new HasDamageCapabilityOperator({ entityManager: mockEntityManager });
      }).toThrow('HasDamageCapabilityOperator: Missing required dependencies');
    });
  });

  describe('evaluate', () => {
    it('should return true when entity has matching damage type', () => {
      const entity = { id: 'weapon-1' };
      const context = { entity };

      mockEntityManager.getComponentData.mockReturnValue({
        entries: [{ name: 'slashing', amount: 10 }],
      });

      const result = operator.evaluate(['entity', 'slashing'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'weapon-1',
        'damage-types:damage_capabilities'
      );
    });

    it('should return false when entity has different damage type only', () => {
      const entity = { id: 'weapon-1' };
      const context = { entity };

      mockEntityManager.getComponentData.mockReturnValue({
        entries: [{ name: 'piercing', amount: 15 }],
      });

      const result = operator.evaluate(['entity', 'slashing'], context);

      expect(result).toBe(false);
    });

    it('should return false when entity has no damage_capabilities component', () => {
      const entity = { id: 'weapon-1' };
      const context = { entity };

      mockEntityManager.getComponentData.mockReturnValue(null);

      const result = operator.evaluate(['entity', 'slashing'], context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should return true when entity has multiple entries and one matches', () => {
      const entity = { id: 'weapon-1' };
      const context = { entity };

      mockEntityManager.getComponentData.mockReturnValue({
        entries: [
          { name: 'bludgeoning', amount: 5 },
          { name: 'slashing', amount: 10 },
          { name: 'fire', amount: 3 },
        ],
      });

      const result = operator.evaluate(['entity', 'slashing'], context);

      expect(result).toBe(true);
    });

    it('should return false when entity reference is invalid/null', () => {
      const context = { entity: null };

      const result = operator.evaluate(['entity', 'slashing'], context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should return false when damage type name is empty string', () => {
      const entity = { id: 'weapon-1' };
      const context = { entity };

      const result = operator.evaluate(['entity', ''], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when damage type name is whitespace only', () => {
      const entity = { id: 'weapon-1' };
      const context = { entity };

      const result = operator.evaluate(['entity', '   '], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when entity has component but empty entries array', () => {
      const entity = { id: 'weapon-1' };
      const context = { entity };

      mockEntityManager.getComponentData.mockReturnValue({
        entries: [],
      });

      const result = operator.evaluate(['entity', 'slashing'], context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should handle JSON Logic expressions in entityPath', () => {
      const weapon = { id: 'weapon-1' };
      const context = { entity: { equipped: weapon } };

      mockEntityManager.getComponentData.mockReturnValue({
        entries: [{ name: 'slashing', amount: 10 }],
      });

      const result = operator.evaluate(
        [{ var: 'entity.equipped' }, 'slashing'],
        context
      );

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'weapon-1',
        'damage-types:damage_capabilities'
      );
    });

    it('should log errors and return false on exceptions', () => {
      const entity = { id: 'weapon-1' };
      const context = { entity };

      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = operator.evaluate(['entity', 'slashing'], context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should return false with invalid parameters - null params', () => {
      const result = operator.evaluate(null, {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when parameters array is empty', () => {
      const result = operator.evaluate([], {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when only one parameter is provided', () => {
      const result = operator.evaluate(['entity'], {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when damage type name is not a string', () => {
      const entity = { id: 'weapon-1' };
      const context = { entity };

      const result = operator.evaluate(['entity', 123], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle entity as string ID directly', () => {
      const context = { weaponId: 'weapon-1' };

      mockEntityManager.getComponentData.mockReturnValue({
        entries: [{ name: 'piercing', amount: 8 }],
      });

      const result = operator.evaluate(['weaponId', 'piercing'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'weapon-1',
        'damage-types:damage_capabilities'
      );
    });

    it('should return false when entries contains null entries', () => {
      const entity = { id: 'weapon-1' };
      const context = { entity };

      mockEntityManager.getComponentData.mockReturnValue({
        entries: [null, { name: 'slashing', amount: 10 }],
      });

      const result = operator.evaluate(['entity', 'slashing'], context);

      expect(result).toBe(true);
    });

    it('should return false for null entry in entries array when searching', () => {
      const entity = { id: 'weapon-1' };
      const context = { entity };

      mockEntityManager.getComponentData.mockReturnValue({
        entries: [null, undefined],
      });

      const result = operator.evaluate(['entity', 'slashing'], context);

      expect(result).toBe(false);
    });

    it('should return false when entries is not an array', () => {
      const entity = { id: 'weapon-1' };
      const context = { entity };

      mockEntityManager.getComponentData.mockReturnValue({
        entries: 'not-an-array',
      });

      const result = operator.evaluate(['entity', 'slashing'], context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should accept "." as entityPath for current entity context', () => {
      const entity = { id: 'weapon-1' };
      // The "." path resolves via context.entity per entityPathResolver convention
      const context = { entity };

      mockEntityManager.getComponentData.mockReturnValue({
        entries: [{ name: 'slashing', amount: 10 }],
      });

      const result = operator.evaluate(['.', 'slashing'], context);

      expect(result).toBe(true);
    });

    it('should accept "primary" as entityPath for primary entity', () => {
      const primary = { id: 'sword-1' };
      const context = { primary };

      mockEntityManager.getComponentData.mockReturnValue({
        entries: [{ name: 'slashing', amount: 15 }],
      });

      const result = operator.evaluate(['primary', 'slashing'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'sword-1',
        'damage-types:damage_capabilities'
      );
    });
  });
});
