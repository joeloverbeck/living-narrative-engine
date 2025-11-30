/**
 * @file Test suite to validate the weapons:weapon marker component definition.
 * @see data/mods/weapons/components/weapon.component.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';

// --- Schemas to test against ---
import componentSchema from '../../../../data/schemas/component.schema.json';
import commonSchema from '../../../../data/schemas/common.schema.json';

// --- Component definition file to validate ---
import weaponComponent from '../../../../data/mods/weapons/components/weapon.component.json';

/**
 * Test suite – weapons:weapon Marker Component Schema Validation.
 *
 * This suite validates that the weapons:weapon marker component definition
 * conforms to the primary component schema and follows the marker component pattern
 * established by items:item and items:portable.
 */
describe('weapons:weapon Component Definition', () => {
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
      const ok = validate(weaponComponent);

      if (!ok) {
        console.error(
          'Validation failed for weapon.component.json:',
          JSON.stringify(validate.errors, null, 2)
        );
      }

      expect(ok).toBe(true);
    });

    test('should have correct component ID', () => {
      expect(weaponComponent.id).toBe('weapons:weapon');
    });

    test('should have a description', () => {
      expect(weaponComponent.description).toBeDefined();
      expect(typeof weaponComponent.description).toBe('string');
      expect(weaponComponent.description.length).toBeGreaterThan(0);
    });
  });

  describe('Marker Component Pattern', () => {
    test('should be a marker component with empty dataSchema properties', () => {
      expect(weaponComponent.dataSchema).toBeDefined();
      expect(weaponComponent.dataSchema.type).toBe('object');
      expect(weaponComponent.dataSchema.properties).toEqual({});
      expect(weaponComponent.dataSchema.additionalProperties).toBe(false);
    });

    test('should follow the same pattern as items:item marker component', () => {
      // Marker components should have empty properties and disallow additional properties
      const hasEmptyProperties =
        Object.keys(weaponComponent.dataSchema.properties || {}).length === 0;
      const disallowsAdditionalProperties =
        weaponComponent.dataSchema.additionalProperties === false;

      expect(hasEmptyProperties).toBe(true);
      expect(disallowsAdditionalProperties).toBe(true);
    });
  });

  describe('Required Fields', () => {
    test('should have all required component schema fields', () => {
      expect(weaponComponent).toHaveProperty('id');
      expect(weaponComponent).toHaveProperty('description');
      expect(weaponComponent).toHaveProperty('dataSchema');
    });

    test('should have valid schema reference', () => {
      expect(weaponComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });
  });

  describe('Component Purpose', () => {
    test('description should indicate marker component purpose', () => {
      const description = weaponComponent.description.toLowerCase();
      expect(description).toContain('marker');
      expect(description).toContain('weapon');
    });

    test('description should mention required companion components', () => {
      const description = weaponComponent.description;
      expect(description).toContain('items:item');
      expect(description).toContain('items:portable');
      expect(description).toContain('anatomy:requires_grabbing');
    });
  });

  describe('Edge Cases', () => {
    test('should not allow additional properties beyond schema', () => {
      const invalidComponent = {
        ...weaponComponent,
        unknownProperty: 'invalid',
      };

      expect(validate(invalidComponent)).toBe(false);
    });

    test('should fail validation without required id field', () => {
      const { id, ...componentWithoutId } = weaponComponent;

      expect(validate(componentWithoutId)).toBe(false);
    });

    test('should fail validation without required description field', () => {
      const { description, ...componentWithoutDescription } = weaponComponent;

      expect(validate(componentWithoutDescription)).toBe(false);
    });

    test('should fail validation without required dataSchema field', () => {
      const { dataSchema, ...componentWithoutDataSchema } = weaponComponent;

      expect(validate(componentWithoutDataSchema)).toBe(false);
    });
  });
});
