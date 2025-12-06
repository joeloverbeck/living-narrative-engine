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

let originalGlobalReference;
let originalGlobalThisChalk;

describe('EnhancedConsoleLogger additional coverage', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    originalGlobalReference = global;
    originalGlobalThisChalk = globalThis.chalk;
    delete globalThis.chalk;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global = originalGlobalReference;
    if (originalGlobalThisChalk === undefined) {
      delete globalThis.chalk;
    } else {
      globalThis.chalk = originalGlobalThisChalk;
    }
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
    jest.dontMock('../../../src/utils/loggerUtils.js');
  });

  it('uses chalk from the global scope when available', async () => {
    const globalChalk = {
      blue: jest.fn((value) => value),
      cyan: jest.fn((value) => value),
      green: jest.fn((value) => value),
      yellow: jest.fn((value) => value),
      red: { bold: jest.fn((value) => value) },
      gray: Object.assign(
        jest.fn((value) => value),
        {
          italic: jest.fn((value) => value),
        }
      ),
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
          contextLines: args.map(
            (arg, index) => `context-${index}:${JSON.stringify(arg)}`
          ),
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

  it('prefers chalk from the Node global when globalThis has none', async () => {
    const nodeGlobalChalk = {
      blue: jest.fn((value) => value),
      cyan: jest.fn((value) => value),
      green: jest.fn((value) => value),
      yellow: jest.fn((value) => value),
      red: { bold: jest.fn((value) => value) },
      gray: Object.assign(
        jest.fn((value) => value),
        {
          italic: jest.fn((value) => value),
        }
      ),
    };

    // Remove any chalk reference from globalThis and replace the Node global object
    delete globalThis.chalk;
    global = { chalk: nodeGlobalChalk, console };

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
          service: 'NodeGlobalService',
          message,
          contextLines: args.map(
            (arg, index) => `ctx-${index}:${JSON.stringify(arg)}`
          ),
        }),
        formatSimple: jest.fn(),
      }),
    }));

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.info('node global chalk works', { id: 123 });

    expect(nodeGlobalChalk.blue).toHaveBeenCalledWith('test');
    expect(nodeGlobalChalk.green).toHaveBeenCalledWith('INFO');
    expect(nodeGlobalChalk.gray.italic).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('NodeGlobalService: node global chalk works')
    );

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
    expect(logSpy).toHaveBeenCalledWith('[FALLBACK] DEBUG: fallback message', {
      meta: 'data',
    });

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

    expect(logSpy).toHaveBeenCalledWith(
      '\n=== Enhanced Logger Test Output ==='
    );
    expect(logSpy).toHaveBeenCalledWith('=== End Test Output ===\n');
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('INFO'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('WARN'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));

    logSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('sanitizes sensitive strings and nested objects while preserving service prefixes', async () => {
    process.env.NODE_ENV = 'production';

    jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
      getLoggerConfiguration: () => ({
        isColorsEnabled: () => false,
        isIconsEnabled: () => false,
        isPrettyFormatEnabled: () => false,
        getMaxMessageLength: () => 200,
        shouldShowContext: () => true,
        isDevelopment: () => false,
      }),
    }));

    const formatSimple = jest.fn(
      (level, message, ...args) =>
        `${level.toUpperCase()}|${message}|${JSON.stringify(args)}`
    );

    jest.doMock('../../../src/logging/logFormatter.js', () => ({
      getLogFormatter: () => ({
        formatMessage: jest.fn(),
        formatSimple,
      }),
    }));

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.info('ApiKeyService: safe prefix', 'Bearer sk-secret-token', {
      nested: { token: 'super-secret', keep: 'data' },
      credentials: [
        { password: 'hunter2' },
        { nested: { apiKey: 'abcd1234' } },
      ],
      normal: 'value',
    });

    expect(formatSimple).toHaveBeenCalledTimes(1);
    const [, sanitizedMessage, ...sanitizedArgs] = formatSimple.mock.calls[0];
    expect(sanitizedMessage).toBe('ApiKeyService: safe prefix');
    expect(sanitizedArgs[0]).toBe('[MASKED]');
    expect(sanitizedArgs[1]).toEqual({
      nested: { token: '[MASKED]', keep: 'data' },
      credentials: [
        { password: '[MASKED]' },
        { nested: { apiKey: '[MASKED]' } },
      ],
      normal: 'value',
    });

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('INFO|ApiKeyService: safe prefix|')
    );

    infoSpy.mockRestore();
  });

  it('preserves the original message when sanitization yields a falsy result', async () => {
    jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
      getLoggerConfiguration: () => ({
        isColorsEnabled: () => false,
        isIconsEnabled: () => false,
        isPrettyFormatEnabled: () => false,
        getMaxMessageLength: () => 200,
        shouldShowContext: () => false,
        isDevelopment: () => false,
      }),
    }));

    const formatSimple = jest.fn(
      (level, message) => `${level.toUpperCase()}:${message}`
    );

    jest.doMock('../../../src/logging/logFormatter.js', () => ({
      getLogFormatter: () => ({
        formatMessage: jest.fn(),
        formatSimple,
      }),
    }));

    const originalMessage = 'Bearer sk-test-12345678901234567890';

    jest.doMock('../../../src/utils/loggerUtils.js', () => ({
      maskApiKey: () => undefined,
      createSecureLogger: (logger) => logger,
    }));

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.info(originalMessage);

    expect(formatSimple).toHaveBeenCalledTimes(1);
    expect(formatSimple).toHaveBeenCalledWith('info', originalMessage);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0][0]).toContain(originalMessage);
  });

  it('masks standalone long tokens that match the strict pattern', async () => {
    process.env.NODE_ENV = 'production';

    jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
      getLoggerConfiguration: () => ({
        isColorsEnabled: () => false,
        isIconsEnabled: () => false,
        isPrettyFormatEnabled: () => false,
        getMaxMessageLength: () => 200,
        shouldShowContext: () => false,
        isDevelopment: () => false,
      }),
    }));

    const formatSimple = jest.fn(
      (level, message) => `${level.toUpperCase()}:${message}`
    );
    const maskApiKey = jest.fn(() => '[MASKED]');

    jest.doMock('../../../src/logging/logFormatter.js', () => ({
      getLogFormatter: () => ({
        formatMessage: jest.fn(),
        formatSimple,
      }),
    }));

    jest.doMock('../../../src/utils/loggerUtils.js', () => ({
      maskApiKey,
      createSecureLogger: (logger) => logger,
    }));

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    const longToken = 'A'.repeat(64);
    logger.info(longToken);

    expect(maskApiKey).toHaveBeenCalledWith(longToken);
    expect(formatSimple).toHaveBeenCalledWith('info', '[MASKED]');
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[MASKED]'));

    infoSpy.mockRestore();
  });

  it('returns uncolored output when a color function is unavailable', async () => {
    const originalMapGet = Map.prototype.get;
    const originalMapHas = Map.prototype.has;

    let colorFunctionMap;
    let fallbackTriggered = false;
    let infoSpy;

    try {
      Map.prototype.get = function patchedGet(key) {
        const value = originalMapGet.call(this, key);
        if (
          !colorFunctionMap &&
          this instanceof Map &&
          originalMapHas.call(this, 'debug') &&
          originalMapHas.call(this, 'info') &&
          originalMapHas.call(this, 'warn') &&
          originalMapHas.call(this, 'error')
        ) {
          colorFunctionMap = this;
        }
        return value;
      };

      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      const logger = getEnhancedConsoleLogger();

      infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

      logger.info('warmup message');
      expect(colorFunctionMap).toBeDefined();

      Map.prototype.get = function overrideGet(key) {
        if (this === colorFunctionMap && key === 'info') {
          fallbackTriggered = true;
          return undefined;
        }
        return originalMapGet.call(this, key);
      };

      logger.info('colorless output expected');

      expect(fallbackTriggered).toBe(true);
      const loggedOutput = infoSpy.mock.calls.at(-1)[0];
      expect(loggedOutput).toContain('colorless output expected');
      expect(loggedOutput).toContain('INFO');
    } finally {
      Map.prototype.get = originalMapGet;
      if (infoSpy) {
        infoSpy.mockRestore();
      }
    }
  });
});
