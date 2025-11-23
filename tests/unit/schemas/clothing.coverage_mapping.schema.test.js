/**
 * @file Test suite for validating clothing:coverage_mapping component schema
 * @see data/mods/clothing/components/coverage_mapping.component.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, beforeAll, test, expect } from '@jest/globals';

// The component schema content
const coverageMappingComponentSchema = {
  $schema: 'schema://living-narrative-engine/component.schema.json',
  id: 'clothing:coverage_mapping',
  description:
    'Defines additional body slots that clothing items cover when equipped',
  dataSchema: {
    type: 'object',
    properties: {
      covers: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'torso_upper',
            'torso_lower',
            'legs',
            'feet',
            'head_gear',
            'hands',
            'left_arm_clothing',
            'right_arm_clothing',
          ],
        },
        description: 'Array of clothing slots this item covers when worn',
        uniqueItems: true,
        minItems: 1,
      },
      coveragePriority: {
        type: 'string',
        enum: ['outer', 'armor', 'base', 'underwear', 'accessories'],
        description: 'Priority level for coverage resolution',
      },
    },
    required: ['covers', 'coveragePriority'],
    additionalProperties: false,
  },
};

describe('JSON-Schema – clothing:coverage_mapping component', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // Compile just the data schema portion
    validate = ajv.compile(coverageMappingComponentSchema.dataSchema);
  });

  describe('Valid data', () => {
    test('should validate correct coverage mapping with single slot', () => {
      const validData = {
        covers: ['torso_lower'],
        coveragePriority: 'base',
      };

      const ok = validate(validData);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate coverage mapping with multiple slots', () => {
      const validData = {
        covers: ['torso_upper', 'torso_lower', 'legs'],
        coveragePriority: 'outer',
      };

      const ok = validate(validData);
      expect(ok).toBe(true);
    });

    test('should validate with accessories priority level', () => {
      const validData = {
        covers: ['hands'],
        coveragePriority: 'accessories',
      };

      const ok = validate(validData);
      expect(ok).toBe(true);
    });

    test('should validate with armor priority level', () => {
      const validData = {
        covers: ['torso_upper', 'torso_lower'],
        coveragePriority: 'armor',
      };

      const ok = validate(validData);
      expect(ok).toBe(true);
    });

    test('should validate with underwear priority level', () => {
      const validData = {
        covers: ['torso_upper', 'torso_lower'],
        coveragePriority: 'underwear',
      };

      const ok = validate(validData);
      expect(ok).toBe(true);
    });

    test('should validate with all valid clothing slots', () => {
      const validData = {
        covers: [
          'torso_upper',
          'torso_lower',
          'legs',
          'feet',
          'head_gear',
          'hands',
          'left_arm_clothing',
          'right_arm_clothing',
        ],
        coveragePriority: 'outer',
      };

      const ok = validate(validData);
      expect(ok).toBe(true);
    });

    test('should validate with arm clothing slots', () => {
      const validData = {
        covers: ['left_arm_clothing', 'right_arm_clothing'],
        coveragePriority: 'base',
      };

      const ok = validate(validData);
      expect(ok).toBe(true);
    });
  });

  describe('Invalid data', () => {
    test('should reject missing covers field', () => {
      const invalidData = {
        coveragePriority: 'base',
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '',
          keyword: 'required',
          params: { missingProperty: 'covers' },
        })
      );
    });

    test('should reject missing coveragePriority field', () => {
      const invalidData = {
        covers: ['torso_upper'],
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '',
          keyword: 'required',
          params: { missingProperty: 'coveragePriority' },
        })
      );
    });

    test('should reject invalid slot name in covers array', () => {
      const invalidData = {
        covers: ['invalid_slot'],
        coveragePriority: 'base',
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'enum',
          instancePath: '/covers/0',
        })
      );
    });

    test('should reject invalid priority level', () => {
      const invalidData = {
        covers: ['torso_upper'],
        coveragePriority: 'invalid_priority',
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'enum',
          instancePath: '/coveragePriority',
        })
      );
    });

    test('should reject duplicate slot names in covers array', () => {
      const invalidData = {
        covers: ['torso_upper', 'torso_upper'],
        coveragePriority: 'base',
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'uniqueItems',
          instancePath: '/covers',
        })
      );
    });

    test('should reject empty covers array', () => {
      const invalidData = {
        covers: [],
        coveragePriority: 'base',
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'minItems',
          instancePath: '/covers',
          params: { limit: 1 },
        })
      );
    });

    test('should reject non-array covers field', () => {
      const invalidData = {
        covers: 'not_an_array',
        coveragePriority: 'base',
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'type',
          instancePath: '/covers',
          params: { type: 'array' },
        })
      );
    });

    test('should reject non-string priority level', () => {
      const invalidData = {
        covers: ['torso_upper'],
        coveragePriority: 123,
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'type',
          instancePath: '/coveragePriority',
          params: { type: 'string' },
        })
      );
    });

    test('should reject additional properties', () => {
      const invalidData = {
        covers: ['torso_upper'],
        coveragePriority: 'base',
        invalidProperty: 'should_not_be_here',
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'additionalProperties',
          instancePath: '',
          params: { additionalProperty: 'invalidProperty' },
        })
      );
    });

    test('should reject non-string items in covers array', () => {
      const invalidData = {
        covers: ['torso_upper', 123, true],
        coveragePriority: 'base',
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      // Should have type errors for non-string items
      const typeErrors = validate.errors.filter(
        (err) =>
          err.keyword === 'type' && err.instancePath.startsWith('/covers/')
      );
      expect(typeErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    test('should validate with all priority levels', () => {
      const priorities = ['outer', 'armor', 'base', 'underwear', 'accessories'];

      priorities.forEach((priority) => {
        const data = {
          covers: ['torso_upper'],
          coveragePriority: priority,
        };

        const ok = validate(data);
        expect(ok).toBe(true);
      });
    });

    test('should validate with single slot coverage', () => {
      const slots = [
        'torso_upper',
        'torso_lower',
        'legs',
        'feet',
        'head_gear',
        'hands',
        'left_arm_clothing',
        'right_arm_clothing',
      ];

      slots.forEach((slot) => {
        const data = {
          covers: [slot],
          coveragePriority: 'base',
        };

        const ok = validate(data);
        if (!ok) {
          console.error(`Failed for slot: ${slot}`, validate.errors);
        }
        expect(ok).toBe(true);
      });
    });

    test('should handle maximum slot coverage (all slots)', () => {
      const data = {
        covers: [
          'torso_upper',
          'torso_lower',
          'legs',
          'feet',
          'head_gear',
          'hands',
          'left_arm_clothing',
          'right_arm_clothing',
        ],
        coveragePriority: 'outer',
      };

      const ok = validate(data);
      expect(ok).toBe(true);
    });

    test('should validate realistic clothing coverage scenarios', () => {
      // Jeans covering torso_lower and legs
      const jeansData = {
        covers: ['torso_lower', 'legs'],
        coveragePriority: 'base',
      };

      // Jacket covering torso_upper and arms
      const jacketData = {
        covers: ['torso_upper', 'left_arm_clothing', 'right_arm_clothing'],
        coveragePriority: 'outer',
      };

      // Full body underwear
      const bodysuitData = {
        covers: ['torso_upper', 'torso_lower'],
        coveragePriority: 'underwear',
      };

      // Accessory belt
      const beltData = {
        covers: ['torso_lower'],
        coveragePriority: 'accessories',
      };

      // Armor breastplate
      const breastplateData = {
        covers: ['torso_upper', 'torso_lower'],
        coveragePriority: 'armor',
      };

      expect(validate(jeansData)).toBe(true);
      expect(validate(jacketData)).toBe(true);
      expect(validate(bodysuitData)).toBe(true);
      expect(validate(beltData)).toBe(true);
      expect(validate(breastplateData)).toBe(true);
    });
  });

  describe('Integration compatibility', () => {
    test('should use slot names compatible with SlotAccessResolver', () => {
      // These are the exact slot names from SlotAccessResolver
      const slotAccessResolverSlots = [
        'torso_upper',
        'torso_lower',
        'legs',
        'feet',
        'head_gear',
        'hands',
        'left_arm_clothing',
        'right_arm_clothing',
      ];

      const data = {
        covers: slotAccessResolverSlots,
        coveragePriority: 'base',
      };

      const ok = validate(data);
      expect(ok).toBe(true);
    });

    test('should use priority levels compatible with wearable component layers', () => {
      // These match the layer enum from clothing:wearable component
      const wearableLayers = ['outer', 'armor', 'base', 'underwear', 'accessories'];

      wearableLayers.forEach((layer) => {
        const data = {
          covers: ['torso_upper'],
          coveragePriority: layer,
        };

        const ok = validate(data);
        expect(ok).toBe(true);
      });
    });
  });
});
