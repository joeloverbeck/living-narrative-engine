import { describe, it, expect } from '@jest/globals';
import { GOAP_PLANNER_FAILURES } from '../../../../src/goap/planner/goapPlannerFailureReasons.js';
import { createPlannerHarness } from './helpers/createPlannerHarness.js';

const ACTOR_ID = 'distance-guard-actor';
const STATE_KEY = `${ACTOR_ID}:core:hunger`;

const baseTask = {
  id: 'core:reduce_hunger',
  planningEffects: [
    {
      operation: 'MODIFY_COMPONENT',
      component: 'core:hunger',
      field: 'value',
      modifier: { decrement: 50 },
    },
  ],
  boundParams: {},
};

const numericGoal = {
  id: 'distance-guard-goal',
  goalState: {
    '<=': [{ var: `${ACTOR_ID}.core.hunger` }, 30],
  },
};

/**
 *
 * @param value
 */
function createState(value) {
  return {
    [STATE_KEY]: value,
  };
}

describe('GoapPlanner.distanceGuard.property', () => {
  it('never returns false solely because of heuristic sanitization', () => {
    const invalidOutputs = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -5,
      new Error('heuristic exploded'),
    ];

    for (let iteration = 0; iteration < 25; iteration += 1) {
      const { planner, mocks } = createPlannerHarness({ actorId: ACTOR_ID });

      mocks.effectsSimulator.simulateEffects.mockReturnValue({
        success: true,
        state: { [STATE_KEY]: Math.max(0, 70 - iteration) },
      });

      const sanitizedFirst = iteration % 2 === 0;
      const invalidSample = invalidOutputs[iteration % invalidOutputs.length];
      const heuristicSequence = sanitizedFirst ? [invalidSample, 0] : [20, invalidSample];

      let callIndex = 0;
      mocks.heuristicRegistry.calculate.mockImplementation(() => {
        const next = heuristicSequence[callIndex];
        callIndex += 1;
        if (next instanceof Error) {
          throw next;
        }
        return next;
      });

      const result = planner.testTaskReducesDistance(baseTask, createState(80), numericGoal, ACTOR_ID);

      expect(result).toBe(true);
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'Heuristic produced invalid value',
        expect.objectContaining({
          actorId: ACTOR_ID,
          heuristicId: 'goal-distance',
        })
      );
      expect(mocks.logger.debug).toHaveBeenCalledWith(
        'Heuristic distance invalid, bypassing guard',
        expect.objectContaining({
          taskId: baseTask.id,
          goalId: numericGoal.id,
        })
      );
      expect(mocks.logger.error).not.toHaveBeenCalled();
    }
  });

  it('propagates effect simulation failures as INVALID_EFFECT_DEFINITION errors', () => {
    const { planner, mocks } = createPlannerHarness({ actorId: ACTOR_ID });

    mocks.effectsSimulator.simulateEffects.mockReturnValue({
      success: false,
      error: 'Invalid effect payload',
    });

    mocks.heuristicRegistry.calculate.mockImplementation(() => {
      throw new Error('Heuristic should not run when effects fail');
    });

    let caughtError;
    try {
      planner.testTaskReducesDistance(baseTask, createState(90), numericGoal, ACTOR_ID);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError.code).toBe(GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION);
    expect(mocks.heuristicRegistry.calculate).not.toHaveBeenCalled();

    const telemetry = planner.getEffectFailureTelemetry(ACTOR_ID);
    expect(telemetry).toMatchObject({
      actorId: ACTOR_ID,
      totalFailures: 1,
      failures: [
        expect.objectContaining({
          taskId: baseTask.id,
          goalId: numericGoal.id,
          phase: 'distance-check',
          message: 'Invalid effect payload',
        }),
      ],
    });
  });

  it('does not mutate provided currentState snapshots', () => {
    const { planner, mocks } = createPlannerHarness({ actorId: ACTOR_ID });

    mocks.effectsSimulator.simulateEffects.mockReturnValue({
      success: true,
      state: { [STATE_KEY]: 10 },
    });

    mocks.heuristicRegistry.calculate.mockReturnValueOnce(50);
    mocks.heuristicRegistry.calculate.mockReturnValueOnce(20);

    const frozenState = Object.freeze(createState(80));

    const result = planner.testTaskReducesDistance(baseTask, frozenState, numericGoal, ACTOR_ID);

    expect(result).toBe(true);
    expect(frozenState[STATE_KEY]).toBe(80);
  });
});
