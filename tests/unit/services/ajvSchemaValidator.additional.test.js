import { describe, it, expect, beforeEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../testUtils.js';

const sampleSchema = {
  $id: 'test://schemas/sample',
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
  required: ['name'],
  additionalProperties: false,
};

const validData = { name: 'Alice' };
const invalidData = {};

describe('AjvSchemaValidator additional tests', () => {
  let validator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    validator = new AjvSchemaValidator(mockLogger);
  });

  describe('validate method', () => {
    it('returns schemaNotFound error when schema is missing', () => {
      const result = validator.validate('missing-schema', {});
      expect(result.isValid).toBe(false);
      expect(result.errors[0].keyword).toBe('schemaNotFound');
    });

    it('validates data against added schema', async () => {
      await validator.addSchema(sampleSchema, sampleSchema.$id);
      const result = validator.validate(sampleSchema.$id, validData);
      expect(result).toEqual({ isValid: true, errors: null });
    });

    it('returns validation errors for invalid data', async () => {
      await validator.addSchema(sampleSchema, sampleSchema.$id);
      const result = validator.validate(sampleSchema.$id, invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeInstanceOf(Array);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('removeSchema method', () => {
    it('removes an existing schema and returns true', async () => {
      await validator.addSchema(sampleSchema, sampleSchema.$id);
      const removed = validator.removeSchema(sampleSchema.$id);
      expect(removed).toBe(true);
      expect(validator.isSchemaLoaded(sampleSchema.$id)).toBe(false);
    });

    it('returns false for unknown schema id', () => {
      const result = validator.removeSchema('unknown-schema');
      expect(result).toBe(false);
    });

    it('returns false for invalid schema id', () => {
      expect(validator.removeSchema('')).toBe(false);
      expect(validator.removeSchema(null)).toBe(false);
    });
  });
});
