import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createGoalEvaluationContextAdapter,
  GoalEvaluationContextAdapter,
} from '../../../../src/goap/planner/goalEvaluationContextAdapter.js';

describe('GoalEvaluationContextAdapter', () => {
  const originalEnv = process.env.GOAP_NUMERIC_ADAPTER;

  beforeEach(() => {
    delete process.env.GOAP_NUMERIC_ADAPTER;
  });

  afterEach(() => {
    if (typeof originalEnv === 'undefined') {
      delete process.env.GOAP_NUMERIC_ADAPTER;
    } else {
      process.env.GOAP_NUMERIC_ADAPTER = originalEnv;
    }
  });

  it('should wrap PlanningStateView evaluation context', () => {
    process.env.GOAP_NUMERIC_ADAPTER = '1';
    const adapter = createGoalEvaluationContextAdapter({
      state: {
        actor: {
          id: 'actor-1',
          components: {
            'core:needs': { hunger: 10 },
          },
        },
      },
      goal: { id: 'goal:test' },
    });

    const context = adapter.getEvaluationContext();
    expect(context.actor.components['core:needs'].hunger).toBe(10);
    expect(adapter.getStateView().getActorId()).toBe('actor-1');
  });

  it('should provide cloned actor snapshot', () => {
    const adapter = new GoalEvaluationContextAdapter({
      state: {
        actor: {
          id: 'actor-2',
          components: {
            'core:stats': { health: 50 },
          },
        },
      },
    });

    const snapshot = adapter.getActorSnapshot();
    expect(snapshot.components['core:stats'].health).toBe(50);
    snapshot.components['core:stats'].health = 5;
    const freshSnapshot = adapter.getActorSnapshot();
    expect(freshSnapshot.components['core:stats'].health).toBe(50);
  });

  it('should gate diagnostics payload behind GOAP_NUMERIC_ADAPTER flag', () => {
    const adapter = createGoalEvaluationContextAdapter({
      state: {
        actor: {
          id: 'actor-3',
          components: {},
        },
      },
      goal: { id: 'goal:test' },
    });

    let payload = adapter.getDiagnosticsPayload({ origin: 'test' });
    expect(payload).toEqual({ origin: 'test' });

    process.env.GOAP_NUMERIC_ADAPTER = '1';
    const enabledPayload = adapter.getDiagnosticsPayload({ origin: 'test' });
    expect(enabledPayload.actorId).toBe('actor-3');
    expect(enabledPayload.goalId).toBe('goal:test');
  });
});
