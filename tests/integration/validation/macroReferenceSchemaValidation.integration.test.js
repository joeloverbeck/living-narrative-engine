/**
 * @file Integration test for macro reference schema validation
 * @description Tests the full validation chain with actual schema files to reproduce the runtime issue
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../../src/loaders/schemaLoader.js';
import WorkspaceDataFetcher from '../../../src/data/workspaceDataFetcher.js';
import PathResolver from '../../../src/paths/pathResolver.js';
import Configuration from '../../../src/utils/configuration.js';
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';
import { createTestBed } from '../../common/testBed.js';

describe('Macro Reference Schema Validation Integration', () => {
  let testBed;
  let schemaValidator;
  let logger;

  beforeEach(async () => {
    testBed = createTestBed();
    logger = testBed.createMockLogger();

    // Create real services for integration testing
    const configuration = new Configuration();
    const pathResolver = new PathResolver({ configuration, logger });
    const dataFetcher = new WorkspaceDataFetcher({ logger });
    const schemaLoader = new SchemaLoader({ configuration, pathResolver, dataFetcher, logger });

    // Create AjvSchemaValidator 
    schemaValidator = new AjvSchemaValidator({ logger });

    // Load the actual schemas needed for rule validation
    await schemaLoader.loadSchemas(schemaValidator);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Rule schema validation with macro references', () => {
    it('should validate rule with macro reference using real schemas', async () => {
      const rule = {
        "$schema": "schema://living-narrative-engine/rule.schema.json",
        "rule_id": "test_macro_rule",
        "event_type": "core:attempt_action",
        "actions": [
          {
            "type": "QUERY_COMPONENT",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "core:position",
              "result_variable": "position"
            }
          },
          {
            "type": "SET_VARIABLE",
            "parameters": {
              "variable_name": "message",
              "value": "Action completed"
            }
          },
          {
            "macro": "core:logSuccessAndEndTurn"
          }
        ]
      };

      const result = validateAgainstSchema(
        schemaValidator,
        'schema://living-narrative-engine/rule.schema.json',
        rule,
        logger,
        {
          validationDebugMessage: 'Testing macro reference in rule',
          failureMessage: 'Rule validation failed with macro reference',
          filePath: 'test_macro_rule.json'
        }
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate the exact rule structure that causes runtime failure', async () => {
      // This is a simplified version of the failing rule from handle_get_up_from_furniture.rule.json
      const rule = {
        "$schema": "schema://living-narrative-engine/rule.schema.json",
        "rule_id": "handle_get_up_from_furniture_test",
        "comment": "Simplified version of the failing rule",
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

      const result = validateAgainstSchema(
        schemaValidator,
        'schema://living-narrative-engine/rule.schema.json',
        rule,
        logger,
        {
          validationDebugMessage: 'Testing exact failing rule structure',
          failureMessage: 'Exact rule structure validation failed',
          filePath: 'handle_get_up_from_furniture_test.rule.json'
        }
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate rule with only macro reference action', async () => {
      const rule = {
        "rule_id": "simple_macro_rule",
        "event_type": "core:test_event",
        "actions": [
          {
            "macro": "core:logSuccessAndEndTurn"
          }
        ]
      };

      const result = validateAgainstSchema(
        schemaValidator,
        'schema://living-narrative-engine/rule.schema.json',
        rule,
        logger,
        {
          failureMessage: 'Simple macro rule validation failed',
          filePath: 'simple_macro_rule.json'
        }
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate various macro reference formats', async () => {
      const macroReferences = [
        { "macro": "core:logSuccessAndEndTurn" },
        { "macro": "positioning:establishSittingCloseness" },
        { "macro": "combat:attackSequence" },
        { "macro": "core:endTurn", "comment": "End turn with comment" }
      ];

      for (const macroRef of macroReferences) {
        const rule = {
          "event_type": "core:test_event",
          "actions": [macroRef]
        };

        const result = validateAgainstSchema(
          schemaValidator,
          'schema://living-narrative-engine/rule.schema.json',
          rule,
          logger,
          {
            failureMessage: `Macro reference validation failed for: ${macroRef.macro}`,
            filePath: `test_${macroRef.macro.replace(':', '_')}.json`
          }
        );

        expect(result.isValid).toBe(true, `Failed for macro: ${macroRef.macro}`);
        expect(result.errors).toBeNull();
      }
    });

    it('should fail validation for invalid macro reference structures', async () => {
      const invalidMacroReferences = [
        { "macro": "" }, // Empty string
        { "macro": 123 }, // Non-string
        { "macro": null }, // Null
        { "macro": "core:test", "type": "QUERY_COMPONENT" }, // Both macro and type
        { "macro": "invalid_format" } // Missing colon separator
      ];

      for (const invalidMacroRef of invalidMacroReferences) {
        const rule = {
          "event_type": "core:test_event",
          "actions": [invalidMacroRef]
        };

        try {
          const result = validateAgainstSchema(
            schemaValidator,
            'schema://living-narrative-engine/rule.schema.json',
            rule,
            logger,
            {
              failureMessage: `Should fail for invalid macro reference: ${JSON.stringify(invalidMacroRef)}`,
              filePath: `invalid_macro_test.json`
            }
          );

          expect(result.isValid).toBe(false, `Should fail for invalid macro: ${JSON.stringify(invalidMacroRef)}`);
        } catch (error) {
          // This is expected for invalid structures
          expect(error).toBeDefined();
          expect(error.message).toMatch(/(validation|schema|macro)/i);
        }
      }
    });
  });

  describe('Direct AJV validation of macro references', () => {
    it('should validate macro reference directly against operation schema', async () => {
      const macroReference = {
        "macro": "core:logSuccessAndEndTurn"
      };

      const result = schemaValidator.validate(
        'operation.schema.json#/$defs/Action',
        macroReference
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate operation reference directly against operation schema', async () => {
      const operation = {
        "type": "QUERY_COMPONENT",
        "parameters": {
          "entity_ref": "actor",
          "component_type": "core:position",
          "result_variable": "position"
        }
      };

      const result = schemaValidator.validate(
        'operation.schema.json#/$defs/Action',
        operation
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('should validate actions array with mixed operations and macro references', async () => {
      const actions = [
        {
          "type": "SET_VARIABLE",
          "parameters": {
            "variable_name": "test",
            "value": "value"
          }
        },
        {
          "macro": "core:logSuccessAndEndTurn"
        }
      ];

      // Validate each action individually
      for (let i = 0; i < actions.length; i++) {
        const result = schemaValidator.validate(
          'operation.schema.json#/$defs/Action',
          actions[i]
        );

        expect(result.isValid).toBe(true, `Action ${i} should be valid`);
        expect(result.errors).toBeNull();
      }
    });
  });

  describe('Schema loading verification', () => {
    it('should have loaded all required schemas', () => {
      const requiredSchemas = [
        'schema://living-narrative-engine/rule.schema.json',
        'schema://living-narrative-engine/operation.schema.json',
        'schema://living-narrative-engine/common.schema.json'
      ];

      requiredSchemas.forEach(schemaId => {
        expect(schemaValidator.isSchemaLoaded(schemaId)).toBe(true, `Schema ${schemaId} should be loaded`);
      });
    });

    it('should be able to get validator functions for required schemas', () => {
      const requiredSchemas = [
        'schema://living-narrative-engine/rule.schema.json',
        'operation.schema.json#/$defs/Action'
      ];

      requiredSchemas.forEach(schemaId => {
        const validatorFn = schemaValidator.getValidator(schemaId);
        expect(validatorFn).toBeDefined(`Validator for ${schemaId} should exist`);
        expect(typeof validatorFn).toBe('function');
      });
    });
  });
});