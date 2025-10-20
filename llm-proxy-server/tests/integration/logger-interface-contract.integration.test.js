import { jest } from '@jest/globals';

const ORIGINAL_ENV = process.env;
const stdoutDescriptor = Object.getOwnPropertyDescriptor(
  process.stdout,
  'isTTY'
);
const stderrDescriptor = Object.getOwnPropertyDescriptor(
  process.stderr,
  'isTTY'
);
const originalChalkState = {
  globalThis: globalThis.chalk,
  global: typeof global !== 'undefined' ? global.chalk : undefined,
};

describe('ILogger interface integration coverage', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };

    if (stdoutDescriptor?.configurable) {
      Object.defineProperty(process.stdout, 'isTTY', {
        configurable: true,
        value: true,
      });
    }

    if (stderrDescriptor?.configurable) {
      Object.defineProperty(process.stderr, 'isTTY', {
        configurable: true,
        value: true,
      });
    }

    delete globalThis.chalk;
    if (typeof global !== 'undefined') {
      delete global.chalk;
    }
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;

    if (stdoutDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', stdoutDescriptor);
    }

    if (stderrDescriptor) {
      Object.defineProperty(process.stderr, 'isTTY', stderrDescriptor);
    }

    if (originalChalkState.globalThis === undefined) {
      delete globalThis.chalk;
    } else {
      globalThis.chalk = originalChalkState.globalThis;
    }

    if (typeof global !== 'undefined') {
      if (originalChalkState.global === undefined) {
        delete global.chalk;
      } else {
        global.chalk = originalChalkState.global;
      }
    }

    jest.restoreAllMocks();
  });

  test('Console and enhanced loggers align with ILogger metadata in development mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_COLOR_MODE = 'always';
    process.env.LOG_ICON_MODE = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';

    const stubChalk = {
      cyan: (str) => `\u001b[36m${str}\u001b[0m`,
      green: (str) => `\u001b[32m${str}\u001b[0m`,
      yellow: (str) => `\u001b[33m${str}\u001b[0m`,
      red: Object.assign((str) => `\u001b[31m${str}\u001b[0m`, {
        bold: (str) => `\u001b[1;31m${str}\u001b[0m`,
      }),
      gray: Object.assign((str) => `\u001b[90m${str}\u001b[0m`, {
        italic: (str) => `\u001b[3;90m${str}\u001b[0m`,
      }),
      blue: (str) => `\u001b[34m${str}\u001b[0m`,
    };
    globalThis.chalk = stubChalk;
    if (typeof global !== 'undefined') {
      global.chalk = stubChalk;
    }

    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const [
      { ILoggerMetadata },
      { createConsoleLogger },
      { getEnhancedConsoleLogger },
    ] = await Promise.all([
      import('../../src/interfaces/coreServices.js'),
      import('../../src/consoleLogger.js'),
      import('../../src/logging/enhancedConsoleLogger.js'),
    ]);

    const consoleLogger = createConsoleLogger();
    const enhancedLogger = getEnhancedConsoleLogger();
    const metadataMethodNames = ILoggerMetadata.methods.map(
      (method) => method.name
    );

    expect(metadataMethodNames).toEqual(['info', 'warn', 'error', 'debug']);

    const context = {
      service: 'integration-suite',
      token: 'sk-integration-secret',
      nested: { authorization: 'Bearer 12345' },
    };

    for (const methodName of metadataMethodNames) {
      expect(typeof consoleLogger[methodName]).toBe('function');
      expect(typeof enhancedLogger[methodName]).toBe('function');

      consoleLogger[methodName](`console-${methodName}`, context);
      enhancedLogger[methodName](`enhanced-${methodName}`, context);
    }

    expect(debugSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    for (const methodName of metadataMethodNames) {
      const consoleCall = (
        methodName === 'debug'
          ? debugSpy
          : methodName === 'info'
            ? infoSpy
            : methodName === 'warn'
              ? warnSpy
              : errorSpy
      ).mock.calls.find(([message]) =>
        message.includes(`console-${methodName}`)
      );
      const enhancedCall = (
        methodName === 'debug'
          ? debugSpy
          : methodName === 'info'
            ? infoSpy
            : methodName === 'warn'
              ? warnSpy
              : errorSpy
      ).mock.calls.find(([message]) =>
        message.includes(`enhanced-${methodName}`)
      );

      expect(consoleCall?.[0]).toContain(`console-${methodName}`);
      expect(enhancedCall?.[0]).toContain(`enhanced-${methodName}`);
    }

    const observedOutputs = [
      ...debugSpy.mock.calls.map(([message]) => message),
      ...infoSpy.mock.calls.map(([message]) => message),
      ...warnSpy.mock.calls.map(([message]) => message),
      ...errorSpy.mock.calls.map(([message]) => message),
    ];

    expect(observedOutputs.some((message) => message.includes('\u001b['))).toBe(
      true
    );
    expect(
      observedOutputs.every((message) => message.includes('integration-suite'))
    ).toBe(true);
  });

  test('Secure logger generated from ConsoleLogger masks sensitive context in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_ENHANCED_FORMATTING = 'false';
    process.env.LOG_COLOR_MODE = 'never';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';

    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const [{ ILoggerMetadata }, { createConsoleLogger }] = await Promise.all([
      import('../../src/interfaces/coreServices.js'),
      import('../../src/consoleLogger.js'),
    ]);

    const consoleLogger = createConsoleLogger();
    const secureLogger = consoleLogger.createSecure();

    for (const { name } of ILoggerMetadata.methods) {
      expect(typeof secureLogger[name]).toBe('function');
    }

    const sensitiveContext = {
      apiKey: 'sk-production-secret',
      nested: {
        token: 'super-secret-token',
        password: 'ultra-secret-password',
      },
    };

    secureLogger.info('Secure info log', sensitiveContext);
    secureLogger.warn('Secure warn log', sensitiveContext);
    secureLogger.error('Secure error log', sensitiveContext);
    secureLogger.debug('Secure debug log', sensitiveContext);

    const spiesByLevel = {
      info: infoSpy,
      warn: warnSpy,
      error: errorSpy,
      debug: debugSpy,
    };

    for (const level of Object.keys(spiesByLevel)) {
      const spy = spiesByLevel[level];
      const invocation = spy.mock.calls.find(([message]) =>
        message.includes(`Secure ${level} log`)
      );
      expect(invocation?.[0]).toContain('[MASKED]');
      expect(invocation?.[0]).not.toContain('sk-production-secret');
      expect(invocation?.[0]).not.toContain('super-secret-token');
      expect(invocation?.[0]).not.toContain('ultra-secret-password');
    }
  });
});
