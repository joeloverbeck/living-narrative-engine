/**
 * @file Integration tests for handle_punch_target rule wiring and outcomes.
 * @description Validates condition wiring, outcome resolution setup, sense-aware perception fields, and branch side effects/messages.
 */

import { describe, it, expect } from '@jest/globals';
import handlePunchTargetRule from '../../../../data/mods/striking/rules/handle_punch_target.rule.json' assert { type: 'json' };
import eventIsActionPunchTarget from '../../../../data/mods/striking/conditions/event-is-action-punch-target.condition.json' assert { type: 'json' };
import strikingManifest from '../../../../data/mods/striking/mod-manifest.json' assert { type: 'json' };

const findIfByOutcome = (actions, outcomeValue) =>
  actions.find(
    (op) =>
      op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcomeValue
  );

describe('handle_punch_target rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handlePunchTargetRule.rule_id).toBe('handle_punch_target');
    expect(handlePunchTargetRule.event_type).toBe('core:attempt_action');
    expect(handlePunchTargetRule.condition.condition_ref).toBe(
      'striking:event-is-action-punch-target'
    );

    expect(eventIsActionPunchTarget.id).toBe(
      'striking:event-is-action-punch-target'
    );
    expect(eventIsActionPunchTarget.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'striking:punch_target',
    ]);

    expect(strikingManifest.content.rules).toContain(
      'handle_punch_target.rule.json'
    );
    expect(strikingManifest.content.conditions).toContain(
      'event-is-action-punch-target.condition.json'
    );
  });

  it('sets up names, position lookup, damage capabilities, and outcome resolution for melee vs defense', () => {
    const getNameOps = handlePunchTargetRule.actions.filter(
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

    const queryComponentOps = handlePunchTargetRule.actions.filter(
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

    const resolveOutcome = handlePunchTargetRule.actions.find(
      (op) => op.type === 'RESOLVE_OUTCOME'
    );
    expect(resolveOutcome).toBeDefined();
    expect(resolveOutcome.parameters.actor_skill_component).toBe(
      'skills:melee_skill'
    );
    expect(resolveOutcome.parameters.target_skill_component).toBe(
      'skills:defense_skill'
    );
    expect(resolveOutcome.parameters.actor_skill_default).toBe(10);
    expect(resolveOutcome.parameters.target_skill_default).toBe(0);
    expect(resolveOutcome.parameters.formula).toBe('ratio');
    expect(resolveOutcome.parameters.result_variable).toBe('attackResult');
    expect(resolveOutcome.parameters.target_role).toBe('secondary');
  });

  it('sets shared variables for perception/logging', () => {
    const setVariableOps = handlePunchTargetRule.actions.filter(
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
    const ifOps = handlePunchTargetRule.actions.filter(
      (op) => op.type === 'IF'
    );

    expect(ifOps).toHaveLength(4);
    expect(
      findIfByOutcome(handlePunchTargetRule.actions, 'CRITICAL_SUCCESS')
    ).toBeDefined();
    expect(
      findIfByOutcome(handlePunchTargetRule.actions, 'SUCCESS')
    ).toBeDefined();
    expect(
      findIfByOutcome(handlePunchTargetRule.actions, 'FAILURE')
    ).toBeDefined();
    expect(
      findIfByOutcome(handlePunchTargetRule.actions, 'FUMBLE')
    ).toBeDefined();
  });

  it('applies damage with 1.5x multiplier on CRITICAL_SUCCESS with sense-aware perception', () => {
    const branch = findIfByOutcome(handlePunchTargetRule.actions, 'CRITICAL_SUCCESS');
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
      '{context.actorName} lands a devastating punch with their {context.weaponName} on {context.targetName}!'
    );
    expect(dispatch?.parameters.actor_description).toBe(
      'I land a devastating punch with my {context.weaponName} on {context.targetName}!'
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} lands a devastating punch on me with their {context.weaponName}!'
    );
    expect(dispatch?.parameters.perception_type).toBe('combat.attack');
    expect(dispatch?.parameters.actor_id).toBe('{event.payload.actorId}');
    expect(dispatch?.parameters.target_id).toBe('{event.payload.secondaryId}');
    expect(dispatch?.parameters.alternate_descriptions).toEqual({
      auditory: 'I hear the heavy thud of a powerful blow landing nearby.',
      tactile: 'I feel the vibration of a hard impact nearby.',
    });

    expect(logMessage?.parameters.value).toBe(
      '{context.actorName} lands a devastating punch with their {context.weaponName} on {context.targetName}!'
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
    const branch = findIfByOutcome(handlePunchTargetRule.actions, 'SUCCESS');
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
      '{context.actorName} punches {context.targetName} with their {context.weaponName}, landing a solid blow.'
    );
    expect(dispatch?.parameters.actor_description).toBe(
      'I punch {context.targetName} with my {context.weaponName}, landing a solid blow.'
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} punches me with their {context.weaponName}, landing a solid blow.'
    );
    expect(dispatch?.parameters.perception_type).toBe('combat.attack');
    expect(dispatch?.parameters.actor_id).toBe('{event.payload.actorId}');
    expect(dispatch?.parameters.target_id).toBe('{event.payload.secondaryId}');
    expect(dispatch?.parameters.alternate_descriptions).toEqual({
      auditory: 'I hear the sound of flesh striking flesh nearby.',
      tactile: 'I feel the impact of a blow nearby.',
    });

    expect(logMessage?.parameters.value).toBe(
      '{context.actorName} punches {context.targetName} with their {context.weaponName}, landing a solid blow.'
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
    const branch = findIfByOutcome(handlePunchTargetRule.actions, 'FAILURE');
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

    // Verify sense-aware perception fields
    expect(dispatch?.parameters.description_text).toBe(
      '{context.actorName} throws a punch at {context.targetName} with their {context.weaponName}, but the blow fails to connect.'
    );
    expect(dispatch?.parameters.actor_description).toBe(
      'I throw a punch at {context.targetName} with my {context.weaponName}, but fail to connect.'
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} throws a punch at me with their {context.weaponName}, but fails to connect.'
    );
    expect(dispatch?.parameters.perception_type).toBe('combat.attack');
    expect(dispatch?.parameters.alternate_descriptions).toEqual({
      auditory: 'I hear someone swing and miss nearby.',
    });
    expect(logMessage?.parameters.value).toBe(
      '{context.actorName} throws a punch at {context.targetName} with their {context.weaponName}, but the blow fails to connect.'
    );

    const hasFailureMacro = actions.some(
      (op) => op.macro === 'core:logFailureOutcomeAndEndTurn'
    );
    expect(hasFailureMacro).toBe(true);
  });

  it('adds fallen state on FUMBLE with sense-aware perception', () => {
    const branch = findIfByOutcome(handlePunchTargetRule.actions, 'FUMBLE');
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

    // Verify sense-aware perception fields
    expect(dispatch?.parameters.description_text).toBe(
      '{context.actorName} swings wildly at {context.targetName} but completely misses, losing balance and falling to the ground!'
    );
    expect(dispatch?.parameters.actor_description).toBe(
      'I swing wildly at {context.targetName} but completely miss, losing my balance and falling to the ground!'
    );
    expect(dispatch?.parameters.target_description).toBe(
      '{context.actorName} swings wildly at me but completely misses, losing their balance and falling to the ground!'
    );
    expect(dispatch?.parameters.perception_type).toBe('combat.violence');
    expect(dispatch?.parameters.actor_id).toBe('{event.payload.actorId}');
    expect(dispatch?.parameters.target_id).toBe('{event.payload.secondaryId}');
    expect(dispatch?.parameters.alternate_descriptions).toEqual({
      auditory: 'I hear someone stumble and fall heavily nearby.',
      tactile: 'I feel the thud of someone hitting the ground nearby.',
    });
    expect(logMessage?.parameters.value).toBe(
      '{context.actorName} swings wildly at {context.targetName} but completely misses, losing balance and falling to the ground!'
    );

    expect(
      actions.some((op) => op.macro === 'core:logFailureOutcomeAndEndTurn')
    ).toBe(true);
  });

  describe('attack tracking (attack-states:attacked_by)', () => {
    /**
     * Helper to find the attack tracking operations in a branch
     *
     * @param {Array} actions - The then_actions array from a branch
     * @returns {{ conditionalAdd: object|undefined, modifyArray: object|undefined }}
     */
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
        handlePunchTargetRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];
      const { conditionalAdd, modifyArray } = findAttackTrackingOps(actions);

      // Verify conditional ADD_COMPONENT for missing attacked_by
      expect(conditionalAdd).toBeDefined();
      expect(conditionalAdd.parameters.condition['!']).toEqual({
        var: 'entity.secondary.components.attack-states:attacked_by',
      });
      const addOp = conditionalAdd.parameters.then_actions[0];
      expect(addOp.type).toBe('ADD_COMPONENT');
      expect(addOp.parameters.component_type).toBe('attack-states:attacked_by');
      expect(addOp.parameters.entity_ref).toBe('secondary');
      expect(addOp.parameters.value).toEqual({ attackers: [] });

      // Verify MODIFY_ARRAY_FIELD to push actor to attackers
      expect(modifyArray).toBeDefined();
      expect(modifyArray.parameters.entity_ref).toBe('secondary');
      expect(modifyArray.parameters.field).toBe('attackers');
      expect(modifyArray.parameters.mode).toBe('push_unique');
      expect(modifyArray.parameters.value).toBe('{event.payload.actorId}');
    });

    it('adds attack tracking to SUCCESS branch', () => {
      const branch = findIfByOutcome(handlePunchTargetRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];
      const { conditionalAdd, modifyArray } = findAttackTrackingOps(actions);

      expect(conditionalAdd).toBeDefined();
      expect(modifyArray).toBeDefined();
      expect(modifyArray.parameters.mode).toBe('push_unique');
      expect(modifyArray.parameters.value).toBe('{event.payload.actorId}');
    });

    it('adds attack tracking to FAILURE branch', () => {
      const branch = findIfByOutcome(handlePunchTargetRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];
      const { conditionalAdd, modifyArray } = findAttackTrackingOps(actions);

      expect(conditionalAdd).toBeDefined();
      expect(modifyArray).toBeDefined();
      expect(modifyArray.parameters.mode).toBe('push_unique');
      expect(modifyArray.parameters.value).toBe('{event.payload.actorId}');
    });

    it('adds attack tracking to FUMBLE branch', () => {
      const branch = findIfByOutcome(handlePunchTargetRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];
      const { conditionalAdd, modifyArray } = findAttackTrackingOps(actions);

      expect(conditionalAdd).toBeDefined();
      expect(modifyArray).toBeDefined();
      expect(modifyArray.parameters.mode).toBe('push_unique');
      expect(modifyArray.parameters.value).toBe('{event.payload.actorId}');
    });
  });
});
