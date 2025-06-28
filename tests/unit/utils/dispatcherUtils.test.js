import { describe, test, expect, jest } from '@jest/globals';
import { resolveSafeDispatcher } from '../../../src/utils/dispatcherUtils.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';

describe('resolveSafeDispatcher', () => {
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
    const result = resolveSafeDispatcher(execCtx, logger);
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
    const result = resolveSafeDispatcher(execCtx, logger);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('uses injected dispatcher factory', () => {
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
    const spy = jest.fn();
    const factory = ({ validatedEventDispatcher, logger }) => {
      spy(validatedEventDispatcher, logger);
      return {
        validatedEventDispatcher,
        logger,
      };
    };

    const result = resolveSafeDispatcher(execCtx, logger, factory);

    expect(result).toEqual({ validatedEventDispatcher: validated, logger });
    expect(spy).toHaveBeenCalledWith(validated, logger);
  });
});
