/**
 * @file Memory leak tests for multi-action GOAP planning
 * @description Verifies no memory leaks during large plan generation
 * @see tickets/MULACTPLAFIX-005-comprehensive-test-suite.md
 * @see specs/goap-system-specs.md
 *
 * Run with: NODE_ENV=test node --expose-gc ./node_modules/.bin/jest tests/memory/goap/multiActionPlanning.memory.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestSetup } from '../../integration/goap/testFixtures/goapTestSetup.js';
import { createTestGoal } from '../../integration/goap/testFixtures/testGoalFactory.js';
import { createTestTask } from '../../integration/goap/testFixtures/testTaskFactory.js';

/**
 * Helper to build dual-format state for GOAP planning
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
 * Maximum allowed memory growth (bytes)
 * Allow 5MB growth for reasonable caching and data structures
 */
const MAX_MEMORY_GROWTH_BYTES = 5 * 1024 * 1024;

/**
 * Force garbage collection if available
 * Requires running with --expose-gc flag
 */
function forceGC() {
  if (global.gc) {
    global.gc();
  }
}

/**
 * Get current heap usage in bytes
 */
function getHeapUsed() {
  return process.memoryUsage().heapUsed;
}

describe('Multi-Action Planning Memory Tests', () => {
  let setup;
  let mineTask;
  let eatTask;
  let largeEffectTask;

  beforeEach(async () => {
    // Define all tasks BEFORE creating setup
    mineTask = createTestTask({
      id: 'test:mine',
      cost: 1,
      priority: 100,
      maxReuse: 10,
      structuralGates: {
        description: 'Actor can mine',
        condition: { '==': [1, 1] }, // Always true
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

    eatTask = createTestTask({
      id: 'test:eat',
      cost: 5,
      priority: 100,
      maxReuse: 150, // Increased for memory test iterations (50 iterations × 2 calls + buffer)
      structuralGates: {
        description: 'Actor can eat',
        condition: { '==': [1, 1] }, // Always true
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

    largeEffectTask = createTestTask({
      id: 'test:large_effect',
      cost: 1,
      priority: 100,
      maxReuse: 15,
      structuralGates: {
        description: 'Task with large effect',
        condition: { '==': [1, 1] }, // Always true
      },
      planningEffects: [
        {
          type: 'MODIFY_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:data',
            field: 'value',
            value: 1,
            mode: 'increment',
          },
        },
      ],
    });

    setup = await createGoapTestSetup({
      mockRefinement: true,
      tasks: {
        test: {
          [mineTask.id]: mineTask,
          [eatTask.id]: eatTask,
          [largeEffectTask.id]: largeEffectTask,
        },
      },
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
    forceGC();
  });

  describe('Test 4.3: Memory Usage', () => {
    it('should not leak memory during large plan generation', async () => {
      // Generate 100 plans, measure memory
      // Expected: No memory accumulation beyond reasonable caching

      // Warm up - run once to initialize caches
      const warmupActor = setup.createActor('warmup-actor');
      warmupActor.components['core:resources'] = { gold: 0 };

      const warmupGoal = createTestGoal({
        id: 'test:warmup',
        priority: 10,
        relevance: { '==': [true, true] }, // Always relevant
        goalState: { '>=': [{ var: 'actor.core_resources.gold' }, 20] },
      });

      setup.registerGoal(warmupGoal);
      await setup.controller.decideTurn(warmupActor, setup.world);

      // Force GC before measurement
      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const initialMemory = getHeapUsed();
      console.log(`Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);

      // Generate 100 plans
      for (let i = 0; i < 100; i++) {
        const actor = setup.createActor(`actor-${i}`);
        actor.components['core:resources'] = { gold: 0 };

        const goal = createTestGoal({
          id: `test:gold_${i}`,
          priority: 10,
          relevance: { '==': [true, true] }, // Always relevant
          goalState: { '>=': [{ var: 'actor.core_resources.gold' }, 20] },
        });

        // Clear previous goal (first iteration clears warmup, subsequent clear previous loop's goal)
        if (i === 0) {
          setup.dataRegistry.register('goals', warmupGoal.id, null);
        } else {
          setup.dataRegistry.register('goals', `test:gold_${i - 1}`, null);
        }
        setup.registerGoal(goal);

        await setup.controller.decideTurn(actor, setup.world);

        // Periodically force GC
        if (i % 25 === 0) {
          forceGC();
        }
      }

      // Final GC
      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const finalMemory = getHeapUsed();
      console.log(`Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);

      const memoryDelta = finalMemory - initialMemory;
      console.log(
        `Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)} MB (allowed: ${(MAX_MEMORY_GROWTH_BYTES / 1024 / 1024).toFixed(2)} MB)`
      );

      // Allow 5MB growth (reasonable for caching)
      expect(memoryDelta).toBeLessThan(MAX_MEMORY_GROWTH_BYTES);
    });

    it('should clean up actor-specific data after plan invalidation', async () => {
      // Verify that invalidated plans release memory

      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const initialMemory = getHeapUsed();

      // Create and invalidate plans repeatedly
      for (let i = 0; i < 50; i++) {
        const actor = setup.createActor(`actor-${i}`);
        actor.components['core:needs'] = { hunger: 90 };

        const goal = createTestGoal({
          id: `test:hunger_${i}`,
          priority: 10,
          relevance: { '==': [true, true] }, // Always relevant
          goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 0] },
        });

        // Clear previous goal to avoid accumulation
        if (i > 0) {
          setup.dataRegistry.register('goals', `test:hunger_${i - 1}`, null);
        }
        setup.registerGoal(goal);

        // Build world with state for planning
        const world = { state: buildDualFormatState(actor), entities: {} };
        await setup.controller.decideTurn(actor, world);

        // Simulate plan invalidation (actor changes state)
        actor.components['core:needs'].hunger = 100;

        // Trigger replanning (which should clean up old plan)
        const updatedWorld = { state: buildDualFormatState(actor), entities: {} };
        await setup.controller.decideTurn(actor, updatedWorld);

        if (i % 10 === 0) {
          forceGC();
        }
      }

      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const finalMemory = getHeapUsed();
      const memoryDelta = finalMemory - initialMemory;

      console.log(
        `Memory delta after 50 plan cycles: ${(memoryDelta / 1024 / 1024).toFixed(2)} MB`
      );

      // Should not accumulate memory from invalidated plans
      expect(memoryDelta).toBeLessThan(MAX_MEMORY_GROWTH_BYTES);
    });

    it('should handle large state objects without leaking', async () => {
      // Test with large component data to ensure proper cleanup

      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const initialMemory = getHeapUsed();

      // Generate plans with large state objects
      for (let i = 0; i < 30; i++) {
        const actor = setup.createActor(`actor-${i}`);

        // Add large component data
        actor.components['core:data'] = {
          value: 0,
          largeArray: new Array(1000).fill(i),
          metadata: {
            description: 'A'.repeat(1000),
          },
        };

        const goal = createTestGoal({
          id: `test:data_${i}`,
          priority: 10,
          relevance: { '==': [true, true] }, // Always relevant
          goalState: { '>=': [{ var: 'actor.core_data.value' }, 10] },
        });

        // Clear previous goal to avoid accumulation
        if (i > 0) {
          setup.dataRegistry.register('goals', `test:data_${i - 1}`, null);
        }
        setup.registerGoal(goal);
        await setup.controller.decideTurn(actor, setup.world);

        if (i % 10 === 0) {
          forceGC();
        }
      }

      forceGC();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const finalMemory = getHeapUsed();
      const memoryDelta = finalMemory - initialMemory;

      console.log(
        `Memory delta with large states: ${(memoryDelta / 1024 / 1024).toFixed(2)} MB`
      );

      // Allow some growth for data structures, but not proportional to all actors
      expect(memoryDelta).toBeLessThan(MAX_MEMORY_GROWTH_BYTES * 2);
    });
  });
});
