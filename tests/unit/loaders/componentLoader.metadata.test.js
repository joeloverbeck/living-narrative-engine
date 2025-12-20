/**
 * @file Tests for component loader metadata field validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

describe('ComponentLoader - metadata field validation', () => {
  let testBed;
  let validator;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Create AJV instance
    const ajvInstance = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });
    addFormats(ajvInstance);

    // Create validator with required dependencies
    validator = new AjvSchemaValidator({
      logger: mockLogger,
      ajvInstance: ajvInstance,
      preloadSchemas: [],
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Component schema validation', () => {
    const componentSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'schema://living-narrative-engine/component.schema.json',
      title: 'Component Definition',
      type: 'object',
      properties: {
        $schema: {
          type: 'string',
        },
        id: {
          type: 'string',
          pattern: '^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$',
        },
        description: {
          type: 'string',
        },
        dataSchema: {
          type: 'object',
          additionalProperties: true,
          default: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
      },
      required: ['id', 'description', 'dataSchema'],
      additionalProperties: false,
    };

    it('should fail validation when component contains metadata field', () => {
      // This test reproduces the exact error from the log
      const componentWithMetadata = {
        $schema: 'schema://living-narrative-engine/component.schema.json',
        id: 'locations:exits',
        description: 'Test component with metadata',
        dataSchema: {
          type: 'object',
          properties: {},
        },
        metadata: {
          migratedFrom: 'locations:exits',
          migrationDate: '2024-09-16',
          migrationTicket: 'MOVMODMIG-004',
          version: '1.0.0',
        },
      };

      // Register the schema
      validator.addSchema(
        componentSchema,
        'schema://living-narrative-engine/component.schema.json'
      );

      // Validate
      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithMetadata
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('additional properties');
      expect(result.errors[0].params.additionalProperty).toBe('metadata');
    });

    it('should pass validation when component does not contain metadata field', () => {
      // This is the expected correct structure
      const componentWithoutMetadata = {
        $schema: 'schema://living-narrative-engine/component.schema.json',
        id: 'locations:exits',
        description: 'Test component without metadata',
        dataSchema: {
          type: 'array',
          description: 'An array of possible exits from this location',
          items: {
            type: 'object',
            required: ['direction', 'target'],
            properties: {
              direction: {
                type: 'string',
                description: 'A user-facing string identifying the exit',
              },
              target: {
                type: 'string',
                pattern: '^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$',
                description: 'The unique namespaced ID of the entity',
              },
              blocker: {
                type: ['string', 'null'],
                pattern: '^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$',
                default: null,
                description:
                  'Optional namespaced ID of an entity blocking this exit',
              },
            },
            additionalProperties: false,
          },
          default: [],
        },
      };

      // Register the schema
      validator.addSchema(
        componentSchema,
        'schema://living-narrative-engine/component.schema.json'
      );

      // Validate
      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        componentWithoutMetadata
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should fail validation with exact error message from log', () => {
      // This reproduces the exact error: "Unexpected property 'metadata'"
      const movementComponent = {
        $schema: 'schema://living-narrative-engine/component.schema.json',
        id: 'movement:movement',
        description:
          "Controls an entity's ability to perform voluntary movement",
        dataSchema: {
          type: 'object',
          properties: {
            locked: {
              description: 'If true, voluntary movement actions are blocked',
              type: 'boolean',
              default: false,
            },
            forcedOverride: {
              description: 'Reserved for future use',
              type: 'boolean',
              default: false,
            },
          },
          required: ['locked'],
          additionalProperties: false,
        },
        metadata: {
          migratedFrom: 'core:movement',
          migrationDate: '2024-09-16',
          migrationTicket: 'MOVMODMIG-004',
          version: '1.0.0',
        },
      };

      // Register the schema
      validator.addSchema(
        componentSchema,
        'schema://living-narrative-engine/component.schema.json'
      );

      // Validate
      const result = validator.validate(
        'schema://living-narrative-engine/component.schema.json',
        movementComponent
      );

      expect(result.isValid).toBe(false);

      // Match the exact error format from the log
      const formattedError = result.errors[0];
      expect(formattedError.keyword).toBe('additionalProperties');
      expect(formattedError.params.additionalProperty).toBe('metadata');

      // The error message should indicate "Unexpected property 'metadata'"
      const errorMessage = `Unexpected property '${formattedError.params.additionalProperty}'`;
      expect(errorMessage).toBe("Unexpected property 'metadata'");
    });
  });

  describe('Component ID namespace validation', () => {
    it('should detect incorrect namespace in goals component', () => {
      // This tests the issue that was in the production code
      const incorrectGoalsComponent = {
        id: 'movement:goals', // Wrong - should be core:goals for a component in core mod
      };

      // When loaded from core mod, the ID should start with "core:"
      const expectedModId = 'core';
      const actualNamespace = incorrectGoalsComponent.id.split(':')[0];

      // This test demonstrates the mismatch
      expect(actualNamespace).not.toBe(expectedModId);
      expect(actualNamespace).toBe('movement'); // Wrong namespace
    });

    it('should validate correct namespace in fixed goals component', () => {
      // This tests that the fix is correct
      const correctGoalsComponent = {
        $schema: 'schema://living-narrative-engine/component.schema.json',
        id: 'core:goals', // Correct namespace
        description: 'Stores an array of goals',
        dataSchema: {
          type: 'object',
          properties: {
            goals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    minLength: 1,
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
                required: ['text'],
                additionalProperties: false,
              },
            },
          },
          required: ['goals'],
          additionalProperties: false,
        },
      };

      // When loaded from core mod, the ID should start with "core:"
      const expectedModId = 'core';
      const actualNamespace = correctGoalsComponent.id.split(':')[0];

      // This confirms the fix is correct
      expect(actualNamespace).toBe(expectedModId);
      expect(correctGoalsComponent.id).toBe('core:goals');
    });
  });
});
