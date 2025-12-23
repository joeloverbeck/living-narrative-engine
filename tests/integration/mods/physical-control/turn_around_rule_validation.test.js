/**
 * @file Integration tests for handle_turn_around rule wiring and sense-aware perception.
 * @description Validates condition wiring, DISPATCH_PERCEPTIBLE_EVENT in both branches with actor/target descriptions.
 */

import { describe, it, expect } from '@jest/globals';
import handleTurnAroundRule from '../../../../data/mods/physical-control/rules/handle_turn_around.rule.json' assert { type: 'json' };
import eventIsActionTurnAround from '../../../../data/mods/physical-control/conditions/event-is-action-turn-around.condition.json' assert { type: 'json' };
import physicalControlManifest from '../../../../data/mods/physical-control/mod-manifest.json' assert { type: 'json' };

const findMainIfOperation = (actions) =>
  actions.find(
    (op) =>
      op.type === 'IF' && op.comment?.includes('Check if target is already')
  );

describe('handle_turn_around rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handleTurnAroundRule.rule_id).toBe('handle_turn_around');
    expect(handleTurnAroundRule.event_type).toBe('core:attempt_action');
    expect(handleTurnAroundRule.condition.condition_ref).toBe(
      'physical-control:event-is-action-turn-around'
    );

    expect(eventIsActionTurnAround.id).toBe(
      'physical-control:event-is-action-turn-around'
    );
    expect(eventIsActionTurnAround.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'physical-control:turn_around',
    ]);

    expect(physicalControlManifest.content.rules).toContain(
      'handle_turn_around.rule.json'
    );
    expect(physicalControlManifest.content.conditions).toContain(
      'event-is-action-turn-around.condition.json'
    );
  });

  it('sets up names and position lookup', () => {
    const getNameOps = handleTurnAroundRule.actions.filter(
      (op) => op.type === 'GET_NAME'
    );
    const actorNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'actor'
    );
    const targetNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'target'
    );

    expect(actorNameOp?.parameters.result_variable).toBe('actorName');
    expect(targetNameOp?.parameters.result_variable).toBe('targetName');

    const positionQuery = handleTurnAroundRule.actions.find(
      (op) =>
        op.type === 'QUERY_COMPONENT' &&
        op.parameters.component_type === 'core:position'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');
  });

  it('queries facing_away state for target', () => {
    const facingQuery = handleTurnAroundRule.actions.find(
      (op) =>
        op.type === 'QUERY_COMPONENT' &&
        op.parameters.component_type === 'facing-states:facing_away'
    );

    expect(facingQuery?.parameters.entity_ref).toBe('target');
    expect(facingQuery?.parameters.result_variable).toBe('facingState');
    expect(facingQuery?.parameters.missing_value).toBeNull();
  });

  describe('then_actions branch (target turns to face actor)', () => {
    let thenActions;

    beforeAll(() => {
      const mainIf = findMainIfOperation(handleTurnAroundRule.actions);
      thenActions = mainIf?.parameters.then_actions ?? [];
    });

    it('uses DISPATCH_PERCEPTIBLE_EVENT with sense-aware descriptions', () => {
      const dispatch = thenActions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(dispatch).toBeDefined();
      expect(dispatch?.parameters.location_id).toBe(
        '{context.actorPosition.locationId}'
      );
      expect(dispatch?.parameters.description_text).toBe(
        '{context.targetName} turns to face {context.actorName}.'
      );
      expect(dispatch?.parameters.actor_description).toBe(
        'I turn {context.targetName} around to face me.'
      );
      expect(dispatch?.parameters.target_description).toBe(
        '{context.actorName} turns me around to face them.'
      );
      expect(dispatch?.parameters.perception_type).toBe(
        'physical.target_action'
      );
      expect(dispatch?.parameters.actor_id).toBe('{event.payload.actorId}');
      expect(dispatch?.parameters.target_id).toBe('{event.payload.targetId}');
    });

    it('provides alternate descriptions for non-visual perception', () => {
      const dispatch = thenActions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(dispatch?.parameters.alternate_descriptions).toBeDefined();
      expect(dispatch?.parameters.alternate_descriptions.auditory).toBe(
        'I hear the sound of someone turning around nearby.'
      );
      expect(dispatch?.parameters.alternate_descriptions.tactile).toBe(
        'I feel movement as someone turns around nearby.'
      );
    });

    it('sets logMessage and uses success outcome macro', () => {
      const logMessage = thenActions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );

      expect(logMessage?.parameters.value).toBe(
        '{context.targetName} turns to face {context.actorName}.'
      );

      const hasSuccessMacro = thenActions.some(
        (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
      );
      expect(hasSuccessMacro).toBe(true);
    });

    it('dispatches facing:actor_faced_forward event', () => {
      const dispatchEvent = thenActions.find(
        (op) =>
          op.type === 'DISPATCH_EVENT' &&
          op.parameters.eventType === 'facing:actor_faced_forward'
      );

      expect(dispatchEvent).toBeDefined();
      expect(dispatchEvent?.parameters.payload.actor).toBe(
        '{event.payload.targetId}'
      );
      expect(dispatchEvent?.parameters.payload.facing).toBe(
        '{event.payload.actorId}'
      );
    });
  });

  describe('else_actions branch (target turns away from actor)', () => {
    let elseActions;

    beforeAll(() => {
      const mainIf = findMainIfOperation(handleTurnAroundRule.actions);
      elseActions = mainIf?.parameters.else_actions ?? [];
    });

    it('uses DISPATCH_PERCEPTIBLE_EVENT with sense-aware descriptions', () => {
      const dispatch = elseActions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(dispatch).toBeDefined();
      expect(dispatch?.parameters.location_id).toBe(
        '{context.actorPosition.locationId}'
      );
      expect(dispatch?.parameters.description_text).toBe(
        '{context.actorName} turns {context.targetName} around.'
      );
      expect(dispatch?.parameters.actor_description).toBe(
        'I turn {context.targetName} around, away from me.'
      );
      expect(dispatch?.parameters.target_description).toBe(
        '{context.actorName} turns me around, away from them.'
      );
      expect(dispatch?.parameters.perception_type).toBe(
        'physical.target_action'
      );
      expect(dispatch?.parameters.actor_id).toBe('{event.payload.actorId}');
      expect(dispatch?.parameters.target_id).toBe('{event.payload.targetId}');
    });

    it('provides alternate descriptions for non-visual perception', () => {
      const dispatch = elseActions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(dispatch?.parameters.alternate_descriptions).toBeDefined();
      expect(dispatch?.parameters.alternate_descriptions.auditory).toBe(
        'I hear the sound of someone being turned around nearby.'
      );
      expect(dispatch?.parameters.alternate_descriptions.tactile).toBe(
        'I feel movement as someone is turned around nearby.'
      );
    });

    it('sets logMessage and uses success outcome macro', () => {
      const logMessage = elseActions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );

      expect(logMessage?.parameters.value).toBe(
        '{context.actorName} turns {context.targetName} around.'
      );

      const hasSuccessMacro = elseActions.some(
        (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
      );
      expect(hasSuccessMacro).toBe(true);
    });

    it('dispatches physical-control:actor_turned_around event', () => {
      const dispatchEvent = elseActions.find(
        (op) =>
          op.type === 'DISPATCH_EVENT' &&
          op.parameters.eventType === 'physical-control:actor_turned_around'
      );

      expect(dispatchEvent).toBeDefined();
      expect(dispatchEvent?.parameters.payload.actor).toBe(
        '{event.payload.targetId}'
      );
      expect(dispatchEvent?.parameters.payload.turned_by).toBe(
        '{event.payload.actorId}'
      );
    });
  });
});
