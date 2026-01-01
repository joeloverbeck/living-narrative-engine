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

  describe('Coverage Enhancement - Uncovered Lines', () => {
    describe('Line 84 - Empty instancePath fallback', () => {
      it('should use "field" fallback when instancePath is empty for enum errors', () => {
        const errors = [
          {
            keyword: 'enum',
            schemaPath: '#/enum',
            instancePath: '', // Empty path - triggers || 'field' fallback
            params: { allowedValues: ['A', 'B', 'C'] },
            data: 'INVALID',
          },
        ];

        const formattedError = formatAnyOfErrors(errors, { value: 'INVALID' });

        expect(formattedError).toContain("Invalid enum value 'INVALID'");
        expect(formattedError).toContain('Allowed values: [A, B, C]');
      });
    });

    describe('Line 458 - No validation errors', () => {
      it('should return "No validation errors" when errors is null', () => {
        const result = formatAnyOfErrors(null, {});
        expect(result).toBe('No validation errors');
      });

      it('should return "No validation errors" when errors is empty array', () => {
        const result = formatAnyOfErrors([], {});
        expect(result).toBe('No validation errors');
      });
    });

    describe('Lines 502-504 - entity_id fallback detection', () => {
      const schemaId = 'schema://test/entity-id-fallback.schema.json';

      beforeEach(async () => {
        // Create schema with many branches to generate >100 errors
        const anyOfBranches = Array.from({ length: 100 }, (_, i) => ({
          type: 'object',
          properties: {
            type: { const: `OPERATION_${i}` },
            parameters: {
              type: 'object',
              properties: {
                [`field_${i}`]: { type: 'string' },
              },
              required: [`field_${i}`],
              additionalProperties: false,
            },
          },
          required: ['type', 'parameters'],
          additionalProperties: false,
        }));

        // Add target operation that expects entity_ref
        anyOfBranches.push({
          type: 'object',
          properties: {
            type: { const: 'TARGET_OP' },
            parameters: {
              type: 'object',
              properties: {
                entity_ref: { type: 'string' },
              },
              required: ['entity_ref'],
              additionalProperties: false,
            },
          },
          required: ['type', 'parameters'],
          additionalProperties: false,
        });

        const schema = {
          $id: schemaId,
          type: 'object',
          anyOf: anyOfBranches,
        };

        await validator.addSchema(schema, schemaId);
      });

      it('should detect entity_id typo when pattern detection is bypassed with valid type', () => {
        const data = {
          type: 'TARGET_OP',
          parameters: {
            entity_id: 'npc-001', // Wrong - should be entity_ref
          },
        };

        const result = validator.validate(schemaId, data);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(100);

        const formattedError = validator.formatAjvErrors(result.errors, data);
        expect(formattedError).toContain('"entity_id" should be "entity_ref"');
      });
    });

    describe('Lines 590-607 - perception_type enum handling', () => {
      it('should provide perception_type specific guidance for enum errors', () => {
        const errors = [
          {
            keyword: 'enum',
            schemaPath:
              '#/anyOf/0/properties/parameters/properties/perception_type/enum',
            instancePath: '/parameters/perception_type',
            params: {
              allowedValues: ['sight', 'hearing', 'smell', 'touch', 'taste'],
            },
            data: 'vision',
          },
        ];

        const data = {
          type: 'SOME_OP',
          parameters: { perception_type: 'vision' },
        };

        const formattedError = formatAnyOfErrors(errors, data);

        expect(formattedError).toContain("Invalid enum value 'vision'");
        expect(formattedError).toContain('perception_type');
        expect(formattedError).toContain('💡 FIX:');
        expect(formattedError).toContain(
          'data/schemas/operations/dispatchPerceptibleEvent.schema.json'
        );
      });
    });

    describe('Line 664 - "Did you mean?" suggestion', () => {
      it('should suggest similar operation type for typos', () => {
        // Create errors with known operation types
        const errors = [
          {
            keyword: 'const',
            schemaPath: '#/anyOf/0/properties/type/const',
            instancePath: '',
            params: { allowedValue: 'QUERY_COMPONENT' },
          },
          {
            keyword: 'const',
            schemaPath: '#/anyOf/1/properties/type/const',
            instancePath: '',
            params: { allowedValue: 'ADD_COMPONENT' },
          },
          {
            keyword: 'const',
            schemaPath: '#/anyOf/2/properties/type/const',
            instancePath: '',
            params: { allowedValue: 'REMOVE_COMPONENT' },
          },
        ];

        // Typo: QUREY instead of QUERY
        const data = { type: 'QUREY_COMPONENT' };

        const formattedError = formatAnyOfErrors(errors, data);

        expect(formattedError).toContain(
          "Unknown or invalid operation type: 'QUREY_COMPONENT'"
        );
        expect(formattedError).toContain('Did you mean');
        expect(formattedError).toContain('QUERY_COMPONENT');
      });
    });

    describe('Lines 682-691 - JSON Logic rule detection', () => {
      it('should detect JSON Logic rule validation failures', () => {
        // Create minimal errors that would lead to formatOperationTypeSummary
        // but with a JSON Logic-like payload
        const errors = [
          {
            keyword: 'anyOf',
            schemaPath: '#/anyOf',
            instancePath: '',
            params: {},
          },
          {
            keyword: 'const',
            schemaPath: '#/anyOf/0/properties/type/const',
            instancePath: '',
            params: { allowedValue: 'OPERATION_A' },
          },
        ];

        // Payload that passes isLikelyJsonLogic() - uses standard JSON Logic operators
        const jsonLogicPayload = {
          and: [{ var: 'actor.health' }, { '==': [{ var: 'state' }, 'active'] }],
        };

        const formattedError = formatAnyOfErrors(errors, jsonLogicPayload);

        expect(formattedError).toContain('JSON Logic rule');
        expect(formattedError).toContain('{"and": [...]}');
        expect(formattedError).toContain('{"var": "path.to.data"}');
      });

      it('should detect "or" operator as JSON Logic', () => {
        const errors = [
          {
            keyword: 'anyOf',
            schemaPath: '#/anyOf',
            instancePath: '',
            params: {},
          },
        ];

        const jsonLogicPayload = {
          or: [{ var: 'condition1' }, { var: 'condition2' }],
        };

        const formattedError = formatAnyOfErrors(errors, jsonLogicPayload);

        expect(formattedError).toContain('JSON Logic rule');
      });
    });

    describe('Line 707 - "... and X more" truncation', () => {
      it('should truncate operation types list when more than 12 types in groupedErrors', () => {
        // Create errors with >12 different operation types
        // These will be grouped and should trigger the "... and X more" message
        const errors = Array.from({ length: 15 }, (_, i) => ({
          keyword: 'const',
          schemaPath: `#/anyOf/${i}/properties/type/const`,
          instancePath: '',
          params: { allowedValue: `OPERATION_TYPE_${i}` },
        }));

        // Payload without type field to trigger "Missing operation type" path
        const data = { parameters: { someField: 'value' } };

        const formattedError = formatAnyOfErrors(errors, data);

        expect(formattedError).toContain('Missing operation type');
        expect(formattedError).toContain('Common operation types:');
        expect(formattedError).toContain('OPERATION_TYPE_0');
        // 15 - 12 = 3 more
        expect(formattedError).toContain('... and 3 more');
      });

      it('should not show truncation message when exactly 12 or fewer types', () => {
        const errors = Array.from({ length: 12 }, (_, i) => ({
          keyword: 'const',
          schemaPath: `#/anyOf/${i}/properties/type/const`,
          instancePath: '',
          params: { allowedValue: `OPERATION_TYPE_${i}` },
        }));

        const data = { parameters: {} };

        const formattedError = formatAnyOfErrors(errors, data);

        expect(formattedError).toContain('Common operation types:');
        expect(formattedError).not.toContain('... and');
      });
    });

    describe('Lines 800-812 - wrapWithContext() with full context', () => {
      it('should wrap errors with file context when filePath and fileContent provided', () => {
        const errors = [
          {
            keyword: 'required',
            schemaPath: '#/anyOf/0/properties/parameters/required',
            instancePath: '/parameters',
            params: { missingProperty: 'target' },
          },
          {
            keyword: 'const',
            schemaPath: '#/anyOf/0/properties/type/const',
            instancePath: '',
            params: { allowedValue: 'MOVE' },
          },
        ];

        const payload = { type: 'MOVE', parameters: {} };
        const context = {
          filePath: '/data/mods/test/rules/test_rule.rule.json',
          fileContent:
            '{\n  "type": "MOVE",\n  "parameters": {}\n}\n',
        };

        const formattedError = formatAjvErrorsEnhanced(
          errors,
          payload,
          context
        );

        // Should include file path
        expect(formattedError).toContain(
          '/data/mods/test/rules/test_rule.rule.json'
        );
        // Should include line number reference
        expect(formattedError).toContain('Line:');
        // Should include context snippet with code
        expect(formattedError).toContain('Context:');
        // Should include the error message
        expect(formattedError).toContain('target');
      });

      it('should not wrap with context when filePath is missing', () => {
        const errors = [
          {
            keyword: 'required',
            schemaPath: '#/required',
            instancePath: '/parameters',
            params: { missingProperty: 'target' },
          },
        ];

        const payload = { type: 'MOVE', parameters: {} };
        const context = {
          fileContent: '{"type": "MOVE"}',
          // No filePath
        };

        const formattedError = formatAjvErrorsEnhanced(
          errors,
          payload,
          context
        );

        // Should NOT include rich context formatting
        expect(formattedError).not.toContain('Line:');
        expect(formattedError).not.toContain('Context:');
      });

      it('should not wrap with context when fileContent is missing', () => {
        const errors = [
          {
            keyword: 'required',
            schemaPath: '#/required',
            instancePath: '/parameters',
            params: { missingProperty: 'target' },
          },
        ];

        const payload = { type: 'MOVE', parameters: {} };
        const context = {
          filePath: '/some/path.json',
          // No fileContent
        };

        const formattedError = formatAjvErrorsEnhanced(
          errors,
          payload,
          context
        );

        // Should NOT include rich context formatting
        expect(formattedError).not.toContain('Line:');
        expect(formattedError).not.toContain('Context:');
      });

      it('should include ruleId in context when provided', () => {
        const errors = [
          {
            keyword: 'required',
            schemaPath: '#/anyOf/0/properties/parameters/required',
            instancePath: '/parameters',
            params: { missingProperty: 'target' },
          },
          {
            keyword: 'const',
            schemaPath: '#/anyOf/0/properties/type/const',
            instancePath: '',
            params: { allowedValue: 'MOVE' },
          },
        ];

        const payload = { type: 'MOVE', parameters: {} };
        const context = {
          filePath: '/data/mods/test/rules/my_rule.rule.json',
          fileContent: '{\n  "type": "MOVE",\n  "parameters": {}\n}\n',
          ruleId: 'test:my_rule',
        };

        const formattedError = formatAjvErrorsEnhanced(
          errors,
          payload,
          context
        );

        // Should include rule ID in error message
        expect(formattedError).toContain('test:my_rule');
      });
    });
  });

  describe('Additional Coverage - isLikelyJsonLogic edge cases', () => {
    it('should return false for array payloads (Line 254)', () => {
      const errors = [
        {
          keyword: 'anyOf',
          schemaPath: '#/anyOf',
          instancePath: '',
          params: {},
        },
      ];

      // Array is not a JSON Logic rule
      const arrayPayload = ['some', 'array', 'data'];
      const formattedError = formatAnyOfErrors(errors, arrayPayload);

      // Should NOT detect as JSON Logic since it's an array
      expect(formattedError).not.toContain('JSON Logic rule');
    });

    it('should return false for empty object payloads (Line 259)', () => {
      const errors = [
        {
          keyword: 'anyOf',
          schemaPath: '#/anyOf',
          instancePath: '',
          params: {},
        },
      ];

      // Empty object has no keys to check
      const emptyPayload = {};
      const formattedError = formatAnyOfErrors(errors, emptyPayload);

      // Should NOT detect as JSON Logic since empty object
      expect(formattedError).not.toContain('JSON Logic rule');
    });

    it('should detect custom operators with "is" prefix (Line 279)', () => {
      const errors = [
        {
          keyword: 'anyOf',
          schemaPath: '#/anyOf',
          instancePath: '',
          params: {},
        },
      ];

      // Custom operator with 'is' prefix
      const customOperatorPayload = {
        isSlotExposed: { slot: 'chest' },
      };

      const formattedError = formatAnyOfErrors(errors, customOperatorPayload);

      expect(formattedError).toContain('JSON Logic rule');
    });

    it('should detect custom operators with "has" prefix (Line 279)', () => {
      const errors = [
        {
          keyword: 'anyOf',
          schemaPath: '#/anyOf',
          instancePath: '',
          params: {},
        },
      ];

      const customOperatorPayload = {
        hasPartOfType: { type: 'arm' },
      };

      const formattedError = formatAnyOfErrors(errors, customOperatorPayload);

      expect(formattedError).toContain('JSON Logic rule');
    });

    it('should detect condition_ref as JSON Logic (Line 284)', () => {
      const errors = [
        {
          keyword: 'anyOf',
          schemaPath: '#/anyOf',
          instancePath: '',
          params: {},
        },
      ];

      // condition_ref is a JSON Logic extension
      const conditionRefPayload = {
        condition_ref: 'core:some_condition',
      };

      const formattedError = formatAnyOfErrors(errors, conditionRefPayload);

      expect(formattedError).toContain('JSON Logic rule');
    });

    it('should NOT detect regular operation fields as JSON Logic', () => {
      const errors = [
        {
          keyword: 'anyOf',
          schemaPath: '#/anyOf',
          instancePath: '',
          params: {},
        },
      ];

      // Regular operation payload - should NOT be detected as JSON Logic
      const regularPayload = {
        type: 'SOME_OP',
        parameters: { field: 'value' },
      };

      const formattedError = formatAnyOfErrors(errors, regularPayload);

      expect(formattedError).not.toContain('JSON Logic rule');
    });
  });

  describe('Additional Coverage - formatSingleError const case (Line 588)', () => {
    it('should format const keyword errors correctly', () => {
      const errors = [
        {
          keyword: 'const',
          schemaPath: '#/properties/mode/const',
          instancePath: '/mode',
          params: { allowedValue: 'strict' },
          data: 'loose',
        },
      ];

      const formattedError = formatAnyOfErrors(errors, { mode: 'loose' });

      expect(formattedError).toContain("Must be equal to 'strict'");
    });
  });

  describe('Additional Coverage - formatAjvErrorsEnhanced no errors (Line 728)', () => {
    it('should return "No validation errors" when errors is null', () => {
      const result = formatAjvErrorsEnhanced(null, {});
      expect(result).toBe('No validation errors');
    });

    it('should return "No validation errors" when errors is empty array', () => {
      const result = formatAjvErrorsEnhanced([], {});
      expect(result).toBe('No validation errors');
    });
  });

  describe('Additional Coverage - extractFailingData navigation (Lines 160-168)', () => {
    // extractFailingData is called by formatAjvErrorsEnhanced when errors.length > 50
    // and the first error has a non-empty instancePath. Lines 160-168 are the for-loop
    // that navigates through nested data structures.

    it('should navigate through nested data via extractFailingData (Lines 160-166)', () => {
      // Create >100 errors with operation type patterns to trigger line 752
      // The first error's instancePath must NOT end with 'type', 'macro', or 'parameters'
      // so the full path is navigated through the for-loop
      const errors = Array.from({ length: 105 }, (_, i) => ({
        keyword: 'const',
        schemaPath: `#/anyOf/${i}/properties/type/const`,
        instancePath: '/nested/0/action', // Path NOT ending in type/macro/parameters
        params: { allowedValue: `TYPE_${i}` },
      }));

      // Nested data structure - extractFailingData navigates nested → 0 → action
      const data = {
        nested: [
          {
            action: {
              type: 42, // Non-string type triggers line 757 check
            },
          },
        ],
      };

      // Call formatAjvErrorsEnhanced which calls extractFailingData at line 752
      const formattedError = formatAjvErrorsEnhanced(errors, data);

      // Should detect the non-string type after navigation
      expect(formattedError).toContain('Invalid "type" field value');
      expect(formattedError).toContain('must be a string');
    });

    it('should fallback to root when navigation hits null (Lines 162-163)', () => {
      // Path that will hit null during navigation
      const errors = Array.from({ length: 105 }, (_, i) => ({
        keyword: 'const',
        schemaPath: `#/anyOf/${i}/properties/type/const`,
        instancePath: '/items/0/nested/deep', // Navigation will hit null at items[0]
        params: { allowedValue: `TYPE_${i}` },
      }));

      // items[0] is null, so when navigating items → 0 → nested, we hit null
      const data = {
        items: [null],
        type: 42, // Root has non-string type for fallback detection
      };

      const formattedError = formatAjvErrorsEnhanced(errors, data);

      // Should fallback to root and detect the non-string type there
      expect(formattedError).toContain('Invalid "type" field value');
    });

    it('should fallback to root when final navigation result is undefined (Line 168)', () => {
      // Path where final navigation step returns undefined
      const errors = Array.from({ length: 105 }, (_, i) => ({
        keyword: 'const',
        schemaPath: `#/anyOf/${i}/properties/type/const`,
        instancePath: '/container/missing', // 'missing' doesn't exist in container
        params: { allowedValue: `TYPE_${i}` },
      }));

      // container exists but 'missing' key doesn't
      const data = {
        container: {
          // 'missing' property doesn't exist, current['missing'] = undefined
        },
        type: 42, // Root has non-string type for fallback detection
      };

      const formattedError = formatAjvErrorsEnhanced(errors, data);

      // Should fallback to root (line 168) and detect the non-string type
      expect(formattedError).toContain('Invalid "type" field value');
    });

    it('should navigate full path when not a field path (Line 165)', () => {
      // Path that does NOT end in 'type', 'macro', or 'parameters'
      // so isFieldPath is false and navigationParts equals pathParts
      const errors = Array.from({ length: 105 }, (_, i) => ({
        keyword: 'const',
        schemaPath: `#/anyOf/${i}/properties/type/const`,
        instancePath: '/operations/0', // Ends in '0', not a field path
        params: { allowedValue: `TYPE_${i}` },
      }));

      // Navigation: operations → 0 returns the nested object
      const data = {
        operations: [
          {
            type: 42, // Non-string type at nested level
          },
        ],
      };

      const formattedError = formatAjvErrorsEnhanced(errors, data);

      expect(formattedError).toContain('Invalid "type" field value');
    });
  });

  describe('Additional Coverage - Parameter errors fallback (Lines 481-509)', () => {
    const schemaId = 'schema://test/param-errors-fallback.schema.json';

    beforeEach(async () => {
      // Create a schema that will generate >100 errors when validating
      const anyOfBranches = Array.from({ length: 110 }, (_, i) => ({
        type: 'object',
        properties: {
          type: { const: `OP_${i}` },
          parameters: {
            type: 'object',
            properties: {
              [`required_field_${i}`]: { type: 'string' },
            },
            required: [`required_field_${i}`],
            additionalProperties: false,
          },
        },
        required: ['type', 'parameters'],
        additionalProperties: false,
      }));

      const schema = {
        $id: schemaId,
        type: 'object',
        anyOf: anyOfBranches,
      };

      await validator.addSchema(schema, schemaId);
    });

    it('should show parameter errors when type is valid and error count > 100', () => {
      // Use a type that exists in our schema
      const data = {
        type: 'OP_0',
        parameters: {
          wrong_field: 'value', // This will generate additionalProperties error
        },
      };

      const result = validator.validate(schemaId, data);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(100);

      const formattedError = validator.formatAjvErrors(result.errors, data);

      // Should show parameter-specific error message
      expect(formattedError).toContain("Operation type 'OP_0'");
      expect(formattedError).toContain('invalid parameters');
    });

    it('should detect entity_id typo via fallback path (Lines 502-504)', () => {
      // This test needs to trigger the fallback path for entity_id detection
      // We need: data.type truthy, errors.length > 100, and paramErrors.length > 0
      // with an error that has params.additionalProperty === 'entity_id'

      // Create errors manually to ensure we hit the fallback path
      const errors = [
        // First, many const errors to get error count > 100
        ...Array.from({ length: 105 }, (_, i) => ({
          keyword: 'const',
          schemaPath: `#/anyOf/${i}/properties/type/const`,
          instancePath: '',
          params: { allowedValue: `WRONG_TYPE_${i}` },
        })),
        // Add parameter errors with entity_id as additionalProperty
        {
          keyword: 'additionalProperties',
          schemaPath: '#/anyOf/0/properties/parameters/additionalProperties',
          instancePath: '/parameters',
          params: { additionalProperty: 'entity_id' },
        },
        {
          keyword: 'required',
          schemaPath: '#/anyOf/0/properties/parameters/required',
          instancePath: '/parameters',
          params: { missingProperty: 'entity_ref' },
        },
      ];

      // Payload with valid type (to pass the data?.type check)
      const data = {
        type: 'VALID_OP',
        parameters: {
          entity_id: 'npc-001',
        },
      };

      // This should trigger the fallback path with entity_id detection
      const formattedError = formatAnyOfErrors(errors, data);

      expect(formattedError).toContain("Operation type 'VALID_OP'");
      expect(formattedError).toContain('invalid parameters');
      expect(formattedError).toContain('"entity_id" should be "entity_ref"');
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

      expect(formattedError).toContain(
        'Invalid macro reference format detected.'
      );
      expect(formattedError).toContain(
        'Do NOT include a "type" field with macro references.'
      );
    });
  });
});
