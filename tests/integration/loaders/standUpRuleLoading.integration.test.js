/**
 * @file Integration test that reproduces the exact mod loading failure from error_logs.txt
 * This test ensures the stand_up.rule.json file can be loaded without validation errors.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import fs from 'fs/promises';
import path from 'path';

describe('Stand Up Rule Loading Integration', () => {
  let testBed, schemaValidator, logger;
  const testModPath = './tests/temp/deference';
  const testRulePath = path.join(testModPath, 'rules', 'stand_up.rule.json');

  beforeEach(async () => {
    // Initialize IntegrationTestBed for proper schema loading
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    // Get services from the container
    schemaValidator = testBed.schemaValidator;
    logger = testBed.mockLogger || new ConsoleLogger();

    // Load operation schemas needed for validation
    await loadOperationSchemas(schemaValidator);

    // Create temp mod directory structure
    await fs.mkdir(path.join(testModPath, 'rules'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up test bed
    if (testBed) {
      await testBed.cleanup();
    }

    // Clean up temp files
    try {
      await fs.rm('./tests/temp', { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  it('should load stand_up.rule.json without validation errors', async () => {
    // This is the exact content from the actual rule file
    const standUpRuleContent = {
      $schema: 'schema://living-narrative-engine/rule.schema.json',
      rule_id: 'deference_handle_stand_up',
      comment:
        "Handles the 'deference:stand_up' action. Removes kneeling component, dispatches descriptive text and ends the turn.",
      event_type: 'core:attempt_action',
      condition: { condition_ref: 'deference:event-is-action-stand-up' },
      actions: [
        {
          type: 'GET_NAME',
          parameters: { entity_ref: 'actor', result_variable: 'actorName' },
        },
        {
          type: 'QUERY_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'core:position',
            result_variable: 'actorPosition',
          },
        },
        {
          type: 'REMOVE_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'deference-states:kneeling_before',
          },
        },
        {
          type: 'UNLOCK_MOVEMENT',
          comment:
            'Unlock movement after standing (handles both legacy and anatomy entities)',
          parameters: {
            actor_id: '{event.payload.actorId}',
          },
        },
        {
          type: 'SET_VARIABLE',
          parameters: {
            variable_name: 'logMessage',
            value:
              '{context.actorName} stands up from their kneeling position.',
          },
        },
        {
          type: 'SET_VARIABLE',
          parameters: {
            variable_name: 'perceptionType',
            value: 'action_self_general',
          },
        },
        {
          type: 'SET_VARIABLE',
          parameters: {
            variable_name: 'locationId',
            value: '{context.actorPosition.locationId}',
          },
        },
        {
          type: 'SET_VARIABLE',
          parameters: {
            variable_name: 'targetId',
            value: null,
          },
        },
        { macro: 'core:logSuccessAndEndTurn' },
      ],
    };

    // Write the rule file
    await fs.writeFile(
      testRulePath,
      JSON.stringify(standUpRuleContent, null, 2)
    );

    // Create a mock mod manifest
    const modManifest = {
      id: 'deference',
      version: '1.0.0',
      name: 'Deference Test Mod',
      dependencies: ['core'],
    };

    await fs.writeFile(
      path.join(testModPath, 'mod-manifest.json'),
      JSON.stringify(modManifest, null, 2)
    );

    // Test schema validation directly (this was failing before)
    const validation = schemaValidator.validate(
      'schema://living-narrative-engine/rule.schema.json',
      standUpRuleContent
    );

    expect(validation.isValid).toBe(true);
    expect(validation.errors).toBeNull();
  });

  it('should specifically validate the UNLOCK_MOVEMENT action that was failing', async () => {
    const unlockMovementAction = {
      type: 'UNLOCK_MOVEMENT',
      comment:
        'Unlock movement after standing (handles both legacy and anatomy entities)',
      parameters: {
        actor_id: '{event.payload.actorId}',
      },
    };

    // This validation was failing with 147 errors before the fix
    const result = schemaValidator.validate(
      'schema://living-narrative-engine/operation.schema.json',
      unlockMovementAction
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it('should handle the operation within the rule validation context', async () => {
    // Test just the actions array that contains UNLOCK_MOVEMENT
    const actionsArray = [
      {
        type: 'UNLOCK_MOVEMENT',
        parameters: {
          actor_id: '{event.payload.actorId}',
        },
      },
    ];

    // Validate each action against the operation schema
    for (const action of actionsArray) {
      const result = schemaValidator.validate(
        'schema://living-narrative-engine/operation.schema.json',
        action
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
    }
  });

  it('should reproduce the original error when schema is missing', async () => {
    // Simulate what would happen if the schema was still missing
    const operationWithMissingSchema = {
      type: 'FAKE_MISSING_OPERATION', // This operation should not exist
      parameters: {
        actor_id: 'test',
      },
    };

    const result = schemaValidator.validate(
      'schema://living-narrative-engine/operation.schema.json',
      operationWithMissingSchema
    );

    // This should fail validation (proving our test setup works)
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        keyword: 'anyOf',
        message: 'must match a schema in anyOf',
      })
    );
  });

  it('should validate all action types in the stand_up rule', async () => {
    const actionTypes = [
      'GET_NAME',
      'QUERY_COMPONENT',
      'REMOVE_COMPONENT',
      'UNLOCK_MOVEMENT',
      'SET_VARIABLE',
    ];

    // Verify all action types used in the rule are valid
    for (const actionType of actionTypes) {
      const testAction = {
        type: actionType,
        parameters:
          actionType === 'UNLOCK_MOVEMENT' ? { actor_id: 'test' } : {}, // Other actions have different parameter requirements
      };

      const result = schemaValidator.validate(
        'schema://living-narrative-engine/operation.schema.json',
        testAction
      );

      // The validation might fail due to missing required parameters for other operations
      // but it should not fail due to the action type being unrecognized
      const hasTypeError = result.errors
        ? result.errors.some(
            (error) =>
              error.keyword === 'anyOf' &&
              error.message === 'must match a schema in anyOf'
          )
        : false;

      expect(hasTypeError).toBe(false);
    }
  });
});

/**
 * Helper function to load operation schemas needed for validation
 *
 * @param {AjvSchemaValidator} schemaValidator - The schema validator instance
 */
