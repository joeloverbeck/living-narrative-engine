import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createPlanningStateView } from '../../../../src/goap/planner/planningStateView.js';
import {
  clearPlanningStateDiagnostics,
  getPlanningStateDiagnostics,
} from '../../../../src/goap/planner/planningStateDiagnostics.js';

function createState() {
  return {
    actor: {
      id: 'actor-1',
      components: {
        'core:needs': { hunger: 90 },
      },
    },
    'actor-1:core:needs': { hunger: 90 },
    'actor-1:core:health': 60,
  };
}

describe('PlanningStateView', () => {
  beforeEach(() => {
    delete process.env.GOAP_STATE_ASSERT;
    clearPlanningStateDiagnostics();
  });

  afterEach(() => {
    delete process.env.GOAP_STATE_ASSERT;
    clearPlanningStateDiagnostics();
  });

  it('exposes dual-format evaluation context', () => {
    const view = createPlanningStateView(createState());
    const context = view.getEvaluationContext();

    expect(context.actor.id).toBe('actor-1');
    expect(context.actor.components['core:needs'].hunger).toBe(90);
    expect(context.actor.components.core_needs.hunger).toBe(90);
    expect(context.state['actor-1:core:health']).toBe(60);
    expect(context.state['actor-1:core:needs'].hunger).toBe(90);
  });

  it('returns tri-state component lookups and logs unknowns', () => {
    const view = createPlanningStateView(createState(), { metadata: { goalId: 'goal-test' } });

    const present = view.hasComponent('actor-1', 'core:needs');
    expect(present.status).toBe('present');
    expect(present.value).toBe(true);

    const absent = view.hasComponent('actor-1', 'core:thirst');
    expect(absent.status).toBe('absent');
    expect(absent.value).toBe(false);

    const unknown = view.hasComponent('ghost', 'core:needs');
    expect(unknown.status).toBe('unknown');
    expect(unknown.value).toBe(false);

    const diagnostics = getPlanningStateDiagnostics('actor-1');
    expect(diagnostics).not.toBeNull();
    expect(diagnostics.totalMisses).toBeGreaterThan(0);
    const lastMiss = diagnostics.lastMisses[diagnostics.lastMisses.length - 1];
    expect(lastMiss.componentId).toBe('core:needs');
  });

  it('assertPath records diagnostics for missing variables', () => {
    const view = createPlanningStateView(createState());
    expect(view.assertPath('state.actor.components.core_needs.hunger')).toBe(90);
    expect(view.assertPath('state.actor.components.core_needs.thirst')).toBeUndefined();

    const diagnostics = getPlanningStateDiagnostics('actor-1');
    expect(diagnostics.totalMisses).toBe(1);
    expect(diagnostics.lastMisses[0].path).toBe('state.actor.components.core_needs.thirst');
  });

  it('throws when GOAP_STATE_ASSERT is enabled', () => {
    process.env.GOAP_STATE_ASSERT = '1';
    const view = createPlanningStateView(createState());

    expect(() => view.hasComponent('ghost', 'core:needs')).toThrow(/GOAP_STATE_MISS/);
  });

  it('returns cloned actor snapshot', () => {
    const view = createPlanningStateView(createState());
    const snapshot = view.getActorSnapshot();
    expect(snapshot.id).toBe('actor-1');
    snapshot.components['core:needs'].hunger = 5;

    const freshSnapshot = view.getActorSnapshot();
    expect(freshSnapshot.components['core:needs'].hunger).toBe(90);
  });
});
