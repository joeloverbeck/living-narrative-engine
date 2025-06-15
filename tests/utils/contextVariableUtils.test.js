import { describe, test, expect, jest } from '@jest/globals';
import storeResult, {
  setContextValue,
} from '../../src/utils/contextVariableUtils.js';
import { DISPLAY_ERROR_ID } from '../../src/constants/eventIds.js';

describe('storeResult', () => {
  test('stores value when context exists', () => {
    const ctx = { evaluationContext: { context: {} } };
    const dispatcher = { dispatch: jest.fn() };
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const success = storeResult('foo', 123, ctx, dispatcher, logger);
    expect(success).toBe(true);
    expect(ctx.evaluationContext.context.foo).toBe(123);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  test('dispatches error and returns false when context missing', () => {
    const ctx = { evaluationContext: null };
    const dispatcher = { dispatch: jest.fn() };
    const logger = { error: jest.fn() };
    const success = storeResult('bar', 5, ctx, dispatcher, logger);
    expect(success).toBe(false);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
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
    const success = storeResult('baz', 7, ctx, undefined, logger);
    await Promise.resolve();
    expect(success).toBe(false);
    expect(validated.dispatch).toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
      expect.objectContaining({ message: expect.any(String) }),
      expect.any(Object)
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('setContextValue', () => {
  test('trims variable name and stores value', () => {
    const ctx = { evaluationContext: { context: {} } };
    const dispatcher = { dispatch: jest.fn() };
    const logger = { warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    const success = setContextValue('  myVar  ', 42, ctx, dispatcher, logger);
    expect(success).toBe(true);
    expect(ctx.evaluationContext.context.myVar).toBe(42);
  });

  test('returns false and dispatches error for invalid name', () => {
    const ctx = { evaluationContext: { context: {} } };
    const dispatcher = { dispatch: jest.fn() };
    const logger = { warn: jest.fn() };
    const success = setContextValue('   ', 1, ctx, dispatcher, logger);
    expect(success).toBe(false);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
      expect.objectContaining({ message: expect.any(String) })
    );
    expect(Object.keys(ctx.evaluationContext.context)).toHaveLength(0);
  });
});
