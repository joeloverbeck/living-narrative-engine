/**
 * @file Integration tests for swing_at_target rule with outcome resolution
 * @description Tests the handle_swing_at_target rule structure and event handling.
 * Note: Actual outcome determination is tested in unit tests for ResolveOutcomeHandler
 * and OutcomeDeterminerService (NONDETACTSYS-008). This test validates the rule's
 * structure and integration with the event system.
 */

import { describe, it, expect } from '@jest/globals';

// Import rule and condition JSON for structure validation
import swingAtTargetRule from '../../../../data/mods/weapons/rules/handle_swing_at_target.rule.json' assert { type: 'json' };
import eventIsActionSwingAtTarget from '../../../../data/mods/weapons/conditions/event-is-action-swing-at-target.condition.json' assert { type: 'json' };
import swingAtTargetAction from '../../../../data/mods/weapons/actions/swing_at_target.action.json' assert { type: 'json' };

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

    it('should handle CRITICAL_SUCCESS with devastating blow message', () => {
      const criticalSuccessIf = findIfByOutcome(swingAtTargetRule.actions, 'CRITICAL_SUCCESS');
      expect(criticalSuccessIf).toBeDefined();

      const condition = criticalSuccessIf.parameters.condition;
      expect(condition['==']).toBeDefined();
      expect(condition['=='][0]).toEqual({ var: 'context.attackResult.outcome' });
      expect(condition['=='][1]).toBe('CRITICAL_SUCCESS');

      const thenActions = criticalSuccessIf.parameters.then_actions;
      const dispatchEvent = thenActions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatchEvent).toBeDefined();
      expect(dispatchEvent.parameters.description_text).toContain(
        'devastating blow'
      );
      expect(dispatchEvent.parameters.description_text).toContain(
        '{context.actorName}'
      );
      expect(dispatchEvent.parameters.description_text).toContain(
        '{context.weaponName}'
      );
      expect(dispatchEvent.parameters.description_text).toContain(
        '{context.targetName}'
      );

      // Check for success macro
      const hasMacro = thenActions.some(
        (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
      );
      expect(hasMacro).toBe(true);
    });

    it('should have SUCCESS branch with cutting flesh message', () => {
      const successIf = findIfByOutcome(swingAtTargetRule.actions, 'SUCCESS');
      expect(successIf).toBeDefined();

      const thenActions = successIf.parameters.then_actions;
      const dispatchEvent = thenActions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(dispatchEvent).toBeDefined();
      expect(dispatchEvent.parameters.description_text).toContain(
        'cutting their flesh'
      );

      // Check for success macro
      const hasMacro = thenActions.some(
        (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
      );
      expect(hasMacro).toBe(true);
    });

    it('should have FUMBLE branch with loses grip message', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      expect(fumbleIf).toBeDefined();

      const thenActions = fumbleIf.parameters.then_actions;
      const dispatchEvent = thenActions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(dispatchEvent).toBeDefined();
      expect(dispatchEvent.parameters.description_text).toContain('loses grip');

      // Check for failure macro
      const hasMacro = thenActions.some(
        (op) => op.macro === 'core:logFailureOutcomeAndEndTurn'
      );
      expect(hasMacro).toBe(true);
    });

    it('should have FAILURE branch with fails to connect message', () => {
      const failureIf = findIfByOutcome(swingAtTargetRule.actions, 'FAILURE');
      expect(failureIf).toBeDefined();

      const thenActions = failureIf.parameters.then_actions;
      const dispatchEvent = thenActions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(dispatchEvent).toBeDefined();
      expect(dispatchEvent.parameters.description_text).toContain(
        'fails to connect'
      );

      // Check for failure macro
      const hasMacro = thenActions.some(
        (op) => op.macro === 'core:logFailureOutcomeAndEndTurn'
      );
      expect(hasMacro).toBe(true);
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

      // Check that all result variables are defined
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

    it('should use context variables in templates', () => {
      const ruleString = JSON.stringify(swingAtTargetRule);

      // Check that context variables are used in message templates
      expect(ruleString).toContain('context.actorName');
      expect(ruleString).toContain('context.targetName');
      expect(ruleString).toContain('context.weaponName');
      expect(ruleString).toContain('context.actorPosition');
      // attackResult is accessed via outcome property
      expect(ruleString).toContain('context.attackResult.outcome');
    });

    it('should reference correct event payload variables', () => {
      const ruleString = JSON.stringify(swingAtTargetRule);

      // Check event payload references
      expect(ruleString).toContain('event.payload.actorId');
      expect(ruleString).toContain('event.payload.secondaryId');
    });
  });

  describe('Macro Usage Validation', () => {
    it('should use logSuccessOutcomeAndEndTurn macro for success outcomes', () => {
      const ruleString = JSON.stringify(swingAtTargetRule);

      // Count success macro occurrences (should be 2: CRITICAL_SUCCESS and SUCCESS)
      const successMacroMatches = ruleString.match(
        /core:logSuccessOutcomeAndEndTurn/g
      );
      expect(successMacroMatches?.length).toBe(2);
    });

    it('should use logFailureOutcomeAndEndTurn macro for failure outcomes', () => {
      const ruleString = JSON.stringify(swingAtTargetRule);

      // Count failure macro occurrences (should be 2: FAILURE and FUMBLE)
      const failureMacroMatches = ruleString.match(
        /core:logFailureOutcomeAndEndTurn/g
      );
      expect(failureMacroMatches?.length).toBe(2);
    });
  });
});
