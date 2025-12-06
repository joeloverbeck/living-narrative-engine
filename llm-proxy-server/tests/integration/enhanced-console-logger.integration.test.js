/**
 * @file enhanced-console-logger.integration.test.js
 * @description Integration coverage exercising the enhanced console logger together
 *              with the logger configuration, formatter, and secure logger utilities.
 */

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

describe('Enhanced console logger integration behaviour', () => {
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

  test('sanitises sensitive payloads and falls back to simple formatting when pretty printing is disabled', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'false';
    process.env.LOG_COLOR_MODE = 'never';

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.info(
      'LLM proxy ready',
      'apiKey=sk-1234567890abcdef1234',
      'Bearer secret_token',
      {
        nested: {
          token: 'abc12345',
          safe: 'value',
        },
      }
    );

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const output = infoSpy.mock.calls[0][0];

    expect(output).toMatch(/\[.*\] INFO: LLM proxy ready/);
    expect(output).toMatch(/apiK\*+/);
    expect(output).not.toContain('secret_token');
    expect(output).not.toContain('abc12345');
    expect(output).toContain('[MASKED]');
    expect(output).not.toContain('\u001b[');
  });

  test('emits coloured pretty logs, supports secure logger masking, and exercises development test output', async () => {
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

    const module = await import('../../src/logging/enhancedConsoleLogger.js');
    const logger = module.getEnhancedConsoleLogger();

    logger.testOutput();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Enhanced Logger Test Output')
    );
    expect(debugSpy).toHaveBeenCalled();
    const debugOutput = debugSpy.mock.calls[0][0];
    expect(debugOutput).toContain('ApiKeyService: Debug message with context');
    expect(debugOutput).toContain('\u001b[');
    expect(debugOutput.split('\n').length).toBeGreaterThan(1);

    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    const secureLogger = logger.createSecure();
    secureLogger.error('Credentials update', {
      service: 'AuthService',
      nested: {
        apiKey: 'abcd1234',
        deeper: { token: 'zzz999' },
      },
    });

    const secureCall = errorSpy.mock.calls.find(([message]) =>
      message.includes('Credentials update')
    );
    expect(secureCall?.[0]).toContain('[MASKED]');
    expect(secureCall?.[0]).not.toContain('abcd1234');
    expect(secureCall?.[0]).not.toContain('zzz999');

    const { default: EnhancedConsoleLogger } = module;
    const freshLogger = new EnhancedConsoleLogger();
    freshLogger.debug('secondary logger activity', { cacheSecret: 'to-hide' });
    expect(
      debugSpy.mock.calls.some(([message]) =>
        message.includes('secondary logger activity')
      )
    ).toBe(true);
  });
});
