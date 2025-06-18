import { describe, test, expect, jest } from '@jest/globals';
import { resolveLogger } from '../../../src/turns/util/loggerUtils.js';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeHandler = (logger = makeLogger()) => ({
  getLogger: jest.fn(() => logger),
});

describe('resolveLogger', () => {
  test('returns logger from turn context when available', () => {
    const ctxLogger = makeLogger();
    const ctx = { getLogger: jest.fn(() => ctxLogger) };
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const result = resolveLogger(ctx, makeHandler());
    expect(result).toBe(ctxLogger);
    expect(ctx.getLogger).toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('falls back to handler logger when context logger throws', () => {
    const handlerLogger = makeLogger();
    const handler = makeHandler(handlerLogger);
    const ctx = {
      getLogger: jest.fn(() => {
        throw new Error('ctx fail');
      }),
    };
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const result = resolveLogger(ctx, handler);
    expect(result).toBe(handlerLogger);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toMatch(
      /Error getting logger from turnCtx/
    );
    consoleSpy.mockRestore();
  });

  test('returns console when both loggers fail', () => {
    const handler = makeHandler();
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
    const result = resolveLogger(ctx, handler);
    expect(result).toBe(console);
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy.mock.calls[1][0]).toMatch(
      /Error getting logger from handler/
    );
    consoleSpy.mockRestore();
  });
});
