import { describe, it, expect } from '@jest/globals';
import { safeResolvePath } from '../../../src/utils/objectUtils.js';
import { createMockLogger } from '../testUtils.js';

describe('safeResolvePath', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispatches error when dispatcher provided', () => {
    const logger = createMockLogger();
    const dispatcher = { dispatch: jest.fn() };
    const result = safeResolvePath({}, null, logger, 'unit-test', dispatcher);
    expect(result.value).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ message: expect.stringContaining('unit-test') })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs error when dispatcher not provided', () => {
    const logger = createMockLogger();
    const result = safeResolvePath({}, null, logger, 'unit-test');
    expect(result.value).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('unit-test'),
      expect.any(Error)
    );
  });

  it('returns value when resolution succeeds', () => {
    const logger = createMockLogger();
    const obj = { a: { b: 1 } };
    const result = safeResolvePath(obj, 'a.b', logger);
    expect(result).toEqual({ value: 1, error: undefined });
  });

  it('falls back to raw error objects and omits context suffix when none is provided', () => {
    const logger = createMockLogger();
    const dispatcher = { dispatch: jest.fn() };
    const thrownError = new Error('');
    thrownError.stack = 'stack-trace';

    const obj = {};
    Object.defineProperty(obj, 'foo', {
      enumerable: true,
      get() {
        throw thrownError;
      },
    });

    const result = safeResolvePath(
      obj,
      'foo.bar',
      logger,
      undefined,
      dispatcher
    );

    expect(result).toEqual({ value: undefined, error: thrownError });
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);

    const [, payload] = dispatcher.dispatch.mock.calls[0];
    expect(payload.message).toBe('Error resolving path "foo.bar"');
    expect(payload.details.raw).toBe(thrownError);
    expect(payload.details.stack).toBe('stack-trace');
    expect(logger.error).not.toHaveBeenCalled();
  });
});
