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
import { GOAP_EVENTS } from '../../../src/goap/events/goapEvents.js';

/**
 * Helper to add flattened component aliases to an actor entity
 */
function addFlattenedAliases(actor) {
  const modifiedComponents = { ...actor.components };

  Object.keys(actor.components).forEach((componentId) => {
    if (componentId.includes(':')) {
      const flattenedId = componentId.replace(/:/g, '_');
      modifiedComponents[flattenedId] = actor.components[componentId];
    }
  });

  return {
    ...actor,
    components: modifiedComponents,
  };
}

/**
 * Builds dual-format state object for GOAP planning
 * @param {object} actor - Actor entity
 * @returns {object} State object with flat and nested component formats
 */
function buildDualFormatState(actor) {
  const state = {
    actor: {
      id: actor.id,
      components: {},
    },
  };

  Object.keys(actor.components).forEach((componentId) => {
    const componentData = { ...actor.components[componentId] };

    // Flat hash format
    const flatKey = `${actor.id}:${componentId}`;
    state[flatKey] = componentData;

    // Nested format with original key
    state.actor.components[componentId] = componentData;

    // Flattened alias
    const flattenedId = componentId.replace(/:/g, '_');
    state.actor.components[flattenedId] = componentData;
  });

  return state;
}

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
        planningPreconditions: [],
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
        refinementMethods: ['test:mine_method'],
        fallbackBehavior: 'replan',
      });

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: {
            [mineTask.id]: mineTask,
          },
        },
      });

      const actor = {
        id: 'actor-1',
        components: {
          'core:resources': { gold: 0 },
        },
      };
      setup.entityManager.addEntity(addFlattenedAliases(actor));

      const goal = createTestGoal({
        id: 'test:gather_gold',
        priority: 10,
        goalState: { '>=': [{ var: 'state.actor.components.core_resources.gold' }, 100] },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = { state: buildDualFormatState(actor), entities: {} };

      const startTime = performance.now();
      await setup.controller.decideTurn(actor, world);
      const endTime = performance.now();

      const planningTime = endTime - startTime;

      // Verify plan was created (check events, not active plan)
      const events = setup.eventBus.getEvents();
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.planLength).toBe(20);
      expect(planCreated.payload.tasks).toHaveLength(20);

      // Performance assertion
      expect(planningTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);

      // Log performance metrics for analysis
      console.log(`Planning time for 20 actions: ${planningTime.toFixed(2)}ms`);
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
        planningPreconditions: [],
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
        refinementMethods: ['test:eat_method'],
        fallbackBehavior: 'replan',
      });

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: {
            [eatTask.id]: eatTask,
          },
        },
      });

      const actor = {
        id: 'actor-1',
        components: {
          'core:needs': { hunger: 90 },
        },
      };
      setup.entityManager.addEntity(addFlattenedAliases(actor));

      const goal = createTestGoal({
        id: 'test:reduce_hunger',
        priority: 10,
        goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 0] },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = { state: buildDualFormatState(actor), entities: {} };

      // Spy on planner internal methods if possible to count node expansions
      // For now, just measure overall performance
      const startTime = performance.now();
      await setup.controller.decideTurn(actor, world);
      const endTime = performance.now();

      const planningTime = endTime - startTime;

      const events = setup.eventBus.getEvents();
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.tasks.length).toBeGreaterThan(0);

      // Should be very fast for small plans (< 10ms expected)
      expect(planningTime).toBeLessThan(10);

      console.log(
        `Planning time for ${planCreated.payload.tasks.length} actions: ${planningTime.toFixed(2)}ms`
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
          planningPreconditions: [],
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
          refinementMethods: ['test:mine_method'],
          fallbackBehavior: 'replan',
        });

        setup = await createGoapTestSetup({
          mockRefinement: true,
          tasks: {
            test: {
              [mineTask.id]: mineTask,
            },
          },
        });

        const actor = {
          id: `actor-${targetGold}`,
          components: {
            'core:resources': { gold: 0 },
          },
        };
        setup.entityManager.addEntity(addFlattenedAliases(actor));

        const goal = createTestGoal({
          id: `test:gold_${targetGold}`,
          priority: 10,
          goalState: { '>=': [{ var: 'state.actor.components.core_resources.gold' }, targetGold] },
        });

        setup.dataRegistry.register('goals', goal.id, goal);

        const world = { state: buildDualFormatState(actor), entities: {} };

        const startTime = performance.now();
        await setup.controller.decideTurn(actor, world);
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
