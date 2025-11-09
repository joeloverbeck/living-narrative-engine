import { describe, it, expect, beforeEach } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('Clothing Resolver Chain Integration', () => {
  let engine;
  let parser;
  let mockRuntimeContext;
  let mockActorEntity;

  beforeEach(() => {
    // Setup complete test environment
    engine = new ScopeEngine();
    parser = new DefaultDslParser();

    // Create comprehensive mock data
    const mockEquipmentData = {
      equipped: {
        torso_upper: {
          outer: 'leather_jacket_001',
          base: 'cotton_shirt_002',
          underwear: 'undershirt_003',
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
        },
        head_gear: {
          outer: 'hat_010',
        },
      },
    };

    mockActorEntity = { id: 'player_character' };

    // Mock ClothingAccessibilityService
    const mockClothingAccessibilityService = {
      getAccessibleItems: jest.fn((entityId, options = {}) => {
        const { mode = 'topmost' } = options;
        
        // Get equipment data from current mock state (dynamic)
        const equipmentData = mockRuntimeContext.entityManager.getComponentData(entityId, 'clothing:equipment');
        if (!equipmentData?.equipped) {
          return []; // Return empty array if no equipment data
        }
        
        const equipment = equipmentData.equipped;
        const items = [];
        
        // Simulate service behavior based on mode
        for (const [slotName, slotData] of Object.entries(equipment)) {
          if (!slotData || typeof slotData !== 'object') {
            continue; // Skip malformed slot data
          }
          
          if (mode === 'all') {
            // Return all items from all layers
            Object.values(slotData).forEach(item => {
              if (item && typeof item === 'string') items.push(item);
            });
          } else if (mode === 'topmost') {
            // Return topmost (outer, then base, then underwear)
            const priorities = ['outer', 'base', 'underwear'];
            for (const layer of priorities) {
              if (slotData[layer] && typeof slotData[layer] === 'string') {
                items.push(slotData[layer]);
                break; // Only topmost per slot
              }
            }
          } else if (mode === 'outer') {
            if (slotData.outer && typeof slotData.outer === 'string') items.push(slotData.outer);
          } else if (mode === 'base') {
            if (slotData.base && typeof slotData.base === 'string') items.push(slotData.base);
          } else if (mode === 'underwear') {
            if (slotData.underwear && typeof slotData.underwear === 'string') items.push(slotData.underwear);
          }
        }
        
        return items;
      }),
    };

    // Mock container for service resolution
    const mockContainer = {
      resolve: jest.fn((serviceName) => {
        if (serviceName === 'ClothingAccessibilityService') {
          return mockClothingAccessibilityService;
        }
        return null;
      }),
    };

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
          // Return appropriate entity based on ID
          if (entityId === 'player_character') {
            return mockActorEntity;
          }
          return null; // Default for unknown entities
        }),
        getEntityInstance: jest.fn((entityId) => {
          // Default behavior - will be overridden in specific tests that need it
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
      container: mockContainer,
    };
  });

  describe('Complete resolution chain', () => {
    it('should resolve actor.topmost_clothing.torso_upper from parse to result', () => {
      // Parse the scope expression
      const ast = parser.parse('actor.topmost_clothing.torso_upper');

      // Resolve through engine
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should return the topmost item in torso_upper slot (outer layer)
      expect(result).toEqual(new Set(['leather_jacket_001']));
    });

    it('should resolve actor.topmost_clothing[] to get all topmost items', () => {
      const ast = parser.parse('actor.topmost_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should return topmost from each equipped slot
      expect(result).toEqual(
        new Set([
          'leather_jacket_001',
          'jeans_004',
          'boots_006',
          'leggings_007',
          'gloves_009',
          'hat_010',
        ])
      );
    });

    it('should handle multiple slot access in sequence', () => {
      const astUpper = parser.parse('actor.topmost_clothing.torso_upper');
      const astLower = parser.parse('actor.topmost_clothing.torso_lower');
      const astFeet = parser.parse('actor.topmost_clothing.feet');

      const resultUpper = engine.resolve(
        astUpper,
        mockActorEntity,
        mockRuntimeContext
      );
      const resultLower = engine.resolve(
        astLower,
        mockActorEntity,
        mockRuntimeContext
      );
      const resultFeet = engine.resolve(
        astFeet,
        mockActorEntity,
        mockRuntimeContext
      );

      expect(resultUpper).toEqual(new Set(['leather_jacket_001']));
      expect(resultLower).toEqual(new Set(['jeans_004']));
      expect(resultFeet).toEqual(new Set(['boots_006']));
    });

    it('should handle empty slots gracefully', () => {
      const ast = parser.parse('actor.topmost_clothing.left_arm_clothing');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set());
    });
  });

  describe('Layer-specific resolution', () => {
    it('should resolve outer_clothing[] correctly', () => {
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

    it('should resolve base_clothing[] correctly', () => {
      const ast = parser.parse('actor.base_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(
        new Set(['cotton_shirt_002', 'shorts_005', 'leggings_007'])
      );
    });

    it('should resolve underwear[] correctly', () => {
      const ast = parser.parse('actor.underwear[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set(['undershirt_003', 'underwear_legs_008']));
    });

    it('should resolve all_clothing[] correctly', () => {
      const ast = parser.parse('actor.all_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should return all items from all layers
      expect(result.size).toBe(10);
      expect(result).toContain('leather_jacket_001');
      expect(result).toContain('cotton_shirt_002');
      expect(result).toContain('undershirt_003');
      expect(result).toContain('jeans_004');
      expect(result).toContain('shorts_005');
      expect(result).toContain('boots_006');
      expect(result).toContain('leggings_007');
      expect(result).toContain('underwear_legs_008');
      expect(result).toContain('gloves_009');
      expect(result).toContain('hat_010');
    });
  });

  describe('Layer priority handling', () => {
    it('should return base layer when no outer layer exists', () => {
      const ast = parser.parse('actor.topmost_clothing.legs');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // legs slot has no outer layer, should return base
      expect(result).toEqual(new Set(['leggings_007']));
    });

    it('should handle base_clothing slot access correctly', () => {
      const ast = parser.parse('actor.base_clothing.torso_upper');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should return base layer item only
      expect(result).toEqual(new Set(['cotton_shirt_002']));
    });

    it('should handle underwear slot access correctly', () => {
      const ast = parser.parse('actor.underwear.torso_upper');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should return underwear layer item only
      expect(result).toEqual(new Set(['undershirt_003']));
    });
  });

  describe('Error handling', () => {
    it('should handle missing equipment component gracefully', () => {
      mockRuntimeContext.entityManager.getComponentData.mockReturnValue(null);

      const ast = parser.parse('actor.topmost_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set());
    });

    it('should handle empty equipment slots gracefully', () => {
      mockRuntimeContext.entityManager.getComponentData.mockReturnValue({
        equipped: {},
      });

      const ast = parser.parse('actor.topmost_clothing.torso_upper');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set());
    });

    it('should handle malformed equipment data gracefully', () => {
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
  });

  describe('Complex scenarios - Future Features', () => {
    // These tests are intentionally skipped as they test features not yet implemented.
    // Remove .skip and implement the required features to enable these tests.

    // Union operator (|) is already implemented in tokenizer and parser
    // This test should now pass with existing implementation
    it('should handle union of clothing queries', () => {
      const ast = parser.parse(
        'actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower'
      );
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set(['leather_jacket_001', 'jeans_004']));
    });

    // Enhanced filter syntax - needs further implementation work
    it('should handle filtered clothing results', () => {
      // Mock some clothing items to have a specific component
      mockRuntimeContext.entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (
            entityId === 'player_character' &&
            componentId === 'clothing:equipment'
          ) {
            return {
              equipped: {
                torso_upper: {
                  outer: 'leather_jacket_001',
                  base: 'cotton_shirt_002',
                },
                torso_lower: {
                  outer: 'jeans_004',
                },
              },
            };
          }
          // Mock component data for clothing items
          if (componentId === 'core:tags') {
            if (entityId === 'leather_jacket_001') {
              return { tags: ['waterproof', 'armor'] };
            }
            if (entityId === 'jeans_004') {
              return { tags: ['casual'] };
            }
          }
          return null;
        }
      );

      // Mock entity instances for createEvaluationContext - override getEntity since that's what gets called
      mockRuntimeContext.entityManager.getEntity = jest.fn((entityId) => {
        if (entityId === 'player_character') {
          return mockActorEntity;
        }
        // Mock clothing entities with component type IDs for buildComponents
        if (entityId === 'leather_jacket_001') {
          return {
            id: 'leather_jacket_001',
            componentTypeIds: ['core:tags'],
          };
        }
        if (entityId === 'jeans_004') {
          return {
            id: 'jeans_004',
            componentTypeIds: ['core:tags'],
          };
        }
        if (entityId === 'cotton_shirt_002') {
          return {
            id: 'cotton_shirt_002',
            componentTypeIds: ['core:tags'],
          };
        }
        return null;
      });

      mockRuntimeContext.jsonLogicEval.evaluate.mockImplementation(
        function (logic, context) {
          // Proper JSON Logic evaluation implementation for tests
          if (logic.in && Array.isArray(logic.in) && logic.in.length === 2) {
            const [value, data] = logic.in;
            const resolvedData = this._resolveVar(data, context);
            return Array.isArray(resolvedData) && resolvedData.includes(value);
          }
          return false;
        }
      );

      mockRuntimeContext.jsonLogicEval._resolveVar = function (expr, context) {
        if (expr && expr.var) {
          const path = expr.var.split('.');
          let result = context;
          for (const key of path) {
            result = result?.[key];
            if (result === undefined) break;
          }
          return result;
        }
        return expr;
      };

      const ast = parser.parse(
        'actor.topmost_clothing[][{"in": ["waterproof", {"var": "components.core:tags.tags"}]}]'
      );
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set(['leather_jacket_001']));
    });
  });
});
