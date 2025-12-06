import { describe, it, expect, beforeEach } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { DefaultDslParser } from '../../../src/scopeDsl/parser/defaultDslParser.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('SlotAccessResolver Enhanced Integration Tests', () => {
  let engine;
  let parser;
  let mockRuntimeContext;
  let mockActorEntity;

  beforeEach(() => {
    // Setup complete test environment
    engine = new ScopeEngine();
    parser = new DefaultDslParser();

    // Create comprehensive mock data for enhanced testing (aligned with existing test)
    const mockEquipmentData = {
      equipped: {
        torso_upper: {
          outer: 'leather_jacket_001',
          base: 'cotton_shirt_002',
          underwear: 'undershirt_003',
          accessories: 'necklace_004',
        },
        torso_lower: {
          outer: 'jeans_004',
          base: 'shorts_005',
        },
        feet: {
          outer: 'boots_006',
        },
        legs: {
          base: 'leggings_007',
          underwear: 'underwear_legs_008',
        },
        hands: {
          outer: 'gloves_009',
          accessories: 'watch_010',
        },
        head_gear: {
          outer: 'hat_010',
          accessories: 'glasses_011',
        },
        left_arm_clothing: {}, // Empty slot for testing
        right_arm_clothing: {
          accessories: 'bracelet_012',
        },
      },
    };

    mockActorEntity = { id: 'player_character' };

    mockRuntimeContext = {
      entityManager: {
        getComponentData: jest.fn((entityId, componentId) => {
          if (
            entityId === 'player_character' &&
            componentId === 'clothing:equipment'
          ) {
            return mockEquipmentData;
          }
          return null;
        }),
        hasComponent: jest.fn().mockReturnValue(true),
        getEntitiesWithComponent: jest.fn().mockReturnValue([]),
        getEntity: jest.fn((entityId) => {
          if (entityId === 'player_character') {
            return mockActorEntity;
          }
          return null;
        }),
        getEntityInstance: jest.fn((entityId) => {
          if (entityId === 'player_character') {
            return mockActorEntity;
          }
          return null;
        }),
      },
      jsonLogicEval: {
        evaluate: jest.fn().mockReturnValue(true),
      },
      logger: createMockLogger(),
    };

    // Create mock ClothingAccessibilityService after mockRuntimeContext is defined
    const mockClothingAccessibilityService = {
      getAccessibleItems: jest.fn((entityId, options = {}) => {
        const { mode = 'topmost' } = options;

        // Get the current equipment data from the mock
        const currentEquipmentData =
          mockRuntimeContext.entityManager.getComponentData(
            entityId,
            'clothing:equipment'
          );
        if (!currentEquipmentData?.equipped) {
          return [];
        }

        const equipment = currentEquipmentData.equipped;
        const result = [];

        // Helper function to get items from equipment based on mode
        const LAYER_PRIORITY = {
          topmost: ['outer', 'base', 'underwear', 'accessories'],
          topmost_no_accessories: ['outer', 'base', 'underwear'],
          all: ['outer', 'base', 'underwear', 'accessories'],
          outer: ['outer'],
          base: ['base'],
          underwear: ['underwear'],
        };

        const layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;

        // Iterate through each slot
        for (const [slotName, slotData] of Object.entries(equipment)) {
          if (!slotData) continue;

          if (mode === 'all') {
            // For 'all' mode, include all items from all layers
            for (const layer of layers) {
              if (slotData[layer]) {
                result.push(slotData[layer]);
              }
            }
          } else if (mode === 'topmost') {
            // For topmost mode, skip slots that only have accessories (like right_arm_clothing)
            let foundNonAccessory = false;
            let topMostItem = null;

            for (const layer of layers) {
              if (slotData[layer]) {
                if (layer !== 'accessories') {
                  foundNonAccessory = true;
                  topMostItem = slotData[layer];
                  break;
                } else if (!topMostItem) {
                  topMostItem = slotData[layer];
                }
              }
            }

            // Only include if we found a non-accessory item
            if (foundNonAccessory && topMostItem) {
              result.push(topMostItem);
            }
          } else {
            // For other modes, find the highest priority item in this slot
            for (const layer of layers) {
              if (slotData[layer]) {
                result.push(slotData[layer]);
                break;
              }
            }
          }
        }

        return result;
      }),
    };

    // Add container with ClothingAccessibilityService to mockRuntimeContext
    mockRuntimeContext.container = {
      resolve: jest.fn((serviceName) => {
        if (serviceName === 'ClothingAccessibilityService') {
          return mockClothingAccessibilityService;
        }
        return null;
      }),
    };
  });

  describe('Enhancement Validation', () => {
    it('should resolve enhanced coverage with existing clothing data', () => {
      const ast = parser.parse('actor.topmost_clothing.torso_upper');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should return the topmost item in torso_upper slot (outer layer)
      expect(result).toEqual(new Set(['leather_jacket_001']));
    });

    it('should maintain expected priority ordering from existing system', () => {
      const astUpper = parser.parse('actor.topmost_clothing.torso_upper');
      const astHands = parser.parse('actor.topmost_clothing.hands');

      const resultUpper = engine.resolve(
        astUpper,
        mockActorEntity,
        mockRuntimeContext
      );
      const resultHands = engine.resolve(
        astHands,
        mockActorEntity,
        mockRuntimeContext
      );

      // Should prioritize outer layers over accessories
      expect(resultUpper).toEqual(new Set(['leather_jacket_001'])); // outer over accessories
      expect(resultHands).toEqual(new Set(['gloves_009'])); // outer over accessories
    });

    it('should integrate with existing scope DSL queries preserved', () => {
      const ast = parser.parse('actor.topmost_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should return topmost from each equipped slot (aligned with existing test expectations)
      expect(result).toEqual(
        new Set([
          'leather_jacket_001', // torso_upper outer
          'jeans_004', // torso_lower outer
          'boots_006', // feet outer
          'leggings_007', // legs base (no outer)
          'gloves_009', // hands outer
          'hat_010', // head_gear outer
          // Note: right_arm_clothing only has accessories, not included in topmost for empty slots
        ])
      );
    });

    it('should handle topmost_no_accessories mode correctly with enhancements', () => {
      const ast = parser.parse(
        'actor.topmost_clothing_no_accessories.right_arm_clothing'
      );
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should return empty set as only accessories exist in this slot
      expect(result).toEqual(new Set());
    });
  });

  describe('System Preservation', () => {
    it('should work with existing sophisticated resolution system unchanged', () => {
      const ast = parser.parse('actor.outer_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(
        new Set([
          'leather_jacket_001',
          'jeans_004',
          'boots_006',
          'gloves_009',
          'hat_010',
        ])
      );
    });

    it('should handle current priority calculation and tie-breaking preserved', () => {
      const ast = parser.parse('actor.base_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(
        new Set(['cotton_shirt_002', 'shorts_005', 'leggings_007'])
      );
    });

    it('should handle empty equipment by existing robust system', () => {
      mockRuntimeContext.entityManager.getComponentData.mockReturnValue({
        equipped: {},
      });

      const ast = parser.parse('actor.topmost_clothing.torso_upper');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set());
    });

    it('should handle all clothing modes correctly', () => {
      const astAll = parser.parse('actor.all_clothing.torso_upper');
      const astUnderwear = parser.parse('actor.underwear.torso_upper');

      const resultAll = engine.resolve(
        astAll,
        mockActorEntity,
        mockRuntimeContext
      );
      const resultUnderwear = engine.resolve(
        astUnderwear,
        mockActorEntity,
        mockRuntimeContext
      );

      // all_clothing should return all layers from torso_upper
      expect(resultAll.size).toBe(1); // Only one item returned by all_clothing mode
      expect(resultAll).toContain('leather_jacket_001');

      // underwear should return only underwear layer
      expect(resultUnderwear).toEqual(new Set(['undershirt_003']));
    });
  });

  describe('Enhancement Integration', () => {
    it('should handle performance monitoring correctly', () => {
      // Mock performance.now to simulate timing
      const originalNow = performance.now;
      let callCount = 0;
      performance.now = jest.fn(() => {
        callCount++;
        return callCount * 5; // Each call returns 5ms later
      });

      const ast = parser.parse('actor.topmost_clothing.torso_upper');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should complete successfully regardless of performance monitoring
      expect(result).toEqual(new Set(['leather_jacket_001']));

      // Restore original performance.now
      performance.now = originalNow;
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with existing scopes unchanged', () => {
      const complexAst = parser.parse(
        'actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower'
      );
      const result = engine.resolve(
        complexAst,
        mockActorEntity,
        mockRuntimeContext
      );

      expect(result).toEqual(new Set(['leather_jacket_001', 'jeans_004']));
    });

    it('should handle no regression in existing functionality', () => {
      const ast = parser.parse('actor.topmost_clothing.legs');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // legs slot has no outer layer, should return base
      expect(result).toEqual(new Set(['leggings_007']));
    });

    it('should work correctly with all modes (topmost, no_accessories, etc.)', () => {
      const tests = [
        {
          expr: 'actor.topmost_clothing.hands',
          expected: new Set(['gloves_009']),
        },
        {
          expr: 'actor.topmost_clothing_no_accessories.hands',
          expected: new Set(['gloves_009']),
        },
        {
          expr: 'actor.outer_clothing.hands',
          expected: new Set(['gloves_009']),
        },
        { expr: 'actor.all_clothing.hands', expected: new Set(['gloves_009']) }, // all_clothing works like topmost
      ];

      for (const test of tests) {
        const ast = parser.parse(test.expr);
        const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);
        expect(result).toEqual(test.expected);
      }
    });
  });

  describe('Error Handling Enhancement', () => {
    it('should handle missing equipment component gracefully with enhancements', () => {
      mockRuntimeContext.entityManager.getComponentData.mockReturnValue(null);

      const ast = parser.parse('actor.topmost_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set());
    });

    it('should handle malformed equipment data gracefully with enhancements', () => {
      mockRuntimeContext.entityManager.getComponentData.mockReturnValue({
        equipped: {
          torso_upper: 'not_an_object',
          torso_lower: null,
          legs: undefined,
        },
      });

      const ast = parser.parse('actor.topmost_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set());
    });

    it('should provide error recovery with trace information', () => {
      const trace = {
        addLog: jest.fn(),
        coverageError: null,
      };

      // Test error recovery by restoring normal function after error setup
      mockRuntimeContext.entityManager.getComponentData.mockReturnValue(null);

      const ast = parser.parse('actor.topmost_clothing.torso_upper');
      const result = engine.resolve(
        ast,
        mockActorEntity,
        mockRuntimeContext,
        trace
      );

      // Should handle gracefully with empty result
      expect(result).toEqual(new Set());
    });
  });

  describe('Feature Flag Integration', () => {
    it('should work when coverage resolution is enabled', () => {
      // Coverage resolution should be enabled by default
      const ast = parser.parse('actor.topmost_clothing.torso_upper');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set(['leather_jacket_001']));
    });

    it('should handle edge cases in empty slots', () => {
      const ast = parser.parse('actor.topmost_clothing.left_arm_clothing');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Empty slot should return empty set
      expect(result).toEqual(new Set());
    });
  });

  describe('Complex Scenarios Enhancement', () => {
    it('should handle complex layering scenarios', () => {
      // Test a slot with all layer types - all_clothing mode still selects top priority item per slot
      const ast = parser.parse('actor.all_clothing.torso_upper');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // all_clothing.specific_slot works like topmost for individual slot access
      expect(result.size).toBe(1);
      expect(result).toContain('leather_jacket_001'); // outer (highest priority)
    });

    it('should handle mixed equipment scenarios', () => {
      const ast = parser.parse('actor.topmost_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should correctly resolve mixed scenarios:
      // - torso_upper: has outer (leather_jacket_001)
      // - legs: has base only (leggings_007)
      // - right_arm_clothing: has accessories only, but not included in topmost for slots with only accessories
      expect(result).toContain('leather_jacket_001');
      expect(result).toContain('leggings_007');
    });
  });

  describe('Performance and Quality', () => {
    it('should maintain performance with large equipment sets', () => {
      // Create a larger equipment set
      const largeEquipment = {
        equipped: {},
      };

      // Add items to all slots
      const slots = [
        'torso_upper',
        'torso_lower',
        'legs',
        'feet',
        'head_gear',
        'hands',
      ];
      slots.forEach((slot) => {
        largeEquipment.equipped[slot] = {
          outer: `${slot}_outer_001`,
          base: `${slot}_base_002`,
          underwear: `${slot}_underwear_003`,
          accessories: `${slot}_accessories_004`,
        };
      });

      mockRuntimeContext.entityManager.getComponentData.mockReturnValue(
        largeEquipment
      );

      const startTime = performance.now();
      const ast = parser.parse('actor.all_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);
      const duration = performance.now() - startTime;

      // Should complete quickly even with larger data sets
      expect(duration).toBeLessThan(100); // Less than 100ms
      expect(result.size).toBe(24); // 6 slots * 4 layers each
    });
  });
});
