import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_CONSOLE = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
  log: console.log,
};

describe('EnhancedConsoleLogger additional coverage', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete globalThis.chalk;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    console.debug = ORIGINAL_CONSOLE.debug;
    console.info = ORIGINAL_CONSOLE.info;
    console.warn = ORIGINAL_CONSOLE.warn;
    console.error = ORIGINAL_CONSOLE.error;
    console.log = ORIGINAL_CONSOLE.log;
    delete globalThis.chalk;
    jest.restoreAllMocks();
    jest.dontMock('chalk');
    jest.dontMock('../../../src/logging/loggerConfiguration.js');
    jest.dontMock('../../../src/logging/logFormatter.js');
  });

  it('uses chalk from the global scope when available', async () => {
    const globalChalk = {
      blue: jest.fn((value) => value),
      cyan: jest.fn((value) => value),
      green: jest.fn((value) => value),
      yellow: jest.fn((value) => value),
      red: { bold: jest.fn((value) => value) },
      gray: Object.assign(jest.fn((value) => value), {
        italic: jest.fn((value) => value),
      }),
    };
    globalThis.chalk = globalChalk;

    jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
      getLoggerConfiguration: () => ({
        isColorsEnabled: () => true,
        isIconsEnabled: () => true,
        isPrettyFormatEnabled: () => true,
        getMaxMessageLength: () => 200,
        shouldShowContext: () => true,
        isDevelopment: () => false,
      }),
    }));

    jest.doMock('../../../src/logging/logFormatter.js', () => ({
      getLogFormatter: () => ({
        formatMessage: (level, message, ...args) => ({
          timestamp: '2024-01-01T00:00:00.000Z',
          icon: '',
          level: level.toUpperCase(),
          service: 'ServiceName',
          message,
          contextLines: args.map((arg, index) => `context-${index}:${JSON.stringify(arg)}`),
        }),
        formatSimple: jest.fn(),
      }),
    }));

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.info('global chalk works', { value: 42 });

    expect(globalChalk.blue).toHaveBeenCalledWith('test');
    expect(globalChalk.green).toHaveBeenCalledWith('INFO');
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('ServiceName: global chalk works')
    );
    expect(infoSpy.mock.calls[0][0]).toContain('[2024-01-01T00:00:00.000Z]');

    infoSpy.mockRestore();
  });

  it('falls back to simple console output when formatting fails and level method is missing', async () => {
    jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
      getLoggerConfiguration: () => ({
        isColorsEnabled: () => false,
        isIconsEnabled: () => false,
        isPrettyFormatEnabled: () => true,
        getMaxMessageLength: () => 200,
        shouldShowContext: () => false,
        isDevelopment: () => false,
      }),
    }));

    jest.doMock('../../../src/logging/logFormatter.js', () => ({
      getLogFormatter: () => ({
        formatMessage: () => {
          throw new Error('format failure');
        },
        formatSimple: jest.fn(),
      }),
    }));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const originalDebug = console.debug;
    // Simulate missing console.debug so the fallback uses console.log
    Object.defineProperty(console, 'debug', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const { getEnhancedConsoleLogger } = await import(
      '../../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.debug('fallback message', { meta: 'data' });

    expect(errorSpy).toHaveBeenCalledWith(
      'EnhancedConsoleLogger: Formatting error, falling back to simple output'
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[FALLBACK] DEBUG: fallback message',
      { meta: 'data' }
    );

    errorSpy.mockRestore();
    logSpy.mockRestore();
    Object.defineProperty(console, 'debug', {
      configurable: true,
      writable: true,
      value: originalDebug,
    });
  });

  it('emits sample messages when testOutput runs in development', async () => {
    jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
      getLoggerConfiguration: () => ({
        isColorsEnabled: () => false,
        isIconsEnabled: () => false,
        isPrettyFormatEnabled: () => false,
        getMaxMessageLength: () => 200,
        shouldShowContext: () => false,
        isDevelopment: () => true,
      }),
    }));

    jest.doMock('../../../src/logging/logFormatter.js', () => ({
      getLogFormatter: () => ({
        formatMessage: jest.fn(),
        formatSimple: (level, message, ...args) =>
          `${level.toUpperCase()}: ${message} ${args.map((arg) => JSON.stringify(arg)).join(' ')}`.trim(),
      }),
    }));

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.testOutput();

    expect(logSpy).toHaveBeenCalledWith('\n=== Enhanced Logger Test Output ===');
    expect(logSpy).toHaveBeenCalledWith('=== End Test Output ===\n');
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('INFO'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('WARN'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));

    logSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
