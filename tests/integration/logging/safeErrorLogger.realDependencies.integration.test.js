import { describe, it, expect, jest } from '@jest/globals';
import createSafeErrorLogger from '../../../src/utils/safeErrorLogger.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

class RecordingLogger {
  constructor() {
    this.calls = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  debug(...args) {
    this.calls.debug.push(args);
  }

  info(...args) {
    this.calls.info.push(args);
  }

  warn(...args) {
    this.calls.warn.push(args);
  }

  error(...args) {
    this.calls.error.push(args);
  }
}

class PassthroughSchemaValidator {
  isSchemaLoaded() {
    return true;
  }

  validate() {
    return { isValid: true, errors: [] };
  }
}

const createEnvironment = ({ EventBusClass = EventBus } = {}) => {
  const logger = new RecordingLogger();
  const registry = new InMemoryDataRegistry({ logger });
  const gameDataRepository = new GameDataRepository(registry, logger);
  const schemaValidator = new PassthroughSchemaValidator();
  const eventBus = new EventBusClass({ logger });
  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository,
    schemaValidator,
    logger,
  });
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });

  return {
    logger,
    registry,
    gameDataRepository,
    schemaValidator,
    eventBus,
    validatedEventDispatcher,
    safeEventDispatcher,
  };
};

