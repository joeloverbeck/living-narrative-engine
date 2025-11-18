/**
 * @file Unit tests for GoapPlanner stopping criteria
 * Tests cost limits, action limits, and feasibility checks
 * @see src/goap/planner/goapPlanner.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';
import { GOAP_PLANNER_FAILURES } from '../../../../src/goap/planner/goapPlannerFailureReasons.js';
import { createTestBed, buildPlanningGoal } from '../../../common/testBed.js';
import { buildPlanningState } from '../../../common/goap/planningStateTestUtils.js';

describe('GoapPlanner - Stopping Criteria', () => {
  let testBed;
  let planner;
  let mockLogger;
  let mockJsonLogicService;
  let mockRepository;
  let mockEntityManager;
  let mockScopeRegistry;
  let mockScopeEngine;
  let mockSpatialIndexManager;
  let mockEffectsSimulator;
  let mockHeuristicRegistry;
  const TEST_ACTOR_ID = 'actor-123';

  const buildState = (fragments = {}) =>
    buildPlanningState(fragments, { actorId: TEST_ACTOR_ID });

  const applyStatePatch = (state, patch = {}) => {
    const nextState = { ...state, ...patch };
    if (nextState.actor?.components) {
      for (const [key, value] of Object.entries(patch)) {
        if (typeof key !== 'string' || !key.includes(':')) {
          continue;
        }
        const [entityId, ...componentParts] = key.split(':');
        const normalizedEntity = entityId === 'actor' ? TEST_ACTOR_ID : entityId;
        if (normalizedEntity !== TEST_ACTOR_ID) {
          continue;
        }
        const componentId = componentParts.join(':');
        nextState.actor.components[componentId] = value;
        nextState.actor.components[componentId.replace(/:/g, '_')] = value;
      }
    }
    return nextState;
  };

  const findWarnPayload = (message) => {
    const entry = mockLogger?.warn?.mock?.calls.find(
      ([logMessage]) => logMessage === message
    );
    return entry ? entry[1] : null;
  };

  const expectStoppingCriteriaLog = (message, matcher = {}) => {
    const payload = findWarnPayload(message);
    expect(payload).toBeDefined();

    const { goalId, maxCost, maxActions, failureStats, ...restMatcher } =
      matcher;

    expect(payload).toMatchObject({
      actorId: TEST_ACTOR_ID,
      goalId: goalId ?? expect.any(String),
      nodesExpanded: expect.any(Number),
      closedSetSize: expect.any(Number),
      maxCost: maxCost ?? expect.any(Number),
      maxActions: maxActions ?? expect.any(Number),
      failureStats:
        failureStats === undefined
          ? expect.objectContaining({})
          : failureStats,
      ...restMatcher,
    });

    return payload;
  };

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockJsonLogicService = testBed.createMock('jsonLogicService', [
      'evaluateCondition',
    ]);
    mockRepository = testBed.createMock('repository', ['get']);
    mockEntityManager = testBed.createMock('entityManager', ['getEntityInstance']);
    mockScopeRegistry = testBed.createMock('scopeRegistry', ['getScopeAst']);
    mockScopeEngine = testBed.createMock('scopeEngine', ['resolve']);
    mockSpatialIndexManager = testBed.createMock('spatialIndexManager', []);
    mockEffectsSimulator = testBed.createMock('effectsSimulator', [
      'simulateEffects',
    ]);
    mockHeuristicRegistry = testBed.createMock('heuristicRegistry', [
      'calculate',
    ]);

    // Default mock implementations
    mockEntityManager.getEntityInstance.mockReturnValue({
      id: TEST_ACTOR_ID,
      components: {},
    });

    // Provide safe default heuristic for any additional calls
    mockHeuristicRegistry.calculate.mockReturnValue(0);

    planner = new GoapPlanner({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicService,
      gameDataRepository: mockRepository,
      entityManager: mockEntityManager,
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      spatialIndexManager: mockSpatialIndexManager,
      planningEffectsSimulator: mockEffectsSimulator,
      heuristicRegistry: mockHeuristicRegistry,
    });
  });

  describe('Cost limit enforcement', () => {
    it('should skip nodes exceeding cost limit', () => {
      // Setup: expensive task (cost = 20)
      mockRepository.get.mockReturnValue({
        core: {
          'core:expensive_task': {
            id: 'core:expensive_task',
            cost: 20,
            planningEffects: [{ op: 'set', path: 'actor:hunger', value: 80 }],
          },
        },
      });

      const initialState = buildState({ 'actor:hunger': 100 });
      const goal = buildPlanningGoal(
        { '==': [{ var: 'actor.hunger' }, 0] },
        {
          id: 'reduce-hunger',
          maxCost: 50, // Cost limit
        }
      );

      // Initial state: goal not satisfied
      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      // Heuristic: scales with hunger so cost-limit check passes but guard stays active
      mockHeuristicRegistry.calculate.mockImplementation((_heuristic, state) => {
        const hunger = state['actor:hunger'];
        return typeof hunger === 'number' ? hunger / 10 : 0;
      });

      mockEffectsSimulator.simulateEffects.mockImplementation((state) => {
        const current = state['actor:hunger'] ?? 0;
        const clampedNext = Math.max(current - 10, 0);
        return {
          success: true,
          state: applyStatePatch(state, { 'actor:hunger': clampedNext }),
        };
      });

      const plan = planner.plan('actor-123', goal, initialState);

      // Should fail because total cost (20 * 6 = 120) exceeds maxCost (50)
      expect(plan).toBeNull();

      expectStoppingCriteriaLog('Goal unsolvable - open list exhausted', {
        goalId: 'reduce-hunger',
        failureCode: GOAP_PLANNER_FAILURES.COST_LIMIT_REACHED,
        maxCost: 50,
        maxActions: 20,
        message: 'Cost limit pruned all remaining nodes',
        failureStats: expect.objectContaining({
          costLimitHit: true,
        }),
      });
    });

    it('should allow plans within cost limit', () => {
      // Setup: cheap task (cost = 10)
      mockRepository.get.mockReturnValue({
        core: {
          'core:cheap_task': {
            id: 'core:cheap_task',
            cost: 10,
            planningEffects: [{ op: 'set', path: 'actor:hunger', value: 0 }],
          },
        },
      });

      const initialState = buildState({ 'actor:hunger': 100 });
      const goal = buildPlanningGoal(
        { '==': [{ var: 'actor.hunger' }, 0] },
        {
          id: 'reduce-hunger',
          maxCost: 50, // Cost limit allows 5 actions at cost 10
        }
      );

      // Initial state check, then goal satisfied after task
      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(false) // Initial
        .mockReturnValueOnce(true); // After task

      mockHeuristicRegistry.calculate.mockImplementation((_heuristic, state) => {
        return state['actor:hunger'] === 0 ? 0 : 10;
      });

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: applyStatePatch(initialState, { 'actor:hunger': 0 }),
      });

      const plan = planner.plan('actor-123', goal, initialState);

      // Should succeed because cost (10) < maxCost (50)
      expect(plan).not.toBeNull();
      expect(plan.cost).toBe(10);
    });

    it('should fail fast when estimated cost exceeds limit', () => {
      // Setup task
      mockRepository.get.mockReturnValue({
        core: {
          'core:task': {
            id: 'core:task',
            cost: 10,
            planningEffects: [],
          },
        },
      });

      const initialState = buildState({ 'actor:hunger': 100 });
      const goal = buildPlanningGoal(
        { '<=': [{ var: 'actor.hunger' }, 0] },
        {
          id: 'reduce-hunger',
          maxCost: 50, // Very low limit
        }
      );

      // Estimated cost = 100 (exceeds limit of 50)
      mockHeuristicRegistry.calculate.mockReturnValue(100);

      const plan = planner.plan('actor-123', goal, initialState);

      // Should fail before A* search
      expect(plan).toBeNull();
      expectStoppingCriteriaLog('Goal estimated cost exceeds limit', {
        goalId: 'reduce-hunger',
        failureCode: GOAP_PLANNER_FAILURES.ESTIMATED_COST_EXCEEDS_LIMIT,
        estimatedCost: 100,
        maxCost: 50,
        maxActions: 20,
        message: 'Estimated planning cost exceeds goal maxCost',
        failureStats: expect.objectContaining({
          costLimitHit: false,
          actionLimitHit: false,
        }),
      });
    });
  });

  describe('Action limit enforcement', () => {
    it('should skip nodes exceeding action limit', () => {
      // Setup: simple task
      mockRepository.get.mockReturnValue({
        core: {
          'core:simple_task': {
            id: 'core:simple_task',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:hunger', value: 90 }],
          },
        },
      });

      const initialState = buildState({ 'actor:hunger': 100 });
      const goal = buildPlanningGoal(
        { '==': [{ var: 'actor.hunger' }, 0] },
        {
          id: 'reduce-hunger',
          maxActions: 5, // Action count limit
        }
      );

      // Never satisfied
      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      // Distance mirrors hunger so tasks reduce numeric goal distance
      mockHeuristicRegistry.calculate.mockImplementation((_heuristic, state) => {
        const hunger = state['actor:hunger'];
        return typeof hunger === 'number' ? hunger : 0;
      });

      mockEffectsSimulator.simulateEffects.mockImplementation((state) => {
        const current = state['actor:hunger'] ?? 0;
        return {
          success: true,
          state: applyStatePatch(state, { 'actor:hunger': Math.max(current - 1, 0) }),
        };
      });

      const plan = planner.plan('actor-123', goal, initialState);

      // Should fail because would need > 5 actions
      expect(plan).toBeNull();

      expectStoppingCriteriaLog('Goal unsolvable - open list exhausted', {
        goalId: 'reduce-hunger',
        failureCode: GOAP_PLANNER_FAILURES.ACTION_LIMIT_REACHED,
        maxActions: 5,
        maxCost: Infinity,
        message: 'Action limit prevented further expansion',
        failureStats: expect.objectContaining({
          actionLimitHit: true,
        }),
      });
    });

    it('should use default limit of 20 when not specified', () => {
      // Setup task that would require > 20 actions
      mockRepository.get.mockReturnValue({
        core: {
          'core:tiny_task': {
            id: 'core:tiny_task',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:hunger', value: 99 }],
          },
        },
      });

      const initialState = buildState({ 'actor:hunger': 100 });
      const goal = buildPlanningGoal(
        { '==': [{ var: 'actor.hunger' }, 0] },
        {
          id: 'reduce-hunger',
          // No maxActions specified - should use default of 20
        }
      );

      // Never satisfied
      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      // Distance mirrors hunger progression to keep guard active
      mockHeuristicRegistry.calculate.mockImplementation((_heuristic, state) => {
        const hunger = state['actor:hunger'];
        return typeof hunger === 'number' ? hunger : 0;
      });

      mockEffectsSimulator.simulateEffects.mockImplementation((state) => {
        const current = state['actor:hunger'] ?? 0;
        return {
          success: true,
          state: applyStatePatch(state, { 'actor:hunger': Math.max(current - 1, 0) }),
        };
      });

      const plan = planner.plan('actor-123', goal, initialState);

      // Should fail with default limit of 20
      expect(plan).toBeNull();

      expectStoppingCriteriaLog('Goal unsolvable - open list exhausted', {
        goalId: 'reduce-hunger',
        failureCode: GOAP_PLANNER_FAILURES.ACTION_LIMIT_REACHED,
        maxActions: 20,
        maxCost: Infinity,
        message: 'Action limit prevented further expansion',
        failureStats: expect.objectContaining({
          actionLimitHit: true,
        }),
      });
    });
  });

  describe('Search exhaustion handling', () => {
    it('should return null when open list exhausted', () => {
      // Setup: task with no effects (can't make progress)
      mockRepository.get.mockReturnValue({
        core: {
          'core:useless_task': {
            id: 'core:useless_task',
            cost: 1,
            planningEffects: [], // No effects
          },
        },
      });

      const initialState = buildState({ 'actor:hunger': 100 });
      const goal = buildPlanningGoal(
        { '<=': [{ var: 'actor.hunger' }, 0] },
        { id: 'reduce-hunger' }
      );

      // Never satisfied
      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      // Distance never reduces (task has no effects)
      mockHeuristicRegistry.calculate.mockReturnValue(100);

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: applyStatePatch(initialState, { 'actor:hunger': 100 }), // No change
      });

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).toBeNull();
    });

    it('should include diagnostic information in failure log', () => {
      // Setup impossible scenario
      mockRepository.get.mockReturnValue({
        core: {
          'core:wrong_direction': {
            id: 'core:wrong_direction',
            cost: 1,
            planningEffects: [
              { op: 'set', path: 'actor:hunger', value: 150 }, // Increases hunger!
            ],
          },
        },
      });

      const initialState = buildState({ 'actor:hunger': 100 });
      const goal = buildPlanningGoal(
        { '<=': [{ var: 'actor.hunger' }, 10] },
        {
          id: 'reduce-hunger',
          maxCost: Infinity,
          maxActions: 10,
        }
      );

      // Never satisfied
      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      // Distance increases (wrong direction)
      mockHeuristicRegistry.calculate.mockImplementation((_heuristic, state) => {
        const hunger = state['actor:hunger'];
        if (hunger >= 150) {
          return 140;
        }
        if (hunger <= 10) {
          return 0;
        }
        return 90;
      });

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: applyStatePatch(initialState, { 'actor:hunger': 150 }),
      });

      const plan = planner.plan('actor-123', goal, initialState);

      expect(plan).toBeNull();

      expectStoppingCriteriaLog('Goal unsolvable - open list exhausted', {
        goalId: 'reduce-hunger',
        maxCost: Infinity,
        maxActions: 10,
        message: 'Distance guard rejected all numeric goal tasks',
        failureCode: GOAP_PLANNER_FAILURES.DISTANCE_GUARD_BLOCKED,
        failureStats: expect.objectContaining({
          numericGuardBlocked: true,
        }),
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle Infinity cost limit (no limit)', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:task': {
            id: 'core:task',
            cost: 1,
            planningEffects: [{ op: 'set', path: 'actor:hunger', value: 0 }],
          },
        },
      });

      const initialState = buildState({ 'actor:hunger': 100 });
      const goal = buildPlanningGoal(
        { '==': [{ var: 'actor.hunger' }, 0] },
        {
          id: 'reduce-hunger',
          maxCost: Infinity, // No limit
        }
      );

      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      mockHeuristicRegistry.calculate.mockImplementation((_heuristic, state) => {
        return state['actor:hunger'] === 0 ? 0 : 1;
      });

      mockEffectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: applyStatePatch(initialState, { 'actor:hunger': 0 }),
      });

      const plan = planner.plan('actor-123', goal, initialState);

      // Should succeed - no cost limit enforced
      expect(plan).not.toBeNull();
    });

    it('should handle zero cost limit (immediately fail)', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:task': {
            id: 'core:task',
            cost: 1,
            planningEffects: [],
          },
        },
      });

      const initialState = buildState({ 'actor:hunger': 100 });
      const goal = buildPlanningGoal(
        { '<=': [{ var: 'actor.hunger' }, 0] },
        {
          id: 'reduce-hunger',
          maxCost: 0, // Zero limit
        }
      );

      // Estimated cost is always > 0
      mockHeuristicRegistry.calculate.mockReturnValue(10);

      const plan = planner.plan('actor-123', goal, initialState);

      // Should immediately fail
      expect(plan).toBeNull();

      expectStoppingCriteriaLog('Goal estimated cost exceeds limit', {
        goalId: 'reduce-hunger',
        failureCode: GOAP_PLANNER_FAILURES.ESTIMATED_COST_EXCEEDS_LIMIT,
        estimatedCost: 10,
        maxCost: 0,
        maxActions: 20,
        message: 'Estimated planning cost exceeds goal maxCost',
        failureStats: expect.objectContaining({
          costLimitHit: false,
          actionLimitHit: false,
        }),
      });
    });
  });
});
