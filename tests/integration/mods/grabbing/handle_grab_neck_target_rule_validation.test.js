/**
 * @file Integration tests for handle_grab_neck_target rule wiring and outcomes.
 * @description Validates condition wiring, outcome resolution setup, and branch effects/messages.
 */

import { describe, it, expect } from '@jest/globals';
import handleGrabNeckTargetRule from '../../../../data/mods/grabbing/rules/handle_grab_neck_target.rule.json' assert { type: 'json' };
import eventIsActionGrabNeckTarget from '../../../../data/mods/grabbing/conditions/event-is-action-grab-neck-target.condition.json' assert { type: 'json' };
import grabbingManifest from '../../../../data/mods/grabbing/mod-manifest.json' assert { type: 'json' };

const findIfByOutcome = (actions, outcomeValue) =>
  actions.find(
    (op) =>
      op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcomeValue
  );

describe('handle_grab_neck_target rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handleGrabNeckTargetRule.rule_id).toBe('handle_grab_neck_target');
    expect(handleGrabNeckTargetRule.event_type).toBe('core:attempt_action');
    expect(handleGrabNeckTargetRule.condition.condition_ref).toBe(
      'grabbing:event-is-action-grab-neck-target'
    );

    expect(eventIsActionGrabNeckTarget.id).toBe(
      'grabbing:event-is-action-grab-neck-target'
    );
    expect(eventIsActionGrabNeckTarget.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'grabbing:grab_neck_target',
    ]);

    expect(grabbingManifest.content.rules).toContain(
      'handle_grab_neck_target.rule.json'
    );
    expect(grabbingManifest.content.conditions).toContain(
      'event-is-action-grab-neck-target.condition.json'
    );
  });

  it('sets up names, position lookup, and outcome resolution for grappling vs mobility', () => {
    const getNameOps = handleGrabNeckTargetRule.actions.filter(
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

    const positionQuery = handleGrabNeckTargetRule.actions.find(
      (op) => op.type === 'QUERY_COMPONENT'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.component_type).toBe('core:position');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');

    const resolveOutcome = handleGrabNeckTargetRule.actions.find(
      (op) => op.type === 'RESOLVE_OUTCOME'
    );
    expect(resolveOutcome).toBeDefined();
    expect(resolveOutcome.parameters.actor_skill_component).toBe(
      'skills:grappling_skill'
    );
    expect(resolveOutcome.parameters.target_skill_component).toBe(
      'skills:mobility_skill'
    );
    expect(resolveOutcome.parameters.actor_skill_default).toBe(10);
    expect(resolveOutcome.parameters.target_skill_default).toBe(0);
    expect(resolveOutcome.parameters.formula).toBe('ratio');
    expect(resolveOutcome.parameters.result_variable).toBe('attackResult');
    expect(resolveOutcome.parameters.target_role).toBe('primary');
  });

  it('sets shared variables for perception/logging', () => {
    const setVariableOps = handleGrabNeckTargetRule.actions.filter(
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
    expect(perceptionVar?.parameters.value).toBe('physical.target_action');
    expect(targetVar?.parameters.value).toBe('{event.payload.targetId}');
  });

  it('branches flatly for all four outcomes', () => {
    const ifOps = handleGrabNeckTargetRule.actions.filter(
      (op) => op.type === 'IF'
    );

    expect(ifOps).toHaveLength(4);
    expect(
      findIfByOutcome(handleGrabNeckTargetRule.actions, 'CRITICAL_SUCCESS')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleGrabNeckTargetRule.actions, 'SUCCESS')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleGrabNeckTargetRule.actions, 'FAILURE')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleGrabNeckTargetRule.actions, 'FUMBLE')
    ).toBeDefined();
  });

  it('applies grabbing effects on SUCCESS/CRITICAL_SUCCESS', () => {
    const expectations = {
      CRITICAL_SUCCESS: {
        description:
          "{context.actorName} lunges forward with predatory speed, seizing {context.targetName}'s neck in an iron grip!",
        actor: "I lunge forward with predatory speed, seizing {context.targetName}'s neck in an iron grip!",
        target:
          '{context.actorName} lunges forward with predatory speed, seizing my neck in an iron grip!',
        alternate: {
          auditory: 'I hear a sudden scuffle and a choking sound nearby.',
          tactile: 'I feel the impact of bodies colliding nearby.',
        },
      },
      SUCCESS: {
        description:
          "{context.actorName} reaches out and grabs {context.targetName}'s neck, gaining a firm hold.",
        actor:
          "I reach out and grab {context.targetName}'s neck, gaining a firm hold.",
        target:
          '{context.actorName} reaches out and grabs my neck, gaining a firm hold.',
        alternate: {
          auditory: 'I hear sounds of a brief struggle nearby.',
          tactile: 'I feel vibrations of physical contact nearby.',
        },
      },
    };

    Object.entries(expectations).forEach(([outcome, expected]) => {
      const branch = findIfByOutcome(handleGrabNeckTargetRule.actions, outcome);
      const actions = branch?.parameters.then_actions ?? [];

      const grabbingNeck = actions.find(
        (op) =>
          op.type === 'ADD_COMPONENT' &&
          op.parameters.component_type === 'grabbing-states:grabbing_neck'
      );
      const neckGrabbed = actions.find(
        (op) =>
          op.type === 'ADD_COMPONENT' &&
          op.parameters.component_type === 'grabbing-states:neck_grabbed'
      );
      const lockGrabbing = actions.find((op) => op.type === 'LOCK_GRABBING');
      const regenOps = actions.filter(
        (op) => op.type === 'REGENERATE_DESCRIPTION'
      );
      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(grabbingNeck?.parameters.entity_ref).toBe('actor');
      expect(grabbingNeck?.parameters.value.grabbed_entity_id).toBe(
        '{event.payload.targetId}'
      );
      expect(grabbingNeck?.parameters.value.initiated).toBe(true);
      expect(grabbingNeck?.parameters.value.consented).toBe(false);

      expect(neckGrabbed?.parameters.entity_ref).toBe('target');
      expect(neckGrabbed?.parameters.value.grabbing_entity_id).toBe(
        '{event.payload.actorId}'
      );
      expect(neckGrabbed?.parameters.value.consented).toBe(false);

      expect(lockGrabbing?.parameters.actor_id).toBe('{event.payload.actorId}');
      expect(lockGrabbing?.parameters.count).toBe(1);
      expect(lockGrabbing?.parameters.item_id).toBe('{event.payload.targetId}');

      expect(regenOps.map((op) => op.parameters.entity_ref).sort()).toEqual([
        'actor',
        'target',
      ]);

      expect(dispatch?.parameters.description_text).toBe(expected.description);
      expect(dispatch?.parameters.actor_description).toBe(expected.actor);
      expect(dispatch?.parameters.target_description).toBe(expected.target);
      expect(dispatch?.parameters.perception_type).toBe(
        'physical.target_action'
      );
      expect(dispatch?.parameters.target_id).toBe('{event.payload.targetId}');
      expect(dispatch?.parameters.alternate_descriptions).toEqual(
        expected.alternate
      );

      const hasSuccessMacro = actions.some(
        (op) => op.macro === 'core:endTurnOnly'
      );
      expect(hasSuccessMacro).toBe(true);
    });
  });

  it('leaves state unchanged on FAILURE but logs the correct message', () => {
    const branch = findIfByOutcome(handleGrabNeckTargetRule.actions, 'FAILURE');
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
      "{context.actorName} reaches for {context.targetName}'s neck, but {context.targetName} manages to evade the grab.";

    expect(dispatch?.parameters.description_text).toBe(expectedMessage);
    expect(dispatch?.parameters.actor_description).toBe(
      "I reach for {context.targetName}'s neck, but they manage to evade my grab."
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} reaches for my neck, but I manage to evade the grab.'
    );
    expect(dispatch?.parameters.alternate_descriptions).toEqual({
      auditory: 'I hear shuffling and movement nearby.',
    });
    expect(logMessage?.parameters.value).toBe(expectedMessage);

    const hasFailureMacro = actions.some(
      (op) => op.macro === 'core:logFailureOutcomeAndEndTurn'
    );
    expect(hasFailureMacro).toBe(true);
  });

  it('adds fallen state on FUMBLE and logs failure', () => {
    const branch = findIfByOutcome(handleGrabNeckTargetRule.actions, 'FUMBLE');
    const actions = branch?.parameters.then_actions ?? [];

    const fallenAdd = actions.find(
      (op) =>
        op.type === 'ADD_COMPONENT' &&
        op.parameters.component_type === 'recovery-states:fallen'
    );
    expect(fallenAdd?.parameters.entity_ref).toBe('actor');

    expect(actions.some((op) => op.type === 'LOCK_GRABBING')).toBe(false);

    const expectedMessage =
      "{context.actorName} lunges recklessly at {context.targetName}'s throat, completely overextending and crashing to the ground!";
    const dispatch = actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    expect(dispatch?.parameters.description_text).toBe(expectedMessage);
    expect(dispatch?.parameters.actor_description).toBe(
      "I lunge recklessly at {context.targetName}'s throat, completely overextending and crashing to the ground!"
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} lunges recklessly at my throat, completely overextending and crashing to the ground!'
    );
    expect(dispatch?.parameters.alternate_descriptions).toEqual({
      auditory: 'I hear someone stumble and fall heavily nearby.',
      tactile: 'I feel the thud of someone hitting the ground nearby.',
    });
    expect(logMessage?.parameters.value).toBe(expectedMessage);

    expect(
      actions.some((op) => op.macro === 'core:logFailureOutcomeAndEndTurn')
    ).toBe(true);
  });
});
