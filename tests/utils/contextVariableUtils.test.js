import { describe, test, expect, jest } from '@jest/globals';
import storeResult from '../../src/utils/contextVariableUtils.js';
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

  test('logs error when dispatcher not provided', () => {
    const ctx = {};
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const success = storeResult('baz', 7, ctx, undefined, logger);
    expect(success).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });
});
