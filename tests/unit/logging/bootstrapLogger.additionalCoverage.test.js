import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const MODULE_PATH = '../../../src/logging/bootstrapLogger.js';
const ENV_UTILS_PATH = '../../../src/utils/environmentUtils.js';

const GLOBAL_KEY = '__DEBUG_LOG_LEVEL__';
const SENTINEL = Symbol('missing');

describe('bootstrapLogger environment fallbacks', () => {
  let originalLevel;
  let originalMode;
  let originalGlobalKey;
  let originalGlobalEnv;

  beforeEach(() => {
    jest.resetModules();
    originalLevel = Object.prototype.hasOwnProperty.call(
      process.env,
      'DEBUG_LOG_LEVEL'
    )
      ? process.env.DEBUG_LOG_LEVEL
      : SENTINEL;
    originalMode = Object.prototype.hasOwnProperty.call(
      process.env,
      'DEBUG_LOG_MODE'
    )
      ? process.env.DEBUG_LOG_MODE
      : SENTINEL;
    originalGlobalKey = Object.prototype.hasOwnProperty.call(
      globalThis,
      GLOBAL_KEY
    )
      ? globalThis[GLOBAL_KEY]
      : SENTINEL;
    originalGlobalEnv = Object.prototype.hasOwnProperty.call(globalThis, 'env')
      ? globalThis.env
      : SENTINEL;

    delete process.env.DEBUG_LOG_LEVEL;
    delete process.env.DEBUG_LOG_MODE;
    delete globalThis[GLOBAL_KEY];
    delete globalThis.env;
  });

  afterEach(() => {
    jest.resetModules();
    jest.dontMock(ENV_UTILS_PATH);

    if (originalLevel === SENTINEL) {
      delete process.env.DEBUG_LOG_LEVEL;
    } else {
      process.env.DEBUG_LOG_LEVEL = originalLevel;
    }

    if (originalMode === SENTINEL) {
      delete process.env.DEBUG_LOG_MODE;
    } else {
      process.env.DEBUG_LOG_MODE = originalMode;
    }

    if (originalGlobalKey === SENTINEL) {
      delete globalThis[GLOBAL_KEY];
    } else {
      globalThis[GLOBAL_KEY] = originalGlobalKey;
    }

    if (originalGlobalEnv === SENTINEL) {
      delete globalThis.env;
    } else {
      globalThis.env = originalGlobalEnv;
    }
  });

  it('reads environment variables from process.env when utilities are unavailable', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock(ENV_UTILS_PATH, () => ({
        getEnvironmentVariable: undefined,
      }));
      process.env.DEBUG_LOG_LEVEL = 'warn';

      const module = await import(MODULE_PATH);
      expect(module.resolveBootstrapLogLevel()).toBe(module.LogLevel.WARN);
    });
  });

  it('falls back to a global scoped value when process.env has no data', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock(ENV_UTILS_PATH, () => ({
        getEnvironmentVariable: undefined,
      }));
      globalThis[GLOBAL_KEY] = 'silent';

      const module = await import(MODULE_PATH);
      expect(module.resolveBootstrapLogLevel()).toBe(module.LogLevel.NONE);
    });
  });

  it('uses the global env bag and respects null coalescing to the default', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock(ENV_UTILS_PATH, () => ({
        getEnvironmentVariable: undefined,
      }));
      globalThis.env = { DEBUG_LOG_LEVEL: null };

      const module = await import(MODULE_PATH);
      expect(
        module.resolveBootstrapLogLevel({ defaultLevel: module.LogLevel.ERROR })
      ).toBe(module.LogLevel.ERROR);
    });
  });

  it('normalizes numeric log levels and ignores invalid numeric overrides', async () => {
    const module = await import(MODULE_PATH);

    expect(
      module.resolveBootstrapLogLevel({ level: module.LogLevel.DEBUG })
    ).toBe(module.LogLevel.DEBUG);
    expect(
      module.resolveBootstrapLogLevel({
        level: 999,
        defaultLevel: module.LogLevel.INFO,
      })
    ).toBe(module.LogLevel.INFO);
  });

  it('extracts log levels from the global env bag when populated', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock(ENV_UTILS_PATH, () => ({
        getEnvironmentVariable: undefined,
      }));
      globalThis.env = { DEBUG_LOG_LEVEL: 'warning' };

      const module = await import(MODULE_PATH);
      expect(module.resolveBootstrapLogLevel()).toBe(module.LogLevel.WARN);
    });
  });
});

describe('bootstrapLogger console fallbacks', () => {
  let consoleLogSpy;
  let consoleInfoSpy;
  let originalDebug;
  let originalWarn;
  let originalError;

  beforeEach(() => {
    jest.resetModules();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    originalDebug = console.debug;
    originalWarn = console.warn;
    originalError = console.error;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    console.debug = originalDebug;
    console.warn = originalWarn;
    console.error = originalError;
  });

  it('invokes fallback logging before the primary info method', async () => {
    const module = await import(MODULE_PATH);
    const logger = module.createBootstrapLogger({
      level: module.LogLevel.DEBUG,
    });

    logger.info('info message');

    expect(consoleLogSpy).toHaveBeenCalledWith('info message');
    expect(consoleInfoSpy).toHaveBeenCalledWith('info message');
  });

  it('avoids duplicate logging when primary and fallback targets are identical', async () => {
    const module = await import(MODULE_PATH);
    const logger = module.createBootstrapLogger({
      level: module.LogLevel.INFO,
    });

    consoleInfoSpy.mockRestore();
    console.info = console.log;

    logger.info('deduplicated');

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  it('uses console.log as a fallback when debug/warn/error APIs are missing', async () => {
    const module = await import(MODULE_PATH);
    const logger = module.createBootstrapLogger({
      level: module.LogLevel.DEBUG,
    });

    console.debug = undefined;
    logger.debug('debug via log');
    expect(consoleLogSpy).toHaveBeenCalledWith('debug via log');

    console.warn = undefined;
    logger.warn('warn via log');
    expect(consoleLogSpy).toHaveBeenCalledWith('warn via log');

    console.error = undefined;
    logger.error('error via log');
    expect(consoleLogSpy).toHaveBeenCalledWith('error via log');
  });

  it('reports the effective log level through getLevel()', async () => {
    const module = await import(MODULE_PATH);
    const logger = module.createBootstrapLogger({ level: 'trace' });

    expect(logger.getLevel()).toBe(module.LogLevel.DEBUG);
  });
});
