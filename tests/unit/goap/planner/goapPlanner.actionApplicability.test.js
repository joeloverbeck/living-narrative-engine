/**
 * @file Tests for GOAP action applicability with numeric goals
 * @see src/goap/planner/goapPlanner.js
 * @see tickets/MODCOMPLASUP-004-goap-planner-action-applicability.md
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';
import { GOAP_PLANNER_FAILURES } from '../../../../src/goap/planner/goapPlannerFailureReasons.js';

describe('GoapPlanner - Action Applicability with Numeric Goals (MODCOMPLASUP-004)', () => {
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
      jsonLogicEvaluationService: mockJsonLogicService,
      gameDataRepository: mockGameDataRepository,
      entityManager: mockEntityManager,
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      spatialIndexManager: mockSpatialIndexManager,
      planningEffectsSimulator: mockEffectsSimulator,
      heuristicRegistry: mockHeuristicRegistry,
    });
  });

  describe('#taskReducesDistance', () => {
    it('should identify task that reduces hunger distance', () => {
      // Current: hunger = 80, Goal: <= 30
      // Task: eat (MODIFY_COMPONENT decrement 60 hunger)
      // Should return true (80 -> 20, reduces distance from 50 to 0)

      const task = {
        id: 'test:eat',
        planningEffects: [
          {
            operation: 'MODIFY_COMPONENT',
            component: 'core:hunger',
            field: 'value',
            modifier: { decrement: 60 },
          },
        ],
        boundParams: {},
      };

      const currentState = {
        'actor-1:core:hunger': 80,
      };

      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor-1.core.hunger' }, 30] },
      };

      // Mock effect simulation - hunger goes from 80 to 20
      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: {
          'actor-1:core:hunger': 20,
        },
      });

      // Mock heuristic calculation
      // Current distance: 80 - 30 = 50 (hunger exceeds goal by 50)
      mockHeuristicRegistry.calculate.mockReturnValueOnce(50);
      // Next distance: 0 (20 <= 30, goal satisfied)
      mockHeuristicRegistry.calculate.mockReturnValueOnce(0);

      const result = planner.testTaskReducesDistance(
        task,
        currentState,
        goal,
        'actor-1'
      );

      expect(result).toBe(true);
      expect(mockEffectsSimulator.simulateEffects).toHaveBeenCalledWith(
        currentState,
        task.planningEffects,
        expect.objectContaining({
          actor: 'actor-1',
          actorId: 'actor-1',
          parameters: {},
        })
      );
      expect(mockHeuristicRegistry.calculate).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Task reduces distance to goal',
        expect.objectContaining({
          taskId: 'test:eat',
          currentDistance: 50,
          nextDistance: 0,
          reduction: 50,
        })
      );
    });

    it('should identify task that reduces health distance', () => {
      // Current: health = 40, Goal: >= 80
      // Task: heal (MODIFY_COMPONENT increment 30 health)
      // Should return true (40 -> 70, reduces distance from 40 to 10)

      const task = {
        id: 'test:heal',
        planningEffects: [
          {
            operation: 'MODIFY_COMPONENT',
            component: 'core:health',
            field: 'value',
            modifier: { increment: 30 },
          },
        ],
        boundParams: {},
      };

      const currentState = {
        'actor-1:core:health': 40,
      };

      const goal = {
        id: 'restore-health',
        goalState: { '>=': [{ var: 'actor-1.core.health' }, 80] },
      };

      // Mock effect simulation - health goes from 40 to 70
      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: {
          'actor-1:core:health': 70,
        },
      });

      // Mock heuristic calculation
      // Current distance: 80 - 40 = 40 (health below goal by 40)
      mockHeuristicRegistry.calculate.mockReturnValueOnce(40);
      // Next distance: 80 - 70 = 10 (health below goal by 10)
      mockHeuristicRegistry.calculate.mockReturnValueOnce(10);

      const result = planner.testTaskReducesDistance(
        task,
        currentState,
        goal,
        'actor-1'
      );

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Task reduces distance to goal',
        expect.objectContaining({
          taskId: 'test:heal',
          reduction: 30,
        })
      );
    });

    it('should reject task that increases distance', () => {
      // Current: hunger = 30, Goal: <= 30
      // Task: exercise (MODIFY_COMPONENT increment 20 hunger)
      // Should return false (30 -> 50, increases distance)

      const task = {
        id: 'test:exercise',
        planningEffects: [
          {
            operation: 'MODIFY_COMPONENT',
            component: 'core:hunger',
            field: 'value',
            modifier: { increment: 20 },
          },
        ],
        boundParams: {},
      };

      const currentState = {
        'actor-1:core:hunger': 30,
      };

      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor-1.core.hunger' }, 30] },
      };

      // Mock effect simulation - hunger goes from 30 to 50
      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: {
          'actor-1:core:hunger': 50,
        },
      });

      // Mock heuristic calculation
      // Current distance: 0 (30 <= 30, already at goal)
      mockHeuristicRegistry.calculate.mockReturnValueOnce(0);
      // Next distance: 50 - 30 = 20 (hunger exceeds goal by 20)
      mockHeuristicRegistry.calculate.mockReturnValueOnce(20);

      const result = planner.testTaskReducesDistance(
        task,
        currentState,
        goal,
        'actor-1'
      );

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Task does not reduce distance',
        expect.objectContaining({
          taskId: 'test:exercise',
          currentDistance: 0,
          nextDistance: 20,
          change: 20,
        })
      );
    });

    it('should reject task with equal distance', () => {
      // Current: hunger = 50, Goal: <= 30
      // Task: drink water (no hunger modification)
      // Should return false (distance unchanged)

      const task = {
        id: 'test:drink_water',
        planningEffects: [], // No effects on hunger
        boundParams: {},
      };

      const currentState = {
        'actor-1:core:hunger': 50,
      };

      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor-1.core.hunger' }, 30] },
      };

      // Mock effect simulation - no change
      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: {
          'actor-1:core:hunger': 50,
        },
      });

      // Mock heuristic calculation - distance stays same
      mockHeuristicRegistry.calculate.mockReturnValueOnce(20);
      mockHeuristicRegistry.calculate.mockReturnValueOnce(20);

      const result = planner.testTaskReducesDistance(
        task,
        currentState,
        goal,
        'actor-1'
      );

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Task does not reduce distance',
        expect.objectContaining({
          currentDistance: 20,
          nextDistance: 20,
          change: 0,
        })
      );
    });

    it('throws when effect simulation reports an invalid effect', () => {
      const task = {
        id: 'test:invalid_action',
        planningEffects: [{ operation: 'INVALID' }],
        boundParams: {},
      };

      const currentState = {
        'actor-1:core:hunger': 50,
      };

      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor-1.core.hunger' }, 30] },
      };

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: false,
        error: 'Invalid operation',
      });

      let thrownError;
      try {
        planner.testTaskReducesDistance(task, currentState, goal, 'actor-1');
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.code).toBe(
        GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION
      );
      expect(thrownError.message).toContain('Invalid operation');
      expect(mockHeuristicRegistry.calculate).not.toHaveBeenCalled();
    });

    it('throws and records telemetry when effect simulation throws', () => {
      const task = {
        id: 'test:invalid_action',
        planningEffects: [{ operation: 'INVALID' }],
        boundParams: {},
      };

      const currentState = {
        'actor-1:core:hunger': 50,
      };

      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor-1.core.hunger' }, 30] },
      };

      const simulationError = new Error('Parameter resolution failed');
      mockEffectsSimulator.simulateEffects.mockImplementation(() => {
        throw simulationError;
      });

      let thrownError;
      try {
        planner.testTaskReducesDistance(task, currentState, goal, 'actor-1');
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.code).toBe(
        GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION
      );
      expect(thrownError.message).toContain('Parameter resolution failed');
      expect(mockHeuristicRegistry.calculate).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();

      const telemetry = planner.getEffectFailureTelemetry('actor-1');
      expect(telemetry).toBeTruthy();
      expect(telemetry.totalFailures).toBe(1);
      expect(telemetry.failures[0]).toEqual(
        expect.objectContaining({
          taskId: 'test:invalid_action',
          goalId: 'reduce-hunger',
          phase: 'distance-check',
          message: 'Parameter resolution failed',
        })
      );
    });

    it('bypasses numeric guard when distance heuristics become non-finite', () => {
      const task = {
        id: 'test:action',
        planningEffects: [],
        boundParams: {},
      };

      const currentState = {};
      const goal = { id: 'test-goal', goalState: {} };

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: {},
      });

      mockHeuristicRegistry.calculate.mockReturnValueOnce(Infinity);
      mockHeuristicRegistry.calculate.mockReturnValueOnce(10);

      const result = planner.testTaskReducesDistance(
        task,
        currentState,
        goal,
        'actor-1'
      );

      expect(result).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Heuristic produced invalid value',
        expect.objectContaining({
          actorId: 'actor-1',
          heuristicId: 'goal-distance',
          phase: 'distance-check:current',
        })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Heuristic distance invalid, bypassing guard',
        expect.objectContaining({
          taskId: 'test:action',
          currentSanitized: true,
        })
      );
    });

    it('recovers when heuristic calculation throws by sanitizing the result', () => {
      const task = {
        id: 'test:action',
        planningEffects: [],
        boundParams: {},
      };

      const currentState = {};
      const goal = { id: 'test-goal', goalState: {} };

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: {},
      });

      mockHeuristicRegistry.calculate.mockImplementation(() => {
        throw new Error('Heuristic calculation failed');
      });

      const result = planner.testTaskReducesDistance(
        task,
        currentState,
        goal,
        'actor-1'
      );

      expect(result).toBe(true);
      const warningCalls = mockLogger.warn.mock.calls.filter(
        ([message]) => message === 'Heuristic produced invalid value'
      );
      expect(warningCalls).toHaveLength(1);
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Heuristic distance invalid, bypassing guard',
        expect.objectContaining({
          taskId: 'test:action',
          goalId: 'test-goal',
        })
      );
    });

    it('should log debug info for distance reduction', () => {
      // Verify logger.debug called with task ID, distances, and reduction

      const task = {
        id: 'test:reduce_hunger',
        planningEffects: [],
        boundParams: { target: 'food-1' },
      };

      const currentState = { 'actor-1:core:hunger': 80 };
      const goal = {
        id: 'stay-fed',
        goalState: { '<=': [{ var: 'actor-1.core.hunger' }, 30] },
      };

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor-1:core:hunger': 20 },
      });

      mockHeuristicRegistry.calculate.mockReturnValueOnce(50);
      mockHeuristicRegistry.calculate.mockReturnValueOnce(0);

      planner.testTaskReducesDistance(task, currentState, goal, 'actor-1');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Task reduces distance to goal',
        {
          taskId: 'test:reduce_hunger',
          goalId: 'stay-fed',
          currentDistance: 50,
          nextDistance: 0,
          reduction: 50,
        }
      );
    });

    it('should include actorId in effectContext', () => {
      // Verify effectContext.actorId is set correctly

      const task = {
        id: 'test:action',
        planningEffects: [],
        boundParams: { target: 'item-1' },
      };

      const currentState = {};
      const goal = { id: 'test-goal', goalState: {} };

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: {},
      });

      mockHeuristicRegistry.calculate.mockReturnValue(10);

      planner.testTaskReducesDistance(task, currentState, goal, 'actor-123');

      expect(mockEffectsSimulator.simulateEffects).toHaveBeenCalledWith(
        currentState,
        task.planningEffects,
        {
          actor: 'actor-123',
          actorId: 'actor-123',
          parameters: { target: 'item-1' },
        }
      );
    });

    it('logs when unexpected errors bubble out of the distance guard', () => {
      const task = {
        id: 'test:distance_guard_failure',
        planningEffects: [],
        boundParams: {},
      };

      const currentState = { 'actor-1:core:hunger': 80 };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor-1.core.hunger' }, 30] },
      };

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor-1:core:hunger': 20 },
      });

      mockHeuristicRegistry.calculate.mockReturnValueOnce(50);
      mockHeuristicRegistry.calculate.mockReturnValueOnce(0);

      mockLogger.debug.mockImplementationOnce(() => {
        throw new Error('logger failure');
      });

      const result = planner.testTaskReducesDistance(
        task,
        currentState,
        goal,
        'actor-1'
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to check distance reduction',
        expect.objectContaining({
          taskId: 'test:distance_guard_failure',
          goalId: 'reduce-hunger',
          error: 'logger failure',
        })
      );
    });
  });

  describe('#getApplicableTasks with goal parameter', () => {
    it('should filter out tasks that do not reduce distance', () => {
      // Task satisfies preconditions but doesn't reduce goal distance
      // Should be excluded from result

      const tasks = [
        {
          id: 'test:no_progress',
          planningPreconditions: [],
          planningEffects: [], // No effects
          boundParams: {},
        },
      ];

      const state = { 'actor-1:core:hunger': 50 };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor-1.core.hunger' }, 30] },
      };

      // Mock simulation - no change
      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor-1:core:hunger': 50 },
      });

      // Mock distance - stays same
      mockHeuristicRegistry.calculate.mockReturnValue(20);

      const result = planner.testGetApplicableTasks(
        tasks,
        state,
        'actor-1',
        goal
      );

      expect(result).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Task test:no_progress excluded - does not reduce distance to goal'
      );
    });

    it('should include tasks that reduce distance', () => {
      // Task satisfies preconditions AND reduces goal distance
      // Should be included in result with boundParams

      const tasks = [
        {
          id: 'test:eat',
          planningPreconditions: [],
          planningEffects: [
            {
              operation: 'MODIFY_COMPONENT',
              component: 'core:hunger',
              modifier: { decrement: 60 },
            },
          ],
        },
      ];

      const state = { 'actor-1:core:hunger': 80 };
      const goal = {
        id: 'reduce-hunger',
        goalState: { '<=': [{ var: 'actor-1.core.hunger' }, 30] },
      };

      // Mock simulation - hunger decreases
      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { 'actor-1:core:hunger': 20 },
      });

      // Mock distance - reduces
      mockHeuristicRegistry.calculate.mockReturnValueOnce(50);
      mockHeuristicRegistry.calculate.mockReturnValueOnce(0);

      const result = planner.testGetApplicableTasks(
        tasks,
        state,
        'actor-1',
        goal
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test:eat');
    });

    it('should still work without goal parameter (backward compatibility)', () => {
      // When goal is null/undefined, skip distance check
      // Should return all tasks with satisfied preconditions

      const tasks = [
        {
          id: 'test:action',
          planningPreconditions: [],
          planningEffects: [],
        },
      ];

      const state = {};

      const result = planner.testGetApplicableTasks(
        tasks,
        state,
        'actor-1',
        null
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test:action');
      // Should not call distance checking
      expect(mockEffectsSimulator.simulateEffects).not.toHaveBeenCalled();
      expect(mockHeuristicRegistry.calculate).not.toHaveBeenCalled();
    });

    it('should check preconditions before distance (optimization)', () => {
      // Task with unsatisfied preconditions
      // Should not call #taskReducesDistance (early return)

      const tasks = [
        {
          id: 'test:blocked',
          planningPreconditions: [
            {
              condition: { '==': [{ var: 'actor.has_item' }, true] },
              description: 'Must have item',
            },
          ],
          planningEffects: [],
        },
      ];

      const state = {};
      const goal = { id: 'test-goal', goalState: {} };

      // Mock precondition evaluation - fails
      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      const result = planner.testGetApplicableTasks(
        tasks,
        state,
        'actor-1',
        goal
      );

      expect(result).toHaveLength(0);
      // Should NOT call distance checking (precondition failed first)
      expect(mockEffectsSimulator.simulateEffects).not.toHaveBeenCalled();
      expect(mockHeuristicRegistry.calculate).not.toHaveBeenCalled();
    });

    it('should NOT apply distance check for non-numeric goals', () => {
      // Goal with component presence/absence (not numeric)
      // Should not apply distance reduction checking

      const tasks = [
        {
          id: 'test:find_food',
          planningPreconditions: [],
          planningEffects: [
            {
              operation: 'ADD_COMPONENT',
              parameters: {
                entity_ref: 'actor',
                component_type: 'test:has_food',
                value: {},
              },
            },
          ],
        },
      ];

      const state = {};
      const goal = {
        id: 'not-hungry',
        goalState: { '!': { has_component: ['actor', 'test:hungry'] } },
      };

      const result = planner.testGetApplicableTasks(
        tasks,
        state,
        'actor-1',
        goal
      );

      // Task should be included (no distance check for non-numeric goals)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test:find_food');
      // Should NOT call distance checking (non-numeric goal)
      expect(mockEffectsSimulator.simulateEffects).not.toHaveBeenCalled();
      expect(mockHeuristicRegistry.calculate).not.toHaveBeenCalled();
    });
  });
});
