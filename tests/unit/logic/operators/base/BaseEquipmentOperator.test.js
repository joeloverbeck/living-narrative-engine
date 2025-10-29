/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BaseEquipmentOperator } from '../../../../../src/logic/operators/base/BaseEquipmentOperator.js';

// Create a concrete implementation for testing the abstract base class
class TestEquipmentOperator extends BaseEquipmentOperator {
  constructor(dependencies) {
    super(dependencies, 'testOperator');
  }

  evaluateInternal(entityId, params, context) {
    // Simple test implementation
    return params[0] === 'test-value';
  }
}

describe('BaseEquipmentOperator', () => {
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

    operator = new TestEquipmentOperator(mockDependencies);
    mockContext = {};
  });

  describe('constructor', () => {
    test('should initialize successfully with valid dependencies', () => {
      expect(operator).toBeDefined();
      expect(operator.operatorName).toBe('testOperator');
    });

    test('should throw error when entityManager is missing', () => {
      expect(() => {
        new TestEquipmentOperator({
          logger: mockDependencies.logger,
        });
      }).toThrow('BaseEquipmentOperator: Missing required dependencies');
    });

    test('should throw error when logger is missing', () => {
      expect(() => {
        new TestEquipmentOperator({
          entityManager: mockDependencies.entityManager,
        });
      }).toThrow('BaseEquipmentOperator: Missing required dependencies');
    });
  });

  describe('evaluate', () => {
    test('should evaluate successfully with valid entity path', () => {
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(true);
      expect(mockContext._currentPath).toBe('actor');
    });

    test('should evaluate successfully when entity ID is zero', () => {
      mockContext.actor = { id: 0 };

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(true);
    });

    test('should evaluate successfully with dot path', () => {
      mockContext.entity = { id: 'entity456' };

      const result = operator.evaluate(['.', 'test-value'], mockContext);

      expect(result).toBe(true);
      expect(mockContext._currentPath).toBe('.');
    });

    test('should evaluate successfully with direct entity ID', () => {
      mockContext.entity = 'direct789';

      const result = operator.evaluate(['.', 'test-value'], mockContext);

      expect(result).toBe(true);
    });

    test('should return false with invalid parameters', () => {
      const result = operator.evaluate([], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: Invalid parameters'
      );
    });

    test('should return false with null parameters', () => {
      const result = operator.evaluate(null, mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: Invalid parameters'
      );
    });

    test('should return false with invalid entity path', () => {
      mockContext = {};

      const result = operator.evaluate(
        ['nonexistent', 'test-value'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: No entity found at path nonexistent'
      );
    });

    test('should return false with null entity', () => {
      mockContext.actor = null;

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: No entity found at path actor'
      );
    });

    test('should return false with entity without ID', () => {
      mockContext.actor = {}; // Entity exists but has no id property

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: Invalid entity at path actor'
      );
    });

    test('should return false when entity ID is an empty string', () => {
      mockContext.actor = { id: '   ' };

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: Invalid entity at path actor'
      );
    });

    test('should return false when entity ID is NaN', () => {
      mockContext.actor = { id: Number.NaN };

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testOperator: Invalid entity at path actor'
      );
    });

    test('should handle errors gracefully', () => {
      const errorOperator = new (class extends BaseEquipmentOperator {
        constructor(deps) {
          super(deps, 'errorOperator');
        }
        evaluateInternal() {
          throw new Error('Test error');
        }
      })(mockDependencies);

      mockContext.actor = { id: 'actor123' };

      const result = errorOperator.evaluate(['actor', 'test'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        'errorOperator: Error during evaluation',
        expect.any(Error)
      );
    });
  });

  describe('getEquipmentData', () => {
    test('should return equipment data when component exists', () => {
      const mockEquipmentData = {
        equipped: {
          torso_upper: {
            base: 'shirt123',
          },
        },
      };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        mockEquipmentData
      );

      const result = operator.getEquipmentData('entity123');

      expect(result).toEqual(mockEquipmentData);
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('entity123', 'clothing:equipment');
    });

    test('should return null when component does not exist', () => {
      mockDependencies.entityManager.getComponentData.mockReturnValue(null);

      const result = operator.getEquipmentData('entity456');

      expect(result).toBeNull();
    });

    test('should return null when component is undefined', () => {
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        undefined
      );

      const result = operator.getEquipmentData('entity789');

      expect(result).toBeNull();
    });
  });

  describe('hasItemsInSlot', () => {
    test('should return true when slot has string item', () => {
      const equipmentData = {
        equipped: {
          torso_upper: {
            base: 'shirt123',
          },
        },
      };

      const result = operator.hasItemsInSlot(equipmentData, 'torso_upper');

      expect(result).toBe(true);
    });

    test('should return true when slot has array items', () => {
      const equipmentData = {
        equipped: {
          hands: {
            accessories: ['gloves123', 'rings456'],
          },
        },
      };

      const result = operator.hasItemsInSlot(equipmentData, 'hands');

      expect(result).toBe(true);
    });

    test('should return false when slot has empty array', () => {
      const equipmentData = {
        equipped: {
          feet: {
            accessories: [],
          },
        },
      };

      const result = operator.hasItemsInSlot(equipmentData, 'feet');

      expect(result).toBe(false);
    });

    test('should return false when slot does not exist', () => {
      const equipmentData = {
        equipped: {
          torso_upper: {
            base: 'shirt123',
          },
        },
      };

      const result = operator.hasItemsInSlot(equipmentData, 'nonexistent');

      expect(result).toBe(false);
    });

    test('should return false when slot has invalid structure', () => {
      const equipmentData = {
        equipped: {
          torso_upper: [],
        },
      };

      const result = operator.hasItemsInSlot(equipmentData, 'torso_upper');

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        "testOperator: hasItemsInSlot - Slot 'torso_upper' has invalid structure (not an object)"
      );
    });

    test('should return false when equipped is missing', () => {
      const equipmentData = {};

      const result = operator.hasItemsInSlot(equipmentData, 'torso_upper');

      expect(result).toBe(false);
    });

    test('should return false when equipment data is null', () => {
      const result = operator.hasItemsInSlot(null, 'torso_upper');

      expect(result).toBe(false);
    });

    test('should return true when slot has object items', () => {
      const equipmentData = {
        equipped: {
          head: {
            outer: {
              id: 'hat123',
            },
          },
        },
      };

      const result = operator.hasItemsInSlot(equipmentData, 'head');

      expect(result).toBe(true);
    });
  });

  describe('hasItemsInSlotLayer', () => {
    test('should return true when layer has string item', () => {
      const equipmentData = {
        equipped: {
          torso_upper: {
            base: 'shirt123',
            outer: 'jacket456',
          },
        },
      };

      const result = operator.hasItemsInSlotLayer(
        equipmentData,
        'torso_upper',
        'base'
      );

      expect(result).toBe(true);
    });

    test('should return true when layer has array items', () => {
      const equipmentData = {
        equipped: {
          hands: {
            accessories: ['gloves123', 'rings456'],
          },
        },
      };

      const result = operator.hasItemsInSlotLayer(
        equipmentData,
        'hands',
        'accessories'
      );

      expect(result).toBe(true);
    });

    test('should return false when layer has empty array', () => {
      const equipmentData = {
        equipped: {
          feet: {
            accessories: [],
          },
        },
      };

      const result = operator.hasItemsInSlotLayer(
        equipmentData,
        'feet',
        'accessories'
      );

      expect(result).toBe(false);
    });

    test('should return false when layer does not exist', () => {
      const equipmentData = {
        equipped: {
          torso_upper: {
            base: 'shirt123',
          },
        },
      };

      const result = operator.hasItemsInSlotLayer(
        equipmentData,
        'torso_upper',
        'outer'
      );

      expect(result).toBe(false);
    });

    test('should return false when slot does not exist', () => {
      const equipmentData = {
        equipped: {
          torso_upper: {
            base: 'shirt123',
          },
        },
      };

      const result = operator.hasItemsInSlotLayer(
        equipmentData,
        'nonexistent',
        'base'
      );

      expect(result).toBe(false);
    });
  });

  describe('isValidLayerName', () => {
    test('should return true for valid layer names', () => {
      expect(operator.isValidLayerName('underwear')).toBe(true);
      expect(operator.isValidLayerName('base')).toBe(true);
      expect(operator.isValidLayerName('outer')).toBe(true);
      expect(operator.isValidLayerName('accessories')).toBe(true);
    });

    test('should return false for invalid layer names', () => {
      expect(operator.isValidLayerName('invalid')).toBe(false);
      expect(operator.isValidLayerName('top')).toBe(false);
      expect(operator.isValidLayerName('')).toBe(false);
      expect(operator.isValidLayerName(null)).toBe(false);
      expect(operator.isValidLayerName(undefined)).toBe(false);
    });
  });

  describe('evaluateInternal - abstract method', () => {
    test('should throw error when not implemented', () => {
      const abstractOperator = new BaseEquipmentOperator(
        mockDependencies,
        'abstract'
      );

      expect(() => {
        abstractOperator.evaluateInternal('entity123', [], {});
      }).toThrow('evaluateInternal must be implemented by subclass');
    });
  });
});
