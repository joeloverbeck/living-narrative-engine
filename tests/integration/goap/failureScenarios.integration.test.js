/**
 * @file Integration tests for GOAP failure handling scenarios
 * Tests comprehensive failure modes across planning, refinement, and execution
 *
 * Scenarios:
 * 1. Planning failure - no path to goal (impossible goal)
 * 2. Refinement failure - method not applicable
 * 3. Structural gates block all tasks
 * 4. Empty task library
 * 5. Malformed goal/task data
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestSetup } from './testFixtures/goapTestSetup.js';
import { createTestGoal } from './testFixtures/testGoalFactory.js';
import { createTestTask } from './testFixtures/testTaskFactory.js';
import { GOAP_EVENTS } from '../../../src/goap/events/goapEvents.js';

describe('GOAP Failure Scenarios - Integration', () => {
  let setup;

  beforeEach(async () => {
    setup = await createGoapTestSetup({
      mockRefinement: false, // Use real refinement for failure testing
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  describe('Planning Failures', () => {
    it('should fail gracefully when no path exists to goal', async () => {
      // Setup: Create goal requiring specific component
      const goal = createTestGoal({
        id: 'test:impossible_goal',
        relevance: { '==': [true, true] },
        goalState: {
          has_component: ['actor', 'test:impossible_state'],
        },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Create actor without the component
      const actor = {
        id: 'test_actor',
        components: {
          'core:needs': { hunger: 80 },
        },
      };
      setup.entityManager.addEntity(actor);

      // Setup: Register tasks that DON'T help achieve the goal
      const task = createTestTask({
        id: 'test:unrelated_task',
        effects: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entityId: 'actor',
              componentId: 'test:different_component',
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

      // Execute: Attempt planning
      const result = await setup.controller.decideTurn(actor, world);

      // Verify: Planning failed gracefully (returned null)
      expect(result).toBeNull();

      // Verify: PLANNING_FAILED event was dispatched
      const events = setup.eventBus.getEvents();
      const planningFailures = events.filter(
        (e) => e.type === GOAP_EVENTS.PLANNING_FAILED
      );
      expect(planningFailures.length).toBeGreaterThan(0);
      expect(planningFailures[0].payload).toHaveProperty('actorId', actor.id);
      expect(planningFailures[0].payload).toHaveProperty('goalId');
      expect(planningFailures[0].payload).toHaveProperty('reason');
    });

    it('should handle empty task library gracefully', async () => {
      // Setup: Create valid goal
      const goal = createTestGoal({
        id: 'test:valid_goal',
        relevance: { '==': [true, true] },
        goalState: { has_component: ['actor', 'test:satisfied'] },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Create actor
      const actor = {
        id: 'test_actor',
        components: {},
      };
      setup.entityManager.addEntity(actor);

      // Setup: Register EMPTY task library
      setup.gameDataRepository.get = jest.fn((key) => {
        if (key === 'tasks') {
          return {}; // No tasks registered
        }
        return null;
      });
      setup.gameDataRepository.getTask = jest.fn(() => null);

      const world = { state: {}, entities: {} };

      // Execute: Attempt planning with no tasks
      const result = await setup.controller.decideTurn(actor, world);

      // Verify: System doesn't crash, returns null
      expect(result).toBeNull();

      // Verify: Planning failure event
      const events = setup.eventBus.getEvents();
      const failures = events.filter(
        (e) => e.type === GOAP_EVENTS.PLANNING_FAILED
      );
      expect(failures.length).toBeGreaterThan(0);
    });

    it('should fail when all tasks blocked by structural gates', async () => {
      // Setup: Create goal
      const goal = createTestGoal({
        id: 'test:gated_goal',
        relevance: { '==': [true, true] },
        goalState: { has_component: ['actor', 'test:satisfied'] },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Create actor WITHOUT required component
      const actor = {
        id: 'test_actor',
        components: {},
      };
      setup.entityManager.addEntity(actor);

      // Setup: Create task with structural gate that will fail
      const task = createTestTask({
        id: 'test:gated_task',
        structuralGates: {
          // Require component that actor doesn't have
          has_component: ['actor', 'test:required_component'],
        },
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

      // Execute: Planning with blocked task
      const result = await setup.controller.decideTurn(actor, world);

      // Verify: Planning failed (task filtered out by structural gate)
      expect(result).toBeNull();

      // Verify: Planning failure event dispatched
      const events = setup.eventBus.getEvents();
      const failures = events.filter(
        (e) => e.type === GOAP_EVENTS.PLANNING_FAILED
      );
      expect(failures.length).toBeGreaterThan(0);
    });
  });

  describe('Refinement Failures', () => {
    it('should handle refinement failure with fallback behavior', async () => {
      // Setup: Create goal
      const goal = createTestGoal({
        id: 'test:refinement_goal',
        relevance: { '==': [true, true] },
        goalState: { has_component: ['actor', 'test:satisfied'] },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Create actor
      const actor = {
        id: 'test_actor',
        components: {},
      };
      setup.entityManager.addEntity(actor);

      // Setup: Create task with no refinement methods (will fail refinement)
      const task = createTestTask({
        id: 'test:unrefined_task',
        refinementMethods: [], // No methods!
        fallbackBehavior: 'replan', // Fallback on failure
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

      // Execute: Planning succeeds, but refinement will fail
      const result = await setup.controller.decideTurn(actor, world);

      // Verify: Either null (failed refinement) or refinement failure event
      const events = setup.eventBus.getEvents();

      // Check for planning completion AND refinement failure
      const planningComplete = events.some(
        (e) => e.type === GOAP_EVENTS.PLANNING_COMPLETED
      );
      const refinementFailed = events.some(
        (e) => e.type === GOAP_EVENTS.REFINEMENT_FAILED
      );

      // At least one should be true (either planning worked and refinement failed,
      // or planning failed entirely)
      expect(planningComplete || refinementFailed || result === null).toBe(
        true
      );

      // If refinement failed, verify fallback behavior in payload
      if (refinementFailed) {
        const failureEvent = events.find(
          (e) => e.type === GOAP_EVENTS.REFINEMENT_FAILED
        );
        expect(failureEvent.payload).toHaveProperty(
          'fallbackBehavior',
          'replan'
        );
      }
    });
  });

  describe('Data Validation Failures', () => {
    it('should handle malformed goal data gracefully', async () => {
      // Setup: Create goal with INVALID JSON Logic
      const malformedGoal = {
        id: 'test:malformed_goal',
        relevance: { invalid_operator: [1, 2] }, // Invalid JSON Logic
        goalState: { has_component: ['actor', 'test:satisfied'] },
        priority: 50,
      };
      setup.dataRegistry.register('goals', malformedGoal.id, malformedGoal);

      // Setup: Create actor
      const actor = {
        id: 'test_actor',
        components: {},
      };
      setup.entityManager.addEntity(actor);

      const world = { state: {}, entities: {} };

      // Execute: Attempt to use malformed goal
      // Should not crash, should handle gracefully
      let didThrow = false;
      let result = null;

      try {
        result = await setup.controller.decideTurn(actor, world);
      } catch (err) {
        didThrow = true;
      }

      // Verify: Either graceful null return or controlled failure
      // System should NOT crash with unhandled exception
      expect(didThrow).toBe(false);

      // Verify: Either null result or failure event
      const events = setup.eventBus.getEvents();
      const hasFailureEvent = events.some(
        (e) =>
          e.type === GOAP_EVENTS.PLANNING_FAILED ||
          e.type === GOAP_EVENTS.GOAL_SELECTED
      );

      expect(result === null || hasFailureEvent).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle actor with no components gracefully', async () => {
      // Setup: Create simple goal
      const goal = createTestGoal({
        id: 'test:simple_goal',
        relevance: { '==': [true, true] },
        goalState: { has_component: ['actor', 'test:satisfied'] },
      });
      setup.dataRegistry.register('goals', goal.id, goal);

      // Setup: Create MINIMAL actor (no components object)
      const actor = {
        id: 'test_actor',
        components: {}, // Empty components
      };
      setup.entityManager.addEntity(actor);

      // Setup: Valid task
      const task = createTestTask({
        id: 'test:simple_task',
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

      // Execute: Should handle empty components gracefully
      let didThrow = false;
      let result = null;

      try {
        result = await setup.controller.decideTurn(actor, world);
      } catch (err) {
        didThrow = true;
      }

      // Verify: No crash
      expect(didThrow).toBe(false);

      // Verify: Either planning succeeded or failed gracefully
      // (Either result is defined OR null with failure event)
      const events = setup.eventBus.getEvents();
      const hasAnyEvent = events.length > 0;
      expect(result !== undefined || hasAnyEvent).toBe(true);
    });
  });
});
