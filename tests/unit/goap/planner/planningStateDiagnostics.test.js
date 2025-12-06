import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  clearPlanningStateDiagnostics,
  getAllPlanningStateDiagnostics,
  getPlanningStateDiagnostics,
  recordPlanningStateCacheHit,
  recordPlanningStateFallback,
  recordPlanningStateMiss,
  recordPlanningStateLookup,
  registerPlanningStateDiagnosticsEventBus,
} from '../../../../src/goap/planner/planningStateDiagnostics.js';
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';

describe('planningStateDiagnostics', () => {
  beforeEach(() => {
    clearPlanningStateDiagnostics();
    registerPlanningStateDiagnosticsEventBus(null);
    jest.useFakeTimers();
    jest.setSystemTime(1_000_000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('tracks fallback and cache hit telemetry', () => {
    recordPlanningStateFallback({ actorId: 'actor-a' });
    recordPlanningStateCacheHit({ actorId: 'actor-a' });

    const diagnostics = getPlanningStateDiagnostics('actor-a');

    expect(diagnostics.telemetry).toEqual(
      expect.objectContaining({
        fallbacks: 1,
        cacheHits: 1,
        lastUpdated: 1_000_000,
      })
    );
  });

  it('shifts older misses once the buffer exceeds five entries', () => {
    for (let index = 0; index < 6; index += 1) {
      recordPlanningStateMiss({
        actorId: 'actor-buffer',
        path: `path-${index}`,
      });
    }

    const diagnostics = getPlanningStateDiagnostics('actor-buffer');

    expect(diagnostics.lastMisses).toHaveLength(5);
    expect(diagnostics.lastMisses.map((miss) => miss.path)).not.toContain(
      'path-0'
    );
    expect(diagnostics.lastMisses[diagnostics.lastMisses.length - 1].path).toBe(
      'path-5'
    );
  });

  it('returns null diagnostics for falsy actor identifiers', () => {
    expect(getPlanningStateDiagnostics(undefined)).toBeNull();
    expect(getPlanningStateDiagnostics('')).toBeNull();
  });

  it('returns cloned snapshots from getAllPlanningStateDiagnostics', () => {
    recordPlanningStateMiss({ actorId: 'actor-1', path: 'first-path' });
    recordPlanningStateLookup({ actorId: 'actor-2' });

    const allDiagnostics = getAllPlanningStateDiagnostics();
    expect(allDiagnostics).toHaveLength(2);

    allDiagnostics[0].totalMisses = 99;
    const untouched = getPlanningStateDiagnostics('actor-1');
    expect(untouched.totalMisses).toBe(1);
  });

  it('emits telemetry events when an event bus is registered', () => {
    const mockDispatch = jest.fn();
    registerPlanningStateDiagnosticsEventBus({ dispatch: mockDispatch });

    recordPlanningStateMiss({
      actorId: 'actor-event',
      entityId: 'ghost',
      componentId: 'core:needs',
      origin: 'test-suite',
      goalId: 'goal-1',
      taskId: 'task-1',
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      GOAP_EVENTS.STATE_MISS,
      expect.objectContaining({
        actorId: 'actor-event',
        entityId: 'ghost',
        componentId: 'core:needs',
        origin: 'test-suite',
        goalId: 'goal-1',
        taskId: 'task-1',
        path: null,
        reason: 'planning-state-miss',
        timestamp: 1_000_000,
      })
    );
  });
});
