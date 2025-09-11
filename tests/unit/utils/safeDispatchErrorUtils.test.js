import { describe, it, expect, jest } from '@jest/globals';
import {
  safeDispatchError,
  dispatchValidationError,
  InvalidDispatcherError,
} from '../../../src/utils/safeDispatchErrorUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Mock schema for core:system_error_occurred event
const SYSTEM_ERROR_SCHEMA = {
  title: 'Core: System Error Occurred Event Payload',
  description: 'Defines the payload structure for the core:system_error_occurred event',
  type: 'object',
  properties: {
    message: {
      type: 'string',
      description: 'Required. A user‐facing message describing the error.'
    },
    details: {
      type: 'object',
      description: 'Optional. Additional technical details about the error.',
      properties: {
        statusCode: {
          type: 'integer',
          description: 'Optional. Numeric code (e.g., HTTP status) associated with the error.'
        },
        url: {
          type: 'string',
          description: 'Optional. URI related to the error, if applicable.'
        },
        raw: {
          type: 'string',
          description: 'Optional. Raw error text or payload for debugging.'
        },
        stack: {
          type: 'string',
          description: 'Optional. Stack trace string for debugging.'
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'Optional. ISO 8601 timestamp of when the error occurred.'
        },
        scopeName: {
          type: 'string',
          description: 'Optional. Name of the scope that caused the error, if applicable.'
        }
      },
      additionalProperties: false
    }
  },
  required: ['message'],
  additionalProperties: false
};

describe('safeDispatchError', () => {
  it('dispatches the display error event', () => {
    const dispatcher = { dispatch: jest.fn() };
    safeDispatchError(dispatcher, 'boom', { a: 1 });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'boom',
      details: {
        raw: JSON.stringify({ extra: { a: 1 } }, null, 2),
      },
    });
  });

  it('throws if dispatcher is invalid', () => {
    const call = () => safeDispatchError({}, 'oops');
    expect(call).toThrow(InvalidDispatcherError);
    let error;
    try {
      call();
    } catch (err) {
      error = err;
    }
    expect(error.message).toBe(
      "Invalid or missing method 'dispatch' on dependency 'safeDispatchError: dispatcher'."
    );
    expect(error.details).toEqual({ functionName: 'safeDispatchError' });
  });

  it('handles ActionErrorContext object', () => {
    const dispatcher = { dispatch: jest.fn() };
    const actionErrorContext = {
      actionId: 'test-action',
      targetId: 'target-123',
      error: { message: 'Action failed due to invalid state' },
      phase: 'validation',
      actionDefinition: { id: 'test-action', name: 'Test Action' },
      actorSnapshot: { id: 'actor-1', components: {} },
      evaluationTrace: {
        steps: [],
        failurePoint: 'validation',
        finalContext: {},
      },
      suggestedFixes: [],
      environmentContext: { location: 'test-location' },
      timestamp: 1234567890,
    };

    safeDispatchError(dispatcher, actionErrorContext);

    const call = dispatcher.dispatch.mock.calls[0];
    const [eventId, payload] = call;
    
    expect(eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(payload.message).toBe('Action failed due to invalid state');
    expect(payload.details).toHaveProperty('raw');
    expect(payload.details).toHaveProperty('timestamp');
    
    // Verify the ActionErrorContext data is preserved in raw field
    const parsedRaw = JSON.parse(payload.details.raw);
    expect(parsedRaw).toMatchObject({
      actionId: 'test-action',
      targetId: 'target-123',
      phase: 'validation'
    });
  });

  it('handles ActionErrorContext with missing error message', () => {
    const dispatcher = { dispatch: jest.fn() };
    const actionErrorContext = {
      actionId: 'test-action',
      targetId: null,
      error: {}, // No message property
      phase: 'execution',
      actionDefinition: { id: 'test-action' },
      actorSnapshot: {},
      evaluationTrace: {
        steps: [],
        failurePoint: 'execution',
        finalContext: {},
      },
      suggestedFixes: [],
      environmentContext: {},
      timestamp: 1234567890,
    };

    safeDispatchError(dispatcher, actionErrorContext);

    const call = dispatcher.dispatch.mock.calls[0];
    const [eventId, payload] = call;
    
    expect(eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(payload.message).toBe('An error occurred in the action system');
    expect(payload.details).toHaveProperty('raw');
    expect(payload.details).toHaveProperty('timestamp');
    
    // Verify the ActionErrorContext data is preserved in raw field
    const parsedRaw = JSON.parse(payload.details.raw);
    expect(parsedRaw).toMatchObject({
      actionId: 'test-action',
      targetId: null,
      phase: 'execution'
    });
  });
});

