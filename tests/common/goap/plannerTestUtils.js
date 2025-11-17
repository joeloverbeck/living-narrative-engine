import { GOAP_PLANNER_FAILURES } from '../../../src/goap/planner/goapPlannerFailureReasons.js';

export function expectInvalidEffectFailure(planner, taskId) {
  const failure =
    typeof planner.getLastFailure === 'function'
      ? planner.getLastFailure()
      : null;

  expect(failure).toEqual(
    expect.objectContaining({ code: GOAP_PLANNER_FAILURES.INVALID_EFFECT_DEFINITION })
  );

  if (taskId) {
    expect(failure?.details).toEqual(expect.objectContaining({ taskId }));
  }

  return failure;
}
