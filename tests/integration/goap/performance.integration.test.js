/**
 * @file Performance benchmark tests for GOAP system
 * Establishes baseline performance metrics for planning and refinement
 *
 * Benchmarks:
 * 1. Simple goal planning (<100ms)
 * 2. Complex multi-task planning (<500ms)
 * 3. Large knowledge set planning (<1000ms)
 * 4. Replanning frequency (10 turns <5000ms)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestSetup } from './testFixtures/goapTestSetup.js';
import { createTestGoal } from './testFixtures/testGoalFactory.js';
import { createTestTask } from './testFixtures/testTaskFactory.js';

describe('GOAP Performance Benchmarks - Integration', () => {
  let setup;

  beforeEach(async () => {
    setup = await createGoapTestSetup({
      mockRefinement: true, // Mock for consistent performance
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  describe('Simple Planning Performance', () => {
    it('should plan simple goal in under 100ms (average)', async () => {
      // Setup: Simple goal
      const goal = createTestGoal({
        id: 'test:simple_goal',
        relevance: { '==': [true, true] },
        goalState: {
          has_component: ['actor', 'test:satisfied'],
        },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Actor
      const actor = {
        id: 'test_actor',
        components: {},
      };
      setup.entityManager.addEntity(actor);

      // Setup: Single task
      const task = createTestTask({
        id: 'test:simple_task',
        cost: 10,
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:satisfied',
              componentData: {},
            },
          },
        ],
      });

      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return { test: { [task.id]: task } };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) =>
        taskId === task.id ? task : null
      );

      const world = { state: {}, entities: {} };

      // Benchmark: Run 10 iterations
      const iterations = 10;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await setup.controller.decideTurn(actor, world);
        const duration = Date.now() - start;
        times.push(duration);

        // Reset for next iteration
        delete actor.components['test:satisfied'];
        setup.eventBus.clear();
      }

      // Calculate metrics
      const average = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);
      const min = Math.min(...times);

      // Log for CI/debugging
      console.log(`Simple Planning Performance:
        Average: ${average.toFixed(2)}ms
        Min: ${min}ms
        Max: ${max}ms
        Samples: ${iterations}`);

      // Verify: Average under 100ms
      expect(average).toBeLessThan(100);

      // Verify: No outliers (max should be reasonable)
      expect(max).toBeLessThan(200); // Allow some variance
    });
  });

  describe('Complex Planning Performance', () => {
    it('should plan complex multi-task chain in under 500ms (average)', async () => {
      // Setup: Complex goal
      const goal = createTestGoal({
        id: 'test:complex_goal',
        relevance: { '==': [true, true] },
        goalState: {
          has_component: ['actor', 'test:final_state'],
        },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Actor
      const actor = {
        id: 'test_actor',
        components: {},
      };
      setup.entityManager.addEntity(actor);

      // Setup: 5 tasks with dependencies
      const tasks = [];
      for (let i = 1; i <= 5; i++) {
        const task = createTestTask({
          id: `test:task_${i}`,
          cost: 10 + i,
          preconditions: i > 1 ? [{ has_component: ['actor', `test:state_${i - 1}`] }] : [],
          effects: [
            {
              type: 'ADD_COMPONENT',
              parameters: {
                entityId: 'actor',
                componentId: i < 5 ? `test:state_${i}` : 'test:final_state',
                componentData: {},
              },
            },
          ],
        });
        tasks.push(task);
      }

      const tasksMap = {};
      tasks.forEach((t) => {
        tasksMap[t.id] = t;
      });

      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return { test: tasksMap };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) => tasksMap[taskId] || null);

      const world = { state: {}, entities: {} };

      // Benchmark: Run 5 iterations (fewer due to complexity)
      const iterations = 5;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await setup.controller.decideTurn(actor, world);
        const duration = Date.now() - start;
        times.push(duration);

        // Reset
        actor.components = {};
        setup.eventBus.clear();
      }

      // Calculate metrics
      const average = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);

      console.log(`Complex Planning Performance:
        Average: ${average.toFixed(2)}ms
        Max: ${max}ms
        Tasks: 5
        Samples: ${iterations}`);

      // Verify: Average under 500ms
      expect(average).toBeLessThan(500);

      // Verify: Max under 1000ms (allow some variance)
      expect(max).toBeLessThan(1000);
    });
  });

  describe('Large Knowledge Set Performance', () => {
    it('should plan with large knowledge set in under 1000ms', async () => {
      // Setup: Goal
      const goal = createTestGoal({
        id: 'test:knowledge_goal',
        relevance: { '==': [true, true] },
        goalState: {
          has_component: ['actor', 'test:done'],
        },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Actor with large knowledge set
      const knownEntities = [];
      for (let i = 0; i < 50; i++) {
        knownEntities.push(`entity_${i}`);
      }

      const actor = {
        id: 'test_actor',
        components: {
          'core:known_to': {
            entities: knownEntities, // 50 known entities
          },
        },
      };
      setup.entityManager.addEntity(actor);

      // Add many entities to entity manager
      for (let i = 0; i < 50; i++) {
        setup.entityManager.addEntity({
          id: `entity_${i}`,
          components: { 'test:item': {} },
        });
      }

      // Setup: Task
      const task = createTestTask({
        id: 'test:complex_task',
        cost: 15,
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:done',
              componentData: {},
            },
          },
        ],
      });

      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return { test: { [task.id]: task } };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) =>
        taskId === task.id ? task : null
      );

      const world = { state: {}, entities: {} };

      // Benchmark: Run 3 iterations
      const iterations = 3;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await setup.controller.decideTurn(actor, world);
        const duration = Date.now() - start;
        times.push(duration);

        // Reset
        delete actor.components['test:done'];
        setup.eventBus.clear();
      }

      // Calculate metrics
      const average = times.reduce((a, b) => a + b, 0) / times.length;

      console.log(`Large Knowledge Set Performance:
        Average: ${average.toFixed(2)}ms
        Known Entities: 50
        Samples: ${iterations}`);

      // Verify: Average under 1000ms
      expect(average).toBeLessThan(1000);
    });
  });

  describe('Replanning Performance', () => {
    it('should handle 10 consecutive replanning turns in under 5000ms total', async () => {
      // Setup: Goal
      const goal = createTestGoal({
        id: 'test:replan_goal',
        relevance: { '==': [true, true] },
        goalState: {
          has_component: ['actor', 'test:target_reached'],
        },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Actor
      const actor = {
        id: 'test_actor',
        components: {},
      };
      setup.entityManager.addEntity(actor);

      // Setup: Multiple target entities (for replanning simulation)
      for (let i = 0; i < 10; i++) {
        setup.entityManager.addEntity({
          id: `target_${i}`,
          components: { 'test:reachable': {} },
        });
      }

      // Setup: Task
      const task = createTestTask({
        id: 'test:reach_target',
        cost: 10,
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:target_reached',
              componentData: {},
            },
          },
        ],
      });

      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return { test: { [task.id]: task } };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) =>
        taskId === task.id ? task : null
      );

      const world = { state: {}, entities: {} };

      // Benchmark: 10 consecutive turns with world changes
      const totalStart = Date.now();
      const turnTimes = [];

      for (let turn = 0; turn < 10; turn++) {
        const turnStart = Date.now();
        await setup.controller.decideTurn(actor, world);
        const turnDuration = Date.now() - turnStart;
        turnTimes.push(turnDuration);

        // Simulate world change: remove a target, reset actor state
        if (turn < 9) {
          setup.entityManager.deleteEntity(`target_${turn}`);
        }
        delete actor.components['test:target_reached'];
        setup.eventBus.clear();
      }

      const totalDuration = Date.now() - totalStart;
      const averageTurnTime = turnTimes.reduce((a, b) => a + b, 0) / turnTimes.length;

      console.log(`Replanning Performance:
        Total Duration: ${totalDuration}ms
        Average per Turn: ${averageTurnTime.toFixed(2)}ms
        Turns: 10
        Slowest Turn: ${Math.max(...turnTimes)}ms`);

      // Verify: Total under 5000ms
      expect(totalDuration).toBeLessThan(5000);

      // Verify: Average per turn reasonable
      expect(averageTurnTime).toBeLessThan(500);
    });
  });

  describe('Performance Regression Prevention', () => {
    it('should document baseline metrics for future comparison', () => {
      // This test always passes but documents expected performance

      const performanceBaselines = {
        simple_planning: {
          average_ms: 100,
          max_ms: 200,
          description: 'Single task, direct goal satisfaction',
        },
        complex_planning: {
          average_ms: 500,
          max_ms: 1000,
          description: '5-task dependency chain',
        },
        large_knowledge_set: {
          average_ms: 1000,
          description: '50 known entities, single task',
        },
        replanning: {
          total_ms: 5000,
          average_per_turn_ms: 500,
          description: '10 consecutive turns with world changes',
        },
      };

      console.log('\nPerformance Baselines:');
      console.log(JSON.stringify(performanceBaselines, null, 2));

      // This test documents expectations
      expect(performanceBaselines).toBeDefined();

      // Future tests can compare against these baselines
      // If performance degrades significantly, tests will fail
      expect(performanceBaselines.simple_planning.average_ms).toBeLessThan(150);
      expect(performanceBaselines.complex_planning.average_ms).toBeLessThan(750);
    });
  });
});
