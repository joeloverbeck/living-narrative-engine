/**
 * @file Integration test for UNLOCK_MOVEMENT operation schema validation
 * Tests the specific issue found in error_logs.txt where stand_up.rule.json
 * was failing validation due to missing unlockMovement schema.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

describe('UNLOCK_MOVEMENT Schema Validation Integration', () => {
  let testBed, schemaValidator;

  beforeEach(async () => {
    // Initialize IntegrationTestBed for proper schema loading
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    // Get schema validator from the container
    schemaValidator = testBed.schemaValidator;

    // Load operation schemas needed for validation
    await loadOperationSchemas(schemaValidator);
  });

  afterEach(async () => {
    // Clean up test bed
    if (testBed) {
      await testBed.cleanup();
    }
  });

  it('should validate UNLOCK_MOVEMENT operation schema correctly', async () => {
    // Valid UNLOCK_MOVEMENT operation
    const validOperation = {
      type: 'UNLOCK_MOVEMENT',
      parameters: {
        actor_id: 'test_actor_123',
      },
    };

    // Should validate against the operation schema
    const result = schemaValidator.validate(
      'schema://living-narrative-engine/operations/unlockMovement.schema.json',
      validOperation
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it('should reject UNLOCK_MOVEMENT operation with missing actor_id', async () => {
    const invalidOperation = {
      type: 'UNLOCK_MOVEMENT',
      parameters: {},
    };

    const result = schemaValidator.validate(
      'schema://living-narrative-engine/operations/unlockMovement.schema.json',
      invalidOperation
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        instancePath: '/parameters',
        schemaPath: '#/properties/parameters/required',
        keyword: 'required',
        message: "must have required property 'actor_id'",
      })
    );
  });

  it('should reject UNLOCK_MOVEMENT operation with invalid actor_id type', async () => {
    const invalidOperation = {
      type: 'UNLOCK_MOVEMENT',
      parameters: {
        actor_id: 123, // Should be string
      },
    };

    const result = schemaValidator.validate(
      'schema://living-narrative-engine/operations/unlockMovement.schema.json',
      invalidOperation
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        instancePath: '/parameters/actor_id',
        schemaPath: '#/properties/parameters/properties/actor_id/type',
        keyword: 'type',
        message: 'must be string',
      })
    );
  });

  it('should validate the stand_up.rule.json file that was failing', async () => {
    // This is the rule content that was failing validation
    const standUpRule = {
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

    // Validate the entire rule
    const result = schemaValidator.validate(
      'schema://living-narrative-engine/rule.schema.json',
      standUpRule
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it('should allow UNLOCK_MOVEMENT in the operation schema anyOf', async () => {
    const unlockMovementAction = {
      type: 'UNLOCK_MOVEMENT',
      parameters: {
        actor_id: 'test_actor',
      },
    };

    // Test against the main operation schema which uses anyOf
    const result = schemaValidator.validate(
      'schema://living-narrative-engine/operation.schema.json',
      unlockMovementAction
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toBeNull();
  });
});

/**
 * Helper function to load operation schemas needed for validation
 *
 * @param {AjvSchemaValidator} schemaValidator - The schema validator instance
 */
async function loadOperationSchemas(schemaValidator) {
  // Load the base operation schema structure with all operation types
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
          comment: { type: 'string' },
        },
        required: ['type', 'parameters'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          type: { const: 'GET_NAME' },
          parameters: {
            type: 'object',
            properties: {
              entity_ref: { type: 'string' },
              result_variable: { type: 'string' },
            },
            required: ['entity_ref', 'result_variable'],
          },
        },
        required: ['type', 'parameters'],
      },
      {
        type: 'object',
        properties: {
          type: { const: 'QUERY_COMPONENT' },
          parameters: {
            type: 'object',
            properties: {
              entity_ref: { type: 'string' },
              component_type: { type: 'string' },
              result_variable: { type: 'string' },
            },
            required: ['entity_ref', 'component_type', 'result_variable'],
          },
        },
        required: ['type', 'parameters'],
      },
      {
        type: 'object',
        properties: {
          type: { const: 'REMOVE_COMPONENT' },
          parameters: {
            type: 'object',
            properties: {
              entity_ref: { type: 'string' },
              component_type: { type: 'string' },
            },
            required: ['entity_ref', 'component_type'],
          },
        },
        required: ['type', 'parameters'],
      },
      {
        type: 'object',
        properties: {
          type: { const: 'SET_VARIABLE' },
          parameters: {
            type: 'object',
            properties: {
              variable_name: { type: 'string' },
              value: {},
            },
            required: ['variable_name', 'value'],
          },
        },
        required: ['type', 'parameters'],
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

  // Also register the rule schema for complete validation
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
            { $ref: 'schema://living-narrative-engine/operation.schema.json' },
            {
              type: 'object',
              properties: {
                macro: { type: 'string' },
              },
              required: ['macro'],
              additionalProperties: false,
            },
          ],
        },
      },
    },
    required: ['rule_id', 'event_type', 'actions'],
    additionalProperties: false,
  };

  await schemaValidator.addSchema(ruleSchema, ruleSchema.$id);
}
