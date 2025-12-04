/**
 * @file Integration tests for swing_at_target rule with outcome resolution
 * @description Tests the handle_swing_at_target rule structure and event handling.
 * Note: Actual outcome determination is tested in unit tests for ResolveOutcomeHandler
 * and OutcomeDeterminerService (NONDETACTSYS-008). This test validates the rule's
 * structure and integration with the event system.
 *
 * The rule uses a macro-based architecture where outcome handling is delegated to
 * shared macros in data/mods/weapons/macros/:
 * - handleMeleeCritical (CRITICAL_SUCCESS)
 * - handleMeleeHit (SUCCESS)
 * - handleMeleeFumble (FUMBLE)
 * - handleMeleeMiss (FAILURE)
 */

import { describe, it, expect } from '@jest/globals';

// Import rule and condition JSON for structure validation
import swingAtTargetRule from '../../../../data/mods/weapons/rules/handle_swing_at_target.rule.json' assert { type: 'json' };
import eventIsActionSwingAtTarget from '../../../../data/mods/weapons/conditions/event-is-action-swing-at-target.condition.json' assert { type: 'json' };
import swingAtTargetAction from '../../../../data/mods/weapons/actions/swing_at_target.action.json' assert { type: 'json' };

// Import macros for structure validation
import handleMeleeCritical from '../../../../data/mods/weapons/macros/handleMeleeCritical.macro.json' assert { type: 'json' };
import handleMeleeHit from '../../../../data/mods/weapons/macros/handleMeleeHit.macro.json' assert { type: 'json' };
import handleMeleeFumble from '../../../../data/mods/weapons/macros/handleMeleeFumble.macro.json' assert { type: 'json' };
import handleMeleeMiss from '../../../../data/mods/weapons/macros/handleMeleeMiss.macro.json' assert { type: 'json' };

