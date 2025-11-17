/**
 * @file Backward compatibility integration tests for GOAP
 * @description Verifies that existing single-action scenarios still work correctly
 * @see tickets/MULACTPLAFIX-005-comprehensive-test-suite.md
 * @see specs/goap-system-specs.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestSetup } from './testFixtures/goapTestSetup.js';
import { createTestGoal } from './testFixtures/testGoalFactory.js';
import { createTestTask } from './testFixtures/testTaskFactory.js';
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

describe('GOAP Backward Compatibility', () => {
  let setup;

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  describe('Test 3.1: Single Action Sufficient', () => {
    it('should maintain backward compatibility with single-action scenarios', async () => {
      // Initial: hunger = 80
      // Task: eat (-60 hunger)
      // Goal: hunger ≤ 30
      // Expected: 1 action (80 → 20 ✓)

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
              value: 60,
              mode: 'decrement',
            },
          },
        ],
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
        id: 'test_actor',
        components: {
          'core:needs': { hunger: 80 },
        },
      };
      setup.registerPlanningActor(actor);

      const goal = createTestGoal({
        id: 'test:reduce_hunger',
        priority: 10,
        goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 30] },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = {
        state: setup.buildPlanningState(actor),
        entities: {},
      };

      await setup.controller.decideTurn(actor, world);

      const events = setup.eventBus.getAll();
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.planLength).toBe(1);
      expect(planCreated.payload.tasks).toHaveLength(1);
      expect(planCreated.payload.tasks[0]).toBe('test:eat');
    });
  });

  describe('Test 3.2: Component-Only Goals', () => {
    it('should handle component-only goals without numeric constraints', async () => {
      // Initial: no 'core:armed' component
      // Task: equip_weapon (adds 'core:armed' component)
      // Goal: has_component('actor', 'core:armed')
      // Expected: 1 action

      const equipTask = createTestTask({
        id: 'test:equip_weapon',
        cost: 3,
        priority: 100,
        structuralGates: {
          description: 'Actor can equip weapon',
          condition: { '==': [1, 1] },
        },
        planningEffects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:armed',
              component_data: { weapon: 'sword' },
            },
          },
        ],
      });

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: {
            [equipTask.id]: equipTask,
          },
        },
      });

      const actor = {
        id: 'test_actor',
        components: {},
      };
      setup.registerPlanningActor(actor);

      const goal = createTestGoal({
        id: 'test:arm_self',
        priority: 10,
        goalState: {
          has_component: ['actor', 'core:armed'],
        },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = {
        state: setup.buildPlanningState(actor),
        entities: {},
      };

      await setup.controller.decideTurn(actor, world);

      const events = setup.eventBus.getAll();
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.planLength).toBe(1);
      expect(planCreated.payload.tasks).toHaveLength(1);
      expect(planCreated.payload.tasks[0]).toBe('test:equip_weapon');
    });
  });

  describe('Test 3.3: Mixed Component + Numeric Goals', () => {
    it('should handle mixed component and numeric goals', async () => {
      // Goal: has_component('actor', 'core:armed') AND hunger ≤ 10
      // Expected: Plan with equip + eat actions

      const equipTask = createTestTask({
        id: 'test:equip',
        cost: 3,
        priority: 100,
        structuralGates: {
          description: 'Actor can equip weapon',
          condition: { '==': [1, 1] },
        },
        planningEffects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:armed',
              component_data: { weapon: 'sword' },
            },
          },
        ],
      });

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
              value: 60,
              mode: 'decrement',
            },
          },
        ],
      });

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: {
            [equipTask.id]: equipTask,
            [eatTask.id]: eatTask,
          },
        },
      });

      const actor = {
        id: 'test_actor',
        components: {
          'core:needs': { hunger: 50 },
        },
      };
      setup.registerPlanningActor(actor);

      const goal = createTestGoal({
        id: 'test:arm_and_feed',
        priority: 10,
        goalState: {
          and: [
            { has_component: ['actor', 'core:armed'] },
            { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10] },
          ],
        },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = {
        state: setup.buildPlanningState(actor),
        entities: {},
      };

      await setup.controller.decideTurn(actor, world);

      const events = setup.eventBus.getAll();
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.tasks.length).toBeGreaterThan(0);

      const taskIds = planCreated.payload.tasks;
      expect(taskIds).toContain('test:equip');
      expect(taskIds).toContain('test:eat');
    });
  });

  describe('Test 3.4: Complex Nested Logic', () => {
    it('should handle complex nested logic in goals', async () => {
      // Goal: (hunger ≤ 10 OR health ≥ 80) AND position = 'home'
      // Expected: Valid plan satisfying complex condition

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
              value: 60,
              mode: 'decrement',
            },
          },
        ],
      });

      const goHomeTask = createTestTask({
        id: 'test:go_home',
        cost: 10,
        priority: 100,
        structuralGates: {
          description: 'Actor can go home',
          condition: { '==': [1, 1] },
        },
        planningEffects: [
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:location',
              field: 'position',
              value: 'home',
              mode: 'set',
            },
          },
        ],
      });

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: {
            [eatTask.id]: eatTask,
            [goHomeTask.id]: goHomeTask,
          },
        },
      });

      const actor = {
        id: 'test_actor',
        components: {
          'core:needs': { hunger: 50, health: 30 },
          'core:location': { position: 'forest' },
        },
      };
      setup.registerPlanningActor(actor);

      const goal = createTestGoal({
        id: 'test:complex_goal',
        priority: 10,
        goalState: {
          and: [
            {
              or: [
                { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10] },
                { '>=': [{ var: 'state.actor.components.core_needs.health' }, 80] },
              ],
            },
            { '==': [{ var: 'state.actor.components.core_location.position' }, 'home'] },
          ],
        },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = {
        state: setup.buildPlanningState(actor),
        entities: {},
      };

      await setup.controller.decideTurn(actor, world);

      const events = setup.eventBus.getAll();
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.tasks.length).toBeGreaterThan(0);

      // Should include go_home task and at least one of eat/heal
      const taskIds = planCreated.payload.tasks;
      expect(taskIds).toContain('test:go_home');
    });
  });
});
