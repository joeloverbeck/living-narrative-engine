import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { getSafeEventDispatcher } from '../../../src/turns/util/eventDispatcherUtils.js';
import { resolveLogger } from '../../../src/turns/util/loggerUtils.js';

jest.mock('../../../src/turns/util/loggerUtils.js', () => ({
  resolveLogger: jest.fn(),
}));

const makeDispatcher = () => ({
  dispatch: jest.fn(),
});

const makeHandler = (dispatcher) => ({
  safeEventDispatcher: dispatcher,
  getLogger: jest.fn(() => ({ warn: jest.fn(), error: jest.fn() })),
});

describe('getSafeEventDispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns dispatcher from context when available', () => {
    const dispatcher = makeDispatcher();
    const ctx = { getSafeEventDispatcher: jest.fn(() => dispatcher) };
    const result = getSafeEventDispatcher(ctx, makeHandler());
    expect(result).toBe(dispatcher);
  });

  test('falls back to handler dispatcher when context missing', () => {
    const dispatcher = makeDispatcher();
    const handler = makeHandler(dispatcher);
    const ctx = { getSafeEventDispatcher: jest.fn(() => null) };
    const logger = { warn: jest.fn(), error: jest.fn() };
    resolveLogger.mockReturnValueOnce(logger);
    const result = getSafeEventDispatcher(ctx, handler);
    expect(result).toBe(dispatcher);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  test('logs error and falls back when context dispatcher throws', () => {
    const dispatcher = makeDispatcher();
    const handler = makeHandler(dispatcher);
    const ctx = {
      getSafeEventDispatcher: jest.fn(() => {
        throw new Error('boom');
      }),
    };
    const logger = { warn: jest.fn(), error: jest.fn() };
    resolveLogger.mockReturnValueOnce(logger);
    const result = getSafeEventDispatcher(ctx, handler);
    expect(result).toBe(dispatcher);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test('returns null when no dispatcher available', () => {
    const ctx = { getSafeEventDispatcher: jest.fn(() => null) };
    const logger = { warn: jest.fn(), error: jest.fn() };
    resolveLogger.mockReturnValueOnce(logger);
    const result = getSafeEventDispatcher(ctx, makeHandler());
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
