import { describe, it, expect, beforeAll } from '@jest/globals';
import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';

describe('core:attempt_action Event Schema Validation', () => {
  let ajv;
  let validate;
  let attemptActionEvent;

  beforeAll(() => {
    // Load the event definition
    const eventPath = path.join(
      process.cwd(),
      'data/mods/core/events/attempt_action.event.json'
    );
    attemptActionEvent = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));

    // Setup AJV with the schema (non-strict mode for anyOf patterns)
    ajv = new Ajv({ strict: false, allErrors: true });

    // Add common schema for reference resolution
    const commonSchemaPath = path.join(
      process.cwd(),
      'data/schemas/common.schema.json'
    );
    const commonSchema = JSON.parse(fs.readFileSync(commonSchemaPath, 'utf-8'));
    ajv.addSchema(commonSchema, commonSchema.$id);

    validate = ajv.compile(attemptActionEvent.payloadSchema);
  });

  describe('Valid payloads - Legacy single-target events', () => {
    it('should accept legacy single-target event without timestamp', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice',
      };

      const valid = validate(payload);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept legacy single-target event with timestamp', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targetId: 'target_456',
        originalInput: 'follow Alice',
        timestamp: 1640995200000,
      };

      const valid = validate(payload);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept legacy single-target event with null targetId', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:look',
        targetId: null,
        originalInput: 'look around',
      };

      const valid = validate(payload);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('Valid payloads - Multi-target events', () => {
    it('should accept multi-target event with item and target', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'combat:throw',
        targets: {
          item: 'knife_789',
          target: 'goblin_012',
        },
        targetId: 'knife_789',
        originalInput: 'throw knife at goblin',
        timestamp: 1640995200000,
      };

      const valid = validate(payload);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept multi-target event with person and clothing', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'interaction:adjust',
        targets: {
          person: 'alice_456',
          clothing: 'dress_789',
        },
        targetId: 'alice_456',
        originalInput: "adjust Alice's red dress",
      };

      const valid = validate(payload);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept single-target event using targets object', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:follow',
        targets: {
          primary: 'target_456',
        },
        targetId: 'target_456',
        originalInput: 'follow Alice',
      };

      const valid = validate(payload);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept multi-target event with multiple named targets', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'complex:action',
        targets: {
          primary: 'entity_123',
          secondary: 'entity_456',
          tertiary: 'entity_789',
        },
        targetId: 'entity_123',
        originalInput: 'complex multi-target action',
      };

      const valid = validate(payload);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('Valid payloads - Edge cases', () => {
    it('should accept event with only legacy targetId (no targets)', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'test:actor',
        actionId: 'test:action',
        targetId: 'test:target',
        originalInput: 'test command',
      };

      const valid = validate(payload);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept event with timestamp as zero', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'test:actor',
        actionId: 'test:action',
        targetId: 'test:target',
        originalInput: 'test command',
        timestamp: 0,
      };

      const valid = validate(payload);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('Invalid payloads - Missing required fields', () => {
    it('should reject payload without eventName', () => {
      const payload = {
        actorId: 'actor_123',
        actionId: 'core:action',
        targetId: 'target_456',
        originalInput: 'test',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain(
        "required property 'eventName'"
      );
    });

    it('should reject payload without actorId', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actionId: 'core:action',
        targetId: 'target_456',
        originalInput: 'test',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain(
        "required property 'actorId'"
      );
    });

    it('should reject payload without actionId', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        targetId: 'target_456',
        originalInput: 'test',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain(
        "required property 'actionId'"
      );
    });

    it('should reject payload without originalInput', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targetId: 'target_456',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain(
        "required property 'originalInput'"
      );
    });
  });

  describe('Invalid payloads - Target validation', () => {
    it('should reject payload with neither targets nor targetId', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        originalInput: 'test',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      // Should fail the anyOf constraint requiring either targets or targetId
    });

    it('should reject payload with empty targets object', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: {},
        originalInput: 'test',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      // Should fail minProperties constraint on targets
    });

    it('should reject payload with targets but missing required targetId', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: {
          primary: 'target_123',
        },
        originalInput: 'test',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      // Should fail the conditional validation requiring targetId when targets exist
    });

    it('should reject payload with empty string in targets', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: {
          primary: '',
        },
        targetId: 'valid_target',
        originalInput: 'test',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      // Should fail minLength constraint on target value
    });

    it('should reject payload with non-string value in targets', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: {
          primary: 123,
        },
        targetId: 'valid_target',
        originalInput: 'test',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain('must be string');
    });
  });

  describe('Invalid payloads - String validation', () => {
    it('should reject payload with empty originalInput', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targetId: 'target_456',
        originalInput: '',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain(
        'must NOT have fewer than 1 characters'
      );
    });

    it('should reject payload with empty targetId when targets exist', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: {
          primary: 'target_123',
        },
        targetId: '',
        originalInput: 'test',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      // The error could be from minLength or pattern validation
      expect(validate.errors[0].message).toMatch(
        /must (NOT have fewer than 1 characters|match pattern)/
      );
    });
  });

  describe('Invalid payloads - Type validation', () => {
    it('should reject payload with invalid eventName', () => {
      const payload = {
        eventName: 'invalid:event',
        actorId: 'actor_123',
        actionId: 'core:action',
        targetId: 'target_456',
        originalInput: 'test',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain('must be equal to constant');
    });

    it('should reject payload with negative timestamp', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targetId: 'target_456',
        originalInput: 'test',
        timestamp: -1,
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain('must be >= 0');
    });

    it('should reject payload with non-object targets', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: 'not an object',
        targetId: 'target_456',
        originalInput: 'test',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain('must be object');
    });
  });

  describe('Invalid payloads - Additional properties', () => {
    it('should reject payload with additional properties', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targetId: 'target_456',
        originalInput: 'test',
        extraProperty: 'not allowed',
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors).toBeDefined();
      expect(validate.errors[0].message).toContain(
        'must NOT have additional properties'
      );
    });
  });

  describe('Schema structure validation', () => {
    it('should have correct required fields', () => {
      expect(attemptActionEvent.payloadSchema.required).toEqual([
        'eventName',
        'actorId',
        'actionId',
        'originalInput',
      ]);
    });

    it('should not allow additional properties at root', () => {
      expect(attemptActionEvent.payloadSchema.additionalProperties).toBe(false);
    });

    it('should have proper anyOf constraints for target validation', () => {
      expect(attemptActionEvent.payloadSchema.anyOf).toHaveLength(2);
      expect(attemptActionEvent.payloadSchema.anyOf[0]).toHaveProperty(
        'description'
      );
      expect(attemptActionEvent.payloadSchema.anyOf[1]).toHaveProperty(
        'description'
      );
      expect(attemptActionEvent.payloadSchema.anyOf[0].description).toContain(
        'Legacy format'
      );
      expect(attemptActionEvent.payloadSchema.anyOf[1].description).toContain(
        'Multi-target format'
      );
    });

    it('should have targets property with additionalProperties pattern', () => {
      const targetsProperty =
        attemptActionEvent.payloadSchema.properties.targets;
      expect(targetsProperty.type).toBe('object');

      // Verify the targets property now supports both strings and objects
      expect(targetsProperty.additionalProperties).toHaveProperty('oneOf');
      expect(targetsProperty.additionalProperties.oneOf).toHaveLength(2);

      // First option should be string (legacy format)
      const stringOption = targetsProperty.additionalProperties.oneOf[0];
      expect(stringOption).toEqual({
        type: 'string',
        minLength: 1,
        description: 'Direct target entity ID (for namespaced entities)',
      });

      // Second option should be object (new runtime format)
      const objectOption = targetsProperty.additionalProperties.oneOf[1];
      expect(objectOption.type).toBe('object');
      expect(objectOption).toHaveProperty('properties');
      expect(objectOption.properties).toHaveProperty('entityId');
      expect(objectOption.required).toContain('entityId');
    });

    it('should include examples for targets property', () => {
      const targetsProperty =
        attemptActionEvent.payloadSchema.properties.targets;
      expect(targetsProperty.examples).toBeDefined();
      expect(targetsProperty.examples).toHaveLength(3);
    });
  });

  describe('Performance validation', () => {
    it('should validate events within performance requirements', () => {
      const payload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'core:action',
        targets: {
          item: 'knife_789',
          target: 'goblin_012',
        },
        targetId: 'knife_789',
        originalInput: 'throw knife at goblin',
        timestamp: 1640995200000,
      };

      const startTime = performance.now();
      const valid = validate(payload);
      const endTime = performance.now();
      const validationTime = endTime - startTime;

      expect(valid).toBe(true);
      expect(validationTime).toBeLessThan(5); // Should complete within 5ms
    });

    it('should validate multiple events efficiently', () => {
      const payloads = [
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_1',
          actionId: 'core:action',
          targetId: 'target_1',
          originalInput: 'test 1',
        },
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_2',
          actionId: 'core:action',
          targets: { primary: 'target_2' },
          targetId: 'target_2',
          originalInput: 'test 2',
        },
        {
          eventName: 'core:attempt_action',
          actorId: 'actor_3',
          actionId: 'core:action',
          targets: { item: 'item_3', target: 'target_3' },
          targetId: 'item_3',
          originalInput: 'test 3',
        },
      ];

      const startTime = performance.now();
      for (const payload of payloads) {
        validate(payload);
      }
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / payloads.length;

      expect(averageTime).toBeLessThan(5); // Each validation should average under 5ms
    });

    it('should validate complex multi-target events within 10ms', () => {
      const complexPayload = {
        eventName: 'core:attempt_action',
        actorId: 'actor_123',
        actionId: 'complex:orchestrated_action',
        targets: {
          primary: 'entity_1',
          secondary: 'entity_2',
          tertiary: 'entity_3',
          quaternary: 'entity_4',
          tool: 'tool_5',
          location: 'location_6',
          container: 'container_7',
          recipient: 'recipient_8',
        },
        targetId: 'entity_1',
        originalInput: 'complex orchestrated multi-target action',
        timestamp: Date.now(),
      };

      const startTime = performance.now();
      const valid = validate(complexPayload);
      const endTime = performance.now();
      const validationTime = endTime - startTime;

      expect(valid).toBe(true);
      expect(validationTime).toBeLessThan(10); // 10ms for complex events
    });

    it('should handle batch validation of complex events efficiently', () => {
      const complexEvents = [];
      for (let i = 0; i < 50; i++) {
        complexEvents.push({
          eventName: 'core:attempt_action',
          actorId: `actor_${i}`,
          actionId: 'complex:action',
          targets: {
            primary: `target_${i}_1`,
            secondary: `target_${i}_2`,
            item1: `item_${i}_1`,
            item2: `item_${i}_2`,
            location: `location_${i}`,
            tool: `tool_${i}`,
          },
          targetId: `target_${i}_1`,
          originalInput: `complex action ${i} with many targets`,
          timestamp: 1640995200000,
        });
      }

      const startTime = performance.now();
      for (const event of complexEvents) {
        validate(event);
      }
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / complexEvents.length;

      expect(averageTime).toBeLessThan(10); // 10ms average for complex events
    });
  });

  describe('Enhanced Multi-Target Validation', () => {
    describe('Complex multi-target scenarios', () => {
      it('should validate complex multi-action with 8 targets', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'complex:multi_step',
          targets: {
            source: 'container_456',
            item: 'potion_789',
            recipient: 'alice_012',
            tool: 'spoon_345',
            location: 'kitchen_678',
            container: 'bowl_901',
            assistant: 'bob_234',
            supervisor: 'carol_567',
          },
          targetId: 'container_456',
          originalInput:
            'use spoon to transfer potion from container to bowl for alice with bob helping under carol supervision in kitchen',
          timestamp: Date.now(),
        };

        const valid = validate(payload);
        expect(valid).toBe(true);
        expect(validate.errors).toBeNull();
      });

      it('should validate crafting action with semantic target names', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'crafting:combine',
          targets: {
            ingredient1: 'flour_789',
            ingredient2: 'water_012',
            ingredient3: 'yeast_345',
            container: 'bowl_678',
            tool: 'spoon_901',
          },
          targetId: 'flour_789',
          originalInput: 'combine flour, water, and yeast in bowl using spoon',
        };

        const valid = validate(payload);
        expect(valid).toBe(true);
        expect(validate.errors).toBeNull();
      });

      it('should validate transfer action with multiple participants', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'merchant_123',
          actionId: 'interaction:transfer',
          targets: {
            source: 'chest_456',
            item: 'gold_789',
            recipient: 'customer_012',
            witness: 'guard_345',
            location: 'market_678',
          },
          targetId: 'chest_456',
          originalInput:
            'transfer gold from chest to customer witnessed by guard at market',
          timestamp: Date.now(),
        };

        const valid = validate(payload);
        expect(valid).toBe(true);
        expect(validate.errors).toBeNull();
      });

      it('should validate combat action with multiple targets and weapons', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'warrior_123',
          actionId: 'combat:multi_attack',
          targets: {
            weapon1: 'sword_456',
            weapon2: 'dagger_789',
            enemy1: 'goblin_012',
            enemy2: 'orc_345',
            ally: 'ranger_678',
          },
          targetId: 'sword_456',
          originalInput:
            'attack goblin with sword and orc with dagger while ranger provides cover',
        };

        const valid = validate(payload);
        expect(valid).toBe(true);
        expect(validate.errors).toBeNull();
      });

      it('should validate social interaction with multiple participants', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'player_123',
          actionId: 'social:introduce',
          targets: {
            person1: 'alice_456',
            person2: 'bob_789',
            mediator: 'charlie_012',
            location: 'tavern_345',
          },
          targetId: 'alice_456',
          originalInput: 'introduce alice to bob through charlie at the tavern',
        };

        const valid = validate(payload);
        expect(valid).toBe(true);
        expect(validate.errors).toBeNull();
      });
    });

    describe('Edge cases', () => {
      it('should handle events with duplicate target references', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'interaction:swap',
          targets: {
            source: 'entity_456',
            destination: 'entity_456', // Same entity in different roles
          },
          targetId: 'entity_456',
          originalInput: 'swap items within same container',
        };

        const valid = validate(payload);
        expect(valid).toBe(true);
        expect(validate.errors).toBeNull();
      });

      it('should reject event with null value in targets object', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'interaction:partial',
          targets: {
            primary: 'valid_target',
            secondary: null, // null not allowed in targets
          },
          targetId: 'valid_target',
          originalInput: 'partial action with null target',
        };

        const valid = validate(payload);
        expect(valid).toBe(false);
        expect(validate.errors).toBeDefined();
        expect(validate.errors[0].message).toContain('must be string');
      });

      it('should reject event with array value in targets object', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'interaction:invalid',
          targets: {
            primary: 'valid_target',
            secondary: ['array', 'not', 'allowed'],
          },
          targetId: 'valid_target',
          originalInput: 'action with array target',
        };

        const valid = validate(payload);
        expect(valid).toBe(false);
        expect(validate.errors).toBeDefined();
        expect(validate.errors[0].message).toContain('must be string');
      });

      it('should validate event with very long target property names', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'test:long_names',
          targets: {
            veryLongPropertyNameForTestingPurposes: 'target_456',
            anotherExtremelyLongPropertyNameToValidateSchemaHandling:
              'target_789',
          },
          targetId: 'target_456',
          originalInput: 'test with long property names',
        };

        const valid = validate(payload);
        expect(valid).toBe(true);
        expect(validate.errors).toBeNull();
      });

      it('should validate event with unicode characters in target names', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'test:unicode',
          targets: {
            主要目标: 'target_456', // Chinese
            мишень: 'target_789', // Russian
            '🎯target': 'target_012', // Emoji
          },
          targetId: 'target_456',
          originalInput: 'test with unicode property names',
        };

        const valid = validate(payload);
        expect(valid).toBe(true);
        expect(validate.errors).toBeNull();
      });

      it('should reject legacy single-target event with empty string targetId', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'core:follow',
          targetId: '',
          originalInput: 'follow Alice',
        };

        const valid = validate(payload);
        expect(valid).toBe(false);
        expect(validate.errors).toBeDefined();
        // Empty string should fail pattern validation for namespacedId
      });
    });

    describe('Target Consistency Rules', () => {
      it('should validate when targetId matches first target in targets object', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'core:action',
          targets: {
            item: 'target_123',
            recipient: 'target_456',
          },
          targetId: 'target_123', // Matches first target
          originalInput: 'some action',
        };

        const valid = validate(payload);
        expect(valid).toBe(true);
        expect(validate.errors).toBeNull();
      });

      it('should validate when targetId matches any target in targets object', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'interaction:transfer',
          targets: {
            source: 'chest_456',
            item: 'gold_789',
            recipient: 'merchant_012',
          },
          targetId: 'gold_789', // Matches item, not first target
          originalInput: 'transfer gold from chest to merchant',
        };

        const valid = validate(payload);
        expect(valid).toBe(true);
        expect(validate.errors).toBeNull();
      });

      it('should validate when targetId does not match any target in targets', () => {
        // Note: The schema doesn't enforce targetId to match a target in targets
        // This is a valid scenario where targetId might represent a different primary target
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'interaction:complex',
          targets: {
            tool: 'hammer_456',
            material: 'iron_789',
          },
          targetId: 'anvil_999', // Different from targets - could be the workstation
          originalInput: 'use hammer on iron at anvil',
        };

        const valid = validate(payload);
        expect(valid).toBe(true);
        expect(validate.errors).toBeNull();
      });

      it('should validate multi-target event with targetId as primary fallback', () => {
        const payload = {
          eventName: 'core:attempt_action',
          actorId: 'actor_123',
          actionId: 'core:examine',
          targets: {
            secondary: 'object_456',
            tertiary: 'object_789',
          },
          targetId: 'object_123', // Acts as primary when no 'primary' key in targets
          originalInput: 'examine multiple objects',
        };

        const valid = validate(payload);
        expect(valid).toBe(true);
        expect(validate.errors).toBeNull();
      });
    });
  });
});
