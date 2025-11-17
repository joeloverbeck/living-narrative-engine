/**
 * @file Integration tests for GOAP edge case handling
 * @description Tests overshoot scenarios, impossible goals, and complex constraints
 * @see tickets/MULACTPLAFIX-004-edge-case-handling.md
 * @see specs/goap-system-specs.md
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { createGoapTestSetup } from './testFixtures/goapTestSetup.js';
import { createTestGoal } from './testFixtures/testGoalFactory.js';
import { createTestTask } from './testFixtures/testTaskFactory.js';
import { GOAP_PLANNER_FAILURES } from '../../../src/goap/planner/goapPlannerFailureReasons.js';

/**
 * Wrap raw task definitions into the structure expected by the game data repository.
 * The runtime stores tasks by mod namespace, so tests must mirror that layout.
 *
 * @param {Array<object>} taskList - Task definitions to register
 * @param {string} [modId='test'] - Optional namespace identifier
 * @returns {object} Task registry keyed by namespace and task id
 */
function createTaskRegistry(taskList, modId = 'test') {
  if (!taskList || taskList.length === 0) {
    return {};
  }

  return {
    [modId]: taskList.reduce((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {}),
  };
}


describe('GOAP Edge Cases', () => {
  let setup;

  afterEach(() => {
    if (setup && setup.testBed) {
      setup.testBed.cleanup();
    }
  });

  describe('Overshoot handling', () => {
    it('should allow overshoot for inequality goals (hunger ≤ 10)', async () => {
      // Scenario: hunger = 15, eat task reduces by 60, goal is hunger ≤ 10
      // After eat: 15 - 60 = -45 → clamped to 0
      // Goal check: 0 ≤ 10 → TRUE (overshoot allowed)

      const eatTask = createTestTask({
        id: 'test:eat',
        cost: 10,
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
              component_type: 'test:hunger',
              field: 'value',
              mode: 'decrement',
              value: 60,
            },
          },
        ],
      });

      setup = await createGoapTestSetup({
        tasks: createTaskRegistry([eatTask]),
      });

      const actor = {
        id: 'actor-1',
        components: {
          'test:hunger': { value: 15 },
        },
      };

      setup.registerPlanningActor(actor);

      const state = setup.buildPlanningState(actor);

      const goal = createTestGoal({
        id: 'test:stay_fed',
        description: 'Keep hunger low',
        priority: 10,
        goalState: {
          '<=': [{ var: 'state.actor.components.test_hunger.value' }, 10],
        },
      });

      const plan = await setup.planner.plan(actor.id, goal, state, {
        maxCost: 100,
        actorId: actor.id,
      });

      expect(plan).not.toBeNull();
      expect(plan.tasks).toHaveLength(1);
      expect(plan.tasks[0].taskId).toBe('test:eat');
      expect(plan.cost).toBe(10);
    });

    it('should achieve exact equality goals without overshoot (gold = 100)', async () => {
      // Scenario: gold = 75, mine task adds 25, goal is gold = 100
      // After mine: 75 + 25 = 100 (exact match)

      const mineTask = createTestTask({
        id: 'test:mine',
        cost: 15,
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
              component_type: 'test:gold',
              field: 'value',
              mode: 'increment',
              value: 25,
            },
          },
        ],
      });

      setup = await createGoapTestSetup({
        tasks: createTaskRegistry([mineTask]),
      });

      const actor = {
        id: 'actor-1',
        components: {
          'test:gold': { value: 75 },
        },
      };

      setup.registerPlanningActor(actor);

      const state = setup.buildPlanningState(actor);

      const goal = createTestGoal({
        id: 'test:get_rich',
        description: 'Acquire exactly 100 gold',
        priority: 10,
        goalState: {
          '==': [{ var: 'state.actor.components.test_gold.value' }, 100],
        },
      });

      const plan = await setup.planner.plan(actor.id, goal, state, {
        maxCost: 100,
        actorId: actor.id,
      });

      expect(plan).not.toBeNull();
      expect(plan.tasks).toHaveLength(1);
      expect(plan.tasks[0].taskId).toBe('test:mine');
      expect(plan.cost).toBe(15);
    });
  });

  describe('Impossible goals', () => {
    it('should detect wrong direction tasks (task increases hunger when goal is to reduce)', async () => {
      // Scenario: hunger = 50, eat_more task INCREASES hunger by 20
      // Goal is to reduce hunger to ≤ 10
      // Task moves in wrong direction (distance increases)

      const eatMoreTask = createTestTask({
        id: 'test:eat_more',
        cost: 5,
        priority: 100,
        structuralGates: {
          description: 'Actor can eat more',
          condition: { '==': [1, 1] },
        },
        planningEffects: [
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entity_ref: 'actor',
              component_type: 'test:hunger',
              field: 'value',
              mode: 'increment',
              value: 20, // WRONG DIRECTION
            },
          },
        ],
      });

      setup = await createGoapTestSetup({
        tasks: createTaskRegistry([eatMoreTask]),
      });

      const actor = {
        id: 'actor-1',
        components: {
          'test:hunger': { value: 50 },
        },
      };

      setup.registerPlanningActor(actor);

      const state = setup.buildPlanningState(actor);

      const goal = createTestGoal({
        id: 'test:stay_fed',
        description: 'Reduce hunger',
        priority: 10,
        goalState: {
          '<=': [{ var: 'state.actor.components.test_hunger.value' }, 10],
        },
      });

      const plan = await setup.planner.plan(actor.id, goal, state, {
        maxCost: 100,
        actorId: actor.id,
      });

      // Plan should fail (null) because task moves in wrong direction
      expect(plan).toBeNull();
    });

    it('should detect insufficient task effect (too many actions required)', async () => {
      // Scenario: hunger = 100, nibble task reduces by 1
      // Goal is hunger ≤ 0, maxCost is 50
      // Need 100 actions * cost 10 = 1000 > maxCost

      const nibbleTask = createTestTask({
        id: 'test:nibble',
        cost: 10,
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
              component_type: 'test:hunger',
              field: 'value',
              mode: 'decrement',
              value: 1, // Tiny effect
            },
          },
        ],
      });

      setup = await createGoapTestSetup({
        tasks: createTaskRegistry([nibbleTask]),
      });

      const actor = {
        id: 'actor-1',
        components: {
          'test:hunger': { value: 100 },
        },
      };

      setup.registerPlanningActor(actor);

      const state = setup.buildPlanningState(actor);

      const goal = createTestGoal({
        id: 'test:eliminate_hunger',
        description: 'Reduce hunger to zero',
        priority: 10,
        goalState: {
          '<=': [{ var: 'state.actor.components.test_hunger.value' }, 0],
        },
        maxCost: 50, // Too low for 100 actions
      });

      const plan = await setup.planner.plan(actor.id, goal, state, {
        maxCost: 50,
        actorId: actor.id,
      });

      // Plan should fail (null) because cost limit exceeded
      expect(plan).toBeNull();
    });

    it('should handle no applicable tasks scenario', async () => {
      // Scenario: No tasks pass structural gates
      // Planning should fail with PLANNING_FAILED event

      setup = await createGoapTestSetup({
        tasks: {}, // No tasks available
      });

      const actor = {
        id: 'actor-1',
        components: {
          'test:hunger': { value: 100 },
        },
      };

      setup.registerPlanningActor(actor);

      const state = setup.buildPlanningState(actor);

      const goal = createTestGoal({
        id: 'test:stay_fed',
        description: 'Reduce hunger',
        priority: 10,
        goalState: {
          '<=': [{ var: 'state.actor.components.test_hunger.value' }, 10],
        },
      });

      const plan = await setup.planner.plan(actor.id, goal, state, {
        maxCost: 100,
        actorId: actor.id,
      });

      expect(plan).toBeNull();
    });
  });

  describe('Complex goals', () => {
    it('should handle multiple numeric constraints (hunger ≤ 10 AND health ≥ 80)', async () => {
      // Scenario: Achieve both hunger reduction and health increase
      // Need both eat and heal tasks in the plan

      const eatTask = createTestTask({
        id: 'test:eat',
        cost: 10,
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
              component_type: 'test:hunger',
              field: 'value',
              mode: 'decrement',
              value: 30,
            },
          },
        ],
      });

      const healTask = createTestTask({
        id: 'test:heal',
        cost: 15,
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
              component_type: 'test:health',
              field: 'value',
              mode: 'increment',
              value: 30,
            },
          },
        ],
      });

      setup = await createGoapTestSetup({
        tasks: createTaskRegistry([eatTask, healTask]),
      });

      const actor = {
        id: 'actor-1',
        components: {
          'test:hunger': { value: 60 },
          'test:health': { value: 50 },
        },
      };

      setup.registerPlanningActor(actor);

      const state = setup.buildPlanningState(actor);

      const goal = createTestGoal({
        id: 'test:survive',
        description: 'Be healthy and fed',
        priority: 10,
        goalState: {
          and: [
            {
              '<=': [{ var: 'state.actor.components.test_hunger.value' }, 10],
            },
            {
              '>=': [{ var: 'state.actor.components.test_health.value' }, 80],
            },
          ],
        },
      });

      const plan = await setup.planner.plan(actor.id, goal, state, {
        maxCost: 200,
        actorId: actor.id,
      });

      expect(plan).not.toBeNull();
      expect(plan.tasks.length).toBeGreaterThan(0);

      // Should include both eat and heal tasks
      const taskIds = plan.tasks.map((t) => t.taskId);
      expect(taskIds).toContain('test:eat');
      expect(taskIds).toContain('test:heal');
    });
  });

  describe('Goal type detection diagnostics', () => {
    it('should log goal type information during planning', async () => {
      const eatTask = createTestTask({
        id: 'test:eat',
        cost: 10,
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
              component_type: 'test:hunger',
              field: 'value',
              mode: 'decrement',
              value: 60,
            },
          },
        ],
      });

      setup = await createGoapTestSetup({
        tasks: createTaskRegistry([eatTask]),
      });

      const actor = {
        id: 'actor-1',
        components: {
          'test:hunger': { value: 15 },
        },
      };

      setup.registerPlanningActor(actor);

      const state = setup.buildPlanningState(actor);

      const goal = createTestGoal({
        id: 'test:stay_fed',
        description: 'Keep hunger low',
        priority: 10,
        goalState: {
          '<=': [{ var: 'state.actor.components.test_hunger.value' }, 10],
        },
      });

      const plan = await setup.planner.plan(actor.id, goal, state, {
        maxCost: 100,
        actorId: actor.id,
      });

      expect(plan).not.toBeNull();

      // Verify diagnostic logging occurred
      // (Check logger calls if mock logger is available in setup)
      // This is a placeholder for actual logging verification
    });
  });

  describe('Setup guardrails', () => {
    it('should surface invalid planning effects with failure code', async () => {
      const invalidTask = createTestTask({
        id: 'test:invalid_effect',
        planningEffects: [
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              // Missing component_type on purpose to trigger validation
              field: 'value',
              mode: 'decrement',
              value: 10,
            },
          },
        ],
      });

      setup = await createGoapTestSetup({
        tasks: {
          test: {
            [invalidTask.id]: invalidTask,
          },
        },
      });

      const actor = {
        id: 'actor-invalid',
        components: {
          'test:hunger': { value: 50 },
        },
      };

      setup.registerPlanningActor(actor);

      const goal = createTestGoal({
        id: 'test:reduce_hunger_invalid',
        priority: 5,
        goalState: {
          '<=': [{ var: 'state.actor.components.test_hunger.value' }, 10],
        },
      });

      const state = setup.buildPlanningState(actor);
      const plan = setup.planner.plan(actor.id, goal, state, { maxCost: 100 });

      expect(plan).toBeNull();
      const failure = setup.planner.getLastFailure();
      expect(failure).toEqual(
        expect.objectContaining({
          code: GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION,
        })
      );
    });
  });
});
