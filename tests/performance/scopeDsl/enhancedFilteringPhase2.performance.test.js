/**
 * @file Performance tests for enhanced scope DSL filtering
 * @description Performance benchmarks for scope resolution with enhanced context
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import createScopeEngine from '../../../src/scopeDsl/engine.js';
import createDefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';

describe('Enhanced Filtering Phase 2 - Performance Tests', () => {
  let parser;
  let engine;
  let mockRuntimeContext;
  let mockActorEntity;

  beforeEach(() => {
    // Setup engine and parser
    engine = new createScopeEngine();
    parser = new createDefaultDslParser();

    // Create mock runtime context with entityManager
    mockRuntimeContext = {
      jsonLogicEval: {
        evaluate: jest.fn(() => true),
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      entityManager: {
        getComponentData: jest.fn((entityId, componentId) => {
          if (
            entityId === 'actor_001' &&
            componentId === 'clothing:equipment'
          ) {
            return {
              equipped: {
                torso_upper: {
                  outer: 'leather_jacket_001',
                  base: 'cotton_shirt_001',
                },
                neck: {
                  outer: 'wool_scarf_001',
                },
                groin: {
                  base: 'cotton_underwear_001',
                },
              },
            };
          }
          return null;
        }),
        getEntityInstance: jest.fn((id) => {
          // Return mock clothing entities
          if (id === 'leather_jacket_001') {
            return {
              id: 'leather_jacket_001',
              components: {
                'clothing:slot': { torso_upper: true },
                'clothing:layer': { outer: true },
              },
            };
          }
          if (id === 'cotton_shirt_001') {
            return {
              id: 'cotton_shirt_001',
              components: {
                'clothing:slot': { torso_upper: true },
                'clothing:layer': { base: true },
              },
            };
          }
          if (id === 'wool_scarf_001') {
            return {
              id: 'wool_scarf_001',
              components: {
                'clothing:slot': { neck: true },
                'clothing:layer': { outer: true },
              },
            };
          }
          if (id === 'cotton_underwear_001') {
            return {
              id: 'cotton_underwear_001',
              components: {
                'clothing:slot': { groin: true },
                'clothing:layer': { base: true },
              },
            };
          }
          return null;
        }),
      },
    };

    // Create mock actor entity
    mockActorEntity = {
      id: 'actor_001',
    };
  });

  describe('Performance Tests', () => {
    it('should resolve clothing queries efficiently with enhanced context', () => {
      const ast = parser.parse('actor.all_clothing[]');

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        engine.resolve(ast, mockActorEntity, mockRuntimeContext);
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Should complete resolution in under 5ms per query
      expect(averageTime).toBeLessThan(5);
    });
  });
});
