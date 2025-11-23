/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { HasClothingInSlotLayerOperator } from '../../../../src/logic/operators/hasClothingInSlotLayerOperator.js';

describe('HasClothingInSlotLayerOperator', () => {
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

    operator = new HasClothingInSlotLayerOperator(mockDependencies);
    mockContext = {};
  });

  describe('constructor', () => {
    test('should initialize successfully with valid dependencies', () => {
      expect(operator).toBeDefined();
      expect(operator.operatorName).toBe('hasClothingInSlotLayer');
    });
  });

  describe('evaluate', () => {
    test('should return true when slot and layer have clothing items', () => {
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

      const result = operator.evaluate(
        ['actor', 'torso_upper', 'base'],
        mockContext
      );

      expect(result).toBe(true);
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('actor123', 'clothing:equipment');
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        "hasClothingInSlotLayer: Entity actor123 slot 'torso_upper' layer 'base' has items: true"
      );
    });

    test('should return true when layer has array items', () => {
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

      const result = operator.evaluate(
        ['actor', 'hands', 'accessories'],
        mockContext
      );

      expect(result).toBe(true);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        "hasClothingInSlotLayer: Entity actor456 slot 'hands' layer 'accessories' has items: true"
      );
    });

    test('should return false when layer has empty array', () => {
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

      const result = operator.evaluate(
        ['actor', 'feet', 'accessories'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        "hasClothingInSlotLayer: Entity actor789 slot 'feet' layer 'accessories' has items: false"
      );
    });

    test('should return false when layer does not exist', () => {
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
        ['actor', 'torso_upper', 'outer'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        "hasClothingInSlotLayer: Entity actor123 slot 'torso_upper' layer 'outer' has items: false"
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
        ['actor', 'nonexistent_slot', 'base'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        "hasClothingInSlotLayer: Entity actor123 slot 'nonexistent_slot' layer 'base' has items: false"
      );
    });

    test('should return false when entity has no equipment component', () => {
      mockDependencies.entityManager.getComponentData.mockReturnValue(null);
      mockContext.actor = { id: 'actor999' };

      const result = operator.evaluate(
        ['actor', 'torso_upper', 'base'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'hasClothingInSlotLayer: Entity actor999 has no clothing:equipment component'
      );
    });

    test('should test all valid layer names', () => {
      const equipmentData = {
        equipped: {
          torso_upper: {
            underwear: 'bra123',
            base: 'shirt456',
            outer: 'jacket789',
            accessories: 'necklace012',
          },
        },
      };
      mockDependencies.entityManager.getComponentData.mockReturnValue(
        equipmentData
      );
      mockContext.actor = { id: 'actor123' };

      expect(
        operator.evaluate(['actor', 'torso_upper', 'underwear'], mockContext)
      ).toBe(true);
      expect(
        operator.evaluate(['actor', 'torso_upper', 'base'], mockContext)
      ).toBe(true);
      expect(
        operator.evaluate(['actor', 'torso_upper', 'outer'], mockContext)
      ).toBe(true);
      expect(
        operator.evaluate(['actor', 'torso_upper', 'accessories'], mockContext)
      ).toBe(true);
    });

    test('should return false with invalid layer name', () => {
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(
        ['actor', 'torso_upper', 'invalid_layer'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        "hasClothingInSlotLayer: Invalid layer name 'invalid_layer'. Valid layers: underwear, base, outer, accessories, armor"
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

      const result = operator.evaluate(['.', 'legs', 'base'], mockContext);

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
        ['event.target', 'torso_upper', 'underwear'],
        mockContext
      );

      expect(result).toBe(true);
      expect(
        mockDependencies.entityManager.getComponentData
      ).toHaveBeenCalledWith('target789', 'clothing:equipment');
    });

    test('should return false with missing parameters', () => {
      mockContext.actor = { id: 'actor123' };

      const result1 = operator.evaluate(['actor'], mockContext);
      const result2 = operator.evaluate(['actor', 'torso_upper'], mockContext);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasClothingInSlotLayer: Missing required parameters: slotName, layerName'
      );
    });

    test('should return false with invalid slot name parameter', () => {
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', null, 'base'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasClothingInSlotLayer: Invalid slotName parameter: null'
      );
    });

    test('should return false with invalid layer name parameter type', () => {
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(
        ['actor', 'torso_upper', null],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasClothingInSlotLayer: Invalid layerName parameter: null'
      );
    });

    test('should return false with non-string slot name', () => {
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(['actor', 123, 'base'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasClothingInSlotLayer: Invalid slotName parameter: 123'
      );
    });

    test('should return false with non-string layer name', () => {
      mockContext.actor = { id: 'actor123' };

      const result = operator.evaluate(
        ['actor', 'torso_upper', 123],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasClothingInSlotLayer: Invalid layerName parameter: 123'
      );
    });

    test('should return false with empty string parameters', () => {
      mockContext.actor = { id: 'actor123' };

      const result1 = operator.evaluate(['actor', '', 'base'], mockContext);
      const result2 = operator.evaluate(
        ['actor', 'torso_upper', ''],
        mockContext
      );

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasClothingInSlotLayer: Invalid slotName parameter: '
      );
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'hasClothingInSlotLayer: Invalid layerName parameter: '
      );
    });

    test('should handle complex equipment data with multiple slots and layers', () => {
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

      // Test existing layers
      expect(
        operator.evaluate(['actor', 'torso_upper', 'underwear'], mockContext)
      ).toBe(true);
      expect(
        operator.evaluate(['actor', 'torso_upper', 'base'], mockContext)
      ).toBe(true);
      expect(
        operator.evaluate(['actor', 'torso_upper', 'outer'], mockContext)
      ).toBe(true);
      expect(
        operator.evaluate(['actor', 'feet', 'accessories'], mockContext)
      ).toBe(true);

      // Test missing layers
      expect(
        operator.evaluate(['actor', 'torso_upper', 'accessories'], mockContext)
      ).toBe(false);
      expect(
        operator.evaluate(['actor', 'torso_lower', 'outer'], mockContext)
      ).toBe(false);
      expect(
        operator.evaluate(['actor', 'hands', 'accessories'], mockContext)
      ).toBe(false); // empty array

      // Test non-existent slots
      expect(operator.evaluate(['actor', 'head', 'base'], mockContext)).toBe(
        false
      );
    });

    test('should handle equipment data with only empty slots and layers', () => {
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

      const result1 = operator.evaluate(
        ['actor', 'torso_upper', 'base'],
        mockContext
      );
      const result2 = operator.evaluate(
        ['actor', 'hands', 'accessories'],
        mockContext
      );

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

      const result = operator.evaluate(
        ['actor', 'torso_upper', 'base'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        "hasClothingInSlotLayer: Entity actor123 slot 'torso_upper' layer 'base' has items: false"
      );
    });

    test('should validate against all invalid layer names', () => {
      mockContext.actor = { id: 'actor123' };

      const invalidLayers = [
        'top',
        'bottom',
        'middle',
        'layer',
        'clothing',
        'item',
      ];

      invalidLayers.forEach((invalidLayer) => {
        const result = operator.evaluate(
          ['actor', 'torso_upper', invalidLayer],
          mockContext
        );
        expect(result).toBe(false);
        expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
          `hasClothingInSlotLayer: Invalid layer name '${invalidLayer}'. Valid layers: underwear, base, outer, accessories, armor`
        );
      });
    });
  });
});
