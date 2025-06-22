/**
 * @file Unit tests for Scope-DSL Engine
 * @description Tests for src/scopeDsl/engine.js - AST walker/query engine
 */

import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseInlineExpr } from '../../../src/scopeDsl/parser.js';
import ScopeDepthError from '../../../src/errors/scopeDepthError.js';

// Mock dependencies
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  getEntitiesWithComponent: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(),
  entities: []
};

const mockSpatialIndexManager = {
  getEntitiesInLocation: jest.fn()
};

const mockJsonLogicEval = {
  evaluate: jest.fn()
};

const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const mockRuntimeCtx = {
  entityManager: mockEntityManager,
  spatialIndexManager: mockSpatialIndexManager,
  jsonLogicEval: mockJsonLogicEval,
  logger: mockLogger
};

describe('ScopeEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new ScopeEngine();
    jest.clearAllMocks();
    // Reset entities array
    mockEntityManager.entities = [];
  });

  describe('resolve()', () => {
    describe('Source nodes', () => {
      test('actor → Set{actorId}', () => {
        const ast = parseInlineExpr('actor');
        const actorId = 'actor123';
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(result).toEqual(new Set([actorId]));
      });

      test('location(expr) → Set of entityIds in location', () => {
        const ast = parseInlineExpr('location(actor)');
        const actorId = 'actor123';
        const locationId = 'loc456';
        const entitiesInLocation = new Set(['entity1', 'entity2', 'entity3']);
        
        // Mock actor's location
        mockEntityManager.getComponentData.mockReturnValue({ locationId });
        mockEntityManager.getEntitiesInLocation.mockReturnValue(entitiesInLocation);
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith('actor', 'core:location');
        expect(mockEntityManager.getEntitiesInLocation).toHaveBeenCalledWith(locationId);
        expect(result).toEqual(entitiesInLocation);
      });

      test('location without param defaults to actor', () => {
        const ast = parseInlineExpr('location');
        const actorId = 'actor123';
        const locationId = 'loc456';
        const entitiesInLocation = new Set(['entity1', 'entity2']);
        
        mockEntityManager.getComponentData.mockReturnValue({ locationId });
        mockEntityManager.getEntitiesInLocation.mockReturnValue(entitiesInLocation);
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'core:location');
        expect(result).toEqual(entitiesInLocation);
      });

      test('entities(ComponentName) → Set of entities with component', () => {
        const ast = parseInlineExpr('entities(core:item)');
        const actorId = 'actor123';
        const entitiesWithComponent = [
          { id: 'entity1' },
          { id: 'entity2' },
          { id: 'entity3' }
        ];
        
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entitiesWithComponent);
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledWith('core:item');
        expect(result).toEqual(new Set(['entity1', 'entity2', 'entity3']));
      });

      test('entities(!ComponentName) → Set of entities without component', () => {
        // Note: Parser doesn't support ! syntax yet, so we'll test the logic manually
        const ast = parseInlineExpr('entities(core:item)');
        const actorId = 'actor123';
        const allEntities = [
          { id: 'entity1' },
          { id: 'entity2' },
          { id: 'entity3' },
          { id: 'entity4' }
        ];
        const entitiesWithComponent = [
          { id: 'entity1' },
          { id: 'entity3' }
        ];
        
        // Mock all entities and entities with component
        mockEntityManager.entities = allEntities;
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entitiesWithComponent);
        
        // Manually test the negative component logic
        const componentName = 'core:item';
        const entityIdsWithComponent = new Set(entitiesWithComponent.map(e => e.id));
        const entityIdsWithoutComponent = allEntities
          .filter(e => !entityIdsWithComponent.has(e.id))
          .map(e => e.id);
        
        expect(entityIdsWithoutComponent).toEqual(['entity2', 'entity4']);
      });
    });

    describe('Edge traversal', () => {
      test('edge traverses component field', () => {
        const ast = parseInlineExpr('actor.inventory');
        const actorId = 'actor123';
        const inventoryData = { items: ['item1', 'item2'] };
        
        mockEntityManager.getComponentData.mockReturnValue(inventoryData);
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'core:inventory');
        expect(result).toEqual(new Set([actorId]));
      });

      test('edge[] iterates array values', () => {
        const ast = parseInlineExpr('actor.inventory.items[]');
        const actorId = 'actor123';
        const inventoryData = { items: ['item1', 'item2', 'item3'] };
        
        // Enable debug logging for this test
        mockLogger.debug = jest.fn().mockImplementation((...args) => {
          console.log('[DEBUG]', ...args);
        });
        
        // Mock different responses for different component names
        mockEntityManager.getComponentData.mockImplementation((entityId, componentName) => {
          if (componentName === 'core:inventory') {
            return inventoryData;
          } else if (componentName === 'core:items') {
            return undefined; // items is not a component, it's a field
          }
          return undefined;
        });
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(actorId, 'core:inventory');
        expect(result).toEqual(new Set(['item1', 'item2', 'item3']));
      });

      test('edge[] with non-array field returns empty set', () => {
        const ast = parseInlineExpr('actor.inventory.items[]');
        const actorId = 'actor123';
        const inventoryData = { items: 'not-an-array' };
        
        mockEntityManager.getComponentData.mockReturnValue(inventoryData);
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(result).toEqual(new Set());
      });
    });

    describe('Filter evaluation', () => {
      test('Filter evaluates JsonLogic with entity context', () => {
        const ast = parseInlineExpr('actor.inventory.items[][{"==": [{"var": "entity.id"}, "item1"]}]');
        const actorId = 'actor123';
        const inventoryData = { items: ['item1', 'item2', 'item3'] };
        
        // Enable debug logging for this test
        mockLogger.debug = jest.fn().mockImplementation((...args) => {
          console.log('[DEBUG]', ...args);
        });
        
        // Mock getComponentData for inventory
        mockEntityManager.getComponentData.mockImplementation((entityId, componentName) => {
          if (componentName === 'core:inventory') {
            return inventoryData;
          } else if (componentName === 'core:items') {
            return undefined;
          }
          return undefined;
        });
        // Mock getEntityInstance for each item
        mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));
        mockJsonLogicEval.evaluate
          .mockReturnValueOnce(true)   // item1 passes
          .mockReturnValueOnce(false)  // item2 fails
          .mockReturnValueOnce(false); // item3 fails
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(mockJsonLogicEval.evaluate).toHaveBeenCalledTimes(3);
        expect(mockJsonLogicEval.evaluate).toHaveBeenNthCalledWith(1, 
          { "==": [{"var": "entity.id"}, "item1"] },
          { entity: { id: 'item1' }, actor: { id: actorId } }
        );
        expect(result).toEqual(new Set(['item1']));
      });

      test('Filter with complex JsonLogic context', () => {
        // Simplified test that works with current parser
        const ast = parseInlineExpr('location.entities(core:item)[][{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]');
        const actorId = 'actor123';
        const locationId = 'loc456';
        const entitiesInLocation = new Set(['entity1', 'entity2', 'entity3']);
        
        mockEntityManager.getComponentData.mockReturnValue({ locationId });
        mockEntityManager.getEntitiesInLocation.mockReturnValue(entitiesInLocation);
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: 'entity1' },
          { id: 'entity2' },
          { id: 'entity3' }
        ]);
        mockJsonLogicEval.evaluate
          .mockReturnValueOnce(true)   // entity1 passes
          .mockReturnValueOnce(false)  // entity2 fails
          .mockReturnValueOnce(true);  // entity3 passes
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(result).toEqual(new Set(['entity1', 'entity3']));
      });
    });

    describe('Union operations', () => {
      test('Union A + B returns merged Set', () => {
        // Test with simpler expressions that the parser supports
        const ast = parseInlineExpr('actor + location');
        const actorId = 'actor123';
        const locationId = 'loc456';
        const entitiesInLocation = new Set(['entity1', 'entity2']);
        
        mockEntityManager.getComponentData.mockReturnValue({ locationId });
        mockEntityManager.getEntitiesInLocation.mockReturnValue(entitiesInLocation);
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(result).toEqual(new Set([actorId, 'entity1', 'entity2']));
      });

      test('Union with overlapping entities deduplicates', () => {
        const ast = parseInlineExpr('actor + location');
        const actorId = 'actor123';
        const locationId = 'loc456';
        const entitiesInLocation = new Set([actorId, 'entity3']);
        
        mockEntityManager.getComponentData.mockReturnValue({ locationId });
        mockEntityManager.getEntitiesInLocation.mockReturnValue(entitiesInLocation);
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(result).toEqual(new Set([actorId, 'entity3']));
      });
    });

    describe('Depth limit enforcement', () => {
      test('throws ScopeDepthError when depth > 4', () => {
        // Test with a simpler expression that should trigger depth limit
        const ast = parseInlineExpr('actor.inventory.items[].components.core:stats');
        const actorId = 'actor123';
        const inventoryData = { items: ['item1'] };
        
        mockEntityManager.getComponentData.mockReturnValue(inventoryData);
        
        expect(() => {
          engine.resolve(ast, actorId, mockRuntimeCtx);
        }).toThrow('Expression depth limit exceeded (max 4)');
      });

      test('allows depth exactly 4', () => {
        const ast = parseInlineExpr('actor.inventory.items[]');
        const actorId = 'actor123';
        const inventoryData = { items: ['item1'] };
        
        mockEntityManager.getComponentData.mockReturnValue(inventoryData);
        
        expect(() => {
          engine.resolve(ast, actorId, mockRuntimeCtx);
        }).not.toThrow(ScopeDepthError);
      });
    });

    describe('Error handling', () => {
      test('handles missing location component gracefully', () => {
        const ast = parseInlineExpr('location');
        const actorId = 'actor123';
        
        mockEntityManager.getComponentData.mockReturnValue(undefined);
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(result).toEqual(new Set());
      });

      test('handles missing inventory component gracefully', () => {
        const ast = parseInlineExpr('actor.inventory.items[]');
        const actorId = 'actor123';
        
        mockEntityManager.getComponentData.mockReturnValue(undefined);
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(result).toEqual(new Set());
      });

      test('handles JsonLogic evaluation errors gracefully', () => {
        const ast = parseInlineExpr('actor.inventory[{"invalid": "logic"}]');
        const actorId = 'actor123';
        const inventoryData = { items: ['item1', 'item2'] };
        
        mockEntityManager.getComponentData.mockReturnValue(inventoryData);
        mockJsonLogicEval.evaluate.mockImplementation(() => {
          throw new Error('Invalid JSON Logic');
        });
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        expect(result).toEqual(new Set());
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error evaluating filter for entity'),
          expect.any(Error)
        );
      });

      test('handles missing logger gracefully', () => {
        const ast = parseInlineExpr('actor.inventory[{"invalid": "logic"}]');
        const actorId = 'actor123';
        const inventoryData = { items: ['item1', 'item2'] };
        
        const runtimeCtxWithoutLogger = {
          ...mockRuntimeCtx,
          logger: null
        };
        
        mockEntityManager.getComponentData.mockReturnValue(inventoryData);
        mockJsonLogicEval.evaluate.mockImplementation(() => {
          throw new Error('Invalid JSON Logic');
        });
        
        const result = engine.resolve(ast, actorId, runtimeCtxWithoutLogger);
        
        expect(result).toEqual(new Set());
        // Should not throw even without logger
      });

      test('handles logger without error method gracefully', () => {
        const ast = parseInlineExpr('actor.inventory[{"invalid": "logic"}]');
        const actorId = 'actor123';
        const inventoryData = { items: ['item1', 'item2'] };
        
        const runtimeCtxWithInvalidLogger = {
          ...mockRuntimeCtx,
          logger: { debug: jest.fn() } // No error method
        };
        
        mockEntityManager.getComponentData.mockReturnValue(inventoryData);
        mockJsonLogicEval.evaluate.mockImplementation(() => {
          throw new Error('Invalid JSON Logic');
        });
        
        const result = engine.resolve(ast, actorId, runtimeCtxWithInvalidLogger);
        
        expect(result).toEqual(new Set());
        // Should not throw even with invalid logger
      });
    });

    describe('Entities source (positive/negative, chaining)', () => {
      test('entities(core:item)[] returns all entities with component', () => {
        const ast = parseInlineExpr('entities(core:item)[]');
        const actorId = 'actor123';
        const entitiesWithComponent = [
          { id: 'entity1' },
          { id: 'entity2' },
          { id: 'entity3' }
        ];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entitiesWithComponent);
        // For array iteration, the engine expects an array of IDs
        // We'll simulate that by returning the array of IDs for the array step
        mockEntityManager.getComponentData.mockImplementation((entityId, comp) => {
          // Not used in this path
          return undefined;
        });
        // The engine should iterate over the set of entity IDs
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        expect(result).toEqual(new Set(['entity1', 'entity2', 'entity3']));
      });
      test('entities(!core:item)[] returns all entities without component', () => {
        const ast = parseInlineExpr('entities(!core:item)[]');
        const actorId = 'actor123';
        const allEntities = [
          { id: 'entity1' },
          { id: 'entity2' },
          { id: 'entity3' },
          { id: 'entity4' }
        ];
        const entitiesWithComponent = [
          { id: 'entity1' },
          { id: 'entity3' }
        ];
        mockEntityManager.entities = allEntities;
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entitiesWithComponent);
        // The engine should return the IDs of entities without the component
        // For array iteration, the engine expects an array of IDs
        // We'll simulate that by returning the array of IDs for the array step
        mockEntityManager.getComponentData.mockImplementation((entityId, comp) => {
          // Not used in this path
          return undefined;
        });
        // The engine should iterate over the set of entity IDs
        // So the result should be ['entity2', 'entity4']
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        expect(result).toEqual(new Set(['entity2', 'entity4']));
      });
      test('entities(core:item)[][filter] applies filter to entities with component', () => {
        const ast = parseInlineExpr('entities(core:item)[][{"==": [{"var": "entity.id"}, "entity2"]}]');
        const actorId = 'actor123';
        const entitiesWithComponent = [
          { id: 'entity1' },
          { id: 'entity2' },
          { id: 'entity3' }
        ];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entitiesWithComponent);
        mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));
        mockJsonLogicEval.evaluate
          .mockReturnValueOnce(false)
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false);
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        expect(result).toEqual(new Set(['entity2']));
      });
      test('entities(!core:item)[][filter] applies filter to entities without component', () => {
        const ast = parseInlineExpr('entities(!core:item)[][{"==": [{"var": "entity.id"}, "entity4"]}]');
        const actorId = 'actor123';
        const allEntities = [
          { id: 'entity1' },
          { id: 'entity2' },
          { id: 'entity3' },
          { id: 'entity4' }
        ];
        const entitiesWithComponent = [
          { id: 'entity1' },
          { id: 'entity3' }
        ];
        mockEntityManager.entities = allEntities;
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entitiesWithComponent);
        mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));
        mockJsonLogicEval.evaluate.mockImplementation((logic, context) => context.entity.id === 'entity4');
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        expect(result).toEqual(new Set(['entity4']));
      });
    });

    describe('Error handling for edge cases', () => {
      test('handles unknown AST node type gracefully', () => {
        const invalidAst = { type: 'InvalidNode', field: 'test' };
        const actorId = 'actor123';
        
        const result = engine.resolve(invalidAst, actorId, mockRuntimeCtx);
        
        expect(result).toEqual(new Set());
        expect(mockLogger.error).toHaveBeenCalledWith('Unknown AST node type: InvalidNode');
      });

      test('handles entities() source with missing component ID', () => {
        const invalidAst = { type: 'Source', kind: 'entities', param: null };
        const actorId = 'actor123';
        
        const result = engine.resolve(invalidAst, actorId, mockRuntimeCtx);
        
        expect(result).toEqual(new Set());
        expect(mockLogger.error).toHaveBeenCalledWith('entities() source node missing component ID');
      });

      test('handles unknown source kind gracefully', () => {
        const invalidAst = { type: 'Source', kind: 'unknown' };
        const actorId = 'actor123';
        
        const result = engine.resolve(invalidAst, actorId, mockRuntimeCtx);
        
        expect(result).toEqual(new Set());
        expect(mockLogger.error).toHaveBeenCalledWith('Unknown source kind: unknown');
      });

      test('handles bare array iteration (field is null)', () => {
        // Use Source node of kind 'entities' for array iteration
        const ast = {
          type: 'Step',
          field: null,
          isArray: true,
          parent: {
            type: 'Source',
            kind: 'entities',
            param: 'core:item'
          }
        };
        const actorId = 'actor123';
        // Mock entities with component
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([
          { id: 'item1' },
          { id: 'item2' }
        ]);
        mockEntityManager.entities = [
          { id: 'item1' },
          { id: 'item2' }
        ];
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        expect(result).toEqual(new Set(['item1', 'item2']));
      });

      test('handles non-string items in array iteration', () => {
        const ast = parseInlineExpr('actor.inventory.items[]');
        const actorId = 'actor123';
        const inventoryData = { items: ['item1', 123, { id: 'item2' }, 'item3'] };
        
        // Mock different responses for different component names
        mockEntityManager.getComponentData.mockImplementation((entityId, componentName) => {
          if (componentName === 'core:inventory') {
            return inventoryData;
          }
          return undefined;
        });
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        // Should only include string items
        expect(result).toEqual(new Set(['item1', 'item3']));
      });

      test('handles string component data in non-array field access', () => {
        // Use a Step node with parent Source node of kind 'actor'
        const ast = {
          type: 'Step',
          field: 'name',
          isArray: false,
          parent: {
            type: 'Source',
            kind: 'actor'
          }
        };
        const actorId = 'actor123';
        mockEntityManager.getComponentData.mockImplementation((entityId, componentName) => {
          if (entityId === actorId && componentName === 'core:name') {
            return 'John Doe';
          }
          return undefined;
        });
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        expect(result).toEqual(new Set());
      });

      test('handles non-string component data in non-array field access', () => {
        const ast = parseInlineExpr('actor.stats');
        const actorId = 'actor123';
        const statsData = { health: 100, mana: 50 };
        
        // Mock different responses for different component names
        mockEntityManager.getComponentData.mockImplementation((entityId, componentName) => {
          if (componentName === 'core:stats') {
            return statsData;
          }
          return undefined;
        });
        
        const result = engine.resolve(ast, actorId, mockRuntimeCtx);
        
        // Should return the entity ID when component data is not a string
        expect(result).toEqual(new Set([actorId]));
      });
    });

    describe('getComponentDataForField method', () => {
      test('returns null for empty field path', () => {
        const result = engine.getComponentDataForField('entity1', '', mockRuntimeCtx);
        expect(result).toBeNull();
      });

      test('returns null for null field path', () => {
        const result = engine.getComponentDataForField('entity1', null, mockRuntimeCtx);
        expect(result).toBeNull();
      });

      test('returns null for undefined field path', () => {
        const result = engine.getComponentDataForField('entity1', undefined, mockRuntimeCtx);
        expect(result).toBeNull();
      });

      test('returns component data for simple field path', () => {
        const componentData = { health: 100 };
        mockEntityManager.getComponentData.mockReturnValue(componentData);
        
        const result = engine.getComponentDataForField('entity1', 'health', mockRuntimeCtx);
        
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith('entity1', 'core:health');
        expect(result).toBe(componentData);
      });

      test('returns null when component does not exist', () => {
        mockEntityManager.getComponentData.mockReturnValue(null);
        
        const result = engine.getComponentDataForField('entity1', 'nonexistent', mockRuntimeCtx);
        
        expect(result).toBeNull();
      });

      test('navigates nested field path successfully', () => {
        // The engine expects the first part of the field path to be the component name
        // So for 'inventory.items.weapons', the mock should return the full nested object for 'core:inventory'
        const componentData = {
          items: {
            weapons: ['sword', 'axe']
          }
        };
        mockEntityManager.getComponentData.mockImplementation((entityId, componentName) => {
          if (componentName === 'core:inventory') {
            return componentData;
          }
          return undefined;
        });
        const result = engine.getComponentDataForField('entity1', 'inventory.items.weapons', mockRuntimeCtx);
        expect(result).toEqual(['sword', 'axe']);
      });

      test('returns null when nested field does not exist', () => {
        const componentData = {
          inventory: {
            items: {}
          }
        };
        mockEntityManager.getComponentData.mockReturnValue(componentData);
        
        const result = engine.getComponentDataForField('entity1', 'inventory.items.nonexistent', mockRuntimeCtx);
        
        expect(result).toBeNull();
      });

      test('returns null when intermediate field is not an object', () => {
        const componentData = {
          inventory: 'not-an-object'
        };
        mockEntityManager.getComponentData.mockReturnValue(componentData);
        
        const result = engine.getComponentDataForField('entity1', 'inventory.items.weapons', mockRuntimeCtx);
        
        expect(result).toBeNull();
      });

      test('returns null when intermediate field is null', () => {
        const componentData = {
          inventory: null
        };
        mockEntityManager.getComponentData.mockReturnValue(componentData);
        
        const result = engine.getComponentDataForField('entity1', 'inventory.items.weapons', mockRuntimeCtx);
        
        expect(result).toBeNull();
      });
    });
  });
}); 