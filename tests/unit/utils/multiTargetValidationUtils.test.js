/**
 * @file Tests for multi-target validation utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  isValidTargetName,
  isValidEntityId,
  determinePrimaryTarget,
  validateTargetValue,
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
      expect(isValidEntityId('entity.123')).toBe(false); // Contains dot
      expect(isValidEntityId('entity@123')).toBe(false); // Contains special char
      expect(isValidEntityId('entity 123')).toBe(false); // Contains space
      expect(isValidEntityId('entity#123')).toBe(false); // Contains hash
    });

    it('should accept UUID formats with hyphens', () => {
      expect(isValidEntityId('entity-123')).toBe(true); // UUID-style with hyphen
      expect(isValidEntityId('c103dff8-bfec-49f5-adb0-2c889ec5893e')).toBe(
        true
      ); // Standard UUID
      expect(isValidEntityId('runtime-uuid-1234')).toBe(true); // Custom UUID format
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

    it('should handle object targets with entityId in priority positions', () => {
      const targets = {
        item: 'knife_123',
        primary: { entityId: 'sword_456', placeholder: 'Primary Weapon' },
        target: 'goblin_789',
      };

      expect(determinePrimaryTarget(targets)).toBe('sword_456');
    });

    it('should handle object targets with entityId as first target fallback', () => {
      const targets = {
        weapon: { entityId: 'sword_456', description: 'A sharp blade' },
        tool: 'hammer_789',
      };

      expect(determinePrimaryTarget(targets)).toBe('sword_456');
    });

    it('should handle mixed string and object targets', () => {
      const targets = {
        actor: { entityId: 'player_123' },
        item: 'knife_456',
        target: { entityId: 'goblin_789', resolvedFromContext: true },
      };

      expect(determinePrimaryTarget(targets)).toBe('goblin_789'); // target has priority
    });

    it('should return null for object target without entityId', () => {
      const targets = {
        primary: { description: 'Missing entityId' },
        item: { placeholder: 'Also missing entityId' },
      };

      expect(determinePrimaryTarget(targets)).toBe(null);
    });

    it('should handle object targets with all optional properties', () => {
      const targets = {
        primary: {
          entityId: 'complex_target_123',
          placeholder: 'Select target',
          description: 'A complex target object',
          resolvedFromContext: true,
          contextSource: 'player_inventory',
        },
      };

      expect(determinePrimaryTarget(targets)).toBe('complex_target_123');
    });
  });

  describe('validateTargetValue', () => {
    describe('null/undefined targets', () => {
      it('should reject null target', () => {
        const result = validateTargetValue(null, 'primary');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('primary target is required');
      });

      it('should reject undefined target', () => {
        const result = validateTargetValue(undefined, 'weapon');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('weapon target is required');
      });

      it('should reject false/0/empty as falsy', () => {
        expect(validateTargetValue(false, 'test').isValid).toBe(false);
        expect(validateTargetValue(0, 'test').isValid).toBe(false);
        expect(validateTargetValue('', 'test').isValid).toBe(false);
      });
    });

    describe('string target validation', () => {
      it('should accept valid string targets', () => {
        const result = validateTargetValue('goblin_123', 'target');
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject empty string targets', () => {
        const result = validateTargetValue('   ', 'target');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('target target cannot be empty string');
      });

      it('should reject string targets with invalid entity ID format', () => {
        const result = validateTargetValue('invalid@entity', 'weapon');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('weapon target has invalid entity ID format');
      });
    });

    describe('object target validation', () => {
      it('should accept valid object targets', () => {
        const target = { entityId: 'sword_123' };
        const result = validateTargetValue(target, 'weapon');
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject object without entityId', () => {
        const target = { description: 'Missing entityId' };
        const result = validateTargetValue(target, 'item');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('item target object must have entityId property');
      });

      it('should reject object with non-string entityId', () => {
        const target = { entityId: 123 };
        const result = validateTargetValue(target, 'target');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('target target entityId must be a string');
      });

      it('should reject object with empty entityId', () => {
        const target = { entityId: '   ' };
        const result = validateTargetValue(target, 'primary');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('primary target entityId cannot be empty');
      });

      it('should reject object with invalid entityId format', () => {
        const target = { entityId: 'invalid@entity' };
        const result = validateTargetValue(target, 'weapon');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('weapon target entityId has invalid format');
      });

      describe('optional property validation', () => {
        it('should accept valid optional properties', () => {
          const target = {
            entityId: 'sword_123',
            placeholder: 'Select weapon',
            description: 'A sharp blade',
            resolvedFromContext: true,
            contextSource: 'inventory',
          };
          const result = validateTargetValue(target, 'weapon');
          
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        });

        it('should reject non-string placeholder', () => {
          const target = { entityId: 'sword_123', placeholder: 123 };
          const result = validateTargetValue(target, 'weapon');
          
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('weapon target placeholder must be a string');
        });

        it('should reject non-string description', () => {
          const target = { entityId: 'sword_123', description: true };
          const result = validateTargetValue(target, 'item');
          
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('item target description must be a string');
        });

        it('should reject non-boolean resolvedFromContext', () => {
          const target = { entityId: 'sword_123', resolvedFromContext: 'true' };
          const result = validateTargetValue(target, 'target');
          
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('target target resolvedFromContext must be a boolean');
        });

        it('should reject non-string contextSource', () => {
          const target = { entityId: 'sword_123', contextSource: 456 };
          const result = validateTargetValue(target, 'primary');
          
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('primary target contextSource must be a string');
        });

        it('should accept undefined optional properties', () => {
          const target = {
            entityId: 'sword_123',
            placeholder: undefined,
            description: undefined,
            resolvedFromContext: undefined,
            contextSource: undefined,
          };
          const result = validateTargetValue(target, 'weapon');
          
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        });
      });
    });

    describe('invalid target types', () => {
      it('should reject numeric targets', () => {
        const result = validateTargetValue(123, 'target');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('target target must be a string or object');
      });

      it('should reject array targets', () => {
        const result = validateTargetValue(['entity_123'], 'item');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('item target object must have entityId property');
      });

      it('should reject function targets', () => {
        const result = validateTargetValue(() => 'entity', 'weapon');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('weapon target must be a string or object');
      });
    });

    describe('multiple validation errors', () => {
      it('should collect all object validation errors', () => {
        const target = {
          entityId: 123, // Wrong type
          placeholder: false, // Wrong type
          description: [], // Wrong type
          resolvedFromContext: 'invalid', // Wrong type
          contextSource: {}, // Wrong type
        };
        const result = validateTargetValue(target, 'complex');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(5);
        expect(result.errors).toContain('complex target entityId must be a string');
        expect(result.errors).toContain('complex target placeholder must be a string');
        expect(result.errors).toContain('complex target description must be a string');
        expect(result.errors).toContain('complex target resolvedFromContext must be a boolean');
        expect(result.errors).toContain('complex target contextSource must be a string');
      });
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

    it('should reject zero targetId as invalid', () => {
      const zeroTargetPayload = {
        ...validBasePayload,
        targetId: 0, // Not a valid string entity ID
      };

      const result = validateAttemptActionPayload(zeroTargetPayload);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('targetId has invalid entity ID format');
    });

    it('should reject empty string targetId as invalid', () => {
      const emptyStringTargetPayload = {
        ...validBasePayload,
        targetId: '', // Empty string is not valid
      };

      const result = validateAttemptActionPayload(emptyStringTargetPayload);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('targetId has invalid entity ID format');
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

    it('should collect target validation errors from validateTargetValue', () => {
      const payloadWithInvalidTargets = {
        actorId: 'player_123',
        actionId: 'custom:action',
        originalInput: 'complex action with invalid targets',
        targets: {
          weapon: '   ', // Empty string target
          target: { description: 'Missing entityId' }, // Object without entityId
          item: 123, // Invalid target type
          defense: { entityId: 'invalid@entity' }, // Invalid entityId format
        },
      };

      const result = validateAttemptActionPayload(payloadWithInvalidTargets);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('weapon target cannot be empty string');
      expect(result.errors).toContain('target target object must have entityId property');
      expect(result.errors).toContain('item target must be a string or object');
      expect(result.errors).toContain('defense target entityId has invalid format');
    });

    it('should validate targets with complex object validation errors', () => {
      const payloadWithComplexInvalidTargets = {
        actorId: 'player_123',
        actionId: 'custom:action',
        originalInput: 'action with complex invalid targets',
        targets: {
          primary: {
            entityId: 123, // Wrong type
            placeholder: false, // Wrong type
            description: [], // Wrong type
          },
          weapon: null, // Null target
        },
      };

      const result = validateAttemptActionPayload(payloadWithComplexInvalidTargets);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('primary target entityId must be a string');
      expect(result.errors).toContain('primary target placeholder must be a string');
      expect(result.errors).toContain('primary target description must be a string');
      expect(result.errors).toContain('weapon target is required');
    });
  });
});
