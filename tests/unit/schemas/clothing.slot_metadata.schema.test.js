/**
 * @file Test suite for validating clothing:slot_metadata component schema
 * @see data/mods/clothing/components/slot_metadata.component.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, beforeAll, test, expect } from '@jest/globals';

// The component schema content
const slotMetadataComponentSchema = {
  $schema: 'schema://living-narrative-engine/component.schema.json',
  id: 'clothing:slot_metadata',
  description:
    'Metadata about clothing slots and their anatomy socket coverage',
  dataSchema: {
    type: 'object',
    properties: {
      slotMappings: {
        type: 'object',
        description: 'Map of clothing slot IDs to their coverage metadata',
        patternProperties: {
          '^[a-zA-Z][a-zA-Z0-9_]*$': {
            type: 'object',
            description: 'Metadata for a specific clothing slot',
            properties: {
              coveredSockets: {
                type: 'array',
                description:
                  'Array of anatomy socket IDs that this slot covers',
                items: {
                  type: 'string',
                  description: "Socket ID (e.g., 'left_chest', 'vagina')",
                },
              },
              allowedLayers: {
                type: 'array',
                description: 'Clothing layers allowed for this slot',
                items: {
                  type: 'string',
                  enum: ['underwear', 'base', 'outer', 'accessories', 'armor'],
                },
              },
            },
            required: ['coveredSockets'],
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    },
    required: ['slotMappings'],
    additionalProperties: false,
  },
};

describe('JSON-Schema – clothing:slot_metadata component', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // Compile just the data schema portion
    validate = ajv.compile(slotMetadataComponentSchema.dataSchema);
  });

  describe('Valid data', () => {
    test('should validate correct slot metadata with all fields', () => {
      const validData = {
        slotMappings: {
          torso_upper: {
            coveredSockets: ['left_chest', 'right_chest', 'chest_center'],
            allowedLayers: ['underwear', 'base', 'outer', 'armor'],
          },
          torso_lower: {
            coveredSockets: ['vagina', 'left_hip', 'right_hip'],
            allowedLayers: ['underwear', 'base', 'outer'],
          },
        },
      };

      const ok = validate(validData);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate slot metadata with only required fields', () => {
      const validData = {
        slotMappings: {
          torso_upper: {
            coveredSockets: ['left_chest'],
          },
        },
      };

      const ok = validate(validData);
      expect(ok).toBe(true);
    });

    test('should validate empty slot mappings', () => {
      const validData = {
        slotMappings: {},
      };

      const ok = validate(validData);
      expect(ok).toBe(true);
    });

    test('should validate multiple clothing slots', () => {
      const validData = {
        slotMappings: {
          head: {
            coveredSockets: ['head_top', 'head_sides'],
            allowedLayers: ['base', 'outer', 'accessories'],
          },
          feet: {
            coveredSockets: ['left_foot', 'right_foot'],
            allowedLayers: ['base', 'outer'],
          },
          back_accessory: {
            coveredSockets: ['upper_back', 'lower_back'],
            allowedLayers: ['accessories', 'armor'],
          },
        },
      };

      const ok = validate(validData);
      expect(ok).toBe(true);
    });

    test('should validate back_accessory with "accessories" layer (regression test)', () => {
      const validData = {
        slotMappings: {
          back_accessory: {
            coveredSockets: ['upper_back', 'lower_back'],
            allowedLayers: ['accessories', 'armor'], // Correct: plural form (standardized)
          },
        },
      };

      const ok = validate(validData);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });
  });

  describe('Invalid data', () => {
    test('should reject missing slotMappings', () => {
      const invalidData = {};

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '',
          keyword: 'required',
          params: { missingProperty: 'slotMappings' },
        })
      );
    });

    test('should reject missing coveredSockets', () => {
      const invalidData = {
        slotMappings: {
          torso_upper: {
            allowedLayers: ['base'],
          },
        },
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'required',
          params: { missingProperty: 'coveredSockets' },
        })
      );
    });

    test('should reject invalid slot names', () => {
      const invalidData = {
        slotMappings: {
          '123_invalid': {
            coveredSockets: ['test'],
          },
        },
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'additionalProperties',
        })
      );
    });

    test('should reject non-array coveredSockets', () => {
      const invalidData = {
        slotMappings: {
          torso_upper: {
            coveredSockets: 'not_an_array',
          },
        },
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'type',
          params: { type: 'array' },
        })
      );
    });

    test('should reject invalid layer names', () => {
      const invalidData = {
        slotMappings: {
          torso_upper: {
            coveredSockets: ['chest'],
            allowedLayers: ['invalid_layer'],
          },
        },
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'enum',
        })
      );
    });

    test('should reject singular "accessory" (schema expects plural "accessories")', () => {
      const invalidData = {
        slotMappings: {
          back_accessory: {
            coveredSockets: ['upper_back', 'lower_back'],
            allowedLayers: ['accessory'], // Wrong: singular form (schema standardized to plural)
          },
        },
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'enum',
          instancePath: '/slotMappings/back_accessory/allowedLayers/0',
        })
      );
    });

    test('should reject additional properties in slot mapping', () => {
      const invalidData = {
        slotMappings: {
          torso_upper: {
            coveredSockets: ['chest'],
            invalidProperty: 'value',
          },
        },
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'additionalProperties',
        })
      );
    });

    test('should reject non-string socket IDs', () => {
      const invalidData = {
        slotMappings: {
          torso_upper: {
            coveredSockets: [123, true, {}],
          },
        },
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      // Should have type errors for non-string items
      const typeErrors = validate.errors.filter(
        (err) => err.keyword === 'type'
      );
      expect(typeErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    test('should handle slots with empty socket arrays', () => {
      const data = {
        slotMappings: {
          decorative_slot: {
            coveredSockets: [],
            allowedLayers: ['accessories'],
          },
        },
      };

      const ok = validate(data);
      expect(ok).toBe(true);
    });

    test('should handle all valid layer types', () => {
      const data = {
        slotMappings: {
          multi_layer: {
            coveredSockets: ['test'],
            allowedLayers: ['underwear', 'base', 'outer', 'accessories', 'armor'],
          },
        },
      };

      const ok = validate(data);
      expect(ok).toBe(true);
    });

    test('should validate slot names with underscores', () => {
      const data = {
        slotMappings: {
          left_arm_clothing: {
            coveredSockets: ['left_upper_arm', 'left_lower_arm'],
          },
          torso_upper_outer: {
            coveredSockets: ['chest'],
          },
        },
      };

      const ok = validate(data);
      expect(ok).toBe(true);
    });
  });
});
