/**
 * @file enhanced-console-logger-default-level.integration.test.js
 * @description Exercises EnhancedConsoleLogger fallback behaviour when an
 *              unexpected log level is routed through the console API and
 *              verifies that the secure wrapper continues to mask sensitive
 *              context fields using the real formatter/configuration stack.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import EnhancedConsoleLogger from '../../src/logging/enhancedConsoleLogger.js';

const ORIGINAL_ENV = { ...process.env };
const stdoutDescriptor = Object.getOwnPropertyDescriptor(
  process.stdout,
  'isTTY'
);
const stderrDescriptor = Object.getOwnPropertyDescriptor(
  process.stderr,
  'isTTY'
);

function setColorCapabilities() {
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

describe('EnhancedConsoleLogger unconventional level routing integration', () => {
  let originalConsole; // eslint-disable-line @typescript-eslint/init-declarations

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_COLOR_MODE = 'always';
    process.env.LOG_FORCE_EMOJI = 'true';
    process.env.LOG_ICON_MODE = 'true';

    setColorCapabilities();

    const stableChalk = {
      blue: (value) => value,
      green: (value) => value,
      yellow: (value) => value,
      cyan: (value) => value,
      red: Object.assign((value) => value, {
        bold: (value) => value,
      }),
      gray: Object.assign((value) => value, {
        italic: (value) => value,
      }),
    };

    originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    globalThis.chalk = stableChalk;
    if (typeof global !== 'undefined') {
      global.chalk = stableChalk;
    }
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };

    if (stdoutDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', stdoutDescriptor);
    }

    if (stderrDescriptor) {
      Object.defineProperty(process.stderr, 'isTTY', stderrDescriptor);
    }

    if (originalConsole) {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.debug = originalConsole.debug;
    }

    delete globalThis.chalk;
    if (typeof global !== 'undefined') {
      delete global.chalk;
    }

    jest.restoreAllMocks();
  });

  it('falls back to console.log when the target console method is unavailable', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const logger = new EnhancedConsoleLogger();

    console.info = undefined; // trigger the catch branch by removing console.info

    logger.info('ApiKeyService: dispatching credentials', {
      apiKey: 'sk-1234567890FAKEKEY',
      nested: { token: 'internal-secret' },
    });

    expect(errorSpy).toHaveBeenCalledWith(
      'EnhancedConsoleLogger: Formatting error, falling back to simple output'
    );

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [fallbackMessage, contextObject] = logSpy.mock.calls[0];

    expect(fallbackMessage).toBe(
      '[FALLBACK] INFO: ApiKeyService: dispatching credentials'
    );
    expect(contextObject).toEqual({
      apiKey: 'sk-1234567890FAKEKEY',
      nested: { token: 'internal-secret' },
    });
  });

  it('uses the secure logger wrapper to mask nested secret values in context', () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const logger = new EnhancedConsoleLogger();
    const secureLogger = logger.createSecure();

    secureLogger.info('SecurityService: validating session', {
      apiKey: 'sk-THIS-IS-A-DEMO-KEY',
      nested: {
        token: 'should-not-leak',
        safe: 'ok',
      },
    });

    const emitted = infoSpy.mock.calls.map(([line]) => line).join('\n');

    expect(emitted).toContain('SecurityService: validating session');
    expect(emitted).toContain('[MASKED]');
    expect(emitted).not.toContain('should-not-leak');
    expect(emitted).not.toContain('sk-THIS-IS-A-DEMO-KEY');
    expect(emitted).toContain('safe');
  });
});