describe('swing_at_target outcome resolution rule', () => {
  describe('Rule Structure Validation', () => {
    it('should have correct rule_id', () => {
      expect(swingAtTargetRule.rule_id).toBe('handle_swing_at_target');
    });

    it('should trigger on core:attempt_action event', () => {
      expect(swingAtTargetRule.event_type).toBe('core:attempt_action');
    });

    it('should reference the correct condition', () => {
      expect(swingAtTargetRule.condition.condition_ref).toBe(
        'weapons:event-is-action-swing-at-target'
      );
    });

    it('should have actions array', () => {
      expect(Array.isArray(swingAtTargetRule.actions)).toBe(true);
      expect(swingAtTargetRule.actions.length).toBeGreaterThan(0);
    });
  });

  describe('Operations Validation', () => {
    it('should include GET_NAME operations for actor, target, and weapon', () => {
      const getNameOps = swingAtTargetRule.actions.filter(
        (op) => op.type === 'GET_NAME'
      );

      expect(getNameOps.length).toBe(3);

      // Check for actor name
      const actorNameOp = getNameOps.find(
        (op) => op.parameters.entity_ref === 'actor'
      );
      expect(actorNameOp).toBeDefined();
      expect(actorNameOp.parameters.result_variable).toBe('actorName');

      // Check for target name
      const targetNameOp = getNameOps.find(
        (op) => op.parameters.entity_ref === 'secondary'
      );
      expect(targetNameOp).toBeDefined();
      expect(targetNameOp.parameters.result_variable).toBe('targetName');

      // Check for weapon name
      const weaponNameOp = getNameOps.find(
        (op) => op.parameters.entity_ref === 'primary'
      );
      expect(weaponNameOp).toBeDefined();
      expect(weaponNameOp.parameters.result_variable).toBe('weaponName');
    });

    it('should include QUERY_COMPONENT for actor position', () => {
      const queryOp = swingAtTargetRule.actions.find(
        (op) => op.type === 'QUERY_COMPONENT'
      );

      expect(queryOp).toBeDefined();
      expect(queryOp.parameters.entity_ref).toBe('actor');
      expect(queryOp.parameters.component_type).toBe('core:position');
      expect(queryOp.parameters.result_variable).toBe('actorPosition');
    });

    it('should include RESOLVE_OUTCOME operation with correct parameters', () => {
      const resolveOutcomeOp = swingAtTargetRule.actions.find(
        (op) => op.type === 'RESOLVE_OUTCOME'
      );

      expect(resolveOutcomeOp).toBeDefined();
      expect(resolveOutcomeOp.parameters.actor_skill_component).toBe(
        'skills:melee_skill'
      );
      expect(resolveOutcomeOp.parameters.target_skill_component).toBe(
        'skills:defense_skill'
      );
      expect(resolveOutcomeOp.parameters.actor_skill_default).toBe(10);
      expect(resolveOutcomeOp.parameters.target_skill_default).toBe(0);
      expect(resolveOutcomeOp.parameters.formula).toBe('ratio');
      expect(resolveOutcomeOp.parameters.result_variable).toBe('attackResult');
    });

    it('should have IF operations for outcome branching', () => {
      const ifOps = swingAtTargetRule.actions.filter((op) => op.type === 'IF');

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
      const ifOps = swingAtTargetRule.actions.filter((op) => op.type === 'IF');
      expect(ifOps.length).toBe(4);

      // Verify each outcome has its own top-level IF
      expect(findIfByOutcome(swingAtTargetRule.actions, 'CRITICAL_SUCCESS')).toBeDefined();
      expect(findIfByOutcome(swingAtTargetRule.actions, 'SUCCESS')).toBeDefined();
      expect(findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE')).toBeDefined();
      expect(findIfByOutcome(swingAtTargetRule.actions, 'FAILURE')).toBeDefined();
    });

    it('should delegate CRITICAL_SUCCESS to handleMeleeCritical macro', () => {
      const criticalSuccessIf = findIfByOutcome(swingAtTargetRule.actions, 'CRITICAL_SUCCESS');
      expect(criticalSuccessIf).toBeDefined();

      const condition = criticalSuccessIf.parameters.condition;
      expect(condition['==']).toBeDefined();
      expect(condition['=='][0]).toEqual({ var: 'context.attackResult.outcome' });
      expect(condition['=='][1]).toBe('CRITICAL_SUCCESS');

      // Verify macro reference in rule
      const thenActions = criticalSuccessIf.parameters.then_actions;
      const hasMacro = thenActions.some(
        (op) => op.macro === 'weapons:handleMeleeCritical'
      );
      expect(hasMacro).toBe(true);

      // Verify macro content contains devastating attack message with template variables
      const macroString = JSON.stringify(handleMeleeCritical);
      expect(macroString).toContain('devastating');
      expect(macroString).toContain('context.attackVerb');
      expect(macroString).toContain('context.actorName');
      expect(macroString).toContain('context.weaponName');
      expect(macroString).toContain('context.targetName');
    });

    it('should delegate SUCCESS to handleMeleeHit macro', () => {
      const successIf = findIfByOutcome(swingAtTargetRule.actions, 'SUCCESS');
      expect(successIf).toBeDefined();

      // Verify macro reference in rule
      const thenActions = successIf.parameters.then_actions;
      const hasMacro = thenActions.some(
        (op) => op.macro === 'weapons:handleMeleeHit'
      );
      expect(hasMacro).toBe(true);

      // Verify macro uses context.successMessage (pre-composed message template from rule)
      const macroString = JSON.stringify(handleMeleeHit);
      expect(macroString).toContain('context.successMessage');
      expect(macroString).toContain('core:endTurnOnly');
    });

    it('should delegate FUMBLE to handleMeleeFumble macro', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      expect(fumbleIf).toBeDefined();

      // Verify macro reference in rule
      const thenActions = fumbleIf.parameters.then_actions;
      const hasMacro = thenActions.some(
        (op) => op.macro === 'weapons:handleMeleeFumble'
      );
      expect(hasMacro).toBe(true);

      // Verify macro contains loses grip message and failure handling
      const macroString = JSON.stringify(handleMeleeFumble);
      expect(macroString).toContain('loses grip');
      expect(macroString).toContain('core:logFailureOutcomeAndEndTurn');
    });

    it('should delegate FAILURE to handleMeleeMiss macro', () => {
      const failureIf = findIfByOutcome(swingAtTargetRule.actions, 'FAILURE');
      expect(failureIf).toBeDefined();

      // Verify macro reference in rule
      const thenActions = failureIf.parameters.then_actions;
      const hasMacro = thenActions.some(
        (op) => op.macro === 'weapons:handleMeleeMiss'
      );
      expect(hasMacro).toBe(true);

      // Verify macro contains failure handling
      const macroString = JSON.stringify(handleMeleeMiss);
      expect(macroString).toContain('fails to connect');
      expect(macroString).toContain('core:logFailureOutcomeAndEndTurn');
    });
  });

  describe('Action Configuration Validation', () => {
    it('should have chanceBased config in the action definition', () => {
      expect(swingAtTargetAction.chanceBased).toBeDefined();
      expect(swingAtTargetAction.chanceBased.enabled).toBe(true);
    });

    it('should have melee_skill as actor skill in action', () => {
      expect(swingAtTargetAction.chanceBased.actorSkill).toBeDefined();
      expect(swingAtTargetAction.chanceBased.actorSkill.component).toBe(
        'skills:melee_skill'
      );
      expect(swingAtTargetAction.chanceBased.actorSkill.default).toBe(10);
    });

    it('should have defense_skill as target skill in action', () => {
      expect(swingAtTargetAction.chanceBased.targetSkill).toBeDefined();
      expect(swingAtTargetAction.chanceBased.targetSkill.component).toBe(
        'skills:defense_skill'
      );
      expect(swingAtTargetAction.chanceBased.targetSkill.default).toBe(0);
    });
  });

  describe('Condition Validation', () => {
    it('should reference correct action ID', () => {
      // The condition uses 'logic' property with a direct equality check
      expect(eventIsActionSwingAtTarget.logic).toBeDefined();
      expect(eventIsActionSwingAtTarget.logic['==']).toBeDefined();

      // Verify it checks event.payload.actionId
      const eqClause = eventIsActionSwingAtTarget.logic['=='];
      expect(eqClause[0]?.var).toBe('event.payload.actionId');
      expect(eqClause[1]).toBe('weapons:swing_at_target');
    });
  });

  describe('Schema Compliance', () => {
    // Schema validation was already performed by the npm run validate command
    // which passed with 0 violations. These tests verify structural compliance.

    it('should have valid $schema reference in rule', () => {
      expect(swingAtTargetRule.$schema).toBe(
        'schema://living-narrative-engine/rule.schema.json'
      );
    });

    it('should have valid $schema reference in condition', () => {
      expect(eventIsActionSwingAtTarget.$schema).toBe(
        'schema://living-narrative-engine/condition.schema.json'
      );
    });

    it('should have valid $schema reference in action', () => {
      expect(swingAtTargetAction.$schema).toBe(
        'schema://living-narrative-engine/action.schema.json'
      );
    });

    it('should have required rule fields', () => {
      expect(swingAtTargetRule.rule_id).toBeDefined();
      expect(swingAtTargetRule.event_type).toBeDefined();
      expect(swingAtTargetRule.condition).toBeDefined();
      expect(swingAtTargetRule.actions).toBeDefined();
    });

    it('should have required condition fields', () => {
      expect(eventIsActionSwingAtTarget.id).toBeDefined();
      expect(eventIsActionSwingAtTarget.logic).toBeDefined();
    });
  });

  describe('Variable Resolution Consistency', () => {
    it('should define all required result variables', () => {
      const ruleString = JSON.stringify(swingAtTargetRule);

      // Check that all result variables are defined in rule
      const resultVariables = [
        'actorName',
        'targetName',
        'weaponName',
        'actorPosition',
        'attackResult',
      ];

      for (const varName of resultVariables) {
        expect(ruleString).toContain(`"result_variable":"${varName}"`);
      }
    });

    it('should set swing-specific context variables for macros', () => {
      const ruleString = JSON.stringify(swingAtTargetRule);

      // Swing rule should set these context variables for use by macros
      expect(ruleString).toContain('"variable_name":"attackVerb"');
      expect(ruleString).toContain('"value":"blow"');
      expect(ruleString).toContain('"variable_name":"attackVerbPast"');
      expect(ruleString).toContain('"value":"swings"');
      expect(ruleString).toContain('"variable_name":"hitDescription"');
      expect(ruleString).toContain('"value":"cutting their flesh"');
      expect(ruleString).toContain('"variable_name":"excludeDamageTypes"');
      expect(ruleString).toContain('"piercing"'); // swing excludes piercing damage
    });

    it('should use context variables in rule for outcome checking', () => {
      const ruleString = JSON.stringify(swingAtTargetRule);

      // Rule accesses these for outcome branching
      expect(ruleString).toContain('context.attackResult.outcome');
      expect(ruleString).toContain('context.actorPosition.locationId');
    });

    it('should have macros that use pre-composed message templates from rule', () => {
      // Macros now use context.successMessage (pre-composed by rule) instead of individual variables
      const hitMacroString = JSON.stringify(handleMeleeHit);
      expect(hitMacroString).toContain('context.successMessage');
      // The macro still uses excludeDamageTypes for damage filtering
      expect(hitMacroString).toContain('context.excludeDamageTypes');

      const criticalMacroString = JSON.stringify(handleMeleeCritical);
      expect(criticalMacroString).toContain('context.attackVerb');
    });

    it('should reference correct event payload variables', () => {
      const ruleString = JSON.stringify(swingAtTargetRule);

      // Rule references secondaryId for targetId variable
      expect(ruleString).toContain('event.payload.secondaryId');

      // Macros reference event payload variables for actor/target identification
      const hitMacroString = JSON.stringify(handleMeleeHit);
      expect(hitMacroString).toContain('event.payload.actorId');
      expect(hitMacroString).toContain('event.payload.secondaryId');
    });
  });

  describe('Macro Usage Validation', () => {
    it('should use weapons macros for all outcome branches', () => {
      const ruleString = JSON.stringify(swingAtTargetRule);

      // Rule delegates to 4 weapons macros (one per outcome)
      expect(ruleString).toContain('weapons:handleMeleeCritical');
      expect(ruleString).toContain('weapons:handleMeleeHit');
      expect(ruleString).toContain('weapons:handleMeleeFumble');
      expect(ruleString).toContain('weapons:handleMeleeMiss');
    });

    it('should have success macros that use endTurnOnly internally', () => {
      // Hit and Critical macros call core:endTurnOnly
      const hitMacroString = JSON.stringify(handleMeleeHit);
      const criticalMacroString = JSON.stringify(handleMeleeCritical);

      expect(hitMacroString).toContain('core:endTurnOnly');
      expect(criticalMacroString).toContain('core:endTurnOnly');
    });

    it('should have failure macros that use logFailureOutcomeAndEndTurn internally', () => {
      // Fumble and Miss macros call core:logFailureOutcomeAndEndTurn
      const fumbleMacroString = JSON.stringify(handleMeleeFumble);
      const missMacroString = JSON.stringify(handleMeleeMiss);

      expect(fumbleMacroString).toContain('core:logFailureOutcomeAndEndTurn');
      expect(missMacroString).toContain('core:logFailureOutcomeAndEndTurn');
    });

    it('should have all macros with valid schema references', () => {
      expect(handleMeleeCritical.$schema).toBe('schema://living-narrative-engine/macro.schema.json');
      expect(handleMeleeHit.$schema).toBe('schema://living-narrative-engine/macro.schema.json');
      expect(handleMeleeFumble.$schema).toBe('schema://living-narrative-engine/macro.schema.json');
      expect(handleMeleeMiss.$schema).toBe('schema://living-narrative-engine/macro.schema.json');
    });

    it('should have all macros with proper ID format', () => {
      expect(handleMeleeCritical.id).toBe('weapons:handleMeleeCritical');
      expect(handleMeleeHit.id).toBe('weapons:handleMeleeHit');
      expect(handleMeleeFumble.id).toBe('weapons:handleMeleeFumble');
      expect(handleMeleeMiss.id).toBe('weapons:handleMeleeMiss');
    });
  });
});
