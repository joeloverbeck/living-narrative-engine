/**
 * @file Test suite to verify that the attempt_action schema correctly handles both string and object targets
 * This test addresses the multi-target validation issue where runtime UUIDs create object targets
 * while namespaced entities use string targets.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('AttemptActionSchemaFixVerification', () => {
  let ajv;
  let eventSchema;
  let commonSchema;
  let validate;

  beforeEach(() => {
    // Set up AJV with schema validation
    ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);

    // Load schemas
    const eventSchemaPath = resolve(
      'data/mods/core/events/attempt_action.event.json'
    );
    const commonSchemaPath = resolve('data/schemas/common.schema.json');

    eventSchema = JSON.parse(readFileSync(eventSchemaPath, 'utf8'));
    commonSchema = JSON.parse(readFileSync(commonSchemaPath, 'utf8'));

    // Add common schema
    ajv.addSchema(
      commonSchema,
      'schema://living-narrative-engine/common.schema.json'
    );

    // Compile validator for the event payload schema
    validate = ajv.compile(eventSchema.payloadSchema);
  });

  describe('String Target Validation (Legacy/Namespaced Entities)', () => {
    it('should validate payload with string-only targets', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player_instance',
        actionId: 'intimacy:adjust_clothing',
        originalInput: 'adjust clothing',
        targets: {
          primary: 'p_erotica:iker_aguirre_instance',
          secondary: 'clothing:shirt_instance',
        },
        targetId: 'p_erotica:iker_aguirre_instance',
        primaryId: 'p_erotica:iker_aguirre_instance',
        secondaryId: 'clothing:shirt_instance',
        tertiaryId: null,
        timestamp: Date.now(),
        resolvedTargetCount: 2,
        hasContextDependencies: false,
      };

      const valid = validate(payload);
      expect(valid).toBe(true);

      if (!valid) {
        console.log('Validation errors:', validate.errors);
      }
    });

    it('should validate legacy single target format', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player_instance',
        actionId: 'core:examine',
        originalInput: 'examine item',
        targetId: 'core:item_instance',
        timestamp: Date.now(),
      };

      const valid = validate(payload);
      expect(valid).toBe(true);
    });
  });

  describe('Object Target Validation (Runtime/UUID Entities)', () => {
    it('should validate payload with object targets containing runtime UUIDs', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'p_erotica:amaia_castillo_instance',
        actionId: 'intimacy:adjust_clothing',
        originalInput: "adjust Iker Aguirre's denim trucker jacket",
        targets: {
          primary: 'p_erotica:iker_aguirre_instance',
          secondary: {
            entityId: 'c103dff8-bfec-49f5-adb0-2c889ec5893e',
            placeholder: 'secondary',
            description: 'c103dff8-bfec-49f5-adb0-2c889ec5893e',
            resolvedFromContext: true,
            contextSource: 'primary',
          },
        },
        targetId: 'p_erotica:iker_aguirre_instance',
        primaryId: 'p_erotica:iker_aguirre_instance',
        secondaryId: 'c103dff8-bfec-49f5-adb0-2c889ec5893e',
        tertiaryId: null,
        timestamp: Date.now(),
        resolvedTargetCount: 2,
        hasContextDependencies: true,
      };

      const valid = validate(payload);
      expect(valid).toBe(true);

      if (!valid) {
        console.log('Validation errors:', validate.errors);
      }
    });

    it('should validate object target with minimal required properties', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player_instance',
        actionId: 'core:use',
        originalInput: 'use item',
        targets: {
          item: {
            entityId: 'abcd-1234-uuid-5678-efgh',
          },
        },
        targetId: 'abcd-1234-uuid-5678-efgh',
        primaryId: null,
        secondaryId: null,
        tertiaryId: null,
        timestamp: Date.now(),
        resolvedTargetCount: 1,
        hasContextDependencies: false,
      };

      const valid = validate(payload);
      expect(valid).toBe(true);
    });

    it('should reject object target missing required entityId', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player_instance',
        actionId: 'core:use',
        originalInput: 'use item',
        targets: {
          item: {
            placeholder: 'item',
            description: 'some item',
            // Missing entityId
          },
        },
        targetId: 'test',
        timestamp: Date.now(),
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(
        validate.errors.some(
          (err) =>
            err.instancePath.includes('/targets/item') &&
            err.message.includes('required')
        )
      ).toBe(true);
    });

    it('should reject object target with additional properties', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player_instance',
        actionId: 'core:use',
        originalInput: 'use item',
        targets: {
          item: {
            entityId: 'uuid-1234',
            invalidProperty: 'this should not be allowed',
          },
        },
        targetId: 'uuid-1234',
        timestamp: Date.now(),
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(
        validate.errors.some((err) => err.keyword === 'additionalProperties')
      ).toBe(true);
    });
  });

  describe('Mixed Target Validation', () => {
    it('should validate payload with mixed string and object targets', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player_instance',
        actionId: 'combat:attack_with_weapon',
        originalInput: 'attack goblin with sword',
        targets: {
          target: 'enemies:goblin_instance', // String target
          weapon: {
            entityId: 'weapon-uuid-1234-5678',
            placeholder: 'weapon',
            description: 'iron sword',
            resolvedFromContext: false,
          }, // Object target
        },
        targetId: 'enemies:goblin_instance',
        primaryId: null,
        secondaryId: null,
        tertiaryId: null,
        timestamp: Date.now(),
        resolvedTargetCount: 2,
        hasContextDependencies: false,
      };

      const valid = validate(payload);
      expect(valid).toBe(true);
    });

    it('should validate complex multi-target action with multiple object targets', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player_instance',
        actionId: 'crafting:combine_items',
        originalInput: 'combine items',
        targets: {
          primary: {
            entityId: 'material-uuid-1',
            placeholder: 'primary',
            description: 'iron ore',
          },
          secondary: {
            entityId: 'material-uuid-2',
            placeholder: 'secondary',
            description: 'coal',
          },
          tool: 'crafting:forge_instance', // String target mixed in
        },
        targetId: 'material-uuid-1',
        primaryId: 'material-uuid-1',
        secondaryId: 'material-uuid-2',
        tertiaryId: null,
        timestamp: Date.now(),
        resolvedTargetCount: 3,
        hasContextDependencies: true,
      };

      const valid = validate(payload);
      expect(valid).toBe(true);
    });
  });

  describe('Edge Cases and Validation Boundaries', () => {
    it('should reject empty string in target object entityId', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player_instance',
        actionId: 'core:test',
        originalInput: 'test',
        targets: {
          test: {
            entityId: '', // Empty string should be rejected
          },
        },
        targetId: 'test',
        timestamp: Date.now(),
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
    });

    it('should reject empty string as direct target value', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'core:player_instance',
        actionId: 'core:test',
        originalInput: 'test',
        targets: {
          test: '', // Empty string should be rejected
        },
        targetId: 'test',
        timestamp: Date.now(),
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
    });

    it('should validate UUID format in object targets', () => {
      const uuidFormats = [
        'c103dff8-bfec-49f5-adb0-2c889ec5893e', // Standard UUID
        'uuid-with-custom-format-123456', // Custom UUID format
        'simple_uuid_123', // Simple format
        'CAPS-UUID-FORMAT-456', // Uppercase format
      ];

      uuidFormats.forEach((uuid) => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'core:player_instance',
          actionId: 'core:test',
          originalInput: 'test',
          targets: {
            test: {
              entityId: uuid,
            },
          },
          targetId: uuid,
          timestamp: Date.now(),
        };

        const valid = validate(payload);
        expect(valid).toBe(true);
      });
    });
  });

  describe('Real-World Scenario: Adjust Clothing Action', () => {
    it('should validate the exact payload that was failing in production', () => {
      // This is the exact payload from the error logs that was failing
      const payload = {
        eventName: 'core:attempt_action',
        timestamp: 1754061900301,
        actorId: 'p_erotica:amaia_castillo_instance',
        actionId: 'intimacy:adjust_clothing',
        originalInput: "adjust Iker Aguirre's denim trucker jacket",
        targets: {
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
        },
        primaryId: 'p_erotica:iker_aguirre_instance',
        secondaryId: 'c103dff8-bfec-49f5-adb0-2c889ec5893e',
        tertiaryId: null,
        targetId: 'p_erotica:iker_aguirre_instance',
        resolvedTargetCount: 2,
        hasContextDependencies: true,
      };

      const valid = validate(payload);
      expect(valid).toBe(true);

      if (!valid) {
        console.log(
          'Validation errors for production payload:',
          JSON.stringify(validate.errors, null, 2)
        );
      }
    });
  });
});
