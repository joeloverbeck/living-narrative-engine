// tests/unit/src/scopeDsl/engine.test.js

/**
 * @file Unit tests for Scope-DSL Engine
 * @description Tests for src/scopeDsl/engine.js - AST walker/query engine
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser/parser.js';
import ScopeDepthError from '../../../src/errors/scopeDepthError.js';
import ScopeCycleError from '../../../src/errors/scopeCycleError.js';
import { ParameterValidationError } from '../../../src/scopeDsl/errors/parameterValidationError.js';
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

const mockComponentRegistry = {
  getDefinition: jest.fn(),
};

const mockRuntimeCtx = {
  entityManager: mockEntityManager,
  spatialIndexManager: mockSpatialIndexManager,
  jsonLogicEval: mockJsonLogicEval,
  logger: mockLogger,
  componentRegistry: mockComponentRegistry,
};

describe('ScopeEngine', () => {
  let engine;
  let actorId;
  let actorEntity;
  let mockErrorHandler;

  beforeEach(() => {
    // Create mock error handler for testing
    mockErrorHandler = {
      handleError: jest.fn((error, context, resolver, code) => {
        throw new Error(`[${code}] ${error.message}`);
      }),
      getErrorBuffer: jest.fn(() => []),
    };

    engine = new ScopeEngine({ errorHandler: mockErrorHandler });
    actorId = 'actor123';
    actorEntity = { id: actorId, components: {} };
    jest.clearAllMocks();

    // Reset mock implementations to prevent cross-test pollution
    mockEntityManager.getEntityInstance.mockReset();
    mockEntityManager.getComponentData.mockReset();
    mockJsonLogicEval.evaluate.mockReset();
    mockEntityManager.hasComponent.mockReset();

    // Reset entities array
    mockEntityManager.entities = [];
  });

  describe('setMaxDepth()', () => {
    test('should update maxDepth property', () => {
      const newMaxDepth = 10;
      engine.setMaxDepth(newMaxDepth);
      expect(engine.maxDepth).toBe(newMaxDepth);
    });

    test('should update maxDepth configuration', () => {
      // Set new max depth
      engine.setMaxDepth(8);

      // Verify maxDepth was updated
      expect(engine.maxDepth).toBe(8);
    });

    test('should handle edge cases for max depth values', () => {
      // Test zero
      engine.setMaxDepth(0);
      expect(engine.maxDepth).toBe(0);

      // Test negative value
      engine.setMaxDepth(-5);
      expect(engine.maxDepth).toBe(-5);

      // Test large value
      engine.setMaxDepth(1000);
      expect(engine.maxDepth).toBe(1000);
    });
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

      test('edge can access property on filtered array of objects', () => {
        const ast = parseDslExpression(
          'actor.movement:exits[][{"==": [{"var": "locked"}, false]}].target'
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

        // Mock getEntityInstance for actor entity
        mockEntityManager.getEntityInstance = jest.fn().mockReturnValue({
          id: actorId,
          componentTypeIds: ["movement:exits"],
        });

        // The first step 'actor.movement:exits' resolves to the array of objects.
        mockEntityManager.getComponentData.mockReturnValue(exitsComponentData);

        // The engine doesn't use JSON Logic for this, it just passes the object to the filter.
        // The filter here is just a placeholder; the engine will use the real data.
        // The test's purpose is to see if the `.target` step works correctly *after* the filter.
        // For this test, we can assume the filter works; we are testing the subsequent step.

        // We mock what the filter step would return: a Set of the two unlocked exit objects.
        // To do this, we need to mock the direct data access.
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentName) => {
            if (entityId === actorId && componentName === "movement:exits") {
              // Step 1: actor.movement:exits
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

        // Filter resolver now handles evaluation errors gracefully
        // Items that fail evaluation are simply excluded from results
        const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);
        expect(result).toEqual(new Set()); // No items pass due to evaluation errors
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
      test('throws ScopeDepthError when depth > 6', () => {
        // Set the max depth explicitly for this test
        engine.setMaxDepth(6);

        // We construct the AST manually to bypass the parser's own depth limit,
        // allowing us to unit test the engine's depth limit in isolation.
        // This AST represents an expression like 'actor.a.b.c.d.e.f.g' (7 steps).
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
        const step5 = {
          type: 'Step',
          field: 'e',
          isArray: false,
          parent: step4,
        };
        const step6 = {
          type: 'Step',
          field: 'f',
          isArray: false,
          parent: step5,
        };
        const ast = { type: 'Step', field: 'g', isArray: false, parent: step6 };

        // No mocks are needed as the engine should throw before trying to access data.

        expect(() => {
          engine.resolve(ast, actorEntity, mockRuntimeCtx);
        }).toThrow(ScopeDepthError);

        expect(() => {
          engine.resolve(ast, actorEntity, mockRuntimeCtx);
        }).toThrow('Expression depth limit exceeded (max 6)');
      });

      test('allows depth exactly 6', () => {
        // Set the max depth explicitly for consistency
        engine.setMaxDepth(6);

        // This expression has exactly depth 6
        // Let's use an expression with exactly depth 6
        const ast = parseDslExpression(
          'actor.components.core:inventory.items[].stats.durability'
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentName) => {
            if (entityId === actorId && componentName === 'core:inventory') {
              return { items: ['item1'] };
            }
            if (entityId === 'item1' && componentName === 'stats') {
              return { durability: 100, damage: 50 };
            }
            return undefined;
          }
        );

        expect(() => {
          engine.resolve(ast, actorEntity, mockRuntimeCtx);
        }).not.toThrow(ScopeDepthError);
      });

      test('allows depth exactly 5', () => {
        // Set the max depth explicitly for consistency
        engine.setMaxDepth(6);

        // Test depth 5: actor.components.core:inventory.items[].stats
        const ast = parseDslExpression(
          'actor.components.core:inventory.items[].stats'
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentName) => {
            if (entityId === actorId && componentName === 'core:inventory') {
              return { items: ['item1'] };
            }
            if (entityId === 'item1' && componentName === 'stats') {
              return { durability: 100 };
            }
            return undefined;
          }
        );

        expect(() => {
          engine.resolve(ast, actorEntity, mockRuntimeCtx);
        }).not.toThrow(ScopeDepthError);
      });

      test('allows depth less than 6', () => {
        // Set the max depth explicitly for consistency
        engine.setMaxDepth(6);

        // Test depth 4: actor.components.core:inventory.items[]
        const ast = parseDslExpression(
          'actor.components.core:inventory.items[]'
        );

        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentName) => {
            if (entityId === actorId && componentName === 'core:inventory') {
              return { items: ['item1', 'item2'] };
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

      // Add unique identifier for this test run
      mockTraceContext._testInstanceId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Reset mock implementations that may have been set by previous tests
      mockEntityManager.getEntityInstance.mockReset();
      mockEntityManager.getComponentData.mockReset();
      mockJsonLogicEval.evaluate.mockReset();

      // CRITICAL: Reset getEntity mock that was set in previous test
      if (mockEntityManager.getEntity && mockEntityManager.getEntity.mockReset) {
        mockEntityManager.getEntity.mockReset();
      }
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

      // Mock JSON Logic evaluator to pass only item1
      mockJsonLogicEval.evaluate.mockImplementation((l, context) => {
        const result = context.entity.id === 'item1';
        return result;
      });

      // Mock getEntityInstance to return proper entity structures with components
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        return {
          id,
          components: {}, // Add components property for proper entity structure
        };
      });

      // Mock getEntity - used by trace code in filterResolver
      mockEntityManager.getEntity = jest.fn().mockImplementation((id) => {
        return {
          id,
          componentTypeIds: [],
        };
      });

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

      // Mock getEntityInstance for actor
      mockEntityManager.getEntityInstance = jest
        .fn()
        .mockImplementation((id) => {
          if (id === actorId) {
            return { id: actorId, componentTypeIds: ['exits'] };
          }
          return id === 'loc456' ? { id } : undefined;
        });

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (entityId === actorId && componentId === 'exits') {
            return exitsData;
          }
          return undefined;
        }
      );

      mockJsonLogicEval.evaluate.mockImplementation(
        (l, context) => !context.entity.locked
      );

      const runtimeCtxWithLocation = {
        ...mockRuntimeCtx,
        location: { id: 'loc456' },
      };

      engine.resolve(
        ast,
        actorEntity,
        runtimeCtxWithLocation,
        mockTraceContext
      );

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

  // Test context merging functionality
  describe('Context Merging', () => {
    let engine;
    let mockActorEntity;
    let mockRuntimeCtx;
    let baseCtx;

    beforeEach(() => {
      engine = new ScopeEngine();
      mockActorEntity = { id: 'entity123', definitionId: 'actor' };
      mockRuntimeCtx = {
        entityManager: mockEntityManager,
        jsonLogicEval: mockJsonLogicEval,
        location: { id: 'loc123' },
      };

      baseCtx = {
        actorEntity: mockActorEntity,
        runtimeCtx: mockRuntimeCtx,
        dispatcher: { resolve: jest.fn() },
        cycleDetector: { enter: jest.fn(), leave: jest.fn() },
        depthGuard: { ensure: jest.fn() },
        depth: 1,
        trace: mockTraceContext,
      };
    });

    it('should preserve all base context properties when overlay is null', () => {
      const result = engine.contextMerger.merge(baseCtx, null);

      expect(result).toEqual(baseCtx);
      expect(result.actorEntity).toBe(mockActorEntity);
      expect(result.runtimeCtx).toBe(mockRuntimeCtx);
    });

    it('should preserve critical properties from base when overlay has undefined values', () => {
      const overlayCtx = {
        actorEntity: undefined,
        runtimeCtx: undefined,
        customProp: 'custom-value',
      };

      const result = engine.contextMerger.merge(baseCtx, overlayCtx);

      expect(result.actorEntity).toBe(mockActorEntity);
      expect(result.runtimeCtx).toBe(mockRuntimeCtx);
      expect(result.customProp).toBe('custom-value');
    });

    it('should use overlay properties when they are defined', () => {
      const newActorEntity = { id: 'entity456', definitionId: 'newActor' };
      const newRuntimeCtx = { ...mockRuntimeCtx, location: { id: 'loc456' } };

      const overlayCtx = {
        actorEntity: newActorEntity,
        runtimeCtx: newRuntimeCtx,
        depth: 3,
      };

      const result = engine.contextMerger.merge(baseCtx, overlayCtx);

      expect(result.actorEntity).toBe(newActorEntity);
      expect(result.runtimeCtx).toBe(newRuntimeCtx);
      expect(result.depth).toBe(3);
    });

    it('should handle depth correctly', () => {
      // When overlay has no depth, should use base depth + 1
      const overlayCtx = { customProp: 'value' };
      let result = engine.contextMerger.merge(baseCtx, overlayCtx);
      expect(result.depth).toBe(2); // base.depth (1) + 1

      // When overlay has depth, should use max of overlay depth and base depth + 1
      overlayCtx.depth = 5;
      result = engine.contextMerger.merge(baseCtx, overlayCtx);
      expect(result.depth).toBe(5); // max(5, 1+1)

      overlayCtx.depth = 0;
      result = engine.contextMerger.merge(baseCtx, overlayCtx);
      expect(result.depth).toBe(2); // max(0, 1+1)
    });

    it('should throw error if merged context is missing actorEntity', () => {
      const badBaseCtx = { ...baseCtx, actorEntity: undefined };
      const overlayCtx = { customProp: 'value' };

      expect(() => {
        engine.contextMerger.merge(badBaseCtx, overlayCtx);
      }).toThrow(
        '[CRITICAL] Context is missing required properties: actorEntity'
      );
    });

    it('should throw error if merged context is missing runtimeCtx', () => {
      const badBaseCtx = { ...baseCtx, runtimeCtx: undefined };
      const overlayCtx = { customProp: 'value' };

      expect(() => {
        engine.contextMerger.merge(badBaseCtx, overlayCtx);
      }).toThrow(
        '[CRITICAL] Context is missing required properties: runtimeCtx'
      );
    });

    it('should throw error if merged context is missing dispatcher', () => {
      const badBaseCtx = { ...baseCtx, dispatcher: undefined };
      const overlayCtx = { customProp: 'value' };

      expect(() => {
        engine.contextMerger.merge(badBaseCtx, overlayCtx);
      }).toThrow(
        '[CRITICAL] Context is missing required properties: dispatcher'
      );
    });

    it('should preserve cycleDetector and depthGuard from base context', () => {
      const overlayCtx = {
        cycleDetector: undefined,
        depthGuard: undefined,
      };

      const result = engine.contextMerger.merge(baseCtx, overlayCtx);

      expect(result.cycleDetector).toBe(baseCtx.cycleDetector);
      expect(result.depthGuard).toBe(baseCtx.depthGuard);
    });

    it('should not include critical properties when reducing overlay properties', () => {
      const newDispatcher = { resolve: jest.fn() };
      const overlayCtx = {
        actorEntity: mockActorEntity,
        dispatcher: newDispatcher,
        customProp1: 'value1',
        customProp2: 'value2',
      };

      const result = engine.contextMerger.merge(baseCtx, overlayCtx);

      // Should use overlay's dispatcher since it's defined
      expect(result.dispatcher).toBe(newDispatcher);
      // Should have custom properties
      expect(result.customProp1).toBe('value1');
      expect(result.customProp2).toBe('value2');
    });
  });

  describe('_createEntitiesGateway', () => {
    describe('getItemComponents', () => {
      let entitiesGateway;

      beforeEach(() => {
        entitiesGateway = engine._createEntitiesGateway(mockRuntimeCtx);
        jest.clearAllMocks();
      });

      test('should return components from entity with Map-based components', () => {
        const itemId = 'item123';
        const mockEntity = {
          id: itemId,
          components: new Map([
            ['core:item', { name: 'Sword' }],
            ['core:weapon', { damage: 10 }],
          ]),
        };

        mockEntityManager.getEntity = jest.fn().mockReturnValue(mockEntity);

        const result = entitiesGateway.getItemComponents(itemId);

        expect(result).toEqual({
          'core:item': { name: 'Sword' },
          'core:weapon': { damage: 10 },
        });
      });

      test('should return components from entity with object-based components', () => {
        const itemId = 'item456';
        const mockEntity = {
          id: itemId,
          components: {
            'core:item': { name: 'Shield' },
            'core:armor': { defense: 5 },
          },
        };

        mockEntityManager.getEntity = undefined;
        mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);

        const result = entitiesGateway.getItemComponents(itemId);

        expect(result).toEqual({
          'core:item': { name: 'Shield' },
          'core:armor': { defense: 5 },
        });
      });

      test('should build components from componentTypeIds array', () => {
        const itemId = 'item789';
        const mockEntity = {
          id: itemId,
          componentTypeIds: ['core:item', 'core:clothing'],
          getComponentData: jest.fn((componentId) => {
            if (componentId === 'core:item') return { name: 'Shirt' };
            if (componentId === 'core:clothing') return { slot: 'torso' };
            return null;
          }),
        };

        mockEntityManager.getEntity = jest.fn().mockReturnValue(mockEntity);

        const result = entitiesGateway.getItemComponents(itemId);

        expect(result).toEqual({
          'core:item': { name: 'Shirt' },
          'core:clothing': { slot: 'torso' },
        });
      });

      test('should use entityManager.getComponentData when entity.getComponentData is not available', () => {
        const itemId = 'item999';
        const mockEntity = {
          id: itemId,
          componentTypeIds: ['core:item', 'core:clothing'],
        };

        mockEntityManager.getEntity = jest.fn().mockReturnValue(mockEntity);
        mockEntityManager.getComponentData.mockImplementation(
          (id, componentId) => {
            if (id === itemId && componentId === 'core:item')
              return { name: 'Hat' };
            if (id === itemId && componentId === 'core:clothing')
              return { slot: 'head' };
            return null;
          }
        );

        const result = entitiesGateway.getItemComponents(itemId);

        expect(result).toEqual({
          'core:item': { name: 'Hat' },
          'core:clothing': { slot: 'head' },
        });
      });

      test('should try componentRegistry for item definitions when entity not found', () => {
        const itemId = 'template123';

        mockEntityManager.getEntity = undefined;
        mockEntityManager.getEntityInstance.mockReturnValue(null);

        mockComponentRegistry.getDefinition.mockImplementation((defId) => {
          if (defId === `item:${itemId}`) {
            return { components: { 'core:item': { name: 'Template Item' } } };
          }
          return null;
        });

        const result = entitiesGateway.getItemComponents(itemId);

        expect(result).toEqual({ 'core:item': { name: 'Template Item' } });
        expect(mockComponentRegistry.getDefinition).toHaveBeenCalledWith(
          `item:${itemId}`
        );
      });

      test('should try componentRegistry for clothing definitions when item definition not found', () => {
        const itemId = 'clothing123';

        mockEntityManager.getEntity = undefined;
        mockEntityManager.getEntityInstance.mockReturnValue(null);

        mockComponentRegistry.getDefinition.mockImplementation((defId) => {
          if (defId === `clothing:${itemId}`) {
            return { components: { 'core:clothing': { slot: 'feet' } } };
          }
          return null;
        });

        const result = entitiesGateway.getItemComponents(itemId);

        expect(result).toEqual({ 'core:clothing': { slot: 'feet' } });
        expect(mockComponentRegistry.getDefinition).toHaveBeenCalledWith(
          `item:${itemId}`
        );
        expect(mockComponentRegistry.getDefinition).toHaveBeenCalledWith(
          `clothing:${itemId}`
        );
      });

      test('should return null when no entity or registry definition found', () => {
        const itemId = 'nonexistent';

        mockEntityManager.getEntity = undefined;
        mockEntityManager.getEntityInstance.mockReturnValue(null);
        mockComponentRegistry.getDefinition.mockReturnValue(null);

        const result = entitiesGateway.getItemComponents(itemId);

        expect(result).toBeNull();
      });

      test('should handle when componentRegistry is not available', () => {
        const itemId = 'item_no_registry';
        const runtimeCtxNoRegistry = { ...mockRuntimeCtx };
        delete runtimeCtxNoRegistry.componentRegistry;

        const gatewayNoRegistry =
          engine._createEntitiesGateway(runtimeCtxNoRegistry);

        mockEntityManager.getEntity = undefined;
        mockEntityManager.getEntityInstance.mockReturnValue(null);

        const result = gatewayNoRegistry.getItemComponents(itemId);

        expect(result).toBeNull();
      });

      test('should handle entity with empty components', () => {
        const itemId = 'empty_item';
        const mockEntity = {
          id: itemId,
          components: new Map(),
        };

        mockEntityManager.getEntity = jest.fn().mockReturnValue(mockEntity);

        const result = entitiesGateway.getItemComponents(itemId);

        expect(result).toEqual({});
      });

      test('should handle entity with componentTypeIds but no data', () => {
        const itemId = 'no_data_item';
        const mockEntity = {
          id: itemId,
          componentTypeIds: ['core:item', 'core:missing'],
        };

        mockEntityManager.getEntity = jest.fn().mockReturnValue(mockEntity);
        mockEntityManager.getComponentData.mockReturnValue(null);

        const result = entitiesGateway.getItemComponents(itemId);

        expect(result).toEqual({});
      });
    });
  });

  describe('Dispatcher wrapper in resolve()', () => {
    test('should properly wrap dispatcher and call _resolveWithDepthAndCycleChecking', () => {
      // Spy on the private method
      const resolveWithDepthSpy = jest.spyOn(
        engine,
        '_resolveWithDepthAndCycleChecking'
      );

      // Simple AST that will trigger dispatcher usage
      const ast = parseDslExpression('actor');

      // Execute resolve
      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

      // Verify the method was called with correct parameters
      expect(resolveWithDepthSpy).toHaveBeenCalled();

      // Verify the result
      expect(result).toEqual(new Set([actorId]));

      // Restore the spy
      resolveWithDepthSpy.mockRestore();
    });

    test('should pass dispatcher wrapper through context for nested resolution', () => {
      // Create a more complex AST that requires nested resolution
      const ast = parseDslExpression('actor.core:inventory.items[]');

      const inventoryData = { items: ['item1', 'item2'] };
      mockEntityManager.getComponentData.mockReturnValue(inventoryData);

      // Spy on _resolveWithDepthAndCycleChecking to track calls
      const resolveWithDepthSpy = jest.spyOn(
        engine,
        '_resolveWithDepthAndCycleChecking'
      );

      // Execute resolve
      const result = engine.resolve(ast, actorEntity, mockRuntimeCtx);

      // Should be called multiple times for nested resolution
      expect(resolveWithDepthSpy.mock.calls.length).toBeGreaterThan(1);

      // Verify that the context passed includes a wrapped dispatcher
      const contextArgs = resolveWithDepthSpy.mock.calls.map((call) => call[1]);
      contextArgs.forEach((ctx) => {
        if (ctx.dispatcher) {
          expect(ctx.dispatcher).toHaveProperty('resolve');
          expect(typeof ctx.dispatcher.resolve).toBe('function');
        }
      });

      // Verify the result
      expect(result).toEqual(new Set(['item1', 'item2']));

      // Restore the spy
      resolveWithDepthSpy.mockRestore();
    });

    test('should maintain proper depth tracking through dispatcher wrapper', () => {
      // Create nested AST that will test depth tracking
      const ast = parseDslExpression('actor.core:inventory');

      mockEntityManager.getComponentData.mockReturnValue({ items: [] });

      // Spy on _resolveWithDepthAndCycleChecking
      const resolveWithDepthSpy = jest.spyOn(
        engine,
        '_resolveWithDepthAndCycleChecking'
      );

      // Execute resolve
      engine.resolve(ast, actorEntity, mockRuntimeCtx);

      // Check that depth increases properly in nested calls
      const calls = resolveWithDepthSpy.mock.calls;

      // First call should have depth 0
      expect(calls[0][1].depth).toBe(0);

      // Subsequent calls should have increasing depth
      for (let i = 1; i < calls.length; i++) {
        if (calls[i][1].depth !== undefined) {
          expect(calls[i][1].depth).toBeGreaterThan(0);
        }
      }

      // Restore the spy
      resolveWithDepthSpy.mockRestore();
    });

    test('should execute dispatcher wrapper resolve function for union operations', () => {
      // Create a union AST that will force the dispatcher wrapper to be called
      const ast = {
        type: 'Union',
        left: parseDslExpression('actor'),
        right: parseDslExpression('location'),
      };

      const locationId = 'loc789';
      const runtimeCtxWithLocation = {
        ...mockRuntimeCtx,
        location: { id: locationId },
      };

      // Spy on the private method to verify the wrapper is called
      const resolveWithDepthSpy = jest.spyOn(
        engine,
        '_resolveWithDepthAndCycleChecking'
      );

      // Execute resolve
      const result = engine.resolve(ast, actorEntity, runtimeCtxWithLocation);

      // Verify multiple calls were made (one for each side of the union)
      expect(resolveWithDepthSpy.mock.calls.length).toBeGreaterThanOrEqual(3);

      // Verify the result contains both actor and location
      expect(result).toEqual(new Set([actorId, locationId]));

      // Restore the spy
      resolveWithDepthSpy.mockRestore();
    });
  });

  describe('Clothing Resolver Integration', () => {
    it('should create resolvers with clothing resolvers included', () => {
      const resolvers = engine._createResolvers({
        locationProvider: { getLocation: () => null },
        entitiesGateway: mockEntityManager,
        logicEval: mockJsonLogicEval,
      });

      // Should have 7 resolvers total (2 clothing + 5 original)
      expect(resolvers).toHaveLength(7);

      // Clothing resolvers should be first for priority
      expect(
        resolvers[0].canResolve({ type: 'Step', field: 'topmost_clothing' })
      ).toBe(true);

      // SlotAccessResolver only handles torso_upper when parent is a clothing field
      expect(
        resolvers[1].canResolve({
          type: 'Step',
          field: 'torso_upper',
          parent: { type: 'Step', field: 'topmost_clothing' },
        })
      ).toBe(true);

      // SlotAccessResolver should NOT handle standalone torso_upper
      expect(
        resolvers[1].canResolve({ type: 'Step', field: 'torso_upper' })
      ).toBe(false);
    });

    it('should maintain backward compatibility with existing resolvers', () => {
      const resolvers = engine._createResolvers({
        locationProvider: { getLocation: () => null },
        entitiesGateway: mockEntityManager,
        logicEval: mockJsonLogicEval,
      });

      // Original resolvers should still be present
      const hasSourceResolver = resolvers.some((r) =>
        r.canResolve({ type: 'Source', kind: 'actor' })
      );
      const hasStepResolver = resolvers.some((r) =>
        r.canResolve({ type: 'Step', field: 'regular_field' })
      );
      const hasFilterResolver = resolvers.some((r) =>
        r.canResolve({ type: 'Filter' })
      );
      const hasUnionResolver = resolvers.some((r) =>
        r.canResolve({ type: 'Union' })
      );
      const hasArrayIterationResolver = resolvers.some((r) =>
        r.canResolve({ type: 'ArrayIterationStep' })
      );

      expect(hasSourceResolver).toBe(true);
      expect(hasStepResolver).toBe(true);
      expect(hasFilterResolver).toBe(true);
      expect(hasUnionResolver).toBe(true);
      expect(hasArrayIterationResolver).toBe(true);
    });

    it('should prioritize clothing resolvers over generic step resolver', () => {
      const resolvers = engine._createResolvers({
        locationProvider: { getLocation: () => null },
        entitiesGateway: mockEntityManager,
        logicEval: mockJsonLogicEval,
      });

      // Check that clothing resolvers are at the beginning
      expect(
        resolvers[0].canResolve({ type: 'Step', field: 'topmost_clothing' })
      ).toBe(true);

      // SlotAccessResolver only handles torso_upper with clothing parent
      expect(
        resolvers[1].canResolve({
          type: 'Step',
          field: 'torso_upper',
          parent: { type: 'Step', field: 'topmost_clothing' },
        })
      ).toBe(true);

      // Verify that regular StepResolver handles standalone torso_upper
      // It should be at index 3 (after ClothingStepResolver, SlotAccessResolver, SourceResolver)
      expect(
        resolvers[3].canResolve({ type: 'Step', field: 'torso_upper' })
      ).toBe(true);

      // Verify that regular StepResolver can handle any field
      expect(
        resolvers[3].canResolve({ type: 'Step', field: 'some_random_field' })
      ).toBe(true);
    });
  });

  describe('Parameter Validation', () => {
    let engine;
    let validActorEntity;
    let validRuntimeCtx;
    let validAST;

    beforeEach(() => {
      engine = new ScopeEngine({ maxDepth: 10, spatialIndexManager: mockSpatialIndexManager });

      validActorEntity = {
        id: 'actor-123',
        components: {},
      };

      validRuntimeCtx = {
        entityManager: mockEntityManager,
        jsonLogicEval: mockJsonLogicEval,
        logger: mockLogger,
      };

      validAST = {
        type: 'Source',
        kind: 'actor',
      };
    });

    describe('Invalid AST Tests', () => {
      it('should throw ParameterValidationError for undefined AST', () => {
        expect(() => {
          engine.resolve(undefined, validActorEntity, validRuntimeCtx);
        }).toThrow(ParameterValidationError);

        expect(() => {
          engine.resolve(undefined, validActorEntity, validRuntimeCtx);
        }).toThrow(/ScopeEngine\.resolve.*AST must be an object/);
      });

      it('should throw ParameterValidationError for null AST', () => {
        expect(() => {
          engine.resolve(null, validActorEntity, validRuntimeCtx);
        }).toThrow(ParameterValidationError);

        expect(() => {
          engine.resolve(null, validActorEntity, validRuntimeCtx);
        }).toThrow(/ScopeEngine\.resolve.*AST must be an object/);
      });

      it('should throw ParameterValidationError for AST without type property', () => {
        const invalidAST = { kind: 'actor' }; // Missing 'type'

        expect(() => {
          engine.resolve(invalidAST, validActorEntity, validRuntimeCtx);
        }).toThrow(ParameterValidationError);

        expect(() => {
          engine.resolve(invalidAST, validActorEntity, validRuntimeCtx);
        }).toThrow(/ScopeEngine\.resolve.*AST must have a 'type' property/);
      });
    });

    describe('Invalid actorEntity Tests', () => {
      it('should throw ParameterValidationError for undefined actorEntity', () => {
        expect(() => {
          engine.resolve(validAST, undefined, validRuntimeCtx);
        }).toThrow(ParameterValidationError);

        expect(() => {
          engine.resolve(validAST, undefined, validRuntimeCtx);
        }).toThrow(/ScopeEngine\.resolve.*actorEntity must be an object/);
      });

      it('should throw ParameterValidationError for primitive actorEntity', () => {
        expect(() => {
          engine.resolve(validAST, 'actor-123', validRuntimeCtx);
        }).toThrow(ParameterValidationError);

        expect(() => {
          engine.resolve(validAST, 'actor-123', validRuntimeCtx);
        }).toThrow(/ScopeEngine\.resolve.*actorEntity must be an object/);
      });

      it('should throw ParameterValidationError for object without id', () => {
        const invalidEntity = { components: {} }; // Missing 'id'

        expect(() => {
          engine.resolve(validAST, invalidEntity, validRuntimeCtx);
        }).toThrow(ParameterValidationError);

        expect(() => {
          engine.resolve(validAST, invalidEntity, validRuntimeCtx);
        }).toThrow(/ScopeEngine\.resolve.*actorEntity must have an 'id' property/);
      });

      it('should detect and hint for context object (action pipeline)', () => {
        const contextObject = {
          actor: { id: 'actor-123' },
          targets: { primary: { id: 'target-456' } },
        };

        expect(() => {
          engine.resolve(validAST, contextObject, validRuntimeCtx);
        }).toThrow(ParameterValidationError);

        expect(() => {
          engine.resolve(validAST, contextObject, validRuntimeCtx);
        }).toThrow(/action pipeline context object/);
      });

      it('should detect and hint for context object (scope resolution)', () => {
        const contextObject = {
          runtimeCtx: validRuntimeCtx,
          dispatcher: {},
        };

        expect(() => {
          engine.resolve(validAST, contextObject, validRuntimeCtx);
        }).toThrow(ParameterValidationError);

        expect(() => {
          engine.resolve(validAST, contextObject, validRuntimeCtx);
        }).toThrow(/scope resolution context object/);
      });
    });

    describe('Invalid runtimeCtx Tests', () => {
      it('should throw ParameterValidationError for undefined runtimeCtx', () => {
        expect(() => {
          engine.resolve(validAST, validActorEntity, undefined);
        }).toThrow(ParameterValidationError);

        expect(() => {
          engine.resolve(validAST, validActorEntity, undefined);
        }).toThrow(/ScopeEngine\.resolve.*runtimeCtx must be an object/);
      });

      it('should throw ParameterValidationError for missing entityManager', () => {
        const invalidCtx = {
          jsonLogicEval: mockJsonLogicEval,
          logger: mockLogger,
        };

        expect(() => {
          engine.resolve(validAST, validActorEntity, invalidCtx);
        }).toThrow(ParameterValidationError);

        expect(() => {
          engine.resolve(validAST, validActorEntity, invalidCtx);
        }).toThrow(/ScopeEngine\.resolve.*missing critical services.*entityManager/);
      });

      it('should not throw for missing jsonLogicEval (optional service)', () => {
        const ctxWithoutJsonLogic = {
          entityManager: mockEntityManager,
          logger: mockLogger,
        };

        // Should not throw - jsonLogicEval is optional
        expect(() => {
          engine.resolve(validAST, validActorEntity, ctxWithoutJsonLogic);
        }).not.toThrow(ParameterValidationError);
      });

      it('should not throw for missing logger (optional service)', () => {
        const ctxWithoutLogger = {
          entityManager: mockEntityManager,
          jsonLogicEval: mockJsonLogicEval,
        };

        // Should not throw - logger is optional
        expect(() => {
          engine.resolve(validAST, validActorEntity, ctxWithoutLogger);
        }).not.toThrow(ParameterValidationError);
      });
    });

    describe('Error Message Tests', () => {
      it('should include "ScopeEngine.resolve" in error message', () => {
        expect(() => {
          engine.resolve(null, validActorEntity, validRuntimeCtx);
        }).toThrow(/ScopeEngine\.resolve/);
      });

      it('should throw ParameterValidationError type', () => {
        try {
          engine.resolve(null, validActorEntity, validRuntimeCtx);
          fail('Should have thrown ParameterValidationError');
        } catch (error) {
          expect(error).toBeInstanceOf(ParameterValidationError);
        }
      });

      it('should include context with expected/received information', () => {
        try {
          engine.resolve(null, validActorEntity, validRuntimeCtx);
          fail('Should have thrown ParameterValidationError');
        } catch (error) {
          expect(error.context).toBeDefined();
          expect(error.context.expected).toBeDefined();
          expect(error.context.received).toBeDefined();
        }
      });
    });

    describe('Valid Parameters Test', () => {
      it('should proceed normally with all valid parameters', () => {
        // Mock the entity manager to return a valid set
        mockEntityManager.getEntityInstance.mockReturnValue(validActorEntity);

        const result = engine.resolve(validAST, validActorEntity, validRuntimeCtx);

        // Should return a Set
        expect(result).toBeInstanceOf(Set);
      });
    });
  });
});
