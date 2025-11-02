import { describe, it, expect, jest } from '@jest/globals';
import {
  safeDispatchError,
  dispatchValidationError,
  InvalidDispatcherError,
} from '../../../src/utils/safeDispatchErrorUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

describe('safeDispatchError', () => {
  it('dispatches the display error event', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    const result = await safeDispatchError(dispatcher, 'boom', { a: 1 });
    expect(result).toBe(true);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'boom',
      details: { a: 1 },
    });
  });

  it('defaults to empty details object when none provided', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };

    await safeDispatchError(dispatcher, 'no details');

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'no details',
      details: {},
    });
  });

  it('normalizes primitive details into a schema-compliant structure', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };

    await safeDispatchError(dispatcher, 'primitive payload', ' failure ');

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'primitive payload',
      details: { raw: 'failure' },
    });
  });

  it('wraps array details to avoid schema violations', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    const diagnostics = ['a', 'b'];

    await safeDispatchError(dispatcher, 'array payload', diagnostics);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'array payload',
      details: { items: diagnostics },
    });
  });

  it('drops array wrappers when diagnostics list is empty', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };

    await safeDispatchError(dispatcher, 'empty array payload', []);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'empty array payload',
      details: {},
    });
  });

  it('returns false and logs a warning when dispatch reports failure', async () => {
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const dispatcher = { dispatch: jest.fn().mockResolvedValue('nope') };

    const result = await safeDispatchError(dispatcher, 'warn-level failure', {}, logger);

    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'safeDispatchError: Dispatcher reported failure for core:system_error_occurred.',
      { dispatchResult: 'nope' }
    );
  });

  it('returns false and logs an error when dispatch throws', async () => {
    const dispatchedError = new Error('dispatch boom');
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const dispatcher = {
      dispatch: jest.fn().mockRejectedValue(dispatchedError),
    };

    const result = await safeDispatchError(dispatcher, 'exception failure', {}, logger);

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'safeDispatchError: Failed to dispatch core:system_error_occurred.',
      dispatchedError
    );
  });

  it('throws if dispatcher is invalid', async () => {
    await expect(safeDispatchError({}, 'oops')).rejects.toMatchObject({
      name: 'InvalidDispatcherError',
      message:
        "Invalid or missing method 'dispatch' on dependency 'safeDispatchError: dispatcher'.",
      details: { functionName: 'safeDispatchError' },
    });
  });

  it('handles ActionErrorContext object', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
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

    await safeDispatchError(dispatcher, actionErrorContext);

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

  it('handles ActionErrorContext with missing error message', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
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

    await safeDispatchError(dispatcher, actionErrorContext);

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

  it('treats plain objects without error metadata as generic messages', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    const payload = { actionId: 'maybe-context', reason: 'missing error object' };
    const diagnostics = { correlationId: 'diag-7' };

    await safeDispatchError(dispatcher, payload, diagnostics);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: payload,
      details: diagnostics,
    });
  });

  it('falls back to generic messaging when actionId is absent on context-like input', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    const payload = { error: { message: 'still not a full context' } };

    await safeDispatchError(dispatcher, payload, undefined);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: payload,
      details: {},
    });
  });
});

describe('dispatchValidationError', () => {
  it('dispatches the error and returns result with details', () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    const result = dispatchValidationError(dispatcher, 'bad', { foo: 1 });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'bad',
      details: { foo: 1 },
    });
    expect(result).toEqual({ ok: false, error: 'bad', details: { foo: 1 } });
  });

  it('omits details when none provided', () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
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

  it('logs and throws when dispatcher is null', async () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    await expect(
      safeDispatchError(null, 'no dispatcher', undefined, logger)
    ).rejects.toBeInstanceOf(InvalidDispatcherError);
    expect(logger.error).toHaveBeenCalledWith(
      "Invalid or missing method 'dispatch' on dependency 'safeDispatchError: dispatcher'."
    );
  });

  it('handles null details in dispatchValidationError', () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    const result = dispatchValidationError(dispatcher, 'bad', null);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'bad',
      details: {},
    });
    expect(result).toEqual({ ok: false, error: 'bad', details: {} });
  });

  it('preserves provided diagnostic metadata in InvalidDispatcherError', () => {
    const metadata = { correlationId: 'critical', severity: 'fatal' };
    const err = new InvalidDispatcherError('invalid dispatcher', metadata);

    expect(err.details).toBe(metadata);
    expect(err.name).toBe('InvalidDispatcherError');
  });

  it('converts symbol details into a descriptive payload', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    const symbolDetail = Symbol('symbolic-context');

    await safeDispatchError(dispatcher, 'symbol failure', symbolDetail);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'symbol failure',
      details: { raw: 'symbolic-context' },
    });
  });

  it('falls back to symbol stringification when description is absent', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    const symbolDetail = Symbol();

    await safeDispatchError(dispatcher, 'symbol fallback', symbolDetail);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'symbol fallback',
      details: { raw: symbolDetail.toString() },
    });
  });

  it('uses the function name when normalizing callable diagnostics', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    function diagnosticProbe() {}

    await safeDispatchError(dispatcher, 'function detail', diagnosticProbe);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'function detail',
      details: { raw: 'diagnosticProbe' },
    });
  });

  it('falls back to function stringification when the name is missing', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    const anonymousFn = function () {};
    Object.defineProperty(anonymousFn, 'name', { value: '', configurable: true });

    await safeDispatchError(dispatcher, 'anonymous function detail', anonymousFn);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'anonymous function detail',
      details: { raw: anonymousFn.toString() },
    });
  });

  it('stringifies numeric diagnostics consistently', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };

    await safeDispatchError(dispatcher, 'numeric detail', 404);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'numeric detail',
      details: { raw: '404' },
    });
  });

  it('discards whitespace-only string diagnostics', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };

    await safeDispatchError(dispatcher, 'whitespace detail', '   ');

    expect(dispatcher.dispatch).toHaveBeenCalledWith(SYSTEM_ERROR_OCCURRED_ID, {
      message: 'whitespace detail',
      details: {},
    });
  });
});
