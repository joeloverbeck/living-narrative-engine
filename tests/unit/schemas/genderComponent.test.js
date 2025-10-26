import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, test, expect } from '@jest/globals';
import commonSchema from '../../../data/schemas/common.schema.json';

/**
 * Test suite for core:gender component schema validation
 *
 * @see data/mods/core/components/gender.component.json
 */
describe('Gender Component Schema Validation', () => {
  let ajv;
  let validator;

  beforeAll(() => {
    // Set up Ajv instance
    ajv = new Ajv({ strict: true, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(commonSchema, commonSchema.$id);

    // Load and compile gender component schema
    const componentPath = path.resolve(
      __dirname,
      '../../../data/mods/core/components/gender.component.json'
    );
    const component = JSON.parse(fs.readFileSync(componentPath, 'utf8'));
    const dataSchema = { ...component.dataSchema, $id: component.id };
    validator = ajv.compile(dataSchema);
  });

  describe('Valid Gender Values', () => {
    test('should validate male gender', () => {
      const validData = { value: 'male' };
      const result = validator(validData);

      expect(result).toBe(true);
      expect(validator.errors).toBeNull();
    });

    test('should validate female gender', () => {
      const validData = { value: 'female' };
      const result = validator(validData);

      expect(result).toBe(true);
      expect(validator.errors).toBeNull();
    });

    test('should validate neutral gender', () => {
      const validData = { value: 'neutral' };
      const result = validator(validData);

      expect(result).toBe(true);
      expect(validator.errors).toBeNull();
    });
  });

  describe('Invalid Gender Values', () => {
    test('should reject invalid gender value', () => {
      const invalidData = { value: 'invalid' };
      const result = validator(invalidData);

      expect(result).toBe(false);
      expect(validator.errors).not.toBeNull();
      expect(validator.errors).toHaveLength(1);
      expect(validator.errors[0].keyword).toBe('enum');
    });

    test('should reject numeric gender value', () => {
      const invalidData = { value: 123 };
      const result = validator(invalidData);

      expect(result).toBe(false);
      expect(validator.errors).not.toBeNull();
    });

    test('should reject empty string gender value', () => {
      const invalidData = { value: '' };
      const result = validator(invalidData);

      expect(result).toBe(false);
      expect(validator.errors).not.toBeNull();
    });
  });

  describe('Required Field Validation', () => {
    test('should require value field', () => {
      const missingValue = {};
      const result = validator(missingValue);

      expect(result).toBe(false);
      expect(validator.errors).not.toBeNull();
      expect(validator.errors).toHaveLength(1);
      expect(validator.errors[0].keyword).toBe('required');
      expect(validator.errors[0].params.missingProperty).toBe('value');
    });

    test('should reject null value field', () => {
      const nullValue = { value: null };
      const result = validator(nullValue);

      expect(result).toBe(false);
      expect(validator.errors).not.toBeNull();
    });

    test('should reject undefined value field', () => {
      const undefinedValue = { value: undefined };
      const result = validator(undefinedValue);

      expect(result).toBe(false);
      expect(validator.errors).not.toBeNull();
    });
  });

  describe('Additional Properties Validation', () => {
    test('should reject additional properties', () => {
      const extraProps = { value: 'male', extraField: 'not allowed' };
      const result = validator(extraProps);

      expect(result).toBe(false);
      expect(validator.errors).not.toBeNull();
      expect(validator.errors.some(err => err.keyword === 'additionalProperties')).toBe(true);
    });

    test('should reject multiple additional properties', () => {
      const extraProps = {
        value: 'female',
        extraField1: 'not allowed',
        extraField2: 'also not allowed'
      };
      const result = validator(extraProps);

      expect(result).toBe(false);
      expect(validator.errors).not.toBeNull();
    });
  });

  describe('Type Validation', () => {
    test('should reject object as value', () => {
      const invalidData = { value: { nested: 'object' } };
      const result = validator(invalidData);

      expect(result).toBe(false);
      expect(validator.errors).not.toBeNull();
    });

    test('should reject array as value', () => {
      const invalidData = { value: ['male'] };
      const result = validator(invalidData);

      expect(result).toBe(false);
      expect(validator.errors).not.toBeNull();
    });

    test('should reject boolean as value', () => {
      const invalidData = { value: true };
      const result = validator(invalidData);

      expect(result).toBe(false);
      expect(validator.errors).not.toBeNull();
    });
  });
});
