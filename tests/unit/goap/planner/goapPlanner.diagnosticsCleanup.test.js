import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import BoundedCache from '../../../../src/goap/utils/boundedCache.js';
import { createPlannerHarness } from './helpers/createPlannerHarness.js';

describe('GoapPlanner - diagnostics cleanup', () => {
  let planner;

  beforeEach(() => {
    ({ planner } = createPlannerHarness());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clears goal path diagnostics, telemetry, and normalization cache', () => {
    const goalPathSpy = jest
      .spyOn(planner, 'getGoalPathDiagnostics')
      .mockReturnValue({ actorId: 'actor-1' });
    const telemetrySpy = jest
      .spyOn(planner, 'getEffectFailureTelemetry')
      .mockReturnValue({ actorId: 'actor-1' });
    const cacheSpy = jest.spyOn(BoundedCache.prototype, 'clear');

    planner.clearActorDiagnostics('actor-1');

    expect(goalPathSpy).toHaveBeenCalledWith('actor-1');
    expect(telemetrySpy).toHaveBeenCalledWith('actor-1');
    expect(cacheSpy).toHaveBeenCalledTimes(1);
  });

  it('returns early when actorId is missing', () => {
    const goalPathSpy = jest.spyOn(planner, 'getGoalPathDiagnostics');
    const telemetrySpy = jest.spyOn(planner, 'getEffectFailureTelemetry');
    const cacheSpy = jest.spyOn(BoundedCache.prototype, 'clear');

    planner.clearActorDiagnostics();

    expect(goalPathSpy).not.toHaveBeenCalled();
    expect(telemetrySpy).not.toHaveBeenCalled();
    expect(cacheSpy).not.toHaveBeenCalled();
  });
});
