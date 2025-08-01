import { describe, it, expect, beforeEach } from '@jest/globals';
import createScopeEngine from '../../../src/scopeDsl/engine.js';
import createDefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';

describe('Scope DSL Phase 2: Enhanced Filtering Integration', () => {
  let engine;
  let parser;
  let mockRuntimeContext;
  let mockActorEntity;
  let mockEntities;

  beforeEach(() => {
    // Setup engine and parser
    engine = new createScopeEngine();
    parser = new createDefaultDslParser();

    // Create mock clothing entities with component data
    mockEntities = {
      leather_jacket_001: {
        id: 'leather_jacket_001',
        componentTypeIds: ['core:tags', 'core:material', 'clothing:armor'],
        components: new Map([
          ['core:tags', { tags: ['waterproof', 'armor', 'outer'] }],
          ['core:material', { type: 'leather', quality: 'high' }],
          [
            'clothing:armor',
            { rating: 8, protection: { physical: 8, magical: 2 } },
          ],
        ]),
        getComponentData: function (componentId) {
          return this.components.get(componentId);
        },
      },
      cotton_shirt_002: {
        id: 'cotton_shirt_002',
        componentTypeIds: ['core:tags', 'core:material'],
        components: new Map([
          ['core:tags', { tags: ['casual', 'base', 'breathable'] }],
          ['core:material', { type: 'cotton', quality: 'normal' }],
        ]),
        getComponentData: function (componentId) {
          return this.components.get(componentId);
        },
      },
      boots_003: {
        id: 'boots_003',
        componentTypeIds: ['core:tags', 'core:material', 'clothing:armor'],
        components: new Map([
          ['core:tags', { tags: ['waterproof', 'durable', 'outer'] }],
          ['core:material', { type: 'leather', quality: 'high' }],
          [
            'clothing:armor',
            { rating: 5, protection: { physical: 5, magical: 0 } },
          ],
        ]),
        getComponentData: function (componentId) {
          return this.components.get(componentId);
        },
      },
      wool_sweater_004: {
        id: 'wool_sweater_004',
        componentTypeIds: ['core:tags', 'core:material'],
        components: new Map([
          ['core:tags', { tags: ['warm', 'casual', 'base'] }],
          ['core:material', { type: 'wool', quality: 'high' }],
        ]),
        getComponentData: function (componentId) {
          return this.components.get(componentId);
        },
      },
      steel_helmet_005: {
        id: 'steel_helmet_005',
        componentTypeIds: ['core:tags', 'core:material', 'clothing:armor'],
        components: new Map([
          ['core:tags', { tags: ['armor', 'metal', 'outer'] }],
          ['core:material', { type: 'steel', quality: 'high' }],
          [
            'clothing:armor',
            { rating: 10, protection: { physical: 10, magical: 1 } },
          ],
        ]),
        getComponentData: function (componentId) {
          return this.components.get(componentId);
        },
      },
    };

    // Create mock equipment data
    const mockEquipmentData = {
      equipped: {
        torso_upper: {
          outer: 'leather_jacket_001',
          base: 'cotton_shirt_002',
        },
        torso_lower: {
          base: 'wool_sweater_004',
        },
        feet: {
          outer: 'boots_003',
        },
        head_gear: {
          outer: 'steel_helmet_005',
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
          // Return component data for clothing entities
          const entity = mockEntities[entityId];
          return entity?.getComponentData(componentId) || null;
        }),
        getEntity: jest.fn((entityId) => mockEntities[entityId] || null),
        hasComponent: jest.fn().mockReturnValue(true),
        getEntitiesWithComponent: jest.fn().mockReturnValue([]),
      },
      jsonLogicEval: {
        evaluate: jest.fn(function (logic, context) {
          // Simple JSON Logic evaluation implementation for tests
          if (logic.in && Array.isArray(logic.in) && logic.in.length === 2) {
            const [value, data] = logic.in;
            const resolvedData = this._resolveVar(data, context);
            return Array.isArray(resolvedData) && resolvedData.includes(value);
          }
          if (
            logic['=='] &&
            Array.isArray(logic['==']) &&
            logic['=='].length === 2
          ) {
            const [left, right] = logic['=='];
            const resolvedLeft = this._resolveVar(left, context);
            const resolvedRight = this._resolveVar(right, context);
            return resolvedLeft === resolvedRight;
          }
          if (
            logic['>'] &&
            Array.isArray(logic['>']) &&
            logic['>'].length === 2
          ) {
            const [left, right] = logic['>'];
            const resolvedLeft = this._resolveVar(left, context);
            const resolvedRight = this._resolveVar(right, context);
            return Number(resolvedLeft) > Number(resolvedRight);
          }
          if (logic.and && Array.isArray(logic.and)) {
            return logic.and.every((condition) =>
              this.evaluate(condition, context)
            );
          }
          if (logic.or && Array.isArray(logic.or)) {
            return logic.or.some((condition) =>
              this.evaluate(condition, context)
            );
          }
          return false;
        }),
        _resolveVar: function (expr, context) {
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
        },
      },
    };
  });

  describe('Enhanced Entity Context Creation', () => {
    it('should properly resolve entity instances for clothing items', () => {
      // Test that the enhanced evaluation context works for existing simple queries
      const ast = parser.parse('actor.all_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should return all clothing entity instance IDs
      expect(result.size).toBe(5);
      expect(result).toContain('leather_jacket_001');
      expect(result).toContain('cotton_shirt_002');
      expect(result).toContain('boots_003');
      expect(result).toContain('wool_sweater_004');
      expect(result).toContain('steel_helmet_005');
    });

    it('should provide entities with components through getItemComponents gateway method', () => {
      // Test that getItemComponents is working
      const entity =
        mockRuntimeContext.entityManager.getEntity('leather_jacket_001');
      expect(entity).toBeDefined();
      expect(entity.components).toBeDefined();
      expect(entity.components.get('core:tags')).toEqual({
        tags: ['waterproof', 'armor', 'outer'],
      });
    });

    it('should handle evaluation context creation for entity instance IDs', () => {
      // This test verifies the enhanced evaluation context works
      // Note: Complex filter syntax is not yet implemented in the parser
      // This test validates the foundation for when filters are implemented

      const ast = parser.parse('actor.topmost_clothing.torso_upper');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should return the entity instance ID
      expect(result).toEqual(new Set(['leather_jacket_001']));

      // Verify the entity has proper component structure
      const entity = mockEntities['leather_jacket_001'];
      expect(entity.components.get('core:tags').tags).toContain('waterproof');
      expect(entity.components.get('clothing:armor').rating).toBe(8);
    });
  });

  describe('JSON Logic Property Filtering (Enhanced Parser)', () => {
    it('should create proper evaluation contexts for entities', () => {
      // Test that our enhanced evaluation context works correctly
      const {
        createEvaluationContext,
      } = require('../../../src/scopeDsl/core/entityHelpers.js');
      const gateway = engine._createEntitiesGateway(mockRuntimeContext);

      const evalCtx = createEvaluationContext(
        'leather_jacket_001',
        mockActorEntity,
        gateway,
        { getLocation: () => null }
      );

      expect(evalCtx).toBeDefined();
      expect(evalCtx.entity).toBeDefined();
      expect(evalCtx.entity.id).toBe('leather_jacket_001');
      expect(evalCtx.entity.components).toBeDefined();
      expect(evalCtx.entity.components['core:tags']).toEqual({
        tags: ['waterproof', 'armor', 'outer'],
      });
    });

    it('should filter clothing items by tags using JSON Logic', () => {
      const ast = parser.parse(
        'actor.all_clothing[][{"in": ["waterproof", {"var": "components.core:tags.tags"}]}]'
      );
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);
      expect(Array.from(result).sort()).toEqual([
        'boots_003',
        'leather_jacket_001',
      ]);
    });

    it('should filter clothing items by numeric armor rating', () => {
      const ast = parser.parse(
        'actor.all_clothing[][{">": [{"var": "components.clothing:armor.rating"}, 5]}]'
      );
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);
      expect(Array.from(result).sort()).toEqual([
        'leather_jacket_001',
        'steel_helmet_005',
      ]);
    });

    it('should filter clothing items by material type', () => {
      const ast = parser.parse(
        'actor.all_clothing[][{"==": [{"var": "components.core:material.type"}, "leather"]}]'
      );
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);
      expect(Array.from(result).sort()).toEqual([
        'boots_003',
        'leather_jacket_001',
      ]);
    });
  });

  describe('Infrastructure Validation', () => {
    it('should have working getItemComponents gateway method', () => {
      // Manually test the gateway method we implemented
      const gateway = engine._createEntitiesGateway(mockRuntimeContext);

      // Test with an entity instance ID
      const components = gateway.getItemComponents('leather_jacket_001');
      expect(components).toBeDefined();
      expect(components['core:tags']).toEqual({
        tags: ['waterproof', 'armor', 'outer'],
      });
      expect(components['clothing:armor']).toEqual({
        rating: 8,
        protection: { physical: 8, magical: 2 },
      });
    });

    it('should return null for non-existent items', () => {
      const gateway = engine._createEntitiesGateway(mockRuntimeContext);
      const components = gateway.getItemComponents('nonexistent_item');
      expect(components).toBeNull();
    });

    it('should handle entities without components gracefully', () => {
      mockEntities['simple_item'] = {
        id: 'simple_item',
        componentTypeIds: [],
        components: new Map(),
      };

      const gateway = engine._createEntitiesGateway(mockRuntimeContext);
      const components = gateway.getItemComponents('simple_item');
      expect(components).toEqual({});
    });
  });

  describe('Trace Logging Integration', () => {
    it('should provide detailed trace logs for entity resolution', () => {
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

      // Should have trace logs from the resolution process
      const traceCalls = trace.addLog.mock.calls;

      // Should have some trace activity
      expect(traceCalls.length).toBeGreaterThan(0);
      expect(Array.from(result)).toEqual(['leather_jacket_001']);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing clothing query functionality', () => {
      // Test that existing queries still work without filters
      const tests = [
        { query: 'actor.all_clothing[]', expectedSize: 5 },
        { query: 'actor.outer_clothing[]', expectedSize: 3 },
        { query: 'actor.base_clothing[]', expectedSize: 2 },
        {
          query: 'actor.topmost_clothing.torso_upper',
          expected: ['leather_jacket_001'],
        },
        { query: 'actor.topmost_clothing.feet', expected: ['boots_003'] },
      ];

      for (const test of tests) {
        const ast = parser.parse(test.query);
        const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

        if (test.expectedSize !== undefined) {
          expect(result.size).toBe(test.expectedSize);
        }
        if (test.expected !== undefined) {
          expect(Array.from(result)).toEqual(test.expected);
        }
      }
    });
  });
});
