/**
 * @file Test suite to validate the anatomy:requires_grabbing component definition.
 * @see data/mods/anatomy/components/requires_grabbing.component.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';

// --- Schemas to test against ---
import componentSchema from '../../../../../data/schemas/component.schema.json';
import commonSchema from '../../../../../data/schemas/common.schema.json';

// --- Component definition file to validate ---
import requiresGrabbingComponent from '../../../../../data/mods/anatomy/components/requires_grabbing.component.json';

/**
 * Test suite – anatomy:requires_grabbing Component Schema Validation.
 *
 * This suite validates that the anatomy:requires_grabbing component definition
 * conforms to the primary component schema and correctly validates
 * data instances for items that require grabbing appendages.
 */
describe('anatomy:requires_grabbing Component Definition', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validateComponentDefinition;
  /** @type {import('ajv').ValidateFunction} */
  let validateComponentData;

  beforeAll(() => {
    const ajv = new Ajv({
      schemas: [commonSchema],
      strict: true,
      allErrors: true,
    });
    addFormats(ajv);

    validateComponentDefinition = ajv.compile(componentSchema);
    validateComponentData = ajv.compile(requiresGrabbingComponent.dataSchema);
  });

  describe('Schema Validation', () => {
    test('should conform to the component definition schema', () => {
      const ok = validateComponentDefinition(requiresGrabbingComponent);
      if (!ok) {
        console.error(
          'Validation failed for requires_grabbing.component.json:',
          JSON.stringify(validateComponentDefinition.errors, null, 2)
        );
      }
      expect(ok).toBe(true);
    });

    test('should have correct component ID', () => {
      expect(requiresGrabbingComponent.id).toBe('anatomy:requires_grabbing');
    });

    test('should have a description', () => {
      expect(requiresGrabbingComponent.description).toBeDefined();
      expect(typeof requiresGrabbingComponent.description).toBe('string');
      expect(requiresGrabbingComponent.description.length).toBeGreaterThan(0);
    });

    test('should have valid schema reference', () => {
      expect(requiresGrabbingComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });
  });

  describe('Valid Component Data', () => {
    test('should validate one-handed item', () => {
      const data = { handsRequired: 1 };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate two-handed item', () => {
      const data = { handsRequired: 2 };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate worn item (zero hands)', () => {
      const data = { handsRequired: 0 };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate with minGripStrength', () => {
      const data = { handsRequired: 2, minGripStrength: 2.0 };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate heavy item requiring many hands', () => {
      // e.g., a battering ram requiring 4 appendages
      const data = { handsRequired: 4, minGripStrength: 4.0 };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate with zero minGripStrength', () => {
      const data = { handsRequired: 1, minGripStrength: 0 };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate large handsRequired values', () => {
      // e.g., a siege weapon requiring many operators
      const data = { handsRequired: 10 };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate decimal minGripStrength', () => {
      const data = { handsRequired: 1, minGripStrength: 0.5 };
      expect(validateComponentData(data)).toBe(true);
    });
  });

  describe('Invalid Component Data', () => {
    test('should reject missing handsRequired field', () => {
      const data = { minGripStrength: 1.0 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject non-integer handsRequired', () => {
      const data = { handsRequired: 1.5 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject string handsRequired', () => {
      const data = { handsRequired: '1' };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject negative handsRequired', () => {
      const data = { handsRequired: -1 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject negative minGripStrength', () => {
      const data = { handsRequired: 1, minGripStrength: -0.5 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject additional properties', () => {
      const data = { handsRequired: 1, extraField: true };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject empty object', () => {
      const data = {};
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject boolean handsRequired', () => {
      const data = { handsRequired: true };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject null handsRequired', () => {
      const data = { handsRequired: null };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject string minGripStrength', () => {
      const data = { handsRequired: 1, minGripStrength: '1.0' };
      expect(validateComponentData(data)).toBe(false);
    });
  });

  describe('Schema Structure', () => {
    test('should require handsRequired field', () => {
      expect(requiresGrabbingComponent.dataSchema.required).toContain(
        'handsRequired'
      );
    });

    test('should disallow additional properties', () => {
      expect(requiresGrabbingComponent.dataSchema.additionalProperties).toBe(
        false
      );
    });

    test('should define default value for handsRequired', () => {
      const props = requiresGrabbingComponent.dataSchema.properties;
      expect(props.handsRequired.default).toBe(1);
    });

    test('should set minimum for handsRequired', () => {
      expect(
        requiresGrabbingComponent.dataSchema.properties.handsRequired.minimum
      ).toBe(0);
    });

    test('should set minimum for minGripStrength', () => {
      expect(
        requiresGrabbingComponent.dataSchema.properties.minGripStrength.minimum
      ).toBe(0);
    });

    test('should define handsRequired as integer type', () => {
      expect(
        requiresGrabbingComponent.dataSchema.properties.handsRequired.type
      ).toBe('integer');
    });

    test('should define minGripStrength as number type', () => {
      expect(
        requiresGrabbingComponent.dataSchema.properties.minGripStrength.type
      ).toBe('number');
    });
  });

  describe('Required Fields', () => {
    test('should have all required component schema fields', () => {
      expect(requiresGrabbingComponent).toHaveProperty('id');
      expect(requiresGrabbingComponent).toHaveProperty('description');
      expect(requiresGrabbingComponent).toHaveProperty('dataSchema');
    });
  });

  describe('Edge Cases', () => {
    test('should not allow additional properties beyond schema', () => {
      const invalidComponent = {
        ...requiresGrabbingComponent,
        unknownProperty: 'invalid',
      };
      expect(validateComponentDefinition(invalidComponent)).toBe(false);
    });

    test('should fail validation without required id field', () => {
      const { id: _id, ...componentWithoutId } = requiresGrabbingComponent;
      expect(validateComponentDefinition(componentWithoutId)).toBe(false);
    });

    test('should fail validation without required description field', () => {
      const { description: _desc, ...componentWithoutDescription } =
        requiresGrabbingComponent;
      expect(validateComponentDefinition(componentWithoutDescription)).toBe(
        false
      );
    });

    test('should fail validation without required dataSchema field', () => {
      const { dataSchema: _schema, ...componentWithoutDataSchema } =
        requiresGrabbingComponent;
      expect(validateComponentDefinition(componentWithoutDataSchema)).toBe(
        false
      );
    });
  });
});