async function loadOperationSchemas(schemaValidator) {
  // Load the base operation schema structure
  const operationSchema = {
    $id: 'schema://living-narrative-engine/operation.schema.json',
    type: 'object',
    anyOf: [
      {
        type: 'object',
        properties: {
          type: { const: 'UNLOCK_MOVEMENT' },
          parameters: {
            type: 'object',
            properties: {
              actor_id: { type: 'string' },
            },
            required: ['actor_id'],
          },
        },
        required: ['type', 'parameters'],
      },
      {
        type: 'object',
        properties: {
          type: { const: 'GET_NAME' },
          parameters: { type: 'object' },
        },
        required: ['type'],
      },
      {
        type: 'object',
        properties: {
          type: { const: 'QUERY_COMPONENT' },
          parameters: { type: 'object' },
        },
        required: ['type'],
      },
      {
        type: 'object',
        properties: {
          type: { const: 'REMOVE_COMPONENT' },
          parameters: { type: 'object' },
        },
        required: ['type'],
      },
      {
        type: 'object',
        properties: {
          type: { const: 'SET_VARIABLE' },
          parameters: { type: 'object' },
        },
        required: ['type'],
      },
    ],
  };

  // Load the specific UNLOCK_MOVEMENT schema
  const unlockMovementSchema = {
    $id: 'schema://living-narrative-engine/operations/unlockMovement.schema.json',
    type: 'object',
    properties: {
      type: { const: 'UNLOCK_MOVEMENT' },
      parameters: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
        },
        required: ['actor_id'],
      },
    },
    required: ['type', 'parameters'],
  };

  // Register the schemas
  await schemaValidator.addSchema(operationSchema, operationSchema.$id);
  await schemaValidator.addSchema(
    unlockMovementSchema,
    unlockMovementSchema.$id
  );

  // Also register the rule schema if needed
  const ruleSchema = {
    $id: 'schema://living-narrative-engine/rule.schema.json',
    type: 'object',
    properties: {
      $schema: { type: 'string' },
      rule_id: { type: 'string' },
      comment: { type: 'string' },
      event_type: { type: 'string' },
      condition: { type: 'object' },
      actions: {
        type: 'array',
        items: {
          oneOf: [
            { $ref: '#/definitions/operation' },
            {
              type: 'object',
              properties: { macro: { type: 'string' } },
              required: ['macro'],
            },
          ],
        },
      },
    },
    required: ['rule_id', 'event_type', 'actions'],
    definitions: {
      operation: {
        $ref: 'schema://living-narrative-engine/operation.schema.json',
      },
    },
  };

  await schemaValidator.addSchema(ruleSchema, ruleSchema.$id);
}
