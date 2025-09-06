/**
 * @file Debug version of real schema validation with limited error output
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import createTestAjv from '../../common/validation/createTestAjv.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

describe('Debug Real Schema Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should show exactly why entity_thought rule fails validation', async () => {
    const ajv = createTestAjv();
    const validator = new AjvSchemaValidator({ 
      logger: testBed.mockLogger,
      ajvInstance: ajv 
    });

    // Simplified rule with just the failing parts
    const entityThoughtRule = {
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

    const result = validator.validate('schema://living-narrative-engine/rule.schema.json', entityThoughtRule);
    
    if (!result.isValid) {
      console.error('VALIDATION FAILED');
      console.error('Number of errors:', result.errors.length);
      
      // Show only first few errors to understand the pattern
      const firstErrors = result.errors.slice(0, 5);
      firstErrors.forEach((error, index) => {
        console.error(`\nError ${index + 1}:`);
        console.error(`  Path: ${error.instancePath}`);
        console.error(`  Schema path: ${error.schemaPath}`);
        console.error(`  Keyword: ${error.keyword}`);
        console.error(`  Message: ${error.message}`);
        
        if (error.params) {
          console.error(`  Params:`, JSON.stringify(error.params));
        }
      });
      
      // Look for specific schema mismatch errors
      const schemaMismatchErrors = result.errors.filter(error => 
        error.message && error.message.includes('should be equal to constant')
      );
      
      if (schemaMismatchErrors.length > 0) {
        console.error(`\nFound ${schemaMismatchErrors.length} schema mismatch errors:`);
        schemaMismatchErrors.slice(0, 3).forEach((error, index) => {
          console.error(`  ${index + 1}. ${error.instancePath}: ${error.message}`);
          if (error.params && error.params.allowedValue) {
            console.error(`     Expected: ${error.params.allowedValue}`);
          }
        });
      }
    }
    
    // Don't fail the test, just show what happens
    console.log('Test completed - validation result:', result.isValid);
  });

  it('should test IF operation validation specifically', async () => {
    const ajv = createTestAjv();
    const validator = new AjvSchemaValidator({ 
      logger: testBed.mockLogger,
      ajvInstance: ajv 
    });

    const ifOperation = {
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
    };

    const result = validator.validate('schema://living-narrative-engine/operation.schema.json', ifOperation);
    
    console.log('IF operation validation result:', result.isValid);
    
    if (!result.isValid) {
      console.error('IF operation errors:');
      result.errors.slice(0, 3).forEach((error, index) => {
        console.error(`  ${index + 1}. ${error.instancePath}: ${error.message}`);
        if (error.params && error.params.allowedValue) {
          console.error(`     Expected: ${error.params.allowedValue}`);
        }
      });
    }
  });
});