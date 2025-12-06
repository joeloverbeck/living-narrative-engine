/**
 * @file enhanced-console-logger-hardening.integration.test.js
 * @description Covers edge-case branches of the enhanced console logger where
 *              chalk detection fails due to property access errors. Exercises
 *              sanitisation and fallback formatting while using the real
 *              formatter, configuration, and secure logger helpers.
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

/**
 * Ensures the terminal descriptors emulate a TTY so the logger attempts to use
 * colourised output before the fallback is triggered.
 */
function configureTty() {
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
}

describe('Enhanced console logger property access resilience', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    configureTty();
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

  test('falls back cleanly when chalk property access throws during capability probing', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_COLOR_MODE = 'always';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const unstableChalk = {};
    Object.defineProperty(unstableChalk, 'blue', {
      get() {
        throw new Error('chalk getter failure');
      },
    });
    unstableChalk.green = (value) => `green:${value}`;
    unstableChalk.yellow = (value) => `yellow:${value}`;
    unstableChalk.cyan = (value) => `cyan:${value}`;
    unstableChalk.red = Object.assign((value) => `red:${value}`, {
      bold: (value) => `bold-red:${value}`,
    });
    unstableChalk.gray = Object.assign((value) => `gray:${value}`, {
      italic: (value) => `italic-gray:${value}`,
    });

    globalThis.chalk = unstableChalk;
    if (typeof global !== 'undefined') {
      global.chalk = unstableChalk;
    }

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.info('Starting secure session', 'apiKey=sk-live-secret', {
      nested: { token: 'top-secret', password: 'hunter2' },
      meta: ['preserve-me'],
    });

    expect(
      warnSpy.mock.calls.some(([message]) =>
        message.includes('EnhancedConsoleLogger: Chalk not available')
      )
    ).toBe(true);

    expect(infoSpy).toHaveBeenCalled();
    const formattedOutput = infoSpy.mock.calls[0][0];
    expect(formattedOutput).toContain('Starting secure session');
    expect(formattedOutput).toContain('[MASKED]');
    expect(formattedOutput).not.toContain('sk-live-secret');
    expect(formattedOutput).not.toContain('top-secret');
    expect(formattedOutput).not.toContain('hunter2');
    expect(formattedOutput).not.toMatch(/\u001b\[/);

    const secureLogger = logger.createSecure();
    secureLogger.error('Secondary channel opened', {
      credentials: 'another-key',
      depth: { secret: 'keep-hidden' },
    });

    expect(errorSpy).toHaveBeenCalled();
    const secureOutput = errorSpy.mock.calls
      .map(([msg]) => msg)
      .find((msg) => msg.includes('Secondary channel opened'));
    expect(secureOutput).toBeDefined();
    expect(secureOutput).toContain('[MASKED]');
    expect(secureOutput).toContain('another-key');
    expect(secureOutput).not.toContain('keep-hidden');
  });
});
