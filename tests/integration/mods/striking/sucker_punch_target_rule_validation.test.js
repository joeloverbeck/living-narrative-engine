/**
 * @file Integration tests for handle_sucker_punch_target rule wiring and outcomes.
 * @description Validates condition wiring, outcome resolution setup, sense-aware perception fields, and branch side effects/messages.
 *              Key difference from punch_target: uses awareness_skill instead of defense_skill for target.
 */

import { describe, it, expect } from '@jest/globals';
import handleSuckerPunchTargetRule from '../../../../data/mods/striking/rules/handle_sucker_punch_target.rule.json' assert { type: 'json' };
import eventIsActionSuckerPunchTarget from '../../../../data/mods/striking/conditions/event-is-action-sucker-punch-target.condition.json' assert { type: 'json' };
import strikingManifest from '../../../../data/mods/striking/mod-manifest.json' assert { type: 'json' };

const findIfByOutcome = (actions, outcomeValue) =>
  actions.find(
    (op) =>
      op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcomeValue
  );

describe('handle_sucker_punch_target rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handleSuckerPunchTargetRule.rule_id).toBe('handle_sucker_punch_target');
    expect(handleSuckerPunchTargetRule.event_type).toBe('core:attempt_action');
    expect(handleSuckerPunchTargetRule.condition.condition_ref).toBe(
      'striking:event-is-action-sucker-punch-target'
    );

    expect(eventIsActionSuckerPunchTarget.id).toBe(
      'striking:event-is-action-sucker-punch-target'
    );
    expect(eventIsActionSuckerPunchTarget.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'striking:sucker_punch_target',
    ]);

    expect(strikingManifest.content.rules).toContain(
      'handle_sucker_punch_target.rule.json'
    );
    expect(strikingManifest.content.conditions).toContain(
      'event-is-action-sucker-punch-target.condition.json'
    );
  });

  it('sets up names, position lookup, damage capabilities, and outcome resolution for melee vs awareness', () => {
    const getNameOps = handleSuckerPunchTargetRule.actions.filter(
      (op) => op.type === 'GET_NAME'
    );
    const actorNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'actor'
    );
    const targetNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'secondary'
    );
    const weaponNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'primary'
    );

    expect(actorNameOp?.parameters.result_variable).toBe('actorName');
    expect(targetNameOp?.parameters.result_variable).toBe('targetName');
    expect(weaponNameOp?.parameters.result_variable).toBe('weaponName');

    const queryComponentOps = handleSuckerPunchTargetRule.actions.filter(
      (op) => op.type === 'QUERY_COMPONENT'
    );
    const positionQuery = queryComponentOps.find(
      (op) => op.parameters.component_type === 'core:position'
    );
    const damageQuery = queryComponentOps.find(
      (op) => op.parameters.component_type === 'damage-types:damage_capabilities'
    );

    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');
    expect(damageQuery?.parameters.entity_ref).toBe('primary');
    expect(damageQuery?.parameters.result_variable).toBe('weaponDamage');

    const resolveOutcome = handleSuckerPunchTargetRule.actions.find(
      (op) => op.type === 'RESOLVE_OUTCOME'
    );
    expect(resolveOutcome).toBeDefined();
    expect(resolveOutcome.parameters.actor_skill_component).toBe(
      'skills:melee_skill'
    );
    // Key difference: uses awareness_skill instead of defense_skill
    expect(resolveOutcome.parameters.target_skill_component).toBe(
      'skills:awareness_skill'
    );
    expect(resolveOutcome.parameters.actor_skill_default).toBe(10);
    expect(resolveOutcome.parameters.target_skill_default).toBe(0);
    expect(resolveOutcome.parameters.formula).toBe('ratio');
    expect(resolveOutcome.parameters.result_variable).toBe('attackResult');
    expect(resolveOutcome.parameters.target_role).toBe('secondary');
  });

  it('sets shared variables for perception/logging', () => {
    const setVariableOps = handleSuckerPunchTargetRule.actions.filter(
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
    const excludeDamageVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'excludeDamageTypes'
    );

    expect(locationVar?.parameters.value).toBe(
      '{context.actorPosition.locationId}'
    );
    expect(perceptionVar?.parameters.value).toBe('physical.target_action');
    expect(targetVar?.parameters.value).toBe('{event.payload.secondaryId}');
    expect(excludeDamageVar?.parameters.value).toEqual(['slashing', 'piercing']);
  });

  it('branches flatly for all four outcomes', () => {
    const ifOps = handleSuckerPunchTargetRule.actions.filter(
      (op) => op.type === 'IF'
    );

    expect(ifOps).toHaveLength(4);
    expect(
      findIfByOutcome(handleSuckerPunchTargetRule.actions, 'CRITICAL_SUCCESS')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleSuckerPunchTargetRule.actions, 'SUCCESS')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleSuckerPunchTargetRule.actions, 'FAILURE')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleSuckerPunchTargetRule.actions, 'FUMBLE')
    ).toBeDefined();
  });

  it('applies damage with 1.5x multiplier on CRITICAL_SUCCESS with sense-aware perception', () => {
    const branch = findIfByOutcome(handleSuckerPunchTargetRule.actions, 'CRITICAL_SUCCESS');
    const actions = branch?.parameters.then_actions ?? [];

    const dispatch = actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );
    const forEachOp = actions.find((op) => op.type === 'FOR_EACH');
    const dispatchResultEvent = actions.find(
      (op) =>
        op.type === 'DISPATCH_EVENT' &&
        op.parameters.eventType === 'core:display_successful_action_result'
    );

    // Verify sense-aware perception fields with sucker punch narrative
    expect(dispatch?.parameters.description_text).toBe(
      '{context.actorName} catches {context.targetName} completely off guard, landing a devastating surprise blow with their {context.weaponName}!'
    );
    expect(dispatch?.parameters.actor_description).toBe(
      'I catch {context.targetName} completely off guard, landing a devastating surprise blow with my {context.weaponName}!'
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} catches me completely off guard, landing a devastating surprise blow with their {context.weaponName}!'
    );
    expect(dispatch?.parameters.perception_type).toBe('combat.attack');
    expect(dispatch?.parameters.actor_id).toBe('{event.payload.actorId}');
    expect(dispatch?.parameters.target_id).toBe('{event.payload.secondaryId}');
    expect(dispatch?.parameters.alternate_descriptions).toEqual({
      auditory: 'I hear the heavy thud of a surprise blow landing nearby.',
      tactile: 'I feel the vibration of a hard impact nearby.',
    });

    expect(logMessage?.parameters.value).toBe(
      '{context.actorName} catches {context.targetName} completely off guard, landing a devastating surprise blow with their {context.weaponName}!'
    );
    expect(dispatchResultEvent).toBeDefined();

    // Verify damage loop with 1.5x multiplier
    expect(forEachOp?.parameters.collection).toBe('context.weaponDamage.entries');
    expect(forEachOp?.parameters.item_variable).toBe('dmgEntry');
    const applyDamage = forEachOp?.parameters.actions?.find(
      (op) => op.type === 'APPLY_DAMAGE'
    );
    expect(applyDamage?.parameters.damage_multiplier).toBe(1.5);
    expect(applyDamage?.parameters.entity_ref).toBe('secondary');

    const hasEndTurnMacro = actions.some(
      (op) => op.macro === 'core:endTurnOnly'
    );
    expect(hasEndTurnMacro).toBe(true);
  });

  it('applies damage on SUCCESS with sense-aware perception', () => {
    const branch = findIfByOutcome(handleSuckerPunchTargetRule.actions, 'SUCCESS');
    const actions = branch?.parameters.then_actions ?? [];

    const dispatch = actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );
    const forEachOp = actions.find((op) => op.type === 'FOR_EACH');
    const dispatchResultEvent = actions.find(
      (op) =>
        op.type === 'DISPATCH_EVENT' &&
        op.parameters.eventType === 'core:display_successful_action_result'
    );

    // Verify sense-aware perception fields
    expect(dispatch?.parameters.description_text).toBe(
      '{context.actorName} catches {context.targetName} off guard with their {context.weaponName}, landing a solid sucker punch.'
    );
    expect(dispatch?.parameters.actor_description).toBe(
      'I catch {context.targetName} off guard with my {context.weaponName}, landing a solid sucker punch.'
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} catches me off guard with their {context.weaponName}, landing a solid sucker punch.'
    );
    expect(dispatch?.parameters.perception_type).toBe('combat.attack');
    expect(dispatch?.parameters.actor_id).toBe('{event.payload.actorId}');
    expect(dispatch?.parameters.target_id).toBe('{event.payload.secondaryId}');
    expect(dispatch?.parameters.alternate_descriptions).toEqual({
      auditory: 'I hear the sound of flesh striking flesh nearby.',
      tactile: 'I feel the impact of a blow nearby.',
    });

    expect(logMessage?.parameters.value).toBe(
      '{context.actorName} catches {context.targetName} off guard with their {context.weaponName}, landing a solid sucker punch.'
    );
    expect(dispatchResultEvent).toBeDefined();

    // Verify damage loop (no multiplier for normal success)
    expect(forEachOp?.parameters.collection).toBe('context.weaponDamage.entries');
    const applyDamage = forEachOp?.parameters.actions?.find(
      (op) => op.type === 'APPLY_DAMAGE'
    );
    expect(applyDamage?.parameters.damage_multiplier).toBeUndefined();
    expect(applyDamage?.parameters.entity_ref).toBe('secondary');

    const hasEndTurnMacro = actions.some(
      (op) => op.macro === 'core:endTurnOnly'
    );
    expect(hasEndTurnMacro).toBe(true);
  });

  it('leaves damage state unchanged on FAILURE but logs with sense-aware perception', () => {
    const branch = findIfByOutcome(handleSuckerPunchTargetRule.actions, 'FAILURE');
    const actions = branch?.parameters.then_actions ?? [];

    // No damage operations (attack tracking ADD_COMPONENT is expected)
    expect(actions.some((op) => op.type === 'FOR_EACH')).toBe(false);
    expect(actions.some((op) => op.type === 'APPLY_DAMAGE')).toBe(false);

    const dispatch = actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    // Verify sense-aware perception fields (target notices at last moment)
    expect(dispatch?.parameters.description_text).toBe(
      '{context.actorName} tries to sucker punch {context.targetName} with their {context.weaponName}, but {context.targetName} notices at the last moment and dodges.'
    );
    expect(dispatch?.parameters.actor_description).toBe(
      'I try to sucker punch {context.targetName} with my {context.weaponName}, but they notice at the last moment and dodge.'
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} tries to sucker punch me with their {context.weaponName}, but I notice at the last moment and dodge.'
    );
    expect(dispatch?.parameters.perception_type).toBe('combat.attack');
    expect(dispatch?.parameters.alternate_descriptions).toEqual({
      auditory: 'I hear someone swing and miss nearby.',
    });
    expect(logMessage?.parameters.value).toBe(
      '{context.actorName} tries to sucker punch {context.targetName} with their {context.weaponName}, but {context.targetName} notices at the last moment and dodges.'
    );

    const hasFailureMacro = actions.some(
      (op) => op.macro === 'core:logFailureOutcomeAndEndTurn'
    );
    expect(hasFailureMacro).toBe(true);
  });

  it('adds fallen state on FUMBLE with sense-aware perception', () => {
    const branch = findIfByOutcome(handleSuckerPunchTargetRule.actions, 'FUMBLE');
    const actions = branch?.parameters.then_actions ?? [];

    const fallenAdd = actions.find(
      (op) =>
        op.type === 'ADD_COMPONENT' &&
        op.parameters.component_type === 'recovery-states:fallen'
    );
    expect(fallenAdd?.parameters.entity_ref).toBe('actor');

    const dispatch = actions.find(
      (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
    );
    const logMessage = actions.find(
      (op) =>
        op.type === 'SET_VARIABLE' &&
        op.parameters.variable_name === 'logMessage'
    );

    // Verify sense-aware perception fields (overextends while sneaking up)
    expect(dispatch?.parameters.description_text).toBe(
      '{context.actorName} overextends while sneaking up on {context.targetName}, completely missing and stumbling to the ground!'
    );
    expect(dispatch?.parameters.actor_description).toBe(
      'I overextend while sneaking up on {context.targetName}, completely missing and stumbling to the ground!'
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} overextends while sneaking up on me, completely missing and stumbling to the ground!'
    );
    expect(dispatch?.parameters.perception_type).toBe('combat.violence');
    expect(dispatch?.parameters.actor_id).toBe('{event.payload.actorId}');
    expect(dispatch?.parameters.target_id).toBe('{event.payload.secondaryId}');
    expect(dispatch?.parameters.alternate_descriptions).toEqual({
      auditory: 'I hear someone stumble and fall heavily nearby.',
      tactile: 'I feel the thud of someone hitting the ground nearby.',
    });
    expect(logMessage?.parameters.value).toBe(
      '{context.actorName} overextends while sneaking up on {context.targetName}, completely missing and stumbling to the ground!'
    );

    expect(
      actions.some((op) => op.macro === 'core:logFailureOutcomeAndEndTurn')
    ).toBe(true);
  });

  describe('attack tracking (attack-states:attacked_by)', () => {
    const findAttackTrackingOps = (actions) => {
      const conditionalAdd = actions.find(
        (op) =>
          op.type === 'IF' &&
          op.comment?.includes('attacked_by component if missing')
      );
      const modifyArray = actions.find(
        (op) =>
          op.type === 'MODIFY_ARRAY_FIELD' &&
          op.parameters?.component_type === 'attack-states:attacked_by'
      );
      return { conditionalAdd, modifyArray };
    };

    it('adds attack tracking to CRITICAL_SUCCESS branch', () => {
      const branch = findIfByOutcome(
        handleSuckerPunchTargetRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];
      const { conditionalAdd, modifyArray } = findAttackTrackingOps(actions);

      expect(conditionalAdd).toBeDefined();
      expect(conditionalAdd.parameters.condition['!']).toEqual({
        var: 'entity.secondary.components.attack-states:attacked_by',
      });
      const addOp = conditionalAdd.parameters.then_actions[0];
      expect(addOp.type).toBe('ADD_COMPONENT');
      expect(addOp.parameters.component_type).toBe('attack-states:attacked_by');
      expect(addOp.parameters.entity_ref).toBe('secondary');
      expect(addOp.parameters.value).toEqual({ attackers: [] });

      expect(modifyArray).toBeDefined();
      expect(modifyArray.parameters.entity_ref).toBe('secondary');
      expect(modifyArray.parameters.field).toBe('attackers');
      expect(modifyArray.parameters.mode).toBe('push_unique');
      expect(modifyArray.parameters.value).toBe('{event.payload.actorId}');
    });

    it('adds attack tracking to SUCCESS branch', () => {
      const branch = findIfByOutcome(handleSuckerPunchTargetRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];
      const { conditionalAdd, modifyArray } = findAttackTrackingOps(actions);

      expect(conditionalAdd).toBeDefined();
      expect(modifyArray).toBeDefined();
      expect(modifyArray.parameters.mode).toBe('push_unique');
    });

    it('adds attack tracking to FAILURE branch', () => {
      const branch = findIfByOutcome(handleSuckerPunchTargetRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];
      const { conditionalAdd, modifyArray } = findAttackTrackingOps(actions);

      expect(conditionalAdd).toBeDefined();
      expect(modifyArray).toBeDefined();
      expect(modifyArray.parameters.mode).toBe('push_unique');
    });

    it('adds attack tracking to FUMBLE branch', () => {
      const branch = findIfByOutcome(handleSuckerPunchTargetRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];
      const { conditionalAdd, modifyArray } = findAttackTrackingOps(actions);

      expect(conditionalAdd).toBeDefined();
      expect(modifyArray).toBeDefined();
      expect(modifyArray.parameters.mode).toBe('push_unique');
    });
  });
});
