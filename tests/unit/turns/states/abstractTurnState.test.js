import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { AbstractTurnState } from '../../../../src/turns/states/abstractTurnState.js';
import {
  getLogger,
  getSafeEventDispatcher,
} from '../../../../src/turns/states/helpers/contextUtils.js';
import * as contextUtils from '../../../../src/turns/states/helpers/contextUtils.js';

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

const makeInvalidHandler = (logger = makeLogger()) => ({
  getLogger: jest.fn(() => logger),
  resetStateAndResources: jest.fn(),
  requestIdleStateTransition: jest.fn().mockResolvedValue(undefined),
});

describe('AbstractTurnState constructor validation', () => {
  test('throws when handler is missing and logs via console', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    class ConstructorTestState extends AbstractTurnState {}

    expect(() => new ConstructorTestState()).toThrow(
      'ConstructorTestState Constructor: BaseTurnHandler (handler) must be provided.'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      'ConstructorTestState Constructor: BaseTurnHandler (handler) must be provided.'
    );

    consoleSpy.mockRestore();
  });
});

describe('getLogger helper', () => {
  let logger;
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = makeLogger();
    handler = makeHandler(logger);
  });

  test('returns logger from turn context when available', () => {
    const ctxLogger = makeLogger();
    const ctx = { getLogger: jest.fn(() => ctxLogger) };
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const result = getLogger(ctx, handler);
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
    const result = getLogger(ctx, handler);
    expect(result).toBe(logger);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toMatch(
      /Error getting logger from turnContext/
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
    const result = getLogger(ctx, handler);
    expect(result).toBe(console);
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy.mock.calls[1][0]).toMatch(
      /Error getting logger from handler/
    );
    consoleSpy.mockRestore();
  });
});

describe('getSafeEventDispatcher helper', () => {
  let logger;
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = makeLogger();
    handler = makeHandler(logger);
  });

  test('returns dispatcher from context when available', () => {
    const dispatcher = { dispatch: jest.fn() };
    const ctx = {
      getLogger: jest.fn(() => logger),
      getSafeEventDispatcher: jest.fn(() => dispatcher),
    };
    const result = getSafeEventDispatcher(ctx, handler);
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
    const result = getSafeEventDispatcher(ctx, handler);
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
    const result = getSafeEventDispatcher(ctx, handler);
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
    const result = getSafeEventDispatcher(ctx, handler);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toMatch(/unavailable/);
  });
});

describe('AbstractTurnState._getTurnContext & _ensureContext', () => {
  let logger;
  let invalidHandler;
  let state;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = makeLogger();
    invalidHandler = makeInvalidHandler(logger);
    state = new TestState(invalidHandler);
  });

  test('_getTurnContext throws when handler lacks method', () => {
    expect(() => state._getTurnContext()).toThrow(
      'TestState: _handler is invalid or missing getTurnContext method.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'TestState: _handler is invalid or missing getTurnContext method.'
    );
  });

  test('_ensureContext logs error and resets to idle on missing method', async () => {
    const ctx = await state._ensureContext('no-handler');
    expect(ctx).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'TestState: _handler is invalid or missing getTurnContext method.'
    );
    expect(invalidHandler.resetStateAndResources).toHaveBeenCalledTimes(1);
    expect(invalidHandler.requestIdleStateTransition).toHaveBeenCalledTimes(1);
  });
});

describe('AbstractTurnState logging fallbacks and default implementations', () => {
  test('_logStateTransition falls back to console logging when logger unavailable', () => {
    const handlerLogger = makeLogger();
    const handler = {
      getLogger: jest.fn(() => handlerLogger),
      getTurnContext: jest.fn(() => null),
    };
    const state = new TestState(handler);

    const getLoggerSpy = jest
      .spyOn(contextUtils, 'getLogger')
      .mockReturnValueOnce(null);
    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    state._logStateTransition('enter', 'actor-123', 'PrevState');

    expect(handler.getTurnContext).toHaveBeenCalledTimes(1);
    expect(getLoggerSpy).toHaveBeenCalledWith(null, handler);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '(Fallback log) TestState: Entered. Actor: actor-123. Previous state: PrevState.'
    );

    getLoggerSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test("startTurn warns and throws when invoked on abstract state", async () => {
    const handlerLogger = makeLogger();
    const handler = {
      getLogger: jest.fn(() => handlerLogger),
      getTurnContext: jest.fn(() => ({
        getActor: jest.fn(() => ({ id: 'context-actor' })),
      })),
    };
    const state = new TestState(handler);

    await expect(state.startTurn(handler)).rejects.toThrow(
      "Method 'startTurn()' is not applicable for state TestState."
    );

    expect(handlerLogger.warn).toHaveBeenCalledWith(
      "Method 'startTurn(actorId: UNKNOWN_ACTOR)' called on state TestState where it is not expected or handled."
    );
  });
});
