// tests/unit/src/scopeDsl/engine.test.js

/**
 * @file Unit tests for Scope-DSL Engine
 * @description Tests for src/scopeDsl/engine.js - AST walker/query engine
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser.js';
import ScopeDepthError from '../../../src/errors/scopeDepthError.js';
import ScopeCycleError from '../../../src/errors/scopeCycleError.js';
import { createMockSpatialIndexManager } from '../../common/mockFactories/index.js';

// Mock dependencies
const mockEntityManager = {
  getEntityInstance: jest.fn(),
  getEntitiesWithComponent: jest.fn(),
  getEntitiesInLocation: jest.fn(),
  getComponentData: jest.fn(),
  hasComponent: jest.fn(),
  entities: [],
};

const mockSpatialIndexManager = createMockSpatialIndexManager();

const mockJsonLogicEval = {
  evaluate: jest.fn(),
};

const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock TraceContext for instrumentation tests
const mockTraceContext = {
  addLog: jest.fn(),
};

const mockRuntimeCtx = {
  entityManager: mockEntityManager,
  spatialIndexManager: mockSpatialIndexManager,
  jsonLogicEval: mockJsonLogicEval,
  logger: mockLogger,
};

describe('ScopeEngine', () => {
  let engine;
  let actorId;
  let actorEntity;

  beforeEach(() => {
    engine = new ScopeEngine();
    actorId = 'actor123';
    actorEntity = { id: actorId, components: {} };
    jest.clearAllMocks();
    // Reset entities array
    mockEntityManager.entities = [];
  });

  describe('resolve()', () => {
    describe('Source nodes', () => {
      test('actor → Set{actorId}', () => {
        const ast = parseDslExpression('actor');
        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        expect(result).toEqual(new Set([actorId]));
      });

      test('location without param defaults to actor', () => {
        const ast = parseDslExpression('location');
        const locationId = 'loc456';
        const runtimeCtx = { ...mockRuntimeCtx, location: { id: locationId } };
        const result = engine.resolve(ast, actorEntity, runtimeCtx);
        expect(result).toEqual(new Set([locationId]));
      });

      test('entities(ComponentName) → Set of entities with component', () => {
        const ast = parseDslExpression('entities(core:item)');
        const entitiesWithComponent = [
          { id: 'entity1' },
          { id: 'entity2' },
          { id: 'entity3' },
        ];

        mockEntityManager.getEntitiesWithComponent.mockReturnValue(
          entitiesWithComponent
        );

        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

        expect(mockEntityManager.getEntitiesWithComponent).toHaveBeenCalledWith(
          'core:item'
        );
        expect(result).toEqual(new Set(['entity1', 'entity2', 'entity3']));
      });

      test('entities(!ComponentName) → Set of entities without component', () => {
        const ast = parseDslExpression('entities(!core:item)');
        const allEntities = [
          { id: 'entity1' },
          { id: 'entity2' },
          { id: 'entity3' },
          { id: 'entity4' },
        ];
        const entitiesWithComponent = [{ id: 'entity1' }, { id: 'entity3' }];

        mockEntityManager.entities = allEntities;
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(
          entitiesWithComponent
        );

        // Mock hasComponent to return true for entity1 and entity3, false for entity2 and entity4
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentName) => {
            return (
              componentName === 'core:item' &&
              (entityId === 'entity1' || entityId === 'entity3')
            );
          }
        );

        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        expect(result).toEqual(new Set(['entity2', 'entity4']));
      });
    });

    describe('Edge traversal', () => {
      test('edge traverses component field', () => {
        const ast = parseDslExpression('actor.core:inventory');
        const inventoryData = { items: ['item1', 'item2'] };
        mockEntityManager.getComponentData.mockReturnValue(inventoryData);
        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        // The engine returns intermediate objects, which are passed to the next step.
        expect(result).toEqual(new Set([inventoryData]));
      });

      test('edge[] iterates array values', () => {
        const ast = parseDslExpression('entities(core:item)[]');
        const entitiesWithComponent = [
          { id: 'item1' },
          { id: 'item2' },
          { id: 'item3' },
        ];

        mockEntityManager.getEntitiesWithComponent.mockReturnValue(
          entitiesWithComponent
        );

        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        expect(result).toEqual(new Set(['item1', 'item2', 'item3']));
      });

      test('edge[] with non-array field returns empty set', () => {
        const ast = parseDslExpression('actor.core:inventory.items[]');
        const inventoryData = { items: 'not-an-array' };

        mockEntityManager.getComponentData.mockReturnValue(inventoryData);

        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

        expect(result).toEqual(new Set());
      });

      test('edge can access property on filtered array of objects', () => {
        const ast = parseDslExpression(
          'actor.core:exits[][{"==": [{"var": "locked"}, false]}].target'
        );

        const exitsComponentData = [
          {
            target: 'room_unlocked',
            locked: false,
            description: 'An unlocked door.',
          },
          {
            target: 'room_locked',
            locked: true,
            description: 'A locked door.',
          },
          {
            target: 'cellar_unlocked',
            locked: false,
            description: 'An open trapdoor.',
          },
        ];

        // The first step 'actor.core:exits' resolves to the array of objects.
        mockEntityManager.getComponentData.mockReturnValue(exitsComponentData);

        // The engine doesn't use JSON Logic for this, it just passes the object to the filter.
        // The filter here is just a placeholder; the engine will use the real data.
        // The test's purpose is to see if the `.target` step works correctly *after* the filter.
        // For this test, we can assume the filter works; we are testing the subsequent step.

        // We mock what the filter step would return: a Set of the two unlocked exit objects.
        // To do this, we need to mock the direct data access.
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentName) => {
            if (entityId === actorId && componentName === 'core:exits') {
              // Step 1: actor.core:exits
              // This step returns an array of objects, not entity IDs.
              return [
                { target: 'room_unlocked', locked: false },
                { target: 'room_locked', locked: true },
                { target: 'cellar_unlocked', locked: false },
              ];
            }
            // The engine doesn't use getComponentData for the final `.target` step.
            // It operates on the objects already in memory.
            return undefined;
          }
        );

        // Mock the filter evaluation. It will receive each object from the array.
        mockJsonLogicEval.evaluate.mockImplementation((logic, context) => {
          // context.entity will be one of the exit objects in this case.
          return context.entity.locked === false;
        });

        // Since the parent result of the filter is a set of objects, not entity IDs,
        // getEntityInstance will not be called for the final .target step.

        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

        // Assert that the final result is a set of the `target` properties from the unlocked exits.
        expect(result).toEqual(new Set(['room_unlocked', 'cellar_unlocked']));
        expect(mockJsonLogicEval.evaluate).toHaveBeenCalledTimes(3);
      });
    });

    describe('Filter evaluation', () => {
      test('Filter evaluates JsonLogic with entity context', () => {
        const ast = parseDslExpression(
          'entities(core:item)[][{"==": [{"var": "entity.id"}, "item1"]}]'
        );
        const entitiesWithComponent = [
          { id: 'item1' },
          { id: 'item2' },
          { id: 'item3' },
        ];

        mockEntityManager.getEntitiesWithComponent.mockReturnValue(
          entitiesWithComponent
        );
        mockJsonLogicEval.evaluate.mockImplementation(
          (logic, context) => context.entity.id === 'item1'
        );
        mockEntityManager.getEntityInstance.mockImplementation((id) => ({
          id,
        }));

        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        expect(mockJsonLogicEval.evaluate).toHaveBeenCalledTimes(3);
        expect(result).toEqual(new Set(['item1']));
      });

      test('Filter with complex JsonLogic context', () => {
        const ast = parseDslExpression(
          'entities(core:item)[][{"in": [{"var": "entity.id"}, ["entity1", "entity3"]]}]'
        );
        const entitiesWithComponent = [
          { id: 'entity1' },
          { id: 'entity2' },
          { id: 'entity3' },
        ];

        mockEntityManager.getEntitiesWithComponent.mockReturnValue(
          entitiesWithComponent
        );
        mockJsonLogicEval.evaluate.mockImplementation((logic, context) =>
          ['entity1', 'entity3'].includes(context.entity.id)
        );
        mockEntityManager.getEntityInstance.mockImplementation((id) => ({
          id,
        }));

        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        expect(result).toEqual(new Set(['entity1', 'entity3']));
      });

      test('throws JsonLogic evaluation errors immediately (fail-fast)', () => {
        const ast = parseDslExpression(
          'entities(core:item)[][{"invalid": "logic"}]'
        );
        const entitiesWithComponent = [{ id: 'item1' }, { id: 'item2' }];

        mockEntityManager.getEntitiesWithComponent.mockReturnValue(
          entitiesWithComponent
        );

        mockJsonLogicEval.evaluate.mockImplementation(() => {
          throw new Error('Invalid logic');
        });
        mockEntityManager.getEntityInstance.mockImplementation((id) => ({
          id,
        }));

        expect(() => {
          engine.resolve(ast, actorEntity, mockRuntimeCtx);
        }).toThrow('Invalid logic');
      });
    });

    describe('Union operations', () => {
      test('Union A + B returns merged Set', () => {
        const ast = {
          type: 'Union',
          left: parseDslExpression('actor'),
          right: parseDslExpression('entities(core:item)[]'),
        };
        const entitiesWithComponent = [{ id: 'entity1' }, { id: 'entity2' }];

        mockEntityManager.getEntitiesWithComponent.mockReturnValue(
          entitiesWithComponent
        );

        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        expect(result).toEqual(new Set([actorId, 'entity1', 'entity2']));
      });

      test('Union with overlapping entities deduplicates', () => {
        const ast = {
          type: 'Union',
          left: parseDslExpression('actor'),
          right: parseDslExpression('entities(core:item)[]'),
        };
        const entitiesWithComponent = [{ id: actorId }, { id: 'entity3' }];

        mockEntityManager.getEntitiesWithComponent.mockReturnValue(
          entitiesWithComponent
        );

        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        expect(result).toEqual(new Set([actorId, 'entity3']));
      });
    });

    describe('Depth limit enforcement', () => {
      test('throws ScopeDepthError when depth > 4', () => {
        // We construct the AST manually to bypass the parser's own depth limit,
        // allowing us to unit test the engine's depth limit in isolation.
        // This AST represents an expression like 'actor.a.b.c.d.e' (5 steps).
        const source = { type: 'Source', kind: 'actor' };
        const step1 = {
          type: 'Step',
          field: 'a',
          isArray: false,
          parent: source,
        };
        const step2 = {
          type: 'Step',
          field: 'b',
          isArray: false,
          parent: step1,
        };
        const step3 = {
          type: 'Step',
          field: 'c',
          isArray: false,
          parent: step2,
        };
        const step4 = {
          type: 'Step',
          field: 'd',
          isArray: false,
          parent: step3,
        };
        const ast = { type: 'Step', field: 'e', isArray: false, parent: step4 };

        // No mocks are needed as the engine should throw before trying to access data.

        expect(() => {
          engine.resolve(ast, actorEntity, mockRuntimeCtx);
        }).toThrow(ScopeDepthError);

        expect(() => {
          engine.resolve(ast, actorEntity, mockRuntimeCtx);
        }).toThrow('Expression depth limit exceeded (max 4)');
      });

      test('allows depth exactly 4', () => {
        // This expression has 4 steps after the source, which should be allowed.
        const ast = parseDslExpression(
          'actor.core:inventory.items[].components.stats'
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentName) => {
            if (entityId === actorId && componentName === 'core:inventory') {
              return { items: ['item1'] };
            }
            if (entityId === 'item1' && componentName === 'components') {
              return { stats: 'some-stats-object' };
            }
            return undefined;
          }
        );

        expect(() => {
          engine.resolve(ast, actorEntity, mockRuntimeCtx);
        }).not.toThrow(ScopeDepthError);
      });
    });

    describe('Error handling', () => {
      test('handles missing location component gracefully', () => {
        const ast = parseDslExpression('location');

        mockEntityManager.getComponentData.mockReturnValue(undefined);

        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

        expect(result).toEqual(new Set());
      });

      test('handles missing inventory component gracefully', () => {
        const ast = parseDslExpression('actor.core:inventory.items[]');

        mockEntityManager.getComponentData.mockReturnValue(undefined);

        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

        expect(result).toEqual(new Set());
      });

      test('handles non-string items in array iteration', () => {
        const ast = parseDslExpression('entities(core:item)[]');
        const entitiesWithComponent = [
          { id: 'item1' },
          { id: 123 }, // This will be filtered by the `map` in `resolveSource`
          { id: { id: 'item2' } }, // This will be filtered
          { id: 'item3' },
        ];

        mockEntityManager.getEntitiesWithComponent.mockReturnValue(
          entitiesWithComponent
        );

        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        expect(result).toEqual(new Set(['item1', 'item3']));
      });

      test('handles string component data in non-array field access', () => {
        const ast = parseDslExpression('actor.name');

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentName) => {
            if (entityId === actorId && componentName === 'name') {
              return 'John Doe';
            }
            return undefined;
          }
        );

        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        // The engine returns the raw data from the component field.
        expect(result).toEqual(new Set(['John Doe']));
      });
    });

    describe('Entities source (positive/negative, chaining)', () => {
      beforeEach(() => {
        const allEntities = [
          { id: 'entity1', components: { 'core:item': {} } },
          { id: 'entity2', components: {} },
          { id: 'entity3', components: { 'core:item': {} } },
          { id: 'entity4', components: {} },
        ];
        const entitiesWithComponent = [allEntities[0], allEntities[2]];
        mockEntityManager.entities = allEntities;
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(
          entitiesWithComponent
        );
        mockEntityManager.getEntityInstance.mockImplementation((id) =>
          allEntities.find((e) => e.id === id)
        );

        // Mock hasComponent to return true for entity1 and entity3, false for entity2 and entity4
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentName) => {
            return (
              componentName === 'core:item' &&
              (entityId === 'entity1' || entityId === 'entity3')
            );
          }
        );
      });

      test('entities(core:item)[] returns all entities with component', () => {
        const ast = parseDslExpression('entities(core:item)[]');
        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        expect(result).toEqual(new Set(['entity1', 'entity3']));
      });

      test('entities(!core:item)[] returns all entities without component', () => {
        const ast = parseDslExpression('entities(!core:item)[]');
        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        expect(result).toEqual(new Set(['entity2', 'entity4']));
      });

      test('entities(core:item)[][filter] applies filter to entities with component', () => {
        const ast = parseDslExpression(
          'entities(core:item)[][{"==": [{"var": "entity.id"}, "entity1"]}]'
        );
        mockJsonLogicEval.evaluate.mockImplementation(
          (logic, context) => context.entity.id === 'entity1'
        );
        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        expect(result).toEqual(new Set(['entity1']));
      });

      test('entities(!core:item)[][filter] applies filter to entities without component', () => {
        const ast = parseDslExpression(
          'entities(!core:item)[][{"==": [{"var": "entity.id"}, "entity4"]}]'
        );
        mockJsonLogicEval.evaluate.mockImplementation(
          (logic, context) => context.entity.id === 'entity4'
        );
        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        expect(result).toEqual(new Set(['entity4']));
      });
    });

    describe('Cycle detection', () => {
      test('throws ScopeCycleError on direct self-loop', () => {
        const ast = { type: 'Step', field: 'self', parent: null };
        ast.parent = ast; // direct cycle
        expect(() => {
          engine.resolve(ast, actorEntity, mockRuntimeCtx);
        }).toThrow(ScopeCycleError);
      });

      test('throws ScopeCycleError on indirect cycle', () => {
        const nodeA = { type: 'Step', field: 'A', parent: null };
        const nodeB = { type: 'Step', field: 'B', parent: nodeA };
        const nodeC = { type: 'Step', field: 'C', parent: nodeB };
        nodeA.parent = nodeC; // cycle
        expect(() => {
          engine.resolve(nodeC, actorEntity, mockRuntimeCtx);
        }).toThrow(ScopeCycleError);
      });

      test('does not throw on acyclic graph', () => {
        const nodeC = {
          type: 'Step',
          field: 'C',
          parent: { type: 'Source', kind: 'actor' },
        };
        const nodeB = { type: 'Step', field: 'B', parent: nodeC };
        const nodeA = { type: 'Step', field: 'A', parent: nodeB };
        expect(() => {
          engine.resolve(nodeA, actorEntity, mockRuntimeCtx);
        }).not.toThrow(ScopeCycleError);
      });
    });
  });

  // New tests for tracing instrumentation
  describe('Tracing Instrumentation', () => {
    beforeEach(() => {
      // Reset mocks before each test in this suite
      mockTraceContext.addLog.mockClear();
    });

    test('resolve() should log start and end of resolution', () => {
      const ast = parseDslExpression('actor');
      engine.resolve(ast, actorEntity, mockRuntimeCtx, mockTraceContext);

      // Check for start log
      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'step',
        'Starting scope resolution.',
        'ScopeEngine',
        { ast }
      );

      // Check for end log
      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'success',
        'Scope resolution finished. Found 1 target(s).',
        'ScopeEngine',
        { targets: [actorId] }
      );
    });

    test('resolveSource() should log the result of resolving the source node', () => {
      const ast = parseDslExpression('actor');
      engine.resolve(ast, actorEntity, mockRuntimeCtx, mockTraceContext);

      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'info',
        "Resolved source 'actor'. Found 1 item(s).",
        'ScopeEngine.resolveSource',
        {
          kind: 'actor',
          param: undefined,
          result: [actorId],
        }
      );
    });

    test('resolveFilter() should log before and after counts', () => {
      const ast = parseDslExpression(
        'entities(core:item)[][{"==": [{"var": "entity.id"}, "item1"]}]'
      );
      const logic = { '==': [{ var: 'entity.id' }, 'item1'] };
      const entities = [{ id: 'item1' }, { id: 'item2' }];
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockJsonLogicEval.evaluate.mockImplementation(
        (l, context) => context.entity.id === 'item1'
      );
      mockEntityManager.getEntityInstance.mockImplementation((id) => ({ id }));

      engine.resolve(ast, actorEntity, mockRuntimeCtx, mockTraceContext);

      // Check for "before" log
      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'info',
        'Applying filter to 2 items.',
        'ScopeEngine.resolveFilter',
        { logic }
      );

      // Check for "after" log
      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'info',
        'Filter application complete. 1 of 2 items passed.',
        'ScopeEngine.resolveFilter'
      );
    });



    test('should pass trace object through resolveStep and resolveUnion', () => {
      // Union -> Step -> Filter
      const ast = parseDslExpression(
        'actor.exits[][{"==":[{"var":"locked"},false]}] + location'
      );
      const exitsData = [
        { id: 'exit1', locked: false },
        { id: 'exit2', locked: true },
      ];
      const logic = { '==': [{ var: 'locked' }, false] };

      mockEntityManager.getComponentData.mockReturnValue(exitsData);
      mockJsonLogicEval.evaluate.mockImplementation(
        (l, context) => !context.entity.locked
      );
      // For the filter step, `item` is an object, not an entity ID
      mockEntityManager.getEntityInstance.mockImplementation((id) =>
        id === 'loc456' ? { id } : undefined
      );

      const runtimeCtxWithLocation = {
        ...mockRuntimeCtx,
        location: { id: 'loc456' },
      };

      engine.resolve(ast, actorEntity, runtimeCtxWithLocation, mockTraceContext);

      // Verify that the filter inside the step was traced
      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'info',
        'Applying filter to 2 items.',
        'ScopeEngine.resolveFilter',
        { logic }
      );
      expect(mockTraceContext.addLog).toHaveBeenCalledWith(
        'info',
        'Filter application complete. 1 of 2 items passed.',
        'ScopeEngine.resolveFilter'
      );

      // Verify the final result includes items from both sides of the union
      const finalCall = mockTraceContext.addLog.mock.calls.find(
        (call) => call[1] === 'Scope resolution finished. Found 2 target(s).'
      );
      expect(finalCall).not.toBeUndefined();
      // The order in the set can vary, so we check the contents.
      expect(new Set(finalCall[3].targets)).toEqual(
        new Set([exitsData[0], 'loc456'])
      );
    });
  });
});