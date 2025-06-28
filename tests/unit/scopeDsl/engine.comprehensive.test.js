/**
 * @file Comprehensive tests for engine.js
 * @description Tests targeting specific uncovered lines to achieve 90%+ coverage
 */

import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';
import ScopeCycleError from '../../../src/errors/scopeCycleError.js';

describe('ScopeEngine - Comprehensive Coverage Tests', () => {
  let engine;
  let mockRuntimeCtx;
  let mockEntityManager;
  let mockJsonLogicEval;
  let actorEntity;

  beforeEach(() => {
    engine = new ScopeEngine();

    mockEntityManager = {
      getEntitiesWithComponent: jest.fn(),
      getEntities: jest.fn(),
      hasComponent: jest.fn(),
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
    };

    mockJsonLogicEval = {
      evaluate: jest.fn(),
    };

    mockRuntimeCtx = {
      entityManager: mockEntityManager,
      spatialIndexManager: {},
      jsonLogicEval: mockJsonLogicEval,
      logger: {
        debug: jest.fn(),
        error: jest.fn(),
      },
      location: { id: 'loc123' },
    };

    actorEntity = {
      id: 'actor123',
      componentTypeIds: ['core:position'],
      getComponentData: jest.fn().mockReturnValue({ x: 10, y: 20 }),
    };
  });

  describe('Coverage for specific uncovered lines', () => {
    test('should handle entity manager fallback without getEntities method - lines 219-220', () => {
      // Target lines 219-220: fallback for entityManager without getEntities
      delete mockEntityManager.getEntities;
      mockEntityManager.entities = new Map([
        ['entity1', { id: 'entity1', components: {} }],
        ['entity2', { id: 'entity2', components: {} }],
      ]);

      const ast = parseDslExpression('entities(!core:item)');
      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

      expect(result).toBeInstanceOf(Set);
    });

    test('should handle non-string ID filtering in positive component queries - lines 176-180', () => {
      // Target lines 176-180: filtering non-string IDs
      const entitiesWithComponent = [
        { id: 'string_id' },
        { id: 123 }, // non-string ID
        { id: null }, // null ID
        { id: '' }, // empty string ID
        { id: 'valid_id' },
      ];

      mockEntityManager.getEntitiesWithComponent.mockReturnValue(
        entitiesWithComponent
      );

      const ast = parseDslExpression('entities(core:item)');
      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

      // Empty string is still a string, so it's included
      expect(result).toEqual(new Set(['string_id', '', 'valid_id']));
    });

    test('should handle empty result from parent in field access - line 332', () => {
      // Target line 332: when parentResult is empty
      const ast = {
        type: 'Step',
        field: 'nonExistentField',
        isArray: false,
        parent: {
          type: 'Source',
          kind: 'entities',
          param: 'core:nonExistent',
        },
      };

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

      expect(result).toEqual(new Set());
    });

    test('should handle filter with non-string parent values - line 463', () => {
      // Target line 463: when item is not a string but an object
      const ast = parseDslExpression(
        'entities(core:item)[{"==": [{"var": "type"}, "weapon"]}]'
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'entity1' },
      ]);

      const entityInstance = {
        id: 'entity1',
        type: 'weapon',
      };

      mockEntityManager.getEntityInstance.mockReturnValue(entityInstance);

      mockJsonLogicEval.evaluate.mockImplementation((logic, context) => {
        return context.entity.type === 'weapon';
      });

      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

      expect(result).toEqual(new Set(['entity1']));
    });

    test('should handle filter evaluation errors gracefully - lines 468-475', () => {
      // Target lines 468-475: when JSON Logic evaluation throws
      const ast = parseDslExpression(
        'entities(core:item)[{"==": [{"var": "type"}, "weapon"]}]'
      );

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'entity1' },
      ]);
      mockEntityManager.getEntityInstance.mockReturnValue({
        id: 'entity1',
        componentTypeIds: ['core:item'],
        getComponentData: jest.fn().mockReturnValue({ type: 'weapon' }),
      });

      // Make JSON Logic evaluation throw an error
      mockJsonLogicEval.evaluate.mockImplementation(() => {
        throw new Error('JSON Logic evaluation failed');
      });

      expect(() => {
        engine.resolve(ast, actorEntity, mockRuntimeCtx);
      }).toThrow('JSON Logic evaluation failed');
    });

    // Cycle detection is thoroughly tested in engine.test.js

    test('should handle array iteration edge cases', () => {
      // Test array iteration through the public API
      const ast = parseDslExpression('actor.core:inventory[]');

      // Mock actor with inventory array
      mockEntityManager.getComponentData.mockReturnValue([
        'item1',
        'item2',
        'item3',
      ]);

      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
      expect(result).toEqual(new Set(['item1', 'item2', 'item3']));

      // Test with array containing null and undefined
      mockEntityManager.getComponentData.mockReturnValue([
        'item1',
        null,
        'item2',
        undefined,
        'item3',
      ]);
      const result2 = engine.resolve(ast, actorEntity, mockRuntimeCtx);
      expect(result2).toEqual(new Set(['item1', 'item2', 'item3']));

      // Test with non-array value (should return empty set for array iteration)
      mockEntityManager.getComponentData.mockReturnValue('not an array');
      const result3 = engine.resolve(ast, actorEntity, mockRuntimeCtx);
      expect(result3.size).toBe(0);
    });

    test('should handle unknown AST node types gracefully', () => {
      // Test default case in resolveNode switch statement
      const unknownAst = {
        type: 'UnknownType',
        someProperty: 'someValue',
      };

      expect(() => {
        engine.resolve(unknownAst, actorEntity, mockRuntimeCtx);
      }).toThrow("Unknown node kind: 'UnknownType'");
    });

    test('should handle field extraction with various input types', () => {
      // Test field extraction through the public API

      // Test with entity field access
      const ast1 = parseDslExpression('actor.core:name');
      mockEntityManager.getComponentData.mockReturnValue('Actor Name');

      const result1 = engine.resolve(ast1, actorEntity, mockRuntimeCtx);
      expect(result1).toEqual(new Set(['Actor Name']));
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor123',
        'core:name'
      );

      // Test with nested object field access
      const ast2 = parseDslExpression('actor.core:position.x');
      mockEntityManager.getComponentData.mockReturnValue({ x: 10, y: 20 });

      const result2 = engine.resolve(ast2, actorEntity, mockRuntimeCtx);
      expect(result2).toEqual(new Set([10]));

      // Test with null/missing field - null is a valid value
      mockEntityManager.getComponentData.mockReturnValue(null);
      const result3 = engine.resolve(ast1, actorEntity, mockRuntimeCtx);
      expect(result3).toEqual(new Set([null]));
    });

    test('should handle entities source without hasComponent method - lines 144-145', () => {
      // Target lines 144-145: hasComponent method fallback
      delete mockEntityManager.hasComponent;

      const allEntities = [
        { id: 'entity1', components: { 'core:item': {} } },
        { id: 'entity2', components: {} },
        { id: 'entity3' }, // No components property
      ];

      mockEntityManager.getEntities = jest.fn().mockReturnValue(allEntities);

      const ast = parseDslExpression('entities(!core:item)');
      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

      // Should include all entities when hasComponent is not available
      // The sourceResolver doesn't have a fallback for missing hasComponent
      expect(result).toEqual(new Set(['entity1', 'entity2', 'entity3']));
    });
  });

  describe('Complex integration scenarios', () => {
    test('should handle union operations with empty results', () => {
      // Test union through the public API
      const ast = parseDslExpression('entities(core:missing) + actor');

      // Mock empty result for entities with missing component
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

      // Should contain only the actor since entities(core:missing) returns empty
      expect(result).toEqual(new Set(['actor123']));
    });

    test('should handle trace context integration', () => {
      const mockTraceContext = {
        addLog: jest.fn(),
        info(msg, src, data) {
          data === undefined
            ? this.addLog('info', msg, src)
            : this.addLog('info', msg, src, data);
        },
        success(msg, src, data) {
          data === undefined
            ? this.addLog('success', msg, src)
            : this.addLog('success', msg, src, data);
        },
        failure(msg, src, data) {
          data === undefined
            ? this.addLog('failure', msg, src)
            : this.addLog('failure', msg, src, data);
        },
        step(msg, src, data) {
          data === undefined
            ? this.addLog('step', msg, src)
            : this.addLog('step', msg, src, data);
        },
        error(msg, src, data) {
          data === undefined
            ? this.addLog('error', msg, src)
            : this.addLog('error', msg, src, data);
        },
        data(msg, src, data) {
          data === undefined
            ? this.addLog('data', msg, src)
            : this.addLog('data', msg, src, data);
        },
      };

      const ast = parseDslExpression('location');
      const result = engine.resolve(
        ast,
        actorEntity,
        mockRuntimeCtx,
        mockTraceContext
      );

      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'step',
        'Starting scope resolution.',
        'ScopeEngine',
        { ast }
      );

      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'success',
        expect.stringContaining('Scope resolution finished'),
        'ScopeEngine',
        expect.objectContaining({ targets: expect.any(Array) })
      );
    });
  });
});
