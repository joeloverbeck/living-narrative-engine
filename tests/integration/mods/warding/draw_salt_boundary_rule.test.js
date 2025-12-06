/**
 * @file Integration tests for handle_draw_salt_boundary rule wiring and outcomes.
 * @description Validates condition wiring, outcome resolution setup, and branch side effects/messages.
 */

import { describe, it, expect } from '@jest/globals';
import handleDrawSaltBoundaryRule from '../../../../data/mods/warding/rules/handle_draw_salt_boundary.rule.json' assert { type: 'json' };
import eventIsActionDrawSaltBoundary from '../../../../data/mods/warding/conditions/event-is-action-draw-salt-boundary.condition.json' assert { type: 'json' };
import wardingManifest from '../../../../data/mods/warding/mod-manifest.json' assert { type: 'json' };

const findIfByOutcome = (actions, outcomeValue) =>
  actions.find(
    (op) =>
      op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcomeValue
  );

describe('handle_draw_salt_boundary rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handleDrawSaltBoundaryRule.rule_id).toBe(
      'handle_draw_salt_boundary'
    );
    expect(handleDrawSaltBoundaryRule.event_type).toBe('core:attempt_action');
    expect(handleDrawSaltBoundaryRule.condition.condition_ref).toBe(
      'warding:event-is-action-draw-salt-boundary'
    );

    expect(eventIsActionDrawSaltBoundary.id).toBe(
      'warding:event-is-action-draw-salt-boundary'
    );
    expect(eventIsActionDrawSaltBoundary.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'warding:draw_salt_boundary',
    ]);

    expect(wardingManifest.content.rules).toContain(
      'handle_draw_salt_boundary.rule.json'
    );
    expect(wardingManifest.content.conditions).toContain(
      'event-is-action-draw-salt-boundary.condition.json'
    );
  });

  it('sets up names, position lookup, and outcome resolution for warding skill', () => {
    const getNameOps = handleDrawSaltBoundaryRule.actions.filter(
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

    const positionQuery = handleDrawSaltBoundaryRule.actions.find(
      (op) => op.type === 'QUERY_COMPONENT'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.component_type).toBe('core:position');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');

    const resolveOutcome = handleDrawSaltBoundaryRule.actions.find(
      (op) => op.type === 'RESOLVE_OUTCOME'
    );
    expect(resolveOutcome).toBeDefined();
    expect(resolveOutcome.parameters.actor_skill_component).toBe(
      'skills:warding_skill'
    );
    // Fixed difficulty - no target skill component
    expect(resolveOutcome.parameters.target_skill_component).toBeUndefined();
    expect(resolveOutcome.parameters.actor_skill_default).toBe(10);
    expect(resolveOutcome.parameters.difficulty_modifier).toBe(50);
    expect(resolveOutcome.parameters.formula).toBe('linear');
    expect(resolveOutcome.parameters.result_variable).toBe('wardingResult');
  });

  it('sets shared variables for perception/logging', () => {
    const setVariableOps = handleDrawSaltBoundaryRule.actions.filter(
      (op) => op.type === 'SET_VARIABLE'
    );

    const locationVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'locationId'
    );
    const perceptionVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'perceptionType'
    );
    const targetVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'targetId'
    );

    expect(locationVar?.parameters.value).toBe(
      '{context.actorPosition.locationId}'
    );
    expect(perceptionVar?.parameters.value).toBe('action_target_general');
    expect(targetVar?.parameters.value).toBe('{event.payload.targetId}');
  });

  it('branches flatly for all four outcomes', () => {
    const ifOps = handleDrawSaltBoundaryRule.actions.filter(
      (op) => op.type === 'IF'
    );

    expect(ifOps).toHaveLength(4);
    expect(
      findIfByOutcome(handleDrawSaltBoundaryRule.actions, 'CRITICAL_SUCCESS')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleDrawSaltBoundaryRule.actions, 'SUCCESS')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleDrawSaltBoundaryRule.actions, 'FAILURE')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleDrawSaltBoundaryRule.actions, 'FUMBLE')
    ).toBeDefined();
  });

  it('dispatches correct message on CRITICAL_SUCCESS', () => {
    const branch = findIfByOutcome(
      handleDrawSaltBoundaryRule.actions,
      'CRITICAL_SUCCESS'
    );
    const actions = branch?.parameters.then_actions ?? [];

    const expectedMessage =
      '{context.actorName} draws a perfect salt boundary around the corrupted target {context.targetName}.';

    const dispatch = actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    expect(dispatch?.parameters.description_text).toBe(expectedMessage);
    expect(dispatch?.parameters.target_id).toBe('{event.payload.targetId}');
    expect(logMessage?.parameters.value).toBe(expectedMessage);

    // Critical success adds warded_by_salt component to target
    const addComponent = actions.find(
      (op) =>
        op.type === 'ADD_COMPONENT' &&
        op.parameters.component_type === 'warding:warded_by_salt'
    );
    expect(addComponent).toBeDefined();
    expect(addComponent?.parameters.entity_ref).toBe('target');

    const hasSuccessMacro = actions.some(
      (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
    );
    expect(hasSuccessMacro).toBe(true);
  });

  it('dispatches correct message on SUCCESS', () => {
    const branch = findIfByOutcome(
      handleDrawSaltBoundaryRule.actions,
      'SUCCESS'
    );
    const actions = branch?.parameters.then_actions ?? [];

    const expectedMessage =
      '{context.actorName} draws a correct salt boundary around the corrupted target {context.targetName}.';

    const dispatch = actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    expect(dispatch?.parameters.description_text).toBe(expectedMessage);
    expect(logMessage?.parameters.value).toBe(expectedMessage);

    // Success adds warded_by_salt component to target
    const addComponent = actions.find(
      (op) =>
        op.type === 'ADD_COMPONENT' &&
        op.parameters.component_type === 'warding:warded_by_salt'
    );
    expect(addComponent).toBeDefined();
    expect(addComponent?.parameters.entity_ref).toBe('target');

    const hasSuccessMacro = actions.some(
      (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
    );
    expect(hasSuccessMacro).toBe(true);
  });

  it('leaves state unchanged on FAILURE but logs the correct message', () => {
    const branch = findIfByOutcome(
      handleDrawSaltBoundaryRule.actions,
      'FAILURE'
    );
    const actions = branch?.parameters.then_actions ?? [];

    expect(actions.some((op) => op.type === 'ADD_COMPONENT')).toBe(false);

    const dispatch = actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    const expectedMessage =
      '{context.actorName} fails at drawing a salt boundary around the corrupted target {context.targetName}. The boundary will need to be redone.';

    expect(dispatch?.parameters.description_text).toBe(expectedMessage);
    expect(logMessage?.parameters.value).toBe(expectedMessage);

    const hasFailureMacro = actions.some(
      (op) => op.macro === 'core:logFailureOutcomeAndEndTurn'
    );
    expect(hasFailureMacro).toBe(true);
  });

  it('adds fallen state and regenerates description on FUMBLE', () => {
    const branch = findIfByOutcome(
      handleDrawSaltBoundaryRule.actions,
      'FUMBLE'
    );
    const actions = branch?.parameters.then_actions ?? [];

    const fallenAdd = actions.find(
      (op) =>
        op.type === 'ADD_COMPONENT' &&
        op.parameters.component_type === 'positioning:fallen'
    );
    expect(fallenAdd?.parameters.entity_ref).toBe('actor');

    const regenOp = actions.find((op) => op.type === 'REGENERATE_DESCRIPTION');
    expect(regenOp?.parameters.entity_ref).toBe('actor');

    const expectedMessage =
      '{context.actorName} tries to draw a salt boundary around the corrupted target {context.targetName} in a hurry, but slips and falls to the ground.';
    const dispatch = actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    expect(dispatch?.parameters.description_text).toBe(expectedMessage);
    expect(logMessage?.parameters.value).toBe(expectedMessage);

    expect(
      actions.some((op) => op.macro === 'core:logFailureOutcomeAndEndTurn')
    ).toBe(true);
  });

  it('has positioning as a dependency for fallen component', () => {
    const positioningDep = wardingManifest.dependencies.find(
      (dep) => dep.id === 'positioning'
    );
    expect(positioningDep).toBeDefined();
    expect(positioningDep.version).toBe('>=1.0.0');
  });
});
