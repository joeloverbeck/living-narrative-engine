import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import createSafeErrorLogger from '../../../src/utils/safeErrorLogger.js';

describe('SafeErrorLogger additional coverage', () => {
  let logger;
  let dispatcher;
  /** @type {ReturnType<typeof createSafeErrorLogger>} */
  let safeErrorLogger;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    dispatcher = {
      setBatchMode: jest.fn(),
    };

    safeErrorLogger = createSafeErrorLogger({
      logger,
      safeEventDispatcher: dispatcher,
    });
  });

  afterEach(() => {
    if (safeErrorLogger) {
      safeErrorLogger.disableGameLoadingMode({
        force: true,
        reason: 'test-cleanup',
      });
    }
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('throws when neither safeEventDispatcher nor eventBus is provided', () => {
    const minimalLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    expect(() => createSafeErrorLogger({ logger: minimalLogger })).toThrow(
      'SafeErrorLogger requires either safeEventDispatcher or eventBus parameter'
    );
  });

  it('normalizes unexpected timeout and context values back to defaults', () => {
    jest.useFakeTimers();

    safeErrorLogger.enableGameLoadingMode({ context: '   ', timeoutMs: null });
    expect(dispatcher.setBatchMode).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ context: 'game-load', timeoutMs: 60000 })
    );
    safeErrorLogger.disableGameLoadingMode({ force: true, reason: 'case-1' });

    dispatcher.setBatchMode.mockClear();

    safeErrorLogger.enableGameLoadingMode({ context: 123, timeoutMs: '   ' });
    expect(dispatcher.setBatchMode).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ context: 'game-load', timeoutMs: 60000 })
    );
    safeErrorLogger.disableGameLoadingMode({ force: true, reason: 'case-2' });

    dispatcher.setBatchMode.mockClear();

    safeErrorLogger.enableGameLoadingMode({
      context: { nested: true },
      timeoutMs: {},
    });
    expect(dispatcher.setBatchMode).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ context: 'game-load', timeoutMs: 60000 })
    );
    safeErrorLogger.disableGameLoadingMode({ force: true, reason: 'case-3' });

    dispatcher.setBatchMode.mockClear();

    safeErrorLogger.enableGameLoadingMode({
      context: ' high-volume ',
      timeoutMs: ' 250 ',
    });
    expect(dispatcher.setBatchMode).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ context: 'high-volume', timeoutMs: 250 })
    );
    safeErrorLogger.disableGameLoadingMode({ force: true, reason: 'case-4' });

    dispatcher.setBatchMode.mockClear();

    safeErrorLogger.enableGameLoadingMode({
      context: 'invalid-string-timeout',
      timeoutMs: 'not-a-number',
    });
    expect(dispatcher.setBatchMode).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({
        context: 'invalid-string-timeout',
        timeoutMs: 60000,
      })
    );
    safeErrorLogger.disableGameLoadingMode({ force: true, reason: 'case-5' });

    dispatcher.setBatchMode.mockClear();

    safeErrorLogger.enableGameLoadingMode({
      context: 'non-finite-number',
      timeoutMs: Number.POSITIVE_INFINITY,
    });
    expect(dispatcher.setBatchMode).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ context: 'non-finite-number', timeoutMs: 60000 })
    );
    safeErrorLogger.disableGameLoadingMode({ force: true, reason: 'case-6' });
  });

  it('treats non-object loading options as empty configuration', () => {
    safeErrorLogger.enableGameLoadingMode(true);

    expect(dispatcher.setBatchMode).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ context: 'game-load', timeoutMs: 60000 })
    );
  });

  it('ignores blank string contexts when using shorthand syntax', () => {
    safeErrorLogger.enableGameLoadingMode('      ');

    expect(dispatcher.setBatchMode).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ context: 'game-load', timeoutMs: 60000 })
    );
  });

  it('does nothing when disabling game loading mode if it is already inactive', () => {
    safeErrorLogger.disableGameLoadingMode();

    expect(dispatcher.setBatchMode).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('auto-disables game loading mode when timeout elapses', () => {
    jest.useFakeTimers();

    safeErrorLogger.enableGameLoadingMode({
      context: 'auto-timeout',
      timeoutMs: 10,
    });

    jest.advanceTimersByTime(10);

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'SafeErrorLogger: Auto-disabling game loading mode after 10ms timeout'
      )
    );

    const lastCall = dispatcher.setBatchMode.mock.calls.at(-1);
    expect(lastCall[0]).toBe(false);
  });

  it('reports zero duration when the outermost start time is falsy', () => {
    const originalNow = Date.now;
    const mockedNow = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValue(123);

    try {
      safeErrorLogger.enableGameLoadingMode({
        context: 'falsy-start',
        timeoutMs: 0,
      });
      safeErrorLogger.disableGameLoadingMode({
        force: true,
        reason: 'falsy-start',
      });
    } finally {
      mockedNow.mockRestore();
      Date.now = originalNow;
    }

    const disableLog = logger.debug.mock.calls.find(([message]) =>
      message.includes('Game loading mode disabled')
    );
    expect(disableLog[0]).toContain('after 0ms');
  });

  it('preserves outer state when nested enable fails', () => {
    const enableFailure = new Error('nested enable failure');
    let enableCalls = 0;
    dispatcher.setBatchMode.mockImplementation((enable) => {
      if (enable) {
        enableCalls += 1;
        if (enableCalls === 2) {
          throw enableFailure;
        }
      }
    });

    safeErrorLogger.enableGameLoadingMode({ context: 'outer', timeoutMs: 0 });

    expect(() => {
      safeErrorLogger.enableGameLoadingMode({ context: 'inner', timeoutMs: 0 });
    }).toThrow(enableFailure);

    expect(safeErrorLogger.isGameLoadingActive()).toBe(true);
    expect(dispatcher.setBatchMode).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ context: 'outer' })
    );

    safeErrorLogger.disableGameLoadingMode({ force: true, reason: 'nested-failure' });
  });

  it('falls back to console.warn when the logger warn method throws', () => {
    const warnError = new Error('warn failure');
    logger.warn.mockImplementation(() => {
      throw warnError;
    });
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    safeErrorLogger.safeWarn('warn-message', { context: 'test' });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'SafeErrorLogger: Logger failed. Original warning: warn-message',
      { context: 'test' },
      'Logger error:',
      warnError
    );

    consoleWarnSpy.mockRestore();
  });

  it('falls back to console.error when the logger error method throws', () => {
    const loggerFailure = new Error('logger failure');
    logger.error.mockImplementation(() => {
      throw loggerFailure;
    });
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const originalError = new Error('boom');
    safeErrorLogger.safeError('critical failure', originalError, {
      context: 'error-test',
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'SafeErrorLogger: Logger failed. Original error: critical failure',
      originalError,
      'Logger error:',
      loggerFailure
    );

    consoleErrorSpy.mockRestore();
  });

  it('defaults the error context to an empty object when omitted', () => {
    const originalError = new Error('without-context');

    safeErrorLogger.safeError('message-only', originalError);

    expect(logger.error).toHaveBeenCalledWith(
      'message-only',
      originalError,
      {}
    );
  });

  it('uses default loading options when none are provided', async () => {
    await safeErrorLogger.withGameLoadingMode(async () => {});

    const [enableCall] = dispatcher.setBatchMode.mock.calls;
    expect(enableCall[0]).toBe(true);
    expect(enableCall[1]).toEqual(
      expect.objectContaining({ context: 'game-load', timeoutMs: 60000 })
    );
  });

  it('normalizes non-error failures encountered during forced cleanup', async () => {
    const forcedFailure = 'forced failure';
    dispatcher.setBatchMode.mockImplementation((enable) => {
      if (enable === false) {
        throw forcedFailure;
      }
    });

    await safeErrorLogger.withGameLoadingMode(
      async () => {
        safeErrorLogger.enableGameLoadingMode({
          context: 'inner-operation',
          timeoutMs: 0,
        });
        // Intentionally leak the nested context
      },
      { context: 'outer-operation', timeoutMs: 0 }
    );

    const errorCalls = logger.error.mock.calls.filter(([message]) =>
      message.includes('Forced disable of game loading mode failed during cleanup')
    );

    expect(errorCalls).toHaveLength(1);
    const [, normalizedError] = errorCalls[0];
    expect(normalizedError).toBeInstanceOf(Error);
    expect(normalizedError.message).toBe(String(forcedFailure));
  });

  it('wraps non-error disable failures during cleanup', async () => {
    dispatcher.setBatchMode.mockImplementation((enable) => {
      if (!enable) {
        throw 'cleanup failure';
      }
    });

    await expect(
      safeErrorLogger.withGameLoadingMode(async () => {}, {
        context: 'cleanup-test',
        timeoutMs: 0,
      })
    ).rejects.toThrow('cleanup failure');

    const errorCalls = logger.error.mock.calls.filter(([message]) =>
      message.includes('Failed to disable game loading mode during cleanup')
    );
    expect(errorCalls).toHaveLength(1);
    expect(errorCalls[0][1]).toBeInstanceOf(Error);
    expect(errorCalls[0][1].message).toBe('cleanup failure');
  });

  it('logs forced disable failures that throw actual Error instances', async () => {
    const forcedFailure = new Error('forced error');
    let enableCalls = 0;
    dispatcher.setBatchMode.mockImplementation((enable) => {
      if (enable) {
        enableCalls += 1;
        return;
      }

      if (enableCalls > 1) {
        throw forcedFailure;
      }
    });

    await safeErrorLogger.withGameLoadingMode(
      async () => {
        safeErrorLogger.enableGameLoadingMode({
          context: 'inner-operation',
          timeoutMs: 0,
        });
        // leak nested context
      },
      { context: 'outer-operation', timeoutMs: 0 }
    );

    const errorCalls = logger.error.mock.calls.filter(([message]) =>
      message.includes('Forced disable of game loading mode failed during cleanup')
    );
    expect(errorCalls).toHaveLength(1);
    expect(errorCalls[0][1]).toBe(forcedFailure);
  });

  it('guards against missing previous context when restoring nested state', () => {
    const originalPush = Array.prototype.push;
    const originalPop = Array.prototype.pop;
    /** @type {any[] | null} */
    let capturedStack = null;

    Array.prototype.push = function pushOverride(...items) {
      if (
        !capturedStack &&
        items[0] &&
        typeof items[0] === 'object' &&
        Object.prototype.hasOwnProperty.call(items[0], 'options') &&
        Object.prototype.hasOwnProperty.call(items[0], 'config')
      ) {
        capturedStack = this;
      }
      return originalPush.apply(this, items);
    };

    Array.prototype.pop = function popOverride(...args) {
      const result = originalPop.apply(this, args);
      if (this === capturedStack) {
        this.length = 0;
      }
      return result;
    };

    let callCountBeforeCleanup = 0;

    try {
      safeErrorLogger.enableGameLoadingMode({ context: 'outer', timeoutMs: 0 });
      safeErrorLogger.enableGameLoadingMode({ context: 'inner', timeoutMs: 0 });

      safeErrorLogger.disableGameLoadingMode();

      callCountBeforeCleanup = dispatcher.setBatchMode.mock.calls.length;
      expect(callCountBeforeCleanup).toBe(2);
    } finally {
      Array.prototype.push = originalPush;
      Array.prototype.pop = originalPop;
      safeErrorLogger.disableGameLoadingMode({ force: true, reason: 'cleanup' });
    }

    expect(dispatcher.setBatchMode.mock.calls.length).toBe(callCountBeforeCleanup + 1);
    const cleanupCall = dispatcher.setBatchMode.mock.calls.at(-1);
    expect(cleanupCall[0]).toBe(false);
  });
});
