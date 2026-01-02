/**
 * @file Unit tests for handle_peck_target rule
 * @description Verifies that the handle_peck_target rule correctly processes peck
 * attack attempts, setting peck-specific variables and emitting outcome-specific
 * events/actions based on attack outcomes (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE).
 */

import { describe, it, expect } from '@jest/globals';

// Import rule JSON for structure validation
import handlePeckTarget from '../../../../../data/mods/creature-attacks/rules/handle_peck_target.rule.json' assert { type: 'json' };

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

    it('should reference creature-attacks:event-is-action-peck-target condition', () => {
      expect(handlePeckTarget.condition).toBeDefined();
      expect(handlePeckTarget.condition.condition_ref).toBe(
        'creature-attacks:event-is-action-peck-target'
      );
    });
  });

  describe('Peck-Specific Variables', () => {
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

  describe('Outcome Handling', () => {
    it('should dispatch a perceptible event for CRITICAL_SUCCESS', () => {
      const ifOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('CRITICAL_SUCCESS')
      );
      expect(ifOp).toBeDefined();
      const dispatchOp = ifOp.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatchOp).toBeDefined();
      expect(
        dispatchOp.parameters.description_text.toLowerCase()
      ).toContain('peck');
      expect(
        dispatchOp.parameters.description_text.toLowerCase()
      ).toContain('piercing');
    });

    it('should dispatch a perceptible event for SUCCESS', () => {
      const ifOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('"SUCCESS"') &&
          !JSON.stringify(op.parameters.condition).includes('CRITICAL_SUCCESS')
      );
      expect(ifOp).toBeDefined();
      const dispatchOp = ifOp.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatchOp).toBeDefined();
      expect(
        dispatchOp.parameters.description_text.toLowerCase()
      ).toContain('pecks');
      expect(
        dispatchOp.parameters.description_text.toLowerCase()
      ).toContain('piercing');
    });

    it('should dispatch a perceptible event for FAILURE', () => {
      const ifOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('FAILURE')
      );
      expect(ifOp).toBeDefined();
      const dispatchOp = ifOp.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatchOp).toBeDefined();
      expect(
        dispatchOp.parameters.description_text.toLowerCase()
      ).toContain('pecks');
    });

    it('should add fallen component for FUMBLE', () => {
      const ifOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('FUMBLE')
      );
      expect(ifOp).toBeDefined();
      const addComponentOp = ifOp.parameters.then_actions.find(
        (action) =>
          action.type === 'ADD_COMPONENT' &&
          action.parameters.component_type === 'recovery-states:fallen'
      );
      expect(addComponentOp).toBeDefined();
    });

    it('should use end-turn macros per outcome', () => {
      const criticalIf = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('CRITICAL_SUCCESS')
      );
      const successIf = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('"SUCCESS"') &&
          !JSON.stringify(op.parameters.condition).includes('CRITICAL_SUCCESS')
      );
      const failureIf = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('FAILURE')
      );
      const fumbleIf = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('FUMBLE')
      );

      const criticalEnd = criticalIf.parameters.then_actions.find(
        (action) => action.macro === 'core:endTurnOnly'
      );
      const successEnd = successIf.parameters.then_actions.find(
        (action) => action.macro === 'core:endTurnOnly'
      );
      const failureEnd = failureIf.parameters.then_actions.find(
        (action) => action.macro === 'core:logFailureOutcomeAndEndTurn'
      );
      const fumbleEnd = fumbleIf.parameters.then_actions.find(
        (action) => action.macro === 'core:logFailureOutcomeAndEndTurn'
      );

      expect(criticalEnd).toBeDefined();
      expect(successEnd).toBeDefined();
      expect(failureEnd).toBeDefined();
      expect(fumbleEnd).toBeDefined();
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
      expect(setVarOp.parameters.value).toBe('physical.target_action');
    });
  });

  describe('Key Differentiator from handle_strike_target', () => {
    it('should use pecking language in outcome descriptions', () => {
      const dispatchOps = handlePeckTarget.actions
        .filter((op) => op.type === 'IF')
        .flatMap((op) =>
          op.parameters.then_actions.filter(
            (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
          )
        );
      const descriptions = dispatchOps.map((op) =>
        op.parameters.description_text.toLowerCase()
      );
      expect(descriptions.some((text) => text.includes('peck'))).toBe(true);
      expect(descriptions.some((text) => text.includes('strike'))).toBe(false);
    });

    it('should highlight piercing in success descriptions', () => {
      const successIf = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('"SUCCESS"') &&
          !JSON.stringify(op.parameters.condition).includes('CRITICAL_SUCCESS')
      );
      const dispatchOp = successIf.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(
        dispatchOp.parameters.description_text.toLowerCase()
      ).toContain('piercing');
      expect(
        dispatchOp.parameters.description_text.toLowerCase()
      ).not.toContain('crushing');
    });

    it('should exclude damage types (unlike strike which allows all)', () => {
      const excludeOp = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'excludeDamageTypes'
      );
      expect(excludeOp.parameters.value.length).toBeGreaterThan(0);
    });

    it('should mark fumbles as combat violence events', () => {
      const fumbleIf = handlePeckTarget.actions.find(
        (op) =>
          op.type === 'IF' &&
          JSON.stringify(op.parameters.condition).includes('FUMBLE')
      );
      const dispatchOp = fumbleIf.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatchOp).toBeDefined();
      expect(dispatchOp.parameters.perception_type).toBe('combat.violence');
    });
  });
});
