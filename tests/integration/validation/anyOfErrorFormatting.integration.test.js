/**
 * @file anyOfErrorFormatting.integration.test.js
 * @description Integration tests for enhanced AnyOf error formatting in the validation pipeline
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';
import {
  formatAnyOfErrors,
  formatAjvErrorsEnhanced,
} from '../../../src/utils/ajvAnyOfErrorFormatter.js';

/**
 * Creates a mock logger for testing.
 *
 * @returns {object} mock logger
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Builds a synthetic anyOf schema with many operation branches to trigger
 * high-volume Ajv error cascades during validation.
 *
 * @param {number} [branchCount] - Number of decoy operation branches.
 * @returns {object} JSON schema definition.
 */
function createHighVolumeOperationSchema(branchCount = 120) {
  const anyOfBranches = [];

  for (let i = 0; i < branchCount; i++) {
    anyOfBranches.push({
      type: 'object',
      properties: {
        type: { const: `BULK_OPERATION_${i}` },
        parameters: {
          type: 'object',
          properties: {
            [`field_${i}`]: { type: 'string' },
            [`value_${i}`]: { type: 'number' },
          },
          required: [`field_${i}`, `value_${i}`],
          additionalProperties: false,
        },
      },
      required: ['type', 'parameters'],
      additionalProperties: false,
    });
  }

  anyOfBranches.push({
    type: 'object',
    properties: {
      type: { const: 'TARGET_OPERATION' },
      parameters: {
        type: 'object',
        properties: {
          entity_ref: { type: 'string', minLength: 1 },
          result_variable: { type: 'string', minLength: 1 },
          default_value: { type: 'string' },
        },
        required: ['entity_ref', 'result_variable'],
        additionalProperties: false,
      },
    },
    required: ['type', 'parameters'],
    additionalProperties: false,
  });

  return {
    $id: 'schema://test/high-volume.schema.json',
    type: 'object',
    anyOf: anyOfBranches,
  };
}

