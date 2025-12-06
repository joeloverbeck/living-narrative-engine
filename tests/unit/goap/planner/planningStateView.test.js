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
  registerPlanningStateDiagnosticsEventBus,
} from '../../../../src/goap/planner/planningStateDiagnostics.js';
import { GOAP_EVENTS } from '../../../../src/goap/events/goapEvents.js';
import jsonLogic from 'json-logic-js';

/**
 *
 */
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
  let fakeEventBus;

  /**
   *
   */
  function createFakeEventBus() {
    return {
      events: [],
      dispatch(eventType, payload) {
        this.events.push({ eventType, payload });
      },
    };
  }

  beforeEach(() => {
    delete process.env.GOAP_STATE_ASSERT;
    clearPlanningStateDiagnostics();
    fakeEventBus = createFakeEventBus();
    registerPlanningStateDiagnosticsEventBus(fakeEventBus);
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
    const view = createPlanningStateView(createState(), {
      metadata: { goalId: 'goal-test' },
    });

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
    expect(lastMiss.reason).toBe(
      PLANNING_STATE_COMPONENT_REASONS.ENTITY_MISSING
    );
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
    expect(view.assertPath('state.actor.components.core_needs.hunger')).toBe(
      90
    );
    expect(
      view.assertPath('state.actor.components.core_needs.thirst')
    ).toBeUndefined();

    const diagnostics = getPlanningStateDiagnostics('actor-1');
    expect(diagnostics.totalMisses).toBe(1);
    expect(diagnostics.lastMisses[0].path).toBe(
      'state.actor.components.core_needs.thirst'
    );
  });

  it('throws when GOAP_STATE_ASSERT is enabled', () => {
    process.env.GOAP_STATE_ASSERT = '1';
    const view = createPlanningStateView(createState());

    expect(() => view.hasComponent('ghost', 'core:needs')).toThrow(
      /GOAP_STATE_MISS/
    );
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

  it('emits STATE_MISS events for entity and component misses', () => {
    const view = createPlanningStateView(createState());

    const unknown = view.hasComponent('ghost', 'core:needs');
    expect(unknown.reason).toBe(
      PLANNING_STATE_COMPONENT_REASONS.ENTITY_MISSING
    );
    expect(fakeEventBus.events).toHaveLength(1);
    expect(fakeEventBus.events[0]).toEqual(
      expect.objectContaining({
        eventType: GOAP_EVENTS.STATE_MISS,
        payload: expect.objectContaining({
          actorId: 'actor-1',
          entityId: 'ghost',
          componentId: 'core:needs',
          reason: PLANNING_STATE_COMPONENT_REASONS.ENTITY_MISSING,
          timestamp: expect.any(Number),
        }),
      })
    );

    const absent = view.hasComponent('actor-1', 'core:thirst');
    expect(absent.reason).toBe(
      PLANNING_STATE_COMPONENT_REASONS.COMPONENT_MISSING
    );
    expect(fakeEventBus.events).toHaveLength(2);
    expect(fakeEventBus.events[1]).toEqual(
      expect.objectContaining({
        eventType: GOAP_EVENTS.STATE_MISS,
        payload: expect.objectContaining({
          actorId: 'actor-1',
          entityId: 'actor-1',
          componentId: 'core:thirst',
          reason: PLANNING_STATE_COMPONENT_REASONS.COMPONENT_MISSING,
        }),
      })
    );
  });

  it('does not emit STATE_MISS for explicit falsy component values', () => {
    const state = createState();
    state['actor-1:core:stealth'] = false;
    const view = createPlanningStateView(state);

    const result = view.hasComponent('actor-1', 'core:stealth');
    expect(result.status).toBe(PLANNING_STATE_COMPONENT_STATUSES.PRESENT);
    expect(result.value).toBe(false);
    expect(result.reason).toBeNull();
    expect([
      PLANNING_STATE_COMPONENT_SOURCES.ACTOR,
      PLANNING_STATE_COMPONENT_SOURCES.FLAT,
    ]).toContain(result.source);
    expect(fakeEventBus.events).toHaveLength(0);
  });

  it('merges metadata from null options and refreshes actorId via updateMetadata', () => {
    const baseState = createState();
    const view = createPlanningStateView(baseState, null);

    expect(view.getActorId()).toBe('actor-1');

    view.updateMetadata({ actorId: 'overridden-actor' });
    expect(view.getActorId()).toBe('overridden-actor');
  });

  it('returns null actor snapshots and falls back to shallow cloning on serialization errors', () => {
    const viewWithoutActor = createPlanningStateView({});
    expect(viewWithoutActor.getActorSnapshot()).toBeNull();

    const circularActor = { id: 'loop', components: {} };
    circularActor.components.self = circularActor;
    const view = createPlanningStateView({ actor: circularActor });

    const snapshot = view.getActorSnapshot();
    expect(snapshot.id).toBe('loop');
    expect(snapshot.components.self).toBe(circularActor);
  });

  it('handles invalid and erroring json-logic lookups gracefully', () => {
    const view = createPlanningStateView(createState());

    expect(view.assertPath(123)).toBeUndefined();

    const applySpy = jest.spyOn(jsonLogic, 'apply').mockImplementation(() => {
      throw new Error('json-logic-failure');
    });

    expect(view.assertPath('state.actor.id')).toBeUndefined();

    const diagnostics = getPlanningStateDiagnostics('actor-1');
    expect(diagnostics.lastMisses.at(-1)).toEqual(
      expect.objectContaining({
        path: 'state.actor.id',
        reason: 'json-logic-failure',
      })
    );

    applySpy.mockRestore();
  });

  it('ignores malformed entities and alias keys when building indexes', () => {
    const state = {
      actor: { id: 'actor-2' },
      ':dangling': true,
      state: {
        'entity-guard': 'not-an-object',
        'entity-components': { components: null },
        'entity-alias': {
          components: {
            'core:health': { value: 10 },
            core_health: { value: 5 },
          },
        },
      },
    };

    const view = createPlanningStateView(state);

    expect(view.hasComponent('entity-alias', 'core:health').source).toBe(
      PLANNING_STATE_COMPONENT_SOURCES.STATE
    );
    expect(view.hasComponent('entity-components', 'core:missing').reason).toBe(
      PLANNING_STATE_COMPONENT_REASONS.COMPONENT_MISSING
    );
  });

  it('skips unnamed actor components and infers nested actor identifiers', () => {
    const view = createPlanningStateView({
      actor: { id: null, components: { '': { rogue: true } } },
      state: { actor: { id: 'nested-actor' } },
    });

    expect(view.getActorId()).toBe('nested-actor');
    const snapshot = view.getActorSnapshot();
    expect(snapshot.components['']).toBeUndefined();
  });
});
