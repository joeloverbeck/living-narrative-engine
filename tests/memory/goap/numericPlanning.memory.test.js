/**
 * @file Memory tests for numeric constraint planning
 * @description Tests memory leak detection and stability for GOAP planning.
 * Extracted from performance tests to use proper memory test infrastructure.
 * @see tests/performance/goap/numericPlanning.performance.test.js - Performance-focused tests
 * @see tests/memory/goap/multiActionPlanning.memory.test.js - Related memory tests
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { createGoapTestSetup } from '../../integration/goap/testFixtures/goapTestSetup.js';
import { createTestGoal } from '../../integration/goap/testFixtures/testGoalFactory.js';
import { createTestTask } from '../../integration/goap/testFixtures/testTaskFactory.js';

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

describe('Numeric Planning Memory Tests', () => {
  let setup;

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during repeated planning', async () => {
      const mineTask = createTestTask({
        id: 'test:mine',
        cost: 1,
        priority: 100,
        structuralGates: {
          description: 'Can mine',
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
        id: 'actor-memory',
        components: {
          'core:resources': { gold: 0 },
        },
      };
      setup.entityManager.addEntity(addFlattenedAliases(actor));

      const goal = createTestGoal({
        id: 'test:gather_gold',
        priority: 10,
        goalState: {
          '>=': [{ var: 'state.actor.components.core_resources.gold' }, 10],
        },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = { state: buildDualFormatState(actor), entities: {} };

      // Force GC before measurement
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Run 1000 planning iterations
      for (let i = 0; i < 1000; i++) {
        await setup.controller.decideTurn(actor, world);

        // Reset actor state
        actor.components['core:resources'].gold = 0;
        world.state = buildDualFormatState(actor);

        jest.clearAllMocks();

        // Force GC every 100 iterations
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      // Release references before the final GC to measure retained growth, not local scope
      setup = null;
      world.state = null;
      actor.components = {};

      // Force final GC
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(
        `Memory growth after 1000 planning iterations: ${memoryGrowth.toFixed(2)}MB`
      );
      console.log(`Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);

      // Allow some growth but ensure it's not leaking
      // Threshold of 2MB allows for normal variance while catching real leaks
      expect(memoryGrowth).toBeLessThan(2); // < 2MB growth
    });

    it('should maintain stable memory under continuous load', async () => {
      const task = createTestTask({
        id: 'test:work',
        cost: 1,
        priority: 100,
        structuralGates: {
          description: 'Can work',
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
        refinementMethods: ['test:work_method'],
        fallbackBehavior: 'replan',
      });

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: {
            [task.id]: task,
          },
        },
      });

      const goals = [
        createTestGoal({
          id: 'goal:gold',
          priority: 10,
          goalState: {
            '>=': [{ var: 'state.actor.components.core_resources.gold' }, 50],
          },
        }),
      ];

      goals.forEach((goal) => {
        setup.dataRegistry.register('goals', goal.id, goal);
      });

      const actor = {
        id: 'actor-stability',
        components: {
          'core:resources': { gold: 0 },
        },
      };
      setup.entityManager.addEntity(addFlattenedAliases(actor));

      const world = { state: buildDualFormatState(actor), entities: {} };

      const memorySnapshots = [];

      for (let i = 0; i < 10; i++) {
        // Plan 100 times
        for (let j = 0; j < 100; j++) {
          await setup.controller.decideTurn(actor, world);
          // Reset state
          actor.components['core:resources'].gold = 0;
          world.state = buildDualFormatState(actor);

          jest.clearAllMocks();
        }

        // Force GC and snapshot
        if (global.gc) {
          global.gc();
        }
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }

      // Memory should be relatively stable (not growing continuously)
      const firstHalf = memorySnapshots.slice(0, 5);
      const secondHalf = memorySnapshots.slice(5, 10);

      const firstAverage = firstHalf.reduce((a, b) => a + b) / 5;
      const secondAverage = secondHalf.reduce((a, b) => a + b) / 5;

      const percentageIncrease =
        ((secondAverage - firstAverage) / firstAverage) * 100;

      console.log(
        `Memory snapshots (MB): ${memorySnapshots.map((m) => (m / 1024 / 1024).toFixed(2)).join(', ')}`
      );
      console.log(
        `First half average: ${(firstAverage / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `Second half average: ${(secondAverage / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(`Percentage increase: ${percentageIncrease.toFixed(2)}%`);

      expect(percentageIncrease).toBeLessThan(5); // < 5% growth
    });
  });
});
