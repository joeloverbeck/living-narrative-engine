/**
 * @file Comprehensive tests for engine.js
 * @description Tests targeting specific uncovered lines to achieve 90%+ coverage
 */

import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser.js';
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
      
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entitiesWithComponent);
      
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
          param: 'core:nonExistent'
        }
      };
      
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);
      
      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
      
      expect(result).toEqual(new Set());
    });

    test('should handle filter with non-string parent values - line 463', () => {
      // Target line 463: when item is not a string but an object
      const ast = parseDslExpression('entities(core:item)[{"==": [{"var": "type"}, "weapon"]}]');
      
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'entity1' }
      ]);
      
      const entityInstance = {
        id: 'entity1',
        type: 'weapon'
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
      const ast = parseDslExpression('entities(core:item)[{"==": [{"var": "type"}, "weapon"]}]');
      
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        { id: 'entity1' }
      ]);
      mockEntityManager.getEntityInstance.mockReturnValue({
        id: 'entity1',
        componentTypeIds: ['core:item'],
        getComponentData: jest.fn().mockReturnValue({ type: 'weapon' })
      });
      
      // Make JSON Logic evaluation throw an error
      mockJsonLogicEval.evaluate.mockImplementation(() => {
        throw new Error('JSON Logic evaluation failed');
      });
      
      expect(() => {
        engine.resolve(ast, actorEntity, mockRuntimeCtx);
      }).toThrow('JSON Logic evaluation failed');
    });

    test('should handle cycle detection with detailed path tracking', () => {
      // Target cycle detection in complex scenarios
      const cyclicAst = {
        type: 'Step',
        field: 'circular',
        isArray: false,
        parent: {
          type: 'Source',
          kind: 'actor'
        }
      };
      
      // Mock resolveNode to create a cycle
      const originalResolveNode = engine.resolveNode;
      engine.resolveNode = jest.fn((node, actorEntity, runtimeCtx, depth, path, trace) => {
        if (depth > 0) {
          // Simulate encountering the same node again by calling with same nodeKey
          return originalResolveNode.call(engine, cyclicAst, actorEntity, runtimeCtx, depth + 1, [...path, 'Step:circular:'], trace);
        }
        return originalResolveNode.call(engine, node, actorEntity, runtimeCtx, depth, path, trace);
      });
      
      expect(() => {
        engine.resolve(cyclicAst, actorEntity, mockRuntimeCtx);
      }).toThrow(ScopeCycleError);
      
      // Restore original method
      engine.resolveNode = originalResolveNode;
    });

    test('should handle array iteration edge cases', () => {
      // Test _addArrayItems with various array values
      const mockResult = new Set();
      
      // Test with valid array
      engine._addArrayItems([1, 2, 3], mockResult);
      expect(mockResult).toEqual(new Set([1, 2, 3]));
      
      mockResult.clear();
      
      // Test with array containing null and undefined
      engine._addArrayItems([1, null, 2, undefined, 3], mockResult);
      expect(mockResult).toEqual(new Set([1, 2, 3]));
      
      mockResult.clear();
      
      // Test with non-array value
      engine._addArrayItems('not an array', mockResult);
      expect(mockResult.size).toBe(0);
    });

    test('should handle unknown AST node types gracefully', () => {
      // Test default case in resolveNode switch statement
      const unknownAst = {
        type: 'UnknownType',
        someProperty: 'someValue'
      };
      
      const result = engine.resolve(unknownAst, actorEntity, mockRuntimeCtx);
      
      expect(result).toEqual(new Set());
      expect(mockRuntimeCtx.logger.error).toHaveBeenCalledWith('Unknown AST node type: UnknownType');
    });

    test('should handle field extraction with various input types', () => {
      // Test _extractFieldValue with different parent value types
      
      // Test with string (entity ID)
      mockEntityManager.getComponentData.mockReturnValue('componentValue');
      const result1 = engine._extractFieldValue('entity123', 'testField', mockRuntimeCtx);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith('entity123', 'testField');
      
      // Test with object parent value
      const objValue = { testField: 'testValue' };
      const result2 = engine._extractFieldValue(objValue, 'testField', mockRuntimeCtx);
      expect(result2).toBe('testValue');
      
      // Test with null parent value
      const result3 = engine._extractFieldValue(null, 'testField', mockRuntimeCtx);
      expect(result3).toBeNull();
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
      
      // Should include entities without the component
      expect(result).toEqual(new Set(['entity2', 'entity3']));
    });
  });

  describe('Complex integration scenarios', () => {
    test('should handle union operations with empty results', () => {
      const leftResult = new Set();
      const rightResult = new Set(['entity1']);
      
      const unionNode = {
        type: 'Union',
        left: { type: 'Source', kind: 'entities', param: 'core:missing' },
        right: { type: 'Source', kind: 'actor' }
      };
      
      // Mock resolveNode to return different results for left and right
      const originalResolveNode = engine.resolveNode;
      engine.resolveNode = jest.fn((node, actorEntity, runtimeCtx, depth, path, trace) => {
        if (node.param === 'core:missing') return leftResult;
        if (node.kind === 'actor') return rightResult;
        return originalResolveNode.call(engine, node, actorEntity, runtimeCtx, depth, path, trace);
      });
      
      const result = engine.resolve(unionNode, actorEntity, mockRuntimeCtx);
      
      expect(result).toEqual(new Set(['entity1']));
      
      // Restore original method
      engine.resolveNode = originalResolveNode;
    });

    test('should handle trace context integration', () => {
      const mockTraceContext = {
        addLog: jest.fn()
      };
      
      const ast = parseDslExpression('location');
      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx, mockTraceContext);
      
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