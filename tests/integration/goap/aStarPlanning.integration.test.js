/**
 * @file Integration tests for GOAP A* Planner
 * Tests complete planning workflow with real services and self-contained test data
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import GoapPlanner from '../../../src/goap/planner/goapPlanner.js';
import PlanningEffectsSimulator from '../../../src/goap/planner/planningEffectsSimulator.js';
import HeuristicRegistry from '../../../src/goap/planner/heuristicRegistry.js';
import GoalDistanceHeuristic from '../../../src/goap/planner/goalDistanceHeuristic.js';
import RelaxedPlanningGraphHeuristic from '../../../src/goap/planner/relaxedPlanningGraphHeuristic.js';
import NumericConstraintEvaluator from '../../../src/goap/planner/numericConstraintEvaluator.js';
import ContextAssemblyService from '../../../src/goap/services/contextAssemblyService.js';
import ParameterResolutionService from '../../../src/goap/services/parameterResolutionService.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';

describe('GOAP A* Planner - Integration', () => {
  let testBed;
  let planner;
  let entityManager;
  let gameDataRepository;
  let jsonLogicService;
  let scopeRegistry;
  let scopeEngine;
  let spatialIndexManager;
  let effectsSimulator;
  let heuristicRegistry;

  beforeEach(async () => {
    testBed = createTestBed();

    // Create real service instances
    entityManager = new SimpleEntityManager();

    // Mock GameDataRepository with test-only tasks
    gameDataRepository = {
      get: jest.fn((key) => {
        if (key === 'tasks') {
          return {
            test: {
              'test:eat_food': createTestEatFoodTask(),
              'test:find_food': createTestFindFoodTask(),
              'test:rest': createTestRestTask(),
              'test:heal_wound': createTestHealWoundTask(),
            },
          };
        }
        return null;
      }),
    };

    // Create JSON Logic service with wrapper for GOAP compatibility
    const baseJsonLogicService = new JsonLogicEvaluationService({
      logger: testBed.createMockLogger(),
    });

    // Register has_component operator (required for structural gates and planning conditions)
    const { HasComponentOperator } = await import('../../../src/logic/operators/hasComponentOperator.js');
    const hasComponentOp = new HasComponentOperator({
      entityManager,
      logger: testBed.createMockLogger(),
    });
    baseJsonLogicService.addOperation('has_component', function(entityPath, componentId) {
      console.log('[TEST] has_component wrapper called with:', { entityPath, componentId, contextKeys: Object.keys(this || {}) });
      return hasComponentOp.evaluate([entityPath, componentId], this);
    });
    console.log('[TEST] has_component operator registered');

    // Test operator works
    const testResult = baseJsonLogicService.evaluate(
      { has_component: ['test_entity', 'test_comp'] },
      { state: { 'test_entity:test_comp': {} } }
    );
    console.log('[TEST] Operator test result:', testResult);

    // Wrap to provide evaluateCondition method (GOAP expects this method name)
    jsonLogicService = {
      evaluate: (logic, data) => baseJsonLogicService.evaluate(logic, data),
      evaluateCondition: (logic, data) => baseJsonLogicService.evaluate(logic, data),
    };

    // Create scope system
    scopeRegistry = new ScopeRegistry({
      logger: testBed.createMockLogger(),
    });

    // Mock scope registry to return test scopes
    scopeRegistry.getScopeAst = jest.fn((scopeId) => {
      return createTestScopeAst(scopeId);
    });

    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger: testBed.createMockLogger(),
    });

    // Mock spatialIndexManager (REQUIRED by scopeEngine)
    spatialIndexManager = createMockSpatialIndexManager();

    // Create effects simulation stack
    const contextAssembly = new ContextAssemblyService({
      entityManager,
      logger: testBed.createMockLogger(),
    });

    const parameterResolution = new ParameterResolutionService({
      entityManager,
      logger: testBed.createMockLogger(),
    });

    effectsSimulator = new PlanningEffectsSimulator({
      contextAssemblyService: contextAssembly,
      parameterResolutionService: parameterResolution,
      logger: testBed.createMockLogger(),
    });

    // Create heuristic registry
    const numericConstraintEvaluator = new NumericConstraintEvaluator({
      jsonLogicEvaluator: jsonLogicService,
      logger: testBed.createMockLogger(),
      goapEventDispatcher: { dispatch: () => {} },
    });

    const goalDistanceHeuristic = new GoalDistanceHeuristic({
      jsonLogicEvaluator: jsonLogicService,
      numericConstraintEvaluator,
      planningEffectsSimulator: effectsSimulator,
      logger: testBed.createMockLogger(),
    });

    const rpgHeuristic = new RelaxedPlanningGraphHeuristic({
      planningEffectsSimulator: effectsSimulator,
      jsonLogicEvaluator: jsonLogicService,
      logger: testBed.createMockLogger(),
    });

    heuristicRegistry = new HeuristicRegistry({
      goalDistanceHeuristic,
      relaxedPlanningGraphHeuristic: rpgHeuristic,
      logger: testBed.createMockLogger(),
    });

    // Create planner with all dependencies
    planner = new GoapPlanner({
      logger: testBed.createMockLogger(),
      jsonLogicEvaluationService: jsonLogicService,
      gameDataRepository,
      entityManager,
      scopeRegistry,
      scopeEngine,
      spatialIndexManager,
      planningEffectsSimulator: effectsSimulator,
      heuristicRegistry,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  // ========== TEST DATA FACTORIES ==========

  /**
   * Creates a test task for eating food
   * Requires: actor has test:can_eat, test:hungry, and test:has_food
   * Effects: Removes test:hungry component
   */
  function createTestEatFoodTask() {
    return {
      id: 'test:eat_food',
      structuralGates: {
        description: 'Actor can eat',
        condition: { has_component: ['actor', 'test:can_eat'] },
      },
      planningScope: 'test:food_items',
      planningPreconditions: [
        {
          description: 'Actor is hungry',
          condition: { has_component: ['actor', 'test:hungry'] },
        },
        {
          description: 'Actor has found food',
          condition: { has_component: ['actor', 'test:has_food'] },
        },
        {
          description: 'Food item exists',
          condition: { '!!': { var: 'target' } },
        },
      ],
      planningEffects: [
        {
          type: 'REMOVE_COMPONENT',
          parameters: { entity_ref: 'actor', component_type: 'test:hungry' },
        },
      ],
      cost: 5,
      priority: 100,
    };
  }

  /**
   * Creates a test task for finding food
   * Requires: actor has test:can_search
   * Effects: Adds test:has_food component
   */
  function createTestFindFoodTask() {
    return {
      id: 'test:find_food',
      structuralGates: {
        description: 'Can search for food',
        condition: { has_component: ['actor', 'test:can_search'] },
      },
      planningPreconditions: [],
      planningEffects: [
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'test:has_food',
            value: {},
          },
        },
      ],
      cost: 10,
      priority: 50,
    };
  }

  /**
   * Creates a test task for resting
   * Requires: actor has test:tired
   * Effects: Removes test:tired component
   */
  function createTestRestTask() {
    return {
      id: 'test:rest',
      structuralGates: {
        description: 'Can rest',
        condition: { '==': [1, 1] }, // Always true
      },
      planningPreconditions: [
        {
          description: 'Actor is tired',
          condition: { has_component: ['actor', 'test:tired'] },
        },
      ],
      planningEffects: [
        {
          type: 'REMOVE_COMPONENT',
          parameters: { entity_ref: 'actor', component_type: 'test:tired' },
        },
      ],
      cost: 3,
      priority: 80,
    };
  }

  /**
   * Creates a test task for healing wounds
   * Requires: actor has test:can_heal and test:wounded
   * Effects: Removes test:wounded component
   */
  function createTestHealWoundTask() {
    return {
      id: 'test:heal_wound',
      structuralGates: {
        description: 'Can heal',
        condition: { has_component: ['actor', 'test:can_heal'] },
      },
      planningScope: 'test:medical_items',
      planningPreconditions: [
        {
          description: 'Actor is wounded',
          condition: { has_component: ['actor', 'test:wounded'] },
        },
        {
          description: 'Has medical item',
          condition: { '!!': { var: 'target' } },
        },
      ],
      planningEffects: [
        {
          type: 'REMOVE_COMPONENT',
          parameters: { entity_ref: 'actor', component_type: 'test:wounded' },
        },
      ],
      cost: 8,
      priority: 90,
    };
  }

  /**
   * Creates test scope AST for given scope ID
   *
   * @param {string} scopeId - The scope identifier
   * @returns {object | null} Scope AST or null if unknown
   */
  function createTestScopeAst(scopeId) {
    const scopeMap = {
      'test:food_items': (() => {
        const source = { type: 'Source', kind: 'entities', param: 'test:food' };
        const filter = {
          type: 'Filter',
          parent: source,
          logic: { has_component: ['entity', 'test:food'] },
        };
        return filter;
      })(),
      'test:medical_items': (() => {
        const source = { type: 'Source', kind: 'entities', param: 'test:medical' };
        const filter = {
          type: 'Filter',
          parent: source,
          logic: { has_component: ['entity', 'test:medical'] },
        };
        return filter;
      })(),
    };
    return scopeMap[scopeId] || null;
  }

  /**
   * Creates a minimal mock spatial index manager
   *
   * @returns {object} Mock spatial index manager
   */
  function createMockSpatialIndexManager() {
    return {
      getEntitiesInLocation: jest.fn(() => new Set()),
    };
  }

  // ========== TEST SCENARIOS ==========

  describe('Simple goal planning', () => {
    it('should plan single-task path for reducing hunger', () => {
      // Setup: Actor with hunger, ability to eat, and has already found food
      const actorId = 'actor_1';
      entityManager.addEntity({
        id: actorId,
        components: {
          'test:can_eat': {},
          'test:hungry': {},
          'test:has_food': {}, // Actor has already found food
        },
      });

      // Add food entity for the eat_food task to bind to
      const foodItemId = 'food_item_1';
      entityManager.addEntity({
        id: foodItemId,
        components: {
          'test:food': {},
        },
      });

      const goal = {
        id: 'test_goal_not_hungry',
        description: 'Not hungry',
        goalState: { '!': { has_component: [actorId, 'test:hungry'] } },
      };

      const initialState = {
        [`${actorId}:test:can_eat`]: {},
        [`${actorId}:test:hungry`]: {},
        [`${actorId}:test:has_food`]: {}, // Actor has already found food
        [`${foodItemId}:test:food`]: {},
      };

      // Execute
      const plan = planner.plan(actorId, goal, initialState, {
        heuristic: 'goal-distance',
        maxTime: 1000,
      });

      // Verify
      expect(plan).not.toBeNull();
      expect(plan.tasks).toHaveLength(1);
      expect(plan.tasks[0].taskId).toBe('test:eat_food');
      expect(plan.cost).toBeGreaterThan(0);
    });
  });

  describe('Multi-task planning', () => {
    it('should plan multi-step path requiring task chaining', () => {
      const actorId = 'actor_1';
      const foodItemId = 'food_item_1';

      // Actor can search and eat, is hungry
      entityManager.addEntity({
        id: actorId,
        components: {
          'test:can_eat': {},
          'test:can_search': {},
          'test:hungry': {},
        },
      });

      // Food exists in the world but actor doesn't have it yet
      entityManager.addEntity({
        id: foodItemId,
        components: {
          'test:food': {},
        },
      });

      const goal = {
        id: 'test_goal_not_hungry',
        description: 'Not hungry',
        goalState: { '!': { has_component: [actorId, 'test:hungry'] } },
      };

      const initialState = {
        [`${actorId}:test:can_eat`]: {},
        [`${actorId}:test:can_search`]: {},
        [`${actorId}:test:hungry`]: {},
        [`${foodItemId}:test:food`]: {},
        // Note: Actor doesn't have test:has_food yet - needs to find it first
      };

      const plan = planner.plan(actorId, goal, initialState, {
        heuristic: 'relaxed-planning-graph', // Use RPG for multi-step plans
      });

      expect(plan).not.toBeNull();
      expect(plan.tasks.length).toBeGreaterThan(1);

      // Should include find_food then eat_food
      const taskIds = plan.tasks.map((t) => t.taskId);
      expect(taskIds).toContain('test:find_food');
      expect(taskIds).toContain('test:eat_food');

      // find_food should come before eat_food
      const findIndex = taskIds.indexOf('test:find_food');
      const eatIndex = taskIds.indexOf('test:eat_food');
      expect(findIndex).toBeLessThan(eatIndex);

      // eat_food should have bound to the food item
      const eatTask = plan.tasks[eatIndex];
      expect(eatTask.parameters?.target).toBe(foodItemId);
    });
  });

  describe('Plan correctness verification', () => {
    it('should simulate plan execution and satisfy goal', () => {
      const actorId = 'actor_1';
      const foodItemId = 'food_item_1';

      entityManager.addEntity({
        id: actorId,
        components: {
          'test:can_eat': {},
          'test:hungry': {},
          'test:has_food': {}, // Actor has already found food
        },
      });

      entityManager.addEntity({
        id: foodItemId,
        components: {
          'test:food': {},
        },
      });

      const goal = {
        id: 'test_goal_not_hungry',
        description: 'Not hungry',
        goalState: { '!': { has_component: [actorId, 'test:hungry'] } },
      };

      const initialState = {
        [`${actorId}:test:can_eat`]: {},
        [`${actorId}:test:hungry`]: {},
        [`${actorId}:test:has_food`]: {}, // Actor has already found food
        [`${foodItemId}:test:food`]: {},
      };

      const plan = planner.plan(actorId, goal, initialState);

      expect(plan).not.toBeNull();

      // Simulate plan execution by applying effects
      let currentState = JSON.parse(JSON.stringify(initialState));

      // Get task library to look up effects
      const taskLibrary = [createTestEatFoodTask()];

      for (const planTask of plan.tasks) {
        // Look up the full task definition
        const taskDef = taskLibrary.find((t) => t.id === planTask.taskId);
        if (!taskDef || !taskDef.planningEffects) continue;

        // Apply each task's planning effects
        for (const effect of taskDef.planningEffects) {
          // Resolve entity_ref placeholder
          const entityId =
            effect.parameters.entity_ref === 'actor'
              ? actorId
              : effect.parameters.entity_ref;
          const componentKey = `${entityId}:${effect.parameters.component_type}`;

          if (effect.type === 'REMOVE_COMPONENT') {
            delete currentState[componentKey];
          } else if (effect.type === 'ADD_COMPONENT') {
            currentState[componentKey] = effect.parameters.value || {};
          }
        }
      }

      // Build evaluation context for planning mode
      // has_component operator expects context with 'state' property containing flat state
      const context = {
        state: currentState,
      };

      // Verify final state satisfies goal
      const goalSatisfied = jsonLogicService.evaluate(goal.goalState, context);
      expect(goalSatisfied).toBe(true);
    });
  });

  describe('Unsolvable goals', () => {
    it('should return null when goal unreachable', () => {
      const actorId = 'actor_1';
      entityManager.addEntity({
        id: actorId,
        components: {
          'test:hungry': {},
          // Missing test:can_eat capability - can't eat
        },
      });

      const goal = {
        id: 'test_goal_not_hungry',
        description: 'Not hungry',
        goalState: { '!': { has_component: [actorId, 'test:hungry'] } },
      };

      const initialState = {
        [`${actorId}:test:hungry`]: {},
      };

      const plan = planner.plan(actorId, goal, initialState, {
        maxNodes: 100,
      });

      expect(plan).toBeNull();
    });
  });

  describe('Heuristic comparison', () => {
    it('should find valid plans with both heuristics', () => {
      const actorId = 'actor_1';
      const foodItemId = 'food_item_1';

      entityManager.addEntity({
        id: actorId,
        components: {
          'test:can_eat': {},
          'test:hungry': {},
          'test:has_food': {}, // Actor has already found food
        },
      });

      entityManager.addEntity({
        id: foodItemId,
        components: {
          'test:food': {},
        },
      });

      const goal = {
        id: 'test_goal_not_hungry',
        description: 'Not hungry',
        goalState: { '!': { has_component: [actorId, 'test:hungry'] } },
      };

      const initialState = {
        [`${actorId}:test:can_eat`]: {},
        [`${actorId}:test:hungry`]: {},
        [`${actorId}:test:has_food`]: {}, // Actor has already found food
        [`${foodItemId}:test:food`]: {},
      };

      // Plan with goal-distance heuristic
      const plan1 = planner.plan(actorId, goal, initialState, {
        heuristic: 'goal-distance',
      });

      // Plan with relaxed planning graph heuristic
      const plan2 = planner.plan(actorId, goal, initialState, {
        heuristic: 'rpg',
      });

      // Both should find valid plans
      expect(plan1).not.toBeNull();
      expect(plan2).not.toBeNull();
      expect(plan1.tasks.length).toBeGreaterThan(0);
      expect(plan2.tasks.length).toBeGreaterThan(0);

      // Both plans should achieve the same goal
      expect(plan1.tasks[0].taskId).toBe('test:eat_food');
      expect(plan2.tasks[0].taskId).toBe('test:eat_food');
    });
  });

  describe('Parameter binding with scopes', () => {
    it('should bind parameters from scope resolution', () => {
      const actorId = 'actor_1';
      const foodItemId = 'food_item_1';

      entityManager.addEntity({
        id: actorId,
        components: {
          'test:can_eat': {},
          'test:hungry': {},
          'test:has_food': {}, // Actor has already found food
        },
      });

      entityManager.addEntity({
        id: foodItemId,
        components: {
          'test:food': { nutrition: 10 },
        },
      });

      // Mock scope resolution to return our food item
      scopeEngine.resolve = jest.fn(() => new Set([foodItemId]));

      const goal = {
        id: 'test_goal_not_hungry',
        description: 'Not hungry',
        goalState: { '!': { has_component: [actorId, 'test:hungry'] } },
      };

      const initialState = {
        [`${actorId}:test:can_eat`]: {},
        [`${actorId}:test:hungry`]: {},
        [`${actorId}:test:has_food`]: {}, // Actor has already found food
        [`${foodItemId}:test:food`]: { nutrition: 10 },
      };

      const plan = planner.plan(actorId, goal, initialState);

      expect(plan).not.toBeNull();
      expect(plan.tasks.length).toBeGreaterThan(0);
      expect(plan.tasks[0].parameters).toBeDefined();
      expect(plan.tasks[0].parameters.target).toBe(foodItemId);
    });
  });

  describe('Performance benchmarks', () => {
    it('should plan within time limit for complex goals', () => {
      const actorId = 'actor_1';
      const foodItemId = 'food_item_1';
      const medkitId = 'medkit_1';

      entityManager.addEntity({
        id: actorId,
        components: {
          'test:can_eat': {},
          'test:can_heal': {},
          'test:hungry': {},
          'test:wounded': {},
          'test:has_food': {}, // Actor has already found food
        },
      });

      entityManager.addEntity({
        id: foodItemId,
        components: {
          'test:food': {},
        },
      });

      entityManager.addEntity({
        id: medkitId,
        components: {
          'test:medical': {},
        },
      });

      const goal = {
        id: 'test_goal_healthy',
        description: 'Healthy',
        goalState: {
          and: [
            { '!': { has_component: [actorId, 'test:hungry'] } },
            { '!': { has_component: [actorId, 'test:wounded'] } },
          ],
        },
      };

      const initialState = {
        [`${actorId}:test:can_eat`]: {},
        [`${actorId}:test:can_heal`]: {},
        [`${actorId}:test:hungry`]: {},
        [`${actorId}:test:wounded`]: {},
        [`${actorId}:test:has_food`]: {}, // Actor has already found food
        [`${foodItemId}:test:food`]: {},
        [`${medkitId}:test:medical`]: {},
      };

      const startTime = Date.now();
      const plan = planner.plan(actorId, goal, initialState, {
        maxTime: 2000,
        heuristic: 'relaxed-planning-graph', // Use RPG for complex multi-step goals
      });
      const elapsed = Date.now() - startTime;

      expect(plan).not.toBeNull();
      expect(elapsed).toBeLessThan(2000);
      expect(plan.tasks.length).toBeGreaterThan(0);
    });

    it('should explore reasonable number of nodes for simple goal', () => {
      const actorId = 'actor_1';
      const foodItemId = 'food_item_1';

      entityManager.addEntity({
        id: actorId,
        components: {
          'test:can_eat': {},
          'test:hungry': {},
          'test:has_food': {}, // Actor has already found food
        },
      });

      entityManager.addEntity({
        id: foodItemId,
        components: {
          'test:food': {},
        },
      });

      const goal = {
        id: 'test_goal_not_hungry',
        description: 'Not hungry',
        goalState: { '!': { has_component: [actorId, 'test:hungry'] } },
      };

      const initialState = {
        [`${actorId}:test:can_eat`]: {},
        [`${actorId}:test:hungry`]: {},
        [`${actorId}:test:has_food`]: {}, // Actor has already found food
        [`${foodItemId}:test:food`]: {},
      };

      const plan = planner.plan(actorId, goal, initialState);

      expect(plan).not.toBeNull();
      // For simple single-task goals, should explore minimal nodes
      // Exact count depends on implementation, but should be reasonable
      expect(plan.nodesExplored).toBeLessThan(100);
    });
  });
});
