import { describe, it, expect } from '@jest/globals';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Integration test reproducing the exact scenario from the original error:
 *
 * VED: Payload validation FAILED for event 'core:system_error_occurred'.
 * Dispatch SKIPPED. Errors: [/details]: must NOT have additional properties
 *
 * This test ensures our fix resolves the validation failure in a realistic environment.
 */
describe('safeDispatchError schema compliance integration', () => {
  let ajv;
  let schemaValidator;

  beforeEach(() => {
    // Create Ajv validator directly
    ajv = new Ajv();
    addFormats(ajv);

    // Add the actual core:system_error_occurred event schema
    const systemErrorSchema = {
      title: 'Core: System Error Occurred Event Payload',
      description:
        'Defines the payload structure for the core:system_error_occurred event',
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Required. A user‐facing message describing the error.',
        },
        details: {
          type: 'object',
          description:
            'Optional. Additional technical details about the error.',
          properties: {
            statusCode: {
              type: 'integer',
              description:
                'Optional. Numeric code (e.g., HTTP status) associated with the error.',
            },
            url: {
              type: 'string',
              description: 'Optional. URI related to the error, if applicable.',
            },
            raw: {
              type: 'string',
              description: 'Optional. Raw error text or payload for debugging.',
            },
            stack: {
              type: 'string',
              description: 'Optional. Stack trace string for debugging.',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description:
                'Optional. ISO 8601 timestamp of when the error occurred.',
            },
            scopeName: {
              type: 'string',
              description:
                'Optional. Name of the scope that caused the error, if applicable.',
            },
            errorContext: {
              type: 'object',
              description:
                'Optional. Complete ActionErrorContext object containing detailed information about action failures.',
            },
            actionId: {
              type: 'string',
              description:
                'Optional. The ID of the action that failed (extracted from errorContext for backward compatibility).',
            },
            phase: {
              type: 'string',
              description:
                'Optional. The phase where the action failed (extracted from errorContext for backward compatibility).',
            },
            targetId: {
              type: ['string', 'null'],
              description:
                'Optional. The ID of the target entity (extracted from errorContext for backward compatibility).',
            },
          },
          additionalProperties: false,
        },
      },
      required: ['message'],
      additionalProperties: false,
    };

    ajv.addSchema(systemErrorSchema, 'core:system_error_occurred');
    schemaValidator = ajv.getSchema('core:system_error_occurred');
  });

  it('should create schema-compliant payload from complex ActionErrorContext', () => {
    // Create a realistic ActionErrorContext like the one that caused the original error
    const actionErrorContext = {
      actionId: 'core:wait_for_turn_end',
      targetId: 'player_character',
      error: {
        message: 'Turn end timeout exceeded',
        stack:
          'Error: Turn end timeout exceeded\n    at onTimeout_fn @ awaitingExternalTurnEndState.js:197',
      },
      phase: 'execution',
      actionDefinition: {
        id: 'core:wait_for_turn_end',
        name: 'Wait for Turn End',
        type: 'system',
      },
      actorSnapshot: {
        id: 'player_character',
        components: {
          'core:actor': { name: 'Player', health: 100 },
          'core:location': { current: 'town_square' },
        },
      },
      evaluationTrace: {
        steps: [
          {
            type: 'validation',
            input: { timeout: 30000 },
            output: { valid: true },
            success: true,
            message: 'Validation passed',
            duration: 2,
          },
        ],
        failurePoint: 'execution',
        finalContext: { timeout: 30000, elapsed: 45000 },
      },
      suggestedFixes: [
        {
          type: 'configuration',
          description: 'Increase turn timeout limit',
          details: { currentTimeout: 30000, suggestedTimeout: 60000 },
          confidence: 0.8,
        },
      ],
      environmentContext: {
        turnId: 'turn_12345',
        gameState: 'active',
        location: 'town_square',
      },
      timestamp: Date.now(),
    };

    let capturedPayload = null;
    const mockDispatcher = {
      dispatch: (eventType, payload) => {
        capturedPayload = payload;
      },
    };

    safeDispatchError(mockDispatcher, actionErrorContext);

    // Test that the payload passes schema validation
    const isValid = schemaValidator(capturedPayload);
    const errors = schemaValidator.errors;

    expect(isValid).toBe(true);
    expect(errors || []).toHaveLength(0);

    // Verify the complex ActionErrorContext data is preserved
    expect(capturedPayload.message).toBe('Turn end timeout exceeded');
    expect(capturedPayload.details.errorContext).toBeDefined();
    expect(capturedPayload.details.actionId).toBe('core:wait_for_turn_end');
    expect(capturedPayload.details.phase).toBe('execution');
    expect(capturedPayload.details.targetId).toBe('player_character');

    // Verify the full context is preserved
    expect(capturedPayload.details.errorContext.environmentContext.turnId).toBe(
      'turn_12345'
    );
    expect(capturedPayload.details.errorContext.suggestedFixes).toHaveLength(1);
    expect(
      capturedPayload.details.errorContext.evaluationTrace.failurePoint
    ).toBe('execution');
  });

  it('should preserve all ActionErrorContext information in schema-compliant format', () => {
    const actionErrorContext = {
      actionId: 'test_action',
      targetId: 'test_target',
      error: { message: 'Test error occurred' },
      phase: 'validation',
      actionDefinition: { id: 'test_action', name: 'Test Action' },
      actorSnapshot: { id: 'test_actor', components: {} },
      evaluationTrace: {
        steps: [],
        failurePoint: 'validation',
        finalContext: {},
      },
      suggestedFixes: [],
      environmentContext: { testContext: 'value' },
      timestamp: 1640995200000, // Fixed timestamp for consistent testing
    };

    let capturedPayload = null;
    const mockDispatcher = {
      dispatch: (eventType, payload) => {
        capturedPayload = payload;
      },
    };

    safeDispatchError(mockDispatcher, actionErrorContext);

    // Test that the payload passes schema validation
    const isValid = schemaValidator(capturedPayload);
    const errors = schemaValidator.errors;

    expect(isValid).toBe(true);
    expect(errors || []).toHaveLength(0);

    // Verify the payload structure is schema-compliant
    expect(capturedPayload).toBeDefined();
    expect(capturedPayload.message).toBe('Test error occurred');
    expect(capturedPayload.details.errorContext).toBeDefined();
    expect(capturedPayload.details.actionId).toBe('test_action');
    expect(capturedPayload.details.phase).toBe('validation');
    expect(capturedPayload.details.targetId).toBe('test_target');

    // Verify all ActionErrorContext data is preserved in errorContext
    expect(capturedPayload.details.errorContext).toMatchObject({
      actionId: 'test_action',
      targetId: 'test_target',
      phase: 'validation',
      actionDefinition: { id: 'test_action', name: 'Test Action' },
      environmentContext: { testContext: 'value' },
      timestamp: 1640995200000,
    });
  });

  it('should handle traditional error details objects without validation failures', () => {
    let capturedPayload = null;
    const mockDispatcher = {
      dispatch: (eventType, payload) => {
        capturedPayload = payload;
      },
    };

    // Pass traditional error details - production code passes them as-is
    safeDispatchError(mockDispatcher, 'Network request failed', {
      statusCode: 500,
      url: 'https://api.example.com/data',
    });

    // Test that the payload passes schema validation
    const isValid = schemaValidator(capturedPayload);
    const errors = schemaValidator.errors;

    expect(isValid).toBe(true);
    expect(errors || []).toHaveLength(0);

    // Verify that properties are preserved directly
    expect(capturedPayload.details.statusCode).toBe(500);
    expect(capturedPayload.details.url).toBe('https://api.example.com/data');
  });
});