describe('AnyOf Error Formatting Integration', () => {
  let validator;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    validator = new AjvSchemaValidator({ logger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Operation validation with anyOf schemas', () => {
    beforeEach(async () => {
      // Create a schema with multiple operation types using anyOf
      const operationSchema = {
        $id: 'schema://test/operation.schema.json',
        type: 'object',
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'moveEntity' },
              parameters: {
                type: 'object',
                properties: {
                  entityId: { type: 'string' },
                  targetPosition: {
                    type: 'object',
                    properties: {
                      x: { type: 'number' },
                      y: { type: 'number' },
                    },
                    required: ['x', 'y'],
                  },
                },
                required: ['entityId', 'targetPosition'],
              },
            },
            required: ['type', 'parameters'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              type: { const: 'attackEntity' },
              parameters: {
                type: 'object',
                properties: {
                  attackerId: { type: 'string' },
                  targetId: { type: 'string' },
                  damage: { type: 'number', minimum: 0 },
                },
                required: ['attackerId', 'targetId', 'damage'],
              },
            },
            required: ['type', 'parameters'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              type: { const: 'useItem' },
              parameters: {
                type: 'object',
                properties: {
                  itemId: { type: 'string' },
                  targetId: { type: 'string' },
                  quantity: { type: 'integer', minimum: 1 },
                },
                required: ['itemId'],
              },
            },
            required: ['type', 'parameters'],
            additionalProperties: false,
          },
        ],
      };

      await validator.addSchema(operationSchema, operationSchema.$id);
    });

    it('should provide clear error message for valid type with invalid parameters', () => {
      const data = {
        type: 'moveEntity',
        parameters: {
          entityId: 'entity123',
          // Missing targetPosition
        },
      };

      const result = validator.validate(
        'schema://test/operation.schema.json',
        data
      );
      expect(result.isValid).toBe(false);

      const formattedError = validator.formatAjvErrors(result.errors, data);
      expect(formattedError).toContain("Operation type 'moveEntity'");
      expect(formattedError).toContain('targetPosition');
      expect(formattedError).toContain('Missing required property');
    });

    it('should provide helpful message for unknown operation type', () => {
      const data = {
        type: 'unknownOperation',
        parameters: {},
      };

      const result = validator.validate(
        'schema://test/operation.schema.json',
        data
      );
      expect(result.isValid).toBe(false);

      const formattedError = validator.formatAjvErrors(result.errors, data);
      expect(formattedError).toContain(
        "Unknown or invalid operation type: 'unknownOperation'"
      );
      expect(formattedError).toContain('moveEntity');
      expect(formattedError).toContain('attackEntity');
      expect(formattedError).toContain('useItem');
    });

    it('should handle missing type field gracefully', () => {
      const data = {
        parameters: {
          entityId: 'entity123',
        },
      };

      const result = validator.validate(
        'schema://test/operation.schema.json',
        data
      );
      expect(result.isValid).toBe(false);

      const formattedError = validator.formatAjvErrors(result.errors, data);
      expect(formattedError).toContain('Missing operation type');
      expect(formattedError).toContain('Common operation types');
    });

    it('should handle additional properties error correctly', () => {
      const data = {
        type: 'moveEntity',
        parameters: {
          entityId: 'entity123',
          targetPosition: { x: 10, y: 20 },
        },
        extraField: 'should not be here',
      };

      const result = validator.validate(
        'schema://test/operation.schema.json',
        data
      );
      expect(result.isValid).toBe(false);

      const formattedError = validator.formatAjvErrors(result.errors, data);
      expect(formattedError).toContain("Operation type 'moveEntity'");
      expect(formattedError).toContain("Unexpected property 'extraField'");
    });

    it('should handle type mismatches in parameters', () => {
      const data = {
        type: 'attackEntity',
        parameters: {
          attackerId: 'attacker123',
          targetId: 'target456',
          damage: 'not-a-number', // Should be number
        },
      };

      const result = validator.validate(
        'schema://test/operation.schema.json',
        data
      );
      expect(result.isValid).toBe(false);

      const formattedError = validator.formatAjvErrors(result.errors, data);
      expect(formattedError).toContain("Operation type 'attackEntity'");
      expect(formattedError).toContain("Expected type 'number'");
      expect(formattedError).toContain('damage');
    });
  });

  describe('Integration with validateAgainstSchema utility', () => {
    beforeEach(async () => {
      const schema = {
        $id: 'schema://test/complex.schema.json',
        type: 'object',
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'typeA' },
              value: { type: 'string' },
            },
            required: ['type', 'value'],
          },
          {
            type: 'object',
            properties: {
              type: { const: 'typeB' },
              value: { type: 'number' },
            },
            required: ['type', 'value'],
          },
        ],
      };

      await validator.addSchema(schema, schema.$id);
    });

    it('should throw with enhanced error message on validation failure', () => {
      const data = {
        type: 'typeA',
        value: 123, // Should be string for typeA
      };

      expect(() => {
        validateAgainstSchema(
          validator,
          'schema://test/complex.schema.json',
          data,
          logger,
          {
            failureThrowMessage: 'Validation failed',
            appendErrorDetails: true,
          }
        );
      }).toThrow(/Operation type 'typeA'/);
    });

    it('should include formatted details in thrown error', () => {
      const data = {
        type: 'unknownType',
        value: 'test',
      };

      let thrownError;
      try {
        validateAgainstSchema(
          validator,
          'schema://test/complex.schema.json',
          data,
          logger,
          {
            failureThrowMessage: 'Validation failed',
            appendErrorDetails: true,
          }
        );
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.message).toContain('Validation failed');
      expect(thrownError.message).toContain(
        'Unknown or invalid operation type'
      );
      expect(thrownError.message).toContain('unknownType');
    });
  });

  describe('Large error cascade handling', () => {
    beforeEach(async () => {
      // Create a schema that will generate many errors
      const properties = {};
      const anyOfSchemas = [];

      // Create 20 different operation types with different requirements
      for (let i = 0; i < 20; i++) {
        anyOfSchemas.push({
          type: 'object',
          properties: {
            type: { const: `operation${i}` },
            parameters: {
              type: 'object',
              properties: {
                [`field${i}`]: { type: 'string' },
                [`value${i}`]: { type: 'number' },
              },
              required: [`field${i}`, `value${i}`],
            },
          },
          required: ['type', 'parameters'],
          additionalProperties: false,
        });
      }

      const largeSchema = {
        $id: 'schema://test/large.schema.json',
        type: 'object',
        anyOf: anyOfSchemas,
      };

      await validator.addSchema(largeSchema, largeSchema.$id);
    });

    it('should handle cascade of errors from multiple anyOf branches', () => {
      const data = {
        type: 'operation5',
        parameters: {
          field5: 'correct',
          // Missing value5
        },
      };

      const result = validator.validate(
        'schema://test/large.schema.json',
        data
      );
      expect(result.isValid).toBe(false);

      // Should have many errors (one for each anyOf branch)
      expect(result.errors.length).toBeGreaterThan(20);

      // But formatted output should be concise
      const formattedError = validator.formatAjvErrors(result.errors, data);
      expect(formattedError).toContain("Operation type 'operation5'");
      expect(formattedError).toContain('value5');
      expect(formattedError).toContain('Missing required property');

      // Should not show errors from other operation types
      expect(formattedError).not.toContain('operation1');
      expect(formattedError).not.toContain('operation10');
    });

    it('should provide summary when no type matches', () => {
      const data = {
        type: 'completelyInvalid',
        randomField: 'value',
      };

      const result = validator.validate(
        'schema://test/large.schema.json',
        data
      );
      expect(result.isValid).toBe(false);

      const formattedError = validator.formatAjvErrors(result.errors, data);
      expect(formattedError).toContain(
        "Unknown or invalid operation type: 'completelyInvalid'"
      );
      expect(formattedError).toContain('Valid operation types include');
      expect(formattedError).toContain('operation0');
      // Should limit the display
      expect(formattedError).toMatch(/\.\.\. and \d+ more/);
    });
  });

  describe('Character builder validation scenarios', () => {
    beforeEach(async () => {
      const characterConceptSchema = {
        $id: 'schema://living-narrative-engine/character-concept.schema.json',
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          coreMotivations: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['id', 'name'],
      };

      const thematicDirectionSchema = {
        $id: 'schema://living-narrative-engine/thematic-direction.schema.json',
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          themes: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['id', 'title'],
      };

      await validator.addSchema(
        characterConceptSchema,
        characterConceptSchema.$id
      );
      await validator.addSchema(
        thematicDirectionSchema,
        thematicDirectionSchema.$id
      );
    });

    it('should format character concept validation errors clearly', () => {
      const data = {
        id: 'concept-1',
        // Missing required 'name'
        coreMotivations: [123, 456], // Should be strings
      };

      const result = validator.validate(
        'schema://living-narrative-engine/character-concept.schema.json',
        data
      );
      expect(result.isValid).toBe(false);

      const formattedError = validator.formatAjvErrors(result.errors, data);
      expect(formattedError).toContain('Validation errors');
      expect(formattedError).toContain("Missing required property 'name'");
      expect(formattedError).toContain("Expected type 'string'");
    });

    it('should format thematic direction validation errors clearly', () => {
      const data = {
        title: 'My Theme',
        // Missing required 'id'
        themes: 'should-be-array', // Should be array
      };

      const result = validator.validate(
        'schema://living-narrative-engine/thematic-direction.schema.json',
        data
      );
      expect(result.isValid).toBe(false);

      const formattedError = validator.formatAjvErrors(result.errors, data);
      expect(formattedError).toContain("Missing required property 'id'");
      expect(formattedError).toContain("Expected type 'array'");
    });
  });

  describe('High volume structural guidance', () => {
    const schemaId = 'schema://test/high-volume.schema.json';

    beforeEach(async () => {
      await validator.addSchema(createHighVolumeOperationSchema(140), schemaId);
    });

    it('provides actionable guidance when entity_id is supplied instead of entity_ref', () => {
      const data = {
        type: 'TARGET_OPERATION',
        parameters: {
          entity_id: 'npc-001',
        },
      };

      const result = validator.validate(schemaId, data);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(100);

      const formattedError = validator.formatAjvErrors(result.errors, data);
      expect(formattedError).toContain(
        "Operation type 'TARGET_OPERATION' has invalid parameters"
      );
      expect(formattedError).toContain('entity_id');
      expect(formattedError).toContain('"entity_id" should be "entity_ref"');
    });

    it('detects missing type when cascades exceed one hundred errors', () => {
      const data = {
        parameters: {
          someField: 'npc-001', // Changed from entity_id to avoid pattern detection
        },
      };

      const result = validator.validate(schemaId, data);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(100);

      const augmentedErrors = [
        ...result.errors,
        {
          instancePath: '/type',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'const',
          params: { allowedValue: 'BULK_OPERATION_0' },
          message: 'must be equal to constant',
        },
      ];

      const formattedError = formatAjvErrorsEnhanced(augmentedErrors, data);
      // Pattern detection now provides more specific message
      expect(formattedError).toContain('Missing operation type');
      expect(formattedError).toContain('this operation needs a "type" field');
    });

    it('detects non-string type fields inside large validation cascades', () => {
      const data = {
        type: 42,
        parameters: {
          someParam: 'npc-001', // Changed from entity_id to avoid pattern detection
        },
      };

      const result = validator.validate(schemaId, data);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(100);

      const formattedError = formatAjvErrorsEnhanced(result.errors, data);
      // With >100 errors and non-string type, should get the fallback message
      expect(formattedError).toContain('Invalid "type" field value');
      expect(formattedError).toContain('must be a string');
    });
  });

  describe('Enum guidance formatting', () => {
    const schemaId = 'schema://test/perception-enum.schema.json';

    beforeEach(async () => {
      const perceptionSchema = {
        $id: schemaId,
        type: 'object',
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'DISPATCH_PERCEPTIBLE_EVENT' },
              parameters: {
                type: 'object',
                properties: {
                  perception_type: {
                    type: 'string',
                    enum: ['speech_local', 'thought_internal'],
                  },
                },
                required: ['perception_type'],
                additionalProperties: false,
              },
            },
            required: ['type', 'parameters'],
            additionalProperties: false,
          },
        ],
      };

      await validator.addSchema(perceptionSchema, schemaId);
    });

    it('adds remediation hints for perception_type enum failures', () => {
      const data = {
        type: 'DISPATCH_PERCEPTIBLE_EVENT',
        parameters: {
          perception_type: 'invalid_value',
        },
      };

      const result = validator.validate(schemaId, data);
      expect(result.isValid).toBe(false);

      const formattedError = validator.formatAjvErrors(result.errors, data);
      expect(formattedError).toContain("Invalid enum value 'invalid_value'");
      expect(formattedError).toContain('💡 FIX:');
      expect(formattedError).toContain(
        'data/schemas/operations/dispatchPerceptibleEvent.schema.json'
      );
      expect(formattedError).toContain('perception_type');
    });
  });

  describe('Direct formatter edge cases', () => {
    it('infers intended operation when grouped errors indicate the closest match', () => {
      const fabricatedErrors = [
        {
          instancePath: '',
          schemaPath: '#/anyOf/0/properties/type/const',
          keyword: 'customKeyword',
          params: { allowedValue: 'INFER_OPERATION' },
          message: 'custom type discriminator failed',
        },
        {
          instancePath: '/parameters',
          schemaPath: '#/anyOf/0/properties/parameters/required',
          keyword: 'required',
          params: { missingProperty: 'entity_ref' },
          message: "must have required property 'entity_ref'",
        },
        {
          instancePath: '',
          schemaPath: '#/anyOf',
          keyword: 'anyOf',
          params: {},
          message: 'must match a schema in anyOf',
        },
      ];

      const formattedError = formatAnyOfErrors(fabricatedErrors, {
        parameters: {},
      });

      expect(formattedError).toContain(
        "Operation type 'INFER_OPERATION' validation failed:"
      );
      expect(formattedError).toContain(
        "Missing required property 'entity_ref'"
      );
    });

    it('guides macro references when validation cannot determine an operation type', () => {
      const fabricatedErrors = [
        {
          instancePath: '',
          schemaPath: '#/anyOf',
          keyword: 'anyOf',
          params: {},
          message: 'must match a schema in anyOf',
        },
      ];

      const formattedError = formatAnyOfErrors(fabricatedErrors, {
        macro: 'core:sample_macro',
      });

      expect(formattedError).toContain('Invalid macro reference format detected.');
      expect(formattedError).toContain(
        'Do NOT include a "type" field with macro references.'
      );
    });
  });
});
