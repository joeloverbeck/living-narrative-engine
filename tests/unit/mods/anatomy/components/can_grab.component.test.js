/**
 * @file Test suite to validate the anatomy:can_grab component definition.
 * @see data/mods/anatomy/components/can_grab.component.json
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, test } from '@jest/globals';

// --- Schemas to test against ---
import componentSchema from '../../../../../data/schemas/component.schema.json';
import commonSchema from '../../../../../data/schemas/common.schema.json';

// --- Component definition file to validate ---
import canGrabComponent from '../../../../../data/mods/anatomy/components/can_grab.component.json';

/**
 * Test suite – anatomy:can_grab Component Schema Validation.
 *
 * This suite validates that the anatomy:can_grab component definition
 * conforms to the primary component schema and correctly validates
 * data instances for appendages capable of grabbing/holding items.
 */
describe('anatomy:can_grab Component Definition', () => {
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
    validateComponentData = ajv.compile(canGrabComponent.dataSchema);
  });

  describe('Schema Validation', () => {
    test('should conform to the component definition schema', () => {
      const ok = validateComponentDefinition(canGrabComponent);
      if (!ok) {
        console.error(
          'Validation failed for can_grab.component.json:',
          JSON.stringify(validateComponentDefinition.errors, null, 2)
        );
      }
      expect(ok).toBe(true);
    });

    test('should have correct component ID', () => {
      expect(canGrabComponent.id).toBe('anatomy:can_grab');
    });

    test('should have a description', () => {
      expect(canGrabComponent.description).toBeDefined();
      expect(typeof canGrabComponent.description).toBe('string');
      expect(canGrabComponent.description.length).toBeGreaterThan(0);
    });

    test('should have valid schema reference', () => {
      expect(canGrabComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });
  });

  describe('Valid Component Data', () => {
    test('should validate complete component data', () => {
      const data = {
        locked: false,
        heldItemId: null,
        gripStrength: 1.0,
      };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate minimal required fields', () => {
      const data = { locked: false };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate locked: true with heldItemId string', () => {
      const data = {
        locked: true,
        heldItemId: 'weapons:longsword_001',
      };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate with zero gripStrength', () => {
      const data = {
        locked: false,
        gripStrength: 0,
      };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate locked: true state', () => {
      const data = { locked: true };
      expect(validateComponentData(data)).toBe(true);
    });

    test('should validate high gripStrength values', () => {
      const data = {
        locked: false,
        gripStrength: 100,
      };
      expect(validateComponentData(data)).toBe(true);
    });
  });

  describe('Invalid Component Data', () => {
    test('should reject missing locked field', () => {
      const data = { gripStrength: 1.0 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject non-boolean locked', () => {
      const data = { locked: 'false' };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject locked as number', () => {
      const data = { locked: 0 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject heldItemId as number', () => {
      const data = { locked: false, heldItemId: 123 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject heldItemId as object', () => {
      const data = { locked: false, heldItemId: { id: 'test' } };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject negative gripStrength', () => {
      const data = { locked: false, gripStrength: -1 };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject gripStrength as string', () => {
      const data = { locked: false, gripStrength: '1.0' };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject additional properties', () => {
      const data = { locked: false, extraField: true };
      expect(validateComponentData(data)).toBe(false);
    });

    test('should reject empty object', () => {
      const data = {};
      expect(validateComponentData(data)).toBe(false);
    });
  });

  describe('Schema Structure', () => {
    test('should require locked field', () => {
      expect(canGrabComponent.dataSchema.required).toContain('locked');
    });

    test('should disallow additional properties', () => {
      expect(canGrabComponent.dataSchema.additionalProperties).toBe(false);
    });

    test('should define default values', () => {
      const props = canGrabComponent.dataSchema.properties;
      expect(props.locked.default).toBe(false);
      expect(props.heldItemId.default).toBe(null);
      expect(props.gripStrength.default).toBe(1.0);
    });

    test('should set minimum for gripStrength', () => {
      expect(canGrabComponent.dataSchema.properties.gripStrength.minimum).toBe(
        0
      );
    });

    test('should allow heldItemId to be string or null', () => {
      const heldItemIdType = canGrabComponent.dataSchema.properties.heldItemId.type;
      expect(heldItemIdType).toEqual(['string', 'null']);
    });
  });

  describe('Required Fields', () => {
    test('should have all required component schema fields', () => {
      expect(canGrabComponent).toHaveProperty('id');
      expect(canGrabComponent).toHaveProperty('description');
      expect(canGrabComponent).toHaveProperty('dataSchema');
    });
  });

  describe('Edge Cases', () => {
    test('should not allow additional properties beyond schema', () => {
      const invalidComponent = {
        ...canGrabComponent,
        unknownProperty: 'invalid',
      };
      expect(validateComponentDefinition(invalidComponent)).toBe(false);
    });

    test('should fail validation without required id field', () => {
      const { id: _id, ...componentWithoutId } = canGrabComponent;
      expect(validateComponentDefinition(componentWithoutId)).toBe(false);
    });

    test('should fail validation without required description field', () => {
      const { description: _desc, ...componentWithoutDescription } =
        canGrabComponent;
      expect(validateComponentDefinition(componentWithoutDescription)).toBe(
        false
      );
    });

    test('should fail validation without required dataSchema field', () => {
      const { dataSchema: _schema, ...componentWithoutDataSchema } =
        canGrabComponent;
      expect(validateComponentDefinition(componentWithoutDataSchema)).toBe(
        false
      );
    });
  });
});
