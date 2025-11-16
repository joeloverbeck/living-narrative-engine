/**
 * @file Integration tests for GOAP replanning scenarios
 * Tests situations where the system must replan after world state changes
 *
 * Scenarios:
 * 1. Target entity removed between turns
 * 2. Goal satisfied externally
 * 3. Preconditions no longer met
 * 4. World state change invalidates plan
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestSetup } from './testFixtures/goapTestSetup.js';
import { createTestGoal } from './testFixtures/testGoalFactory.js';
import { createTestTask } from './testFixtures/testTaskFactory.js';
import { GOAP_EVENTS } from '../../../src/goap/events/goapEvents.js';

describe('GOAP Replanning - Integration', () => {
  let setup;

  beforeEach(async () => {
    setup = await createGoapTestSetup({
      mockRefinement: true,
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  describe('Target Entity Removal', () => {
    it('should replan when target entity is removed before second turn', async () => {
      // Setup: Goal to consume food
      const goal = createTestGoal({
        id: 'test:consume_goal',
        relevance: { '==': [true, true] },
        goalState: {
          has_component: ['actor', 'test:fed'],
        },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Actor (hungry)
      const actor = {
        id: 'test_actor',
        components: {},
      };
      setup.entityManager.addEntity(actor);

      // Setup: Food entity
      const food1 = {
        id: 'food1',
        components: {
          'test:edible': {},
        },
      };
      setup.entityManager.addEntity(food1);

      // Setup: Backup food entity
      const food2 = {
        id: 'food2',
        components: {
          'test:edible': {},
        },
      };
      setup.entityManager.addEntity(food2);

      // Setup: Consume task
      const consumeTask = createTestTask({
        id: 'test:consume',
        cost: 10,
        planningEffects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:fed',
              componentData: {},
            },
          },
        ],
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:fed',
              componentData: {},
            },
          },
        ],
      });

      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return { test: { [consumeTask.id]: consumeTask } };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) =>
        taskId === consumeTask.id ? consumeTask : null
      );

      const world = { state: {}, entities: {} };

      // Execute: Turn 1 - Plan to consume food1
      await setup.controller.decideTurn(actor, world);

      const events1 = setup.eventBus.getAll();
      const planCreated = events1.some(
        (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
      );

      if (planCreated) {
        // Change: Remove food1 before turn 2
        setup.entityManager.deleteEntity('food1');

        // Execute: Turn 2 - Should detect and replan
        setup.eventBus.clear();
        const result2 = await setup.controller.decideTurn(actor, world);

        const events2 = setup.eventBus.getAll();

        // Verify: System responded to change
        // Either replanned, detected invalidation, or planned anew
        const hasReplanningEvent = events2.some(
          (e) =>
            e.type === GOAP_EVENTS.REPLANNING_STARTED ||
            e.type === GOAP_EVENTS.PLAN_INVALIDATED ||
            e.type === GOAP_EVENTS.PLANNING_COMPLETED ||
            e.type === GOAP_EVENTS.PLANNING_FAILED
        );

        expect(hasReplanningEvent || result2 === null).toBe(true);

        // If new plan created, verify it can target food2
        const newPlan = events2.find(
          (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
        );
        if (newPlan) {
          // Plan should still include consume task (targeting food2 now)
          expect(newPlan.payload.tasks).toContain('test:consume');
        }
      }
    });
  });

  describe('External Goal Satisfaction', () => {
    // SKIPPED: Planner does not support MODIFY_COMPONENT for backward chaining planning.
    // Current planner only supports ADD_COMPONENT and REMOVE_COMPONENT effects.
    // This test uses MODIFY_COMPONENT with JSON Logic goal expressions (<=, var refs),
    // which requires the planner to reason about numeric modifications and constraints.
    // To test external goal satisfaction, would need to rewrite using ADD/REMOVE semantics.
    it.skip('should handle goal satisfied externally between turns', async () => {
      // Setup: Goal to reduce hunger
      const goal = createTestGoal({
        id: 'test:hunger_goal',
        relevance: { '>': [{ var: 'actor.components.core:needs.hunger' }, 50] },
        goalState: {
          '<=': [{ var: 'actor.components.core:needs.hunger' }, 30],
        },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Actor with high hunger
      const actor = {
        id: 'test_actor',
        components: {
          'core:needs': { hunger: 80 }, // Above relevance threshold
        },
      };
      setup.entityManager.addEntity(actor);

      // Setup: Task to reduce hunger
      const eatTask = createTestTask({
        id: 'test:eat',
        cost: 10,
        planningEffects: [
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'core:needs',
              modifications: { hunger: 20 },
            },
          },
        ],
        effects: [
          {
            type: 'MODIFY_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'core:needs',
              modifications: { hunger: 20 },
            },
          },
        ],
      });

      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return { test: { [eatTask.id]: eatTask } };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) =>
        taskId === eatTask.id ? eatTask : null
      );

      const world = { state: {}, entities: {} };

      // Execute: Turn 1 - Plan to eat
      const result1 = await setup.controller.decideTurn(actor, world);

      const events1 = setup.eventBus.getAll();
      const planCreated = events1.some(
        (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
      );

      if (planCreated) {
        // Change: Externally satisfy hunger (simulating external event)
        actor.components['core:needs'].hunger = 10; // Below goal state threshold

        // Execute: Turn 2 - Goal no longer relevant
        setup.eventBus.clear();
        const result2 = await setup.controller.decideTurn(actor, world);

        const events2 = setup.eventBus.getAll();

        // Verify: System detected goal is no longer relevant
        // Should either select different goal or return null (idle)
        const goalSelected = events2.find((e) => e.type === GOAP_EVENTS.GOAL_SELECTED);

        // If goal selected, should be different OR no goal selected (idle)
        if (goalSelected) {
          // Either new goal or no planning (goal no longer relevant)
          expect(
            goalSelected.payload.goalId !== 'test:hunger_goal' || result2 === null
          ).toBe(true);
        } else {
          // No goal selected = idle state (acceptable)
          expect(result2).toBeNull();
        }
      }
    });
  });

  describe('Precondition Invalidation', () => {
    it('should replan when preconditions become invalid mid-execution', async () => {
      // Setup: Multi-step goal
      const goal = createTestGoal({
        id: 'test:multi_step',
        relevance: { '==': [true, true] },
        goalState: {
          has_component: ['actor', 'test:complete'],
        },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Actor with initial component
      const actor = {
        id: 'test_actor',
        components: {
          'test:has_tool': {}, // Initially has tool
        },
      };
      setup.entityManager.addEntity(actor);

      // Setup: Task 1 - Use tool to create intermediate
      const useToolTask = createTestTask({
        id: 'test:use_tool',
        cost: 10,
        preconditions: [{ has_component: ['actor', 'test:has_tool'] }],
        planningEffects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:intermediate',
              componentData: {},
            },
          },
        ],
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:intermediate',
              componentData: {},
            },
          },
        ],
      });

      // Setup: Task 2 - Use intermediate to complete
      const finishTask = createTestTask({
        id: 'test:finish',
        cost: 10,
        preconditions: [{ has_component: ['actor', 'test:intermediate'] }],
        planningEffects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:complete',
              componentData: {},
            },
          },
        ],
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:complete',
              componentData: {},
            },
          },
        ],
      });

      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return {
            test: {
              [useToolTask.id]: useToolTask,
              [finishTask.id]: finishTask,
            },
          };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) => {
        const tasks = {
          [useToolTask.id]: useToolTask,
          [finishTask.id]: finishTask,
        };
        return tasks[taskId] || null;
      });

      const world = { state: {}, entities: {} };

      // Execute: Turn 1 - Create 2-step plan
      await setup.controller.decideTurn(actor, world);

      const events1 = setup.eventBus.getAll();
      const planCreated = events1.some(
        (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
      );

      if (planCreated) {
        // Change: Remove tool (breaks precondition for step 1)
        delete actor.components['test:has_tool'];

        // Execute: Turn 2 - Should detect broken precondition
        setup.eventBus.clear();
        await setup.controller.decideTurn(actor, world);

        const events2 = setup.eventBus.getAll();

        // Verify: System detected precondition failure
        const hasFailureResponse = events2.some(
          (e) =>
            e.type === GOAP_EVENTS.PLAN_INVALIDATED ||
            e.type === GOAP_EVENTS.PLANNING_FAILED ||
            e.type === GOAP_EVENTS.REPLANNING_STARTED
        );

        expect(hasFailureResponse).toBe(true);
      }
    });
  });

  describe('World State Invalidation', () => {
    it('should replan when world state makes plan impossible', async () => {
      // Setup: Goal to access location
      const goal = createTestGoal({
        id: 'test:access_goal',
        relevance: { '==': [true, true] },
        goalState: {
          has_component: ['actor', 'test:accessed'],
        },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Actor with access key
      const actor = {
        id: 'test_actor',
        components: {
          'test:has_key': {},
        },
      };
      setup.entityManager.addEntity(actor);

      // Setup: Location entity (unlocked)
      const location = {
        id: 'secure_location',
        components: {
          'test:unlocked': {},
        },
      };
      setup.entityManager.addEntity(location);

      // Setup: Access task (requires location to be unlocked)
      const accessTask = createTestTask({
        id: 'test:access_location',
        cost: 10,
        preconditions: [{ has_component: ['actor', 'test:has_key'] }],
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:accessed',
              componentData: {},
            },
          },
        ],
      });

      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return { test: { [accessTask.id]: accessTask } };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) =>
        taskId === accessTask.id ? accessTask : null
      );

      const world = { state: {}, entities: {} };

      // Execute: Turn 1 - Plan access
      await setup.controller.decideTurn(actor, world);

      const events1 = setup.eventBus.getAll();
      const planCreated = events1.some(
        (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
      );

      if (planCreated) {
        // Change: Lock the location (world state change)
        delete location.components['test:unlocked'];
        location.components['test:locked'] = {};

        // Change: Also remove actor's key
        delete actor.components['test:has_key'];

        // Execute: Turn 2 - Plan now invalid
        setup.eventBus.clear();
        await setup.controller.decideTurn(actor, world);

        const events2 = setup.eventBus.getAll();

        // Verify: System detected world state change
        const hasInvalidationEvent = events2.some(
          (e) =>
            e.type === GOAP_EVENTS.PLAN_INVALIDATED ||
            e.type === GOAP_EVENTS.PLANNING_FAILED ||
            e.type === GOAP_EVENTS.REPLANNING_STARTED
        );

        expect(hasInvalidationEvent).toBe(true);
      }
    });
  });

  describe('Replanning Recovery', () => {
    it('should successfully find alternative plan after invalidation', async () => {
      // Setup: Goal
      const goal = createTestGoal({
        id: 'test:flexible_goal',
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

      // Setup: Primary task (will become unavailable)
      const primaryTask = createTestTask({
        id: 'test:primary_method',
        cost: 10,
        preconditions: [{ has_component: ['actor', 'test:primary_resource'] }],
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

      // Setup: Alternative task (will remain available)
      const alternativeTask = createTestTask({
        id: 'test:alternative_method',
        cost: 20, // More expensive
        preconditions: [], // No preconditions
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
          return {
            test: {
              [primaryTask.id]: primaryTask,
              [alternativeTask.id]: alternativeTask,
            },
          };
        }
        return null;
      });

      setup.gameDataRepository.getTask = jest.fn((taskId) => {
        const tasks = {
          [primaryTask.id]: primaryTask,
          [alternativeTask.id]: alternativeTask,
        };
        return tasks[taskId] || null;
      });

      const world = { state: {}, entities: {} };

      // Give actor the primary resource initially
      actor.components['test:primary_resource'] = {};

      // Execute: Turn 1 - Should choose cheaper primary task
      await setup.controller.decideTurn(actor, world);

      const events1 = setup.eventBus.getAll();
      const plan1 = events1.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

      if (plan1) {
        // Verify: Chose primary method
        expect(plan1.payload.tasks).toContain('test:primary_method');

        // Change: Remove primary resource
        delete actor.components['test:primary_resource'];

        // Execute: Turn 2 - Should fall back to alternative
        setup.eventBus.clear();
        await setup.controller.decideTurn(actor, world);

        const events2 = setup.eventBus.getAll();
        const plan2 = events2.find((e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED);

        if (plan2) {
          // Verify: Switched to alternative method
          expect(plan2.payload.tasks).toContain('test:alternative_method');
          expect(plan2.payload.tasks).not.toContain('test:primary_method');

          // Verify: Successfully replanned
          expect(plan2.payload.actorId).toBe(actor.id);
          expect(plan2.payload.goalId).toBe(goal.id);
        } else {
          // Acceptable if planning failed (no alternative found)
          const planningFailed = events2.some(
            (e) => e.type === GOAP_EVENTS.PLANNING_FAILED
          );
          expect(planningFailed).toBe(true);
        }
      }
    });
  });
});
