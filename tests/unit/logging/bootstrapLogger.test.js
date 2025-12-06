import {
  jest,
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
} from '@jest/globals';

import {
  createBootstrapLogger,
  resolveBootstrapLogLevel,
  LogLevel,
} from '../../../src/logging/bootstrapLogger.js';

describe('bootstrapLogger', () => {
  let originalDebugLevel;
  let originalDebugMode;
  let consoleDebugSpy;
  let consoleInfoSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    originalDebugLevel = process.env.DEBUG_LOG_LEVEL;
    originalDebugMode = process.env.DEBUG_LOG_MODE;

    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalDebugLevel === undefined) {
      delete process.env.DEBUG_LOG_LEVEL;
    } else {
      process.env.DEBUG_LOG_LEVEL = originalDebugLevel;
    }

    if (originalDebugMode === undefined) {
      delete process.env.DEBUG_LOG_MODE;
    } else {
      process.env.DEBUG_LOG_MODE = originalDebugMode;
    }

    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('suppresses debug output when effective level is INFO', () => {
    process.env.DEBUG_LOG_LEVEL = 'info';
    process.env.DEBUG_LOG_MODE = '';

    const logger = createBootstrapLogger();
    logger.debug('should not log');
    logger.error('still log errors');

    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('still log errors');
  });

  it('emits debug output when level is DEBUG', () => {
    process.env.DEBUG_LOG_LEVEL = 'debug';
    process.env.DEBUG_LOG_MODE = '';

    const logger = createBootstrapLogger();
    logger.debug('debug enabled');

    expect(consoleDebugSpy).toHaveBeenCalledWith('debug enabled');
  });

  it('derives level from DEBUG_LOG_MODE when explicit level missing', () => {
    delete process.env.DEBUG_LOG_LEVEL;
    process.env.DEBUG_LOG_MODE = 'console';

    const level = resolveBootstrapLogLevel();
    expect(level).toBe(LogLevel.DEBUG);
  });

  it('falls back to provided default level when no overrides exist', () => {
    delete process.env.DEBUG_LOG_LEVEL;
    delete process.env.DEBUG_LOG_MODE;

    const level = resolveBootstrapLogLevel({ defaultLevel: LogLevel.WARN });
    expect(level).toBe(LogLevel.WARN);
  });
});
