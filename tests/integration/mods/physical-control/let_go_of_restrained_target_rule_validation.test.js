/**
 * @file Integration tests for handle_let_go_of_restrained_target rule wiring.
 * @description Validates manifest registration, deterministic setup, and side effects.
 */

import { describe, it, expect } from '@jest/globals';
import handleLetGoRule from '../../../../data/mods/physical-control/rules/handle_let_go_of_restrained_target.rule.json' assert { type: 'json' };
import eventIsActionLetGo from '../../../../data/mods/physical-control/conditions/event-is-action-let-go-of-restrained-target.condition.json' assert { type: 'json' };
import letGoAction from '../../../../data/mods/physical-control/actions/let_go_of_restrained_target.action.json' assert { type: 'json' };
import physicalControlManifest from '../../../../data/mods/physical-control/mod-manifest.json' assert { type: 'json' };

const findAction = (type) =>
  handleLetGoRule.actions.find((action) => action.type === type);

describe('handle_let_go_of_restrained_target rule', () => {
  it('registers rule, condition, action, and scope in the manifest', () => {
    expect(handleLetGoRule.rule_id).toBe('handle_let_go_of_restrained_target');
    expect(handleLetGoRule.event_type).toBe('core:attempt_action');
    expect(handleLetGoRule.condition.condition_ref).toBe(
      'physical-control:event-is-action-let-go-of-restrained-target'
    );

    expect(eventIsActionLetGo.id).toBe(
      'physical-control:event-is-action-let-go-of-restrained-target'
    );
    expect(eventIsActionLetGo.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'physical-control:let_go_of_restrained_target',
    ]);

    expect(physicalControlManifest.content.actions).toContain(
      'let_go_of_restrained_target.action.json'
    );
    expect(physicalControlManifest.content.rules).toContain(
      'handle_let_go_of_restrained_target.rule.json'
    );
    expect(physicalControlManifest.content.conditions).toContain(
      'event-is-action-let-go-of-restrained-target.condition.json'
    );
    expect(physicalControlManifest.content.scopes).toContain(
      'restrained_entity_i_am_holding.scope'
    );
  });

  it('omits outcome resolution and keeps the action deterministic', () => {
    const resolveOutcome = findAction('RESOLVE_OUTCOME');
    expect(resolveOutcome).toBeUndefined();

    expect(letGoAction.chanceBased).toBeUndefined();
    expect(letGoAction.template).toBe('let go of {target}');

    const getNameOps = handleLetGoRule.actions.filter(
      (op) => op.type === 'GET_NAME'
    );
    expect(getNameOps).toHaveLength(2);
    const actorNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'actor'
    );
    const targetNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'target'
    );
    expect(actorNameOp?.parameters.result_variable).toBe('actorName');
    expect(targetNameOp?.parameters.result_variable).toBe('targetName');

    const positionQuery = findAction('QUERY_COMPONENT');
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.component_type).toBe('core:position');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');

    const setVariableOps = handleLetGoRule.actions.filter(
      (op) => op.type === 'SET_VARIABLE'
    );
    const locationVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'locationId'
    );
    const perceptionVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'perceptionType'
    );
    const targetIdVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'targetId'
    );

    expect(locationVar?.parameters.value).toBe(
      '{context.actorPosition.locationId}'
    );
    expect(perceptionVar?.parameters.value).toBe('action_target_general');
    expect(targetIdVar?.parameters.value).toBe('{event.payload.targetId}');
  });

  it('removes restraint components, unlocks grabbing, regenerates descriptions, and logs success', () => {
    const removeRestraining = handleLetGoRule.actions.find(
      (op) =>
        op.type === 'REMOVE_COMPONENT' &&
        op.parameters.component_type === 'positioning:restraining'
    );
    const removeBeingRestrained = handleLetGoRule.actions.find(
      (op) =>
        op.type === 'REMOVE_COMPONENT' &&
        op.parameters.component_type === 'positioning:being_restrained'
    );
    expect(removeRestraining?.parameters.entity_ref).toBe('actor');
    expect(removeBeingRestrained?.parameters.entity_ref).toBe('target');

    const unlockGrabbing = findAction('UNLOCK_GRABBING');
    expect(unlockGrabbing?.parameters.actor_id).toBe('{event.payload.actorId}');
    expect(unlockGrabbing?.parameters.count).toBe(2);
    expect(unlockGrabbing?.parameters.item_id).toBe(
      '{event.payload.targetId}'
    );

    const regenOps = handleLetGoRule.actions.filter(
      (op) => op.type === 'REGENERATE_DESCRIPTION'
    );
    expect(regenOps.map((op) => op.parameters.entity_ref).sort()).toEqual([
      'actor',
      'target',
    ]);

    const dispatch = findAction('DISPATCH_PERCEPTIBLE_EVENT');
    const logMessage = handleLetGoRule.actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' && op.parameters.variable_name === 'logMessage'
    );
    const expectedMessage =
      '{context.actorName} lets go of {context.targetName}, leaving them unrestrained.';

    expect(dispatch?.parameters.description_text).toBe(expectedMessage);
    expect(dispatch?.parameters.target_id).toBe('{event.payload.targetId}');
    expect(logMessage?.parameters.value).toBe(expectedMessage);

    const hasSuccessMacro = handleLetGoRule.actions.some(
      (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
    );
    expect(hasSuccessMacro).toBe(true);
  });
});