describe('dispatchValidationError', () => {
  it('dispatches the error and returns result with details', () => {
    const dispatcher = { dispatch: jest.fn() };
    const result = dispatchValidationError(dispatcher, 'bad', { foo: 1 });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'bad',
      details: {
        raw: JSON.stringify({ extra: { foo: 1 } }, null, 2),
      },
    });
    expect(result).toEqual({ ok: false, error: 'bad', details: { foo: 1 } });
  });

  it('omits details when none provided', () => {
    const dispatcher = { dispatch: jest.fn() };
    const result = dispatchValidationError(dispatcher, 'oops');
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'oops',
      details: {},
    });
    expect(result).toEqual({ ok: false, error: 'oops' });
  });
});

describe('schema validation issues', () => {
  let ajv;

  beforeEach(() => {
    ajv = new Ajv();
    addFormats(ajv);
    ajv.addSchema(SYSTEM_ERROR_SCHEMA, 'core:system_error_occurred');
  });

  it('FIXED: ActionErrorContext creates schema-compliant payload', () => {
    const dispatcher = { dispatch: jest.fn() };
    const actionErrorContext = {
      actionId: 'test-action',
      targetId: 'target-123',
      error: { message: 'Action failed due to invalid state' },
      phase: 'validation',
      actionDefinition: { id: 'test-action', name: 'Test Action' },
      actorSnapshot: { id: 'actor-1', components: {} },
      evaluationTrace: {
        steps: [],
        failurePoint: 'validation',
        finalContext: {},
      },
      suggestedFixes: [],
      environmentContext: { location: 'test-location' },
      timestamp: 1234567890,
    };

    safeDispatchError(dispatcher, actionErrorContext);

    // Get the payload that was dispatched
    const dispatchCall = dispatcher.dispatch.mock.calls[0];
    const [eventId, payload] = dispatchCall;
    expect(eventId).toBe(SYSTEM_ERROR_OCCURRED_ID);

    // This should now pass validation
    const validate = ajv.getSchema('core:system_error_occurred');
    const isValid = validate(payload);
    const errors = validate.errors;

    // This test verifies the fix works correctly
    expect(isValid).toBe(true);
    expect(errors || []).toHaveLength(0);

    // The payload should now be schema-compliant
    expect(payload.details).toHaveProperty('raw');
    expect(typeof payload.details.raw).toBe('string');
    
    // Parse the raw field to verify all ActionErrorContext data is preserved
    const parsedRaw = JSON.parse(payload.details.raw);
    expect(parsedRaw).toMatchObject({
      actionId: 'test-action',
      phase: 'validation', 
      targetId: 'target-123'
    });
  });

  it('FIXED: Traditional details object with extra properties is schema-compliant', () => {
    const dispatcher = { dispatch: jest.fn() };
    
    // This simulates when someone passes details that don't conform to schema
    safeDispatchError(dispatcher, 'boom', { 
      extraProperty: 'not allowed',
      anotherExtra: 123 
    });

    const dispatchCall = dispatcher.dispatch.mock.calls[0];
    const [, payload] = dispatchCall;
    
    const validate = ajv.getSchema('core:system_error_occurred');
    const isValid = validate(payload);
    const errors = validate.errors;

    expect(isValid).toBe(true);
    expect(errors || []).toHaveLength(0);
    
    // Extra properties should be moved to the 'raw' field
    expect(payload.details).toHaveProperty('raw');
    const parsedRaw = JSON.parse(payload.details.raw);
    expect(parsedRaw.extra).toMatchObject({
      extraProperty: 'not allowed',
      anotherExtra: 123
    });
  });

  it('demonstrates valid payload that should pass schema validation', () => {
    const dispatcher = { dispatch: jest.fn() };
    
    // This should create a valid payload
    safeDispatchError(dispatcher, 'Valid error message', {
      statusCode: 500,
      url: 'https://example.com/api/action',
      raw: 'Raw error details',
      stack: 'Error stack trace',
      timestamp: new Date().toISOString(),
      scopeName: 'test-scope'
    });

    const dispatchCall = dispatcher.dispatch.mock.calls[0];
    const [, payload] = dispatchCall;
    
    const validate = ajv.getSchema('core:system_error_occurred');
    const isValid = validate(payload);
    const errors = validate.errors;

    expect(isValid).toBe(true);
    expect(errors).toBeFalsy();
  });
});

describe('additional coverage', () => {
  it('defaults details to empty object in InvalidDispatcherError', () => {
    const err = new InvalidDispatcherError('boom');
    expect(err.details).toEqual({});
  });

  it('logs and throws when dispatcher is null', () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    expect(() =>
      safeDispatchError(null, 'no dispatcher', undefined, logger)
    ).toThrow(InvalidDispatcherError);
    expect(logger.error).toHaveBeenCalledWith(
      "Invalid or missing method 'dispatch' on dependency 'safeDispatchError: dispatcher'."
    );
  });

  it('handles null details in dispatchValidationError', () => {
    const dispatcher = { dispatch: jest.fn() };
    const result = dispatchValidationError(dispatcher, 'bad', null);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'bad',
      details: {},
    });
    expect(result).toEqual({ ok: false, error: 'bad', details: null });
  });
});
