import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

/**
 * Test to reproduce the exact schema validation bug that occurs during rule loading.
 * This test replicates the validation pattern where rule actions are validated against
 * operation.schema.json#/$defs/Action, which uses anyOf with multiple operation schemas.
 */
describe('Rule Schema Validation Bug', () => {
  let testBed;
  let mockLogger;
  let validator;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    validator = new AjvSchemaValidator({ logger: mockLogger });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should reproduce the anyOf schema resolution bug in rule validation', async () => {
    // Arrange - Create simplified test schemas that demonstrate the validation issue
    // The bug occurs when validating actions that use anyOf with multiple operation types
    
    const operationSchema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "$id": "schema://living-narrative-engine/operation.schema.json",
      "title": "Operation Schema",
      "$ref": "#/$defs/Action",
      "$defs": {
        "Action": {
          "oneOf": [
            { "$ref": "#/$defs/Operation" },
            { "$ref": "#/$defs/MacroReference" }
          ]
        },
        "MacroReference": {
          "type": "object",
          "properties": {
            "macro": { "type": "string" },
            "comment": { "type": "string" }
          },
          "required": ["macro"]
        },
        "Operation": {
          "anyOf": [
            {
              // Inline QUERY_COMPONENTS schema
              "type": "object",
              "properties": {
                "type": { "const": "QUERY_COMPONENTS" },
                "parameters": {
                  "type": "object",
                  "properties": {
                    "entity_ref": { "type": "string", "minLength": 1 },
                    "pairs": {
                      "type": "array",
                      "minItems": 1,
                      "items": {
                        "type": "object",
                        "properties": {
                          "component_type": { "type": "string", "pattern": "^(\\w+:)?\\w+$" },
                          "result_variable": { "type": "string", "minLength": 1 }
                        },
                        "required": ["component_type", "result_variable"]
                      }
                    }
                  },
                  "required": ["entity_ref", "pairs"]
                }
              },
              "required": ["type", "parameters"]
            },
            {
              // Inline IF schema with recursive reference back to Action
              "type": "object",
              "properties": {
                "type": { "const": "IF" },
                "parameters": {
                  "type": "object",
                  "properties": {
                    "condition": { "type": "object" },
                    "then_actions": {
                      "type": "array",
                      "minItems": 1,
                      "items": { "$ref": "#/$defs/Action" }
                    },
                    "else_actions": {
                      "type": "array",
                      "items": { "$ref": "#/$defs/Action" }
                    }
                  },
                  "required": ["condition", "then_actions"]
                }
              },
              "required": ["type", "parameters"]
            }
          ]
        }
      }
    };

    const ruleSchema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "$id": "schema://living-narrative-engine/rule.schema.json",
      "title": "System Rule Schema",
      "type": "object",
      "properties": {
        "event_type": { "type": "string" },
        "actions": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "schema://living-narrative-engine/operation.schema.json#/$defs/Action"
          }
        }
      },
      "required": ["event_type", "actions"]
    };

    // Load the schemas
    await validator.addSchema(operationSchema, operationSchema.$id);
    await validator.addSchema(ruleSchema, ruleSchema.$id);

    // Act - Test the exact data structure from entity_thought.rule.json
    const ruleData = {
      "event_type": "ENTITY_THOUGHT_PROCESSING",
      "actions": [
        {
          "type": "QUERY_COMPONENTS",
          "parameters": {
            "entity_ref": "actor",
            "pairs": [
              {
                "component_type": "core:actor",
                "result_variable": "name"
              },
              {
                "component_type": "core:thoughts", 
                "result_variable": "thoughts"
              }
            ]
          }
        },
        {
          "type": "IF",
          "parameters": {
            "condition": { "!=": [{ "var": "actor.name" }, null] },
            "then_actions": [
              {
                "type": "QUERY_COMPONENTS",
                "parameters": {
                  "entity_ref": "actor",
                  "pairs": [
                    {
                      "component_type": "core:actor",
                      "result_variable": "timestamp"
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    };

    // This should pass validation
    const result = validator.validate('schema://living-narrative-engine/rule.schema.json', ruleData);

    // Log the errors to understand what's happening
    if (!result.isValid) {
      console.error('Validation errors:', JSON.stringify(result.errors, null, 2));
      
      // Check if we get the specific error pattern from the logs
      const hasSchemaResolutionBug = result.errors.some(error => 
        error.instancePath?.includes('/actions/1/type') &&
        error.keyword === 'const' &&
        error.params?.allowedValue === 'QUERY_COMPONENTS' &&
        error.data === 'IF'
      );

      if (hasSchemaResolutionBug) {
        console.log('*** REPRODUCED SCHEMA RESOLUTION BUG ***');
        console.log('IF operation is being validated against QUERY_COMPONENTS schema');
      }
    }
  });

  it('should validate individual operations correctly outside of anyOf context', async () => {
    // Arrange - Test that individual schemas work fine
    const ifSchema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "$id": "schema://living-narrative-engine/operations/if.schema.json",
      "title": "IF Operation",
      "type": "object",
      "properties": {
        "type": { "const": "IF" },
        "parameters": {
          "type": "object",
          "properties": {
            "condition": { "type": "object" },
            "then_actions": { "type": "array" }
          },
          "required": ["condition", "then_actions"]
        }
      },
      "required": ["type", "parameters"]
    };

    await validator.addSchema(ifSchema, ifSchema.$id);

    // Act - Validate an IF operation directly
    const ifOperation = {
      "type": "IF",
      "parameters": {
        "condition": { "!=": [{ "var": "actor.name" }, null] },
        "then_actions": []
      }
    };

    const result = validator.validate('schema://living-narrative-engine/operations/if.schema.json', ifOperation);

    // Assert - This should always work
    expect(result.isValid).toBe(true);
  });
});