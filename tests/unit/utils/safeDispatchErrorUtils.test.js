import { describe, it, expect, jest } from '@jest/globals';
import {
  safeDispatchError,
  dispatchValidationError,
  InvalidDispatcherError,
} from '../../../src/utils/safeDispatchErrorUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

describe('safeDispatchError', () => {
  it('dispatches the display error event', () => {
    const dispatcher = { dispatch: jest.fn() };
    safeDispatchError(dispatcher, 'boom', { a: 1 });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'boom',
      details: { a: 1 },
    });
  });

  it('defaults to empty details object when none provided', () => {
    const dispatcher = { dispatch: jest.fn() };

    safeDispatchError(dispatcher, 'no details');

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'no details',
      details: {},
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

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'Action failed due to invalid state',
      details: {
        errorContext: actionErrorContext,
        actionId: 'test-action',
        phase: 'validation',
        targetId: 'target-123',
      },
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

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'An error occurred in the action system',
      details: {
        errorContext: actionErrorContext,
        actionId: 'test-action',
        phase: 'execution',
        targetId: null,
      },
    });
  });
});

describe('dispatchValidationError', () => {
  it('dispatches the error and returns result with details', () => {
    const dispatcher = { dispatch: jest.fn() };
    const result = dispatchValidationError(dispatcher, 'bad', { foo: 1 });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'bad',
      details: { foo: 1 },
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
      details: null,
    });
    expect(result).toEqual({ ok: false, error: 'bad', details: null });
  });
});
