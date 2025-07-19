/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { HasClothingInSlotOperator } from '../../../../src/logic/operators/hasClothingInSlotOperator.js';

describe('HasClothingInSlotOperator', () => {
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

    operator = new HasClothingInSlotOperator(mockDependencies);
    mockContext = {};
  });

  describe('constructor', () => {
    test('should initialize successfully with valid dependencies', () => {
      expect(operator).toBeDefined();
      expect(operator.operatorName).toBe('hasClothingInSlot');
    });
  });

  describe('evaluate', () => {
    test('should return true when slot has clothing items', () => {
      const equipmentData = {
        equipped: {
          torso_upper: {
            base: 'shirt123',
            outer: 'jacket456',
          },
        },
      };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        equipmentData
      );
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'torso_upper'], mockContext);

      expect(result).toBe(true);
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('actor123', 'clothing:equipment');
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        "hasClothingInSlot: Entity actor123 slot 'torso_upper' has items: true"
      );
    });

    test('should return true when slot has array items', () => {
      const equipmentData = {
        equipped: {
          hands: {
            accessories: ['gloves123', 'rings456'],
          },
        },
      };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        equipmentData
      );
      mockContext.actor = { id: 'actor456' };

      const result = operator.evaluate(['actor', 'hands'], mockContext);

      expect(result).toBe(true);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        "hasClothingInSlot: Entity actor456 slot 'hands' has items: true"
      );
    });

    test('should return false when slot has empty array', () => {
      const equipmentData = {
        equipped: {
          feet: {
            accessories: [],
          },
        },
      };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        equipmentData
      );
      mockContext.actor = { id: 'actor789' };

      const result = operator.evaluate(['actor', 'feet'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        "hasClothingInSlot: Entity actor789 slot 'feet' has items: false"
      );
    });

    test('should return false when slot does not exist', () => {
      const equipmentData = {
        equipped: {
          torso_upper: {
            base: 'shirt123',
          },
        },
      };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        equipmentData
      );
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(
        ['actor', 'nonexistent_slot'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        "hasClothingInSlot: Entity actor123 slot 'nonexistent_slot' has items: false"
      );
    });

    test('should return false when entity has no equipment component', () => {
      mockDependencies.entityManager.getComponentData.mockReturnValue(null);
      mockContext.actor = { id: 'actor999' };

      const result = operator.evaluate(['actor', 'torso_upper'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasClothingInSlot: Entity actor999 has no clothing:equipment component'
      );
    });

    test('should handle dot path correctly', () => {
      const equipmentData = {
        equipped: {
          legs: {
            base: 'pants123',
          },
        },
      };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        equipmentData
      );
      mockContext.entity = { id: 'entity456' };

      const result = operator.evaluate(['.', 'legs'], mockContext);

      expect(result).toBe(true);
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('entity456', 'clothing:equipment');
    });

    test('should handle nested entity paths', () => {
      const equipmentData = {
        equipped: {
          torso_upper: {
            underwear: 'bra123',
          },
        },
      };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        equipmentData
      );
      mockContext.event = { target: { id: 'target789' } };

      const result = operator.evaluate(
        ['event.target', 'torso_upper'],
        mockContext
      );

      expect(result).toBe(true);
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('target789', 'clothing:equipment');
    });

    test('should return false with missing slot name parameter', () => {
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasClothingInSlot: Invalid parameters'
      );
    });

    test('should return false with invalid slot name parameter', () => {
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', null], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasClothingInSlot: Invalid slotName parameter: null'
      );
    });

    test('should return false with non-string slot name', () => {
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 123], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasClothingInSlot: Invalid slotName parameter: 123'
      );
    });

    test('should return false with empty string slot name', () => {
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', ''], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasClothingInSlot: Invalid slotName parameter: '
      );
    });

    test('should handle complex equipment data with multiple slots', () => {
      const equipmentData = {
        equipped: {
          torso_upper: {
            underwear: 'bra123',
            base: 'shirt456',
            outer: 'jacket789',
          },
          torso_lower: {
            underwear: 'underwear123',
            base: 'pants456',
          },
          feet: {
            base: 'shoes123',
            accessories: ['socks456', 'insoles789'],
          },
          hands: {
            accessories: [],
          },
        },
      };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        equipmentData
      );
      mockContext.actor = { id: 'actor123' };

      // Test multiple slots
      expect(operator.evaluate(['actor', 'torso_upper'], mockContext)).toBe(
        true
      );
      expect(operator.evaluate(['actor', 'torso_lower'], mockContext)).toBe(
        true
      );
      expect(operator.evaluate(['actor', 'feet'], mockContext)).toBe(true);
      expect(operator.evaluate(['actor', 'hands'], mockContext)).toBe(false); // empty array
      expect(operator.evaluate(['actor', 'head'], mockContext)).toBe(false); // doesn't exist
    });

    test('should handle equipment data with only empty slots', () => {
      const equipmentData = {
        equipped: {
          torso_upper: {},
          hands: {
            accessories: [],
          },
        },
      };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        equipmentData
      );
      mockContext.actor = { id: 'actor123' };

      const result1 = operator.evaluate(['actor', 'torso_upper'], mockContext);
      const result2 = operator.evaluate(['actor', 'hands'], mockContext);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    test('should handle malformed equipment data gracefully', () => {
      const equipmentData = {
        equipped: null,
      };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        equipmentData
      );
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 'torso_upper'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        "hasClothingInSlot: Entity actor123 slot 'torso_upper' has items: false"
      );
    });
  });
});
