/**
 * @file Unit tests for component schema validation with validationRules
 * @description Tests validation of component schemas with optional validationRules property
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { readFile } from 'fs/promises';
import path from 'path';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

/**
 * Load a schema from the schemas directory
 *
 * @param {string} relativePath - Relative path to schema file
 * @returns {Promise<object>} Parsed schema
 */
async function loadSchema(relativePath) {
  const filePath = path.join('data', 'schemas', relativePath);
  const fileContents = await readFile(filePath, 'utf8');
  return JSON.parse(fileContents);
}

describe('Component Schema - validationRules Extension', () => {
  let validator;
  let mockLogger;

  beforeEach(async () => {
    mockLogger = createMockLogger();
    validator = new AjvSchemaValidator({ logger: mockLogger });

    // Load component schema
    const componentSchema = await loadSchema('component.schema.json');
    await validator.addSchema(
      componentSchema,
      'schema://living-narrative-engine/component.schema.json'
    );

    // Load common schema for references
    const commonSchema = await loadSchema('common.schema.json');
    await validator.addSchema(
      commonSchema,
      commonSchema.$id || 'schema://living-narrative-engine/common.schema.json'
    );
  });

  afterEach(() => {
    validator = null;
  });

  describe('Schema with valid validationRules', () => {
    it('should validate component with complete validationRules', () => {
      const componentWithRules = {
        id: 'test:component',
        description: 'Test component with validation rules',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string', enum: ['a', 'b', 'c'] },
          },
        },
        validationRules: {
          generateValidator: true,
          errorMessages: {
            invalidEnum: 'Invalid value: {{value}}',
            missingRequired: 'Missing: {{field}}',
            invalidType: 'Type error: {{field}}',
          },
          suggestions: {
            enableSimilarity: true,
            maxDistance: 3,
            maxSuggestions: 3,
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithRules
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeFalsy();
    });

    it('should validate component with partial validationRules (only generateValidator)', () => {
      const componentWithPartialRules = {
        id: 'test:component-partial',
        description: 'Test component with partial validation rules',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          generateValidator: false,
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithPartialRules
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeFalsy();
    });

    it('should validate component with only errorMessages', () => {
      const componentWithErrorMessages = {
        id: 'test:component-errors',
        description: 'Test component with error messages only',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          errorMessages: {
            invalidEnum: 'Custom enum error',
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithErrorMessages
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeFalsy();
    });

    it('should validate component with only suggestions', () => {
      const componentWithSuggestions = {
        id: 'test:component-suggestions',
        description: 'Test component with suggestions only',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          suggestions: {
            enableSimilarity: false,
            maxDistance: 5,
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithSuggestions
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeFalsy();
    });
  });

  describe('Schema without validationRules (backward compatibility)', () => {
    it('should validate component without validationRules', () => {
      const componentWithoutRules = {
        id: 'test:component-no-rules',
        description: 'Test component without validation rules',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithoutRules
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeFalsy();
    });

    it('should validate component with optional name field and no validationRules', () => {
      const componentWithName = {
        id: 'test:component-with-name',
        name: 'Test Component',
        description: 'Test component with name field',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithName
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeFalsy();
    });
  });

  describe('Schema with invalid validationRules', () => {
    it('should reject component with invalid generateValidator type', () => {
      const componentWithInvalidRules = {
        id: 'test:component-invalid',
        description: 'Test component with invalid validation rules',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          generateValidator: 'true', // Should be boolean
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithInvalidRules
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject component with invalid errorMessages structure', () => {
      const componentWithInvalidErrors = {
        id: 'test:component-invalid-errors',
        description: 'Test component with invalid error messages',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          errorMessages: {
            invalidEnum: 123, // Should be string
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithInvalidErrors
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject component with unknown errorMessage properties', () => {
      const componentWithUnknownErrors = {
        id: 'test:component-unknown-errors',
        description: 'Test component with unknown error properties',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          errorMessages: {
            unknownErrorType: 'Some error', // Not allowed
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithUnknownErrors
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject component with invalid suggestions configuration', () => {
      const componentWithInvalidSuggestions = {
        id: 'test:component-invalid-suggestions',
        description: 'Test component with invalid suggestions',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          suggestions: {
            maxDistance: 0, // Below minimum (1)
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithInvalidSuggestions
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject component with maxDistance above maximum', () => {
      const componentWithHighMaxDistance = {
        id: 'test:component-high-distance',
        description: 'Test component with high max distance',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          suggestions: {
            maxDistance: 15, // Above maximum (10)
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithHighMaxDistance
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject component with invalid maxSuggestions type', () => {
      const componentWithInvalidMaxSuggestions = {
        id: 'test:component-invalid-max',
        description: 'Test component with invalid max suggestions',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          suggestions: {
            maxSuggestions: '3', // Should be integer
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithInvalidMaxSuggestions
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject component with unknown validationRules properties', () => {
      const componentWithUnknownProps = {
        id: 'test:component-unknown-props',
        description: 'Test component with unknown validation properties',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          unknownProperty: true, // Not allowed
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithUnknownProps
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases and boundary values', () => {
    it('should validate with maxDistance at minimum boundary (1)', () => {
      const componentWithMinDistance = {
        id: 'test:component-min-distance',
        description: 'Test component with minimum distance',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          suggestions: {
            maxDistance: 1,
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithMinDistance
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeFalsy();
    });

    it('should validate with maxDistance at maximum boundary (10)', () => {
      const componentWithMaxDistance = {
        id: 'test:component-max-distance',
        description: 'Test component with maximum distance',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {
          suggestions: {
            maxDistance: 10,
          },
        },
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithMaxDistance
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeFalsy();
    });

    it('should validate with empty validationRules object', () => {
      const componentWithEmptyRules = {
        id: 'test:component-empty-rules',
        description: 'Test component with empty validation rules',
        dataSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
        validationRules: {},
      };

      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithEmptyRules
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeFalsy();
    });
  });
});