describe('SafeErrorLogger integration with real dispatcher stack', () => {
  it('manages nested game loading contexts and auto-disables batch mode with normalized options', () => {
    jest.useFakeTimers();

    const env = createEnvironment();
    const safeErrorLogger = createSafeErrorLogger({
      logger: env.logger,
      safeEventDispatcher: env.safeEventDispatcher,
    });

    try {
      safeErrorLogger.enableGameLoadingMode({
        context: '   ',
        timeoutMs: '   ',
      });

      expect(env.eventBus.isBatchModeEnabled()).toBe(true);
      expect(env.eventBus.getBatchModeOptions()).toMatchObject({
        context: 'game-load',
        maxGlobalRecursion: 200,
        timeoutMs: 60000,
      });
      expect(safeErrorLogger.isGameLoadingActive()).toBe(true);

      safeErrorLogger.enableGameLoadingMode({
        context: '  custom-phase  ',
        timeoutMs: '15000',
      });

      expect(env.eventBus.getBatchModeOptions()).toMatchObject({
        context: 'custom-phase',
        maxGlobalRecursion: 50,
        timeoutMs: 15000,
      });

      safeErrorLogger.disableGameLoadingMode();

      expect(env.eventBus.isBatchModeEnabled()).toBe(true);
      expect(env.eventBus.getBatchModeOptions()).toMatchObject({
        context: 'game-load',
        maxGlobalRecursion: 200,
        timeoutMs: 60000,
      });
      expect(safeErrorLogger.isGameLoadingActive()).toBe(true);

      jest.advanceTimersByTime(60000);

      expect(env.eventBus.isBatchModeEnabled()).toBe(false);
      expect(safeErrorLogger.isGameLoadingActive()).toBe(false);

      safeErrorLogger.enableGameLoadingMode('  game-loading  ');

      expect(env.eventBus.isBatchModeEnabled()).toBe(true);
      expect(env.eventBus.getBatchModeOptions()).toMatchObject({
        context: 'game-loading',
        maxGlobalRecursion: 200,
        timeoutMs: 60000,
      });

      safeErrorLogger.disableGameLoadingMode({
        force: true,
        reason: 'manual-test',
      });

      expect(env.eventBus.isBatchModeEnabled()).toBe(false);
      expect(safeErrorLogger.isGameLoadingActive()).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('warns when contexts leak and reports errors when forced disable fails', async () => {
    class DisableFailingEventBus extends EventBus {
      setBatchMode(enabled, options = {}) {
        if (!enabled) {
          throw new Error('disable failure for integration test');
        }
        return super.setBatchMode(enabled, options);
      }
    }

    const logger = new RecordingLogger();
    const eventBus = new DisableFailingEventBus({ logger });
    const safeErrorLogger = createSafeErrorLogger({
      logger,
      eventBus,
    });

    await expect(
      safeErrorLogger.withGameLoadingMode(async () => {
        safeErrorLogger.enableGameLoadingMode({
          context: ' leaked-phase ',
          timeoutMs: 25,
        });
      }, { context: 'outer-phase', timeoutMs: 30 })
    ).resolves.toBeUndefined();

    expect(
      logger.calls.warn.some(([message]) =>
        message.includes(
          'SafeErrorLogger: Game loading mode still active after scope exit'
        )
      )
    ).toBe(true);
    expect(
      logger.calls.error.some(([message]) =>
        message.includes(
          'SafeErrorLogger: Forced disable of game loading mode failed during cleanup.'
        )
      )
    ).toBe(true);
    expect(eventBus.isBatchModeEnabled()).toBe(true);
  });

  it('propagates disable failures when cleanup cannot recover', async () => {
    class DisableFailingEventBus extends EventBus {
      setBatchMode(enabled, options = {}) {
        if (!enabled) {
          throw new Error('disable failure for integration test');
        }
        return super.setBatchMode(enabled, options);
      }
    }

    const logger = new RecordingLogger();
    const eventBus = new DisableFailingEventBus({ logger });
    const safeErrorLogger = createSafeErrorLogger({
      logger,
      eventBus,
    });

    await expect(
      safeErrorLogger.withGameLoadingMode(async () => {
        await Promise.resolve();
      }, { context: 'outer-phase', timeoutMs: 40 })
    ).rejects.toThrow('disable failure for integration test');

    expect(
      logger.calls.error.some(([message]) =>
        message.includes(
          'SafeErrorLogger: Failed to disable game loading mode during cleanup.'
        )
      )
    ).toBe(true);
  });

  it('falls back to console logging when downstream logger methods throw', () => {
    const env = createEnvironment();

    class ThrowingLogger extends RecordingLogger {
      error() {
        throw new Error('logger failure on error');
      }

      warn() {
        throw new Error('logger failure on warn');
      }
    }

    const failingLogger = new ThrowingLogger();
    const safeErrorLogger = createSafeErrorLogger({
      logger: failingLogger,
      safeEventDispatcher: env.safeEventDispatcher,
    });

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    const originalError = new Error('boom');

    try {
      safeErrorLogger.safeError('Integration test error', originalError, {
        marker: 1,
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'SafeErrorLogger: Logger failed. Original error: Integration test error',
        originalError,
        'Logger error:',
        expect.any(Error)
      );

      safeErrorLogger.safeWarn('Integration test warning', { marker: 2 });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'SafeErrorLogger: Logger failed. Original warning: Integration test warning',
        { marker: 2 },
        'Logger error:',
        expect.any(Error)
      );
    } finally {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    }
  });

  it('throws a descriptive error when dispatcher dependencies are missing', () => {
    const logger = new RecordingLogger();

    expect(() => createSafeErrorLogger({ logger })).toThrow(
      'SafeErrorLogger requires either safeEventDispatcher or eventBus parameter'
    );
  });

  it('normalizes option inputs and avoids scheduling when timeouts are invalid', () => {
    jest.useFakeTimers();

    const env = createEnvironment();
    const safeErrorLogger = createSafeErrorLogger({
      logger: env.logger,
      safeEventDispatcher: env.safeEventDispatcher,
    });

    try {
      // No-op disable call when nothing is active exercises guard branch
      safeErrorLogger.disableGameLoadingMode();
      expect(env.eventBus.isBatchModeEnabled()).toBe(false);

      safeErrorLogger.enableGameLoadingMode({ context: 123, timeoutMs: null });
      expect(env.eventBus.getBatchModeOptions()).toMatchObject({
        context: 'game-load',
        timeoutMs: 60000,
      });
      safeErrorLogger.disableGameLoadingMode({
        force: true,
        reason: 'cleanup-1',
      });
      expect(jest.getTimerCount()).toBe(0);

      safeErrorLogger.enableGameLoadingMode({
        context: '  game-initialization  ',
        timeoutMs: { bogus: true },
      });
      expect(env.eventBus.getBatchModeOptions()).toMatchObject({
        context: 'game-initialization',
        timeoutMs: 60000,
        maxGlobalRecursion: 200,
      });
      safeErrorLogger.disableGameLoadingMode({
        force: true,
        reason: 'cleanup-2',
      });

      safeErrorLogger.enableGameLoadingMode(true);
      expect(env.eventBus.getBatchModeOptions()).toMatchObject({
        context: 'game-load',
        timeoutMs: 60000,
      });
      safeErrorLogger.disableGameLoadingMode({
        force: true,
        reason: 'cleanup-3',
      });

      safeErrorLogger.enableGameLoadingMode({ timeoutMs: 0 });
      expect(env.eventBus.getBatchModeOptions()).toMatchObject({
        context: 'game-load',
        timeoutMs: 0,
      });
      expect(jest.getTimerCount()).toBe(0);
      safeErrorLogger.disableGameLoadingMode({
        force: true,
        reason: 'cleanup-4',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('restores state when enabling batch mode fails', () => {
    class EnablingFailsEventBus extends EventBus {
      setBatchMode(enabled, options = {}) {
        if (enabled) {
          throw new Error('enable failure for integration test');
        }

        return super.setBatchMode(enabled, options);
      }
    }

    const logger = new RecordingLogger();
    const eventBus = new EnablingFailsEventBus({ logger });
    const safeErrorLogger = createSafeErrorLogger({
      logger,
      eventBus,
    });

    expect(() =>
      safeErrorLogger.enableGameLoadingMode({
        context: 'failing-phase',
        timeoutMs: 500,
      })
    ).toThrow('enable failure for integration test');

    expect(eventBus.isBatchModeEnabled()).toBe(false);
    expect(safeErrorLogger.isGameLoadingActive()).toBe(false);
  });
});
