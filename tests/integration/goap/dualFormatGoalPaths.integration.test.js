/**
 * @file Regression tests for dual-format GOAP planning states
 *
 * Verifies canonical goal paths avoid GOAP_INVALID_GOAL_PATH warnings and
 * defensive normalization only warns once while planning still succeeds.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { createGoapTestSetup } from './testFixtures/goapTestSetup.js';
import { createTestGoal } from './testFixtures/testGoalFactory.js';
import { createTestTask } from './testFixtures/testTaskFactory.js';
import { GOAP_EVENTS } from '../../../src/goap/events/goapEvents.js';

/**
 * Build a minimal hunger-reduction task for the regression scenarios.
 *
 * @returns {object} Hunger task definition.
 */
function createHungerTask() {
  return createTestTask({
    id: 'test:eat',
    cost: 5,
    priority: 100,
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
}

/**
 * Create an actor fixture with hunger state for dual-format planning.
 *
 * @returns {object} Actor fixture with hunger state.
 */
function createHungerActor() {
  return {
    id: 'dual-format-actor',
    components: {
      'core:needs': { hunger: 80 },
    },
  };
}

/**
 * Extract planner warnings that were tagged as GOAP goal-path violations.
 *
 * @param {{ warn: import('jest').Mock }} logger - Logger mock to inspect.
 * @returns {Array<[unknown, { code?: string }]>} Logged warning calls.
 */
function collectGoalPathWarnings(logger) {
  return logger.warn.mock.calls.filter(([, payload]) => payload?.code === 'GOAP_INVALID_GOAL_PATH');
}

describe('GOAP dual-format goal path integration', () => {
  let setup;

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
    setup = null;
  });

  it('plans without warnings when goal paths use state.actor.components.*', async () => {
    const task = createHungerTask();
    setup = await createGoapTestSetup({
      mockRefinement: true,
      tasks: {
        test: {
          [task.id]: task,
        },
      },
    });

    const actor = createHungerActor();
    setup.registerPlanningActor(actor);

    const canonicalGoal = createTestGoal({
      id: 'test:normalize_goal_paths',
      goalState: {
        '<=': [{ var: 'state.actor.components.core_needs.hunger' }, 20],
      },
    });
    setup.dataRegistry.register('goals', canonicalGoal.id, canonicalGoal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };

    await setup.controller.decideTurn(actor, world);

    const planningEvents = setup.eventBus.dispatch.mock.calls.filter(
      ([eventType]) => eventType === GOAP_EVENTS.PLANNING_COMPLETED
    );
    expect(planningEvents).toHaveLength(1);
    expect(planningEvents[0]?.[1]?.tasks).toEqual(['test:eat']);

    const warnings = collectGoalPathWarnings(setup.plannerLogger);
    expect(warnings).toHaveLength(0);
  });

  it('logs a single warning yet keeps planning when goal paths rely on actor.*', async () => {
    const task = createHungerTask();
    setup = await createGoapTestSetup({
      mockRefinement: true,
      tasks: {
        test: {
          [task.id]: task,
        },
      },
    });

    const actor = createHungerActor();
    setup.registerPlanningActor(actor);

    const nonCanonicalGoal = createTestGoal({
      id: 'test:normalize_goal_paths_legacy',
      goalState: {
        '<=': [{ var: 'state.actor.core_needs.hunger' }, 20],
      },
    });
    setup.dataRegistry.register('goals', nonCanonicalGoal.id, nonCanonicalGoal);

    const world = {
      state: setup.buildPlanningState(actor),
      entities: {},
    };

    await setup.controller.decideTurn(actor, world);
    await setup.controller.decideTurn(actor, world);

    const planningFailures = setup.eventBus.dispatch.mock.calls.filter(
      ([eventType]) => eventType === GOAP_EVENTS.PLANNING_FAILED
    );
    expect(planningFailures).toHaveLength(2);
    planningFailures.forEach(([, payload]) => {
      expect(payload?.code).toBe('DISTANCE_GUARD_BLOCKED');
      expect(payload?.goalId).toBe(nonCanonicalGoal.id);
    });

    const warnings = collectGoalPathWarnings(setup.plannerLogger);
    expect(warnings).toHaveLength(1);
    expect(warnings[0][1]).toMatchObject({
      actorId: actor.id,
      goalId: nonCanonicalGoal.id,
      code: 'GOAP_INVALID_GOAL_PATH',
    });

    const diagnostics = setup.controller.getGoalPathDiagnostics(actor.id);
    expect(diagnostics).toMatchObject({
      actorId: actor.id,
      totalViolations: expect.any(Number),
    });
    expect(diagnostics.entries[0].violations[0].path).toBe('state.actor.core_needs.hunger');
  });
});
