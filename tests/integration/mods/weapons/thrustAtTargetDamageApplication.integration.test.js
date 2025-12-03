/**
 * @file Integration tests to verify handle_thrust_at_target applies weapon damage
 * Updated to test macro-based architecture where damage application logic is in shared macros.
 */

import { describe, expect, it } from '@jest/globals';
import thrustAtTargetRule from '../../../../data/mods/weapons/rules/handle_thrust_at_target.rule.json' assert { type: 'json' };
import handleMeleeHit from '../../../../data/mods/weapons/macros/handleMeleeHit.macro.json' assert { type: 'json' };
import handleMeleeCritical from '../../../../data/mods/weapons/macros/handleMeleeCritical.macro.json' assert { type: 'json' };
import handleMeleeMiss from '../../../../data/mods/weapons/macros/handleMeleeMiss.macro.json' assert { type: 'json' };
import handleMeleeFumble from '../../../../data/mods/weapons/macros/handleMeleeFumble.macro.json' assert { type: 'json' };

const findOutcomeBranch = (outcome) =>
  thrustAtTargetRule.actions.find(
    (op) => op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcome
  );

describe('handle_thrust_at_target damage application', () => {
  describe('Rule Setup', () => {
    it('queries weapon damage capabilities before branching', () => {
      const actions = thrustAtTargetRule.actions;
      const damageQueryIndex = actions.findIndex(
        (op) =>
          op.type === 'QUERY_COMPONENT' &&
          op.parameters?.entity_ref === 'primary' &&
          op.parameters?.component_type === 'damage-types:damage_capabilities' &&
          op.parameters?.result_variable === 'weaponDamage'
      );

      const firstIfIndex = actions.findIndex((op) => op.type === 'IF');

      expect(damageQueryIndex).toBeGreaterThanOrEqual(0);
      expect(firstIfIndex).toBeGreaterThan(damageQueryIndex);
    });

    it('sets excludeDamageTypes context variable for thrust (slashing excluded)', () => {
      const setExcludeOp = thrustAtTargetRule.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters?.variable_name === 'excludeDamageTypes'
      );

      expect(setExcludeOp).toBeDefined();
      expect(setExcludeOp.parameters.value).toEqual(['slashing']);
    });
  });

  describe('Macro Delegation', () => {
    it('delegates SUCCESS to handleMeleeHit macro', () => {
      const successBranch = findOutcomeBranch('SUCCESS');
      expect(successBranch).toBeDefined();

      const macroRef = successBranch.parameters.then_actions.find(
        (op) => op.macro === 'weapons:handleMeleeHit'
      );
      expect(macroRef).toBeDefined();
    });

    it('delegates CRITICAL_SUCCESS to handleMeleeCritical macro', () => {
      const critBranch = findOutcomeBranch('CRITICAL_SUCCESS');
      expect(critBranch).toBeDefined();

      const macroRef = critBranch.parameters.then_actions.find(
        (op) => op.macro === 'weapons:handleMeleeCritical'
      );
      expect(macroRef).toBeDefined();
    });

    it('delegates FAILURE to handleMeleeMiss macro', () => {
      const failBranch = findOutcomeBranch('FAILURE');
      expect(failBranch).toBeDefined();

      const macroRef = failBranch.parameters.then_actions.find(
        (op) => op.macro === 'weapons:handleMeleeMiss'
      );
      expect(macroRef).toBeDefined();
    });

    it('delegates FUMBLE to handleMeleeFumble macro', () => {
      const fumbleBranch = findOutcomeBranch('FUMBLE');
      expect(fumbleBranch).toBeDefined();

      const macroRef = fumbleBranch.parameters.then_actions.find(
        (op) => op.macro === 'weapons:handleMeleeFumble'
      );
      expect(macroRef).toBeDefined();
    });
  });

  describe('Macro Damage Application (handleMeleeHit)', () => {
    it('applies each damage entry using FOR_EACH over weaponDamage.entries', () => {
      const forEachOp = handleMeleeHit.actions.find(
        (op) => op.type === 'FOR_EACH'
      );

      expect(forEachOp).toBeDefined();
      expect(forEachOp.parameters.collection).toBe('context.weaponDamage.entries');
      expect(forEachOp.parameters.item_variable).toBe('dmgEntry');
    });

    it('uses APPLY_DAMAGE with damage_entry parameter', () => {
      const forEachOp = handleMeleeHit.actions.find(
        (op) => op.type === 'FOR_EACH'
      );

      const applyDamage = forEachOp.parameters.actions.find(
        (action) => action.type === 'APPLY_DAMAGE'
      );

      expect(applyDamage).toBeDefined();
      expect(applyDamage.parameters.entity_ref).toBe('secondary');
      expect(applyDamage.parameters.damage_entry).toEqual({ var: 'context.dmgEntry' });
      expect(applyDamage.parameters.amount).toBeUndefined();
      expect(applyDamage.parameters.damage_type).toBeUndefined();
    });

    it('uses context variable for exclude_damage_types', () => {
      const forEachOp = handleMeleeHit.actions.find(
        (op) => op.type === 'FOR_EACH'
      );

      const applyDamage = forEachOp.parameters.actions.find(
        (action) => action.type === 'APPLY_DAMAGE'
      );

      expect(applyDamage.parameters.exclude_damage_types).toEqual({
        var: 'context.excludeDamageTypes',
      });
    });
  });

  describe('Macro Damage Application (handleMeleeCritical)', () => {
    it('applies 1.5x damage via damage_multiplier', () => {
      const forEachOp = handleMeleeCritical.actions.find(
        (op) => op.type === 'FOR_EACH'
      );

      expect(forEachOp).toBeDefined();

      const applyDamage = forEachOp.parameters.actions.find(
        (action) => action.type === 'APPLY_DAMAGE'
      );

      expect(applyDamage).toBeDefined();
      expect(applyDamage.parameters.damage_entry).toEqual({ var: 'context.dmgEntry' });
      expect(applyDamage.parameters.damage_multiplier).toBe(1.5);
    });

    it('uses context variable for exclude_damage_types', () => {
      const forEachOp = handleMeleeCritical.actions.find(
        (op) => op.type === 'FOR_EACH'
      );

      const applyDamage = forEachOp.parameters.actions.find(
        (action) => action.type === 'APPLY_DAMAGE'
      );

      expect(applyDamage.parameters.exclude_damage_types).toEqual({
        var: 'context.excludeDamageTypes',
      });
    });
  });

  describe('No Damage on FAILURE/FUMBLE', () => {
    it('handleMeleeMiss macro does not apply damage', () => {
      const applyDamageOps = handleMeleeMiss.actions.filter(
        (action) => action.type === 'APPLY_DAMAGE'
      );

      expect(applyDamageOps.length).toBe(0);
    });

    it('handleMeleeFumble macro does not apply damage', () => {
      const applyDamageOps = handleMeleeFumble.actions.filter(
        (action) => action.type === 'APPLY_DAMAGE'
      );

      expect(applyDamageOps.length).toBe(0);
    });
  });
});
