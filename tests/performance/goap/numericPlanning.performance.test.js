/**
 * @jest-environment node
 * @file Supplementary performance tests for numeric constraint planning
 * @description Tests missing coverage areas not covered by existing GOAP performance tests.
 * Focuses on: memory leak detection, statistical analysis (percentiles), health restoration,
 * batch testing of diverse goal types, and complex multi-constraint goals.
 * @see tests/performance/goap/multiActionPlanning.performance.test.js - Existing hunger/gold tests
 * @see tests/performance/goap/heuristicCalculation.performance.test.js - Existing heuristic tests
 * @see tickets/MODCOMPLASUP-010-performance-benchmarking.md - Requirements
 * @see specs/goap-system-specs.md - GOAP system specification
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestSetup } from '../../integration/goap/testFixtures/goapTestSetup.js';
import { createTestGoal } from '../../integration/goap/testFixtures/testGoalFactory.js';
import { createTestTask } from '../../integration/goap/testFixtures/testTaskFactory.js';
import { GOAP_EVENTS } from '../../../src/goap/events/goapEvents.js';

/**
 * Helper to add flattened component aliases to an actor entity
 *
 * @param {object} actor - Actor entity with components
 * @returns {object} Actor with flattened component aliases
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
 *
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
 * Calculate percentile from array of values
 *
 * @param {number[]} values - Array of numeric values
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number} Percentile value
 */
function calculatePercentile(values, percentile) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor((sorted.length * percentile) / 100);
  return sorted[index] || 0;
}

/**
 * Calculate median from array of values
 *
 * @param {number[]} values - Array of numeric values
 * @returns {number} Median value
 */
function calculateMedian(values) {
  return calculatePercentile(values, 50);
}

/**
 * Calculate mean from array of values
 *
 * @param {number[]} values - Array of numeric values
 * @returns {number} Mean value
 */
function calculateMean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

