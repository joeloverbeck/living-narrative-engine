/**
 * @file Integration tests for handle_push_off rule wiring and sense-aware perception.
 * @description Validates condition wiring, DISPATCH_PERCEPTIBLE_EVENT with actor/target descriptions.
 */

import { describe, it, expect } from '@jest/globals';
import handlePushOffRule from '../../../../data/mods/physical-control/rules/handle_push_off.rule.json' assert { type: 'json' };
import eventIsActionPushOff from '../../../../data/mods/physical-control/conditions/event-is-action-push-off.condition.json' assert { type: 'json' };
import physicalControlManifest from '../../../../data/mods/physical-control/mod-manifest.json' assert { type: 'json' };

describe('handle_push_off rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handlePushOffRule.rule_id).toBe('handle_push_off');
    expect(handlePushOffRule.event_type).toBe('core:attempt_action');
    expect(handlePushOffRule.condition.condition_ref).toBe(
      'physical-control:event-is-action-push-off'
    );

    expect(eventIsActionPushOff.id).toBe(
      'physical-control:event-is-action-push-off'
    );
    expect(eventIsActionPushOff.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'physical-control:push_off',
    ]);

    expect(physicalControlManifest.content.rules).toContain(
      'handle_push_off.rule.json'
    );
    expect(physicalControlManifest.content.conditions).toContain(
      'event-is-action-push-off.condition.json'
    );
  });

  it('sets up names and position lookup', () => {
    const getNameOps = handlePushOffRule.actions.filter(
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

    const positionQuery = handlePushOffRule.actions.find(
      (op) => op.type === 'QUERY_COMPONENT'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.component_type).toBe('core:position');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');
  });

  it('breaks closeness between actor and target', () => {
    const breakCloseness = handlePushOffRule.actions.find(
      (op) => op.type === 'BREAK_CLOSENESS_WITH_TARGET'
    );

    expect(breakCloseness).toBeDefined();
    expect(breakCloseness?.parameters.actor_id).toBe('{event.payload.actorId}');
    expect(breakCloseness?.parameters.target_id).toBe(
      '{event.payload.targetId}'
    );
  });

  it('uses DISPATCH_PERCEPTIBLE_EVENT with sense-aware descriptions', () => {
    const dispatch = handlePushOffRule.actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );

    expect(dispatch).toBeDefined();
    expect(dispatch?.parameters.location_id).toBe(
      '{context.actorPosition.locationId}'
    );
    expect(dispatch?.parameters.description_text).toBe(
      '{context.actorName} pushes {context.targetName} off forcefully, breaking their closeness.'
    );
    expect(dispatch?.parameters.actor_description).toBe(
      'I push {context.targetName} off forcefully, breaking our closeness.'
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} pushes me off forcefully, breaking our closeness.'
    );
    expect(dispatch?.parameters.perception_type).toBe('physical.target_action');
    expect(dispatch?.parameters.actor_id).toBe('{event.payload.actorId}');
    expect(dispatch?.parameters.target_id).toBe('{event.payload.targetId}');
  });

  it('provides appropriate alternate descriptions for non-visual perception', () => {
    const dispatch = handlePushOffRule.actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );

    expect(dispatch?.parameters.alternate_descriptions).toBeDefined();
    expect(dispatch?.parameters.alternate_descriptions.auditory).toBe(
      'I hear the sounds of a struggle and someone being pushed away nearby.'
    );
    expect(dispatch?.parameters.alternate_descriptions.tactile).toBe(
      'I feel vibrations as someone is pushed away nearby.'
    );
  });

  it('sets logMessage for display and uses success outcome macro', () => {
    const logMessage = handlePushOffRule.actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    expect(logMessage?.parameters.value).toBe(
      '{context.actorName} pushes {context.targetName} off forcefully, breaking their closeness.'
    );

    const hasSuccessMacro = handlePushOffRule.actions.some(
      (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
    );
    expect(hasSuccessMacro).toBe(true);
  });
});
