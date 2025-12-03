/**
 * @file Integration tests to verify handle_swing_at_target applies weapon damage
 */

import { describe, expect, it } from '@jest/globals';
import swingAtTargetRule from '../../../../data/mods/weapons/rules/handle_swing_at_target.rule.json' assert { type: 'json' };

const findOutcomeBranch = (outcome) =>
  swingAtTargetRule.actions.find(
    (op) => op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcome
  );

describe('handle_swing_at_target damage application', () => {
  it('queries weapon damage capabilities before branching', () => {
    const actions = swingAtTargetRule.actions;
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

  it('applies each damage entry on SUCCESS using damage_entry', () => {
    const successBranch = findOutcomeBranch('SUCCESS');
    expect(successBranch).toBeDefined();

    const forEachOp = successBranch.parameters.then_actions.find(
      (op) => op.type === 'FOR_EACH'
    );

    expect(forEachOp).toBeDefined();
    expect(forEachOp.parameters.collection).toEqual({ var: 'context.weaponDamage.entries' });
    expect(forEachOp.parameters.item_variable).toBe('dmgEntry');

    const applyDamage = forEachOp.parameters.actions.find(
      (action) => action.type === 'APPLY_DAMAGE'
    );

    expect(applyDamage).toBeDefined();
    expect(applyDamage.parameters.entity_ref).toBe('secondary');
    expect(applyDamage.parameters.damage_entry).toEqual({ var: 'context.dmgEntry' });
    expect(applyDamage.parameters.amount).toBeUndefined();
    expect(applyDamage.parameters.damage_type).toBeUndefined();
  });

  it('applies 1.5x damage on CRITICAL_SUCCESS via damage_multiplier', () => {
    const critBranch = findOutcomeBranch('CRITICAL_SUCCESS');
    expect(critBranch).toBeDefined();

    const forEachOp = critBranch.parameters.then_actions.find(
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

  it('does not apply damage on FAILURE or FUMBLE', () => {
    const outcomes = ['FAILURE', 'FUMBLE'];

    for (const outcome of outcomes) {
      const branch = findOutcomeBranch(outcome);
      expect(branch).toBeDefined();

      const applyDamageOps = branch.parameters.then_actions.filter(
        (action) => action.type === 'APPLY_DAMAGE'
      );

      expect(applyDamageOps.length).toBe(0);
    }
  });
});