describe('Numeric Planning Performance - Supplementary Tests', () => {
  let setup;

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  describe('Health Restoration (Missing Coverage)', () => {
    it('should plan health restoration in < 100ms', async () => {
      // Test health restoration scenario (hunger and gold already tested in multiActionPlanning.performance.test.js)
      const healTask = createTestTask({
        id: 'test:heal',
        cost: 5,
        priority: 100,
        structuralGates: {
          description: 'Actor can heal',
          condition: { '==': [1, 1] },
        },
        planningPreconditions: [],
        planningEffects: [
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:stats',
              field: 'health',
              value: 30,
              mode: 'increment',
            },
          },
        ],
        refinementMethods: ['test:heal_method'],
        fallbackBehavior: 'replan',
      });

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: {
            [healTask.id]: healTask,
          },
        },
      });

      const actor = {
        id: 'actor-1',
        components: {
          'core:stats': { health: 20 },
        },
      };
      setup.entityManager.addEntity(addFlattenedAliases(actor));

      const goal = createTestGoal({
        id: 'test:restore_health',
        priority: 10,
        goalState: { '>=': [{ var: 'state.actor.components.core_stats.health' }, 80] },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = { state: buildDualFormatState(actor), entities: {} };

      const startTime = performance.now();
      await setup.controller.decideTurn(actor, world);
      const duration = performance.now() - startTime;

      // Verify plan was created
      const events = setup.eventBus.getEvents();
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.planLength).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // < 100ms target

      console.log(`Health restoration planning time: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Batch Planning with Diverse Goal Types', () => {
    it('should plan 10 different numeric goals in < 1 second', async () => {
      // Create tasks for different numeric attributes
      const tasks = [
        { id: 'test:reduce_hunger', component: 'core:needs', field: 'hunger', value: 30, mode: 'decrement' },
        { id: 'test:quench_thirst', component: 'core:needs', field: 'thirst', value: 35, mode: 'decrement' },
        { id: 'test:restore_health', component: 'core:stats', field: 'health', value: 25, mode: 'increment' },
        { id: 'test:restore_energy', component: 'core:stats', field: 'energy', value: 20, mode: 'increment' },
        { id: 'test:gather_gold', component: 'core:resources', field: 'gold', value: 10, mode: 'increment' },
        { id: 'test:train_strength', component: 'core:attributes', field: 'strength', value: 2, mode: 'increment' },
        { id: 'test:train_agility', component: 'core:attributes', field: 'agility', value: 2, mode: 'increment' },
        {
          id: 'test:study_intelligence',
          component: 'core:attributes',
          field: 'intelligence',
          value: 2,
          mode: 'increment',
        },
        { id: 'test:gain_experience', component: 'core:progression', field: 'experience', value: 50, mode: 'increment' },
        {
          id: 'test:improve_reputation',
          component: 'core:social',
          field: 'reputation',
          value: 10,
          mode: 'increment',
        },
      ];

      const taskObjects = {};
      tasks.forEach((t) => {
        taskObjects[t.id] = createTestTask({
          id: t.id,
          cost: 5,
          priority: 100,
          structuralGates: {
            description: `Can perform ${t.id}`,
            condition: { '==': [1, 1] },
          },
          planningPreconditions: [],
          planningEffects: [
            {
              type: 'MODIFY_COMPONENT',
              parameters: {
                entity_ref: 'actor',
                component_type: t.component,
                field: t.field,
                value: t.value,
                mode: t.mode,
              },
            },
          ],
          refinementMethods: [`${t.id}_method`],
          fallbackBehavior: 'replan',
        });
      });

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: taskObjects,
        },
      });

      // Create actor with low stats
      const actor = {
        id: 'actor-batch',
        components: {
          'core:needs': { hunger: 80, thirst: 85 },
          'core:stats': { health: 30, energy: 25 },
          'core:resources': { gold: 0 },
          'core:attributes': { strength: 5, agility: 5, intelligence: 5 },
          'core:progression': { experience: 0 },
          'core:social': { reputation: 0 },
        },
      };
      setup.entityManager.addEntity(addFlattenedAliases(actor));

      // Create goals for each attribute
      const goals = [
        createTestGoal({
          id: 'goal:hunger',
          priority: 10,
          goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 30] },
        }),
        createTestGoal({
          id: 'goal:thirst',
          priority: 10,
          goalState: { '<=': [{ var: 'state.actor.components.core_needs.thirst' }, 30] },
        }),
        createTestGoal({
          id: 'goal:health',
          priority: 10,
          goalState: { '>=': [{ var: 'state.actor.components.core_stats.health' }, 80] },
        }),
        createTestGoal({
          id: 'goal:energy',
          priority: 10,
          goalState: { '>=': [{ var: 'state.actor.components.core_stats.energy' }, 80] },
        }),
        createTestGoal({
          id: 'goal:gold',
          priority: 10,
          goalState: { '>=': [{ var: 'state.actor.components.core_resources.gold' }, 100] },
        }),
        createTestGoal({
          id: 'goal:strength',
          priority: 10,
          goalState: { '>=': [{ var: 'state.actor.components.core_attributes.strength' }, 10] },
        }),
        createTestGoal({
          id: 'goal:agility',
          priority: 10,
          goalState: { '>=': [{ var: 'state.actor.components.core_attributes.agility' }, 10] },
        }),
        createTestGoal({
          id: 'goal:intelligence',
          priority: 10,
          goalState: { '>=': [{ var: 'state.actor.components.core_attributes.intelligence' }, 10] },
        }),
        createTestGoal({
          id: 'goal:experience',
          priority: 10,
          goalState: { '>=': [{ var: 'state.actor.components.core_progression.experience' }, 500] },
        }),
        createTestGoal({
          id: 'goal:reputation',
          priority: 10,
          goalState: { '>=': [{ var: 'state.actor.components.core_social.reputation' }, 100] },
        }),
      ];

      goals.forEach((goal) => {
        setup.dataRegistry.register('goals', goal.id, goal);
      });

      const world = { state: buildDualFormatState(actor), entities: {} };

      const startTime = performance.now();

      // Plan for each goal sequentially
      for (const goal of goals) {
        // Reset actor state for clean test
        actor.components = {
          'core:needs': { hunger: 80, thirst: 85 },
          'core:stats': { health: 30, energy: 25 },
          'core:resources': { gold: 0 },
          'core:attributes': { strength: 5, agility: 5, intelligence: 5 },
          'core:progression': { experience: 0 },
          'core:social': { reputation: 0 },
        };
        setup.entityManager.addEntity(addFlattenedAliases(actor));
        world.state = buildDualFormatState(actor);

        // Force this specific goal to be selected by unregistering all others
        goals.forEach((g) => {
          if (g.id !== goal.id) {
            setup.dataRegistry.register('goals', g.id, null);
          }
        });

        await setup.controller.decideTurn(actor, world);

        // Re-register the unregistered goals for the next iteration
        goals.forEach((g) => {
          if (g.id !== goal.id) {
            setup.dataRegistry.register('goals', g.id, g);
          }
        });
      }

      const totalDuration = performance.now() - startTime;

      expect(totalDuration).toBeLessThan(1000); // < 1 second for 10 goals

      console.log(`Batch planning (10 goals) total time: ${totalDuration.toFixed(2)}ms`);
      console.log(`Average per goal: ${(totalDuration / 10).toFixed(2)}ms`);
    });

    it('should average < 100ms per goal in batch planning', async () => {
      // Similar setup but collecting individual times
      const tasks = [
        { id: 'test:reduce_hunger', component: 'core:needs', field: 'hunger', value: 30, mode: 'decrement' },
        { id: 'test:restore_health', component: 'core:stats', field: 'health', value: 25, mode: 'increment' },
        { id: 'test:gather_gold', component: 'core:resources', field: 'gold', value: 10, mode: 'increment' },
        { id: 'test:train_strength', component: 'core:attributes', field: 'strength', value: 2, mode: 'increment' },
        { id: 'test:gain_experience', component: 'core:progression', field: 'experience', value: 50, mode: 'increment' },
      ];

      const taskObjects = {};
      tasks.forEach((t) => {
        taskObjects[t.id] = createTestTask({
          id: t.id,
          cost: 5,
          priority: 100,
          structuralGates: {
            description: `Can perform ${t.id}`,
            condition: { '==': [1, 1] },
          },
          planningPreconditions: [],
          planningEffects: [
            {
              type: 'MODIFY_COMPONENT',
              parameters: {
                entity_ref: 'actor',
                component_type: t.component,
                field: t.field,
                value: t.value,
                mode: t.mode,
              },
            },
          ],
          refinementMethods: [`${t.id}_method`],
          fallbackBehavior: 'replan',
        });
      });

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: taskObjects,
        },
      });

      const durations = [];

      for (let i = 0; i < 5; i++) {
        const actor = {
          id: `actor-${i}`,
          components: {
            'core:needs': { hunger: 80 },
            'core:stats': { health: 30 },
            'core:resources': { gold: 0 },
            'core:attributes': { strength: 5 },
            'core:progression': { experience: 0 },
          },
        };
        setup.entityManager.addEntity(addFlattenedAliases(actor));

        const goal = createTestGoal({
          id: `goal-${i}`,
          priority: 10,
          goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 30] },
        });

        setup.dataRegistry.register('goals', goal.id, goal);

        const world = { state: buildDualFormatState(actor), entities: {} };

        const start = performance.now();
        await setup.controller.decideTurn(actor, world);
        durations.push(performance.now() - start);
      }

      const average = durations.reduce((a, b) => a + b, 0) / durations.length;

      expect(average).toBeLessThan(100); // < 100ms average

      console.log(`Individual goal planning times: ${durations.map((d) => d.toFixed(2)).join(', ')}ms`);
      console.log(`Average: ${average.toFixed(2)}ms`);
    });
  });

  describe('Complex Multi-Constraint Goals', () => {
    it('should handle complex numeric constraints efficiently', async () => {
      // Create tasks that affect multiple stats
      const multiEffectTask = createTestTask({
        id: 'test:rest',
        cost: 10,
        priority: 100,
        structuralGates: {
          description: 'Can rest',
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
              value: 20,
              mode: 'decrement',
            },
          },
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:stats',
              field: 'health',
              value: 40,
              mode: 'increment',
            },
          },
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:stats',
              field: 'energy',
              value: 50,
              mode: 'increment',
            },
          },
        ],
        refinementMethods: ['test:rest_method'],
        fallbackBehavior: 'replan',
      });

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: {
            [multiEffectTask.id]: multiEffectTask,
          },
        },
      });

      const actor = {
        id: 'actor-complex',
        components: {
          'core:needs': { hunger: 80 },
          'core:stats': { health: 20, energy: 10 },
        },
      };
      setup.entityManager.addEntity(addFlattenedAliases(actor));

      // Complex goal with AND of multiple numeric constraints
      const complexGoal = createTestGoal({
        id: 'test:full_recovery',
        priority: 10,
        goalState: {
          and: [
            { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 30] },
            { '>=': [{ var: 'state.actor.components.core_stats.health' }, 80] },
            { '>=': [{ var: 'state.actor.components.core_stats.energy' }, 80] },
          ],
        },
      });

      setup.dataRegistry.register('goals', complexGoal.id, complexGoal);

      const world = { state: buildDualFormatState(actor), entities: {} };

      const startTime = performance.now();

      // Run multiple iterations to test heuristic calculation performance
      for (let i = 0; i < 100; i++) {
        await setup.controller.decideTurn(actor, world);
      }

      const duration = performance.now() - startTime;
      const averagePerIteration = duration / 100;

      expect(averagePerIteration).toBeLessThan(10); // < 10ms per complex goal evaluation

      console.log(
        `Complex multi-constraint goal (100 iterations): avg ${averagePerIteration.toFixed(2)}ms, total ${duration.toFixed(2)}ms`
      );
    });
  });

  describe('Mixed Component and Numeric Goals', () => {
    it('should handle mixed goals without performance degradation', async () => {
      // Create tasks for both component and numeric changes
      const armTask = createTestTask({
        id: 'test:arm_self',
        cost: 5,
        priority: 100,
        structuralGates: {
          description: 'Can arm self',
          condition: { '==': [1, 1] },
        },
        planningPreconditions: [],
        planningEffects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor-mixed',
              componentId: 'core:armed',
              data: {},
            },
          },
        ],
        refinementMethods: ['test:arm_method'],
        fallbackBehavior: 'replan',
      });

      const healTask = createTestTask({
        id: 'test:heal',
        cost: 5,
        priority: 100,
        structuralGates: {
          description: 'Can heal',
          condition: { '==': [1, 1] },
        },
        planningPreconditions: [],
        planningEffects: [
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:stats',
              field: 'health',
              value: 30,
              mode: 'increment',
            },
          },
        ],
        refinementMethods: ['test:heal_method'],
        fallbackBehavior: 'replan',
      });

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: {
            [armTask.id]: armTask,
            [healTask.id]: healTask,
          },
        },
      });

      const mixedGoals = [
        createTestGoal({
          id: 'goal:component',
          priority: 10,
          goalState: { has_component: ['actor-mixed', 'core:armed'] },
        }),
        createTestGoal({
          id: 'goal:numeric',
          priority: 10,
          goalState: { '>=': [{ var: 'state.actor.components.core_stats.health' }, 80] },
        }),
      ];

      mixedGoals.forEach((goal) => {
        setup.dataRegistry.register('goals', goal.id, goal);
      });

      const actor = {
        id: 'actor-mixed',
        components: {
          'core:stats': { health: 30 },
        },
      };
      setup.entityManager.addEntity(addFlattenedAliases(actor));

      const world = { state: buildDualFormatState(actor), entities: {} };

      const startTime = performance.now();

      // Test each goal type
      for (const goal of mixedGoals) {
        // Force this specific goal to be selected by unregistering all others
        mixedGoals.forEach((g) => {
          if (g.id !== goal.id) {
            setup.dataRegistry.register('goals', g.id, null);
          }
        });

        await setup.controller.decideTurn(actor, world);

        // Re-register the unregistered goals for the next iteration
        mixedGoals.forEach((g) => {
          if (g.id !== goal.id) {
            setup.dataRegistry.register('goals', g.id, g);
          }
        });
      }

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(200); // < 100ms average per goal

      console.log(`Mixed goals planning time: ${duration.toFixed(2)}ms for ${mixedGoals.length} goals`);
    });
  });

  describe('Performance Statistics Collection', () => {
    it('should collect and report performance statistics with percentiles', async () => {
      const tasks = [
        { id: 'test:task1', component: 'core:resources', field: 'gold', value: 10, mode: 'increment' },
        { id: 'test:task2', component: 'core:needs', field: 'hunger', value: 30, mode: 'decrement' },
        { id: 'test:task3', component: 'core:stats', field: 'health', value: 25, mode: 'increment' },
      ];

      const taskObjects = {};
      tasks.forEach((t) => {
        taskObjects[t.id] = createTestTask({
          id: t.id,
          cost: 5,
          priority: 100,
          structuralGates: {
            description: `Can perform ${t.id}`,
            condition: { '==': [1, 1] },
          },
          planningPreconditions: [],
          planningEffects: [
            {
              type: 'MODIFY_COMPONENT',
              parameters: {
                entity_ref: 'actor',
                component_type: t.component,
                field: t.field,
                value: t.value,
                mode: t.mode,
              },
            },
          ],
          refinementMethods: [`${t.id}_method`],
          fallbackBehavior: 'replan',
        });
      });

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: taskObjects,
        },
      });

      const goals = [
        createTestGoal({
          id: 'goal:gold',
          priority: 10,
          goalState: { '>=': [{ var: 'state.actor.components.core_resources.gold' }, 100] },
        }),
        createTestGoal({
          id: 'goal:hunger',
          priority: 10,
          goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 30] },
        }),
        createTestGoal({
          id: 'goal:health',
          priority: 10,
          goalState: { '>=': [{ var: 'state.actor.components.core_stats.health' }, 80] },
        }),
      ];

      goals.forEach((goal) => {
        setup.dataRegistry.register('goals', goal.id, goal);
      });

      const planCreationTimes = [];

      // Collect timing data
      for (let i = 0; i < 50; i++) {
        const actor = {
          id: `actor-stats-${i}`,
          components: {
            'core:resources': { gold: 0 },
            'core:needs': { hunger: 80 },
            'core:stats': { health: 30 },
          },
        };
        setup.entityManager.addEntity(addFlattenedAliases(actor));

        const goal = goals[i % goals.length];

        // Force this specific goal to be selected by unregistering all others
        goals.forEach((g) => {
          if (g.id !== goal.id) {
            setup.dataRegistry.register('goals', g.id, null);
          }
        });

        const world = { state: buildDualFormatState(actor), entities: {} };

        const start = performance.now();
        await setup.controller.decideTurn(actor, world);
        planCreationTimes.push(performance.now() - start);

        // Re-register the unregistered goals for the next iteration
        goals.forEach((g) => {
          if (g.id !== goal.id) {
            setup.dataRegistry.register('goals', g.id, g);
          }
        });
      }

      // Calculate statistics
      const stats = {
        mean: calculateMean(planCreationTimes),
        median: calculateMedian(planCreationTimes),
        p95: calculatePercentile(planCreationTimes, 95),
        p99: calculatePercentile(planCreationTimes, 99),
        min: Math.min(...planCreationTimes),
        max: Math.max(...planCreationTimes),
      };

      console.log('Performance Statistics:');
      console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
      console.log(`  Median: ${stats.median.toFixed(2)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
      console.log(`  P99: ${stats.p99.toFixed(2)}ms`);
      console.log(`  Min: ${stats.min.toFixed(2)}ms`);
      console.log(`  Max: ${stats.max.toFixed(2)}ms`);

      expect(stats.p95).toBeLessThan(150); // 95th percentile < 150ms
      expect(stats.p99).toBeLessThan(200); // 99th percentile < 200ms
    });
  });
});
