/**
 * @file Unit tests for isSocketCovered operator
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { IsSocketCoveredOperator } from '../../../../src/logic/operators/isSocketCoveredOperator.js';

describe('IsSocketCoveredOperator', () => {
  let operator;
  let mockEntityManager;
  let mockLogger;
  let mockContext;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock entity manager
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    // Create operator instance
    operator = new IsSocketCoveredOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    // Mock context with trace capability
    mockContext = {
      trace: {
        captureOperatorEvaluation: jest.fn(),
      },
    };
  });

  describe('evaluateInternal', () => {
    it('should return false when entity has no equipment component', () => {
      // Arrange
      mockEntityManager.getComponentData.mockReturnValue(null);

      // Act
      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      // Assert
      expect(result).toBe(false);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'entity1',
        'clothing:equipment'
      );
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          operator: 'isSocketCovered',
          entityId: 'entity1',
          socketId: 'vagina',
          hasEquipmentComponent: false,
          result: false,
          reason: 'No clothing:equipment component',
        })
      );
    });

    it('should return false when entity has no slot_metadata component', () => {
      // Arrange
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ equipped: {} }) // equipment component
        .mockReturnValueOnce(null); // no slot_metadata

      // Act
      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      // Assert
      expect(result).toBe(false);
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          result: false,
          reason: "No slots defined to cover socket 'vagina'",
        })
      );
    });

    it('should return false when socket has no covering slots defined', () => {
      // Arrange
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ equipped: {} }) // equipment component
        .mockReturnValueOnce({
          // slot_metadata but no vagina coverage
          slotMappings: {
            torso_upper: {
              coveredSockets: ['left_chest', 'right_chest'],
            },
          },
        });

      // Act
      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      // Assert
      expect(result).toBe(false);
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          potentialCoveringSlots: [],
          result: false,
          reason: "No slots defined to cover socket 'vagina'",
        })
      );
    });

    it('should return false when covering slot exists but has no items', () => {
      // Arrange
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // equipment with empty torso_lower slot
          equipped: {
            torso_lower: {
              underwear: [],
              base: [],
              outer: [],
            },
          },
        })
        .mockReturnValueOnce({
          // slot_metadata with vagina coverage
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina', 'pubic_hair'],
            },
          },
        });

      // Act
      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      // Assert
      expect(result).toBe(false);
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          potentialCoveringSlots: ['torso_lower'],
          slotChecks: {
            torso_lower: {
              hasItems: false,
              hasCoveringItems: false,
              slotExists: true,
              layers: ['underwear', 'base', 'outer'],
              itemCounts: {
                underwear: 0,
                base: 0,
                outer: 0,
              },
            },
          },
          coveredBySlot: null,
          result: false,
          reason: 'No items found in any covering slot',
        })
      );
    });

    it('should return false when equipment has no equipped structure', () => {
      // Arrange
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // equipment component without equipped property
          inventory: [],
        })
        .mockReturnValueOnce({
          // slot_metadata with vagina coverage
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina', 'pubic_hair'],
            },
          },
        });

      // Act
      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      // Assert
      expect(result).toBe(false);
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          hasEquipmentComponent: true,
          hasEquippedStructure: false,
          result: false,
          reason: 'No equipped items structure in clothing:equipment',
        })
      );
    });

    it('should return false when slot metadata has no slotMappings', () => {
      // Arrange
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // equipment with slots
          equipped: {
            torso_lower: {
              underwear: [],
              base: [],
              outer: [],
            },
          },
        })
        .mockReturnValueOnce({
          // slot_metadata without slotMappings
          someOtherProperty: {},
        });

      // Act
      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      // Assert
      expect(result).toBe(false);
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          potentialCoveringSlots: [],
          result: false,
          reason: "No slots defined to cover socket 'vagina'",
        })
      );
    });

    it('should return true when covering slot has items in underwear layer', () => {
      // Arrange
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // equipment with items in torso_lower
          equipped: {
            torso_lower: {
              underwear: ['nude_thong'],
              base: [],
              outer: [],
            },
          },
        })
        .mockReturnValueOnce({
          // slot_metadata with vagina coverage
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina', 'pubic_hair'],
            },
          },
        });

      // Act
      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      // Assert
      expect(result).toBe(true);
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          potentialCoveringSlots: ['torso_lower'],
          slotChecks: {
            torso_lower: {
              hasItems: true,
              hasCoveringItems: true,
              slotExists: true,
              layers: ['underwear', 'base', 'outer'],
              itemCounts: {
                underwear: 1,
                base: 0,
                outer: 0,
              },
            },
          },
          coveredBySlot: 'torso_lower',
          result: true,
          reason: "Socket covered by items in slot 'torso_lower'",
        })
      );
    });

    it('should treat string-based layers as covering items', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_lower: {
              base: 'bodysuit',
            },
          },
        })
        .mockReturnValueOnce({
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina', 'pubic_hair'],
            },
          },
        });

      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      expect(result).toBe(true);
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          potentialCoveringSlots: ['torso_lower'],
          slotChecks: {
            torso_lower: {
              hasItems: true,
              hasCoveringItems: true,
              slotExists: true,
              layers: ['base'],
              itemCounts: {
                base: 1,
              },
            },
          },
          coveredBySlot: 'torso_lower',
          result: true,
        })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Slot 'torso_lower' covers sockets")
      );
    });

    it('should record zero counts for empty string layers in trace output', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          equipped: {
            torso_lower: {
              base: '',
              outer: 'coat',
            },
          },
        })
        .mockReturnValueOnce({
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina'],
            },
          },
        });

      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      expect(result).toBe(true);
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          slotChecks: {
            torso_lower: expect.objectContaining({
              itemCounts: {
                base: 0,
                outer: 1,
              },
            }),
          },
        })
      );
    });

    it('should return true when any of multiple covering slots has items', () => {
      // Arrange
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // equipment with items in full_body but not torso_lower
          equipped: {
            torso_lower: {
              underwear: [],
              base: [],
              outer: [],
            },
            full_body: {
              base: ['dress'],
            },
          },
        })
        .mockReturnValueOnce({
          // slot_metadata with multiple slots covering vagina
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina', 'pubic_hair'],
            },
            full_body: {
              coveredSockets: ['vagina', 'chest', 'abdomen'],
            },
          },
        });

      // Act
      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      // Assert
      expect(result).toBe(true);
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          potentialCoveringSlots: ['torso_lower', 'full_body'],
          coveredBySlot: 'full_body',
          result: true,
        })
      );
    });

    it('should return false when covering slot exists in metadata but not in equipment', () => {
      // Arrange
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // equipment without torso_lower slot
          equipped: {
            torso_upper: {
              base: ['shirt'],
            },
          },
        })
        .mockReturnValueOnce({
          // slot_metadata with torso_lower covering vagina
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina', 'pubic_hair'],
            },
          },
        });

      // Act
      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      // Assert
      expect(result).toBe(false);
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          potentialCoveringSlots: ['torso_lower'],
          slotChecks: {
            torso_lower: {
              hasItems: false,
              hasCoveringItems: false,
              slotExists: false,
              layers: [],
              itemCounts: {},
            },
          },
          result: false,
          reason: 'No items found in any covering slot',
        })
      );
    });

    it('should handle missing parameters gracefully', () => {
      // Act
      const result = operator.evaluateInternal('entity1', [], mockContext);

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isSocketCovered: Missing required parameter: socketId'
      );
    });

    it('should handle invalid socket ID gracefully', () => {
      // Act
      const result = operator.evaluateInternal('entity1', [123], mockContext);

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'isSocketCovered: Invalid socketId parameter: 123'
      );
    });

    it('should work without trace context', () => {
      // Arrange
      mockEntityManager.getComponentData
        .mockReturnValueOnce({ equipped: {} })
        .mockReturnValueOnce(null);

      const contextWithoutTrace = {};

      // Act
      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        contextWithoutTrace
      );

      // Assert
      expect(result).toBe(false);
      // Should not throw error when trace is not available
    });

    it('should handle errors gracefully', () => {
      // Arrange
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Act
      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Database error',
          result: false,
        })
      );
    });
  });

  describe('evaluate (from base class)', () => {
    it('should handle the full evaluation flow', () => {
      // Arrange
      const params = ['.', 'vagina'];
      const context = {
        entity: { id: 'entity1' },
        trace: mockContext.trace,
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ equipped: {} })
        .mockReturnValueOnce(null);

      // Act
      const result = operator.evaluate(params, context);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('accessories layer handling', () => {
    it('should return false when only accessories are equipped in the covering slot', () => {
      // Arrange
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // equipment with only accessories in torso_lower slot
          equipped: {
            torso_lower: {
              accessories: ['belt1'], // Only a belt, no actual covering clothes
            },
          },
        })
        .mockReturnValueOnce({
          // slot_metadata with vagina covered by torso_lower
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina', 'pubic_hair'],
            },
          },
        });

      // Act
      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "hasItemsInSlotExcludingAccessories - Slot 'torso_lower' has covering items: false"
        )
      );
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          potentialCoveringSlots: ['torso_lower'],
          slotChecks: {
            torso_lower: expect.objectContaining({
              hasItems: true, // hasItemsInSlot returns true
              hasCoveringItems: false, // hasItemsInSlotExcludingAccessories returns false
              slotExists: true,
              layers: ['accessories'],
            }),
          },
          coveredBySlot: null,
          result: false,
          reason: 'No items found in any covering slot',
        })
      );
    });

    it('should return true when non-accessory items are equipped alongside accessories', () => {
      // Arrange
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // equipment with both underwear and accessories in torso_lower
          equipped: {
            torso_lower: {
              underwear: ['thong1'],
              accessories: ['belt1'], // Belt doesn't affect coverage
            },
          },
        })
        .mockReturnValueOnce({
          // slot_metadata with vagina covered by torso_lower
          slotMappings: {
            torso_lower: {
              coveredSockets: ['vagina', 'pubic_hair'],
            },
          },
        });

      // Act
      const result = operator.evaluateInternal(
        'entity1',
        ['vagina'],
        mockContext
      );

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "hasItemsInSlotExcludingAccessories - Slot 'torso_lower' has covering items: true"
        )
      );
      expect(mockContext.trace.captureOperatorEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          potentialCoveringSlots: ['torso_lower'],
          slotChecks: {
            torso_lower: expect.objectContaining({
              hasItems: true,
              hasCoveringItems: true, // Both return true now
              slotExists: true,
              layers: ['underwear', 'accessories'],
            }),
          },
          coveredBySlot: 'torso_lower',
          result: true,
          reason: "Socket covered by items in slot 'torso_lower'",
        })
      );
    });
  });

  describe('hasItemsInSlotExcludingAccessories', () => {
    it('should return false when equipment data lacks equipped property', () => {
      const result = operator.hasItemsInSlotExcludingAccessories({}, 'torso_lower');

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "isSocketCovered: hasItemsInSlotExcludingAccessories - No equipped property in equipment data"
      );
    });

    it('should return false when slot has invalid structure', () => {
      const result = operator.hasItemsInSlotExcludingAccessories(
        { equipped: { torso_lower: ['bad-structure'] } },
        'torso_lower'
      );

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "isSocketCovered: hasItemsInSlotExcludingAccessories - Slot 'torso_lower' has invalid structure (not an object)"
      );
    });

    it('should detect coverage when slot uses object item structure', () => {
      const result = operator.hasItemsInSlotExcludingAccessories(
        {
          equipped: {
            torso_lower: {
              base: {
                front: 'dress-front',
              },
              accessories: ['belt'],
            },
          },
        },
        'torso_lower'
      );

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "isSocketCovered: hasItemsInSlotExcludingAccessories - Slot 'torso_lower' has covering items: true"
      );
    });

    it('should detect coverage when slot stores single string item', () => {
      const result = operator.hasItemsInSlotExcludingAccessories(
        {
          equipped: {
            torso_lower: {
              base: 'bodysuit',
            },
          },
        },
        'torso_lower'
      );

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "isSocketCovered: hasItemsInSlotExcludingAccessories - Slot 'torso_lower' has covering items: true"
      );
    });

    it('should return false when slot contains non-covering primitive values', () => {
      const result = operator.hasItemsInSlotExcludingAccessories(
        {
          equipped: {
            torso_lower: {
              base: 0,
            },
          },
        },
        'torso_lower'
      );

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "isSocketCovered: hasItemsInSlotExcludingAccessories - Slot 'torso_lower' has covering items: false"
      );
    });
  });

  describe('cache management', () => {
    it('should cache socket-to-slot mappings', () => {
      // Arrange
      const slotMetadata = {
        slotMappings: {
          torso_lower: {
            coveredSockets: ['vagina'],
          },
        },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ equipped: {} })
        .mockReturnValueOnce(slotMetadata)
        .mockReturnValueOnce({ equipped: {} });

      // Act - First call
      operator.evaluateInternal('entity1', ['vagina'], mockContext);

      // Act - Second call
      operator.evaluateInternal('entity1', ['vagina'], mockContext);

      // Assert - slot_metadata should only be fetched once due to caching
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(3); // 2 equipment, 1 slot_metadata
    });

    it('should clear cache for specific entity', () => {
      // Arrange
      const slotMetadata = {
        slotMappings: {
          torso_lower: {
            coveredSockets: ['vagina'],
          },
        },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ equipped: {} })
        .mockReturnValueOnce(slotMetadata)
        .mockReturnValueOnce({ equipped: {} })
        .mockReturnValueOnce(slotMetadata);

      // Act
      operator.evaluateInternal('entity1', ['vagina'], mockContext);
      operator.clearCache('entity1');
      operator.evaluateInternal('entity1', ['vagina'], mockContext);

      // Assert - slot_metadata fetched twice after cache clear
      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(4);
    });

    it('should clear entire cache when no entityId provided', () => {
      const slotMetadata = {
        slotMappings: {
          torso_lower: {
            coveredSockets: ['vagina'],
          },
        },
      };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({ equipped: {} })
        .mockReturnValueOnce(slotMetadata)
        .mockReturnValueOnce({ equipped: {} })
        .mockReturnValueOnce(slotMetadata);

      operator.evaluateInternal('entity1', ['vagina'], mockContext);
      operator.clearCache();
      operator.evaluateInternal('entity1', ['vagina'], mockContext);

      expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(4);
    });

    it('should remove cached entries only for the specified entity', () => {
      const slotMetadata = {
        slotMappings: {
          torso_lower: {
            coveredSockets: ['vagina'],
          },
        },
      };

      // Include invalid mapping to ensure branch coverage when mapping data is incomplete
      slotMetadata.slotMappings.invalid_slot = { someOtherField: true };

      const equipmentByEntity = {
        entity1: {
          equipped: {
            torso_lower: {
              base: ['skirt'],
            },
          },
        },
        entity2: {
          equipped: {
            torso_lower: {
              base: ['dress'],
            },
          },
        },
      };

      mockEntityManager.getComponentData.mockImplementation((entityId, type) => {
        if (type === 'clothing:equipment') {
          return equipmentByEntity[entityId];
        }
        if (type === 'clothing:slot_metadata') {
          return slotMetadata;
        }
        return null;
      });

      operator.evaluateInternal('entity1', ['vagina'], mockContext);
      operator.evaluateInternal('entity2', ['vagina'], mockContext);

      mockEntityManager.getComponentData.mockClear();
      mockEntityManager.getComponentData.mockImplementation((entityId, type) => {
        if (type === 'clothing:equipment') {
          return equipmentByEntity[entityId];
        }
        if (type === 'clothing:slot_metadata') {
          return slotMetadata;
        }
        return null;
      });

      operator.clearCache('entity1');
      operator.evaluateInternal('entity1', ['vagina'], mockContext);
      operator.evaluateInternal('entity2', ['vagina'], mockContext);

      const slotMetadataCalls = mockEntityManager.getComponentData.mock.calls.filter(
        ([, type]) => type === 'clothing:slot_metadata'
      );

      expect(slotMetadataCalls).toHaveLength(1);
    });
  });
});
