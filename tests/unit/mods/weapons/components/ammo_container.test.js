/**
 * @file Test suite to validate the weapons:ammo_container data component definition.
 * @see data/mods/weapons/components/ammo_container.component.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';

// --- Schemas to test against ---
import componentSchema from '../../../../../data/schemas/component.schema.json';
import commonSchema from '../../../../../data/schemas/common.schema.json';

// --- Component definition file to validate ---
import ammoContainerComponent from '../../../../../data/mods/weapons/components/ammo_container.component.json';

/**
 * Test suite – weapons:ammo_container Data Component Schema Validation.
 *
 * This suite validates that the weapons:ammo_container component definition
 * conforms to the primary component schema and correctly defines
 * portable ammunition container properties.
 */
describe('weapons:ammo_container Component Definition', () => {
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
      const ok = validate(ammoContainerComponent);

      if (!ok) {
        console.error(
          'Validation failed for ammo_container.component.json:',
          JSON.stringify(validate.errors, null, 2)
        );
      }

      expect(ok).toBe(true);
    });

    test('should have correct component ID', () => {
      expect(ammoContainerComponent.id).toBe('weapons:ammo_container');
    });

    test('should have a description', () => {
      expect(ammoContainerComponent.description).toBeDefined();
      expect(typeof ammoContainerComponent.description).toBe('string');
      expect(ammoContainerComponent.description.length).toBeGreaterThan(0);
    });
  });

  describe('Data Schema Properties', () => {
    test('should have all required properties', () => {
      const properties = ammoContainerComponent.dataSchema.properties;
      expect(properties).toHaveProperty('ammoType');
      expect(properties).toHaveProperty('currentRounds');
      expect(properties).toHaveProperty('maxCapacity');
      expect(properties).toHaveProperty('containerType');
    });

    test('should require all properties', () => {
      const required = ammoContainerComponent.dataSchema.required;
      expect(required).toContain('ammoType');
      expect(required).toContain('currentRounds');
      expect(required).toContain('maxCapacity');
      expect(required).toContain('containerType');
    });

    test('should not allow additional properties', () => {
      expect(ammoContainerComponent.dataSchema.additionalProperties).toBe(
        false
      );
    });
  });

  describe('Type Validation', () => {
    test('ammoType should be string', () => {
      const ammoType = ammoContainerComponent.dataSchema.properties.ammoType;
      expect(ammoType.type).toBe('string');
    });

    test('currentRounds should be integer with minimum 0', () => {
      const currentRounds =
        ammoContainerComponent.dataSchema.properties.currentRounds;
      expect(currentRounds.type).toBe('integer');
      expect(currentRounds.minimum).toBe(0);
    });

    test('maxCapacity should be integer with minimum 1', () => {
      const maxCapacity =
        ammoContainerComponent.dataSchema.properties.maxCapacity;
      expect(maxCapacity.type).toBe('integer');
      expect(maxCapacity.minimum).toBe(1);
    });

    test('containerType should be string enum', () => {
      const containerType =
        ammoContainerComponent.dataSchema.properties.containerType;
      expect(containerType.type).toBe('string');
      expect(containerType.enum).toBeDefined();
    });
  });

  describe('Enum Validation', () => {
    test('containerType should have all specified values', () => {
      const containerType =
        ammoContainerComponent.dataSchema.properties.containerType;
      expect(containerType.enum).toEqual([
        'magazine',
        'speed_loader',
        'ammo_box',
        'stripper_clip',
      ]);
    });

    test('containerType should include magazine', () => {
      const containerType =
        ammoContainerComponent.dataSchema.properties.containerType;
      expect(containerType.enum).toContain('magazine');
    });

    test('containerType should include speed_loader', () => {
      const containerType =
        ammoContainerComponent.dataSchema.properties.containerType;
      expect(containerType.enum).toContain('speed_loader');
    });

    test('containerType should include ammo_box', () => {
      const containerType =
        ammoContainerComponent.dataSchema.properties.containerType;
      expect(containerType.enum).toContain('ammo_box');
    });

    test('containerType should include stripper_clip', () => {
      const containerType =
        ammoContainerComponent.dataSchema.properties.containerType;
      expect(containerType.enum).toContain('stripper_clip');
    });
  });

  describe('Required Fields', () => {
    test('should have all required component schema fields', () => {
      expect(ammoContainerComponent).toHaveProperty('id');
      expect(ammoContainerComponent).toHaveProperty('description');
      expect(ammoContainerComponent).toHaveProperty('dataSchema');
    });

    test('should have valid schema reference', () => {
      expect(ammoContainerComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });
  });

  describe('Component Purpose', () => {
    test('description should indicate ammunition container', () => {
      const description = ammoContainerComponent.description.toLowerCase();
      expect(
        description.includes('ammunition') && description.includes('container')
      ).toBe(true);
    });

    test('description should mention portable or reload', () => {
      const description = ammoContainerComponent.description.toLowerCase();
      expect(
        description.includes('portable') || description.includes('reload')
      ).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should fail validation with invalid containerType', () => {
      const testData = {
        ammoType: '9mm',
        currentRounds: 30,
        maxCapacity: 30,
        containerType: 'backpack', // Invalid
      };

      const dataSchemaValidator = new Ajv().compile(
        ammoContainerComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });

    test('should fail validation with negative currentRounds', () => {
      const testData = {
        ammoType: '9mm',
        currentRounds: -5, // Invalid
        maxCapacity: 30,
        containerType: 'magazine',
      };

      const dataSchemaValidator = new Ajv().compile(
        ammoContainerComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });

    test('should fail validation with maxCapacity = 0', () => {
      const testData = {
        ammoType: '9mm',
        currentRounds: 0,
        maxCapacity: 0, // Invalid
        containerType: 'magazine',
      };

      const dataSchemaValidator = new Ajv().compile(
        ammoContainerComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });

    test('should pass validation with empty magazine', () => {
      const testData = {
        ammoType: '9mm',
        currentRounds: 0,
        maxCapacity: 15,
        containerType: 'magazine',
      };

      const dataSchemaValidator = new Ajv().compile(
        ammoContainerComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(true);
    });

    test('should pass validation with full magazine', () => {
      const testData = {
        ammoType: '.45ACP',
        currentRounds: 7,
        maxCapacity: 7,
        containerType: 'magazine',
      };

      const dataSchemaValidator = new Ajv().compile(
        ammoContainerComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(true);
    });

    test('should pass validation with speed_loader', () => {
      const testData = {
        ammoType: '.38Special',
        currentRounds: 6,
        maxCapacity: 6,
        containerType: 'speed_loader',
      };

      const dataSchemaValidator = new Ajv().compile(
        ammoContainerComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(true);
    });

    test('should pass validation with ammo_box', () => {
      const testData = {
        ammoType: '5.56mm',
        currentRounds: 200,
        maxCapacity: 200,
        containerType: 'ammo_box',
      };

      const dataSchemaValidator = new Ajv().compile(
        ammoContainerComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(true);
    });

    test('should pass validation with stripper_clip', () => {
      const testData = {
        ammoType: '7.62x54mm',
        currentRounds: 5,
        maxCapacity: 5,
        containerType: 'stripper_clip',
      };

      const dataSchemaValidator = new Ajv().compile(
        ammoContainerComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(true);
    });

    test('should fail validation with missing required field', () => {
      const testData = {
        ammoType: '9mm',
        currentRounds: 15,
        // Missing maxCapacity and containerType
      };

      const dataSchemaValidator = new Ajv().compile(
        ammoContainerComponent.dataSchema
      );
      expect(dataSchemaValidator(testData)).toBe(false);
    });
  });

  describe('Reload Workflow Integration', () => {
    test('should support decrementing currentRounds during reload', () => {
      const testData = {
        ammoType: '9mm',
        currentRounds: 30,
        maxCapacity: 30,
        containerType: 'magazine',
      };

      const dataSchemaValidator = new Ajv().compile(
        ammoContainerComponent.dataSchema
      );

      // Simulate reload (transfer 15 rounds to weapon)
      const afterReload = {
        ...testData,
        currentRounds: testData.currentRounds - 15,
      };

      expect(dataSchemaValidator(afterReload)).toBe(true);
    });

    test('should support empty container after full reload', () => {
      const testData = {
        ammoType: '9mm',
        currentRounds: 15,
        maxCapacity: 30,
        containerType: 'magazine',
      };

      const dataSchemaValidator = new Ajv().compile(
        ammoContainerComponent.dataSchema
      );

      // Simulate complete depletion
      const afterReload = {
        ...testData,
        currentRounds: 0,
      };

      expect(dataSchemaValidator(afterReload)).toBe(true);
    });
  });
});
