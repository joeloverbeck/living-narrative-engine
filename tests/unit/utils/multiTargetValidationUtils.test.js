/**
 * @file Tests for multi-target validation utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  isValidTargetName,
  isValidEntityId,
  determinePrimaryTarget,
  validateAttemptActionPayload,
} from '../../../src/utils/multiTargetValidationUtils.js';

describe('multiTargetValidationUtils', () => {
  describe('isValidTargetName', () => {
    it('should validate correct target names', () => {
      expect(isValidTargetName('target')).toBe(true);
      expect(isValidTargetName('primary')).toBe(true);
      expect(isValidTargetName('item')).toBe(true);
      expect(isValidTargetName('weapon')).toBe(true);
      expect(isValidTargetName('myTarget')).toBe(true);
      expect(isValidTargetName('target_123')).toBe(true);
      expect(isValidTargetName('primaryTarget')).toBe(true);
    });

    it('should reject invalid target names', () => {
      expect(isValidTargetName('')).toBe(false);
      expect(isValidTargetName(null)).toBe(false);
      expect(isValidTargetName(undefined)).toBe(false);
      expect(isValidTargetName('123target')).toBe(false); // Starts with number
      expect(isValidTargetName('target-123')).toBe(false); // Contains hyphen
      expect(isValidTargetName('target.123')).toBe(false); // Contains dot
      expect(isValidTargetName('target@123')).toBe(false); // Contains special char
      expect(isValidTargetName('target 123')).toBe(false); // Contains space
    });

    it('should handle edge cases', () => {
      expect(isValidTargetName('a')).toBe(true); // Single character
      expect(isValidTargetName('_')).toBe(false); // Starts with underscore
      expect(isValidTargetName('target_')).toBe(true); // Ends with underscore
      expect(isValidTargetName('TARGET')).toBe(true); // All caps
    });
  });

  describe('isValidEntityId', () => {
    it('should validate correct entity IDs', () => {
      expect(isValidEntityId('entity_123')).toBe(true);
      expect(isValidEntityId('core:actor')).toBe(true);
      expect(isValidEntityId('mod_name:entity_type_123')).toBe(true);
      expect(isValidEntityId('goblin456')).toBe(true);
      expect(isValidEntityId('player_character')).toBe(true);
      expect(isValidEntityId('namespace:subnamespace:entity')).toBe(true);
    });

    it('should reject invalid entity IDs', () => {
      expect(isValidEntityId('')).toBe(false);
      expect(isValidEntityId(null)).toBe(false);
      expect(isValidEntityId(undefined)).toBe(false);
      expect(isValidEntityId('entity-123')).toBe(false); // Contains hyphen
      expect(isValidEntityId('entity.123')).toBe(false); // Contains dot
      expect(isValidEntityId('entity@123')).toBe(false); // Contains special char
      expect(isValidEntityId('entity 123')).toBe(false); // Contains space
      expect(isValidEntityId('entity#123')).toBe(false); // Contains hash
    });

    it('should handle edge cases', () => {
      expect(isValidEntityId('a')).toBe(true); // Single character
      expect(isValidEntityId('123')).toBe(true); // All numbers
      expect(isValidEntityId('_')).toBe(true); // Single underscore
      expect(isValidEntityId(':')).toBe(true); // Single colon
      expect(isValidEntityId('ENTITY')).toBe(true); // All caps
    });
  });

  describe('determinePrimaryTarget', () => {
    it('should prioritize "primary" target', () => {
      const targets = {
        item: 'knife_123',
        primary: 'sword_456',
        target: 'goblin_789',
      };

      expect(determinePrimaryTarget(targets)).toBe('sword_456');
    });

    it('should prioritize "target" when no "primary"', () => {
      const targets = {
        item: 'knife_123',
        target: 'goblin_456',
        weapon: 'sword_789',
      };

      expect(determinePrimaryTarget(targets)).toBe('goblin_456');
    });

    it('should prioritize "self" when no "primary" or "target"', () => {
      const targets = {
        item: 'knife_123',
        self: 'player_456',
        weapon: 'sword_789',
      };

      expect(determinePrimaryTarget(targets)).toBe('player_456');
    });

    it('should prioritize "actor" when no higher priority targets', () => {
      const targets = {
        item: 'knife_123',
        actor: 'player_456',
        weapon: 'sword_789',
      };

      expect(determinePrimaryTarget(targets)).toBe('player_456');
    });

    it('should return first target when no priority matches', () => {
      const targets = {
        item: 'knife_123',
        weapon: 'sword_456',
        tool: 'hammer_789',
      };

      expect(determinePrimaryTarget(targets)).toBe('knife_123');
    });

    it('should handle single target', () => {
      const targets = { item: 'knife_123' };

      expect(determinePrimaryTarget(targets)).toBe('knife_123');
    });

    it('should handle edge cases', () => {
      expect(determinePrimaryTarget(null)).toBe(null);
      expect(determinePrimaryTarget(undefined)).toBe(null);
      expect(determinePrimaryTarget({})).toBe(null);
      expect(determinePrimaryTarget('invalid')).toBe(null);
      expect(determinePrimaryTarget([])).toBe(null);
    });

    it('should follow complete priority order', () => {
      // Test full priority chain
      const fullTargets = {
        item: 'knife_123',
        weapon: 'sword_456',
        tool: 'hammer_789',
        actor: 'player_101',
        self: 'player_202',
        target: 'goblin_303',
        primary: 'boss_404',
      };

      expect(determinePrimaryTarget(fullTargets)).toBe('boss_404');

      // Remove primary
      delete fullTargets.primary;
      expect(determinePrimaryTarget(fullTargets)).toBe('goblin_303');

      // Remove target
      delete fullTargets.target;
      expect(determinePrimaryTarget(fullTargets)).toBe('player_202');

      // Remove self
      delete fullTargets.self;
      expect(determinePrimaryTarget(fullTargets)).toBe('player_101');

      // Remove actor
      delete fullTargets.actor;
      expect(determinePrimaryTarget(fullTargets)).toBe('knife_123'); // First remaining
    });
  });

  describe('validateAttemptActionPayload', () => {
    const validBasePayload = {
      actorId: 'actor_123',
      actionId: 'core:attack',
      originalInput: 'attack goblin',
      targetId: 'goblin_456',
    };

    it('should validate complete payload', () => {
      const result = validateAttemptActionPayload(validBasePayload);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details.hasMultipleTargets).toBe(false);
      expect(result.details.targetCount).toBe(1);
      expect(result.details.primaryTarget).toBe('goblin_456');
    });

    it('should validate multi-target payload', () => {
      const multiTargetPayload = {
        ...validBasePayload,
        targets: {
          item: 'sword_123',
          target: 'goblin_456',
        },
      };

      const result = validateAttemptActionPayload(multiTargetPayload);

      expect(result.isValid).toBe(true);
      expect(result.details.hasMultipleTargets).toBe(true);
      expect(result.details.targetCount).toBe(2);
      expect(result.details.primaryTarget).toBe('goblin_456');
    });

    it('should handle null/undefined payload', () => {
      expect(validateAttemptActionPayload(null)).toEqual({
        isValid: false,
        errors: ['Payload is required'],
        warnings: [],
        details: {},
      });

      expect(validateAttemptActionPayload(undefined)).toEqual({
        isValid: false,
        errors: ['Payload is required'],
        warnings: [],
        details: {},
      });
    });

    it('should detect missing required fields', () => {
      const incompletePayload = {
        actorId: 'actor_123',
        // Missing actionId and originalInput
        targetId: 'goblin_456',
      };

      const result = validateAttemptActionPayload(incompletePayload);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('actionId is required');
      expect(result.errors).toContain('originalInput is required');
    });

    it('should detect missing targets', () => {
      const noTargetsPayload = {
        actorId: 'actor_123',
        actionId: 'core:attack',
        originalInput: 'attack',
        // No targetId or targets
      };

      const result = validateAttemptActionPayload(noTargetsPayload);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Either targets object or targetId must be provided'
      );
    });

    it('should warn about target inconsistency', () => {
      const inconsistentPayload = {
        ...validBasePayload,
        targets: {
          primary: 'sword_123', // Primary target in targets
        },
        targetId: 'goblin_456', // Different targetId
      };

      const result = validateAttemptActionPayload(inconsistentPayload);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'targetId does not match determined primary target'
      );
    });

    it('should handle empty targets object', () => {
      const emptyTargetsPayload = {
        ...validBasePayload,
        targets: {},
      };

      const result = validateAttemptActionPayload(emptyTargetsPayload);

      expect(result.isValid).toBe(true);
      expect(result.details.hasMultipleTargets).toBe(false);
      expect(result.details.targetCount).toBe(1);
      expect(result.details.primaryTarget).toBe('goblin_456');
    });

    it('should handle targets-only payload', () => {
      const targetsOnlyPayload = {
        actorId: 'actor_123',
        actionId: 'core:attack',
        originalInput: 'attack',
        targets: {
          primary: 'sword_123',
          target: 'goblin_456',
        },
        // No targetId
      };

      const result = validateAttemptActionPayload(targetsOnlyPayload);

      expect(result.isValid).toBe(true);
      expect(result.details.hasMultipleTargets).toBe(true);
      expect(result.details.targetCount).toBe(2);
      expect(result.details.primaryTarget).toBe('sword_123');
    });

    it('should detect all missing required fields', () => {
      const emptyPayload = {};

      const result = validateAttemptActionPayload(emptyPayload);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('actorId is required');
      expect(result.errors).toContain('actionId is required');
      expect(result.errors).toContain('originalInput is required');
      expect(result.errors).toContain(
        'Either targets object or targetId must be provided'
      );
    });

    it('should handle edge case with zero targetId', () => {
      const zeroTargetPayload = {
        ...validBasePayload,
        targetId: 0, // Falsy but valid
      };

      const result = validateAttemptActionPayload(zeroTargetPayload);

      expect(result.isValid).toBe(true);
      expect(result.details.primaryTarget).toBe(0);
    });

    it('should handle edge case with empty string targetId', () => {
      const emptyStringTargetPayload = {
        ...validBasePayload,
        targetId: '', // Falsy but defined
      };

      const result = validateAttemptActionPayload(emptyStringTargetPayload);

      expect(result.isValid).toBe(true);
      expect(result.details.primaryTarget).toBe('');
    });

    it('should handle complex multi-target scenario', () => {
      const complexPayload = {
        actorId: 'player_123',
        actionId: 'custom:complex_action',
        originalInput: 'use sword to attack goblin and shield to defend',
        targets: {
          weapon: 'sword_456',
          target: 'goblin_789',
          defense: 'shield_101',
          primary: 'main_target_202',
        },
        targetId: 'main_target_202',
      };

      const result = validateAttemptActionPayload(complexPayload);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.details.hasMultipleTargets).toBe(true);
      expect(result.details.targetCount).toBe(4);
      expect(result.details.primaryTarget).toBe('main_target_202');
    });
  });
});
