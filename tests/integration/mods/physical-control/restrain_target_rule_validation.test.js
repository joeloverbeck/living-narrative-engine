/**
 * @file Integration tests for handle_restrain_target rule wiring and outcomes.
 * @description Validates condition wiring, outcome resolution setup, and branch side effects/messages.
 */

import { describe, it, expect } from '@jest/globals';
import handleRestrainTargetRule from '../../../../data/mods/physical-control/rules/handle_restrain_target.rule.json' assert { type: 'json' };
import eventIsActionRestrainTarget from '../../../../data/mods/physical-control/conditions/event-is-action-restrain-target.condition.json' assert { type: 'json' };
import physicalControlManifest from '../../../../data/mods/physical-control/mod-manifest.json' assert { type: 'json' };

const findIfByOutcome = (actions, outcomeValue) =>
  actions.find(
    (op) =>
      op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcomeValue
  );

describe('handle_restrain_target rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handleRestrainTargetRule.rule_id).toBe('handle_restrain_target');
    expect(handleRestrainTargetRule.event_type).toBe('core:attempt_action');
    expect(handleRestrainTargetRule.condition.condition_ref).toBe(
      'physical-control:event-is-action-restrain-target'
    );

    expect(eventIsActionRestrainTarget.id).toBe(
      'physical-control:event-is-action-restrain-target'
    );
    expect(eventIsActionRestrainTarget.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'physical-control:restrain_target',
    ]);

    expect(physicalControlManifest.content.rules).toContain(
      'handle_restrain_target.rule.json'
    );
    expect(physicalControlManifest.content.conditions).toContain(
      'event-is-action-restrain-target.condition.json'
    );
  });

  it('sets up names, position lookup, and outcome resolution for grappling vs defense', () => {
    const getNameOps = handleRestrainTargetRule.actions.filter(
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

    const positionQuery = handleRestrainTargetRule.actions.find(
      (op) => op.type === 'QUERY_COMPONENT'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.component_type).toBe('core:position');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');

    const resolveOutcome = handleRestrainTargetRule.actions.find(
      (op) => op.type === 'RESOLVE_OUTCOME'
    );
    expect(resolveOutcome).toBeDefined();
    expect(resolveOutcome.parameters.actor_skill_component).toBe(
      'skills:grappling_skill'
    );
    expect(resolveOutcome.parameters.target_skill_component).toBe(
      'skills:defense_skill'
    );
    expect(resolveOutcome.parameters.actor_skill_default).toBe(10);
    expect(resolveOutcome.parameters.target_skill_default).toBe(0);
    expect(resolveOutcome.parameters.formula).toBe('ratio');
    expect(resolveOutcome.parameters.result_variable).toBe('restrainResult');
  });

  it('sets shared variables for perception/logging', () => {
    const setVariableOps = handleRestrainTargetRule.actions.filter(
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
    const ifOps = handleRestrainTargetRule.actions.filter(
      (op) => op.type === 'IF'
    );

    expect(ifOps).toHaveLength(4);
    expect(
      findIfByOutcome(handleRestrainTargetRule.actions, 'CRITICAL_SUCCESS')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleRestrainTargetRule.actions, 'SUCCESS')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleRestrainTargetRule.actions, 'FAILURE')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleRestrainTargetRule.actions, 'FUMBLE')
    ).toBeDefined();
  });

  it('applies restraining effects on SUCCESS/CRITICAL_SUCCESS', () => {
    const outcomes = ['CRITICAL_SUCCESS', 'SUCCESS'];
    const expectedMessage =
      '{context.actorName} restrains {context.targetName}, preventing them from moving freely.';

    outcomes.forEach((outcome) => {
      const branch = findIfByOutcome(handleRestrainTargetRule.actions, outcome);
      const actions = branch?.parameters.then_actions ?? [];

      const beingRestrained = actions.find(
        (op) =>
          op.type === 'ADD_COMPONENT' &&
          op.parameters.component_type === 'positioning:being_restrained'
      );
      const restraining = actions.find(
        (op) =>
          op.type === 'ADD_COMPONENT' &&
          op.parameters.component_type === 'positioning:restraining'
      );
      const lockGrabbing = actions.find((op) => op.type === 'LOCK_GRABBING');
      const regenOps = actions.filter(
        (op) => op.type === 'REGENERATE_DESCRIPTION'
      );
      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      const logMessage = actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );

      expect(beingRestrained?.parameters.entity_ref).toBe('target');
      expect(beingRestrained?.parameters.value.restraining_entity_id).toBe(
        '{event.payload.actorId}'
      );

      expect(restraining?.parameters.entity_ref).toBe('actor');
      expect(restraining?.parameters.value.restrained_entity_id).toBe(
        '{event.payload.targetId}'
      );
      expect(restraining?.parameters.value.initiated).toBe(true);

      expect(lockGrabbing?.parameters.actor_id).toBe('{event.payload.actorId}');
      expect(lockGrabbing?.parameters.count).toBe(2);
      expect(lockGrabbing?.parameters.item_id).toBe('{event.payload.targetId}');

      expect(regenOps.map((op) => op.parameters.entity_ref).sort()).toEqual([
        'actor',
        'target',
      ]);

      expect(dispatch?.parameters.description_text).toBe(expectedMessage);
      expect(dispatch?.parameters.target_id).toBe('{event.payload.targetId}');
      expect(logMessage?.parameters.value).toBe(expectedMessage);

      const hasSuccessMacro = actions.some(
        (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
      );
      expect(hasSuccessMacro).toBe(true);
    });
  });

  it('leaves state unchanged on FAILURE but logs the correct message', () => {
    const branch = findIfByOutcome(handleRestrainTargetRule.actions, 'FAILURE');
    const actions = branch?.parameters.then_actions ?? [];

    expect(actions.some((op) => op.type === 'ADD_COMPONENT')).toBe(false);
    expect(actions.some((op) => op.type === 'LOCK_GRABBING')).toBe(false);

    const dispatch = actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    const expectedMessage =
      '{context.actorName} attempts to restrain {context.targetName}, but {context.targetName} resists, remaining free to move.';

    expect(dispatch?.parameters.description_text).toBe(expectedMessage);
    expect(logMessage?.parameters.value).toBe(expectedMessage);

    const hasFailureMacro = actions.some(
      (op) => op.macro === 'core:logFailureOutcomeAndEndTurn'
    );
    expect(hasFailureMacro).toBe(true);
  });

  it('adds fallen state on FUMBLE and logs failure', () => {
    const branch = findIfByOutcome(handleRestrainTargetRule.actions, 'FUMBLE');
    const actions = branch?.parameters.then_actions ?? [];

    const fallenAdd = actions.find(
      (op) =>
        op.type === 'ADD_COMPONENT' &&
        op.parameters.component_type === 'positioning:fallen'
    );
    expect(fallenAdd?.parameters.entity_ref).toBe('actor');

    const expectedMessage =
      '{context.actorName} attempts to restrain {context.targetName}, but during the struggle, {context.actorName} falls to the ground.';
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
});
