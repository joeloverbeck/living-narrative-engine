/**
 * @file Integration tests for APPLY_DAMAGE exclude_damage_types functionality
 * @description Tests that damage type exclusions work correctly in the
 * handle_swing_at_target rule and the ApplyDamageHandler.
 */

import { describe, it, expect } from '@jest/globals';
import swingAtTargetRule from '../../../../data/mods/weapons/rules/handle_swing_at_target.rule.json' assert { type: 'json' };

/**
 * Helper to find an IF operation by outcome value
 *
 * @param {string} outcome - The outcome value to search for
 * @returns {object|undefined} The IF operation or undefined
 */
const findOutcomeBranch = (outcome) =>
  swingAtTargetRule.actions.find(
    (op) => op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcome
  );

/**
 * Helper to extract APPLY_DAMAGE operations from a branch's FOR_EACH
 *
 * @param {object} branch - The IF branch to search
 * @returns {object|undefined} The APPLY_DAMAGE operation
 */
const getApplyDamageFromBranch = (branch) => {
  const forEachOp = branch?.parameters?.then_actions?.find(
    (op) => op.type === 'FOR_EACH'
  );
  return forEachOp?.parameters?.actions?.find(
    (action) => action.type === 'APPLY_DAMAGE'
  );
};

describe('APPLY_DAMAGE exclude_damage_types integration', () => {
  describe('swing_at_target rule exclusion configuration', () => {
    it('should have exclude_damage_types parameter in SUCCESS branch APPLY_DAMAGE', () => {
      const successBranch = findOutcomeBranch('SUCCESS');
      expect(successBranch).toBeDefined();

      const applyDamage = getApplyDamageFromBranch(successBranch);
      expect(applyDamage).toBeDefined();
      expect(applyDamage.parameters.exclude_damage_types).toBeDefined();
      expect(applyDamage.parameters.exclude_damage_types).toEqual(['piercing']);
    });

    it('should have exclude_damage_types parameter in CRITICAL_SUCCESS branch APPLY_DAMAGE', () => {
      const critBranch = findOutcomeBranch('CRITICAL_SUCCESS');
      expect(critBranch).toBeDefined();

      const applyDamage = getApplyDamageFromBranch(critBranch);
      expect(applyDamage).toBeDefined();
      expect(applyDamage.parameters.exclude_damage_types).toBeDefined();
      expect(applyDamage.parameters.exclude_damage_types).toEqual(['piercing']);
    });

    it('should maintain damage_multiplier alongside exclude_damage_types in CRITICAL_SUCCESS', () => {
      const critBranch = findOutcomeBranch('CRITICAL_SUCCESS');
      const applyDamage = getApplyDamageFromBranch(critBranch);

      expect(applyDamage.parameters.damage_multiplier).toBe(1.5);
      expect(applyDamage.parameters.exclude_damage_types).toEqual(['piercing']);
    });

    it('should exclude only piercing damage type for swing action', () => {
      // Swing action should exclude piercing since it's a slashing motion
      // but should still allow slashing, fire, corruption, etc.
      const successBranch = findOutcomeBranch('SUCCESS');
      const applyDamage = getApplyDamageFromBranch(successBranch);

      const excludedTypes = applyDamage.parameters.exclude_damage_types;
      expect(excludedTypes).toContain('piercing');
      expect(excludedTypes).not.toContain('slashing');
      expect(excludedTypes).not.toContain('fire');
      expect(excludedTypes).not.toContain('corruption');
      expect(excludedTypes).not.toContain('bludgeoning');
    });
  });

  describe('exclusion consistency across outcome branches', () => {
    it('should have identical exclusion lists in SUCCESS and CRITICAL_SUCCESS', () => {
      const successBranch = findOutcomeBranch('SUCCESS');
      const critBranch = findOutcomeBranch('CRITICAL_SUCCESS');

      const successApplyDamage = getApplyDamageFromBranch(successBranch);
      const critApplyDamage = getApplyDamageFromBranch(critBranch);

      expect(successApplyDamage.parameters.exclude_damage_types).toEqual(
        critApplyDamage.parameters.exclude_damage_types
      );
    });

    it('should not have APPLY_DAMAGE in FAILURE branch', () => {
      const failureBranch = findOutcomeBranch('FAILURE');
      expect(failureBranch).toBeDefined();

      const applyDamageOps = failureBranch.parameters.then_actions.filter(
        (action) => action.type === 'APPLY_DAMAGE'
      );

      expect(applyDamageOps.length).toBe(0);
    });

    it('should not have APPLY_DAMAGE in FUMBLE branch', () => {
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

    it('should still iterate through all damage entries in FOR_EACH', () => {
      const successBranch = findOutcomeBranch('SUCCESS');
      const forEachOp = successBranch.parameters.then_actions.find(
        (op) => op.type === 'FOR_EACH'
      );

      // FOR_EACH still iterates all entries, exclusion happens at APPLY_DAMAGE level
      expect(forEachOp.parameters.collection).toBe('context.weaponDamage.entries');
      expect(forEachOp.parameters.item_variable).toBe('dmgEntry');
    });

    it('should preserve entity_ref and damage_entry parameters', () => {
      const successBranch = findOutcomeBranch('SUCCESS');
      const applyDamage = getApplyDamageFromBranch(successBranch);

      expect(applyDamage.parameters.entity_ref).toBe('secondary');
      expect(applyDamage.parameters.damage_entry).toEqual({ var: 'context.dmgEntry' });
    });
  });

  describe('backward compatibility', () => {
    it('should not have deprecated amount parameter', () => {
      const successBranch = findOutcomeBranch('SUCCESS');
      const applyDamage = getApplyDamageFromBranch(successBranch);

      expect(applyDamage.parameters.amount).toBeUndefined();
    });

    it('should not have deprecated damage_type parameter', () => {
      const successBranch = findOutcomeBranch('SUCCESS');
      const applyDamage = getApplyDamageFromBranch(successBranch);

      expect(applyDamage.parameters.damage_type).toBeUndefined();
    });
  });
});
