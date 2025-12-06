/**
 * @file enhanced-console-logger-chalk-compat.integration.test.js
 * @description Integration coverage validating chalk initialisation fallbacks for the enhanced
 *              console logger when interacting with the real formatter and configuration modules.
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
const originalGlobalChalk =
  typeof globalThis !== 'undefined' ? globalThis.chalk : undefined;
const originalGlobalChalkAlias =
  typeof global !== 'undefined' && global !== globalThis
    ? global.chalk
    : undefined;

describe('Enhanced console logger chalk initialisation integration', () => {
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

    if (originalGlobalChalk === undefined) {
      delete globalThis.chalk;
    } else {
      globalThis.chalk = originalGlobalChalk;
    }

    if (typeof global !== 'undefined') {
      if (originalGlobalChalkAlias === undefined) {
        delete global.chalk;
      } else {
        global.chalk = originalGlobalChalkAlias;
      }
    }

    jest.restoreAllMocks();
  });

  test('falls back to plain text output when only legacy global chalk is present and fails self-test', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_COLOR_MODE = 'always';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_MAX_MESSAGE_LENGTH = '0';

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const stubChalk = {
      blue: () => {
        throw new Error('chalk self-test failure');
      },
    };

    if (typeof global !== 'undefined') {
      global.chalk = stubChalk;
    }

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    const message = `MetricsService: verifying fallback behaviour ${'X'.repeat(48)}`;
    logger.info(message, {
      apiKey: 'sk-abc1234567890',
      nested: { token: 'secret-token' },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'EnhancedConsoleLogger: Chalk not available, falling back to plain text'
    );
    expect(infoSpy).toHaveBeenCalledTimes(1);

    const [plainOutput] = infoSpy.mock.calls[0];
    expect(plainOutput).toContain(message);
    expect(plainOutput).not.toContain('\u001b[');
    expect(plainOutput.match(/\[MASKED]/g)?.length).toBeGreaterThanOrEqual(1);
  });

  test('loads chalk via require default export and emits coloured pretty logs', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_COLOR_MODE = 'always';
    process.env.LOG_ICON_MODE = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';

    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

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

    if (typeof global !== 'undefined') {
      global.chalk = Object.assign({}, stubChalk, { default: stubChalk });
    }

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.debug('CacheService: live metrics sample', {
      correlationId: 'req-1234',
      duration: 42,
    });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledTimes(1);

    const [colouredOutput] = debugSpy.mock.calls[0];
    expect(colouredOutput).toContain('CacheService: live metrics sample');
    expect(colouredOutput).toMatch(/\u001b\[[0-9;]*m/);

    const secureLogger = logger.createSecure();
    secureLogger.info('ApiKeyService: storing credentials', {
      apiKey: 'abcd1234',
    });

    const secureCall = infoSpy.mock.calls.find(([line]) =>
      line.includes('ApiKeyService: storing credentials')
    );
    expect(secureCall?.[0]).toContain('[MASKED]');
    expect(secureCall?.[0]).not.toContain('abcd1234');
  });
});
