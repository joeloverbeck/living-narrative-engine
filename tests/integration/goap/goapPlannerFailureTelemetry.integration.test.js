/**
 * @file Integration test ensuring fatal initial heuristic failures emit telemetry once
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createGoapTestSetup } from './testFixtures/goapTestSetup.js';
import { createTestGoal } from './testFixtures/testGoalFactory.js';
import { GOAP_EVENTS } from '../../../src/goap/events/goapEvents.js';
import { GOAP_PLANNER_FAILURES } from '../../../src/goap/planner/goapPlannerFailureReasons.js';

describe('GOAP planner failure telemetry', () => {
  let setup;

  beforeEach(async () => {
    const noopTask = {
      id: 'test:noop',
      cost: 1,
      planningEffects: [],
    };

    setup = await createGoapTestSetup({
      tasks: {
        diagnostics: {
          [noopTask.id]: noopTask,
        },
      },
      mockRefinement: true,
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  it('emits deterministic telemetry when the initial heuristic throws', async () => {
    const actorDef = {
      id: 'telemetry_actor',
      components: {
        'test:ready': {},
      },
    };
    const { actor, planningState } = setup.registerPlanningActor(actorDef);
    await setup.registerPlanningStateSnapshot(planningState);

    const goal = createTestGoal({
      id: 'test:fatal_initial_heuristic_goal',
      goalState: { '==': [{ var: 'actor.components.test_goal_complete' }, true] },
    });
    setup.registerGoal(goal);

    const heuristicSpy = jest.spyOn(setup.heuristicRegistry, 'calculate');
    heuristicSpy.mockImplementation((heuristicId) => {
      if (heuristicId === 'goal-distance') {
        throw new Error('deterministic initial heuristic failure');
      }
      return 0;
    });

    try {
      const result = await setup.controller.decideTurn(actor, { state: planningState });

      expect(result).toBeNull();

      const planningFailedEvents =
        setup.eventBus.getEvents(GOAP_EVENTS.PLANNING_FAILED);
      expect(planningFailedEvents).toHaveLength(1);
      expect(planningFailedEvents[0].payload).toEqual(
        expect.objectContaining({
          actorId: actor.id,
          goalId: goal.id,
          code: GOAP_PLANNER_FAILURES.INITIAL_HEURISTIC_FAILED,
          reason: 'Initial heuristic calculation failed',
        })
      );

      expect(setup.plannerLogger.error).toHaveBeenCalledWith(
        'Initial heuristic calculation failed',
        expect.any(Error),
        expect.objectContaining({
          actorId: actor.id,
          goalId: goal.id,
          heuristicId: 'goal-distance',
          nodesExpanded: 0,
          closedSetSize: 0,
          failureStats: expect.any(Object),
          failureCode: GOAP_PLANNER_FAILURES.INITIAL_HEURISTIC_FAILED,
        })
      );

      const heuristicWarns = setup.plannerLogger.warn.mock.calls.filter(
        ([message]) => message === 'Heuristic produced invalid value'
      );
      expect(heuristicWarns).toHaveLength(1);
      expect(heuristicWarns[0][1]).toEqual(
        expect.objectContaining({
          actorId: actor.id,
          goalId: goal.id,
          heuristicId: 'goal-distance',
          phase: 'initial-node',
          reason: expect.stringContaining('threw during calculation'),
        })
      );
    } finally {
      heuristicSpy.mockRestore();
    }
  });
});
