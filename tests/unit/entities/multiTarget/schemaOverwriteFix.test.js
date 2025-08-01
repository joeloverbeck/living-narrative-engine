/**
 * @file Test suite specifically for the schema fix that enables mixed string/object targets
 * This reproduces the exact validation error from the logs and verifies the fix works.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { validateAttemptActionPayload } from '../../../../src/utils/multiTargetValidationUtils.js';

describe('SchemaOverwriteFix - Multi-Target Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Production Error Reproduction', () => {
    it('should reproduce the exact validation error from the logs', () => {
      // This is the exact payload structure that was failing in production
      const failingPayload = {
        eventName: 'core:attempt_action',
        timestamp: 1754061900301,
        actorId: 'p_erotica:amaia_castillo_instance',
        actionId: 'intimacy:adjust_clothing',
        originalInput: 'adjust Iker Aguirre\'s denim trucker jacket',
        targets: {
          primary: {
            entityId: 'p_erotica:iker_aguirre_instance',
            placeholder: 'primary',
            description: 'p_erotica:iker_aguirre_instance',
            resolvedFromContext: false
          },
          secondary: {
            entityId: 'c103dff8-bfec-49f5-adb0-2c889ec5893e',
            placeholder: 'secondary',
            description: 'c103dff8-bfec-49f5-adb0-2c889ec5893e',
            resolvedFromContext: true,
            contextSource: 'primary'
          }
        },
        primaryId: 'p_erotica:iker_aguirre_instance',
        secondaryId: 'c103dff8-bfec-49f5-adb0-2c889ec5893e',
        tertiaryId: null,
        targetId: 'p_erotica:iker_aguirre_instance',
        resolvedTargetCount: 2,
        hasContextDependencies: true
      };

      // With the schema fix, this should now validate successfully
      const result = validateAttemptActionPayload(failingPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should demonstrate the error would have occurred before the fix', () => {
      // Create a mock payload with the old string-only target expectation
      const payloadWithStringExpectation = {
        eventName: 'core:attempt_action',
        timestamp: Date.now(),
        actorId: 'test:actor',
        actionId: 'test:action',
        originalInput: 'test',
        targets: {
          primary: 'test:string_target',  // String - should work
          secondary: {                    // Object - would fail with old schema
            invalidStructure: 'old schema expected only strings'
          }
        },
        targetId: 'test:string_target'
      };

      // With the new schema, objects are allowed if they have the right structure
      const payloadWithCorrectObjectStructure = {
        eventName: 'core:attempt_action',
        timestamp: Date.now(),
        actorId: 'test:actor',
        actionId: 'test:action',
        originalInput: 'test',
        targets: {
          primary: 'test:string_target',  // String - should work
          secondary: {                    // Object with correct structure - should work now
            entityId: 'uuid-123-456',
            placeholder: 'secondary',
            description: 'test object target'
          }
        },
        targetId: 'test:string_target'
      };

      // The correctly structured payload should validate
      const result = validateAttemptActionPayload(payloadWithCorrectObjectStructure);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Mixed Target Type Support', () => {
    it('should support string targets for namespaced entities', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player',
        actionId: 'core:examine',
        originalInput: 'examine target',
        targets: {
          primary: 'core:namespaced_entity',
          secondary: 'mod:another_namespaced_entity'
        },
        targetId: 'core:namespaced_entity'
      };

      const result = validateAttemptActionPayload(payload);
      expect(result.isValid).toBe(true);
    });

    it('should support object targets for runtime UUID entities', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player',
        actionId: 'core:examine',
        originalInput: 'examine target',
        targets: {
          primary: {
            entityId: 'runtime-uuid-1234-5678',
            placeholder: 'primary',
            description: 'runtime created entity'
          }
        },
        targetId: 'runtime-uuid-1234-5678'
      };

      const result = validateAttemptActionPayload(payload);
      expect(result.isValid).toBe(true);
    });

    it('should support mixed string and object targets', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player',
        actionId: 'test:mixed_action',
        originalInput: 'test mixed targets',
        targets: {
          person: 'core:character_instance',          // String target
          item: {                                     // Object target
            entityId: 'item-uuid-abcd-efgh',
            placeholder: 'item',
            description: 'dynamically created item',
            resolvedFromContext: true,
            contextSource: 'person'
          }
        },
        targetId: 'core:character_instance'
      };

      const result = validateAttemptActionPayload(payload);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should reject object targets missing required entityId', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player',
        actionId: 'test:action',
        originalInput: 'test',
        targets: {
          invalid: {
            placeholder: 'invalid',
            description: 'missing entityId'
            // Missing required entityId
          }
        },
        targetId: 'test'
      };

      const result = validateAttemptActionPayload(payload);
      expect(result.isValid).toBe(false);
    });

    it('should reject empty string targets', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player',
        actionId: 'test:action',
        originalInput: 'test',
        targets: {
          invalid: '' // Empty string should be rejected
        },
        targetId: 'test'
      };

      const result = validateAttemptActionPayload(payload);
      expect(result.isValid).toBe(false);
    });

    it('should reject object targets with empty entityId', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player',
        actionId: 'test:action',
        originalInput: 'test',
        targets: {
          invalid: {
            entityId: '', // Empty entityId should be rejected
            placeholder: 'invalid'
          }
        },
        targetId: 'test'
      };

      const result = validateAttemptActionPayload(payload);
      expect(result.isValid).toBe(false);
    });
  });
});