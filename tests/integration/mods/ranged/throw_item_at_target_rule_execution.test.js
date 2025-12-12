/**
 * @file Integration tests for throw_item_at_target rule with outcome resolution
 * @description Tests the handle_throw_item_at_target rule structure and event handling.
 * Note: Actual outcome determination is tested in unit tests for ResolveOutcomeHandler
 * and OutcomeDeterminerService. This test validates the rule's structure and integration
 * with the event system.
 *
 * The rule uses a macro-based architecture where outcome handling is delegated to
 * shared macros in data/mods/ranged/macros/:
 * - handleThrowCritical (CRITICAL_SUCCESS)
 * - handleThrowHit (SUCCESS)
 * - handleThrowFumble (FUMBLE)
 * - handleThrowMiss (FAILURE)
 */

import { describe, it, expect } from '@jest/globals';

// Import rule and condition JSON for structure validation
import throwItemAtTargetRule from '../../../../data/mods/ranged/rules/handle_throw_item_at_target.rule.json' assert { type: 'json' };
import eventIsActionThrowItemAtTarget from '../../../../data/mods/ranged/conditions/event-is-action-throw-item-at-target.condition.json' assert { type: 'json' };
import throwItemAtTargetAction from '../../../../data/mods/ranged/actions/throw_item_at_target.action.json' assert { type: 'json' };

// Import macros for structure validation
import handleThrowCritical from '../../../../data/mods/ranged/macros/handleThrowCritical.macro.json' assert { type: 'json' };
import handleThrowHit from '../../../../data/mods/ranged/macros/handleThrowHit.macro.json' assert { type: 'json' };
import handleThrowFumble from '../../../../data/mods/ranged/macros/handleThrowFumble.macro.json' assert { type: 'json' };
import handleThrowMiss from '../../../../data/mods/ranged/macros/handleThrowMiss.macro.json' assert { type: 'json' };

