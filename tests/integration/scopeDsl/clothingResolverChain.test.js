import { describe, it, expect, beforeEach } from '@jest/globals';
import createScopeEngine from '../../../src/scopeDsl/engine.js';
import createDefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';

describe('Clothing Resolver Chain Integration', () => {
  let engine;
  let parser;
  let mockRuntimeContext;
  let mockActorEntity;

  beforeEach(() => {
    // Setup complete test environment
    engine = new createScopeEngine();
    parser = new createDefaultDslParser();

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
        getEntity: jest.fn().mockReturnValue(mockActorEntity),
      },
      jsonLogicEval: {
        evaluate: jest.fn().mockReturnValue(true),
      },
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

    // SKIPPED: Union operator (|) requires tokenizer enhancement
    // Implementation needed: Add union operator to src/scopeDsl/parser/tokenizer.js
    // Syntax: 'query1 | query2' should return combined results from both queries
    // Related: Enhancement planned for scope DSL union operations
    it.skip('should handle union of clothing queries', () => {
      const ast = parser.parse(
        'actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower'
      );
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set(['leather_jacket_001', 'jeans_004']));
    });

    // SKIPPED: Complex filter syntax requires parser enhancement
    // Implementation needed: Enhanced filter parser for nested JSON Logic expressions
    // Syntax: 'query[][filter_expression]' for conditional result filtering
    // Related: Advanced filtering capabilities for scope DSL queries
    it.skip('should handle filtered clothing results', () => {
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

      mockRuntimeContext.jsonLogicEval.evaluate.mockImplementation(
        (logic, context) => {
          // Simple mock evaluation - check if item has 'waterproof' tag
          if (context.id === 'leather_jacket_001') return true;
          if (context.id === 'jeans_004') return false;
          return false;
        }
      );

      const ast = parser.parse(
        'actor.topmost_clothing[][{"in": ["waterproof", {"var": "components.core:tags.tags"}]}]'
      );
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set(['leather_jacket_001']));
    });
  });

  describe('Performance', () => {
    it('should resolve clothing queries efficiently', () => {
      const iterations = 1000;
      const ast = parser.parse('actor.topmost_clothing[]');

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        engine.resolve(ast, mockActorEntity, mockRuntimeContext);
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Should complete in under 5ms per resolution
      expect(averageTime).toBeLessThan(5);
    });

    it('should handle deep slot access efficiently', () => {
      const iterations = 1000;
      const ast = parser.parse('actor.topmost_clothing.torso_upper');

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        engine.resolve(ast, mockActorEntity, mockRuntimeContext);
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Should complete in under 5ms per resolution
      expect(averageTime).toBeLessThan(5);
    });
  });

  describe('Trace logging integration', () => {
    it('should provide comprehensive trace logs for clothing resolution', () => {
      const trace = {
        addLog: jest.fn(),
      };

      const ast = parser.parse('actor.topmost_clothing.torso_upper');
      const result = engine.resolve(
        ast,
        mockActorEntity,
        mockRuntimeContext,
        trace
      );

      // Should have trace logs from multiple resolvers
      const traceCalls = trace.addLog.mock.calls;
      const hasClothingStepResolverLog = traceCalls.some(
        (call) => call[2] === 'ClothingStepResolver'
      );
      const hasSlotAccessResolverLog = traceCalls.some(
        (call) => call[2] === 'SlotAccessResolver'
      );

      expect(hasClothingStepResolverLog).toBe(true);
      expect(hasSlotAccessResolverLog).toBe(true);
      expect(result).toEqual(new Set(['leather_jacket_001']));
    });
  });
});
