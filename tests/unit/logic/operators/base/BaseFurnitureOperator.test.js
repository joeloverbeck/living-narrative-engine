/**
 * @jest-environment node
 */

import { describe, test, beforeEach, expect, jest } from '@jest/globals';
import { BaseFurnitureOperator } from '../../../../../src/logic/operators/base/BaseFurnitureOperator.js';

class TestFurnitureOperator extends BaseFurnitureOperator {
  constructor(dependencies) {
    super(dependencies, 'testOperator');
    this._lastEvaluation = null;
  }

  evaluateInternal(entityId, targetId, params, context) {
    this._lastEvaluation = { entityId, targetId, params, context };

    if (params.includes('return-false')) {
      return false;
    }

    return true;
  }
}

describe('BaseFurnitureOperator', () => {
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

    operator = new TestFurnitureOperator(mockDependencies);
    mockContext = {};
  });

  describe('constructor', () => {
    test('throws when dependencies are missing', () => {
      expect(() => {
        new TestFurnitureOperator({ logger: mockDependencies.logger });
      }).toThrow('BaseFurnitureOperator: Missing required dependencies');

      expect(() => {
        new TestFurnitureOperator({
          entityManager: mockDependencies.entityManager,
        });
      }).toThrow('BaseFurnitureOperator: Missing required dependencies');
    });
  });

  describe('evaluate', () => {
    test('evaluates successfully with valid entity and target', () => {
      mockContext.entity = { id: 'entity-123' };
      mockContext.furniture = { id: 'chair-456' };

      const result = operator.evaluate(
        ['entity', 'furniture', 'extra-param'],
        mockContext
      );

      expect(result).toBe(true);
      expect(operator._lastEvaluation).toEqual({
        entityId: 'entity-123',
        targetId: 'chair-456',
        params: ['extra-param'],
        context: expect.objectContaining({ _currentPath: 'entity' }),
      });
      // Original context should NOT be mutated (context isolation)
      expect(mockContext._currentPath).toBeUndefined();
    });

    test('passes through string entity and target identifiers', () => {
      mockContext.entityPath = 'entity-as-string';
      mockContext.targetPath = 99;

      const result = operator.evaluate(
        ['entityPath', 'targetPath'],
        mockContext
      );

      expect(result).toBe(true);
      expect(operator._lastEvaluation.entityId).toBe('entity-as-string');
      expect(operator._lastEvaluation.targetId).toBe(99);
    });

    test('warns and returns false when params are invalid', () => {
      const result = operator.evaluate([], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: Invalid parameters - expected at least [entityPath, targetPath]'
      );
    });

    test('warns and returns false when entity path cannot be resolved', () => {
      const result = operator.evaluate(['missing', 'target'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: No entity found at path missing'
      );
    });

    test('warns and returns false when entity resolves to invalid object', () => {
      mockContext.entity = {};

      const result = operator.evaluate(['entity', 'target'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: Invalid entity at path entity'
      );
    });

    test('warns and returns false when entity id is blank string', () => {
      mockContext.entity = { id: '   ' };

      const result = operator.evaluate(['entity', 'target'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: Invalid entity at path entity'
      );
    });

    test('warns and returns false when entity id is NaN', () => {
      mockContext.entity = { id: Number.NaN };

      const result = operator.evaluate(['entity', 'target'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: Invalid entity at path entity'
      );
    });

    test('warns and returns false when target path cannot be resolved', () => {
      mockContext.entity = { id: 'entity-123' };

      const result = operator.evaluate(['entity', 'target'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: No target found at path target'
      );
    });

    test('warns and returns false when target id is invalid', () => {
      mockContext.entity = { id: 'entity-123' };
      mockContext.target = {};

      const result = operator.evaluate(['entity', 'target'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: Invalid entity at path target'
      );
    });

    test('returns false and logs error when evaluateInternal throws', () => {
      const throwingOperator = new (class extends BaseFurnitureOperator {
        constructor(dependencies) {
          super(dependencies, 'throwingOperator');
        }

        evaluateInternal() {
          throw new Error('boom');
        }
      })(mockDependencies);

      mockContext.entity = { id: 'entity-123' };
      mockContext.target = { id: 'chair-456' };

      const result = throwingOperator.evaluate(
        ['entity', 'target'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        'throwingOperator: Error during evaluation',
        expect.any(Error)
      );
    });

    test('returns evaluateInternal result when subclass returns false', () => {
      mockContext.entity = { id: 'entity-123' };
      mockContext.target = { id: 'chair-456' };

      const result = operator.evaluate(
        ['entity', 'target', 'return-false'],
        mockContext
      );

      expect(result).toBe(false);
    });
  });

  describe('component helpers', () => {
    test('getSittingOnData returns component data when available', () => {
      const sittingOnData = { furniture_id: 'chair-1' };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        sittingOnData
      );

      const result = operator.getSittingOnData('entity-1');

      expect(result).toBe(sittingOnData);
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('entity-1', 'sitting-states:sitting_on');
    });

    test('getSittingOnData returns null when component is missing', () => {
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        undefined
      );

      const result = operator.getSittingOnData('entity-1');

      expect(result).toBeNull();
    });

    test('getAllowsSittingData returns component data when available', () => {
      const allowsSittingData = { spots: [] };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        allowsSittingData
      );

      const result = operator.getAllowsSittingData('furniture-1');

      expect(result).toBe(allowsSittingData);
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('furniture-1', 'sitting:allows_sitting');
    });

    test('getAllowsSittingData returns null when component is missing', () => {
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        undefined
      );

      const result = operator.getAllowsSittingData('furniture-1');

      expect(result).toBeNull();
    });
  });

  describe('isSittingOn', () => {
    test('returns false and logs debug when entity lacks component', () => {
      jest.spyOn(operator, 'getSittingOnData').mockReturnValue(null);

      const result = operator.isSittingOn('entity-1', 'chair-1');

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'testOperator: Entity entity-1 has no sitting_on component'
      );
    });

    test('returns true when entity sits on specified furniture', () => {
      jest.spyOn(operator, 'getSittingOnData').mockReturnValue({
        furniture_id: 'chair-1',
      });

      const result = operator.isSittingOn('entity-1', 'chair-1');

      expect(result).toBe(true);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'testOperator: Entity entity-1 is sitting on furniture chair-1'
      );
    });

    test('returns false when entity sits on different furniture', () => {
      jest.spyOn(operator, 'getSittingOnData').mockReturnValue({
        furniture_id: 'chair-2',
      });

      const result = operator.isSittingOn('entity-1', 'chair-1');

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'testOperator: Entity entity-1 is not sitting on furniture chair-1'
      );
    });
  });

  describe('getFurnitureSpots', () => {
    test('returns invalid result and logs when allows_sitting missing', () => {
      jest.spyOn(operator, 'getAllowsSittingData').mockReturnValue(null);

      const result = operator.getFurnitureSpots('chair-1');

      expect(result).toEqual({ spots: [], isValid: false });
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'testOperator: Furniture chair-1 has no allows_sitting component'
      );
    });

    test('returns invalid result and warns when spots is not array', () => {
      jest
        .spyOn(operator, 'getAllowsSittingData')
        .mockReturnValue({ spots: {} });

      const result = operator.getFurnitureSpots('chair-1');

      expect(result).toEqual({ spots: [], isValid: false });
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: Furniture chair-1 has invalid spots property (not an array)'
      );
    });

    test('returns spots when allows_sitting data is valid', () => {
      const spots = [{ id: 'spot-1' }];
      jest.spyOn(operator, 'getAllowsSittingData').mockReturnValue({ spots });

      const result = operator.getFurnitureSpots('chair-1');

      expect(result).toEqual({ spots, isValid: true });
    });
  });
});
