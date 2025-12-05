/**
 * @file Integration tests for handle_cross_salt_boundary rule wiring and outcomes.
 * @description Validates condition wiring, rule structure, and behavior for crossing salt boundaries.
 */

import { describe, it, expect } from '@jest/globals';
import handleCrossSaltBoundaryRule from '../../../../data/mods/warding/rules/handle_cross_salt_boundary.rule.json' assert { type: 'json' };
import eventIsActionCrossSaltBoundary from '../../../../data/mods/warding/conditions/event-is-action-cross-salt-boundary.condition.json' assert { type: 'json' };
import wardingManifest from '../../../../data/mods/warding/mod-manifest.json' assert { type: 'json' };

describe('handle_cross_salt_boundary rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handleCrossSaltBoundaryRule.rule_id).toBe('handle_cross_salt_boundary');
    expect(handleCrossSaltBoundaryRule.event_type).toBe('core:attempt_action');
    expect(handleCrossSaltBoundaryRule.condition.condition_ref).toBe(
      'warding:event-is-action-cross-salt-boundary'
    );

    expect(eventIsActionCrossSaltBoundary.id).toBe(
      'warding:event-is-action-cross-salt-boundary'
    );
    expect(eventIsActionCrossSaltBoundary.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'warding:cross_salt_boundary',
    ]);

    expect(wardingManifest.content.rules).toContain(
      'handle_cross_salt_boundary.rule.json'
    );
    expect(wardingManifest.content.conditions).toContain(
      'event-is-action-cross-salt-boundary.condition.json'
    );
  });

  it('sets up actor name and position lookup', () => {
    const getNameOp = handleCrossSaltBoundaryRule.actions.find(
      (op) => op.type === 'GET_NAME' && op.parameters.entity_ref === 'actor'
    );
    expect(getNameOp?.parameters.result_variable).toBe('actorName');

    const positionQuery = handleCrossSaltBoundaryRule.actions.find(
      (op) => op.type === 'QUERY_COMPONENT'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.component_type).toBe('core:position');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');
  });

  it('removes warded_by_salt component from actor', () => {
    const removeComponentOp = handleCrossSaltBoundaryRule.actions.find(
      (op) =>
        op.type === 'REMOVE_COMPONENT' &&
        op.parameters.component_type === 'warding:warded_by_salt'
    );
    expect(removeComponentOp).toBeDefined();
    expect(removeComponentOp?.parameters.entity_ref).toBe('actor');
  });

  it('regenerates actor description after component removal', () => {
    const regenOp = handleCrossSaltBoundaryRule.actions.find(
      (op) => op.type === 'REGENERATE_DESCRIPTION'
    );
    expect(regenOp?.parameters.entity_ref).toBe('actor');
  });

  it('dispatches correct perceptible event message', () => {
    const expectedMessage = '{context.actorName} crosses the salt boundary, breaking it.';

    const dispatch = handleCrossSaltBoundaryRule.actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );

    expect(dispatch).toBeDefined();
    expect(dispatch?.parameters.description_text).toBe(expectedMessage);
    expect(dispatch?.parameters.location_id).toBe('{context.actorPosition.locationId}');
    expect(dispatch?.parameters.perception_type).toBe('action_self_general');
    expect(dispatch?.parameters.actor_id).toBe('{event.payload.actorId}');
  });

  it('sets log message correctly', () => {
    const expectedMessage = '{context.actorName} crosses the salt boundary, breaking it.';

    const logMessageVar = handleCrossSaltBoundaryRule.actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    expect(logMessageVar?.parameters.value).toBe(expectedMessage);
  });

  it('sets shared variables for macro', () => {
    const setVariableOps = handleCrossSaltBoundaryRule.actions.filter(
      (op) => op.type === 'SET_VARIABLE'
    );

    const locationVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'locationId'
    );
    const perceptionVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'perceptionType'
    );

    expect(locationVar?.parameters.value).toBe(
      '{context.actorPosition.locationId}'
    );
    expect(perceptionVar?.parameters.value).toBe('action_self_general');
  });

  it('uses success outcome macro to end turn', () => {
    const hasSuccessMacro = handleCrossSaltBoundaryRule.actions.some(
      (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
    );
    expect(hasSuccessMacro).toBe(true);
  });

  it('has warded_by_salt component registered in manifest', () => {
    expect(wardingManifest.content.components).toContain(
      'warded_by_salt.component.json'
    );
  });

  it('has cross_salt_boundary action registered in manifest', () => {
    expect(wardingManifest.content.actions).toContain(
      'cross_salt_boundary.action.json'
    );
  });

  it('has no outcome branching (deterministic action)', () => {
    // Unlike draw_salt_boundary, this action does not use RESOLVE_OUTCOME
    const resolveOutcome = handleCrossSaltBoundaryRule.actions.find(
      (op) => op.type === 'RESOLVE_OUTCOME'
    );
    expect(resolveOutcome).toBeUndefined();

    // And has no IF branches for outcomes
    const ifOps = handleCrossSaltBoundaryRule.actions.filter(
      (op) => op.type === 'IF'
    );
    expect(ifOps).toHaveLength(0);
  });

  it('does not have target entity operations (none target scope)', () => {
    // This action targets "none", so there should be no target entity operations
    const targetNameOp = handleCrossSaltBoundaryRule.actions.find(
      (op) =>
        op.type === 'GET_NAME' && op.parameters.entity_ref === 'target'
    );
    expect(targetNameOp).toBeUndefined();
  });
});
