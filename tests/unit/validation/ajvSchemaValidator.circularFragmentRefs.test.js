/**
 * @file Tests for circular fragment reference resolution in schema loader
 * @description Reproduces the bug where schemas with circular $ref fragments
 * (like forEach.schema.json → operation.schema.json#/$defs/Action) fail validation
 * when the fragment resolution returns null during async loading.
 *
 * This test mimics the actual production schema structure:
 * - operation.schema.json defines Action = MacroReference | Operation
 * - forEach.schema.json is included in Operation and references Action for nested actions
 * - macro.schema.json uses Action for its actions array
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

describe('AjvSchemaValidator - Circular Fragment Reference Resolution', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  describe('Circular reference pattern (mirrors production)', () => {
    /**
     * This test reproduces the exact pattern that causes the 930-error cascade:
     *
     * 1. operation.schema.json contains:
     *    - $defs/Action = anyOf[MacroReference, Operation]
     *    - $defs/Operation = anyOf[...operationTypes including forEach]
     *
     * 2. forEach.schema.json contains:
     *    - actions array items: $ref "../operation.schema.json#/$defs/Action"
     *    - This creates a circular reference
     *
     * 3. When AJV validates a macro with nested macro refs:
     *    - It compiles macro.schema.json
     *    - Which needs to compile forEach.schema.json
     *    - Which tries to resolve operation.schema.json#/$defs/Action
     *    - If fragment resolution fails, AJV validates against ALL 50+ operation types
     */
    it('should resolve fragment references when schemas have circular dependencies', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // Common schema (referenced by both)
      const commonSchema = {
        $id: 'schema://test/common.schema.json',
        definitions: {
          namespacedId: {
            type: 'string',
            pattern: '^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$',
          },
        },
      };

      // Operation schema - contains Action and Operation definitions
      // Operation includes a reference to forEach which references back to Action
      const operationSchema = {
        $id: 'schema://test/operation.schema.json',
        $schema: 'http://json-schema.org/draft-07/schema#',
        $ref: '#/$defs/Action',
        $defs: {
          Action: {
            anyOf: [
              { $ref: '#/$defs/MacroReference' },
              { $ref: '#/$defs/Operation' },
            ],
          },
          MacroReference: {
            type: 'object',
            properties: {
              macro: {
                $ref: 'schema://test/common.schema.json#/definitions/namespacedId',
              },
              comment: { type: 'string' },
            },
            required: ['macro'],
            additionalProperties: false,
          },
          Operation: {
            anyOf: [
              {
                // LOG operation - simple case
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
                // FOR_EACH operation - references Action (circular)
                type: 'object',
                properties: {
                  type: { const: 'FOR_EACH' },
                  comment: { type: 'string' },
                  parameters: {
                    type: 'object',
                    properties: {
                      collection: { type: 'string' },
                      item_variable: { type: 'string' },
                      actions: {
                        type: 'array',
                        minItems: 1,
                        // CIRCULAR: References Action which includes this Operation
                        items: { $ref: '#/$defs/Action' },
                      },
                    },
                    required: ['collection', 'item_variable', 'actions'],
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

      // Macro schema - uses Action for its actions array
      const macroSchema = {
        $id: 'schema://test/macro.schema.json',
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Macro Definition',
        type: 'object',
        properties: {
          $schema: { type: 'string' },
          id: {
            $ref: 'schema://test/common.schema.json#/definitions/namespacedId',
          },
          description: { type: 'string' },
          actions: {
            type: 'array',
            minItems: 1,
            items: {
              $ref: 'schema://test/operation.schema.json#/$defs/Action',
            },
          },
          comment: { type: 'string' },
        },
        required: ['id', 'description', 'actions'],
        additionalProperties: false,
      };

      // Add schemas in the order they would be loaded
      await validator.addSchema(commonSchema, commonSchema.$id);
      await validator.addSchema(operationSchema, operationSchema.$id);
      await validator.addSchema(macroSchema, macroSchema.$id);

      // Test 1: Macro with simple LOG operation should pass
      const simpleMacro = {
        id: 'test:simpleMacro',
        description: 'A simple macro',
        actions: [
          {
            type: 'LOG',
            parameters: { message: 'Hello', level: 'info' },
          },
        ],
      };

      const simpleResult = validator.validate(macroSchema.$id, simpleMacro);
      expect(simpleResult.isValid).toBe(true);

      // Test 2: Macro with nested macro reference should pass
      const nestedMacroRef = {
        id: 'test:nestedMacro',
        description: 'A macro with nested macro reference',
        actions: [
          { macro: 'core:endTurnOnly' }, // MacroReference
        ],
      };

      const nestedResult = validator.validate(macroSchema.$id, nestedMacroRef);
      expect(nestedResult.isValid).toBe(true);

      // Test 3: Macro with FOR_EACH containing nested actions should pass
      const forEachMacro = {
        id: 'test:forEachMacro',
        description: 'A macro with FOR_EACH',
        actions: [
          {
            type: 'FOR_EACH',
            parameters: {
              collection: 'items',
              item_variable: 'item',
              actions: [
                {
                  type: 'LOG',
                  parameters: { message: 'Processing item', level: 'info' },
                },
              ],
            },
          },
        ],
      };

      const forEachResult = validator.validate(macroSchema.$id, forEachMacro);

      // THIS IS THE CRITICAL TEST
      // Before the fix, this would fail with hundreds of errors
      // because fragment resolution returns null and AJV validates against ALL operations
      expect(forEachResult.isValid).toBe(true);
      if (!forEachResult.isValid) {
        console.error(
          'FOR_EACH validation failed with errors:',
          JSON.stringify(forEachResult.errors, null, 2)
        );
      }
    });

    it('should handle FOR_EACH with nested macro references (the production bug case)', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      const commonSchema = {
        $id: 'schema://test/common.schema.json',
        definitions: {
          namespacedId: {
            type: 'string',
            pattern: '^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$',
          },
        },
      };

      const operationSchema = {
        $id: 'schema://test/operation.schema.json',
        $defs: {
          Action: {
            anyOf: [
              { $ref: '#/$defs/MacroReference' },
              { $ref: '#/$defs/Operation' },
            ],
          },
          MacroReference: {
            type: 'object',
            properties: {
              macro: {
                $ref: 'schema://test/common.schema.json#/definitions/namespacedId',
              },
            },
            required: ['macro'],
            additionalProperties: false,
          },
          Operation: {
            anyOf: [
              {
                type: 'object',
                properties: {
                  type: { const: 'LOG' },
                  parameters: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      level: { type: 'string' },
                    },
                    required: ['message', 'level'],
                  },
                },
                required: ['type', 'parameters'],
                additionalProperties: false,
              },
              {
                type: 'object',
                properties: {
                  type: { const: 'FOR_EACH' },
                  parameters: {
                    type: 'object',
                    properties: {
                      collection: { type: 'string' },
                      item_variable: { type: 'string' },
                      actions: {
                        type: 'array',
                        minItems: 1,
                        items: { $ref: '#/$defs/Action' },
                      },
                    },
                    required: ['collection', 'item_variable', 'actions'],
                  },
                },
                required: ['type', 'parameters'],
                additionalProperties: false,
              },
              {
                type: 'object',
                properties: {
                  type: { const: 'DISPATCH_PERCEPTIBLE_EVENT' },
                  parameters: { type: 'object' },
                },
                required: ['type', 'parameters'],
                additionalProperties: false,
              },
            ],
          },
        },
      };

      const macroSchema = {
        $id: 'schema://test/macro.schema.json',
        type: 'object',
        properties: {
          id: {
            $ref: 'schema://test/common.schema.json#/definitions/namespacedId',
          },
          description: { type: 'string' },
          actions: {
            type: 'array',
            minItems: 1,
            items: {
              $ref: 'schema://test/operation.schema.json#/$defs/Action',
            },
          },
        },
        required: ['id', 'description', 'actions'],
        additionalProperties: false,
      };

      await validator.addSchema(commonSchema, commonSchema.$id);
      await validator.addSchema(operationSchema, operationSchema.$id);
      await validator.addSchema(macroSchema, macroSchema.$id);

      // This mimics weapons:handleMeleeCritical which has:
      // - A FOR_EACH operation
      // - Inside FOR_EACH.actions: a macro reference (core:applyDamageToTarget)
      const productionLikeMacro = {
        id: 'weapons:handleMeleeCritical',
        description: 'Handle melee critical hit',
        actions: [
          {
            type: 'FOR_EACH',
            parameters: {
              collection: 'entities',
              item_variable: 'entity',
              actions: [
                { macro: 'core:applyDamageToTarget' }, // Nested macro reference
                {
                  type: 'DISPATCH_PERCEPTIBLE_EVENT',
                  parameters: { eventId: 'critical_hit' },
                },
              ],
            },
          },
        ],
      };

      const result = validator.validate(macroSchema.$id, productionLikeMacro);

      // THE CRITICAL ASSERTION
      // This should pass because:
      // 1. FOR_EACH is a valid Operation
      // 2. The nested macro reference matches MacroReference
      // 3. DISPATCH_PERCEPTIBLE_EVENT matches Operation
      expect(result.isValid).toBe(true);

      if (!result.isValid) {
        // Log the error count - if it's in the hundreds, fragment resolution failed
        const errorCount = result.errors?.length || 0;
        console.error(`Validation failed with ${errorCount} errors`);
        if (errorCount > 10) {
          console.error(
            'ERROR CASCADE DETECTED: Fragment resolution likely failed, causing AJV to validate against all anyOf branches'
          );
        }
        console.error(
          'First 5 errors:',
          JSON.stringify(result.errors?.slice(0, 5), null, 2)
        );
      }
    });

    it('should correctly reject invalid macro data', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      const commonSchema = {
        $id: 'schema://test/common.schema.json',
        definitions: {
          namespacedId: {
            type: 'string',
            pattern: '^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$',
          },
        },
      };

      const operationSchema = {
        $id: 'schema://test/operation.schema.json',
        $defs: {
          Action: {
            anyOf: [
              { $ref: '#/$defs/MacroReference' },
              { $ref: '#/$defs/Operation' },
            ],
          },
          MacroReference: {
            type: 'object',
            properties: {
              macro: {
                $ref: 'schema://test/common.schema.json#/definitions/namespacedId',
              },
            },
            required: ['macro'],
            additionalProperties: false,
          },
          Operation: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              parameters: { type: 'object' },
            },
            required: ['type', 'parameters'],
          },
        },
      };

      const macroSchema = {
        $id: 'schema://test/macro.schema.json',
        type: 'object',
        properties: {
          id: {
            $ref: 'schema://test/common.schema.json#/definitions/namespacedId',
          },
          description: { type: 'string' },
          actions: {
            type: 'array',
            minItems: 1,
            items: {
              $ref: 'schema://test/operation.schema.json#/$defs/Action',
            },
          },
        },
        required: ['id', 'description', 'actions'],
        additionalProperties: false,
      };

      await validator.addSchema(commonSchema, commonSchema.$id);
      await validator.addSchema(operationSchema, operationSchema.$id);
      await validator.addSchema(macroSchema, macroSchema.$id);

      // Invalid macro - missing required fields
      const invalidMacro = {
        id: 'test:invalid',
        // Missing description
        actions: [],
      };

      const result = validator.validate(macroSchema.$id, invalidMacro);
      expect(result.isValid).toBe(false);

      // Ensure we get a reasonable number of errors (not hundreds)
      const errorCount = result.errors?.length || 0;
      expect(errorCount).toBeLessThan(20); // Should be a small number, not 900+
    });
  });

  describe('Fragment resolution edge cases', () => {
    it('should resolve deeply nested fragments like #/$defs/Parameters/properties/actions', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      const schema = {
        $id: 'schema://test/deep-fragment.schema.json',
        $defs: {
          Parameters: {
            type: 'object',
            properties: {
              actions: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      };

      const consumerSchema = {
        $id: 'schema://test/consumer.schema.json',
        type: 'object',
        properties: {
          nestedField: {
            $ref: 'schema://test/deep-fragment.schema.json#/$defs/Parameters/properties/actions',
          },
        },
      };

      await validator.addSchema(schema, schema.$id);
      await validator.addSchema(consumerSchema, consumerSchema.$id);

      const result = validator.validate(consumerSchema.$id, {
        nestedField: ['action1', 'action2'],
      });

      expect(result.isValid).toBe(true);
    });

    it('should handle self-referencing schemas', async () => {
      const validator = new AjvSchemaValidator({
        logger: mockLogger,
      });

      // A recursive tree structure
      const treeSchema = {
        $id: 'schema://test/tree.schema.json',
        type: 'object',
        properties: {
          value: { type: 'string' },
          children: {
            type: 'array',
            items: { $ref: '#' }, // Self-reference
          },
        },
        required: ['value'],
      };

      await validator.addSchema(treeSchema, treeSchema.$id);

      const validTree = {
        value: 'root',
        children: [
          { value: 'child1', children: [] },
          {
            value: 'child2',
            children: [{ value: 'grandchild', children: [] }],
          },
        ],
      };

      const result = validator.validate(treeSchema.$id, validTree);
      expect(result.isValid).toBe(true);
    });
  });
});
