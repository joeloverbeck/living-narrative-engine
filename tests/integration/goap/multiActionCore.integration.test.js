/**
 * @file Core multi-action planning integration tests
 * @description Tests fundamental multi-action planning scenarios
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

describe('Core Multi-Action Planning', () => {
  let setup;

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  describe('Test 1.1: Exact Multiple Actions', () => {
    it('should plan exactly N actions when N * effect = distance', async () => {
      // Initial: hunger = 100
      // Task: eat (-25 hunger, cost 5)
      // Goal: hunger ≤ 0
      // Expected: 4 actions (100/25 = 4)

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
              value: 25,
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
          'core:needs': { hunger: 100 },
        },
      };
      setup.registerPlanningActor(actor);

      const goal = createTestGoal({
        id: 'test:reduce_hunger',
        priority: 10,
        goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 0] },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = {
        state: setup.buildPlanningState(actor),
        entities: {},
      };

      await setup.controller.decideTurn(actor, world);

      const events = setup.eventBus.getEvents();
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.planLength).toBe(4);
      expect(planCreated.payload.tasks).toHaveLength(4);
      expect(planCreated.payload.tasks.every((taskId) => taskId === 'test:eat')).toBe(true);
    });
  });

  describe('Test 1.2: Ceiling Division', () => {
    it('should round up action count when distance not evenly divisible', async () => {
      // Initial: hunger = 90
      // Task: eat (-60 hunger, cost 5)
      // Goal: hunger ≤ 10
      // Distance: 80, Actions needed: Math.ceil(80 / 60) = 2

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
          'core:needs': { hunger: 90 },
        },
      };
      setup.registerPlanningActor(actor);

      const goal = createTestGoal({
        id: 'test:reduce_hunger',
        priority: 10,
        goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10] },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = {
        state: setup.buildPlanningState(actor),
        entities: {},
      };

      await setup.controller.decideTurn(actor, world);

      const events = setup.eventBus.getEvents();
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.planLength).toBe(2);
      expect(planCreated.payload.tasks).toHaveLength(2);
    });
  });

  describe('Test 1.3: Overshoot Allowed', () => {
    it('should allow overshoot for inequality goals', async () => {
      // Initial: hunger = 15
      // Task: eat (-60 hunger)
      // Goal: hunger ≤ 10
      // After 1: -45 → 0 (satisfies ≤ 10)

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
          'core:needs': { hunger: 15 },
        },
      };
      setup.registerPlanningActor(actor);

      const goal = createTestGoal({
        id: 'test:reduce_hunger',
        priority: 10,
        goalState: { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10] },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = {
        state: setup.buildPlanningState(actor),
        entities: {},
      };

      await setup.controller.decideTurn(actor, world);

      const events = setup.eventBus.getEvents();
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.planLength).toBe(1);
      expect(planCreated.payload.tasks).toHaveLength(1);
    });
  });

  describe('Test 1.4: Multiple Task Types', () => {
    it('should handle multi-action with different task types', async () => {
      // Initial: hunger = 100, health = 10
      // Tasks: eat (-60 hunger), heal (+30 health)
      // Goal: hunger ≤ 10 AND health ≥ 80

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

      const healTask = createTestTask({
        id: 'test:heal',
        cost: 5,
        priority: 100,
        structuralGates: {
          description: 'Actor can heal',
          condition: { '==': [1, 1] },
        },
        planningEffects: [
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'core:needs',
              field: 'health',
              value: 30,
              mode: 'increment',
            },
          },
        ],
      });

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: {
            [eatTask.id]: eatTask,
            [healTask.id]: healTask,
          },
        },
      });

      const actor = {
        id: 'test_actor',
        components: {
          'core:needs': { hunger: 100, health: 10 },
        },
      };
      setup.registerPlanningActor(actor);

      const goal = createTestGoal({
        id: 'test:reduce_hunger_and_heal',
        priority: 10,
        goalState: {
          and: [
            { '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 10] },
            { '>=': [{ var: 'state.actor.components.core_needs.health' }, 80] },
          ],
        },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = {
        state: setup.buildPlanningState(actor),
        entities: {},
      };

      await setup.controller.decideTurn(actor, world);

      const events = setup.eventBus.getEvents();
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.planLength).toBe(5);
      expect(planCreated.payload.tasks).toHaveLength(5);

      const eatCount = planCreated.payload.tasks.filter(
        (taskId) => taskId === 'test:eat'
      ).length;
      const healCount = planCreated.payload.tasks.filter(
        (taskId) => taskId === 'test:heal'
      ).length;

      expect(eatCount).toBe(2);
      expect(healCount).toBe(3);
    });
  });

  describe('Test 1.5: Large Action Sequences', () => {
    it('should handle large action sequences efficiently', async () => {
      // Initial: gold = 0
      // Task: mine (+5 gold, cost 1)
      // Goal: gold ≥ 100
      // Expected: 20 actions (100/5 = 20)

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

      setup = await createGoapTestSetup({
        mockRefinement: true,
        tasks: {
          test: {
            [mineTask.id]: mineTask,
          },
        },
      });

      const actor = {
        id: 'test_actor',
        components: {
          'core:resources': { gold: 0 },
        },
      };
      setup.registerPlanningActor(actor);

      const goal = createTestGoal({
        id: 'test:gather_gold',
        priority: 10,
        goalState: { '>=': [{ var: 'state.actor.components.core_resources.gold' }, 100] },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = {
        state: setup.buildPlanningState(actor),
        entities: {},
      };

      await setup.controller.decideTurn(actor, world);

      const events = setup.eventBus.getEvents();
      console.log('[TEST DEBUG] Events:', events.map(e => e.type));
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      const activePlan = setup.controller.getActivePlan(actor.id);
      console.log('[TEST DEBUG] Active plan:', activePlan);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.planLength).toBe(20);
      expect(planCreated.payload.tasks).toHaveLength(20);
    });
  });

  describe('Test 1.6: Zero to Target', () => {
    it('should accumulate from zero to target', async () => {
      // Initial: gold = 0
      // Task: mine (+25 gold)
      // Goal: gold ≥ 75
      // Expected: 3 actions (0 → 25 → 50 → 75)

      const mineTask = createTestTask({
        id: 'test:mine',
        cost: 2,
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
              value: 25,
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
          },
        },
      });

      const actor = {
        id: 'test_actor',
        components: {
          'core:resources': { gold: 0 },
        },
      };
      setup.registerPlanningActor(actor);

      const goal = createTestGoal({
        id: 'test:gather_gold',
        priority: 10,
        goalState: { '>=': [{ var: 'state.actor.components.core_resources.gold' }, 75] },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = {
        state: setup.buildPlanningState(actor),
        entities: {},
      };

      await setup.controller.decideTurn(actor, world);

      const events = setup.eventBus.getEvents();
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.planLength).toBe(3);
      expect(planCreated.payload.tasks).toHaveLength(3);
    });
  });

  describe('Test 1.7: Exact Target (No Overflow)', () => {
    it('should reach exact target without overflow', async () => {
      // Initial: gold = 50
      // Task: mine (+25 gold)
      // Goal: gold = 100
      // Expected: 2 actions (50 → 75 → 100) ✓ Exact

      const mineTask = createTestTask({
        id: 'test:mine',
        cost: 2,
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
              value: 25,
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
          },
        },
      });

      const actor = {
        id: 'test_actor',
        components: {
          'core:resources': { gold: 50 },
        },
      };
      setup.registerPlanningActor(actor);

      const goal = createTestGoal({
        id: 'test:gather_gold',
        priority: 10,
        goalState: { '==': [{ var: 'state.actor.components.core_resources.gold' }, 100] },
      });

      setup.dataRegistry.register('goals', goal.id, goal);

      const world = {
        state: setup.buildPlanningState(actor),
        entities: {},
      };

      await setup.controller.decideTurn(actor, world);

      const events = setup.eventBus.getEvents();
      const planCreated = events.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      expect(planCreated).toBeDefined();
      expect(planCreated.payload.planLength).toBe(2);
      expect(planCreated.payload.tasks).toHaveLength(2);
    });
  });
});
