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

/**
 * @description Integration coverage for the ConsoleLogger facade ensuring it delegates to the
 * enhanced console logger implementation when interacting with real formatting utilities.
 */
describe('ConsoleLogger facade integration behaviour', () => {
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

    jest.restoreAllMocks();
  });

  test('delegates log output, secure logger masking, and enhanced test output through facade', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_COLOR_MODE = 'always';
    process.env.LOG_ICON_MODE = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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

    const module = await import('../../src/consoleLogger.js');
    const { ConsoleLogger, createConsoleLogger } = module;

    const logger = new ConsoleLogger();

    logger.debug('Initialising proxy pipeline', {
      nested: { token: 'abc12345', plain: 'value' },
    });
    logger.info('Proxy ready for traffic', 'apiKey=sk-test1234567890');
    logger.warn('Rate limit near capacity', { apiKey: 'sk-warning' });
    logger.error('Backend responded with error', {
      provider: 'openai',
      rawToken: 'should-hide',
    });

    expect(debugSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    const combinedMessages = [
      ...debugSpy.mock.calls.flat(),
      ...infoSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...errorSpy.mock.calls.flat(),
    ].join('\n');
    expect(combinedMessages).toContain('Proxy ready for traffic');
    expect(combinedMessages).toMatch(/\[MASKED]/);
    expect(combinedMessages).toContain('\u001b[');

    const secureLogger = logger.createSecure();
    secureLogger.info('Secure payload processed', {
      auth: { apiKey: 'sk-secure-123', nested: { token: 'n-456' } },
    });

    const secureCall = infoSpy.mock.calls.find(([message]) =>
      message.includes('Secure payload processed')
    );
    expect(secureCall?.[0]).toContain('[MASKED]');
    expect(secureCall?.[0]).not.toContain('sk-secure-123');
    expect(secureCall?.[0]).not.toContain('n-456');

    const factoryLogger = createConsoleLogger();
    factoryLogger.debug('Factory logger engaged', { token: 'factory-secret' });
    const factoryCall = debugSpy.mock.calls.find(([message]) =>
      message.includes('Factory logger engaged')
    );
    expect(factoryCall?.[0]).toContain('[MASKED]');

    module.default.info('Default logger in use', {
      authToken: 'default-secret',
    });
    const defaultCall = infoSpy.mock.calls.find(([message]) =>
      message.includes('Default logger in use')
    );
    expect(defaultCall?.[0]).toContain('[MASKED]');

    logger.testEnhancedOutput();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Enhanced Logger Test Output')
    );
  });
});
