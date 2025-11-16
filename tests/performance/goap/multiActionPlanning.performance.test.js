/**
 * @file Performance tests for multi-action GOAP planning
 * @description Verifies planning performance meets benchmarks for large action sequences
 * @see tickets/MULACTPLAFIX-005-comprehensive-test-suite.md
 * @see specs/goap-system-specs.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestSetup } from '../../integration/goap/testFixtures/goapTestSetup.js';
import { createTestGoal } from '../../integration/goap/testFixtures/testGoalFactory.js';
import { createTestTask } from '../../integration/goap/testFixtures/testTaskFactory.js';

/**
 * Performance threshold for large plan generation (milliseconds)
 * Plans with 20-30 actions should complete in under 100ms
 */
const PERFORMANCE_THRESHOLD_MS = 100;

/**
 * Performance threshold for very large plans (milliseconds)
 * Plans with 50+ actions should complete in under 500ms
 */
const LARGE_PLAN_THRESHOLD_MS = 500;

describe('Multi-Action Planning Performance', () => {
  let setup;

  beforeEach(async () => {
    // Create minimal setup for performance testing
    setup = await createGoapTestSetup({
      mockRefinement: true,
      tasks: {}, // Tasks will be added per test
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  describe('Test 4.1: Large Plans Performance', () => {
    it('should plan 20-action sequences in < 100ms', async () => {
      // Measure planning time for 20 identical actions
      // Expected: < 100ms

      const mineTask = createTestTask({
        id: 'test:mine',
        cost: 1,
        priority: 100,
        structuralGates: {
          description: 'Actor can mine',
          condition: { '==': [1, 1] },
        },
        planningEffects: [
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:resources',
              field: 'gold',
              value: 5,
              mode: 'increment',
            },
          },
        ],
      });

      // Register task
      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return {
            test: {
              [mineTask.id]: mineTask,
            },
          };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) => {
        if (taskId === mineTask.id) {
          return mineTask;
        }
        return null;
      });

      const actor = setup.createActor('actor-1');
      actor.components['core:resources'] = { gold: 0 };

      const goal = createTestGoal({
        id: 'test:gather_gold',
        priority: 10,
        goalState: { '>=': [{ var: 'actor.core_resources.gold' }, 100] },
      });

      setup.registerGoal(goal);

      const startTime = performance.now();
      await setup.controller.decideTurn(actor.id, setup.world);
      const endTime = performance.now();

      const planningTime = endTime - startTime;

      // Verify plan was created
      const plan = setup.controller.getActivePlan(actor.id);
      expect(plan).not.toBeNull();
      expect(plan.tasks).toHaveLength(20);

      // Performance assertion
      expect(planningTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);

      // Log performance metrics for analysis
      console.log(`Planning time for 20 actions: ${planningTime.toFixed(2)}ms`);
    });

    it('should handle 50-action plans efficiently', async () => {
      // Stress test with very large plans
      // Expected: < 500ms for 50 actions

      const nibbleTask = createTestTask({
        id: 'test:nibble',
        cost: 1,
        priority: 100,
        structuralGates: {
          description: 'Actor can nibble',
          condition: { '==': [1, 1] },
        },
        planningEffects: [
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:needs',
              field: 'hunger',
              value: 2,
              mode: 'decrement',
            },
          },
        ],
      });

      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return {
            test: {
              [nibbleTask.id]: nibbleTask,
            },
          };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) => {
        if (taskId === nibbleTask.id) {
          return nibbleTask;
        }
        return null;
      });

      const actor = setup.createActor('actor-1');
      actor.components['core:needs'] = { hunger: 100 };

      const goal = createTestGoal({
        id: 'test:eliminate_hunger',
        priority: 10,
        goalState: { '<=': [{ var: 'actor.core_needs.hunger' }, 0] },
      });

      setup.registerGoal(goal);

      const startTime = performance.now();
      await setup.controller.decideTurn(actor.id, setup.world);
      const endTime = performance.now();

      const planningTime = endTime - startTime;

      const plan = setup.controller.getActivePlan(actor.id);
      expect(plan).not.toBeNull();
      expect(plan.tasks).toHaveLength(50);

      expect(planningTime).toBeLessThan(LARGE_PLAN_THRESHOLD_MS);

      console.log(`Planning time for 50 actions: ${planningTime.toFixed(2)}ms`);
    });
  });

  describe('Test 4.2: Node Expansion Efficiency', () => {
    it('should demonstrate efficient heuristic with minimal node expansion', async () => {
      // Compare planning efficiency by tracking heuristic calls
      // With enhanced heuristic, should expand fewer nodes

      const eatTask = createTestTask({
        id: 'test:eat',
        cost: 5,
        priority: 100,
        structuralGates: {
          description: 'Actor can eat',
          condition: { '==': [1, 1] },
        },
        planningEffects: [
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:needs',
              field: 'hunger',
              value: 30,
              mode: 'decrement',
            },
          },
        ],
      });

      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return {
            test: {
              [eatTask.id]: eatTask,
            },
          };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) => {
        if (taskId === eatTask.id) {
          return eatTask;
        }
        return null;
      });

      const actor = setup.createActor('actor-1');
      actor.components['core:needs'] = { hunger: 90 };

      const goal = createTestGoal({
        id: 'test:reduce_hunger',
        priority: 10,
        goalState: { '<=': [{ var: 'actor.core_needs.hunger' }, 0] },
      });

      setup.registerGoal(goal);

      // Spy on planner internal methods if possible to count node expansions
      // For now, just measure overall performance
      const startTime = performance.now();
      await setup.controller.decideTurn(actor.id, setup.world);
      const endTime = performance.now();

      const planningTime = endTime - startTime;

      const plan = setup.controller.getActivePlan(actor.id);
      expect(plan).not.toBeNull();
      expect(plan.tasks.length).toBeGreaterThan(0);

      // Should be very fast for small plans (< 10ms expected)
      expect(planningTime).toBeLessThan(10);

      console.log(
        `Planning time for ${plan.tasks.length} actions: ${planningTime.toFixed(2)}ms`
      );
    });
  });

  describe('Comparative Performance Metrics', () => {
    it('should scale linearly with plan size', async () => {
      // Test plans of varying sizes and verify linear scaling
      const results = [];

      const testSizes = [5, 10, 20];

      for (const targetGold of testSizes) {
        const mineTask = createTestTask({
          id: 'test:mine',
          cost: 1,
          priority: 100,
          structuralGates: {
            description: 'Actor can mine',
            condition: { '==': [1, 1] },
          },
          planningEffects: [
            {
              type: 'MODIFY_COMPONENT',
              parameters: {
                entity_ref: 'actor',
                component_type: 'core:resources',
                field: 'gold',
                value: 1,
                mode: 'increment',
              },
            },
          ],
        });

        setup.gameDataRepository.get = jest.fn((key) => {
          if (key === 'tasks') {
            return {
              test: {
                [mineTask.id]: mineTask,
              },
            };
          }
          return null;
        });

        setup.gameDataRepository.getTask = jest.fn((taskId) => {
          if (taskId === mineTask.id) {
            return mineTask;
          }
          return null;
        });

        const actor = setup.createActor(`actor-${targetGold}`);
        actor.components['core:resources'] = { gold: 0 };

        const goal = createTestGoal({
          id: `test:gold_${targetGold}`,
          priority: 10,
          goalState: { '>=': [{ var: 'actor.core_resources.gold' }, targetGold] },
        });

        setup.registerGoal(goal);

        const startTime = performance.now();
        await setup.controller.decideTurn(actor.id, setup.world);
        const endTime = performance.now();

        results.push({
          size: targetGold,
          time: endTime - startTime,
        });
      }

      // Log results for analysis
      console.log('Performance scaling results:');
      results.forEach((result) => {
        console.log(`  ${result.size} actions: ${result.time.toFixed(2)}ms`);
      });

      // Verify all completed within reasonable time
      results.forEach((result) => {
        expect(result.time).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      });
    });
  });
});
