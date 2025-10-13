/**
 * @file enhanced-console-logger-fallback.integration.test.js
 * @description Additional integration coverage focusing on fallback behaviour when
 *              color utilities are unavailable and when development helpers should
 *              remain inactive in production environments.
 */

import { jest } from '@jest/globals';

const ORIGINAL_ENV = process.env;
const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
const stderrDescriptor = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');

/**
 * @description Exercises resilience branches that were previously uncovered by ensuring
 * the enhanced logger interacts with the real formatter, configuration, and secure logger
 * helpers without relying on mocks for those collaborators.
 */
describe('Enhanced console logger fallback integration behaviour', () => {
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

    delete globalThis.chalk;
    if (typeof global !== 'undefined') {
      delete global.chalk;
    }

    jest.restoreAllMocks();
  });

  test('falls back to plain formatting when chalk initialisation fails and sanitises mixed payloads', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_COLOR_MODE = 'always';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const unstableChalk = {
      blue: () => {
        throw new Error('chalk-unavailable');
      },
      green: (value) => `green:${value}`,
      yellow: (value) => `yellow:${value}`,
      red: Object.assign((value) => `red:${value}`, {
        bold: (value) => `bold-red:${value}`,
      }),
      cyan: (value) => `cyan:${value}`,
      gray: Object.assign((value) => `gray:${value}`, {
        italic: (value) => `italic-gray:${value}`,
      }),
    };

    unstableChalk.default = unstableChalk;
    globalThis.chalk = unstableChalk;
    if (typeof global !== 'undefined') {
      global.chalk = unstableChalk;
    }

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.info('Processing inbound request', 'apiKey=sk-live-secret', 42, {
      nested: { token: 'abc123', password: 'letmein' },
      list: ['retain-me'],
    });

    expect(warnSpy).toHaveBeenCalled();
    const fallbackWarning = warnSpy.mock.calls.find(([message]) =>
      message.includes('EnhancedConsoleLogger: Chalk not available')
    );
    expect(fallbackWarning).toBeDefined();

    expect(infoSpy).toHaveBeenCalled();
    const infoOutput = infoSpy.mock.calls.at(-1)[0];
    expect(infoOutput).toContain('Processing inbound request');
    expect(infoOutput).not.toContain('sk-live-secret');
    expect(infoOutput).not.toContain('abc123');
    expect(infoOutput).not.toContain('letmein');
    expect(infoOutput).toContain('[MASKED]');
    expect(infoOutput).toContain('42');

    const secureLogger = logger.createSecure();
    secureLogger.error('Secure stream forwarding', {
      secret: 'do-not-leak',
      nested: { token: 'secure-token', value: 123 },
    });

    const secureError = errorSpy.mock.calls.find(([message]) =>
      message.includes('Secure stream forwarding')
    );
    expect(secureError?.[0]).toContain('[MASKED]');
    expect(secureError?.[0]).not.toContain('do-not-leak');
    expect(secureError?.[0]).not.toContain('secure-token');
  });

  test('skips development showcase output when not running in development mode', async () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_ENHANCED_FORMATTING = 'false';

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.testOutput();

    expect(logSpy).not.toHaveBeenCalled();
  });
});
