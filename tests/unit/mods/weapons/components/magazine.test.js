/**
 * @file Test suite to validate the weapons:magazine data component definition.
 * @see data/mods/weapons/components/magazine.component.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';

// --- Schemas to test against ---
import componentSchema from '../../../../../data/schemas/component.schema.json';
import commonSchema from '../../../../../data/schemas/common.schema.json';

// --- Component definition file to validate ---
import magazineComponent from '../../../../../data/mods/weapons/components/magazine.component.json';

/**
 * Test suite – weapons:magazine Data Component Schema Validation.
 *
 * This suite validates that the weapons:magazine component definition
 * conforms to the primary component schema and correctly defines
 * detachable magazine state properties.
 */
describe('weapons:magazine Component Definition', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({
      schemas: [commonSchema],
      strict: true,
      allErrors: true,
    });
    addFormats(ajv);

    validate = ajv.compile(componentSchema);
  });

  describe('Schema Validation', () => {
    test('should conform to the component definition schema', () => {
      const ok = validate(magazineComponent);

      if (!ok) {
        console.error(
          'Validation failed for magazine.component.json:',
          JSON.stringify(validate.errors, null, 2)
        );
      }

      expect(ok).toBe(true);
    });

    test('should have correct component ID', () => {
      expect(magazineComponent.id).toBe('weapons:magazine');
    });

    test('should have a description', () => {
      expect(magazineComponent.description).toBeDefined();
      expect(typeof magazineComponent.description).toBe('string');
      expect(magazineComponent.description.length).toBeGreaterThan(0);
    });
  });

  describe('Data Schema Properties', () => {
    test('should have all required properties', () => {
      const properties = magazineComponent.dataSchema.properties;
      expect(properties).toHaveProperty('magazineInserted');
      expect(properties).toHaveProperty('magazineType');
    });

    test('should require all properties', () => {
      const required = magazineComponent.dataSchema.required;
      expect(required).toContain('magazineInserted');
      expect(required).toContain('magazineType');
    });

    test('should not allow additional properties', () => {
      expect(magazineComponent.dataSchema.additionalProperties).toBe(false);
    });
  });

  describe('Type Validation', () => {
    test('magazineInserted should be boolean', () => {
      const magazineInserted =
        magazineComponent.dataSchema.properties.magazineInserted;
      expect(magazineInserted.type).toBe('boolean');
    });

    test('magazineType should be string', () => {
      const magazineType =
        magazineComponent.dataSchema.properties.magazineType;
      expect(magazineType.type).toBe('string');
    });
  });

  describe('Required Fields', () => {
    test('should have all required component schema fields', () => {
      expect(magazineComponent).toHaveProperty('id');
      expect(magazineComponent).toHaveProperty('description');
      expect(magazineComponent).toHaveProperty('dataSchema');
    });

    test('should have valid schema reference', () => {
      expect(magazineComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });
  });

  describe('Component Purpose', () => {
    test('description should indicate magazine state tracking', () => {
      const description = magazineComponent.description.toLowerCase();
      expect(description).toContain('magazine');
    });

    test('description should mention detachable or state', () => {
      const description = magazineComponent.description.toLowerCase();
      expect(
        description.includes('detachable') || description.includes('state')
      ).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should fail validation with non-boolean magazineInserted', () => {
      const testData = {
        magazineInserted: 'yes', // Invalid
        magazineType: 'glock_17_mag',
      };

      const dataSchemaValidator = new Ajv().compile(
        magazineComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });

    test('should fail validation with missing magazineType', () => {
      const testData = {
        magazineInserted: true,
        // Missing magazineType
      };

      const dataSchemaValidator = new Ajv().compile(
        magazineComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });

    test('should pass validation with magazine inserted', () => {
      const testData = {
        magazineInserted: true,
        magazineType: 'glock_17_mag',
      };

      const dataSchemaValidator = new Ajv().compile(
        magazineComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(true);
    });

    test('should pass validation with magazine not inserted', () => {
      const testData = {
        magazineInserted: false,
        magazineType: 'ar15_30rd',
      };

      const dataSchemaValidator = new Ajv().compile(
        magazineComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(true);
    });

    test('should fail validation with additional properties', () => {
      const testData = {
        magazineInserted: true,
        magazineType: 'glock_17_mag',
        extraProperty: 'invalid',
      };

      const dataSchemaValidator = new Ajv().compile(
        magazineComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });
  });

  describe('Magazine Management Actions', () => {
    test('should support eject magazine operation', () => {
      const testData = {
        magazineInserted: true,
        magazineType: 'glock_17_mag',
      };

      const dataSchemaValidator = new Ajv().compile(
        magazineComponent.dataSchema
      );

      // Simulate ejecting magazine
      const afterEject = {
        ...testData,
        magazineInserted: false,
      };

      expect(dataSchemaValidator(afterEject)).toBe(true);
    });

    test('should support insert magazine operation', () => {
      const testData = {
        magazineInserted: false,
        magazineType: 'm1911_7rd',
      };

      const dataSchemaValidator = new Ajv().compile(
        magazineComponent.dataSchema
      );

      // Simulate inserting magazine
      const afterInsert = {
        ...testData,
        magazineInserted: true,
      };

      expect(dataSchemaValidator(afterInsert)).toBe(true);
    });
  });
});
