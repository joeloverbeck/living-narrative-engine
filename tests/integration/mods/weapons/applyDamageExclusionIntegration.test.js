/**
 * @file Integration tests for APPLY_DAMAGE exclude_damage_types functionality
 * @description Tests that damage type exclusions work correctly in the
 * handle_swing_at_target rule (via macro delegation) and the ApplyDamageHandler.
 */

import { describe, it, expect } from '@jest/globals';
import swingAtTargetRule from '../../../../data/mods/weapons/rules/handle_swing_at_target.rule.json' assert { type: 'json' };
import handleMeleeHit from '../../../../data/mods/weapons/macros/handleMeleeHit.macro.json' assert { type: 'json' };
import handleMeleeCritical from '../../../../data/mods/weapons/macros/handleMeleeCritical.macro.json' assert { type: 'json' };

/**
 * Helper to find an IF operation by outcome value
 *
 * @param {string} outcome - The outcome value to search for
 * @returns {object|undefined} The IF operation or undefined
 */
const findOutcomeBranch = (outcome) =>
  swingAtTargetRule.actions.find(
    (op) =>
      op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcome
  );

/**
 * Helper to extract APPLY_DAMAGE operations from a macro's FOR_EACH
 *
 * @param {object} macro - The macro to search
 * @returns {object|undefined} The APPLY_DAMAGE operation
 */
const getApplyDamageFromMacro = (macro) => {
  const forEachOp = macro?.actions?.find((op) => op.type === 'FOR_EACH');
  return forEachOp?.parameters?.actions?.find(
    (action) => action.type === 'APPLY_DAMAGE'
  );
};

describe('APPLY_DAMAGE exclude_damage_types integration', () => {
  describe('Rule Context Setup', () => {
    it('should set excludeDamageTypes context variable for swing (piercing excluded)', () => {
      const setExcludeOp = swingAtTargetRule.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters?.variable_name === 'excludeDamageTypes'
      );

      expect(setExcludeOp).toBeDefined();
      expect(setExcludeOp.parameters.value).toEqual(['piercing']);
    });
  });

  describe('swing_at_target rule exclusion configuration', () => {
    it('should have exclude_damage_types parameter in handleMeleeHit macro APPLY_DAMAGE', () => {
      const applyDamage = getApplyDamageFromMacro(handleMeleeHit);
      expect(applyDamage).toBeDefined();
      expect(applyDamage.parameters.exclude_damage_types).toBeDefined();
      // Macro uses context variable for flexibility
      expect(applyDamage.parameters.exclude_damage_types).toEqual({
        var: 'context.excludeDamageTypes',
      });
    });

    it('should have exclude_damage_types parameter in handleMeleeCritical macro APPLY_DAMAGE', () => {
      const applyDamage = getApplyDamageFromMacro(handleMeleeCritical);
      expect(applyDamage).toBeDefined();
      expect(applyDamage.parameters.exclude_damage_types).toBeDefined();
      // Macro uses context variable for flexibility
      expect(applyDamage.parameters.exclude_damage_types).toEqual({
        var: 'context.excludeDamageTypes',
      });
    });

    it('should maintain damage_multiplier alongside exclude_damage_types in CRITICAL_SUCCESS', () => {
      const applyDamage = getApplyDamageFromMacro(handleMeleeCritical);

      expect(applyDamage.parameters.damage_multiplier).toBe(1.5);
      expect(applyDamage.parameters.exclude_damage_types).toBeDefined();
    });

    it('should exclude only piercing damage type for swing action via context variable', () => {
      // Swing action sets excludeDamageTypes to ['piercing'] in the rule
      // The macros reference this via { var: 'context.excludeDamageTypes' }
      const setExcludeOp = swingAtTargetRule.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters?.variable_name === 'excludeDamageTypes'
      );

      const excludedTypes = setExcludeOp.parameters.value;
      expect(excludedTypes).toContain('piercing');
      expect(excludedTypes).not.toContain('slashing');
      expect(excludedTypes).not.toContain('fire');
      expect(excludedTypes).not.toContain('corruption');
      expect(excludedTypes).not.toContain('bludgeoning');
    });
  });

  describe('exclusion consistency across outcome branches', () => {
    it('should have identical exclusion reference in SUCCESS and CRITICAL_SUCCESS macros', () => {
      const successApplyDamage = getApplyDamageFromMacro(handleMeleeHit);
      const critApplyDamage = getApplyDamageFromMacro(handleMeleeCritical);

      expect(successApplyDamage.parameters.exclude_damage_types).toEqual(
        critApplyDamage.parameters.exclude_damage_types
      );
    });

    it('should not have APPLY_DAMAGE in FAILURE branch (rule delegates to macro without damage)', () => {
      const failureBranch = findOutcomeBranch('FAILURE');
      expect(failureBranch).toBeDefined();

      const applyDamageOps = failureBranch.parameters.then_actions.filter(
        (action) => action.type === 'APPLY_DAMAGE'
      );

      expect(applyDamageOps.length).toBe(0);
    });

    it('should not have APPLY_DAMAGE in FUMBLE branch (rule delegates to macro without damage)', () => {
      const fumbleBranch = findOutcomeBranch('FUMBLE');
      expect(fumbleBranch).toBeDefined();

      const applyDamageOps = fumbleBranch.parameters.then_actions.filter(
        (action) => action.type === 'APPLY_DAMAGE'
      );

      expect(applyDamageOps.length).toBe(0);
    });
  });

  describe('rule structure with exclusions', () => {
    it('should have valid schema reference', () => {
      expect(swingAtTargetRule.$schema).toBe(
        'schema://living-narrative-engine/rule.schema.json'
      );
    });

    it('should still iterate through all damage entries in FOR_EACH (via macro)', () => {
      const forEachOp = handleMeleeHit.actions.find(
        (op) => op.type === 'FOR_EACH'
      );

      // FOR_EACH still iterates all entries, exclusion happens at APPLY_DAMAGE level
      expect(forEachOp.parameters.collection).toBe(
        'context.weaponDamage.entries'
      );
      expect(forEachOp.parameters.item_variable).toBe('dmgEntry');
    });

    it('should preserve entity_ref and damage_entry parameters in macro', () => {
      const applyDamage = getApplyDamageFromMacro(handleMeleeHit);

      expect(applyDamage.parameters.entity_ref).toBe('secondary');
      expect(applyDamage.parameters.damage_entry).toEqual({
        var: 'context.dmgEntry',
      });
    });
  });

  describe('backward compatibility', () => {
    it('should not have deprecated amount parameter', () => {
      const applyDamage = getApplyDamageFromMacro(handleMeleeHit);

      expect(applyDamage.parameters.amount).toBeUndefined();
    });

    it('should not have deprecated damage_type parameter', () => {
      const applyDamage = getApplyDamageFromMacro(handleMeleeHit);

      expect(applyDamage.parameters.damage_type).toBeUndefined();
    });
  });
});
