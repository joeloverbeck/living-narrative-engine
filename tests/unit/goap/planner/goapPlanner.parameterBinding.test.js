/**
 * @file Tests for GOAP parameter binding functionality
 * @see src/goap/planner/goapPlanner.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';

describe('GoapPlanner - Parameter Binding (GOAPIMPL-018-04)', () => {
  let planner;
  let mockLogger;
  let mockJsonLogicService;
  let mockGameDataRepository;
  let mockEntityManager;
  let mockScopeRegistry;
  let mockScopeEngine;
  let mockSpatialIndexManager;
  let mockEffectsSimulator;
  let mockHeuristicRegistry;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      isLogger: () => true,
    };

    // Create mock JSON Logic service
    mockJsonLogicService = {
      evaluateCondition: jest.fn(),
    };

    // Create mock game data repository
    mockGameDataRepository = {
      get: jest.fn(),
    };

    // Create mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
    };

    // Create mock scope registry
    mockScopeRegistry = {
      getScopeAst: jest.fn(),
    };

    // Create mock scope engine
    mockScopeEngine = {
      resolve: jest.fn(),
    };

    // Create mock spatial index manager
    mockSpatialIndexManager = {
      // Minimal - just needs to exist for runtime context
    };

    // Create mock effects simulator
    mockEffectsSimulator = {
      simulateEffects: jest.fn(),
    };

    // Create mock heuristic registry
    mockHeuristicRegistry = {
      calculate: jest.fn(),
    };

    // Create planner instance
    planner = new GoapPlanner({
      logger: mockLogger,
      jsonLogicService: mockJsonLogicService,
      gameDataRepository: mockGameDataRepository,
      entityManager: mockEntityManager,
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      spatialIndexManager: mockSpatialIndexManager,
      effectsSimulator: mockEffectsSimulator,
      heuristicRegistry: mockHeuristicRegistry,
    });
  });

  describe('Constructor Validation', () => {
    it('should validate scopeRegistry dependency has getScopeAst method', () => {
      expect(() => {
        new GoapPlanner({
          logger: mockLogger,
          jsonLogicService: mockJsonLogicService,
          gameDataRepository: mockGameDataRepository,
          entityManager: mockEntityManager,
          scopeRegistry: {}, // Missing getScopeAst
          scopeEngine: mockScopeEngine,
          spatialIndexManager: mockSpatialIndexManager,
      effectsSimulator: mockEffectsSimulator,
      heuristicRegistry: mockHeuristicRegistry,
        });
      }).toThrow();
    });

    it('should validate scopeEngine dependency has resolve method', () => {
      expect(() => {
        new GoapPlanner({
          logger: mockLogger,
          jsonLogicService: mockJsonLogicService,
          gameDataRepository: mockGameDataRepository,
          entityManager: mockEntityManager,
          scopeRegistry: mockScopeRegistry,
          scopeEngine: {}, // Missing resolve
          spatialIndexManager: mockSpatialIndexManager,
      effectsSimulator: mockEffectsSimulator,
      heuristicRegistry: mockHeuristicRegistry,
        });
      }).toThrow();
    });

    it('should validate spatialIndexManager dependency exists', () => {
      expect(() => {
        new GoapPlanner({
          logger: mockLogger,
          jsonLogicService: mockJsonLogicService,
          gameDataRepository: mockGameDataRepository,
          entityManager: mockEntityManager,
          scopeRegistry: mockScopeRegistry,
          scopeEngine: mockScopeEngine,
          spatialIndexManager: null, // Missing
        });
      }).toThrow();
    });

    it('should accept valid dependencies and initialize successfully', () => {
      expect(planner).toBeInstanceOf(GoapPlanner);
      expect(mockLogger.info).toHaveBeenCalledWith('GoapPlanner initialized');
    });
  });

  describe('#bindTaskParameters', () => {
    const actorId = 'actor-123';
    const state = {}; // State not currently used in parameter binding

    it('should return null when task has no planningScope', () => {
      const task = {
        id: 'core:simple_task',
        // No planningScope field
      };

      const result = planner.testBindTaskParameters(task, state, actorId);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('has no planningScope')
      );
    });

    it('should return null when scope definition not found in registry', () => {
      const task = {
        id: 'core:task_with_scope',
        planningScope: 'core:nonexistent_scope',
      };

      mockScopeRegistry.getScopeAst.mockReturnValue(null);

      const result = planner.testBindTaskParameters(task, state, actorId);

      expect(result).toBeNull();
      expect(mockScopeRegistry.getScopeAst).toHaveBeenCalledWith('core:nonexistent_scope');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Planning scope not found'),
        expect.any(Object)
      );
    });

    it('should return null when actor entity not found', () => {
      const task = {
        id: 'core:task_with_scope',
        planningScope: 'core:test_scope',
      };

      const scopeAst = { type: 'scope', value: 'test' };
      mockScopeRegistry.getScopeAst.mockReturnValue(scopeAst);
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const result = planner.testBindTaskParameters(task, state, actorId);

      expect(result).toBeNull();
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(actorId);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Actor entity not found'),
        expect.any(Object)
      );
    });

    it('should return null when scope resolves to empty Set', () => {
      const task = {
        id: 'core:task_with_scope',
        planningScope: 'core:test_scope',
      };

      const scopeAst = { type: 'scope', value: 'test' };
      const actorEntity = { id: actorId, components: {} };

      mockScopeRegistry.getScopeAst.mockReturnValue(scopeAst);
      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockScopeEngine.resolve.mockReturnValue(new Set()); // Empty set

      const result = planner.testBindTaskParameters(task, state, actorId);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No entities in scope'),
        expect.any(Object)
      );
    });

    it('should return null when scope evaluation throws error', () => {
      const task = {
        id: 'core:task_with_scope',
        planningScope: 'core:test_scope',
      };

      const scopeAst = { type: 'scope', value: 'test' };
      const actorEntity = { id: actorId, components: {} };

      mockScopeRegistry.getScopeAst.mockReturnValue(scopeAst);
      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockScopeEngine.resolve.mockImplementation(() => {
        throw new Error('Scope evaluation error');
      });

      const result = planner.testBindTaskParameters(task, state, actorId);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Scope resolution failed'),
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should successfully bind parameters from scope with single entity', () => {
      const task = {
        id: 'core:consume_item',
        planningScope: 'core:edible_items',
      };

      const scopeAst = { type: 'scope', value: 'edible_items' };
      const actorEntity = { id: actorId, components: {} };
      const targetEntityId = 'apple-456';

      mockScopeRegistry.getScopeAst.mockReturnValue(scopeAst);
      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockScopeEngine.resolve.mockReturnValue(new Set([targetEntityId]));

      const result = planner.testBindTaskParameters(task, state, actorId);

      expect(result).toEqual({ target: targetEntityId });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Bound task parameters successfully'),
        expect.objectContaining({
          taskId: task.id,
          scopeId: task.planningScope,
          entityId: targetEntityId,
          totalCandidates: 1,
        })
      );
    });

    it('should use first entity from Set when multiple candidates exist (optimistic strategy)', () => {
      const task = {
        id: 'core:consume_item',
        planningScope: 'core:edible_items',
      };

      const scopeAst = { type: 'scope', value: 'edible_items' };
      const actorEntity = { id: actorId, components: {} };
      const candidates = new Set(['apple-456', 'bread-789', 'water-101']);

      mockScopeRegistry.getScopeAst.mockReturnValue(scopeAst);
      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockScopeEngine.resolve.mockReturnValue(candidates);

      const result = planner.testBindTaskParameters(task, state, actorId);

      expect(result).toBeDefined();
      expect(result.target).toBe('apple-456'); // First entity from Set
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Bound task parameters successfully'),
        expect.objectContaining({
          totalCandidates: 3,
        })
      );
    });

    it('should build correct RuntimeContext with all required properties', () => {
      const task = {
        id: 'core:test_task',
        planningScope: 'core:test_scope',
      };

      const scopeAst = { type: 'scope', value: 'test' };
      const actorEntity = { id: actorId, components: {} };

      mockScopeRegistry.getScopeAst.mockReturnValue(scopeAst);
      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockScopeEngine.resolve.mockReturnValue(new Set(['entity-123']));

      planner.testBindTaskParameters(task, state, actorId);

      // Verify scopeEngine.resolve was called with correct runtime context
      expect(mockScopeEngine.resolve).toHaveBeenCalledWith(
        scopeAst,
        actorEntity,
        expect.objectContaining({
          entityManager: mockEntityManager,
          spatialIndexManager: mockSpatialIndexManager,
          jsonLogicEval: mockJsonLogicService,
          logger: mockLogger,
        }),
        null // trace
      );
    });

    it('should log binding success at debug level with all details', () => {
      const task = {
        id: 'core:test_task',
        planningScope: 'core:test_scope',
      };

      const scopeAst = { type: 'scope', value: 'test' };
      const actorEntity = { id: actorId, components: {} };
      const entityId = 'target-123';

      mockScopeRegistry.getScopeAst.mockReturnValue(scopeAst);
      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
      mockScopeEngine.resolve.mockReturnValue(new Set([entityId]));

      planner.testBindTaskParameters(task, state, actorId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Bound task parameters successfully'),
        expect.objectContaining({
          taskId: task.id,
          scopeId: task.planningScope,
          entityId: entityId,
          totalCandidates: 1,
        })
      );
    });
  });

  describe('#getApplicableTasks', () => {
    const actorId = 'actor-123';
    const state = {};

    beforeEach(() => {
      // Setup common mocks for getApplicableTasks tests
      const actorEntity = { id: actorId, components: {} };
      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);
    });

    it('should return empty array when no tasks provided', () => {
      const result = planner.testGetApplicableTasks([], state, actorId);

      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No tasks provided')
      );
    });

    it('should return empty array when tasks is null', () => {
      const result = planner.testGetApplicableTasks(null, state, actorId);

      expect(result).toEqual([]);
    });

    it('should include tasks without planningScope (no binding needed)', () => {
      const tasks = [
        { id: 'core:rest', description: 'Rest action' },
        { id: 'core:idle', description: 'Idle action' },
      ];

      const result = planner.testGetApplicableTasks(tasks, state, actorId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(tasks[0]);
      expect(result[1]).toEqual(tasks[1]);
      expect(result[0].boundParams).toBeUndefined();
      expect(result[1].boundParams).toBeUndefined();
    });

    it('should exclude tasks that fail parameter binding', () => {
      const tasks = [
        { id: 'core:consume_item', planningScope: 'core:edible_items' },
        { id: 'core:rest' }, // No scope
      ];

      // Setup mocks to fail binding for first task
      const scopeAst = { type: 'scope', value: 'edible_items' };
      mockScopeRegistry.getScopeAst.mockReturnValue(scopeAst);
      mockScopeEngine.resolve.mockReturnValue(new Set()); // Empty - binding fails

      const result = planner.testGetApplicableTasks(tasks, state, actorId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('core:rest');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('excluded - parameter binding failed')
      );
    });

    it('should include tasks with successfully bound parameters', () => {
      const tasks = [
        { id: 'core:consume_item', planningScope: 'core:edible_items' },
        { id: 'core:rest' },
      ];

      // Setup mocks to succeed binding for first task
      const scopeAst = { type: 'scope', value: 'edible_items' };
      const targetId = 'apple-456';
      mockScopeRegistry.getScopeAst.mockReturnValue(scopeAst);
      mockScopeEngine.resolve.mockReturnValue(new Set([targetId]));

      const result = planner.testGetApplicableTasks(tasks, state, actorId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('core:consume_item');
      expect(result[0].boundParams).toEqual({ target: targetId });
      expect(result[1].id).toBe('core:rest');
      expect(result[1].boundParams).toBeUndefined();
    });

    it('should handle mixed success and failure in binding', () => {
      const tasks = [
        { id: 'core:consume_item', planningScope: 'core:edible_items' },
        { id: 'core:pick_weapon', planningScope: 'core:nearby_weapons' },
        { id: 'core:rest' },
      ];

      const edibleAst = { type: 'scope', value: 'edible' };
      const weaponAst = { type: 'scope', value: 'weapon' };

      // First task succeeds, second fails, third has no scope
      mockScopeRegistry.getScopeAst
        .mockReturnValueOnce(edibleAst)
        .mockReturnValueOnce(weaponAst);

      mockScopeEngine.resolve
        .mockReturnValueOnce(new Set(['apple-456'])) // Success
        .mockReturnValueOnce(new Set()); // Failure - empty

      const result = planner.testGetApplicableTasks(tasks, state, actorId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('core:consume_item');
      expect(result[0].boundParams).toEqual({ target: 'apple-456' });
      expect(result[1].id).toBe('core:rest');
    });

    it('should preserve task properties when adding boundParams', () => {
      const tasks = [
        {
          id: 'core:consume_item',
          planningScope: 'core:edible_items',
          description: 'Consume nourishing item',
          cost: 1,
          metadata: { priority: 'high' },
        },
      ];

      const scopeAst = { type: 'scope', value: 'edible' };
      mockScopeRegistry.getScopeAst.mockReturnValue(scopeAst);
      mockScopeEngine.resolve.mockReturnValue(new Set(['apple-456']));

      const result = planner.testGetApplicableTasks(tasks, state, actorId);

      expect(result[0]).toEqual({
        id: 'core:consume_item',
        planningScope: 'core:edible_items',
        description: 'Consume nourishing item',
        cost: 1,
        metadata: { priority: 'high' },
        boundParams: { target: 'apple-456' },
      });
    });

    it('should log summary with total and applicable counts', () => {
      const tasks = [
        { id: 'task1', planningScope: 'scope1' },
        { id: 'task2', planningScope: 'scope2' },
        { id: 'task3' },
      ];

      // First succeeds, second fails, third has no scope
      mockScopeRegistry.getScopeAst.mockReturnValue({ type: 'scope' });
      mockScopeEngine.resolve
        .mockReturnValueOnce(new Set(['entity-1']))
        .mockReturnValueOnce(new Set());

      const result = planner.testGetApplicableTasks(tasks, state, actorId);

      expect(result).toHaveLength(2);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Applicable tasks'),
        expect.objectContaining({
          total: 3,
          applicable: 2,
        })
      );
    });
  });
});
