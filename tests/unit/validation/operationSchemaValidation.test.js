/**
 * @file Tests for operation schema validation, specifically focusing on anyOf resolution issues
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import createTestAjv from '../../common/validation/createTestAjv.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

describe('Operation Schema Validation - anyOf Resolution', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should correctly validate IF operation against IF schema, not QUERY_COMPONENT schema', () => {
    // Create minimal schemas for testing anyOf resolution
    const operationSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'schema://living-narrative-engine/operation.schema.json',
      title: 'Operation Schema',
      description: 'Test operation schema with anyOf',
      anyOf: [
        {
          $ref: '#/$defs/QueryComponentOperation'
        },
        {
          $ref: '#/$defs/IfOperation'
        }
      ],
      $defs: {
        QueryComponentOperation: {
          type: 'object',
          properties: {
            type: { const: 'QUERY_COMPONENT' },
            parameters: { type: 'object' }
          },
          required: ['type', 'parameters']
        },
        IfOperation: {
          type: 'object',
          properties: {
            type: { const: 'IF' },
            parameters: {
              type: 'object',
              properties: {
                condition: { type: 'object' },
                then_actions: { type: 'array' }
              },
              required: ['condition', 'then_actions']
            }
          },
          required: ['type', 'parameters']
        }
      }
    };

    // Test data - valid IF operation
    const ifOperationData = {
      type: 'IF',
      comment: 'Only proceed if entity has required components',
      parameters: {
        condition: {
          and: [
            { var: 'context.thinkerNameComponent' },
            { var: 'context.thinkerPositionComponent' }
          ]
        },
        then_actions: [
          {
            type: 'GET_TIMESTAMP',
            parameters: { result_variable: 'currentTimestamp' }
          }
        ]
      }
    };

    // Create validator and add schema
    const validator = new AjvSchemaValidator({ logger: testBed.mockLogger });
    
    // Add the operation schema
    validator.addSchema(operationSchema, 'schema://living-narrative-engine/operation.schema.json');
    
    // Validate the IF operation
    const result = validator.validate('schema://living-narrative-engine/operation.schema.json', ifOperationData);
    
    if (!result.isValid) {
      console.error('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it('should correctly validate QUERY_COMPONENT operation against QUERY_COMPONENT schema', () => {
    // Same schema as above
    const operationSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'schema://living-narrative-engine/operation.schema.json',
      title: 'Operation Schema',
      anyOf: [
        {
          $ref: '#/$defs/QueryComponentOperation'
        },
        {
          $ref: '#/$defs/IfOperation'
        }
      ],
      $defs: {
        QueryComponentOperation: {
          type: 'object',
          properties: {
            type: { const: 'QUERY_COMPONENT' },
            parameters: { type: 'object' }
          },
          required: ['type', 'parameters']
        },
        IfOperation: {
          type: 'object',
          properties: {
            type: { const: 'IF' },
            parameters: {
              type: 'object',
              properties: {
                condition: { type: 'object' },
                then_actions: { type: 'array' }
              },
              required: ['condition', 'then_actions']
            }
          },
          required: ['type', 'parameters']
        }
      }
    };

    // Test data - valid QUERY_COMPONENT operation
    const queryComponentData = {
      type: 'QUERY_COMPONENT',
      parameters: {
        entity_ref: 'actor',
        component_type: 'core:name',
        result_variable: 'thinkerNameComponent'
      }
    };

    // Create validator and add schema
    const validator = new AjvSchemaValidator({ logger: testBed.mockLogger });
    
    // Add the operation schema
    validator.addSchema(operationSchema, 'schema://living-narrative-engine/operation.schema.json');
    
    // Validate the QUERY_COMPONENT operation
    const result = validator.validate('schema://living-narrative-engine/operation.schema.json', queryComponentData);
    
    if (!result.isValid) {
      console.error('Validation errors:', JSON.stringify(result.errors, null, 2));
    }
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it('should reproduce the anyOf validation error from the log', () => {
    // Test the actual entity_thought rule structure that was failing
    const ruleData = {
      $schema: 'schema://living-narrative-engine/rule.schema.json',
      rule_id: 'entity_thought',
      event_type: 'core:entity_thought',
      actions: [
        {
          type: 'QUERY_COMPONENTS',
          parameters: {
            entity_ref: 'actor',
            pairs: [
              {
                component_type: 'core:name',
                result_variable: 'thinkerNameComponent'
              }
            ]
          }
        },
        {
          type: 'IF',
          parameters: {
            condition: {
              var: 'context.thinkerNameComponent'
            },
            then_actions: [
              {
                type: 'DISPATCH_THOUGHT',
                parameters: {
                  entity_id: '{event.payload.entityId}',
                  thoughts: '{event.payload.thoughts}',
                  notes: '{event.payload.notes}'
                }
              }
            ]
          }
        }
      ]
    };

    // Create simple rule schema for testing
    const ruleSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'schema://living-narrative-engine/rule.schema.json',
      type: 'object',
      properties: {
        rule_id: { type: 'string' },
        event_type: { type: 'string' },
        actions: {
          type: 'array',
          items: {
            $ref: 'schema://living-narrative-engine/operation.schema.json'
          }
        }
      },
      required: ['rule_id', 'event_type', 'actions']
    };

    // Create operation schema with real structure
    const operationSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'schema://living-narrative-engine/operation.schema.json',
      anyOf: [
        {
          $ref: '#/$defs/QueryComponentsOperation'
        },
        {
          $ref: '#/$defs/IfOperation'
        },
        {
          $ref: '#/$defs/DispatchThoughtOperation'
        }
      ],
      $defs: {
        QueryComponentsOperation: {
          type: 'object',
          properties: {
            type: { const: 'QUERY_COMPONENTS' },
            parameters: {
              type: 'object',
              properties: {
                entity_ref: { type: 'string' },
                pairs: { type: 'array' }
              },
              required: ['entity_ref', 'pairs']
            }
          },
          required: ['type', 'parameters']
        },
        IfOperation: {
          type: 'object',
          properties: {
            type: { const: 'IF' },
            parameters: {
              type: 'object',
              properties: {
                condition: { type: 'object' },
                then_actions: { type: 'array' }
              },
              required: ['condition', 'then_actions']
            }
          },
          required: ['type', 'parameters']
        },
        DispatchThoughtOperation: {
          type: 'object',
          properties: {
            type: { const: 'DISPATCH_THOUGHT' },
            parameters: {
              type: 'object',
              properties: {
                entity_id: { type: 'string' },
                thoughts: { type: 'string' },
                notes: { type: 'string' }
              },
              required: ['entity_id', 'thoughts']
            }
          },
          required: ['type', 'parameters']
        }
      }
    };

    // Create validator and add schemas
    const validator = testBed.createAjvValidator();
    
    validator.addSchema(operationSchema, 'schema://living-narrative-engine/operation.schema.json');
    validator.addSchema(ruleSchema, 'schema://living-narrative-engine/rule.schema.json');
    
    // This should validate successfully
    const result = validator.validate('schema://living-narrative-engine/rule.schema.json', ruleData);
    
    if (!result.isValid) {
      console.error('Rule validation errors:', JSON.stringify(result.errors, null, 2));
      
      // Log specific error details to help diagnose the anyOf issue
      result.errors.forEach(error => {
        console.error(`Error at path: ${error.instancePath}`);
        console.error(`Schema path: ${error.schemaPath}`);
        console.error(`Message: ${error.message}`);
        console.error(`Data: ${JSON.stringify(error.data)}`);
      });
    }
    
    // This test might fail initially, but it will help us understand the anyOf resolution issue
    expect(result.isValid).toBe(true);
  });
});