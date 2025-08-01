/**
 * @file Integration tests for multi-target validation scenarios
 * Tests the complete flow from action processing to event validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../common/testBed.js';
import MultiTargetEventBuilder from '../../src/entities/multiTarget/multiTargetEventBuilder.js';
import { validateAttemptActionPayload } from '../../src/utils/multiTargetValidationUtils.js';

describe('MultiTargetValidation - Integration Tests', () => {
  let testBed;
  let logger;
  let builder;

  beforeEach(() => {
    testBed = createTestBed();
    logger = testBed.mockLogger;
    builder = new MultiTargetEventBuilder({ logger });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('End-to-End Multi-Target Flow', () => {
    it('should handle complete flow for adjust_clothing action with mixed targets', () => {
      // Simulate the exact scenario from the error logs
      const targets = {
        primary: {
          entityId: 'p_erotica:iker_aguirre_instance',
          placeholder: 'primary',
          description: 'p_erotica:iker_aguirre_instance',
          resolvedFromContext: false,
        },
        secondary: {
          entityId: 'c103dff8-bfec-49f5-adb0-2c889ec5893e',
          placeholder: 'secondary',
          description: 'c103dff8-bfec-49f5-adb0-2c889ec5893e',
          resolvedFromContext: true,
          contextSource: 'primary',
        },
      };

      // Build the event payload using MultiTargetEventBuilder
      const payload = builder
        .setActor('p_erotica:amaia_castillo_instance')
        .setAction('intimacy:adjust_clothing')
        .setOriginalInput("adjust Iker Aguirre's denim trucker jacket")
        .setTargets(targets)
        .setMetadata({
          resolvedTargetCount: 2,
          hasContextDependencies: true,
        })
        .setTimestamp(1754061900301)
        .build(); // This should not throw an error

      // Verify the payload was built successfully
      expect(payload).toBeDefined();
      expect(payload.eventName).toBe('core:attempt_action');
      expect(payload.actorId).toBe('p_erotica:amaia_castillo_instance');
      expect(payload.actionId).toBe('intimacy:adjust_clothing');
      expect(payload.targets).toEqual(targets);
      expect(payload.primaryId).toBe('p_erotica:iker_aguirre_instance');
      expect(payload.secondaryId).toBe('c103dff8-bfec-49f5-adb0-2c889ec5893e');

      // Validate the payload using the validation utilities
      const validationResult = validateAttemptActionPayload(payload);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });

    it('should handle string-only targets for legacy compatibility', () => {
      const targets = {
        primary: 'core:character_instance',
        secondary: 'items:weapon_instance',
      };

      const payload = builder
        .setActor('core:player_instance')
        .setAction('combat:attack')
        .setOriginalInput('attack with weapon')
        .setTargets(targets)
        .build();

      expect(payload.targets).toEqual(targets);
      expect(payload.primaryId).toBe('core:character_instance');
      expect(payload.secondaryId).toBe('items:weapon_instance');

      const validationResult = validateAttemptActionPayload(payload);
      expect(validationResult.isValid).toBe(true);
    });

    it('should handle mixed string and object targets', () => {
      const targets = {
        actor: 'core:player_instance', // String target
        target: 'npcs:merchant_instance', // String target
        item: {
          // Object target
          entityId: 'item-uuid-1234-5678',
          placeholder: 'item',
          description: 'traded item',
          resolvedFromContext: true,
          contextSource: 'actor',
        },
      };

      const payload = builder
        .setActor('core:player_instance')
        .setAction('social:trade')
        .setOriginalInput('trade item with merchant')
        .setTargets(targets)
        .build();

      expect(payload.targets).toEqual(targets);
      expect(payload.targetId).toBe('npcs:merchant_instance'); // 'target' has higher priority than 'actor'

      const validationResult = validateAttemptActionPayload(payload);
      expect(validationResult.isValid).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('should detect invalid object targets during build', () => {
      const invalidTargets = {
        primary: {
          // Missing entityId
          placeholder: 'primary',
          description: 'invalid target',
        },
      };

      expect(() => {
        builder
          .setActor('test:actor')
          .setAction('test:action')
          .setOriginalInput('test')
          .setTargets(invalidTargets)
          .build(); // Should throw due to validation
      }).toThrow();
    });

    it('should detect validation errors in mixed target payload', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'test:actor',
        actionId: 'test:action',
        originalInput: 'test',
        targets: {
          valid_string: 'test:valid_target',
          invalid_object: {
            // Missing required entityId
            placeholder: 'invalid',
          },
        },
        targetId: 'test:valid_target',
      };

      const validationResult = validateAttemptActionPayload(payload);
      expect(validationResult.isValid).toBe(false);
      expect(
        validationResult.errors.some(
          (err) => err.includes('invalid_object') && err.includes('entityId')
        )
      ).toBe(true);
    });

    it('should detect empty string targets', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'test:actor',
        actionId: 'test:action',
        originalInput: 'test',
        targets: {
          empty_target: '', // Empty string should fail
        },
        targetId: 'test',
      };

      const validationResult = validateAttemptActionPayload(payload);
      expect(validationResult.isValid).toBe(false);
      expect(
        validationResult.errors.some(
          (err) => err.includes('empty_target') && err.includes('empty')
        )
      ).toBe(true);
    });
  });

  describe('UUID Format Support', () => {
    it('should support various UUID formats in object targets', () => {
      const uuidFormats = [
        'c103dff8-bfec-49f5-adb0-2c889ec5893e', // Standard UUID
        'runtime-entity-12345', // Custom format with hyphens
        'uuid_with_underscores_123', // Underscores
        'simple123', // Simple format
        'UPPERCASE-UUID-456', // Mixed case
      ];

      uuidFormats.forEach((uuid, index) => {
        const targets = {
          test: {
            entityId: uuid,
            placeholder: 'test',
            description: `UUID format test ${index}`,
          },
        };

        const payload = builder
          .reset()
          .setActor('test:actor')
          .setAction('test:action')
          .setOriginalInput(`test ${index}`)
          .setTargets(targets)
          .build();

        expect(payload.targets.test.entityId).toBe(uuid);

        const validationResult = validateAttemptActionPayload(payload);
        expect(validationResult.isValid).toBe(true);
      });
    });

    it('should support UUIDs in string targets', () => {
      const uuid = 'runtime-uuid-abcd-1234-efgh';

      const payload = builder
        .setActor('test:actor')
        .setAction('test:action')
        .setOriginalInput('test uuid string target')
        .setTargets({ target: uuid })
        .build();

      expect(payload.targets.target).toBe(uuid);
      expect(payload.targetId).toBe(uuid);

      const validationResult = validateAttemptActionPayload(payload);
      expect(validationResult.isValid).toBe(true);
    });
  });

  describe('Legacy Compatibility', () => {
    it('should maintain compatibility with legacy single-target actions', () => {
      const payload = builder
        .setActor('core:player_instance')
        .setAction('core:examine')
        .setOriginalInput('examine item')
        .setLegacyTarget('items:sword_instance')
        .build();

      expect(payload.targetId).toBe('items:sword_instance');
      expect(payload.targets).toBeUndefined(); // Legacy format should not have targets object

      const validationResult = validateAttemptActionPayload(payload);
      expect(validationResult.isValid).toBe(true);
    });

    it('should handle null legacy targets', () => {
      const payload = builder
        .setActor('core:player_instance')
        .setAction('core:wait')
        .setOriginalInput('wait')
        .setLegacyTarget(null)
        .build();

      expect(payload.targetId).toBeNull();
      expect(payload.primaryId).toBeNull();
      expect(payload.secondaryId).toBeNull();
      expect(payload.tertiaryId).toBeNull();

      const validationResult = validateAttemptActionPayload(payload);
      expect(validationResult.isValid).toBe(true);
    });
  });
});
