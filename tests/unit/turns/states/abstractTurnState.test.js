import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { AbstractTurnState } from '../../../../src/turns/states/abstractTurnState.js';

class TestState extends AbstractTurnState {}

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeHandler = (logger = makeLogger(), dispatcher) => ({
  getLogger: jest.fn(() => logger),
  safeEventDispatcher: dispatcher,
  getSafeEventDispatcher: jest.fn(function () {
    return this.safeEventDispatcher;
  }),
});

describe('AbstractTurnState._resolveLogger', () => {
  let logger;
  let handler;
  let state;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = makeLogger();
    handler = makeHandler(logger);
    state = new TestState(handler);
  });

  test('returns logger from turn context when available', () => {
    const ctxLogger = makeLogger();
    const ctx = { getLogger: jest.fn(() => ctxLogger) };
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const result = state._resolveLogger(ctx, handler);
    expect(result).toBe(ctxLogger);
    expect(ctx.getLogger).toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('falls back to handler logger when context logger throws', () => {
    const ctx = {
      getLogger: jest.fn(() => {
        throw new Error('ctx fail');
      }),
    };
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const result = state._resolveLogger(ctx, handler);
    expect(result).toBe(logger);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toMatch(
      /Error getting logger from turnCtx/
    );
    consoleSpy.mockRestore();
  });

  test('returns console when both loggers fail', () => {
    const ctx = {
      getLogger: jest.fn(() => {
        throw new Error('ctx fail');
      }),
    };
    handler.getLogger = jest.fn(() => {
      throw new Error('handler fail');
    });
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const result = state._resolveLogger(ctx, handler);
    expect(result).toBe(console);
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy.mock.calls[1][0]).toMatch(
      /Error getting logger from handler/
    );
    consoleSpy.mockRestore();
  });
});

describe('AbstractTurnState._getSafeEventDispatcher', () => {
  let logger;
  let handler;
  let state;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = makeLogger();
    handler = makeHandler(logger);
    state = new TestState(handler);
  });

  test('returns dispatcher from context when available', () => {
    const dispatcher = { dispatch: jest.fn() };
    const ctx = {
      getLogger: jest.fn(() => logger),
      getSafeEventDispatcher: jest.fn(() => dispatcher),
    };
    const result = state._getSafeEventDispatcher(ctx, handler);
    expect(result).toBe(dispatcher);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(handler.getSafeEventDispatcher).not.toHaveBeenCalled();
  });

  test('warns once and falls back to handler dispatcher when context missing', () => {
    const dispatcher = { dispatch: jest.fn() };
    handler.safeEventDispatcher = dispatcher;
    const ctx = {
      getLogger: jest.fn(() => logger),
      getSafeEventDispatcher: jest.fn(() => null),
    };
    const result = state._getSafeEventDispatcher(ctx, handler);
    expect(result).toBe(dispatcher);
    expect(handler.getSafeEventDispatcher).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toMatch(/Falling back/);
  });

  test('logs error and falls back when context dispatcher throws', () => {
    const dispatcher = { dispatch: jest.fn() };
    handler.safeEventDispatcher = dispatcher;
    const ctx = {
      getLogger: jest.fn(() => logger),
      getSafeEventDispatcher: jest.fn(() => {
        throw new Error('boom');
      }),
    };
    const result = state._getSafeEventDispatcher(ctx, handler);
    expect(result).toBe(dispatcher);
    expect(handler.getSafeEventDispatcher).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  test('warns once and returns null when no dispatcher available', () => {
    const ctx = {
      getLogger: jest.fn(() => logger),
      getSafeEventDispatcher: jest.fn(() => null),
    };
    const result = state._getSafeEventDispatcher(ctx, handler);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toMatch(/unavailable/);
  });
});
