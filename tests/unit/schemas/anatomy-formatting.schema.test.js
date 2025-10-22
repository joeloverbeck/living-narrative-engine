/**
 * @file Test suite for validating Anatomy Formatting definitions
 * @see data/schemas/anatomy-formatting.schema.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, beforeAll, test, expect } from '@jest/globals';

// Schema to be loaded
import anatomyFormattingSchema from '../../../data/schemas/anatomy-formatting.schema.json';

describe('JSON-Schema – Anatomy Formatting', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // Compile the main schema we want to test
    validate = ajv.compile(anatomyFormattingSchema);
  });

  describe('Valid Configurations', () => {
    test('should validate a minimal valid configuration', () => {
      const validConfig = {
        id: 'default',
      };

      const ok = validate(validConfig);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate a complete configuration with all properties', () => {
      const validConfig = {
        $schema: '../../../schemas/anatomy-formatting.schema.json',
        id: 'default',
        descriptionOrder: [
          'build',
          'hair',
          'eye',
          'face',
          'torso',
          'arm',
          'leg',
          'equipment',
        ],
        pairedParts: ['eye', 'ear', 'arm', 'leg', 'hand', 'foot'],
        irregularPlurals: {
          foot: 'feet',
          tooth: 'teeth',
        },
        descriptorOrder: [
          'descriptors:length_category',
          'descriptors:size_category',
          'descriptors:color_basic',
          'descriptors:shape_general',
        ],
        descriptorValueKeys: ['value', 'color', 'size', 'shape', 'length'],
        equipmentIntegration: {
          enabled: true,
          prefix: 'Wearing: ',
          suffix: '.',
          separator: ', ',
          itemSeparator: ' | ',
          placement: 'after_anatomy',
        },
      };

      const ok = validate(validConfig);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('should validate configuration without equipmentIntegration', () => {
      const validConfig = {
        id: 'simple',
        descriptionOrder: ['torso', 'head', 'arm'],
        pairedParts: ['arm'],
        descriptorValueKeys: ['value'],
      };

      const ok = validate(validConfig);
      expect(ok).toBe(true);
    });

    test('should validate equipmentIntegration with before_anatomy placement', () => {
      const validConfig = {
        id: 'before_equipment',
        equipmentIntegration: {
          enabled: true,
          prefix: 'Equipment: ',
          suffix: '',
          separator: ', ',
          itemSeparator: ' | ',
          placement: 'before_anatomy',
        },
      };

      const ok = validate(validConfig);
      expect(ok).toBe(true);
    });

    test('should validate empty arrays for optional properties', () => {
      const validConfig = {
        id: 'empty_arrays',
        descriptionOrder: [],
        pairedParts: [],
        descriptorOrder: [],
        descriptorValueKeys: [],
      };

      const ok = validate(validConfig);
      expect(ok).toBe(true);
    });
  });

  describe('Required Property Validations', () => {
    test('should fail if missing required id', () => {
      const invalidData = {
        descriptionOrder: ['torso'],
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          message: "must have required property 'id'",
        })
      );
    });

    test('should fail with invalid id pattern', () => {
      const invalidData = {
        id: 'Invalid Id With Spaces',
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'pattern',
        })
      );
    });

    test('should validate ids with underscores, hyphens, and numbers', () => {
      const validConfig = {
        id: 'valid-id_123',
      };

      const ok = validate(validConfig);
      expect(ok).toBe(true);
    });
  });

  describe('Array Property Validations', () => {
    test('should fail with duplicate items in descriptionOrder', () => {
      const invalidData = {
        id: 'test',
        descriptionOrder: ['torso', 'head', 'torso'],
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'uniqueItems',
        })
      );
    });

    test('should fail with empty strings in descriptionOrder', () => {
      const invalidData = {
        id: 'test',
        descriptionOrder: ['torso', '', 'head'],
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'minLength',
        })
      );
    });

    test('should fail with invalid descriptor pattern', () => {
      const invalidData = {
        id: 'test',
        descriptorOrder: ['descriptors:valid', 'invalid_pattern'],
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'pattern',
        })
      );
    });

    test('should validate valid descriptor patterns', () => {
      const validConfig = {
        id: 'test',
        descriptorOrder: [
          'descriptors:length_category',
          'descriptors:size_123',
          'descriptors:color_extended',
        ],
      };

      const ok = validate(validConfig);
      expect(ok).toBe(true);
    });

    test('should validate new descriptor patterns for body composition and projection', () => {
      const validConfig = {
        id: 'test',
        descriptorOrder: [
          'descriptors:body_composition',
          'descriptors:body_hair',
          'descriptors:facial_hair',
          'descriptors:projection',
        ],
        descriptorValueKeys: ['composition', 'density', 'style', 'projection'],
      };

      const ok = validate(validConfig);
      expect(ok).toBe(true);
    });
  });

  describe('Equipment Integration Validations', () => {
    test('should validate minimal equipmentIntegration object', () => {
      const validConfig = {
        id: 'test',
        equipmentIntegration: {
          enabled: false,
        },
      };

      const ok = validate(validConfig);
      expect(ok).toBe(true);
    });

    test('should fail with invalid placement enum value', () => {
      const invalidData = {
        id: 'test',
        equipmentIntegration: {
          enabled: true,
          placement: 'invalid_placement',
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

    test('should fail with non-boolean enabled value', () => {
      const invalidData = {
        id: 'test',
        equipmentIntegration: {
          enabled: 'true',
        },
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'type',
        })
      );
    });

    test('should fail with non-string prefix', () => {
      const invalidData = {
        id: 'test',
        equipmentIntegration: {
          enabled: true,
          prefix: 123,
        },
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'type',
        })
      );
    });

    test('should fail with additional properties in equipmentIntegration', () => {
      const invalidData = {
        id: 'test',
        equipmentIntegration: {
          enabled: true,
          unknownProperty: 'value',
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

    test('should validate complete equipmentIntegration object', () => {
      const validConfig = {
        id: 'test',
        equipmentIntegration: {
          enabled: true,
          prefix: 'Equipped: ',
          suffix: ' (end)',
          separator: ' and ',
          itemSeparator: ' || ',
          placement: 'after_anatomy',
        },
      };

      const ok = validate(validConfig);
      expect(ok).toBe(true);
    });
  });

  describe('IrregularPlurals Validations', () => {
    test('should validate proper irregularPlurals object', () => {
      const validConfig = {
        id: 'test',
        irregularPlurals: {
          foot: 'feet',
          tooth: 'teeth',
          child: 'children',
        },
      };

      const ok = validate(validConfig);
      expect(ok).toBe(true);
    });

    test('should fail with empty string values in irregularPlurals', () => {
      const invalidData = {
        id: 'test',
        irregularPlurals: {
          foot: '',
        },
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'minLength',
        })
      );
    });

    test('should fail with non-string values in irregularPlurals', () => {
      const invalidData = {
        id: 'test',
        irregularPlurals: {
          foot: 123,
        },
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'type',
        })
      );
    });
  });

  describe('Additional Properties Validation', () => {
    test('should fail with unknown properties at root level', () => {
      const invalidData = {
        id: 'test',
        unknownProperty: 'value',
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'additionalProperties',
        })
      );
    });

    test('should validate $schema property for editor support', () => {
      const validConfig = {
        $schema: '../../../schemas/anatomy-formatting.schema.json',
        id: 'test',
      };

      const ok = validate(validConfig);
      expect(ok).toBe(true);
    });

    test('should fail with non-string $schema', () => {
      const invalidData = {
        $schema: 123,
        id: 'test',
      };

      const ok = validate(invalidData);
      expect(ok).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({
          keyword: 'type',
        })
      );
    });
  });

  describe('Real World Configuration Tests', () => {
    test('should validate the actual default.json configuration', () => {
      const realWorldConfig = {
        $schema: '../../../schemas/anatomy-formatting.schema.json',
        id: 'default',
        descriptionOrder: [
          'build',
          'body_composition',
          'body_hair',
          'hair',
          'eye',
          'face',
          'ear',
          'nose',
          'mouth',
          'neck',
          'breast',
          'torso',
          'arm',
          'hand',
          'leg',
          'ass_cheek',
          'foot',
          'pubic_hair',
          'vagina',
          'penis',
          'testicle',
          'tail',
          'wing',
          'equipment',
        ],
        pairedParts: [
          'eye',
          'ear',
          'arm',
          'leg',
          'hand',
          'foot',
          'breast',
          'wing',
          'testicle',
          'ass_cheek',
        ],
        irregularPlurals: {
          foot: 'feet',
          tooth: 'teeth',
          ass_cheek: 'ass',
        },
        descriptorOrder: [
          'descriptors:length_category',
          'descriptors:length_hair',
          'descriptors:size_category',
          'descriptors:size_specific',
          'descriptors:weight_feel',
          'descriptors:body_composition',
          'descriptors:body_hair',
          'descriptors:facial_hair',
          'descriptors:color_basic',
          'descriptors:color_extended',
          'descriptors:shape_general',
          'descriptors:shape_eye',
          'descriptors:hair_style',
          'descriptors:texture',
          'descriptors:firmness',
          'descriptors:projection',
          'descriptors:build',
        ],
        descriptorValueKeys: [
          'value',
          'color',
          'size',
          'shape',
          'length',
          'style',
          'texture',
          'firmness',
          'build',
          'weight',
          'composition',
          'density',
          'projection',
        ],
        equipmentIntegration: {
          enabled: true,
          prefix: 'Wearing: ',
          suffix: '.',
          separator: ', ',
          itemSeparator: ' | ',
          placement: 'after_anatomy',
        },
      };

      const ok = validate(realWorldConfig);
      if (!ok) {
        console.error('Validation errors:', validate.errors);
      }
      expect(ok).toBe(true);
    });
  });
});
