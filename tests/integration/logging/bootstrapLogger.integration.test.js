import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const MODULE_PATH = '../../../src/logging/bootstrapLogger.js';
const ENV_UTILS_PATH = '../../../src/utils/environmentUtils.js';

const ENV_KEYS = ['DEBUG_LOG_LEVEL', 'DEBUG_LOG_MODE'];

describe('bootstrapLogger integration coverage', () => {
  /** @type {Record<string, string | undefined>} */
  const savedEnv = {};
  /** @type {Partial<Record<'debug' | 'info' | 'warn' | 'error' | 'log', any>>} */
  const originalConsole = {};
  /** @type {any} */
  let savedGlobalEnv;
  /** @type {any} */
  let savedGlobalDebugLevel;

  beforeEach(() => {
    jest.resetModules();

    ENV_KEYS.forEach((key) => {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    });

    savedGlobalEnv = Object.prototype.hasOwnProperty.call(globalThis, 'env')
      ? globalThis.env
      : undefined;
    if (
      Object.prototype.hasOwnProperty.call(globalThis, '__DEBUG_LOG_LEVEL__')
    ) {
      savedGlobalDebugLevel = globalThis.__DEBUG_LOG_LEVEL__;
    } else {
      savedGlobalDebugLevel = undefined;
    }

    originalConsole.debug = console.debug;
    originalConsole.info = console.info;
    originalConsole.warn = console.warn;
    originalConsole.error = console.error;
    originalConsole.log = console.log;
  });

  afterEach(() => {
    ENV_KEYS.forEach((key) => {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });

    if (savedGlobalEnv === undefined) {
      delete globalThis.env;
    } else {
      globalThis.env = savedGlobalEnv;
    }

    if (savedGlobalDebugLevel === undefined) {
      delete globalThis.__DEBUG_LOG_LEVEL__;
    } else {
      globalThis.__DEBUG_LOG_LEVEL__ = savedGlobalDebugLevel;
    }

    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.log = originalConsole.log;

    jest.restoreAllMocks();
  });

  it('resolves log level from environment variables and routes console calls appropriately', async () => {
    process.env.DEBUG_LOG_LEVEL = 'info';

    const { createBootstrapLogger, resolveBootstrapLogLevel, LogLevel } =
      await import(MODULE_PATH);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const logger = createBootstrapLogger();

    expect(logger.getLevel()).toBe(LogLevel.INFO);

    // Invalid numeric level should fall through to environment variable
    expect(
      resolveBootstrapLogLevel({ level: 999, defaultLevel: LogLevel.ERROR })
    ).toBe(LogLevel.INFO);

    logger.debug('debug skip');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenNthCalledWith(1, 'info message');
    expect(infoSpy).toHaveBeenCalledWith('info message');
    expect(warnSpy).toHaveBeenCalledWith('warn message');
    expect(errorSpy).toHaveBeenCalledWith('error message');

    debugSpy.mockClear();
    infoSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
    logSpy.mockClear();

    const silentLogger = createBootstrapLogger({ level: LogLevel.NONE });
    silentLogger.debug('silent debug');
    silentLogger.info('silent info');
    silentLogger.warn('silent warn');
    silentLogger.error('silent error');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('falls back to alternate console methods when primary ones are unavailable', async () => {
    const { createBootstrapLogger, LogLevel } = await import(MODULE_PATH);

    console.debug = undefined;
    console.info = undefined;

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    console.warn = console.log;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const logger = createBootstrapLogger({ level: LogLevel.DEBUG });

    expect(logger.getLevel()).toBe(LogLevel.DEBUG);

    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(logSpy).toHaveBeenCalledTimes(3);
    expect(logSpy).toHaveBeenNthCalledWith(1, 'debug message');
    expect(logSpy).toHaveBeenNthCalledWith(2, 'info message');
    expect(logSpy).toHaveBeenNthCalledWith(3, 'warn message');
    expect(errorSpy).toHaveBeenCalledWith('error message');

    errorSpy.mockClear();

    const directDebugSpy = jest.fn();
    console.debug = directDebugSpy;
    logger.debug('direct path');
    expect(directDebugSpy).toHaveBeenCalledWith('direct path');
    directDebugSpy.mockReset();

    console.warn = undefined;
    logger.warn('fallback warn');
    expect(logSpy).toHaveBeenNthCalledWith(4, 'fallback warn');

    errorSpy.mockRestore();
    console.error = undefined;
    logger.error('fallback error');
    expect(logSpy).toHaveBeenNthCalledWith(5, 'fallback error');
  });

  it('reads bootstrap level when environment utilities are partially mocked', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock(ENV_UTILS_PATH, () => ({}));

      const previousEnv = Object.prototype.hasOwnProperty.call(
        globalThis,
        'env'
      )
        ? globalThis.env
        : undefined;
      const previousDebug = Object.prototype.hasOwnProperty.call(
        globalThis,
        '__DEBUG_LOG_LEVEL__'
      )
        ? globalThis.__DEBUG_LOG_LEVEL__
        : undefined;

      try {
        const { createBootstrapLogger, resolveBootstrapLogLevel, LogLevel } =
          await import(MODULE_PATH);

        process.env.DEBUG_LOG_LEVEL = 'error';
        expect(resolveBootstrapLogLevel()).toBe(LogLevel.ERROR);

        delete process.env.DEBUG_LOG_LEVEL;
        globalThis.__DEBUG_LOG_LEVEL__ = 'warning';
        expect(resolveBootstrapLogLevel()).toBe(LogLevel.WARN);

        globalThis.__DEBUG_LOG_LEVEL__ = null;
        expect(resolveBootstrapLogLevel({ defaultLevel: LogLevel.ERROR })).toBe(
          LogLevel.ERROR
        );

        delete globalThis.__DEBUG_LOG_LEVEL__;
        globalThis.env = { DEBUG_LOG_MODE: 'console' };
        expect(resolveBootstrapLogLevel({ defaultLevel: LogLevel.ERROR })).toBe(
          LogLevel.DEBUG
        );

        globalThis.env.DEBUG_LOG_MODE = null;
        expect(resolveBootstrapLogLevel({ defaultLevel: LogLevel.WARN })).toBe(
          LogLevel.WARN
        );

        delete globalThis.env;
        const errorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        const logger = createBootstrapLogger({ defaultLevel: LogLevel.ERROR });
        expect(logger.getLevel()).toBe(LogLevel.ERROR);
        logger.error('default fallback');
        expect(errorSpy).toHaveBeenCalledWith('default fallback');
        errorSpy.mockRestore();
      } finally {
        if (previousEnv === undefined) {
          delete globalThis.env;
        } else {
          globalThis.env = previousEnv;
        }

        if (previousDebug === undefined) {
          delete globalThis.__DEBUG_LOG_LEVEL__;
        } else {
          globalThis.__DEBUG_LOG_LEVEL__ = previousDebug;
        }
      }
    });
  });
});
