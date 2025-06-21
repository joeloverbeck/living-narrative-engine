import { describe, test, expect, jest } from '@jest/globals';
import { resolveSafeDispatcher } from '../../../src/utils/dispatcherUtils.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';

describe('resolveSafeDispatcher', () => {
  test('returns provided dispatcher', () => {
    const dispatcher = { dispatch: jest.fn() };
    expect(resolveSafeDispatcher({}, dispatcher)).toBe(dispatcher);
  });

  test('creates SafeEventDispatcher from execCtx', () => {
    const validated = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
    const execCtx = { validatedEventDispatcher: validated };
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const result = resolveSafeDispatcher(execCtx, undefined, logger);
    expect(result).toBeInstanceOf(SafeEventDispatcher);
  });

  test('returns null when creation fails', () => {
    const execCtx = { validatedEventDispatcher: {} }; // missing required methods
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    const result = resolveSafeDispatcher(execCtx, undefined, logger);
    expect(result).toBeNull();
  });
});
