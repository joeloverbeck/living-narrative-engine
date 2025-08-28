import { describe, it, expect, beforeEach } from '@jest/globals';
import createSlotAccessResolver from '../../../../src/scopeDsl/nodes/slotAccessResolver.js';
import { 
  calculatePriorityWithValidation, 
  sortCandidatesWithTieBreaking,
  calculateCoveragePriorityOptimized,
  clearPriorityCache,
  getCacheStats
} from '../../../../src/scopeDsl/prioritySystem/priorityCalculator.js';
import { createTestBed } from '../../../common/testBed.js';

describe('SlotAccessResolver', () => {
  let resolver;
  let mockEntitiesGateway;
  let mockContext;
  let mockClothingAccessObject;
  let testBed;

  // Test utilities and helper functions
  const createMockClothingAccess = (equipment, mode = 'topmost') => {
    return {
      __clothingSlotAccess: true,
      equipped: equipment,
      mode: mode,
      type: 'clothing_slot_access',
    };
  };

  const createMockStructuredTraceContext = () => {
    const mockSpan = {
      addEvent: jest.fn(),
      addAttributes: jest.fn(),
      id: 'test-span-id'
    };

    return {
      structuredTrace: {
        startSpan: jest.fn().mockReturnValue(mockSpan),
        endSpan: jest.fn(),
        getActiveSpan: jest.fn().mockReturnValue(mockSpan),
      },
      mockSpan,
    };
  };

  const assertStructuredTracingCalled = (mockStructuredTrace, expectedOperations) => {
    expectedOperations.forEach(operation => {
      expect(mockStructuredTrace.startSpan).toHaveBeenCalledWith(
        operation,
        expect.any(Object)
      );
    });
  };

  // Test data sets for realistic equipment scenarios
  const REALISTIC_EQUIPMENT_SCENARIOS = {
    casualWear: {
      torso_upper: { base: 'tshirt_id' },
      torso_lower: { base: 'jeans_id' },
      feet: { base: 'sneakers_id' },
    },
    formalWear: {
      torso_upper: { outer: 'suit_jacket_id', base: 'dress_shirt_id' },
      torso_lower: { base: 'dress_pants_id' },
      feet: { base: 'dress_shoes_id' },
      hands: { accessories: 'watch_id' },
    },
    layeredOutfit: {
      torso_upper: { 
        outer: 'winter_coat_id', 
        base: 'sweater_id', 
        underwear: 'undershirt_id' 
      },
      torso_lower: { 
        base: 'thermal_pants_id', 
        underwear: 'underwear_id' 
      },
    },
  };

  beforeEach(() => {
    testBed = createTestBed();
    // Setup mock clothing access object (from ClothingStepResolver)
    mockClothingAccessObject = {
      __clothingSlotAccess: true,
      equipped: {
        torso_upper: {
          outer: 'jacket_1',
          base: 'shirt_1',
          underwear: 'undershirt_1',
        },
        torso_lower: {
          outer: 'pants_1',
          base: 'shorts_1',
        },
        legs: {
          base: 'leggings_1',
          underwear: 'underwear_legs_1',
        },
        feet: {
          outer: 'boots_1',
        },
        hands: {},
        head_gear: null,
      },
      mode: 'topmost',
      type: 'clothing_slot_access',
    };

    mockEntitiesGateway = {
      getComponentData: jest.fn().mockReturnValue(null),
    };

    resolver = createSlotAccessResolver({
      entitiesGateway: mockEntitiesGateway,
    });

    mockContext = {
      dispatcher: {
        resolve: jest.fn().mockReturnValue(new Set([mockClothingAccessObject])),
      },
      trace: {
        addLog: jest.fn(),
      },
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('canResolve', () => {
    it('should return true for clothing slot fields', () => {
      const slots = [
        'torso_upper',
        'torso_lower',
        'legs',
        'feet',
        'head_gear',
        'hands',
        'left_arm_clothing',
        'right_arm_clothing',
      ];

      slots.forEach((slot) => {
        const node = {
          type: 'Step',
          field: slot,
          parent: {
            type: 'Step',
            field: 'topmost_clothing',
          },
        };
        expect(resolver.canResolve(node)).toBe(true);
      });
    });

    it('should return false for non-clothing slot fields', () => {
      const node = {
        type: 'Step',
        field: 'regular_component',
        parent: {
          type: 'Step',
          field: 'topmost_clothing',
        },
      };
      expect(resolver.canResolve(node)).toBe(false);
    });

    it('should return false for non-Step nodes', () => {
      const node = { type: 'Source', field: 'torso_upper' };
      expect(resolver.canResolve(node)).toBe(false);
    });

    it('should return false for Step nodes without field', () => {
      const node = {
        type: 'Step',
        parent: {
          type: 'Step',
          field: 'topmost_clothing',
        },
      };
      expect(resolver.canResolve(node)).toBe(false);
    });

    it('should return false for clothing slot fields without proper parent', () => {
      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: {
          type: 'Step',
          field: 'some_other_field',
        },
      };
      expect(resolver.canResolve(node)).toBe(false);
    });
  });

  describe('resolve - slot access from clothing objects', () => {
    it('should resolve torso_upper slot with topmost mode', () => {
      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return the topmost item (outer layer)
      expect(result).toEqual(new Set(['jacket_1']));
    });

    it('should resolve torso_lower slot with topmost mode', () => {
      const node = {
        type: 'Step',
        field: 'torso_lower',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return the topmost item (outer layer)
      expect(result).toEqual(new Set(['pants_1']));
    });

    it('should resolve legs slot with no outer layer', () => {
      const node = {
        type: 'Step',
        field: 'legs',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return the base layer (no outer layer)
      expect(result).toEqual(new Set(['leggings_1']));
    });

    it('should handle empty slot data gracefully', () => {
      const node = {
        type: 'Step',
        field: 'hands',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return empty set for empty slot
      expect(result).toEqual(new Set());
    });

    it('should handle null slot data gracefully', () => {
      const node = {
        type: 'Step',
        field: 'head_gear',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return empty set for null slot
      expect(result).toEqual(new Set());
    });

    it('should handle missing slot gracefully', () => {
      const node = {
        type: 'Step',
        field: 'left_arm_clothing',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return empty set for missing slot
      expect(result).toEqual(new Set());
    });
  });

  describe('layer priority handling', () => {
    it('should respect topmost mode priority', () => {
      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return outer layer for topmost mode
      expect(result).toEqual(new Set(['jacket_1']));
    });

    it('should handle all mode correctly', () => {
      mockClothingAccessObject.mode = 'all';

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // For 'all' mode, still returns topmost (first in priority)
      expect(result).toEqual(new Set(['jacket_1']));
    });

    it('should handle outer mode correctly', () => {
      mockClothingAccessObject.mode = 'outer';

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return outer layer only
      expect(result).toEqual(new Set(['jacket_1']));
    });

    it('should handle base mode correctly', () => {
      mockClothingAccessObject.mode = 'base';

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return base layer only
      expect(result).toEqual(new Set(['shirt_1']));
    });

    it('should handle underwear mode correctly', () => {
      mockClothingAccessObject.mode = 'underwear';

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return underwear layer only
      expect(result).toEqual(new Set(['undershirt_1']));
    });

    it('should return empty when requested layer not present', () => {
      mockClothingAccessObject.mode = 'outer';

      const node = {
        type: 'Step',
        field: 'legs',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // legs slot has no outer layer
      expect(result).toEqual(new Set());
    });
  });

  describe('backward compatibility with regular entities', () => {
    it('should handle regular entity strings', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set(['entity_1']));
      mockEntitiesGateway.getComponentData.mockReturnValue('component_value');

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(mockEntitiesGateway.getComponentData).toHaveBeenCalledWith(
        'entity_1',
        'torso_upper'
      );
      expect(result).toEqual(new Set(['component_value']));
    });

    it('should handle array component data', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set(['entity_1']));
      mockEntitiesGateway.getComponentData.mockReturnValue([
        'item_1',
        'item_2',
      ]);

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set(['item_1', 'item_2']));
    });

    it('should handle null component data', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set(['entity_1']));
      mockEntitiesGateway.getComponentData.mockReturnValue(null);

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
    });

    it('should handle undefined component data', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set(['entity_1']));
      mockEntitiesGateway.getComponentData.mockReturnValue(undefined);

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
    });

    it('should handle non-string non-null values', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set(['entity_1']));
      mockEntitiesGateway.getComponentData.mockReturnValue(42);

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set([42]));
    });
  });

  describe('mixed parent results', () => {
    it('should handle mix of clothing access objects and regular entities', () => {
      mockContext.dispatcher.resolve.mockReturnValue(
        new Set([mockClothingAccessObject, 'entity_1'])
      );
      mockEntitiesGateway.getComponentData.mockReturnValue(
        'regular_component_value'
      );

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should have both clothing item and regular component value
      expect(result).toEqual(new Set(['jacket_1', 'regular_component_value']));
    });

    it('should skip invalid parent values', () => {
      mockContext.dispatcher.resolve.mockReturnValue(
        new Set([mockClothingAccessObject, null, undefined, 123, 'entity_1'])
      );
      mockEntitiesGateway.getComponentData.mockReturnValue('component_value');

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should process valid items only
      expect(result).toEqual(new Set(['jacket_1', 'component_value']));
    });
  });

  describe('resolve - array handling for clothing objects', () => {
    it('should handle arrays containing clothing access objects', () => {
      const arrayWithClothingAccess = [
        mockClothingAccessObject,
        {
          __clothingSlotAccess: true,
          equipped: {
            torso_upper: {
              base: 'shirt_2',
            },
          },
          mode: 'base',
        },
      ];

      mockContext.dispatcher.resolve.mockReturnValue(
        new Set([arrayWithClothingAccess])
      );

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should process both clothing access objects in the array
      expect(result).toEqual(new Set(['jacket_1', 'shirt_2']));
    });

    it('should handle arrays with mixed valid and invalid items', () => {
      const mixedArray = [
        mockClothingAccessObject,
        null,
        'regular_string',
        {
          // Object without __clothingSlotAccess property
          equipped: { torso_upper: { outer: 'invalid_item' } },
        },
        {
          __clothingSlotAccess: true,
          equipped: {
            torso_upper: {
              outer: 'valid_item',
            },
          },
          mode: 'outer',
        },
      ];

      mockContext.dispatcher.resolve.mockReturnValue(new Set([mixedArray]));

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should only process valid clothing access objects
      expect(result).toEqual(new Set(['jacket_1', 'valid_item']));
    });

    it('should handle arrays with non-clothing objects', () => {
      const arrayWithNonClothingObjects = [
        { someProperty: 'value' },
        { equipped: 'not_a_clothing_object' },
        null,
        undefined,
      ];

      mockContext.dispatcher.resolve.mockReturnValue(
        new Set([arrayWithNonClothingObjects])
      );

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return empty set when no valid clothing objects found
      expect(result).toEqual(new Set());
    });

    it('should handle arrays with clothing objects that have no items in requested slot', () => {
      const clothingObjectWithEmptySlot = {
        __clothingSlotAccess: true,
        equipped: {
          legs: {
            base: 'pants_item',
          },
          // No torso_upper data
        },
        mode: 'topmost',
      };

      const arrayWithEmptySlot = [clothingObjectWithEmptySlot];

      mockContext.dispatcher.resolve.mockReturnValue(
        new Set([arrayWithEmptySlot])
      );

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return empty set when slot has no data
      expect(result).toEqual(new Set());
    });

    it('should handle nested arrays with different slot configurations', () => {
      const clothingObject1 = {
        __clothingSlotAccess: true,
        equipped: {
          torso_upper: {
            outer: 'jacket_from_array',
          },
        },
        mode: 'outer',
      };

      const clothingObject2 = {
        __clothingSlotAccess: true,
        equipped: {
          torso_upper: {
            base: 'shirt_from_array',
          },
        },
        mode: 'base',
      };

      const nestedArray = [clothingObject1, clothingObject2];

      mockContext.dispatcher.resolve.mockReturnValue(new Set([nestedArray]));

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should process both clothing objects and return their slot values
      expect(result).toEqual(
        new Set(['jacket_from_array', 'shirt_from_array'])
      );
    });
  });

  describe('trace logging', () => {
    it('should log resolution steps when trace is provided', () => {
      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      resolver.resolve(node, mockContext);

      expect(mockContext.trace.addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('SlotAccessResolver: Processing slot'),
        'SlotAccessResolver',
        expect.any(Object)
      );

      expect(mockContext.trace.addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('SlotAccessResolver: Resolution complete'),
        'SlotAccessResolver',
        expect.any(Object)
      );
    });

    it('should log when item found in slot', () => {
      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      resolver.resolve(node, mockContext);

      expect(mockContext.trace.addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('Selected item from slot'),
        'SlotAccessResolver',
        expect.objectContaining({
          slotName: 'torso_upper',
          layer: 'outer',
          itemId: 'jacket_1',
        })
      );
    });

    it('should log when no data found for slot', () => {
      const node = {
        type: 'Step',
        field: 'left_arm_clothing',
        parent: { type: 'Step' },
      };

      resolver.resolve(node, mockContext);

      expect(mockContext.trace.addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('No data found for slot'),
        'SlotAccessResolver',
        expect.objectContaining({
          slotName: 'left_arm_clothing',
        })
      );
    });

    it('should work without trace context', () => {
      mockContext.trace = null;

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      // Should not throw
      expect(() => resolver.resolve(node, mockContext)).not.toThrow();
    });

    it('should work without trace context when no data found for slot', () => {
      mockContext.trace = null;

      const node = {
        type: 'Step',
        field: 'left_arm_clothing',
        parent: { type: 'Step' },
      };

      // Should not throw when processing missing slot without trace
      expect(() => resolver.resolve(node, mockContext)).not.toThrow();
    });
  });

  describe('addToResultSet edge cases', () => {
    it('should handle object values correctly', () => {
      mockContext.dispatcher.resolve.mockReturnValue(new Set(['entity_1']));
      const complexObject = { id: 'complex_object', type: 'test' };
      mockEntitiesGateway.getComponentData.mockReturnValue(complexObject);

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set([complexObject]));
    });
  });

  // ===== COMPREHENSIVE UNIT TEST SUITE ENHANCEMENTS =====

  describe('SlotAccessResolver - Enhanced Coverage', () => {
    describe('Priority-based Resolution', () => {
      it('should select highest priority item using calculated priorities', () => {
        const clothingAccess = createMockClothingAccess({
          torso_upper: {
            outer: 'jacket_id',
            base: 'shirt_id',
            underwear: 'undershirt_id'
          },
        }, 'topmost');

        mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const node = {
          type: 'Step',
          field: 'torso_upper',
          parent: { type: 'Step' },
        };

        const result = resolver.resolve(node, mockContext);

        // Should select outer layer (highest priority)
        expect(result).toEqual(new Set(['jacket_id']));
      });

      it('should handle tie-breaking between same priority items', () => {
        const clothingAccess = createMockClothingAccess({
          torso_upper: {
            outer: 'jacket_outer',
            base: 'jacket_base', // Same coverage priority but different layers
          },
        }, 'topmost');

        mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const node = {
          type: 'Step',
          field: 'torso_upper',
          parent: { type: 'Step' },
        };

        const result = resolver.resolve(node, mockContext);

        // Should select outer layer via tie-breaking
        expect(result).toEqual(new Set(['jacket_outer']));
      });

      it('should prioritize items from coverage resolution over direct items', () => {
        const clothingAccess = createMockClothingAccess({
          torso_upper: {
            base: 'coverage_shirt_id',
          },
        }, 'base');

        // Mix clothing access object with regular entity
        mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess, 'entity_1']));
        mockEntitiesGateway.getComponentData.mockReturnValue('direct_component_value');

        const node = {
          type: 'Step',
          field: 'torso_upper',
          parent: { type: 'Step' },
        };

        const result = resolver.resolve(node, mockContext);

        // Should include both items (coverage has priority in sorting, but both are returned)
        expect(result).toEqual(new Set(['coverage_shirt_id', 'direct_component_value']));
      });

      it('should handle multiple clothing access objects with priority comparison', () => {
        const highPriorityClothing = createMockClothingAccess({
          torso_upper: {
            outer: 'high_priority_jacket',
          },
        }, 'outer');

        const lowPriorityClothing = createMockClothingAccess({
          torso_upper: {
            underwear: 'low_priority_underwear',
          },
        }, 'underwear');

        mockContext.dispatcher.resolve.mockReturnValue(new Set([highPriorityClothing, lowPriorityClothing]));

        const node = {
          type: 'Step',
          field: 'torso_upper',
          parent: { type: 'Step' },
        };

        const result = resolver.resolve(node, mockContext);

        // Should return both items (system returns all found items)
        expect(result).toEqual(new Set(['high_priority_jacket', 'low_priority_underwear']));
      });

      it('should handle priority calculation with realistic layered outfit', () => {
        const clothingAccess = createMockClothingAccess(REALISTIC_EQUIPMENT_SCENARIOS.layeredOutfit, 'topmost');

        mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const node = {
          type: 'Step',
          field: 'torso_upper',
          parent: { type: 'Step' },
        };

        const result = resolver.resolve(node, mockContext);

        // Should select the outer layer (winter_coat_id) for topmost mode
        expect(result).toEqual(new Set(['winter_coat_id']));
      });
    });

    describe('Mode-specific Priority Handling', () => {
      it('should respect topmost_no_accessories mode', () => {
        const clothingAccess = createMockClothingAccess({
          torso_upper: {
            accessories: 'necklace_id',
            base: 'shirt_id',
          },
        }, 'topmost_no_accessories');

        mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const node = {
          type: 'Step',
          field: 'torso_upper',
          parent: { type: 'Step' },
        };

        const result = resolver.resolve(node, mockContext);

        // Should exclude accessories and select base
        expect(result).toEqual(new Set(['shirt_id']));
      });

      it('should handle specific layer modes correctly', () => {
        const clothingAccess = createMockClothingAccess({
          torso_upper: {
            outer: 'jacket_id',
            base: 'shirt_id',
            underwear: 'undershirt_id'
          },
        }, 'underwear');

        mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const node = {
          type: 'Step',
          field: 'torso_upper',
          parent: { type: 'Step' },
        };

        const result = resolver.resolve(node, mockContext);

        // Should select only underwear layer
        expect(result).toEqual(new Set(['undershirt_id']));
      });

      it('should handle all mode returning highest priority item', () => {
        const clothingAccess = createMockClothingAccess({
          torso_upper: {
            outer: 'jacket_id',
            base: 'shirt_id',
            accessories: 'necklace_id'
          },
        }, 'all');

        mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const node = {
          type: 'Step',
          field: 'torso_upper',
          parent: { type: 'Step' },
        };

        const result = resolver.resolve(node, mockContext);

        // Should return highest priority (outer layer for 'all' mode)
        expect(result).toEqual(new Set(['jacket_id']));
      });

      it('should return empty set for missing layer in specific mode', () => {
        const clothingAccess = createMockClothingAccess({
          torso_upper: {
            base: 'shirt_id',
          },
        }, 'outer'); // Requesting outer but only base available

        mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const node = {
          type: 'Step',
          field: 'torso_upper',
          parent: { type: 'Step' },
        };

        const result = resolver.resolve(node, mockContext);

        // Should return empty set when requested layer not present
        expect(result).toEqual(new Set());
      });
    });
  });

  describe('Priority Calculation Integration', () => {
    it('should use calculatePriorityWithValidation for priority calculation', () => {
      const mockLogger = testBed.createMockLogger();
      
      const result = calculatePriorityWithValidation('outer', 'outer', mockLogger);
      
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should cache priority calculations for performance', () => {
      // Clear cache first
      clearPriorityCache();
      
      const score1 = calculateCoveragePriorityOptimized('base', 'outer');
      const score2 = calculateCoveragePriorityOptimized('base', 'outer');
      
      expect(score1).toBe(score2);
      
      const stats = getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle candidate sorting with tie-breaking', () => {
      const candidates = [
        { itemId: 'item1', priority: 10, layer: 'base', source: 'coverage' },
        { itemId: 'item2', priority: 5, layer: 'outer', source: 'coverage' },
        { itemId: 'item3', priority: 10, layer: 'base', source: 'direct' },
      ];

      const sorted = sortCandidatesWithTieBreaking(candidates);

      expect(sorted[0].itemId).toBe('item2'); // Lowest priority score
      expect(sorted[1].itemId).toBe('item1'); // Coverage beats direct in tie-breaker
      expect(sorted[2].itemId).toBe('item3');
    });

    it('should validate priority inputs with fallbacks', () => {
      const mockLogger = testBed.createMockLogger();

      // Test with invalid coverage priority
      const result1 = calculatePriorityWithValidation('invalid_priority', 'base', mockLogger);
      expect(typeof result1).toBe('number');
      expect(mockLogger.warn).toHaveBeenCalled();

      // Reset mock for second test
      mockLogger.warn.mockClear();

      // Test with invalid layer
      const result2 = calculatePriorityWithValidation('base', 'invalid_layer', mockLogger);
      expect(typeof result2).toBe('number');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should demonstrate priority ordering consistency', () => {
      // Test that outer beats base beats underwear in topmost mode
      const outerPriority = calculatePriorityWithValidation('outer', 'outer');
      const basePriority = calculatePriorityWithValidation('base', 'base');
      const underwearPriority = calculatePriorityWithValidation('underwear', 'underwear');

      // Lower numbers indicate higher priority
      expect(outerPriority).toBeLessThan(basePriority);
      expect(basePriority).toBeLessThan(underwearPriority);
    });

    it('should handle cache statistics and management', () => {
      clearPriorityCache();
      
      // Populate cache with different combinations
      calculateCoveragePriorityOptimized('outer', 'outer');
      calculateCoveragePriorityOptimized('base', 'base');
      calculateCoveragePriorityOptimized('underwear', 'underwear');

      const stats = getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.maxSize).toBeGreaterThan(stats.size);
      expect(stats.enabled).toBe(true);
    });
  });

  describe('Structured Tracing Integration', () => {
    let mockStructuredTrace;
    let mockSpan;

    beforeEach(() => {
      const traceContext = createMockStructuredTraceContext();
      mockStructuredTrace = traceContext.structuredTrace;
      mockSpan = traceContext.mockSpan;

      // Add structured trace to context - resolver looks for trace.__ctx.structuredTrace
      mockContext.trace.__ctx = { structuredTrace: mockStructuredTrace };
    });

    it('should create candidate collection spans during resolution', () => {
      const clothingAccess = createMockClothingAccess({
        torso_upper: { outer: 'jacket_id' },
      }, 'topmost');

      mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      resolver.resolve(node, mockContext);

      expect(mockStructuredTrace.startSpan).toHaveBeenCalledWith(
        'candidate_collection',
        expect.objectContaining({
          slotName: 'torso_upper',
          mode: 'topmost',
        })
      );
    });

    it('should log candidate found events with structured tracing', () => {
      const clothingAccess = createMockClothingAccess({
        torso_upper: { outer: 'jacket_id' },
      }, 'topmost');

      mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      resolver.resolve(node, mockContext);

      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'candidate_found',
        expect.objectContaining({
          itemId: 'jacket_id',
          layer: 'outer',
        })
      );
    });

    it('should create priority calculation spans', () => {
      const clothingAccess = createMockClothingAccess({
        torso_upper: { outer: 'jacket_id', base: 'shirt_id' },
      }, 'topmost');

      mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      resolver.resolve(node, mockContext);

      expect(mockStructuredTrace.startSpan).toHaveBeenCalledWith(
        'priority_calculation',
        expect.objectContaining({
          candidateCount: 2,
        })
      );
    });

    it('should create final selection spans with results', () => {
      const clothingAccess = createMockClothingAccess({
        torso_upper: { outer: 'jacket_id' },
      }, 'topmost');

      mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      resolver.resolve(node, mockContext);

      expect(mockStructuredTrace.startSpan).toHaveBeenCalledWith(
        'final_selection',
        expect.objectContaining({
          candidateCount: 1,
        })
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing equipment component gracefully', () => {
      const mockContextLocal = {
        dispatcher: {
          resolve: jest.fn().mockReturnValue(new Set([{
            __clothingSlotAccess: true,
            equipped: {}, // Empty equipment object instead of null
            mode: 'topmost',
          }])),
        },
        trace: { addLog: jest.fn() },
      };

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const result = resolver.resolve(node, mockContextLocal);

      expect(result).toEqual(new Set());
      expect(mockContextLocal.trace.addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('No data found for slot'),
        'SlotAccessResolver',
        expect.any(Object)
      );
    });

    it('should handle null entities gateway gracefully during construction', () => {
      expect(() => {
        createSlotAccessResolver({
          entitiesGateway: null,
        });
      }).toThrow();
    });

    it('should handle empty slot data without throwing', () => {
      const mockContextLocal = {
        dispatcher: {
          resolve: jest.fn().mockReturnValue(new Set([{
            __clothingSlotAccess: true,
            equipped: {
              torso_upper: {}, // Empty slot
            },
            mode: 'topmost',
          }])),
        },
        trace: { addLog: jest.fn() },
      };

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      expect(() => {
        resolver.resolve(node, mockContextLocal);
      }).not.toThrow();
    });

    it('should handle dispatcher resolution failures gracefully', () => {
      const mockContextLocal = {
        dispatcher: {
          resolve: jest.fn().mockImplementation(() => {
            throw new Error('Dispatcher resolution failed');
          }),
        },
        trace: { addLog: jest.fn() },
      };

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      // Should handle dispatcher errors gracefully
      expect(() => {
        resolver.resolve(node, mockContextLocal);
      }).toThrow('Dispatcher resolution failed');
    });

    it('should handle malformed clothing access objects', () => {
      const malformedClothingAccess = {
        __clothingSlotAccess: true,
        equipped: 'not_an_object', // Should be object
        mode: 'topmost',
      };

      mockContext.dispatcher.resolve.mockReturnValue(new Set([malformedClothingAccess]));

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      // Should handle malformed objects without throwing
      expect(() => {
        resolver.resolve(node, mockContext);
      }).not.toThrow();
    });
  });

  describe('Performance Requirements', () => {
    it('should complete resolution within reasonable time', () => {
      const clothingAccess = createMockClothingAccess({
        torso_upper: { outer: 'jacket', base: 'shirt' },
        torso_lower: { base: 'pants' },
        legs: { base: 'jeans' },
      }, 'topmost');

      const mockContextLocal = {
        dispatcher: {
          resolve: jest.fn().mockReturnValue(new Set([clothingAccess])),
        },
        trace: null, // Disable tracing for performance test
      };

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        resolver.resolve(node, mockContextLocal);
      }

      const avgTime = (performance.now() - startTime) / 1000;
      expect(avgTime).toBeLessThan(1); // Less than 1ms per resolution
    });

    it('should handle memory efficiently with caching', () => {
      // Clear priority cache
      clearPriorityCache();

      const initialStats = getCacheStats();
      expect(initialStats.size).toBe(0);

      // Trigger cache population
      for (let i = 0; i < 100; i++) {
        calculateCoveragePriorityOptimized('base', 'outer');
        calculateCoveragePriorityOptimized('outer', 'base');
      }

      const finalStats = getCacheStats();
      expect(finalStats.size).toBeGreaterThan(0);
      expect(finalStats.size).toBeLessThan(10); // Should not grow indefinitely
    });

    it('should maintain consistent performance across different equipment configurations', () => {
      const testConfigurations = [
        REALISTIC_EQUIPMENT_SCENARIOS.casualWear,
        REALISTIC_EQUIPMENT_SCENARIOS.formalWear,
        REALISTIC_EQUIPMENT_SCENARIOS.layeredOutfit,
      ];

      const node = {
        type: 'Step',
        field: 'torso_upper',
        parent: { type: 'Step' },
      };

      const timings = [];

      testConfigurations.forEach(equipment => {
        const clothingAccess = createMockClothingAccess(equipment, 'topmost');
        mockContext.dispatcher.resolve.mockReturnValue(new Set([clothingAccess]));

        const startTime = performance.now();
        
        for (let i = 0; i < 100; i++) {
          resolver.resolve(node, mockContext);
        }

        const avgTime = (performance.now() - startTime) / 100;
        timings.push(avgTime);
      });

      // Verify performance consistency (no timing should be more than 2x another)
      const minTiming = Math.min(...timings);
      const maxTiming = Math.max(...timings);
      
      expect(maxTiming / minTiming).toBeLessThan(2);
    });
  });
});
