/**
 * @file Integration tests for handle_extract_spiritual_corruption rule wiring and outcomes.
 * @description Validates condition wiring, outcome resolution setup, and branch side effects/messages.
 */

import { describe, it, expect } from '@jest/globals';
import handleExtractRule from '../../../../data/mods/warding/rules/handle_extract_spiritual_corruption.rule.json' assert { type: 'json' };
import eventIsExtract from '../../../../data/mods/warding/conditions/event-is-action-extract-spiritual-corruption.condition.json' assert { type: 'json' };
import wardingManifest from '../../../../data/mods/warding/mod-manifest.json' assert { type: 'json' };

const findBranch = (actions, outcome) =>
  actions.find(
    (op) =>
      op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcome
  );

describe('handle_extract_spiritual_corruption rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handleExtractRule.rule_id).toBe(
      'handle_extract_spiritual_corruption'
    );
    expect(handleExtractRule.event_type).toBe('core:attempt_action');
    expect(handleExtractRule.condition.condition_ref).toBe(
      'warding:event-is-action-extract-spiritual-corruption'
    );

    expect(eventIsExtract.id).toBe(
      'warding:event-is-action-extract-spiritual-corruption'
    );
    expect(eventIsExtract.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'warding:extract_spiritual_corruption',
    ]);

    expect(wardingManifest.content.rules).toContain(
      'handle_extract_spiritual_corruption.rule.json'
    );
    expect(wardingManifest.content.conditions).toContain(
      'event-is-action-extract-spiritual-corruption.condition.json'
    );
  });

  it('sets up names, position lookup, and opposed outcome resolution', () => {
    const getNameOps = handleExtractRule.actions.filter(
      (op) => op.type === 'GET_NAME'
    );
    const actorNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'actor'
    );
    const targetNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'primary'
    );
    const anchorNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'secondary'
    );

    expect(actorNameOp?.parameters.result_variable).toBe('actorName');
    expect(targetNameOp?.parameters.result_variable).toBe('targetName');
    expect(anchorNameOp?.parameters.result_variable).toBe('anchorName');

    const positionQuery = handleExtractRule.actions.find(
      (op) => op.type === 'QUERY_COMPONENT'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.component_type).toBe('core:position');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');

    const resolveOutcome = handleExtractRule.actions.find(
      (op) => op.type === 'RESOLVE_OUTCOME'
    );
    expect(resolveOutcome).toBeDefined();
    expect(resolveOutcome.parameters.actor_skill_component).toBe(
      'skills:warding_skill'
    );
    expect(resolveOutcome.parameters.target_skill_component).toBe(
      'skills:resolve_skill'
    );
    expect(resolveOutcome.parameters.actor_skill_default).toBe(10);
    expect(resolveOutcome.parameters.target_skill_default).toBe(0);
    expect(resolveOutcome.parameters.formula).toBe('ratio');
    expect(resolveOutcome.parameters.result_variable).toBe('extractionResult');
    expect(resolveOutcome.parameters.target_role).toBe('primary');
  });

  it('sets shared variables for perception/logging', () => {
    const setVarOps = handleExtractRule.actions.filter(
      (op) => op.type === 'SET_VARIABLE'
    );
    const locationVar = setVarOps.find(
      (op) => op.parameters.variable_name === 'locationId'
    );
    const perceptionVar = setVarOps.find(
      (op) => op.parameters.variable_name === 'perceptionType'
    );
    const targetVar = setVarOps.find(
      (op) => op.parameters.variable_name === 'targetId'
    );

    expect(locationVar?.parameters.value).toBe(
      '{context.actorPosition.locationId}'
    );
    expect(perceptionVar?.parameters.value).toBe('physical.target_action');
    expect(targetVar?.parameters.value).toBe('{event.payload.primaryId}');
  });

  it('branches for all four outcomes', () => {
    const branches = handleExtractRule.actions.filter((op) => op.type === 'IF');

    expect(branches).toHaveLength(4);
    expect(
      findBranch(handleExtractRule.actions, 'CRITICAL_SUCCESS')
    ).toBeDefined();
    expect(findBranch(handleExtractRule.actions, 'SUCCESS')).toBeDefined();
    expect(findBranch(handleExtractRule.actions, 'FAILURE')).toBeDefined();
    expect(findBranch(handleExtractRule.actions, 'FUMBLE')).toBeDefined();
  });

  it('removes corruption and regenerates description on CRITICAL_SUCCESS', () => {
    const branch = findBranch(handleExtractRule.actions, 'CRITICAL_SUCCESS');
    const actions = branch?.parameters.then_actions ?? [];

    const removeComponent = actions.find(
      (op) =>
        op.type === 'REMOVE_COMPONENT' &&
        op.parameters.component_type === 'warding:corrupted'
    );
    expect(removeComponent?.parameters.entity_ref).toBe('primary');

    const regenOp = actions.find((op) => op.type === 'REGENERATE_DESCRIPTION');
    expect(regenOp?.parameters.entity_ref).toBe('primary');

    const expectedMessage =
      "{context.actorName} extracts the corruption out of {context.targetName} swiftly using {context.anchorName}. Light returns to {context.targetName}'s eyes.";
    const dispatches = actions.filter(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    expect(dispatches).toHaveLength(2);
    const generalDispatch = dispatches.find((op) =>
      op.parameters.contextual_data?.excludedActorIds?.includes(
        '{event.payload.primaryId}'
      )
    );
    const targetDispatch = dispatches.find((op) =>
      op.parameters.contextual_data?.recipientIds?.includes(
        '{event.payload.primaryId}'
      )
    );

    expect(generalDispatch?.parameters.description_text).toBe(expectedMessage);
    expect(targetDispatch?.parameters.description_text).toBe(
      "{context.actorName} uses {context.anchorName} against me, and suddenly I feel like I'm being burned alive from the inside as something dark rushes out of me. Then it ends. My insides are cleaner, but I feel like I've suffered through a harrowing struggle."
    );
    expect(logMessage?.parameters.value).toBe(expectedMessage);
    expect(
      actions.some((op) => op.macro === 'core:logSuccessOutcomeAndEndTurn')
    ).toBe(true);
  });

  it('removes corruption and logs struggle message on SUCCESS', () => {
    const branch = findBranch(handleExtractRule.actions, 'SUCCESS');
    const actions = branch?.parameters.then_actions ?? [];

    const removeComponent = actions.find(
      (op) =>
        op.type === 'REMOVE_COMPONENT' &&
        op.parameters.component_type === 'warding:corrupted'
    );
    expect(removeComponent?.parameters.entity_ref).toBe('primary');

    const regenOp = actions.find((op) => op.type === 'REGENERATE_DESCRIPTION');
    expect(regenOp?.parameters.entity_ref).toBe('primary');

    const expectedMessage =
      'After a struggle, {context.actorName} extracts the corruption out of {context.targetName} using {context.anchorName}.';
    const dispatches = actions.filter(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    expect(dispatches).toHaveLength(2);
    const generalDispatch = dispatches.find((op) =>
      op.parameters.contextual_data?.excludedActorIds?.includes(
        '{event.payload.primaryId}'
      )
    );
    const targetDispatch = dispatches.find((op) =>
      op.parameters.contextual_data?.recipientIds?.includes(
        '{event.payload.primaryId}'
      )
    );

    expect(generalDispatch?.parameters.description_text).toBe(expectedMessage);
    expect(targetDispatch?.parameters.description_text).toBe(
      '{context.actorName} uses {context.anchorName} against me, and my insides feel on fire as something claws at my flesh trying to avoid getting sucked out. I suffer through the struggle, but in the end, the darkness is gone, and I feel cleaner.'
    );
    expect(logMessage?.parameters.value).toBe(expectedMessage);
    expect(
      actions.some((op) => op.macro === 'core:logSuccessOutcomeAndEndTurn')
    ).toBe(true);
  });

  it('leaves corruption intact but logs failure message on FAILURE', () => {
    const branch = findBranch(handleExtractRule.actions, 'FAILURE');
    const actions = branch?.parameters.then_actions ?? [];

    expect(actions.some((op) => op.type === 'REMOVE_COMPONENT')).toBe(false);

    const expectedMessage =
      "Despite a struggle, {context.actorName} fails to extract the corruption out of {context.targetName} using {context.anchorName}. Darkness lingers in {context.targetName}'s eyes.";
    const dispatches = actions.filter(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    expect(dispatches).toHaveLength(2);
    const generalDispatch = dispatches.find((op) =>
      op.parameters.contextual_data?.excludedActorIds?.includes(
        '{event.payload.primaryId}'
      )
    );
    const targetDispatch = dispatches.find((op) =>
      op.parameters.contextual_data?.recipientIds?.includes(
        '{event.payload.primaryId}'
      )
    );

    expect(generalDispatch?.parameters.description_text).toBe(expectedMessage);
    expect(targetDispatch?.parameters.description_text).toBe(
      '{context.actorName} uses {context.anchorName} against me, and suddenly my insides feel on fire as something claws at my flesh trying to avoid getting sucked out. I suffer through a harrowing struggle. The darkness refuses to leave my body.'
    );
    expect(logMessage?.parameters.value).toBe(expectedMessage);
    expect(
      actions.some((op) => op.macro === 'core:logFailureOutcomeAndEndTurn')
    ).toBe(true);
  });

  it('drops the anchor and regenerates actor description on FUMBLE', () => {
    const branch = findBranch(handleExtractRule.actions, 'FUMBLE');
    const actions = branch?.parameters.then_actions ?? [];

    const unwieldOp = actions.find((op) => op.type === 'UNWIELD_ITEM');
    expect(unwieldOp?.parameters.actorEntity).toBe('{event.payload.actorId}');
    expect(unwieldOp?.parameters.itemEntity).toBe(
      '{event.payload.secondaryId}'
    );

    const dropOp = actions.find((op) => op.type === 'DROP_ITEM_AT_LOCATION');
    expect(dropOp?.parameters.locationId).toBe(
      '{context.actorPosition.locationId}'
    );
    expect(dropOp?.parameters.itemEntity).toBe('{event.payload.secondaryId}');

    const regenOp = actions.find((op) => op.type === 'REGENERATE_DESCRIPTION');
    expect(regenOp?.parameters.entity_ref).toBe('{event.payload.actorId}');

    const expectedMessage =
      "{context.actorName} attempts to extract the corruption out of {context.targetName} using {context.anchorName}, but during the struggle, the {context.anchorName} slips from {context.actorName}'s hands.";
    const dispatches = actions.filter(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    expect(dispatches).toHaveLength(2);
    const generalDispatch = dispatches.find((op) =>
      op.parameters.contextual_data?.excludedActorIds?.includes(
        '{event.payload.primaryId}'
      )
    );
    const targetDispatch = dispatches.find((op) =>
      op.parameters.contextual_data?.recipientIds?.includes(
        '{event.payload.primaryId}'
      )
    );

    expect(generalDispatch?.parameters.description_text).toBe(expectedMessage);
    expect(targetDispatch?.parameters.description_text).toBe(
      "{context.actorName} uses {context.anchorName} against me, and suddenly my insides feel on fire as something claws at my flesh trying to avoid getting sucked out. I suffer through a harrowing struggle. With a spasm, the darkness, still anchored inside me, sends an echo that makes {context.anchorName} slip out of {context.actorName}'s hands."
    );
    expect(logMessage?.parameters.value).toBe(expectedMessage);
    expect(
      actions.some((op) => op.macro === 'core:logFailureOutcomeAndEndTurn')
    ).toBe(true);
  });
});
