import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createPlanningStateView } from '../../../../src/goap/planner/planningStateView.js';
import {
  PLANNING_STATE_COMPONENT_REASONS,
  PLANNING_STATE_COMPONENT_SOURCES,
  PLANNING_STATE_COMPONENT_STATUSES,
} from '../../../../src/goap/planner/planningStateTypes.js';
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

  it('returns discriminated union results and logs unknowns', () => {
    const view = createPlanningStateView(createState(), { metadata: { goalId: 'goal-test' } });

    const present = view.hasComponent('actor-1', 'core:needs');
    expect(present).toEqual({
      status: PLANNING_STATE_COMPONENT_STATUSES.PRESENT,
      value: true,
      source: PLANNING_STATE_COMPONENT_SOURCES.ACTOR,
      reason: null,
    });

    const absent = view.hasComponent('actor-1', 'core:thirst');
    expect(absent).toEqual({
      status: PLANNING_STATE_COMPONENT_STATUSES.ABSENT,
      value: false,
      source: PLANNING_STATE_COMPONENT_SOURCES.ACTOR,
      reason: PLANNING_STATE_COMPONENT_REASONS.COMPONENT_MISSING,
    });

    const unknown = view.hasComponent('ghost', 'core:needs');
    expect(unknown).toEqual({
      status: PLANNING_STATE_COMPONENT_STATUSES.UNKNOWN,
      value: false,
      source: null,
      reason: PLANNING_STATE_COMPONENT_REASONS.ENTITY_MISSING,
    });

    const diagnostics = getPlanningStateDiagnostics('actor-1');
    expect(diagnostics).not.toBeNull();
    expect(diagnostics.totalMisses).toBeGreaterThan(0);
    const lastMiss = diagnostics.lastMisses[diagnostics.lastMisses.length - 1];
    expect(lastMiss.componentId).toBe('core:needs');
    expect(lastMiss.reason).toBe(PLANNING_STATE_COMPONENT_REASONS.ENTITY_MISSING);
  });

  it('records telemetry counters for lookups and misses', () => {
    const view = createPlanningStateView(createState());

    view.hasComponent('actor-1', 'core:needs');
    view.hasComponent('ghost', 'core:needs');

    const diagnostics = getPlanningStateDiagnostics('actor-1');
    expect(diagnostics.telemetry).toEqual(
      expect.objectContaining({
        totalLookups: 2,
        unknownStatuses: 1,
      })
    );
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

  it('includes json logic metadata in GOAP_STATE_ASSERT errors when provided', () => {
    process.env.GOAP_STATE_ASSERT = '1';
    const view = createPlanningStateView(createState());

    try {
      view.hasComponent('ghost', 'core:needs', {
        metadata: { jsonLogicExpression: '{"var":"entity.blocker"}' },
      });
      throw new Error('Expected GOAP_STATE_MISS but lookup succeeded');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.details).toEqual(
        expect.objectContaining({
          jsonLogicExpression: '{"var":"entity.blocker"}',
        })
      );
    }
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
