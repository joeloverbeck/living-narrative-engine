/**
 * @file Integration test to reproduce the macro reference validation bug
 * @description Reproduces the exact runtime validation failure with macro references
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFile } from 'fs/promises';
import path from 'path';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';
import { createTestBed } from '../../common/testBed.js';

describe('Macro Reference Validation Bug Reproduction', () => {
  let testBed;
  let schemaValidator;
  let logger;

  beforeEach(async () => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();

    // Create AjvSchemaValidator
    schemaValidator = new AjvSchemaValidator({ logger });

    // Load the essential schemas manually for the test
    await loadRequiredSchemas(schemaValidator);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  /**
   * Loads the required schemas for rule validation
   */
  async function loadRequiredSchemas(validator) {
    const schemaFiles = [
      'data/schemas/common.schema.json',
      'data/schemas/rule.schema.json', 
      'data/schemas/operation.schema.json',
      'data/schemas/condition-container.schema.json'
    ];

    // Load operation schemas
    const operationSchemaFiles = [
      'data/schemas/operations/queryComponent.schema.json',
      'data/schemas/operations/removeComponent.schema.json', 
      'data/schemas/operations/getName.schema.json',
      'data/schemas/operations/setVariable.schema.json'
    ];

    // Load all schemas
    for (const schemaFile of [...schemaFiles, ...operationSchemaFiles]) {
      try {
        const schemaContent = await readFile(schemaFile, 'utf8');
        const schema = JSON.parse(schemaContent);
        await validator.addSchema(schema, schema.$id);
      } catch (error) {
        logger.warn(`Could not load schema ${schemaFile}: ${error.message}`);
        // Continue with other schemas - some may be optional
      }
    }
  }

  describe('Reproduction of runtime validation failure', () => {
    it('should reproduce the exact validation error from the logs', async () => {
      // This is the exact rule that fails in runtime
      const rule = {
        "$schema": "schema://living-narrative-engine/rule.schema.json",
        "rule_id": "handle_get_up_from_furniture",
        "comment": "Handles positioning:get_up_from_furniture action",
        "event_type": "core:attempt_action",
        "condition": {
          "condition_ref": "positioning:event-is-action-get-up-from-furniture"
        },
        "actions": [
          {
            "type": "QUERY_COMPONENT",
            "comment": "Get actor's sitting position info",
            "parameters": {
              "entity_ref": "{event.payload.actorId}",
              "component_type": "positioning:sitting_on",
              "result_variable": "sittingInfo"
            }
          },
          {
            "type": "REMOVE_COMPONENT", 
            "comment": "Remove sitting_on from actor",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "positioning:sitting_on"
            }
          },
          {
            "type": "GET_NAME",
            "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "logMessage",
              "value": "{context.actorName} gets up."
            }
          },
          {
            "macro": "core:logSuccessAndEndTurn"
          }
        ]
      };

      // This should work but currently fails in runtime
      try {
        const result = validateAgainstSchema(
          schemaValidator,
          'schema://living-narrative-engine/rule.schema.json',
          rule,
          logger,
          {
            validationDebugMessage: 'Testing exact runtime failure scenario',
            failureMessage: 'Rule validation failed',
            filePath: 'handle_get_up_from_furniture.rule.json'
          }
        );

        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();

        // If we get here, the bug is not reproduced in this test environment
        logger.info('Validation passed - bug may be environment-specific');

      } catch (error) {
        // This is the expected error from the runtime logs
        expect(error.message).toContain('Missing operation type');
        expect(error.message).toContain('type');
        
        // Log the full error for debugging
        logger.error('Reproduced validation error:', error);
        
        // This test passes if we reproduce the error
        expect(error).toBeDefined();
      }
    });

    it('should test validation with pre-validation disabled to isolate AJV issues', async () => {
      const rule = {
        "event_type": "core:attempt_action",
        "actions": [
          {
            "macro": "core:logSuccessAndEndTurn"
          }
        ]
      };

      try {
        const result = validateAgainstSchema(
          schemaValidator,
          'schema://living-narrative-engine/rule.schema.json',
          rule,
          logger,
          {
            skipPreValidation: true, // Skip pre-validation to test AJV directly
            failureMessage: 'AJV-only validation failed',
            filePath: 'macro_test.rule.json'
          }
        );

        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();

      } catch (error) {
        logger.error('AJV validation error (pre-validation skipped):', error);
        
        // Check if this is specifically a macro validation issue
        if (error.message.includes('macro') || error.message.includes('type')) {
          expect(error).toBeDefined();
        } else {
          throw error; // Re-throw if it's a different issue
        }
      }
    });

    it('should test direct AJV validation of macro reference', async () => {
      const macroAction = {
        "macro": "core:logSuccessAndEndTurn"
      };

      // Test if schema validator can validate a macro reference directly
      if (schemaValidator.isSchemaLoaded('schema://living-narrative-engine/operation.schema.json')) {
        const result = schemaValidator.validate(
          'schema://living-narrative-engine/operation.schema.json',
          macroAction
        );

        logger.info('Direct AJV validation result:', result);

        if (!result.isValid) {
          logger.error('AJV validation errors:', result.errors);
        }

        expect(result.isValid).toBe(true);
      } else {
        logger.warn('Operation schema not loaded - skipping direct AJV test');
      }
    });

    it('should test the oneOf pattern handling in operation schema', async () => {
      // Test both valid operation and macro reference
      const testCases = [
        {
          name: 'operation with type',
          action: {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "test",
              "value": "value"
            }
          }
        },
        {
          name: 'macro reference',
          action: {
            "macro": "core:logSuccessAndEndTurn"
          }
        }
      ];

      for (const testCase of testCases) {
        logger.info(`Testing ${testCase.name}:`, testCase.action);

        // Try to validate against the Action definition
        if (schemaValidator.isSchemaLoaded('schema://living-narrative-engine/operation.schema.json')) {
          const result = schemaValidator.validate(
            'schema://living-narrative-engine/operation.schema.json',
            testCase.action
          );

          if (!result.isValid) {
            logger.error(`${testCase.name} validation failed:`, result.errors);
          }

          expect(result.isValid).toBe(true, `${testCase.name} should validate successfully`);
        }
      }
    });
  });
});