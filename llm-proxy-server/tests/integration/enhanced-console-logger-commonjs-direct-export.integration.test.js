/**
 * @file enhanced-console-logger-commonjs-direct-export.integration.test.js
 * @description Ensures the enhanced console logger handles CommonJS modules that
 *              export Chalk without a `default` property, exercising the branch
 *              where the module is used directly. Verifies sanitisation and
 *              formatting when chalk is discovered via `require('chalk')`.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_STDOUT_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  process.stdout,
  'isTTY'
);
const ORIGINAL_STDERR_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  process.stderr,
  'isTTY'
);

const enablePrettyLoggingEnv = () => {
  process.env.NODE_ENV = 'development';
  process.env.LOG_ENHANCED_FORMATTING = 'true';
  process.env.LOG_COLOR_MODE = 'always';
  process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
};

describe('Enhanced console logger CommonJS require interop', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();

    process.env = { ...ORIGINAL_ENV };
    enablePrettyLoggingEnv();

    if (ORIGINAL_STDOUT_DESCRIPTOR?.configurable) {
      Object.defineProperty(process.stdout, 'isTTY', {
        configurable: true,
        value: true,
      });
    }

    if (ORIGINAL_STDERR_DESCRIPTOR?.configurable) {
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
    jest.dontMock('chalk');
    jest.resetModules();

    process.env = ORIGINAL_ENV;

    if (ORIGINAL_STDOUT_DESCRIPTOR) {
      Object.defineProperty(
        process.stdout,
        'isTTY',
        ORIGINAL_STDOUT_DESCRIPTOR
      );
    }

    if (ORIGINAL_STDERR_DESCRIPTOR) {
      Object.defineProperty(
        process.stderr,
        'isTTY',
        ORIGINAL_STDERR_DESCRIPTOR
      );
    }

    delete globalThis.chalk;
    if (typeof global !== 'undefined') {
      delete global.chalk;
    }
  });

  it('uses require("chalk") modules without default exports directly', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const commonJsChalk = {
      blue: jest.fn((value) => `blue:${value}`),
      green: jest.fn((value) => `green:${value}`),
      yellow: jest.fn((value) => `yellow:${value}`),
      red: Object.assign(
        jest.fn((value) => `red:${value}`),
        {
          bold: jest.fn((value) => `bold-red:${value}`),
        }
      ),
      cyan: jest.fn((value) => `cyan:${value}`),
      gray: Object.assign(
        jest.fn((value) => `gray:${value}`),
        {
          italic: jest.fn((value) => `italic-gray:${value}`),
        }
      ),
    };

    jest.doMock('chalk', () => commonJsChalk);

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.error('Direct CommonJS chalk usage', {
      apiKey: 'sk-live-secret-key',
      nested: { password: 'p@ssw0rd' },
    });

    expect(commonJsChalk.blue).toHaveBeenCalledWith('test');
    expect(commonJsChalk.red.bold).toHaveBeenCalledWith('ERROR');
    expect(commonJsChalk.gray.italic).toHaveBeenCalled();

    expect(warnSpy).not.toHaveBeenCalledWith(
      'EnhancedConsoleLogger: Chalk not available, falling back to plain text'
    );

    expect(errorSpy).toHaveBeenCalled();
    const formatted = errorSpy.mock.calls.at(-1)?.[0] ?? '';
    expect(formatted).toContain('bold-red:ERROR');
    expect(formatted).toContain('[MASKED]');
    expect(formatted).not.toContain('sk-live-secret-key');
    expect(formatted).not.toContain('p@ssw0rd');
  });
});
