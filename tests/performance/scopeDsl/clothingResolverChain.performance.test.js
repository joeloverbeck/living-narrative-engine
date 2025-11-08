/**
 * @file Performance tests for clothing resolver chain in Scope DSL
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import createScopeEngine from '../../../src/scopeDsl/engine.js';
import createDefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';

describe('Clothing Resolver Chain Performance', () => {
  let engine;
  let parser;
  let mockRuntimeContext;
  let mockActorEntity;

  beforeEach(() => {
    // Setup test environment
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
          base: 'pants_005',
          underwear: 'boxers_006',
        },
        feet: {
          outer: 'boots_007',
          base: 'socks_008',
        },
      },
    };

    // Create mock entities
    mockActorEntity = {
      id: 'actor_001',
      getComponent: (componentId) => {
        if (componentId === 'core:equipment') {
          return mockEquipmentData;
        }
        return null;
      },
    };

    // Create mock entity manager
    const mockEntityManager = {
      getEntity: (id) => mockRuntimeContext.entities?.[id],
      getEntityInstance: (id) => mockRuntimeContext.entities?.[id],
    };

    // Create mock jsonLogicEval
    const mockJsonLogicEval = {
      evaluate: () => true,
    };

    mockRuntimeContext = {
      entityManager: mockEntityManager,
      jsonLogicEval: mockJsonLogicEval,
      entities: {
        leather_jacket_001: {
          id: 'leather_jacket_001',
          getComponent: (componentId) => {
            if (componentId === 'core:clothing') {
              return {
                slot_category: 'torso_upper',
                slot_layer: 'outer',
                display_name: 'Leather Jacket',
              };
            }
            return null;
          },
        },
        cotton_shirt_002: {
          id: 'cotton_shirt_002',
          getComponent: (componentId) => {
            if (componentId === 'core:clothing') {
              return {
                slot_category: 'torso_upper',
                slot_layer: 'base',
                display_name: 'Cotton Shirt',
              };
            }
            return null;
          },
        },
        // Additional mock entities for other clothing items
        undershirt_003: {
          id: 'undershirt_003',
          getComponent: (componentId) => {
            if (componentId === 'core:clothing') {
              return {
                slot_category: 'torso_upper',
                slot_layer: 'underwear',
                display_name: 'Undershirt',
              };
            }
            return null;
          },
        },
      },
      logger: { debug: () => {}, warn: () => {}, error: () => {} },
    };
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
});
