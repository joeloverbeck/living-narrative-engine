/**
 * @file Test suite to validate the weapons:ammunition data component definition.
 * @see data/mods/weapons/components/ammunition.component.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';

// --- Schemas to test against ---
import componentSchema from '../../../../../data/schemas/component.schema.json';
import commonSchema from '../../../../../data/schemas/common.schema.json';

// --- Component definition file to validate ---
import ammunitionComponent from '../../../../../data/mods/weapons/components/ammunition.component.json';

/**
 * Test suite – weapons:ammunition Data Component Schema Validation.
 *
 * This suite validates that the weapons:ammunition component definition
 * conforms to the primary component schema and correctly defines
 * ammunition tracking properties.
 */
describe('weapons:ammunition Component Definition', () => {
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
      const ok = validate(ammunitionComponent);

      if (!ok) {
        console.error(
          'Validation failed for ammunition.component.json:',
          JSON.stringify(validate.errors, null, 2)
        );
      }

      expect(ok).toBe(true);
    });

    test('should have correct component ID', () => {
      expect(ammunitionComponent.id).toBe('weapons:ammunition');
    });

    test('should have a description', () => {
      expect(ammunitionComponent.description).toBeDefined();
      expect(typeof ammunitionComponent.description).toBe('string');
      expect(ammunitionComponent.description.length).toBeGreaterThan(0);
    });
  });

  describe('Data Schema Properties', () => {
    test('should have all required properties', () => {
      const properties = ammunitionComponent.dataSchema.properties;
      expect(properties).toHaveProperty('ammoType');
      expect(properties).toHaveProperty('currentAmmo');
      expect(properties).toHaveProperty('maxCapacity');
      expect(properties).toHaveProperty('chambered');
    });

    test('should require all properties', () => {
      const required = ammunitionComponent.dataSchema.required;
      expect(required).toContain('ammoType');
      expect(required).toContain('currentAmmo');
      expect(required).toContain('maxCapacity');
      expect(required).toContain('chambered');
    });

    test('should not allow additional properties', () => {
      expect(ammunitionComponent.dataSchema.additionalProperties).toBe(false);
    });
  });

  describe('Type Validation', () => {
    test('ammoType should be string', () => {
      const ammoType = ammunitionComponent.dataSchema.properties.ammoType;
      expect(ammoType.type).toBe('string');
    });

    test('currentAmmo should be integer with minimum 0', () => {
      const currentAmmo =
        ammunitionComponent.dataSchema.properties.currentAmmo;
      expect(currentAmmo.type).toBe('integer');
      expect(currentAmmo.minimum).toBe(0);
    });

    test('maxCapacity should be integer with minimum 1', () => {
      const maxCapacity =
        ammunitionComponent.dataSchema.properties.maxCapacity;
      expect(maxCapacity.type).toBe('integer');
      expect(maxCapacity.minimum).toBe(1);
    });

    test('chambered should be boolean', () => {
      const chambered = ammunitionComponent.dataSchema.properties.chambered;
      expect(chambered.type).toBe('boolean');
    });
  });

  describe('Required Fields', () => {
    test('should have all required component schema fields', () => {
      expect(ammunitionComponent).toHaveProperty('id');
      expect(ammunitionComponent).toHaveProperty('description');
      expect(ammunitionComponent).toHaveProperty('dataSchema');
    });

    test('should have valid schema reference', () => {
      expect(ammunitionComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });
  });

  describe('Component Purpose', () => {
    test('description should indicate ammunition tracking', () => {
      const description = ammunitionComponent.description.toLowerCase();
      expect(description).toContain('ammunition');
    });

    test('description should mention tracking or state', () => {
      const description = ammunitionComponent.description.toLowerCase();
      expect(
        description.includes('track') || description.includes('state')
      ).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should fail validation with negative currentAmmo', () => {
      const testData = {
        ammoType: '9mm',
        currentAmmo: -5, // Invalid
        maxCapacity: 15,
        chambered: true,
      };

      const dataSchemaValidator = new Ajv().compile(
        ammunitionComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });

    test('should fail validation with maxCapacity = 0', () => {
      const testData = {
        ammoType: '9mm',
        currentAmmo: 0,
        maxCapacity: 0, // Invalid
        chambered: false,
      };

      const dataSchemaValidator = new Ajv().compile(
        ammunitionComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });

    test('should fail validation with non-boolean chambered', () => {
      const testData = {
        ammoType: '9mm',
        currentAmmo: 15,
        maxCapacity: 15,
        chambered: 'yes', // Invalid
      };

      const dataSchemaValidator = new Ajv().compile(
        ammunitionComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });

    test('should pass validation with valid data (empty magazine)', () => {
      const testData = {
        ammoType: '9mm',
        currentAmmo: 0,
        maxCapacity: 15,
        chambered: false,
      };

      const dataSchemaValidator = new Ajv().compile(
        ammunitionComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(true);
    });

    test('should pass validation with valid data (full magazine, chambered)', () => {
      const testData = {
        ammoType: '.45ACP',
        currentAmmo: 7,
        maxCapacity: 7,
        chambered: true,
      };

      const dataSchemaValidator = new Ajv().compile(
        ammunitionComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(true);
    });

    test('should fail validation with missing required field', () => {
      const testData = {
        ammoType: '9mm',
        currentAmmo: 15,
        // Missing maxCapacity and chambered
      };

      const dataSchemaValidator = new Ajv().compile(
        ammunitionComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });
  });

  describe('Integration with Shoot Weapon Action', () => {
    test('should support decrementing currentAmmo', () => {
      const testData = {
        ammoType: '9mm',
        currentAmmo: 15,
        maxCapacity: 15,
        chambered: true,
      };

      const dataSchemaValidator = new Ajv().compile(
        ammunitionComponent.dataSchema
      );

      // Simulate shooting (decrement currentAmmo, set chambered to false)
      const afterShoot = {
        ...testData,
        currentAmmo: testData.currentAmmo - 1,
        chambered: false,
      };

      expect(dataSchemaValidator(afterShoot)).toBe(true);
    });
  });
});
