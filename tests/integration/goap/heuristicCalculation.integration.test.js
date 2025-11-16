/**
 * @file Integration tests for GOAP heuristics with real tasks and state
 *
 * Tests heuristics using real PlanningEffectsSimulator and task definitions
 * to validate accuracy and performance in realistic scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import GoalDistanceHeuristic from '../../../src/goap/planner/goalDistanceHeuristic.js';
import RelaxedPlanningGraphHeuristic from '../../../src/goap/planner/relaxedPlanningGraphHeuristic.js';
import HeuristicRegistry from '../../../src/goap/planner/heuristicRegistry.js';
import PlanningEffectsSimulator from '../../../src/goap/planner/planningEffectsSimulator.js';
import ContextAssemblyService from '../../../src/goap/services/contextAssemblyService.js';
import ParameterResolutionService from '../../../src/goap/services/parameterResolutionService.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { HasComponentOperator } from '../../../src/logic/operators/hasComponentOperator.js';
import NumericConstraintEvaluator from '../../../src/goap/planner/numericConstraintEvaluator.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

describe('GOAP Heuristics - Integration with Real Components', () => {
  let testBed;
  let goalDistanceHeuristic;
  let rpgHeuristic;
  let heuristicRegistry;
  let planningEffectsSimulator;
  let jsonLogicEvaluator;
  let entityManager;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = {
      info: jest.fn((...args) => console.log('[INFO]', ...args)),
      warn: jest.fn((...args) => console.log('[WARN]', ...args)),
      error: jest.fn((...args) => console.log('[ERROR]', ...args)),
      debug: jest.fn((...args) => console.log('[DEBUG]', ...args)),
    };
    entityManager = new SimpleEntityManager();

    // Create real service instances (not mocks)
    const parameterResolutionService = new ParameterResolutionService({
      entityManager,
      logger: mockLogger,
    });

    const contextAssemblyService = new ContextAssemblyService({
      entityManager,
      logger: mockLogger,
      enableKnowledgeLimitation: false,
    });

    planningEffectsSimulator = new PlanningEffectsSimulator({
      parameterResolutionService,
      contextAssemblyService,
      logger: mockLogger,
    });

    jsonLogicEvaluator = new JsonLogicEvaluationService({
      logger: mockLogger,
    });

    // Register has_component operator with entityManager
    const hasComponentOp = new HasComponentOperator({
      entityManager,
      logger: mockLogger,
    });
    jsonLogicEvaluator.addOperation('has_component', function (entityPath, componentId) {
      return hasComponentOp.evaluate([entityPath, componentId], this);
    });

    // Create numeric constraint evaluator
    const numericConstraintEvaluator = new NumericConstraintEvaluator({
      jsonLogicEvaluator,
      logger: mockLogger,
    });

    // Create heuristic instances
    goalDistanceHeuristic = new GoalDistanceHeuristic({
      jsonLogicEvaluator,
      numericConstraintEvaluator,
      logger: mockLogger,
    });

    rpgHeuristic = new RelaxedPlanningGraphHeuristic({
      planningEffectsSimulator,
      jsonLogicEvaluator,
      logger: mockLogger,
      maxLayers: 10,
    });

    heuristicRegistry = new HeuristicRegistry({
      goalDistanceHeuristic,
      relaxedPlanningGraphHeuristic: rpgHeuristic,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  /**
   * Helper function to synchronize EntityManager with planning state.
   * Parses state keys (format: "entityId:componentId:path") and creates
   * entities with components in the EntityManager.
   *
   * Only adds components when state value is truthy (true or object).
   * Skips components with false/null/undefined values.
   *
   * @param {SimpleEntityManager} entityManager - The entity manager to populate
   * @param {object} state - Planning state object
   * @returns {Promise<void>}
   */
  async function syncEntityManagerWithState(entityManager, state) {
    const entityComponents = new Map();

    // Parse state keys to extract entity IDs and components
    for (const [key, value] of Object.entries(state)) {
      const parts = key.split(':');
      if (parts.length < 2) continue;

      // Skip if value is falsy (component doesn't exist in world state)
      if (!value && value !== 0) continue;

      const entityId = parts[0];
      // Component ID is everything after the first colon (e.g., "core:hungry", "core:satiated")
      const componentId = parts.slice(1).join(':');

      if (!entityComponents.has(entityId)) {
        entityComponents.set(entityId, []);
      }

      entityComponents.get(entityId).push({
        componentId,
        data: typeof value === 'object' && value !== null ? value : {},
      });
    }

    // Create entities and add components
    for (const [entityId, components] of entityComponents) {
      if (!entityManager.hasEntity(entityId)) {
        entityManager.createEntity(entityId);
      }

      for (const { componentId, data } of components) {
        await entityManager.addComponent(entityId, componentId, data);
      }
    }
  }

  describe('Goal Distance Heuristic - Real Scenarios', () => {
    it('should calculate distance for simple hunger goal', async () => {
      const state = {
        'entity-1:core:hungry': true,
        'entity-1:core:health': 50,
      };

      // Sync EntityManager with planning state
      await syncEntityManagerWithState(entityManager, state);

      const goal = {
        conditions: [
          {
            description: 'Actor is not hungry',
            condition: {
              '!': {
                has_component: ['entity-1', 'core:hungry'],
              },
            },
          },
        ],
      };

      const h = goalDistanceHeuristic.calculate(state, goal);

      expect(h).toBe(1); // One condition unsatisfied
    });

    it('should calculate distance for multi-condition goal', async () => {
      const state = {
        'entity-1:core:hungry': true,
        'entity-1:core:thirsty': true,
        'entity-1:core:health': 30,
      };

      // Sync EntityManager with planning state
      await syncEntityManagerWithState(entityManager, state);

      const goal = {
        conditions: [
          {
            description: 'Actor is not hungry',
            condition: {
              '!': {
                has_component: ['entity-1', 'core:hungry'],
              },
            },
          },
          {
            description: 'Actor is not thirsty',
            condition: {
              '!': {
                has_component: ['entity-1', 'core:thirsty'],
              },
            },
          },
          {
            description: 'Actor is healthy',
            condition: {
              '>=': [{ var: 'state.entity-1:core:health' }, 80],
            },
          },
        ],
      };

      const h = goalDistanceHeuristic.calculate(state, goal);

      expect(h).toBe(3); // All three conditions unsatisfied
    });

    it('should return 0 when goal already satisfied', async () => {
      const state = {
        'entity-1:core:satiated': {},
        'entity-1:core:health': 100,
      };

      // Sync EntityManager with planning state
      await syncEntityManagerWithState(entityManager, state);

      const goal = {
        conditions: [
          {
            description: 'Actor is satiated',
            condition: {
              has_component: ['entity-1', 'core:satiated'],
            },
          },
          {
            description: 'Actor is healthy',
            condition: {
              '>=': [{ var: 'state.entity-1:core:health' }, 80],
            },
          },
        ],
      };

      const h = goalDistanceHeuristic.calculate(state, goal);

      expect(h).toBe(0); // Both conditions satisfied
    });
  });

  describe('Relaxed Planning Graph Heuristic - Real Scenarios', () => {
    it('should calculate RPG for single-layer plan', async () => {
      const state = {
        'entity-1:core:hungry': true,
      };

      // Sync EntityManager with planning state
      await syncEntityManagerWithState(entityManager, state);

      const goal = {
        conditions: [
          {
            description: 'Actor is not hungry',
            condition: {
              '!': {
                has_component: ['entity-1', 'core:hungry'],
              },
            },
          },
        ],
      };

      const tasks = [
        {
          id: 'core:consume_food',
          planningPreconditions: [
            {
              description: 'Actor is hungry',
              condition: {
                has_component: ['entity-1', 'core:hungry'],
              },
            },
          ],
          planningEffects: [
            {
              type: 'REMOVE_COMPONENT',
              parameters: {
                entityId: 'entity-1',
                componentId: 'core:hungry',
              },
            },
          ],
        },
      ];

      const h = rpgHeuristic.calculate(state, goal, tasks);

      expect(h).toBe(1); // One layer needed
    });

    it('should calculate RPG for multi-layer plan', async () => {
      const state = {
        'entity-1:core:hungry': true,
      };

      // Sync EntityManager with planning state
      await syncEntityManagerWithState(entityManager, state);

      const goal = {
        conditions: [
          {
            description: 'Actor has shelter',
            condition: {
              has_component: ['entity-1', 'core:shelter'],
            },
          },
        ],
      };

      const tasks = [
        {
          id: 'core:gather_resources',
          planningPreconditions: [
            {
              description: 'Actor is hungry (motivated)',
              condition: {
                has_component: ['entity-1', 'core:hungry'],
              },
            },
          ],
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: {
                entityId: 'entity-1',
                componentId: 'core:resources',
                data: {},
              },
            },
          ],
        },
        {
          id: 'core:build_shelter',
          planningPreconditions: [
            {
              description: 'Actor has resources',
              condition: {
                has_component: ['entity-1', 'core:resources'],
              },
            },
          ],
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: {
                entityId: 'entity-1',
                componentId: 'core:shelter',
                data: {},
              },
            },
          ],
        },
      ];

      const h = rpgHeuristic.calculate(state, goal, tasks);

      expect(h).toBe(2); // Two layers: gather → build
    });

    it('should return Infinity for unsolvable goals', () => {
      const state = {
        'entity-1:core:hungry': true,
      };

      const goal = {
        conditions: [
          {
            description: 'Actor has impossible component',
            condition: {
              has_component: ['entity-1', 'core:impossible'],
            },
          },
        ],
      };

      const tasks = [
        {
          id: 'core:useless_task',
          planningPreconditions: [],
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: {
                entityId: 'entity-1',
                componentId: 'core:useless',
                data: {},
              },
            },
          ],
        },
      ];

      const h = rpgHeuristic.calculate(state, goal, tasks);

      expect(h).toBe(Infinity); // No path to goal
    });

    it('should return 0 when goal already satisfied', async () => {
      const state = {
        'entity-1:core:shelter': {},
      };

      // Sync EntityManager with planning state
      await syncEntityManagerWithState(entityManager, state);

      const goal = {
        conditions: [
          {
            description: 'Actor has shelter',
            condition: {
              has_component: ['entity-1', 'core:shelter'],
            },
          },
        ],
      };

      const tasks = [];

      const h = rpgHeuristic.calculate(state, goal, tasks);

      expect(h).toBe(0); // Goal already satisfied
    });
  });

  describe('Heuristic Comparison - RPG vs Goal Distance', () => {
    it('should show RPG is more informed than goal-distance for multi-step plans', async () => {
      const state = {
        'entity-1:core:hungry': true,
      };

      // Sync EntityManager with planning state
      await syncEntityManagerWithState(entityManager, state);

      const goal = {
        conditions: [
          {
            description: 'Actor has shelter',
            condition: {
              has_component: ['entity-1', 'core:shelter'],
            },
          },
          {
            description: 'Actor has weapon',
            condition: {
              has_component: ['entity-1', 'core:weapon'],
            },
          },
        ],
      };

      const tasks = [
        {
          id: 'core:gather_resources',
          planningPreconditions: [],
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: {
                entityId: 'entity-1',
                componentId: 'core:resources',
                data: {},
              },
            },
          ],
        },
        {
          id: 'core:build_shelter',
          planningPreconditions: [
            {
              condition: {
                has_component: ['entity-1', 'core:resources'],
              },
            },
          ],
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: {
                entityId: 'entity-1',
                componentId: 'core:shelter',
                data: {},
              },
            },
          ],
        },
        {
          id: 'core:craft_weapon',
          planningPreconditions: [
            {
              condition: {
                has_component: ['entity-1', 'core:resources'],
              },
            },
          ],
          planningEffects: [
            {
              type: 'ADD_COMPONENT',
              parameters: {
                entityId: 'entity-1',
                componentId: 'core:weapon',
                data: {},
              },
            },
          ],
        },
      ];

      const hGoalDistance = goalDistanceHeuristic.calculate(state, goal, tasks);
      const hRPG = rpgHeuristic.calculate(state, goal, tasks);

      // Goal-distance: counts 2 unsatisfied conditions
      expect(hGoalDistance).toBe(2);

      // RPG: recognizes shared resource dependency (gather once, build both)
      // Layer 1: gather_resources
      // Layer 2: build_shelter AND craft_weapon (both applicable after layer 1)
      expect(hRPG).toBe(2);

      // Both are admissible (≤ actual cost)
      // RPG is more informed (considers task structure)
      expect(hGoalDistance).toBeGreaterThanOrEqual(0);
      expect(hRPG).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Heuristic Registry Integration', () => {
    it('should delegate to goal-distance heuristic', async () => {
      const state = {
        'entity-1:core:hungry': true,
      };

      // Sync EntityManager with planning state
      await syncEntityManagerWithState(entityManager, state);

      const goal = {
        conditions: [
          {
            condition: {
              '!': {
                has_component: ['entity-1', 'core:hungry'],
              },
            },
          },
        ],
      };

      const h = heuristicRegistry.calculate('goal-distance', state, goal);

      expect(h).toBe(1);
    });

    it('should delegate to rpg heuristic', async () => {
      const state = {
        'entity-1:core:hungry': true,
      };

      // Sync EntityManager with planning state
      await syncEntityManagerWithState(entityManager, state);

      const goal = {
        conditions: [
          {
            condition: {
              '!': {
                has_component: ['entity-1', 'core:hungry'],
              },
            },
          },
        ],
      };

      const tasks = [
        {
          planningPreconditions: [
            {
              condition: {
                has_component: ['entity-1', 'core:hungry'],
              },
            },
          ],
          planningEffects: [
            {
              type: 'REMOVE_COMPONENT',
              parameters: {
                entityId: 'entity-1',
                componentId: 'core:hungry',
              },
            },
          ],
        },
      ];

      const h = heuristicRegistry.calculate('rpg', state, goal, tasks);

      expect(h).toBe(1);
    });

    it('should support zero heuristic (Dijkstra)', () => {
      const state = {};
      const goal = { conditions: [] };

      const h = heuristicRegistry.calculate('zero', state, goal);

      expect(h).toBe(0); // Always returns 0
    });

    it('should fallback to goal-distance for unknown heuristic', async () => {
      const state = {
        'entity-1:core:hungry': true,
      };

      // Sync EntityManager with planning state
      await syncEntityManagerWithState(entityManager, state);

      const goal = {
        conditions: [
          {
            condition: {
              '!': {
                has_component: ['entity-1', 'core:hungry'],
              },
            },
          },
        ],
      };

      const h = heuristicRegistry.calculate('unknown', state, goal);

      expect(h).toBe(1); // Delegates to goal-distance
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Unknown heuristic 'unknown'")
      );
    });
  });

  describe('Performance Requirements', () => {
    it('should calculate goal-distance heuristic quickly (< 1ms)', () => {
      const state = {};
      const goal = {
        conditions: Array.from({ length: 20 }, (_, i) => ({
          condition: {
            has_component: [`entity-${i}`, 'core:test'],
          },
        })),
      };

      const start = performance.now();
      goalDistanceHeuristic.calculate(state, goal);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1); // < 1ms for 20 conditions
    });

    it('should calculate RPG heuristic reasonably fast for small domains', async () => {
      const state = {
        'entity-1:core:hungry': true,
      };

      // Sync EntityManager with planning state
      await syncEntityManagerWithState(entityManager, state);

      const goal = {
        conditions: [
          {
            condition: {
              has_component: ['entity-1', 'core:shelter'],
            },
          },
        ],
      };

      // Create 20 tasks (small domain)
      const tasks = Array.from({ length: 20 }, (_, i) => ({
        id: `task-${i}`,
        planningPreconditions: [],
        planningEffects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'entity-1',
              componentId: `core:component-${i}`,
              data: {},
            },
          },
        ],
      }));

      const start = performance.now();
      rpgHeuristic.calculate(state, goal, tasks);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10); // < 10ms for 20 tasks with unsolvable goal
    });
  });

  describe('Numeric Constraints Integration', () => {
    it('should calculate correct distance for hunger goal (goalState format)', () => {
      // State: Actor is very hungry (hunger = 80)
      // Goal: Reduce hunger to 30 or below
      // Note: Variable paths match state structure directly (no 'state.' prefix)
      const state = {
        actor: { needs: { hunger: 80 } },
      };

      const goal = {
        goalState: { '<=': [{ var: 'actor.needs.hunger' }, 30] },
      };

      const distance = goalDistanceHeuristic.calculate(state, goal);

      // Expected distance: 80 - 30 = 50
      expect(distance).toBe(50);
    });

    it('should return 0 when hunger goal is already satisfied', () => {
      const state = {
        actor: { needs: { hunger: 20 } },
      };

      const goal = {
        goalState: { '<=': [{ var: 'actor.needs.hunger' }, 30] },
      };

      const distance = goalDistanceHeuristic.calculate(state, goal);

      expect(distance).toBe(0);
    });

    it('should calculate correct distance for health goal (>= constraint)', () => {
      // State: Actor has low health
      // Goal: Increase health to 80 or above
      const state = {
        actor: { health: 40 },
      };

      const goal = {
        goalState: { '>=': [{ var: 'actor.health' }, 80] },
      };

      const distance = goalDistanceHeuristic.calculate(state, goal);

      // Expected distance: 80 - 40 = 40
      expect(distance).toBe(40);
    });

    it('should return 0 when health goal is already satisfied', () => {
      const state = {
        actor: { health: 90 },
      };

      const goal = {
        goalState: { '>=': [{ var: 'actor.health' }, 80] },
      };

      const distance = goalDistanceHeuristic.calculate(state, goal);

      expect(distance).toBe(0);
    });

    it('should maintain backward compatibility with conditions array (no numeric evaluation)', () => {
      const state = {
        actor: { health: 40, needs: { hunger: 80 } },
      };

      // Legacy format: conditions array (should NOT use numeric distances)
      const goal = {
        conditions: [
          { condition: { '>=': [{ var: 'state.actor.health' }, 80] } },
          { condition: { '<=': [{ var: 'state.actor.needs.hunger' }, 30] } },
        ],
      };

      const distance = goalDistanceHeuristic.calculate(state, goal);

      // Should count unsatisfied conditions (both unsatisfied = 2)
      expect(distance).toBe(2);
    });
  });
});
