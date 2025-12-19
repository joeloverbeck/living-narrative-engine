/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { HasSittingSpaceToRightOperator } from '../../../../src/logic/operators/hasSittingSpaceToRightOperator.js';

describe('HasSittingSpaceToRightOperator', () => {
  let operator;
  let mockDependencies;
  let mockContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDependencies = {
      entityManager: {
        getComponentData: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    operator = new HasSittingSpaceToRightOperator(mockDependencies);
    mockContext = {};
  });

  describe('constructor', () => {
    test('should initialize successfully with valid dependencies', () => {
      expect(operator).toBeDefined();
      expect(operator.operatorName).toBe('hasSittingSpaceToRight');
    });
  });

  describe('evaluate - Success Cases', () => {
    test('should return true when actor has 2+ empty spots to right and is rightmost', () => {
      // Setup: actor at spot 0, spots 1-2 empty, no one further right
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };
      const allowsSittingData = {
        spots: ['actor123', null, null, null], // Actor at 0, spots 1-3 empty
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData) // positioning:sitting_on
        .mockReturnValueOnce(allowsSittingData); // sitting:allows_sitting

      mockContext.entity = { id: 'actor123' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(true);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'has 2 empty spots to right and is rightmost occupant'
        )
      );
    });

    test('should return true with custom minSpaces parameter (1)', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 1,
      };
      const allowsSittingData = {
        spots: [null, 'actor456', null], // Actor at 1, spot 2 empty
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor456' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 1], mockContext);

      expect(result).toBe(true);
    });

    test('should return true with minSpaces = 0 when rightmost', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 2,
      };
      const allowsSittingData = {
        spots: [null, null, 'actor789'], // Actor at last spot
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor789' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 0], mockContext);

      expect(result).toBe(true);
    });

    test('should return true when actor has exactly required empty spots', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };
      const allowsSittingData = {
        spots: ['actor111', null, null], // Exactly 2 spots to right
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor111' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(true);
    });
  });

  describe('evaluate - Failure Cases', () => {
    test('should return false when actor has only 1 empty spot but needs 2', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 1,
      };
      const allowsSittingData = {
        spots: [null, 'actor222', null], // Only 1 spot to right
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor222' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('only has 1 spots to right, needs 2')
      );
    });

    test('should return false when actor on last spot (no spots to right)', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 2,
      };
      const allowsSittingData = {
        spots: [null, null, 'actor333'], // No spots after actor
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor333' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
    });

    test('should return false when spot to right is occupied', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };
      const allowsSittingData = {
        spots: ['actor444', 'actor555', null, null], // Spot 1 occupied
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor444' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('spot 1 to the right is occupied')
      );
    });

    test('should return false when actor is not rightmost (someone further right)', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };
      const allowsSittingData = {
        spots: ['actor666', null, null, 'actor777'], // Actor at 3
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor666' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('is not rightmost')
      );
    });

    test('should return false when entity is not sitting', () => {
      mockDependencies.entityManager.getComponentData.mockReturnValueOnce(null); // No sitting_on component

      mockContext.entity = { id: 'actor888' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('is not sitting')
      );
    });

    test('should return false when entity sitting on wrong furniture', () => {
      const sittingOnData = {
        furniture_id: 'furniture999', // Different furniture
        spot_index: 0,
      };

      mockDependencies.entityManager.getComponentData.mockReturnValueOnce(
        sittingOnData
      );

      mockContext.entity = { id: 'actor000' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'is sitting on furniture999, not target furniture123'
        )
      );
    });

    test('should return false when furniture has no allows_sitting component', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(null); // No allows_sitting

      mockContext.entity = { id: 'actor100' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
    });

    test('should return false when spot_index is out of bounds', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 10, // Out of bounds
      };
      const allowsSittingData = {
        spots: ['actor200', null, null],
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor200' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('spot_index 10 is out of bounds')
      );
    });

    test('should return false when spot_index is invalid (null)', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: null,
      };

      mockDependencies.entityManager.getComponentData.mockReturnValueOnce(
        sittingOnData
      );

      mockContext.entity = { id: 'actor300' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('has invalid spot_index')
      );
    });

    test('should return false when entity not in claimed spot (consistency check)', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };
      const allowsSittingData = {
        spots: ['actor999', null, null], // Different actor at spot 0
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor400' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('claims spot 0 but furniture shows')
      );
    });
  });

  describe('evaluate - Parameter Validation', () => {
    test('should use default minSpaces=2 when parameter missing', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };
      const allowsSittingData = {
        spots: ['actor500', null, null],
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor500' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target'], mockContext);

      expect(result).toBe(true);
    });

    test('should handle invalid minSpaces parameter gracefully', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };
      const allowsSittingData = {
        spots: ['actor600', null, null],
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor600' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(
        ['entity', 'target', 'invalid'],
        mockContext
      );

      expect(result).toBe(true); // Falls back to default minSpaces=2
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid minSpaces parameter')
      );
    });

    test('should return false with missing entity path', () => {
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(
        ['nonexistent', 'target', 2],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No entity found at path')
      );
    });

    test('should return false with missing target path', () => {
      mockContext.entity = { id: 'actor700' };

      const result = operator.evaluate(['entity'], mockContext);

      expect(result).toBe(false);
    });

    test('should return false when entity path not found in context', () => {
      const result = operator.evaluate(
        ['nonexistent', 'target', 2],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No entity found at path')
      );
    });

    test('should return false when target path not found in context', () => {
      mockContext.entity = { id: 'actor800' };

      const result = operator.evaluate(
        ['entity', 'nonexistent', 2],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No target found at path')
      );
    });
  });

  describe('evaluate - Edge Cases', () => {
    test('should handle single-spot furniture (always false)', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };
      const allowsSittingData = {
        spots: ['actor900'], // Only 1 spot total
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor900' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
    });

    test('should handle multiple actors on same furniture', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };
      const allowsSittingData = {
        spots: ['actor001', 'actor002', 'actor003', null, null],
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor001' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false); // Not rightmost
    });

    test('should handle negative spot_index gracefully', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: -1,
      };

      mockDependencies.entityManager.getComponentData.mockReturnValueOnce(
        sittingOnData
      );

      mockContext.entity = { id: 'actor002' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
    });

    test('should handle empty spots array', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };
      const allowsSittingData = {
        spots: [],
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor003' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
    });

    test('should handle malformed spots property (not an array)', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };
      const allowsSittingData = {
        spots: 'not-an-array',
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'actor004' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['entity', 'target', 2], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('has invalid spots property')
      );
    });
  });

  describe('evaluate - Nested Path Resolution', () => {
    test('should handle dot path for entity', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };
      const allowsSittingData = {
        spots: ['entity005', null, null],
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.entity = { id: 'entity005' };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(['.', 'target', 2], mockContext);

      expect(result).toBe(true);
    });

    test('should handle nested entity paths', () => {
      const sittingOnData = {
        furniture_id: 'furniture123',
        spot_index: 0,
      };
      const allowsSittingData = {
        spots: ['actor006', null, null],
      };

      mockDependencies.entityManager.getComponentData
        .mockReturnValueOnce(sittingOnData)
        .mockReturnValueOnce(allowsSittingData);

      mockContext.event = { actor: { id: 'actor006' } };
      mockContext.target = { id: 'furniture123' };

      const result = operator.evaluate(
        ['event.actor', 'target', 2],
        mockContext
      );

      expect(result).toBe(true);
    });
  });
});
