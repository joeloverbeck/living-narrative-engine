/**
 * @file Integration tests for handle_force_bend_over rule wiring and sense-aware perception.
 * @description Validates condition wiring, DISPATCH_PERCEPTIBLE_EVENT with actor/target descriptions for multi-target action.
 */

import { describe, it, expect } from '@jest/globals';
import handleForceBendOverRule from '../../../../data/mods/physical-control/rules/handle_force_bend_over.rule.json' assert { type: 'json' };
import eventIsActionForceBendOver from '../../../../data/mods/physical-control/conditions/event-is-action-force-bend-over.condition.json' assert { type: 'json' };
import physicalControlManifest from '../../../../data/mods/physical-control/mod-manifest.json' assert { type: 'json' };

describe('handle_force_bend_over rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handleForceBendOverRule.rule_id).toBe('handle_force_bend_over');
    expect(handleForceBendOverRule.event_type).toBe('core:attempt_action');
    expect(handleForceBendOverRule.condition.condition_ref).toBe(
      'physical-control:event-is-action-force-bend-over'
    );

    expect(eventIsActionForceBendOver.id).toBe(
      'physical-control:event-is-action-force-bend-over'
    );
    expect(eventIsActionForceBendOver.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'physical-control:force_bend_over',
    ]);

    expect(physicalControlManifest.content.rules).toContain(
      'handle_force_bend_over.rule.json'
    );
    expect(physicalControlManifest.content.conditions).toContain(
      'event-is-action-force-bend-over.condition.json'
    );
  });

  it('sets up names for actor, primary, and secondary (surface)', () => {
    const getNameOps = handleForceBendOverRule.actions.filter(
      (op) => op.type === 'GET_NAME'
    );
    const actorNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'actor'
    );
    const primaryNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'primary'
    );
    const secondaryNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'secondary'
    );

    expect(actorNameOp?.parameters.result_variable).toBe('actorName');
    expect(primaryNameOp?.parameters.result_variable).toBe('primaryName');
    expect(secondaryNameOp?.parameters.result_variable).toBe('surfaceName');
  });

  it('sets up position lookup for actor', () => {
    const positionQuery = handleForceBendOverRule.actions.find(
      (op) =>
        op.type === 'QUERY_COMPONENT' &&
        op.parameters.component_type === 'core:position'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');
  });

  it('adds bending_over component to primary target', () => {
    const addComponent = handleForceBendOverRule.actions.find(
      (op) =>
        op.type === 'ADD_COMPONENT' &&
        op.parameters.component_type === 'bending-states:bending_over'
    );

    expect(addComponent).toBeDefined();
    expect(addComponent?.parameters.entity_ref).toBe('primary');
    expect(addComponent?.parameters.value.surface_id).toBe(
      '{event.payload.secondaryId}'
    );
  });

  it('regenerates descriptions for both primary and actor', () => {
    const regenOps = handleForceBendOverRule.actions.filter(
      (op) => op.type === 'REGENERATE_DESCRIPTION'
    );

    expect(regenOps.map((op) => op.parameters.entity_ref).sort()).toEqual([
      'actor',
      'primary',
    ]);
  });

  it('uses DISPATCH_PERCEPTIBLE_EVENT with sense-aware descriptions', () => {
    const dispatch = handleForceBendOverRule.actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );

    expect(dispatch).toBeDefined();
    expect(dispatch?.parameters.location_id).toBe(
      '{context.actorPosition.locationId}'
    );
    expect(dispatch?.parameters.description_text).toBe(
      '{context.actorName} forcefully bends {context.primaryName} over {context.surfaceName}.'
    );
    expect(dispatch?.parameters.actor_description).toBe(
      'I forcefully bend {context.primaryName} over {context.surfaceName}.'
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} forcefully bends me over {context.surfaceName}.'
    );
    expect(dispatch?.parameters.perception_type).toBe('physical.target_action');
    expect(dispatch?.parameters.actor_id).toBe('{event.payload.actorId}');
    expect(dispatch?.parameters.target_id).toBe('{event.payload.primaryId}');
  });

  it('provides appropriate alternate descriptions for non-visual perception', () => {
    const dispatch = handleForceBendOverRule.actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );

    expect(dispatch?.parameters.alternate_descriptions).toBeDefined();
    expect(dispatch?.parameters.alternate_descriptions.auditory).toBe(
      'I hear the sounds of a struggle and someone being forced down onto a surface nearby.'
    );
    expect(dispatch?.parameters.alternate_descriptions.tactile).toBe(
      'I feel vibrations as someone is forced down onto a surface nearby.'
    );
  });

  it('sets logMessage for display and uses success outcome macro', () => {
    const logMessage = handleForceBendOverRule.actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    expect(logMessage?.parameters.value).toBe(
      '{context.actorName} forcefully bends {context.primaryName} over {context.surfaceName}.'
    );

    const hasSuccessMacro = handleForceBendOverRule.actions.some(
      (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
    );
    expect(hasSuccessMacro).toBe(true);
  });
});
