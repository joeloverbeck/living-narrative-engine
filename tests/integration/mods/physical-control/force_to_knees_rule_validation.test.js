/**
 * @file Integration tests for handle_force_to_knees rule wiring and sense-aware perception.
 * @description Validates condition wiring, DISPATCH_PERCEPTIBLE_EVENT with actor/target descriptions.
 */

import { describe, it, expect } from '@jest/globals';
import handleForceToKneesRule from '../../../../data/mods/physical-control/rules/handle_force_to_knees.rule.json' assert { type: 'json' };
import eventIsActionForceToKnees from '../../../../data/mods/physical-control/conditions/event-is-action-force-to-knees.condition.json' assert { type: 'json' };
import physicalControlManifest from '../../../../data/mods/physical-control/mod-manifest.json' assert { type: 'json' };

describe('handle_force_to_knees rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handleForceToKneesRule.rule_id).toBe('handle_force_to_knees');
    expect(handleForceToKneesRule.event_type).toBe('core:attempt_action');
    expect(handleForceToKneesRule.condition.condition_ref).toBe(
      'physical-control:event-is-action-force-to-knees'
    );

    expect(eventIsActionForceToKnees.id).toBe(
      'physical-control:event-is-action-force-to-knees'
    );
    expect(eventIsActionForceToKnees.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'physical-control:force_to_knees',
    ]);

    expect(physicalControlManifest.content.rules).toContain(
      'handle_force_to_knees.rule.json'
    );
    expect(physicalControlManifest.content.conditions).toContain(
      'event-is-action-force-to-knees.condition.json'
    );
  });

  it('sets up names and position lookup', () => {
    const getNameOps = handleForceToKneesRule.actions.filter(
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

    const positionQuery = handleForceToKneesRule.actions.find(
      (op) => op.type === 'QUERY_COMPONENT'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.component_type).toBe('core:position');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');
  });

  it('adds kneeling_before component to target', () => {
    const addComponent = handleForceToKneesRule.actions.find(
      (op) =>
        op.type === 'ADD_COMPONENT' &&
        op.parameters.component_type === 'positioning:kneeling_before'
    );

    expect(addComponent).toBeDefined();
    expect(addComponent?.parameters.entity_ref).toBe('target');
    expect(addComponent?.parameters.value.entityId).toBe(
      '{event.payload.actorId}'
    );
  });

  it('locks target movement', () => {
    const lockMovement = handleForceToKneesRule.actions.find(
      (op) => op.type === 'LOCK_MOVEMENT'
    );

    expect(lockMovement).toBeDefined();
    expect(lockMovement?.parameters.actor_id).toBe('{event.payload.targetId}');
  });

  it('regenerates descriptions for both actor and target', () => {
    const regenOps = handleForceToKneesRule.actions.filter(
      (op) => op.type === 'REGENERATE_DESCRIPTION'
    );

    expect(regenOps.map((op) => op.parameters.entity_ref).sort()).toEqual([
      'actor',
      'target',
    ]);
  });

  it('uses DISPATCH_PERCEPTIBLE_EVENT with sense-aware descriptions', () => {
    const dispatch = handleForceToKneesRule.actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );

    expect(dispatch).toBeDefined();
    expect(dispatch?.parameters.location_id).toBe(
      '{context.actorPosition.locationId}'
    );
    expect(dispatch?.parameters.description_text).toBe(
      '{context.actorName} roughly forces {context.targetName} to their knees.'
    );
    expect(dispatch?.parameters.actor_description).toBe(
      'I roughly force {context.targetName} to their knees.'
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} roughly forces me to my knees.'
    );
    expect(dispatch?.parameters.perception_type).toBe('physical.target_action');
    expect(dispatch?.parameters.actor_id).toBe('{event.payload.actorId}');
    expect(dispatch?.parameters.target_id).toBe('{event.payload.targetId}');
  });

  it('provides appropriate alternate descriptions for non-visual perception', () => {
    const dispatch = handleForceToKneesRule.actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );

    expect(dispatch?.parameters.alternate_descriptions).toBeDefined();
    expect(dispatch?.parameters.alternate_descriptions.auditory).toBe(
      'I hear the sounds of a struggle and someone being forced down nearby.'
    );
    expect(dispatch?.parameters.alternate_descriptions.tactile).toBe(
      'I feel vibrations as someone is forced down nearby.'
    );
  });

  it('sets logMessage for display and uses success outcome macro', () => {
    const logMessage = handleForceToKneesRule.actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    expect(logMessage?.parameters.value).toBe(
      '{context.actorName} roughly forces {context.targetName} to their knees.'
    );

    const hasSuccessMacro = handleForceToKneesRule.actions.some(
      (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
    );
    expect(hasSuccessMacro).toBe(true);
  });
});
