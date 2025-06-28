import { describe, test, expect, jest } from '@jest/globals';
import {
  writeContextVariable,
  tryWriteContextVariable,
  withUpdatedContext,
} from '../../../src/utils/contextVariableUtils.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { expectNoDispatch } from '../../common/engine/dispatchTestUtils.js';

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
    expectNoDispatch(dispatcher.dispatch);
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

  test('throws when logger and dispatcher missing', () => {
    const ctx = { evaluationContext: { context: {} } };
    expect(() =>
      writeContextVariable('x', 1, ctx, undefined, undefined)
    ).toThrow('writeContextVariable: logger is required.');
  });

  test('invalid names do not mutate context', () => {
    const ctx = { evaluationContext: { context: { foo: 1 } } };
    const dispatcher = { dispatch: jest.fn() };
    const logger = { error: jest.fn() };
    const result = writeContextVariable('', 2, ctx, dispatcher, logger);

    expect(result.success).toBe(false);
    expect(ctx.evaluationContext.context).toEqual({ foo: 1 });
  });
});

describe('tryWriteContextVariable', () => {
  test('throws when logger and dispatcher missing', () => {
    const ctx = { evaluationContext: { context: {} } };
    expect(() =>
      tryWriteContextVariable('x', 1, ctx, undefined, undefined)
    ).toThrow('writeContextVariable: logger is required.');
  });

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

  test('rejects blank or whitespace-only variable names', () => {
    const ctx = { evaluationContext: { context: {} } };
    const blank = tryWriteContextVariable('', 1, ctx);
    const spaces = tryWriteContextVariable('   ', 1, ctx);

    expect(blank.success).toBe(false);
    expect(blank.error).toBeInstanceOf(Error);
    expect(blank.error.message).toMatch(/^Invalid variableName/);

    expect(spaces.success).toBe(false);
    expect(spaces.error).toBeInstanceOf(Error);
    expect(spaces.error.message).toMatch(/^Invalid variableName/);
  });

  test('keeps variable name untrimmed on success', () => {
    const ctx = { evaluationContext: { context: {} } };
    const name = ' foo ';
    const result = tryWriteContextVariable(name, 42, ctx);

    expect(result).toEqual({ success: true });
    expect(ctx.evaluationContext.context).toHaveProperty(name, 42);
  });

  test('invalid names do not mutate context', () => {
    const ctx = { evaluationContext: { context: { bar: 2 } } };
    const result = tryWriteContextVariable('', 7, ctx);

    expect(result.success).toBe(false);
    expect(ctx.evaluationContext.context).toEqual({ bar: 2 });
  });
});

describe('withUpdatedContext', () => {
  test('returns new object with value set', () => {
    const original = { foo: 1 };
    const { success, context } = withUpdatedContext(original, 'bar', 2);
    expect(success).toBe(true);
    expect(context).toEqual({ foo: 1, bar: 2 });
    expect(original).toEqual({ foo: 1 });
  });

  test('handles errors gracefully', () => {
    const obj = null;
    const { success, error } = withUpdatedContext(obj, 'x', 1);
    expect(success).toBe(false);
    expect(error).toBeInstanceOf(Error);
  });
});
