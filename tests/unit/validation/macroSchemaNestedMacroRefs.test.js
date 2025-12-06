/**
 * @file macroSchemaNestedMacroRefs.test.js
 * @description Tests for macro schema validation allowing nested macro references.
 *
 * This test suite validates that macro definitions can contain nested macro references
 * within their actions arrays. Previously, the macro schema only allowed Operation objects
 * (with 'type' field) but not MacroReference objects (with 'macro' field).
 *
 * The fix changes macro.schema.json to reference operation.schema.json#/$defs/Action
 * instead of operation.schema.json#/$defs/Operation.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

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

describe('Macro Schema - Nested Macro References Support', () => {
  let validator;
  let logger;
  const macroSchemaId = 'schema://test/macro.schema.json';
  const operationSchemaId = 'schema://test/operation.schema.json';
  const commonSchemaId = 'schema://test/common.schema.json';

  beforeEach(async () => {
    logger = createMockLogger();
    validator = new AjvSchemaValidator({ logger });

    // Create a minimal common schema with namespacedId definition
    const commonSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: commonSchemaId,
      title: 'Common Schema',
      definitions: {
        namespacedId: {
          type: 'string',
          pattern: '^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$',
          description: 'A namespaced identifier in the format namespace:id',
        },
        BaseDefinition: {
          properties: {
            $schema: { type: 'string' },
            id: { $ref: '#/definitions/namespacedId' },
            description: { type: 'string' },
          },
        },
      },
    };

    // Create operation schema that mirrors the actual structure
    const operationSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: operationSchemaId,
      title: 'Operation Schema',
      $ref: '#/$defs/Action',
      $defs: {
        Action: {
          description:
            'Either a macro reference or an operation. This is the canonical definition for any item in an action sequence.',
          anyOf: [
            { $ref: '#/$defs/MacroReference' },
            { $ref: '#/$defs/Operation' },
          ],
        },
        MacroReference: {
          type: 'object',
          description: 'A reference to a macro.',
          properties: {
            macro: {
              $ref: commonSchemaId + '#/definitions/namespacedId',
              description: 'The namespaced identifier of the macro to execute.',
            },
            comment: {
              type: 'string',
              description: 'Optional note for modders. Ignored at runtime.',
            },
          },
          required: ['macro'],
          additionalProperties: false,
        },
        Operation: {
          description:
            'A single, discrete operation within an action sequence.',
          anyOf: [
            {
              type: 'object',
              properties: {
                type: { const: 'LOG' },
                comment: { type: 'string' },
                parameters: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    level: {
                      type: 'string',
                      enum: ['info', 'warn', 'error', 'debug'],
                    },
                  },
                  required: ['message', 'level'],
                  additionalProperties: false,
                },
              },
              required: ['type', 'parameters'],
              additionalProperties: false,
            },
            {
              type: 'object',
              properties: {
                type: { const: 'SET_VARIABLE' },
                comment: { type: 'string' },
                parameters: {
                  type: 'object',
                  properties: {
                    variable_name: { type: 'string' },
                    value: {},
                  },
                  required: ['variable_name', 'value'],
                  additionalProperties: false,
                },
              },
              required: ['type', 'parameters'],
              additionalProperties: false,
            },
            {
              type: 'object',
              properties: {
                type: { const: 'END_TURN' },
                comment: { type: 'string' },
                parameters: {
                  type: 'object',
                  properties: {
                    entityId: { type: 'string' },
                    success: { type: 'boolean' },
                  },
                  required: ['entityId', 'success'],
                  additionalProperties: false,
                },
              },
              required: ['type', 'parameters'],
              additionalProperties: false,
            },
          ],
        },
      },
    };

    // Create macro schema that CORRECTLY uses Action (not just Operation)
    // This is the FIXED version - the bug was using Operation instead of Action
    const macroSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: macroSchemaId,
      title: 'Macro Definition',
      description:
        'Encapsulates a reusable sequence of operations that can be inserted into System Rules.',
      type: 'object',
      properties: {
        $schema: {
          $ref:
            commonSchemaId + '#/definitions/BaseDefinition/properties/$schema',
        },
        id: {
          $ref: commonSchemaId + '#/definitions/BaseDefinition/properties/id',
        },
        description: {
          $ref:
            commonSchemaId +
            '#/definitions/BaseDefinition/properties/description',
        },
        actions: {
          type: 'array',
          minItems: 1,
          description:
            'Ordered list of Operation objects to expand when the macro is used.',
          items: {
            // THE FIX: Use Action (which allows both MacroReference and Operation)
            // Instead of just Operation
            $ref: operationSchemaId + '#/$defs/Action',
          },
        },
        comment: {
          type: 'string',
          description: 'Optional note for modders. Ignored at runtime.',
        },
      },
      required: ['id', 'description', 'actions'],
      additionalProperties: false,
    };

    // Add schemas to validator
    await validator.addSchema(commonSchema, commonSchemaId);
    await validator.addSchema(operationSchema, operationSchemaId);
    await validator.addSchema(macroSchema, macroSchemaId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Macro with only operations (existing behavior)', () => {
    it('should validate macro with only Operation objects in actions', () => {
      const macro = {
        $schema: 'schema://living-narrative-engine/macro.schema.json',
        id: 'core:endTurnOnly',
        description: 'Ends the turn without displaying a message.',
        actions: [
          {
            type: 'END_TURN',
            parameters: {
              entityId: '{event.payload.actorId}',
              success: true,
            },
          },
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate macro with multiple Operation objects', () => {
      const macro = {
        id: 'test:multiOperation',
        description: 'Macro with multiple operations',
        actions: [
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'logMessage',
              value: 'Test message',
            },
          },
          {
            type: 'LOG',
            parameters: {
              message: '{context.logMessage}',
              level: 'info',
            },
          },
          {
            type: 'END_TURN',
            parameters: {
              entityId: '{event.payload.actorId}',
              success: true,
            },
          },
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('Macro with nested macro reference (THE FIX)', () => {
    it('should validate macro with nested macro reference', () => {
      // This is the pattern used in weapons mod macros
      const macro = {
        id: 'weapons:handleMeleeHit',
        description: 'Handles SUCCESS outcome for melee weapon attacks.',
        actions: [
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'logMessage',
              value: '{context.actorName} hits {context.targetName}!',
            },
          },
          {
            // This is a nested macro reference - previously failed validation
            macro: 'core:endTurnOnly',
          },
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      // CRITICAL: This test should PASS after the fix
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate macro with only a macro reference in actions', () => {
      const macro = {
        id: 'test:delegateOnly',
        description: 'A macro that only delegates to another macro',
        actions: [
          {
            macro: 'core:endTurnOnly',
          },
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate macro reference with comment field', () => {
      const macro = {
        id: 'test:withComment',
        description: 'A macro with commented macro reference',
        actions: [
          {
            macro: 'core:endTurnOnly',
            comment: 'This ends the turn after the action completes',
          },
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('Macro with mixed operations and macro references (THE FIX)', () => {
    it('should validate complex macro like handleMeleeCritical', () => {
      // This matches the actual handleMeleeCritical.macro.json structure
      const macro = {
        id: 'weapons:handleMeleeCritical',
        description:
          'Handles CRITICAL_SUCCESS outcome for melee weapon attacks with 1.5x damage.',
        actions: [
          {
            type: 'SET_VARIABLE',
            comment:
              'Set logMessage BEFORE damage loop so success message displays first',
            parameters: {
              variable_name: 'logMessage',
              value: '{context.actorName} lands a devastating blow!',
            },
          },
          // Nested macro reference at the end
          {
            macro: 'core:endTurnOnly',
          },
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate macro with multiple nested macro references', () => {
      const macro = {
        id: 'test:multiMacroRefs',
        description: 'A macro with multiple nested macro references',
        actions: [
          {
            type: 'SET_VARIABLE',
            parameters: {
              variable_name: 'step',
              value: 1,
            },
          },
          {
            macro: 'core:logSuccessAndEndTurn',
          },
          {
            macro: 'core:displaySuccessAndEndTurn',
          },
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate macro with interleaved operations and macro references', () => {
      const macro = {
        id: 'test:interleaved',
        description: 'Operations and macro refs interleaved',
        actions: [
          { type: 'LOG', parameters: { message: 'Start', level: 'info' } },
          { macro: 'core:logSuccessAndEndTurn' },
          {
            type: 'SET_VARIABLE',
            parameters: { variable_name: 'x', value: 1 },
          },
          { macro: 'core:endTurnOnly' },
          { type: 'END_TURN', parameters: { entityId: 'test', success: true } },
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('Invalid macro content (validation still works)', () => {
    it('should reject macro with empty actions array', () => {
      const macro = {
        id: 'test:emptyActions',
        description: 'Invalid: empty actions',
        actions: [],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject macro with invalid macro reference format', () => {
      const macro = {
        id: 'test:invalidMacroRef',
        description: 'Invalid macro reference format',
        actions: [
          {
            macro: 'invalidformat', // Missing colon separator
          },
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      // Should have limited errors due to anyOf pattern
      expect(result.errors.length).toBeLessThan(20);
    });

    it('should reject macro with empty macro reference', () => {
      const macro = {
        id: 'test:emptyMacro',
        description: 'Empty macro reference',
        actions: [
          {
            macro: '',
          },
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject action with neither type nor macro', () => {
      const macro = {
        id: 'test:noTypeOrMacro',
        description: 'Action without type or macro',
        actions: [
          {
            comment: 'This has neither type nor macro',
          },
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject macro reference with additional invalid properties', () => {
      const macro = {
        id: 'test:extraProps',
        description: 'Macro ref with invalid additional properties',
        actions: [
          {
            macro: 'core:endTurnOnly',
            invalidField: 'not allowed',
          },
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject missing required fields', () => {
      const macro = {
        // Missing id and description
        actions: [
          {
            macro: 'core:endTurnOnly',
          },
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Error count validation (anyOf prevents cascades)', () => {
    it('should produce limited errors for invalid nested content', () => {
      const macro = {
        id: 'test:invalidNested',
        description: 'Contains invalid content',
        actions: [
          { type: 'LOG', parameters: { message: 'valid', level: 'info' } },
          { macro: '' }, // Invalid
          { macro: 'core:endTurnOnly' }, // Valid
        ],
      };

      const result = validator.validate(macroSchemaId, macro);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      // anyOf pattern should prevent error cascades
      // We expect less than 20 errors, not hundreds
      expect(result.errors.length).toBeLessThan(20);
    });
  });
});
