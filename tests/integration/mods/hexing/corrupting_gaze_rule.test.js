/**
 * @file Integration tests for handle_corrupting_gaze rule wiring and outcomes.
 * @description Validates condition wiring, outcome branches, dual perception handling, and side effects.
 */

import { describe, it, expect } from '@jest/globals';
import handleCorruptingRule from '../../../../data/mods/hexing/rules/handle_corrupting_gaze.rule.json' assert { type: 'json' };
import eventIsCorrupting from '../../../../data/mods/hexing/conditions/event-is-action-corrupting-gaze.condition.json' assert { type: 'json' };
import hexingManifest from '../../../../data/mods/hexing/mod-manifest.json' assert { type: 'json' };
import corruptingAction from '../../../../data/mods/hexing/actions/corrupting_gaze.action.json' assert { type: 'json' };

const findBranch = (actions, outcome) =>
  actions.find(
    (op) =>
      op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcome
  );

const getPerceptibleEvents = (actions) =>
  actions.filter((op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT');

describe('handle_corrupting_gaze rule', () => {
  it('registers rule, condition, and manifest entries', () => {
    expect(handleCorruptingRule.rule_id).toBe('handle_corrupting_gaze');
    expect(handleCorruptingRule.event_type).toBe('core:attempt_action');
    expect(handleCorruptingRule.condition.condition_ref).toBe(
      'hexing:event-is-action-corrupting-gaze'
    );

    expect(eventIsCorrupting.id).toBe('hexing:event-is-action-corrupting-gaze');
    expect(eventIsCorrupting.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'hexing:corrupting_gaze',
    ]);

    expect(hexingManifest.content.actions).toContain(
      'corrupting_gaze.action.json'
    );
    expect(hexingManifest.content.conditions).toContain(
      'event-is-action-corrupting-gaze.condition.json'
    );
    expect(hexingManifest.content.rules).toContain(
      'handle_corrupting_gaze.rule.json'
    );
    expect(hexingManifest.content.components).toContain(
      'is_hexer.component.json'
    );
  });

  it('aligns rule outcome resolution with action chance setup', () => {
    const resolveOutcome = handleCorruptingRule.actions.find(
      (op) => op.type === 'RESOLVE_OUTCOME'
    );
    expect(resolveOutcome).toBeDefined();
    expect(resolveOutcome.parameters.actor_skill_component).toBe(
      corruptingAction.chanceBased.actorSkill.component
    );
    expect(resolveOutcome.parameters.target_skill_component).toBe(
      corruptingAction.chanceBased.targetSkill.component
    );
    expect(resolveOutcome.parameters.actor_skill_default).toBe(10);
    expect(resolveOutcome.parameters.target_skill_default).toBe(0);
    expect(resolveOutcome.parameters.formula).toBe('ratio');
    expect(resolveOutcome.parameters.result_variable).toBe('gazeResult');
    expect(resolveOutcome.parameters.target_role).toBe('primary');
  });

  it('captures names, position, and shared perception context', () => {
    const getNameOps = handleCorruptingRule.actions.filter(
      (op) => op.type === 'GET_NAME'
    );
    const actorNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'actor'
    );
    const targetNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'primary'
    );
    expect(actorNameOp?.parameters.result_variable).toBe('actorName');
    expect(targetNameOp?.parameters.result_variable).toBe('targetName');

    const positionQuery = handleCorruptingRule.actions.find(
      (op) => op.type === 'QUERY_COMPONENT'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.component_type).toBe('core:position');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');

    const setVars = handleCorruptingRule.actions.filter(
      (op) => op.type === 'SET_VARIABLE'
    );
    const locationVar = setVars.find(
      (op) => op.parameters.variable_name === 'locationId'
    );
    const perceptionVar = setVars.find(
      (op) => op.parameters.variable_name === 'perceptionType'
    );
    const targetVar = setVars.find(
      (op) => op.parameters.variable_name === 'targetId'
    );

    expect(locationVar?.parameters.value).toBe(
      '{context.actorPosition.locationId}'
    );
    expect(perceptionVar?.parameters.value).toBe('physical.target_action');
    expect(targetVar?.parameters.value).toBe('{event.payload.primaryId}');
  });

  it('branches on all outcomes with dual perception on successes', () => {
    const branches = handleCorruptingRule.actions.filter(
      (op) => op.type === 'IF'
    );
    expect(branches).toHaveLength(4);
    expect(
      findBranch(handleCorruptingRule.actions, 'CRITICAL_SUCCESS')
    ).toBeDefined();
    expect(findBranch(handleCorruptingRule.actions, 'SUCCESS')).toBeDefined();
    expect(findBranch(handleCorruptingRule.actions, 'FAILURE')).toBeDefined();
    expect(findBranch(handleCorruptingRule.actions, 'FUMBLE')).toBeDefined();

    const critEvents = getPerceptibleEvents(
      findBranch(handleCorruptingRule.actions, 'CRITICAL_SUCCESS')?.parameters
        .then_actions || []
    );
    const successEvents = getPerceptibleEvents(
      findBranch(handleCorruptingRule.actions, 'SUCCESS')?.parameters
        .then_actions || []
    );
    expect(critEvents).toHaveLength(2);
    expect(successEvents).toHaveLength(2);
  });

  it('adds corruption and publishes dual perception on CRITICAL_SUCCESS', () => {
    const branch = findBranch(handleCorruptingRule.actions, 'CRITICAL_SUCCESS');
    const actions = branch?.parameters.then_actions ?? [];

    const addCorruption = actions.find(
      (op) =>
        op.type === 'ADD_COMPONENT' &&
        op.parameters.component_type === 'warding:corrupted'
    );
    expect(addCorruption?.parameters.entity_ref).toBe('primary');

    const regen = actions.find((op) => op.type === 'REGENERATE_DESCRIPTION');
    expect(regen?.parameters.entity_ref).toBe('primary');

    const [publicEvent, privateEvent] = getPerceptibleEvents(actions);
    const expectedPublicMessage =
      "{context.actorName} looks deeply into {context.targetName}'s eyes, casting a corrupting gaze. {context.targetName} shudders violently as darkness floods through them.";
    const expectedPrivateMessage =
      '{context.actorName} looks deeply into my eyes, and I feel darkness flooding into me. A sickly warmth fills you, accompanied by a burning smell and a ringing noise in your ears.';

    expect(publicEvent.parameters.description_text).toBe(expectedPublicMessage);
    expect(publicEvent.parameters.contextual_data.excludedActorIds).toEqual([
      '{event.payload.primaryId}',
    ]);
    expect(privateEvent.parameters.description_text).toBe(
      expectedPrivateMessage
    );
    expect(privateEvent.parameters.contextual_data.recipientIds).toEqual([
      '{event.payload.primaryId}',
    ]);

    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );
    expect(logMessage?.parameters.value).toBe(expectedPublicMessage);
    expect(
      actions.some((op) => op.macro === 'core:logSuccessOutcomeAndEndTurn')
    ).toBe(true);
  });

  it('adds corruption and publishes dual perception on SUCCESS', () => {
    const branch = findBranch(handleCorruptingRule.actions, 'SUCCESS');
    const actions = branch?.parameters.then_actions ?? [];

    const addCorruption = actions.find(
      (op) =>
        op.type === 'ADD_COMPONENT' &&
        op.parameters.component_type === 'warding:corrupted'
    );
    expect(addCorruption?.parameters.entity_ref).toBe('primary');

    const regen = actions.find((op) => op.type === 'REGENERATE_DESCRIPTION');
    expect(regen?.parameters.entity_ref).toBe('primary');

    const [publicEvent, privateEvent] = getPerceptibleEvents(actions);
    const expectedPublicMessage =
      "{context.actorName} looks deeply into {context.targetName}'s eyes, casting a corrupting gaze. {context.targetName} shudders as darkness seeps into them.";
    const expectedPrivateMessage =
      '{context.actorName} looks deeply into my eyes, and I feel darkness seeping into me. A sickly warmth starts filling me, accompanied by a burning smell.';

    expect(publicEvent.parameters.description_text).toBe(expectedPublicMessage);
    expect(publicEvent.parameters.contextual_data.excludedActorIds).toEqual([
      '{event.payload.primaryId}',
    ]);
    expect(privateEvent.parameters.description_text).toBe(
      expectedPrivateMessage
    );
    expect(privateEvent.parameters.contextual_data.recipientIds).toEqual([
      '{event.payload.primaryId}',
    ]);

    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );
    expect(logMessage?.parameters.value).toBe(expectedPublicMessage);
    expect(
      actions.some((op) => op.macro === 'core:logSuccessOutcomeAndEndTurn')
    ).toBe(true);
  });

  it('logs resistance on FAILURE without altering components', () => {
    const branch = findBranch(handleCorruptingRule.actions, 'FAILURE');
    const actions = branch?.parameters.then_actions ?? [];

    expect(actions.some((op) => op.type === 'ADD_COMPONENT')).toBe(false);
    expect(actions.some((op) => op.type === 'REMOVE_COMPONENT')).toBe(false);

    const expectedMessage =
      "{context.actorName} looks deeply into {context.targetName}'s eyes, casting a corrupting gaze, but {context.targetName} resists the spiritual attack.";
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

  it('adds fallen to actor and logs failure on FUMBLE', () => {
    const branch = findBranch(handleCorruptingRule.actions, 'FUMBLE');
    const actions = branch?.parameters.then_actions ?? [];

    const addFallen = actions.find(
      (op) =>
        op.type === 'ADD_COMPONENT' &&
        op.parameters.component_type === 'positioning:fallen'
    );
    expect(addFallen?.parameters.entity_ref).toBe('actor');

    const regen = actions.find((op) => op.type === 'REGENERATE_DESCRIPTION');
    expect(regen?.parameters.entity_ref).toBe('actor');

    const expectedMessage =
      "{context.actorName} looks deeply into {context.targetName}'s eyes, casting a corrupting gaze, but {context.targetName}'s resolve shocks through {context.actorName}, making them fall to the ground.";
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
