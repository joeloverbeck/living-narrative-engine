/**
 * @file Test suite to validate the weapons:firearm data component definition.
 * @see data/mods/weapons/components/firearm.component.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';

// --- Schemas to test against ---
import componentSchema from '../../../../../data/schemas/component.schema.json';
import commonSchema from '../../../../../data/schemas/common.schema.json';

// --- Component definition file to validate ---
import firearmComponent from '../../../../../data/mods/weapons/components/firearm.component.json';

/**
 * Test suite – weapons:firearm Data Component Schema Validation.
 *
 * This suite validates that the weapons:firearm component definition
 * conforms to the primary component schema and correctly defines
 * firearm-specific properties.
 */
describe('weapons:firearm Component Definition', () => {
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
      const ok = validate(firearmComponent);

      if (!ok) {
        console.error(
          'Validation failed for firearm.component.json:',
          JSON.stringify(validate.errors, null, 2)
        );
      }

      expect(ok).toBe(true);
    });

    test('should have correct component ID', () => {
      expect(firearmComponent.id).toBe('weapons:firearm');
    });

    test('should have a description', () => {
      expect(firearmComponent.description).toBeDefined();
      expect(typeof firearmComponent.description).toBe('string');
      expect(firearmComponent.description.length).toBeGreaterThan(0);
    });
  });

  describe('Data Schema Properties', () => {
    test('should have all required properties', () => {
      const properties = firearmComponent.dataSchema.properties;
      expect(properties).toHaveProperty('firearmType');
      expect(properties).toHaveProperty('firingMode');
      expect(properties).toHaveProperty('rateOfFire');
      expect(properties).toHaveProperty('accuracy');
      expect(properties).toHaveProperty('range');
      expect(properties).toHaveProperty('condition');
    });

    test('should require all properties', () => {
      const required = firearmComponent.dataSchema.required;
      expect(required).toContain('firearmType');
      expect(required).toContain('firingMode');
      expect(required).toContain('rateOfFire');
      expect(required).toContain('accuracy');
      expect(required).toContain('range');
      expect(required).toContain('condition');
    });

    test('should not allow additional properties', () => {
      expect(firearmComponent.dataSchema.additionalProperties).toBe(false);
    });
  });

  describe('Enum Validation', () => {
    test('firearmType should have valid enum values', () => {
      const firearmType = firearmComponent.dataSchema.properties.firearmType;
      expect(firearmType.enum).toEqual([
        'handgun',
        'rifle',
        'shotgun',
        'submachine_gun',
      ]);
    });

    test('firingMode should have valid enum values', () => {
      const firingMode = firearmComponent.dataSchema.properties.firingMode;
      expect(firingMode.enum).toContain('semi_automatic');
      expect(firingMode.enum).toContain('automatic');
      expect(firingMode.enum).toContain('burst');
      expect(firingMode.enum).toContain('bolt_action');
    });

    test('condition should have valid enum values', () => {
      const condition = firearmComponent.dataSchema.properties.condition;
      expect(condition.enum).toEqual([
        'excellent',
        'good',
        'fair',
        'poor',
        'broken',
      ]);
    });
  });

  describe('Number Constraints', () => {
    test('rateOfFire should have minimum constraint', () => {
      const rateOfFire = firearmComponent.dataSchema.properties.rateOfFire;
      expect(rateOfFire.type).toBe('number');
      expect(rateOfFire.minimum).toBe(1);
    });

    test('accuracy should be constrained to 0-100', () => {
      const accuracy = firearmComponent.dataSchema.properties.accuracy;
      expect(accuracy.type).toBe('number');
      expect(accuracy.minimum).toBe(0);
      expect(accuracy.maximum).toBe(100);
    });

    test('range should have minimum constraint', () => {
      const range = firearmComponent.dataSchema.properties.range;
      expect(range.type).toBe('number');
      expect(range.minimum).toBe(1);
    });
  });

  describe('Required Fields', () => {
    test('should have all required component schema fields', () => {
      expect(firearmComponent).toHaveProperty('id');
      expect(firearmComponent).toHaveProperty('description');
      expect(firearmComponent).toHaveProperty('dataSchema');
    });

    test('should have valid schema reference', () => {
      expect(firearmComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });
  });

  describe('Component Purpose', () => {
    test('description should indicate firearm properties', () => {
      const description = firearmComponent.description.toLowerCase();
      expect(description).toContain('firearm');
    });

    test('description should mention weapons:weapon marker', () => {
      const description = firearmComponent.description;
      expect(description).toContain('weapons:weapon');
    });
  });

  describe('Edge Cases', () => {
    test('should fail validation with invalid firearmType', () => {
      const testData = {
        firearmType: 'laser_gun', // Invalid
        firingMode: 'semi_automatic',
        rateOfFire: 600,
        accuracy: 75,
        range: 50,
        condition: 'good',
      };

      const dataSchemaValidator = new Ajv().compile(
        firearmComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });

    test('should fail validation with accuracy > 100', () => {
      const testData = {
        firearmType: 'handgun',
        firingMode: 'semi_automatic',
        rateOfFire: 600,
        accuracy: 150, // Invalid
        range: 50,
        condition: 'good',
      };

      const dataSchemaValidator = new Ajv().compile(
        firearmComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });

    test('should fail validation with negative range', () => {
      const testData = {
        firearmType: 'handgun',
        firingMode: 'semi_automatic',
        rateOfFire: 600,
        accuracy: 75,
        range: -10, // Invalid
        condition: 'good',
      };

      const dataSchemaValidator = new Ajv().compile(
        firearmComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });

    test('should pass validation with valid data', () => {
      const testData = {
        firearmType: 'handgun',
        firingMode: 'semi_automatic',
        rateOfFire: 600,
        accuracy: 75,
        range: 50,
        condition: 'good',
      };

      const dataSchemaValidator = new Ajv().compile(
        firearmComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(true);
    });
  });
});
