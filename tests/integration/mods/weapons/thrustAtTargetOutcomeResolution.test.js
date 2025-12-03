/**
 * @file Integration tests for thrust_at_target rule with outcome resolution
 * @description Tests the handle_thrust_at_target rule structure and event handling.
 * Note: Actual outcome determination is tested in unit tests for ResolveOutcomeHandler
 * and OutcomeDeterminerService. This test validates the rule's
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
import thrustAtTargetRule from '../../../../data/mods/weapons/rules/handle_thrust_at_target.rule.json' assert { type: 'json' };
import eventIsActionThrustAtTarget from '../../../../data/mods/weapons/conditions/event-is-action-thrust-at-target.condition.json' assert { type: 'json' };
import thrustAtTargetAction from '../../../../data/mods/weapons/actions/thrust_at_target.action.json' assert { type: 'json' };

// Import macros for structure validation
import handleMeleeCritical from '../../../../data/mods/weapons/macros/handleMeleeCritical.macro.json' assert { type: 'json' };
import handleMeleeHit from '../../../../data/mods/weapons/macros/handleMeleeHit.macro.json' assert { type: 'json' };
import handleMeleeFumble from '../../../../data/mods/weapons/macros/handleMeleeFumble.macro.json' assert { type: 'json' };
import handleMeleeMiss from '../../../../data/mods/weapons/macros/handleMeleeMiss.macro.json' assert { type: 'json' };

describe('thrust_at_target outcome resolution rule', () => {
  describe('Rule Structure Validation', () => {
    it('should have correct rule_id', () => {
      expect(thrustAtTargetRule.rule_id).toBe('handle_thrust_at_target');
    });

    it('should trigger on core:attempt_action event', () => {
      expect(thrustAtTargetRule.event_type).toBe('core:attempt_action');
    });

    it('should reference the correct condition', () => {
      expect(thrustAtTargetRule.condition.condition_ref).toBe(
        'weapons:event-is-action-thrust-at-target'
      );
    });

    it('should have actions array', () => {
      expect(Array.isArray(thrustAtTargetRule.actions)).toBe(true);
      expect(thrustAtTargetRule.actions.length).toBeGreaterThan(0);
    });
  });

  describe('Operations Validation', () => {
    it('should include GET_NAME operations for actor, target, and weapon', () => {
      const getNameOps = thrustAtTargetRule.actions.filter(
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
      const queryOp = thrustAtTargetRule.actions.find(
        (op) => op.type === 'QUERY_COMPONENT'
      );

      expect(queryOp).toBeDefined();
      expect(queryOp.parameters.entity_ref).toBe('actor');
      expect(queryOp.parameters.component_type).toBe('core:position');
      expect(queryOp.parameters.result_variable).toBe('actorPosition');
    });

    it('should include RESOLVE_OUTCOME operation with correct parameters', () => {
      const resolveOutcomeOp = thrustAtTargetRule.actions.find(
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
      const ifOps = thrustAtTargetRule.actions.filter((op) => op.type === 'IF');

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
      const ifOps = thrustAtTargetRule.actions.filter((op) => op.type === 'IF');
      expect(ifOps.length).toBe(4);

      // Verify each outcome has its own top-level IF
      expect(findIfByOutcome(thrustAtTargetRule.actions, 'CRITICAL_SUCCESS')).toBeDefined();
      expect(findIfByOutcome(thrustAtTargetRule.actions, 'SUCCESS')).toBeDefined();
      expect(findIfByOutcome(thrustAtTargetRule.actions, 'FUMBLE')).toBeDefined();
      expect(findIfByOutcome(thrustAtTargetRule.actions, 'FAILURE')).toBeDefined();
    });

    it('should delegate CRITICAL_SUCCESS to handleMeleeCritical macro', () => {
      const criticalSuccessIf = findIfByOutcome(thrustAtTargetRule.actions, 'CRITICAL_SUCCESS');
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
      const successIf = findIfByOutcome(thrustAtTargetRule.actions, 'SUCCESS');
      expect(successIf).toBeDefined();

      // Verify macro reference in rule
      const thenActions = successIf.parameters.then_actions;
      const hasMacro = thenActions.some(
        (op) => op.macro === 'weapons:handleMeleeHit'
      );
      expect(hasMacro).toBe(true);

      // Verify macro uses context variable for hit description (e.g., "piercing their flesh")
      const macroString = JSON.stringify(handleMeleeHit);
      expect(macroString).toContain('context.hitDescription');
      expect(macroString).toContain('core:endTurnOnly');
    });

    it('should delegate FUMBLE to handleMeleeFumble macro', () => {
      const fumbleIf = findIfByOutcome(thrustAtTargetRule.actions, 'FUMBLE');
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
      const failureIf = findIfByOutcome(thrustAtTargetRule.actions, 'FAILURE');
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
      expect(thrustAtTargetAction.chanceBased).toBeDefined();
      expect(thrustAtTargetAction.chanceBased.enabled).toBe(true);
    });

    it('should have melee_skill as actor skill in action', () => {
      expect(thrustAtTargetAction.chanceBased.actorSkill).toBeDefined();
      expect(thrustAtTargetAction.chanceBased.actorSkill.component).toBe(
        'skills:melee_skill'
      );
      expect(thrustAtTargetAction.chanceBased.actorSkill.default).toBe(10);
    });

    it('should have defense_skill as target skill in action', () => {
      expect(thrustAtTargetAction.chanceBased.targetSkill).toBeDefined();
      expect(thrustAtTargetAction.chanceBased.targetSkill.component).toBe(
        'skills:defense_skill'
      );
      expect(thrustAtTargetAction.chanceBased.targetSkill.default).toBe(0);
    });
  });

  describe('Condition Validation', () => {
    it('should reference correct action ID', () => {
      // The condition uses 'logic' property with a direct equality check
      expect(eventIsActionThrustAtTarget.logic).toBeDefined();
      expect(eventIsActionThrustAtTarget.logic['==']).toBeDefined();

      // Verify it checks event.payload.actionId
      const eqClause = eventIsActionThrustAtTarget.logic['=='];
      expect(eqClause[0]?.var).toBe('event.payload.actionId');
      expect(eqClause[1]).toBe('weapons:thrust_at_target');
    });
  });

  describe('Schema Compliance', () => {
    // Schema validation was already performed by the npm run validate command
    // which passed with 0 violations. These tests verify structural compliance.

    it('should have valid $schema reference in rule', () => {
      expect(thrustAtTargetRule.$schema).toBe(
        'schema://living-narrative-engine/rule.schema.json'
      );
    });

    it('should have valid $schema reference in condition', () => {
      expect(eventIsActionThrustAtTarget.$schema).toBe(
        'schema://living-narrative-engine/condition.schema.json'
      );
    });

    it('should have valid $schema reference in action', () => {
      expect(thrustAtTargetAction.$schema).toBe(
        'schema://living-narrative-engine/action.schema.json'
      );
    });

    it('should have required rule fields', () => {
      expect(thrustAtTargetRule.rule_id).toBeDefined();
      expect(thrustAtTargetRule.event_type).toBeDefined();
      expect(thrustAtTargetRule.condition).toBeDefined();
      expect(thrustAtTargetRule.actions).toBeDefined();
    });

    it('should have required condition fields', () => {
      expect(eventIsActionThrustAtTarget.id).toBeDefined();
      expect(eventIsActionThrustAtTarget.logic).toBeDefined();
    });
  });

  describe('Variable Resolution Consistency', () => {
    it('should define all required result variables', () => {
      const ruleString = JSON.stringify(thrustAtTargetRule);

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

    it('should set thrust-specific context variables for macros', () => {
      const ruleString = JSON.stringify(thrustAtTargetRule);

      // Thrust rule should set these context variables for use by macros
      expect(ruleString).toContain('"variable_name":"attackVerb"');
      expect(ruleString).toContain('"value":"thrust"');
      expect(ruleString).toContain('"variable_name":"attackVerbPast"');
      expect(ruleString).toContain('"value":"thrusts"');
      expect(ruleString).toContain('"variable_name":"hitDescription"');
      expect(ruleString).toContain('"value":"piercing their flesh"');
      expect(ruleString).toContain('"variable_name":"excludeDamageTypes"');
      expect(ruleString).toContain('"slashing"'); // thrust excludes slashing damage
    });

    it('should use context variables in rule for outcome checking', () => {
      const ruleString = JSON.stringify(thrustAtTargetRule);

      // Rule accesses these for outcome branching
      expect(ruleString).toContain('context.attackResult.outcome');
      expect(ruleString).toContain('context.actorPosition.locationId');
    });

    it('should have macros that use context variables in templates', () => {
      // Macros use context variables set by the rule
      const hitMacroString = JSON.stringify(handleMeleeHit);
      expect(hitMacroString).toContain('context.actorName');
      expect(hitMacroString).toContain('context.targetName');
      expect(hitMacroString).toContain('context.weaponName');
      expect(hitMacroString).toContain('context.hitDescription');
      expect(hitMacroString).toContain('context.excludeDamageTypes');

      const criticalMacroString = JSON.stringify(handleMeleeCritical);
      expect(criticalMacroString).toContain('context.attackVerb');
    });

    it('should reference correct event payload variables', () => {
      const ruleString = JSON.stringify(thrustAtTargetRule);

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
      const ruleString = JSON.stringify(thrustAtTargetRule);

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
