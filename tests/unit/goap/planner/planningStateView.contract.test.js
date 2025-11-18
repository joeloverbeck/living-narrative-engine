import { describe, it, expect } from '@jest/globals';
import { createPlanningStateView } from '../../../../src/goap/planner/planningStateView.js';
import {
  PLANNING_STATE_COMPONENT_REASONS,
  PLANNING_STATE_COMPONENT_SOURCES,
  PLANNING_STATE_COMPONENT_STATUSES,
} from '../../../../src/goap/planner/planningStateTypes.js';

describe('PlanningStateView contract: component lookup union', () => {
  it('applies consistent truthiness rules for structural payloads and primitives', () => {
    const proxiedValue = new Proxy({ hunger: 5 }, {});
    const state = {
      actor: {
        id: 'actor-1',
        components: {
          'core:object_payload': { energy: 10 },
          'core:array_payload': [],
          'core:proxied_payload': proxiedValue,
        },
      },
      'actor-1:core:object_payload': { energy: 10 },
      'actor-1:core:array_payload': [],
      'actor-1:core:proxied_payload': proxiedValue,
      'actor-1:core:primitive_payload': 0,
      'actor-1:core:nullish_payload': null,
    };

    const view = createPlanningStateView(state);

    const structured = view.hasComponent('actor-1', 'core:object_payload');
    expect(structured.status).toBe(PLANNING_STATE_COMPONENT_STATUSES.PRESENT);
    expect(structured.value).toBe(true);

    const arrayPayload = view.hasComponent('actor-1', 'core:array_payload');
    expect(arrayPayload.status).toBe(PLANNING_STATE_COMPONENT_STATUSES.PRESENT);
    expect(arrayPayload.value).toBe(true);

    const proxiedPayload = view.hasComponent('actor-1', 'core:proxied_payload');
    expect(proxiedPayload.status).toBe(PLANNING_STATE_COMPONENT_STATUSES.PRESENT);
    expect(proxiedPayload.value).toBe(true);

    const primitivePayload = view.hasComponent('actor-1', 'core:primitive_payload');
    expect(primitivePayload.status).toBe(PLANNING_STATE_COMPONENT_STATUSES.PRESENT);
    expect(primitivePayload.value).toBe(false);

    const nullishPayload = view.hasComponent('actor-1', 'core:nullish_payload');
    expect(nullishPayload.status).toBe(PLANNING_STATE_COMPONENT_STATUSES.PRESENT);
    expect(nullishPayload.value).toBe(false);
  });

  it('tracks lookup sources across flattened keys, nested state, and actor snapshots', () => {
    const state = {
      actor: { id: 'actor-1', components: { 'core:actor_component': { morale: 50 } } },
      'entity-3:core:flat_component': { armed: true },
      state: {
        'entity-4': {
          components: {
            'core:state_component': { hydrated: true },
          },
        },
      },
    };

    const view = createPlanningStateView(state);

    const flatResult = view.hasComponent('entity-3', 'core:flat_component');
    expect(flatResult).toEqual({
      status: PLANNING_STATE_COMPONENT_STATUSES.PRESENT,
      value: true,
      source: PLANNING_STATE_COMPONENT_SOURCES.FLAT,
      reason: null,
    });

    const stateResult = view.hasComponent('entity-4', 'core:state_component');
    expect(stateResult).toEqual({
      status: PLANNING_STATE_COMPONENT_STATUSES.PRESENT,
      value: true,
      source: PLANNING_STATE_COMPONENT_SOURCES.STATE,
      reason: null,
    });

    const actorResult = view.hasComponent('actor-1', 'core:actor_component');
    expect(actorResult).toEqual({
      status: PLANNING_STATE_COMPONENT_STATUSES.PRESENT,
      value: true,
      source: PLANNING_STATE_COMPONENT_SOURCES.ACTOR,
      reason: null,
    });

    const absentFromFlat = view.hasComponent('entity-3', 'core:missing');
    expect(absentFromFlat).toEqual({
      status: PLANNING_STATE_COMPONENT_STATUSES.ABSENT,
      value: false,
      source: PLANNING_STATE_COMPONENT_SOURCES.FLAT,
      reason: PLANNING_STATE_COMPONENT_REASONS.COMPONENT_MISSING,
    });

    const unknownLookup = view.hasComponent('', 'core:flat_component');
    expect(unknownLookup).toEqual({
      status: PLANNING_STATE_COMPONENT_STATUSES.UNKNOWN,
      value: false,
      source: null,
      reason: PLANNING_STATE_COMPONENT_REASONS.INVALID_LOOKUP,
    });
  });

  it('prioritizes actor > state > flat sources when emitting ABSENT metadata', () => {
    const actorState = {
      actor: {
        id: 'actor-priority',
        components: {
          'core:from_actor': { morale: 50 },
        },
      },
      state: {
        'actor-priority': {
          components: {
            'core:from_state': { hydrated: true },
          },
        },
      },
      'actor-priority:core:from_flat': { armed: true },
    };

    const actorView = createPlanningStateView(actorState);
    const absentFromActor = actorView.hasComponent('actor-priority', 'core:missing_component');
    expect(absentFromActor).toEqual({
      status: PLANNING_STATE_COMPONENT_STATUSES.ABSENT,
      value: false,
      source: PLANNING_STATE_COMPONENT_SOURCES.ACTOR,
      reason: PLANNING_STATE_COMPONENT_REASONS.COMPONENT_MISSING,
    });

    const stateOnly = {
      actor: { id: 'separate-actor' },
      state: {
        'entity-state': {
          components: {
            'core:from_state': { hydrated: true },
          },
        },
      },
      'entity-state:core:from_flat': { armed: true },
    };
    const stateView = createPlanningStateView(stateOnly);
    const absentFromState = stateView.hasComponent('entity-state', 'core:missing_component');
    expect(absentFromState.source).toBe(PLANNING_STATE_COMPONENT_SOURCES.STATE);

    const flatOnly = {
      actor: { id: 'flat-actor' },
      'entity-flat:core:from_flat': { armed: true },
    };
    const flatView = createPlanningStateView(flatOnly);
    const absentFromFlat = flatView.hasComponent('entity-flat', 'core:missing_component');
    expect(absentFromFlat.source).toBe(PLANNING_STATE_COMPONENT_SOURCES.FLAT);
  });
});