describe('throw_item_at_target outcome resolution rule', () => {
  describe('Rule Structure Validation', () => {
    it('should have correct rule_id', () => {
      expect(throwItemAtTargetRule.rule_id).toBe('handle_throw_item_at_target');
    });

    it('should trigger on core:attempt_action event', () => {
      expect(throwItemAtTargetRule.event_type).toBe('core:attempt_action');
    });

    it('should reference the correct condition', () => {
      expect(throwItemAtTargetRule.condition.condition_ref).toBe(
        'ranged:event-is-action-throw-item-at-target'
      );
    });

    it('should have actions array', () => {
      expect(Array.isArray(throwItemAtTargetRule.actions)).toBe(true);
      expect(throwItemAtTargetRule.actions.length).toBeGreaterThan(0);
    });
  });

  describe('Operations Validation', () => {
    it('should include GET_NAME operations for actor, target, and throwable', () => {
      const getNameOps = throwItemAtTargetRule.actions.filter(
        (op) => op.type === 'GET_NAME'
      );

      expect(getNameOps.length).toBe(3);

      // Check for actor name
      const actorNameOp = getNameOps.find(
        (op) => op.parameters.entity_ref === 'actor'
      );
      expect(actorNameOp).toBeDefined();
      expect(actorNameOp.parameters.result_variable).toBe('actorName');

      // Check for target name (secondary target)
      const targetNameOp = getNameOps.find(
        (op) => op.parameters.entity_ref === 'secondary'
      );
      expect(targetNameOp).toBeDefined();
      expect(targetNameOp.parameters.result_variable).toBe('targetName');

      // Check for throwable name (primary target - the item being thrown)
      const throwableNameOp = getNameOps.find(
        (op) => op.parameters.entity_ref === 'primary'
      );
      expect(throwableNameOp).toBeDefined();
      expect(throwableNameOp.parameters.result_variable).toBe('throwableName');
    });

    it('should include QUERY_COMPONENT for actor position', () => {
      const queryOp = throwItemAtTargetRule.actions.find(
        (op) => op.type === 'QUERY_COMPONENT'
      );

      expect(queryOp).toBeDefined();
      expect(queryOp.parameters.entity_ref).toBe('actor');
      expect(queryOp.parameters.component_type).toBe('core:position');
      expect(queryOp.parameters.result_variable).toBe('actorPosition');
    });

    it('should include GET_DAMAGE_CAPABILITIES operation for throwable', () => {
      const getDamageOp = throwItemAtTargetRule.actions.find(
        (op) => op.type === 'GET_DAMAGE_CAPABILITIES'
      );

      expect(getDamageOp).toBeDefined();
      expect(getDamageOp.parameters.entity_ref).toBe('primary');
      expect(getDamageOp.parameters.output_variable).toBe('throwableDamage');
      // This operation handles both weapons with damage_capabilities and
      // plain portable items where damage is calculated from weight
    });

    it('should include RESOLVE_OUTCOME operation with correct parameters', () => {
      const resolveOutcomeOp = throwItemAtTargetRule.actions.find(
        (op) => op.type === 'RESOLVE_OUTCOME'
      );

      expect(resolveOutcomeOp).toBeDefined();
      // Ranged uses ranged_skill, not melee_skill
      expect(resolveOutcomeOp.parameters.actor_skill_component).toBe(
        'skills:ranged_skill'
      );
      expect(resolveOutcomeOp.parameters.target_skill_component).toBe(
        'skills:defense_skill'
      );
      expect(resolveOutcomeOp.parameters.actor_skill_default).toBe(10);
      expect(resolveOutcomeOp.parameters.target_skill_default).toBe(0);
      expect(resolveOutcomeOp.parameters.formula).toBe('ratio');
      expect(resolveOutcomeOp.parameters.result_variable).toBe('attackResult');
      expect(resolveOutcomeOp.parameters.target_role).toBe('secondary');
    });

    it('should have IF operations for outcome branching', () => {
      const ifOps = throwItemAtTargetRule.actions.filter(
        (op) => op.type === 'IF'
      );

      expect(ifOps.length).toBeGreaterThan(0);
    });
  });

  describe('Outcome Branch Validation', () => {
    // Helper to find IF operation by outcome value (flat structure)
    const findIfByOutcome = (ops, outcomeValue) =>
      ops.find(
        (op) =>
          op.type === 'IF' &&
          op.parameters?.condition?.['==']?.[1] === outcomeValue
      );

    it('should have 4 independent IF operations for each outcome (flat structure)', () => {
      const ifOps = throwItemAtTargetRule.actions.filter(
        (op) => op.type === 'IF'
      );
      expect(ifOps.length).toBe(4);

      // Verify each outcome has its own top-level IF
      expect(
        findIfByOutcome(throwItemAtTargetRule.actions, 'CRITICAL_SUCCESS')
      ).toBeDefined();
      expect(
        findIfByOutcome(throwItemAtTargetRule.actions, 'SUCCESS')
      ).toBeDefined();
      expect(
        findIfByOutcome(throwItemAtTargetRule.actions, 'FUMBLE')
      ).toBeDefined();
      expect(
        findIfByOutcome(throwItemAtTargetRule.actions, 'FAILURE')
      ).toBeDefined();
    });

    it('should delegate CRITICAL_SUCCESS to handleThrowCritical macro', () => {
      const criticalSuccessIf = findIfByOutcome(
        throwItemAtTargetRule.actions,
        'CRITICAL_SUCCESS'
      );
      expect(criticalSuccessIf).toBeDefined();

      const condition = criticalSuccessIf.parameters.condition;
      expect(condition['==']).toBeDefined();
      expect(condition['=='][0]).toEqual({
        var: 'context.attackResult.outcome',
      });
      expect(condition['=='][1]).toBe('CRITICAL_SUCCESS');

      // Verify macro reference in rule
      const thenActions = criticalSuccessIf.parameters.then_actions;
      const hasMacro = thenActions.some(
        (op) => op.macro === 'ranged:handleThrowCritical'
      );
      expect(hasMacro).toBe(true);

      // Verify macro content contains devastating attack message with template variables
      const macroString = JSON.stringify(handleThrowCritical);
      expect(macroString).toContain('devastating');
      expect(macroString).toContain('context.actorName');
      expect(macroString).toContain('context.throwableName');
      expect(macroString).toContain('context.targetName');
    });

    it('should delegate SUCCESS to handleThrowHit macro', () => {
      const successIf = findIfByOutcome(
        throwItemAtTargetRule.actions,
        'SUCCESS'
      );
      expect(successIf).toBeDefined();

      // Verify macro reference in rule
      const thenActions = successIf.parameters.then_actions;
      const hasMacro = thenActions.some(
        (op) => op.macro === 'ranged:handleThrowHit'
      );
      expect(hasMacro).toBe(true);

      // Verify macro contains success handling - hits target
      const macroString = JSON.stringify(handleThrowHit);
      expect(macroString).toContain('hits');
      expect(macroString).toContain('context.targetName');
      expect(macroString).toContain('core:endTurnOnly');
    });

    it('should delegate FUMBLE to handleThrowFumble macro', () => {
      const fumbleIf = findIfByOutcome(throwItemAtTargetRule.actions, 'FUMBLE');
      expect(fumbleIf).toBeDefined();

      // Verify macro reference in rule
      const thenActions = fumbleIf.parameters.then_actions;
      const hasMacro = thenActions.some(
        (op) => op.macro === 'ranged:handleThrowFumble'
      );
      expect(hasMacro).toBe(true);

      // Verify macro contains fumble handling - may hit random entity or miss
      const macroString = JSON.stringify(handleThrowFumble);
      expect(macroString).toContain('wildly');
      expect(macroString).toContain('PICK_RANDOM_ENTITY');
      expect(macroString).toContain('fumbleVictim');
      expect(macroString).toContain('core:logFailureOutcomeAndEndTurn');
    });

    it('should delegate FAILURE to handleThrowMiss macro', () => {
      const failureIf = findIfByOutcome(
        throwItemAtTargetRule.actions,
        'FAILURE'
      );
      expect(failureIf).toBeDefined();

      // Verify macro reference in rule
      const thenActions = failureIf.parameters.then_actions;
      const hasMacro = thenActions.some(
        (op) => op.macro === 'ranged:handleThrowMiss'
      );
      expect(hasMacro).toBe(true);

      // Verify macro contains failure handling - flies past target
      const macroString = JSON.stringify(handleThrowMiss);
      expect(macroString).toContain('flies past');
      expect(macroString).toContain('core:logFailureOutcomeAndEndTurn');
    });
  });

  describe('Action Configuration Validation', () => {
    it('should have chanceBased config in the action definition', () => {
      expect(throwItemAtTargetAction.chanceBased).toBeDefined();
      expect(throwItemAtTargetAction.chanceBased.enabled).toBe(true);
    });

    it('should have ranged_skill as actor skill in action', () => {
      expect(throwItemAtTargetAction.chanceBased.actorSkill).toBeDefined();
      expect(throwItemAtTargetAction.chanceBased.actorSkill.component).toBe(
        'skills:ranged_skill'
      );
      expect(throwItemAtTargetAction.chanceBased.actorSkill.default).toBe(10);
    });

    it('should have defense_skill as target skill in action', () => {
      expect(throwItemAtTargetAction.chanceBased.targetSkill).toBeDefined();
      expect(throwItemAtTargetAction.chanceBased.targetSkill.component).toBe(
        'skills:defense_skill'
      );
      expect(throwItemAtTargetAction.chanceBased.targetSkill.default).toBe(0);
    });

    it('should specify secondary as target role for defense skill', () => {
      expect(throwItemAtTargetAction.chanceBased.targetSkill.targetRole).toBe(
        'secondary'
      );
    });
  });

  describe('Condition Validation', () => {
    it('should reference correct action ID', () => {
      // The condition uses 'logic' property with a direct equality check
      expect(eventIsActionThrowItemAtTarget.logic).toBeDefined();
      expect(eventIsActionThrowItemAtTarget.logic['==']).toBeDefined();

      // Verify it checks event.payload.actionId
      const eqClause = eventIsActionThrowItemAtTarget.logic['=='];
      expect(eqClause[0]?.var).toBe('event.payload.actionId');
      expect(eqClause[1]).toBe('ranged:throw_item_at_target');
    });
  });

  describe('Schema Compliance', () => {
    it('should have valid $schema reference in rule', () => {
      expect(throwItemAtTargetRule.$schema).toBe(
        'schema://living-narrative-engine/rule.schema.json'
      );
    });

    it('should have valid $schema reference in condition', () => {
      expect(eventIsActionThrowItemAtTarget.$schema).toBe(
        'schema://living-narrative-engine/condition.schema.json'
      );
    });

    it('should have valid $schema reference in action', () => {
      expect(throwItemAtTargetAction.$schema).toBe(
        'schema://living-narrative-engine/action.schema.json'
      );
    });

    it('should have required rule fields', () => {
      expect(throwItemAtTargetRule.rule_id).toBeDefined();
      expect(throwItemAtTargetRule.event_type).toBeDefined();
      expect(throwItemAtTargetRule.condition).toBeDefined();
      expect(throwItemAtTargetRule.actions).toBeDefined();
    });

    it('should have required condition fields', () => {
      expect(eventIsActionThrowItemAtTarget.id).toBeDefined();
      expect(eventIsActionThrowItemAtTarget.logic).toBeDefined();
    });
  });

  describe('Variable Resolution Consistency', () => {
    it('should define all required result variables', () => {
      const ruleString = JSON.stringify(throwItemAtTargetRule);

      // Check that all result variables are defined in rule
      // Note: GET_DAMAGE_CAPABILITIES uses output_variable, others use result_variable
      const resultVariables = [
        'actorName',
        'targetName',
        'throwableName',
        'actorPosition',
        'attackResult',
      ];

      for (const varName of resultVariables) {
        expect(ruleString).toContain(`"result_variable":"${varName}"`);
      }

      // GET_DAMAGE_CAPABILITIES uses output_variable instead
      expect(ruleString).toContain('"output_variable":"throwableDamage"');
    });

    it('should set throw-specific context variables for macros', () => {
      const ruleString = JSON.stringify(throwItemAtTargetRule);

      // Throw rule should set these context variables for use by macros
      expect(ruleString).toContain('"variable_name":"locationId"');
      expect(ruleString).toContain('"variable_name":"perceptionType"');
      expect(ruleString).toContain('"value":"physical.target_action"');
      expect(ruleString).toContain('"variable_name":"targetId"');
    });

    it('should use context variables in rule for outcome checking', () => {
      const ruleString = JSON.stringify(throwItemAtTargetRule);

      // Rule accesses these for outcome branching
      expect(ruleString).toContain('context.attackResult.outcome');
      expect(ruleString).toContain('context.actorPosition.locationId');
    });

    it('should reference correct event payload variables', () => {
      const ruleString = JSON.stringify(throwItemAtTargetRule);

      // Rule references secondaryId for targetId variable
      expect(ruleString).toContain('event.payload.secondaryId');
    });
  });

  describe('Macro Usage Validation', () => {
    it('should use ranged macros for all outcome branches', () => {
      const ruleString = JSON.stringify(throwItemAtTargetRule);

      // Rule delegates to 4 ranged macros (one per outcome)
      expect(ruleString).toContain('ranged:handleThrowCritical');
      expect(ruleString).toContain('ranged:handleThrowHit');
      expect(ruleString).toContain('ranged:handleThrowFumble');
      expect(ruleString).toContain('ranged:handleThrowMiss');
    });

    it('should have success macros that use endTurnOnly internally', () => {
      // Hit and Critical macros call core:endTurnOnly
      const hitMacroString = JSON.stringify(handleThrowHit);
      const criticalMacroString = JSON.stringify(handleThrowCritical);

      expect(hitMacroString).toContain('core:endTurnOnly');
      expect(criticalMacroString).toContain('core:endTurnOnly');
    });

    it('should have failure macros that use logFailureOutcomeAndEndTurn internally', () => {
      // Fumble and Miss macros call core:logFailureOutcomeAndEndTurn
      const fumbleMacroString = JSON.stringify(handleThrowFumble);
      const missMacroString = JSON.stringify(handleThrowMiss);

      expect(fumbleMacroString).toContain('core:logFailureOutcomeAndEndTurn');
      expect(missMacroString).toContain('core:logFailureOutcomeAndEndTurn');
    });

    it('should have all macros with valid schema references', () => {
      expect(handleThrowCritical.$schema).toBe(
        'schema://living-narrative-engine/macro.schema.json'
      );
      expect(handleThrowHit.$schema).toBe(
        'schema://living-narrative-engine/macro.schema.json'
      );
      expect(handleThrowFumble.$schema).toBe(
        'schema://living-narrative-engine/macro.schema.json'
      );
      expect(handleThrowMiss.$schema).toBe(
        'schema://living-narrative-engine/macro.schema.json'
      );
    });

    it('should have all macros with proper ID format', () => {
      expect(handleThrowCritical.id).toBe('ranged:handleThrowCritical');
      expect(handleThrowHit.id).toBe('ranged:handleThrowHit');
      expect(handleThrowFumble.id).toBe('ranged:handleThrowFumble');
      expect(handleThrowMiss.id).toBe('ranged:handleThrowMiss');
    });
  });

  describe('Throw-Specific Macro Content Validation', () => {
    it('should have critical macro with devastating throw description', () => {
      const macroString = JSON.stringify(handleThrowCritical);

      // Critical throw should use 1.5x damage multiplier in APPLY_DAMAGE
      expect(macroString).toContain('"damage_multiplier":1.5');
      expect(macroString).toContain('devastating');
      expect(macroString).toContain('context.throwableName');
    });

    it('should regenerate description for the critical target immediately after applying damage', () => {
      const forEachAction = handleThrowCritical.actions.find(
        (action) => action.type === 'FOR_EACH'
      );

      const actions = forEachAction.parameters.actions;
      const applyDamageIndex = actions.findIndex(
        (action) => action.type === 'APPLY_DAMAGE'
      );
      const regenIndex = actions.findIndex(
        (action) => action.type === 'REGENERATE_DESCRIPTION'
      );

      expect(applyDamageIndex).toBeGreaterThanOrEqual(0);
      expect(regenIndex).toBe(applyDamageIndex + 1);
      expect(actions[regenIndex].parameters.entity_ref).toBe('secondary');
    });

    it('should have hit macro with standard throw description', () => {
      const macroString = JSON.stringify(handleThrowHit);

      // Standard throw uses default multiplier (1.0), so no explicit multiplier param
      // Just verify it has APPLY_DAMAGE without a multiplier
      expect(macroString).toContain('APPLY_DAMAGE');
      expect(macroString).not.toContain('damage_multiplier');
      expect(macroString).toContain('throws');
      expect(macroString).toContain('hits');
    });

    it('should regenerate description for the hit target immediately after applying damage', () => {
      const forEachAction = handleThrowHit.actions.find(
        (action) => action.type === 'FOR_EACH'
      );

      const actions = forEachAction.parameters.actions;
      const applyDamageIndex = actions.findIndex(
        (action) => action.type === 'APPLY_DAMAGE'
      );
      const regenIndex = actions.findIndex(
        (action) => action.type === 'REGENERATE_DESCRIPTION'
      );

      expect(applyDamageIndex).toBeGreaterThanOrEqual(0);
      expect(regenIndex).toBe(applyDamageIndex + 1);
      expect(actions[regenIndex].parameters.entity_ref).toBe('secondary');
    });

    it('should have fumble macro with PICK_RANDOM_ENTITY for collateral damage', () => {
      const macroString = JSON.stringify(handleThrowFumble);

      // Fumble should pick a random entity to potentially hit
      expect(macroString).toContain('PICK_RANDOM_ENTITY');
      expect(macroString).toContain('fumbleVictim');
      expect(macroString).toContain('exclude_entities');
      expect(macroString).toContain('require_components');
      expect(macroString).toContain('core:actor'); // Targets other actors for collateral damage
    });

    it('should exclude the thrown item from fumble victim selection', () => {
      // Find the PICK_RANDOM_ENTITY action in the fumble macro
      const pickRandomEntityAction = handleThrowFumble.actions.find(
        (action) => action.type === 'PICK_RANDOM_ENTITY'
      );

      expect(pickRandomEntityAction).toBeDefined();
      expect(pickRandomEntityAction.parameters.exclude_entities).toContain(
        '{event.payload.primaryId}'
      );
      // Also verify actor and target are still excluded
      expect(pickRandomEntityAction.parameters.exclude_entities).toContain(
        '{event.payload.actorId}'
      );
      expect(pickRandomEntityAction.parameters.exclude_entities).toContain(
        '{event.payload.secondaryId}'
      );
    });

    it('should have fumble macro apply damage to fumble victim when one is found', () => {
      const macroString = JSON.stringify(handleThrowFumble);

      // Fumble should apply damage to the entity that was accidentally hit
      expect(macroString).toContain('APPLY_DAMAGE');
      expect(macroString).toContain('context.fumbleVictim');
      expect(macroString).toContain('context.throwableDamage');

      // Find the IF action that handles fumble victim
      const ifAction = handleThrowFumble.actions.find(
        (action) =>
          action.type === 'IF' &&
          action.parameters?.condition?.['!!']?.var === 'context.fumbleVictim'
      );

      expect(ifAction).toBeDefined();

      // Verify FOR_EACH with APPLY_DAMAGE is in then_actions
      const forEachAction = ifAction.parameters.then_actions.find(
        (action) => action.type === 'FOR_EACH'
      );

      expect(forEachAction).toBeDefined();
      expect(forEachAction.parameters.collection).toBe(
        'context.throwableDamage'
      );

      const applyDamageAction = forEachAction.parameters.actions.find(
        (action) => action.type === 'APPLY_DAMAGE'
      );

      expect(applyDamageAction).toBeDefined();
      expect(applyDamageAction.parameters.entity_ref).toEqual({
        var: 'context.fumbleVictim',
      });

      const regenAction = forEachAction.parameters.actions.find(
        (action) => action.type === 'REGENERATE_DESCRIPTION'
      );

      expect(regenAction).toBeDefined();
      expect(regenAction.parameters.entity_ref).toEqual({
        var: 'context.fumbleVictim',
      });

      const applyIndex = forEachAction.parameters.actions.findIndex(
        (action) => action.type === 'APPLY_DAMAGE'
      );
      const regenIndex = forEachAction.parameters.actions.findIndex(
        (action) => action.type === 'REGENERATE_DESCRIPTION'
      );

      expect(regenIndex).toBe(applyIndex + 1);
    });

    it('should have fumble macro with fallback for no collateral target', () => {
      const macroString = JSON.stringify(handleThrowFumble);

      // Fumble should handle case when no random entity found
      expect(macroString).toContain('misses by a long shot');
      expect(macroString).toContain('else_actions');
    });

    it('should have miss macro with simple failure description', () => {
      const macroString = JSON.stringify(handleThrowMiss);

      // Miss should describe throw flying past target
      expect(macroString).toContain('flies past the target');
    });

    it('should have all macros handle item dropping via UNWIELD_ITEM and DROP_ITEM_AT_LOCATION', () => {
      // All outcomes should unwield and drop the thrown item
      const macros = [
        handleThrowCritical,
        handleThrowHit,
        handleThrowFumble,
        handleThrowMiss,
      ];

      for (const macro of macros) {
        const macroString = JSON.stringify(macro);
        expect(macroString).toContain('UNWIELD_ITEM');
        expect(macroString).toContain('DROP_ITEM_AT_LOCATION');
      }
    });
  });

  describe('Ranged vs Melee Skill Differentiation', () => {
    it('should use ranged_skill in rule RESOLVE_OUTCOME, not melee_skill', () => {
      const resolveOutcomeOp = throwItemAtTargetRule.actions.find(
        (op) => op.type === 'RESOLVE_OUTCOME'
      );

      expect(resolveOutcomeOp.parameters.actor_skill_component).toBe(
        'skills:ranged_skill'
      );
      // Ensure it's NOT melee_skill
      expect(resolveOutcomeOp.parameters.actor_skill_component).not.toBe(
        'skills:melee_skill'
      );
    });

    it('should use ranged_skill in action chanceBased config', () => {
      expect(throwItemAtTargetAction.chanceBased.actorSkill.component).toBe(
        'skills:ranged_skill'
      );
      expect(throwItemAtTargetAction.chanceBased.actorSkill.component).not.toBe(
        'skills:melee_skill'
      );
    });
  });
});
