import { describe, test, expect, jest } from '@jest/globals';
import writeContextVariable, {
  tryWriteContextVariable,
} from '../../../src/utils/contextVariableUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

describe('writeContextVariable', () => {
  test('stores value when context exists', () => {
    const ctx = { evaluationContext: { context: {} } };
    const dispatcher = { dispatch: jest.fn() };
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const result = writeContextVariable('foo', 123, ctx, dispatcher, logger);
    expect(result).toEqual({ success: true });
    expect(ctx.evaluationContext.context.foo).toBe(123);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  test('dispatches error and returns failure when context missing', () => {
    const ctx = { evaluationContext: null };
    const dispatcher = { dispatch: jest.fn() };
    const logger = { error: jest.fn() };
    const result = writeContextVariable('bar', 5, ctx, dispatcher, logger);
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('dispatches using context dispatcher when dispatcher not provided', async () => {
    const validated = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
    const ctx = {
      evaluationContext: null,
      validatedEventDispatcher: validated,
    };
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const result = writeContextVariable('baz', 7, ctx, undefined, logger);
    await Promise.resolve();
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(validated.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.any(String) }),
      expect.any(Object)
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('tryWriteContextVariable', () => {
  test('returns error object when evaluation context missing', () => {
    const ctx = { evaluationContext: null };
    const dispatcher = { dispatch: jest.fn() };
    const logger = { error: jest.fn() };
    const result = tryWriteContextVariable('foo', 1, ctx, dispatcher, logger);
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.any(String) })
    );
  });
});
