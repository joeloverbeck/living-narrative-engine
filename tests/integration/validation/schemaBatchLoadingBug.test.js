import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

/**
 * Test to investigate if batch schema loading is causing the schema validation mismatch bug
 */
describe('Schema Batch Loading Bug Investigation', () => {
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

  it('should investigate schema loading order and cross-reference issues', async () => {
    // Arrange - Simplified schema objects that mirror the issue
    const queryComponentsSchema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "$id": "schema://living-narrative-engine/operations/queryComponents.schema.json",
      "title": "QUERY_COMPONENTS Operation",
      "allOf": [
        {
          "$ref": "../base-operation.schema.json"
        },
        {
          "properties": {
            "type": {
              "const": "QUERY_COMPONENTS"
            },
            "parameters": {
              "$ref": "#/$defs/Parameters"
            }
          }
        }
      ],
      "$defs": {
        "Parameters": {
          "type": "object",
          "properties": {
            "entity_ref": { "type": "string" },
            "pairs": { "type": "array" }
          },
          "required": ["entity_ref", "pairs"]
        }
      }
    };

    const ifSchema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "$id": "schema://living-narrative-engine/operations/if.schema.json",
      "title": "IF Operation",
      "allOf": [
        {
          "$ref": "../base-operation.schema.json"
        },
        {
          "properties": {
            "type": {
              "const": "IF"
            },
            "parameters": {
              "$ref": "#/$defs/Parameters"
            }
          }
        }
      ],
      "$defs": {
        "Parameters": {
          "type": "object",
          "properties": {
            "condition": { "type": "object" },
            "then_actions": { "type": "array" }
          },
          "required": ["condition", "then_actions"]
        }
      }
    };

    const baseOperationSchema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "$id": "schema://living-narrative-engine/base-operation.schema.json",
      "title": "Base Operation Schema",
      "type": "object",
      "properties": {
        "type": { "type": "string" },
        "parameters": { "type": "object" }
      },
      "required": ["type", "parameters"]
    };

    // Act - Test different loading strategies
    
    // Strategy 1: Load schemas individually in dependency order
    try {
      await validator.addSchema(baseOperationSchema, baseOperationSchema.$id);
      await validator.addSchema(queryComponentsSchema, queryComponentsSchema.$id);
      await validator.addSchema(ifSchema, ifSchema.$id);
      
      // Test validation with individual loading
      const queryComponentsOp = {
        "type": "QUERY_COMPONENTS",
        "parameters": { "entity_ref": "actor", "pairs": [] }
      };
      
      const ifOp = {
        "type": "IF",
        "parameters": { "condition": {}, "then_actions": [] }
      };

      // Validate both operations
      const queryResult = validator.validate(queryComponentsSchema.$id, queryComponentsOp);
      const ifResult = validator.validate(ifSchema.$id, ifOp);

      // Assert - Both should pass validation with correct schemas
      expect(queryResult.isValid).toBe(true);
      expect(ifResult.isValid).toBe(true);

    } catch (error) {
      // Document the error for investigation
      console.log('Individual loading error:', error.message);
      throw error;
    }
  });

  it('should test batch loading vs individual loading behavior', async () => {
    // This test documents the different behaviors between batch and individual loading
    // to help identify if the batch loading is causing schema reference confusion
    
    const mockSchemas = [
      {
        "$id": "schema1",
        "type": "object",
        "properties": { "name": { "const": "SCHEMA1" } }
      },
      {
        "$id": "schema2", 
        "type": "object",
        "properties": { "name": { "const": "SCHEMA2" } }
      }
    ];

    // Test batch loading
    try {
      await validator.addSchemas(mockSchemas);
      
      // Verify both schemas are loaded correctly
      expect(validator.isSchemaLoaded("schema1")).toBe(true);
      expect(validator.isSchemaLoaded("schema2")).toBe(true);
      
      // Test that each validates against the correct schema
      const result1 = validator.validate("schema1", { "name": "SCHEMA1" });
      const result2 = validator.validate("schema2", { "name": "SCHEMA2" });
      
      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(true);
      
    } catch (error) {
      // Document any batch loading issues
      console.log('Batch loading error:', error.message);
      throw error;
    }
  });
});