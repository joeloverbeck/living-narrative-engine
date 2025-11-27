/**
 * @file Integration tests for swing_at_target fumble branch weapon drop
 * @description Verifies that on a fumble outcome, the UNWIELD_ITEM and
 * DROP_ITEM_AT_LOCATION operations are present and correctly configured
 * in the handle_swing_at_target rule.
 */

import { describe, it, expect } from '@jest/globals';

// Import rule JSON for structure validation
import swingAtTargetRule from '../../../../data/mods/weapons/rules/handle_swing_at_target.rule.json' assert { type: 'json' };

describe('swing_at_target fumble weapon drop', () => {
  /**
   * Helper to find IF operation by outcome value
   *
   * @param {object[]} actions - Array of rule actions
   * @param {string} outcomeValue - The outcome value to match
   * @returns {object|undefined} The matching IF operation
   */
  const findIfByOutcome = (actions, outcomeValue) =>
    actions.find(
      (op) =>
        op.type === 'IF' &&
        op.parameters?.condition?.['==']?.[1] === outcomeValue
    );

  describe('Rule Structure Validation', () => {
    it('should have a FUMBLE branch', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      expect(fumbleIf).toBeDefined();
      expect(fumbleIf.parameters.then_actions).toBeDefined();
      expect(Array.isArray(fumbleIf.parameters.then_actions)).toBe(true);
    });

    it('should include UNWIELD_ITEM in fumble branch', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      const hasUnwield = fumbleIf.parameters.then_actions.some(
        (op) => op.type === 'UNWIELD_ITEM'
      );
      expect(hasUnwield).toBe(true);
    });

    it('should include DROP_ITEM_AT_LOCATION in fumble branch', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      const hasDrop = fumbleIf.parameters.then_actions.some(
        (op) => op.type === 'DROP_ITEM_AT_LOCATION'
      );
      expect(hasDrop).toBe(true);
    });
  });

  describe('UNWIELD_ITEM Operation Validation', () => {
    it('should reference correct actorEntity variable', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      const unwieldOp = fumbleIf.parameters.then_actions.find(
        (op) => op.type === 'UNWIELD_ITEM'
      );
      expect(unwieldOp.parameters.actorEntity).toBe('{event.payload.actorId}');
    });

    it('should reference correct itemEntity variable (weapon is primary target)', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      const unwieldOp = fumbleIf.parameters.then_actions.find(
        (op) => op.type === 'UNWIELD_ITEM'
      );
      expect(unwieldOp.parameters.itemEntity).toBe('{event.payload.primaryId}');
    });

    it('should have a descriptive comment', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      const unwieldOp = fumbleIf.parameters.then_actions.find(
        (op) => op.type === 'UNWIELD_ITEM'
      );
      expect(unwieldOp.comment).toBeDefined();
      expect(unwieldOp.comment.toLowerCase()).toContain('fumble');
    });
  });

  describe('DROP_ITEM_AT_LOCATION Operation Validation', () => {
    it('should reference correct actorEntity variable', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      const dropOp = fumbleIf.parameters.then_actions.find(
        (op) => op.type === 'DROP_ITEM_AT_LOCATION'
      );
      expect(dropOp.parameters.actorEntity).toBe('{event.payload.actorId}');
    });

    it('should reference correct itemEntity variable (weapon is primary target)', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      const dropOp = fumbleIf.parameters.then_actions.find(
        (op) => op.type === 'DROP_ITEM_AT_LOCATION'
      );
      expect(dropOp.parameters.itemEntity).toBe('{event.payload.primaryId}');
    });

    it('should reference correct locationId variable from actor position', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      const dropOp = fumbleIf.parameters.then_actions.find(
        (op) => op.type === 'DROP_ITEM_AT_LOCATION'
      );
      expect(dropOp.parameters.locationId).toBe(
        '{context.actorPosition.locationId}'
      );
    });

    it('should have a descriptive comment', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      const dropOp = fumbleIf.parameters.then_actions.find(
        (op) => op.type === 'DROP_ITEM_AT_LOCATION'
      );
      expect(dropOp.comment).toBeDefined();
      expect(dropOp.comment.toLowerCase()).toContain('fumble');
    });
  });

  describe('Operation Order Validation', () => {
    it('should execute UNWIELD_ITEM before DROP_ITEM_AT_LOCATION', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      const actions = fumbleIf.parameters.then_actions;
      const unwieldIndex = actions.findIndex(
        (op) => op.type === 'UNWIELD_ITEM'
      );
      const dropIndex = actions.findIndex(
        (op) => op.type === 'DROP_ITEM_AT_LOCATION'
      );

      expect(unwieldIndex).toBeGreaterThanOrEqual(0);
      expect(dropIndex).toBeGreaterThanOrEqual(0);
      expect(unwieldIndex).toBeLessThan(dropIndex);
    });

    it('should execute weapon drop operations before DISPATCH_PERCEPTIBLE_EVENT', () => {
      const fumbleIf = findIfByOutcome(swingAtTargetRule.actions, 'FUMBLE');
      const actions = fumbleIf.parameters.then_actions;
      const dropIndex = actions.findIndex(
        (op) => op.type === 'DROP_ITEM_AT_LOCATION'
      );
      const dispatchIndex = actions.findIndex(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(dropIndex).toBeGreaterThanOrEqual(0);
      expect(dispatchIndex).toBeGreaterThanOrEqual(0);
      expect(dropIndex).toBeLessThan(dispatchIndex);
    });
  });

  describe('Cross-Branch Consistency', () => {
    it('should NOT include UNWIELD_ITEM in SUCCESS branch', () => {
      const successIf = findIfByOutcome(swingAtTargetRule.actions, 'SUCCESS');
      const hasUnwield = successIf.parameters.then_actions.some(
        (op) => op.type === 'UNWIELD_ITEM'
      );
      expect(hasUnwield).toBe(false);
    });

    it('should NOT include DROP_ITEM_AT_LOCATION in SUCCESS branch', () => {
      const successIf = findIfByOutcome(swingAtTargetRule.actions, 'SUCCESS');
      const hasDrop = successIf.parameters.then_actions.some(
        (op) => op.type === 'DROP_ITEM_AT_LOCATION'
      );
      expect(hasDrop).toBe(false);
    });

    it('should NOT include UNWIELD_ITEM in FAILURE branch', () => {
      const failureIf = findIfByOutcome(swingAtTargetRule.actions, 'FAILURE');
      const hasUnwield = failureIf.parameters.then_actions.some(
        (op) => op.type === 'UNWIELD_ITEM'
      );
      expect(hasUnwield).toBe(false);
    });

    it('should NOT include DROP_ITEM_AT_LOCATION in FAILURE branch', () => {
      const failureIf = findIfByOutcome(swingAtTargetRule.actions, 'FAILURE');
      const hasDrop = failureIf.parameters.then_actions.some(
        (op) => op.type === 'DROP_ITEM_AT_LOCATION'
      );
      expect(hasDrop).toBe(false);
    });

    it('should NOT include UNWIELD_ITEM in CRITICAL_SUCCESS branch', () => {
      const critSuccessIf = findIfByOutcome(
        swingAtTargetRule.actions,
        'CRITICAL_SUCCESS'
      );
      const hasUnwield = critSuccessIf.parameters.then_actions.some(
        (op) => op.type === 'UNWIELD_ITEM'
      );
      expect(hasUnwield).toBe(false);
    });

    it('should NOT include DROP_ITEM_AT_LOCATION in CRITICAL_SUCCESS branch', () => {
      const critSuccessIf = findIfByOutcome(
        swingAtTargetRule.actions,
        'CRITICAL_SUCCESS'
      );
      const hasDrop = critSuccessIf.parameters.then_actions.some(
        (op) => op.type === 'DROP_ITEM_AT_LOCATION'
      );
      expect(hasDrop).toBe(false);
    });
  });
});
