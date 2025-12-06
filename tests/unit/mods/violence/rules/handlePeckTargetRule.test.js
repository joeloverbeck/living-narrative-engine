/**
 * @file Unit tests for handle_peck_target rule
 * @description Verifies that the handle_peck_target rule correctly processes peck
 * attack attempts, setting peck-specific variables and delegating to appropriate
 * macros based on attack outcomes (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE).
 */

import { describe, it, expect } from '@jest/globals';

// Import rule JSON for structure validation
import handlePeckTarget from '../../../../../data/mods/violence/rules/handle_peck_target.rule.json' assert { type: 'json' };

describe('handle_peck_target rule definition', () => {
  describe('Schema Structure', () => {
    it('should have valid rule schema structure', () => {
      expect(handlePeckTarget.$schema).toBe(
        'schema://living-narrative-engine/rule.schema.json'
      );
      expect(handlePeckTarget.rule_id).toBe('handle_peck_target');
      expect(handlePeckTarget.event_type).toBeDefined();
      expect(handlePeckTarget.condition).toBeDefined();
      expect(handlePeckTarget.actions).toBeDefined();
      expect(Array.isArray(handlePeckTarget.actions)).toBe(true);
    });

    it('should listen for core:attempt_action event', () => {
      expect(handlePeckTarget.event_type).toBe('core:attempt_action');
    });

    it('should reference violence:event-is-action-peck-target condition', () => {
      expect(handlePeckTarget.condition).toBeDefined();
      expect(handlePeckTarget.condition.condition_ref).toBe(
        'violence:event-is-action-peck-target'
      );
    });
  });

  describe('Peck-Specific Variables', () => {
    it('should set attackVerb to "peck"', () => {
      const setVarOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'attackVerb'
      );
      expect(setVarOp).toBeDefined();
      expect(setVarOp.parameters.value).toBe('peck');
    });

    it('should set attackVerbPast to "pecks"', () => {
      const setVarOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'attackVerbPast'
      );
      expect(setVarOp).toBeDefined();
      expect(setVarOp.parameters.value).toBe('pecks');
    });

    it('should set hitDescription for piercing damage', () => {
      const setVarOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'hitDescription'
      );
      expect(setVarOp).toBeDefined();
      expect(setVarOp.parameters.value.toLowerCase()).toContain('piercing');
    });

    it('should exclude slashing and blunt damage types', () => {
      const setVarOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'excludeDamageTypes'
      );
      expect(setVarOp).toBeDefined();
      expect(Array.isArray(setVarOp.parameters.value)).toBe(true);
      expect(setVarOp.parameters.value).toContain('slashing');
      expect(setVarOp.parameters.value).toContain('blunt');
    });

    it('should not exclude piercing damage', () => {
      const setVarOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'excludeDamageTypes'
      );
      expect(setVarOp.parameters.value).not.toContain('piercing');
    });
  });

  describe('Message Templates', () => {
    it('should set successMessage with peck verb', () => {
      const setVarOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'successMessage'
      );
      expect(setVarOp).toBeDefined();
      expect(setVarOp.parameters.value.toLowerCase()).toContain('pecks');
    });

    it('should set failureMessage with peck verb', () => {
      const setVarOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'failureMessage'
      );
      expect(setVarOp).toBeDefined();
      expect(setVarOp.parameters.value.toLowerCase()).toContain('peck');
    });
  });

  describe('Outcome Handling', () => {
    it('should use weapons:handleMeleeCritical for CRITICAL_SUCCESS', () => {
      const ifOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('CRITICAL_SUCCESS')
      );
      expect(ifOp).toBeDefined();
      expect(ifOp.parameters.then_actions).toBeDefined();
      expect(ifOp.parameters.then_actions[0].macro).toBe(
        'weapons:handleMeleeCritical'
      );
    });

    it('should use weapons:handleMeleeHit for SUCCESS', () => {
      const ifOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('"SUCCESS"') &&
          !JSON.stringify(op.parameters.condition).includes('CRITICAL_SUCCESS')
      );
      expect(ifOp).toBeDefined();
      expect(ifOp.parameters.then_actions).toBeDefined();
      expect(ifOp.parameters.then_actions[0].macro).toBe(
        'weapons:handleMeleeHit'
      );
    });

    it('should use weapons:handleMeleeMiss for FAILURE', () => {
      const ifOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('FAILURE')
      );
      expect(ifOp).toBeDefined();
      expect(ifOp.parameters.then_actions).toBeDefined();
      expect(ifOp.parameters.then_actions[0].macro).toBe(
        'weapons:handleMeleeMiss'
      );
    });

    it('should use violence:handleBeakFumble for FUMBLE (not weapons:handleMeleeFumble)', () => {
      const ifOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('FUMBLE')
      );
      expect(ifOp).toBeDefined();
      expect(ifOp.parameters.then_actions).toBeDefined();
      expect(ifOp.parameters.then_actions[0].macro).toBe(
        'violence:handleBeakFumble'
      );
      // Ensure it's NOT using the weapon fumble
      expect(ifOp.parameters.then_actions[0].macro).not.toBe(
        'weapons:handleMeleeFumble'
      );
    });
  });

  describe('All Four Outcomes Covered', () => {
    it('should handle all four attack outcomes', () => {
      const outcomes = ['CRITICAL_SUCCESS', 'SUCCESS', 'FAILURE', 'FUMBLE'];
      const ifOperations = handlePeckTarget.actions.filter(
        (op) => op.type === 'IF'
      );

      outcomes.forEach((outcome) => {
        const hasOutcome = ifOperations.some((op) =>
          JSON.stringify(op.parameters.condition).includes(outcome)
        );
        expect(hasOutcome).toBe(true);
      });
    });
  });

  describe('Context Variables Setup', () => {
    it('should query actor name', () => {
      const getNameOp = handlePeckTarget.actions.find(
        (op) => op.type === 'GET_NAME' && op.parameters.entity_ref === 'actor'
      );
      expect(getNameOp).toBeDefined();
      expect(getNameOp.parameters.result_variable).toBe('actorName');
    });

    it('should query target name from secondary entity', () => {
      const getNameOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'GET_NAME' && op.parameters.entity_ref === 'secondary'
      );
      expect(getNameOp).toBeDefined();
      expect(getNameOp.parameters.result_variable).toBe('targetName');
    });

    it('should query weapon name from primary entity (beak)', () => {
      const getNameOp = handlePeckTarget.actions.find(
        (op) => op.type === 'GET_NAME' && op.parameters.entity_ref === 'primary'
      );
      expect(getNameOp).toBeDefined();
      expect(getNameOp.parameters.result_variable).toBe('weaponName');
    });

    it('should query actor position', () => {
      const queryOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'QUERY_COMPONENT' &&
          op.parameters.component_type === 'core:position'
      );
      expect(queryOp).toBeDefined();
      expect(queryOp.parameters.entity_ref).toBe('actor');
      expect(queryOp.parameters.result_variable).toBe('actorPosition');
    });

    it('should query weapon damage capabilities', () => {
      const queryOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'QUERY_COMPONENT' &&
          op.parameters.component_type === 'damage-types:damage_capabilities'
      );
      expect(queryOp).toBeDefined();
      expect(queryOp.parameters.entity_ref).toBe('primary');
      expect(queryOp.parameters.result_variable).toBe('weaponDamage');
    });

    it('should resolve attack outcome using melee skill', () => {
      const resolveOp = handlePeckTarget.actions.find(
        (op) => op.type === 'RESOLVE_OUTCOME'
      );
      expect(resolveOp).toBeDefined();
      expect(resolveOp.parameters.actor_skill_component).toBe(
        'skills:melee_skill'
      );
      expect(resolveOp.parameters.target_skill_component).toBe(
        'skills:defense_skill'
      );
      expect(resolveOp.parameters.result_variable).toBe('attackResult');
      expect(resolveOp.parameters.target_role).toBe('secondary');
    });

    it('should set locationId from actor position', () => {
      const setVarOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'locationId'
      );
      expect(setVarOp).toBeDefined();
      expect(setVarOp.parameters.value).toBe(
        '{context.actorPosition.locationId}'
      );
    });

    it('should set targetId from event payload', () => {
      const setVarOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'targetId'
      );
      expect(setVarOp).toBeDefined();
      expect(setVarOp.parameters.value).toBe('{event.payload.secondaryId}');
    });

    it('should set perceptionType to action_target_general', () => {
      const setVarOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'perceptionType'
      );
      expect(setVarOp).toBeDefined();
      expect(setVarOp.parameters.value).toBe('action_target_general');
    });
  });

  describe('Key Differentiator from handle_strike_target', () => {
    it('should use peck verb instead of strike', () => {
      const attackVerbOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'attackVerb'
      );
      expect(attackVerbOp.parameters.value).toBe('peck');
      expect(attackVerbOp.parameters.value).not.toBe('strike');
    });

    it('should use pecks instead of strikes', () => {
      const attackVerbPastOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'attackVerbPast'
      );
      expect(attackVerbPastOp.parameters.value).toBe('pecks');
      expect(attackVerbPastOp.parameters.value).not.toBe('strikes');
    });

    it('should use piercing description instead of crushing', () => {
      const hitDescOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'hitDescription'
      );
      const value = hitDescOp.parameters.value.toLowerCase();
      expect(value).toContain('piercing');
      expect(value).not.toContain('crushing');
    });

    it('should exclude damage types (unlike strike which allows all)', () => {
      const excludeOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'excludeDamageTypes'
      );
      expect(excludeOp.parameters.value.length).toBeGreaterThan(0);
    });

    it('should use beak-specific fumble macro', () => {
      const fumbleIf = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('FUMBLE')
      );
      expect(fumbleIf.parameters.then_actions[0].macro).toBe(
        'violence:handleBeakFumble'
      );
    });
  });
});
