/**
 * @file enhanced-console-logger-import-resolution.integration.test.js
 * @description Ensures the enhanced console logger correctly discovers Chalk through
 *              legacy global fallbacks and CommonJS default exports while exercising
 *              its sanitisation and formatting behaviour with real collaborators.
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
const ORIGINAL_GLOBAL_THIS = global.globalThis;
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

describe('Enhanced console logger Chalk discovery integration', () => {
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
      global.globalThis = ORIGINAL_GLOBAL_THIS;
    }
  });

  it('uses Chalk from the legacy global object when globalThis is unavailable', async () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const globalChalk = {
      blue: jest.fn((text) => `blue:${text}`),
      green: jest.fn((text) => `green:${text}`),
      yellow: jest.fn((text) => `yellow:${text}`),
      red: Object.assign(
        jest.fn((text) => `red:${text}`),
        { bold: jest.fn((text) => `bold-red:${text}`) }
      ),
      cyan: jest.fn((text) => `cyan:${text}`),
      gray: Object.assign(
        jest.fn((text) => `gray:${text}`),
        { italic: jest.fn((text) => `italic-gray:${text}`) }
      ),
    };

    global.chalk = globalChalk;
    global.globalThis = undefined;

    let logger;
    try {
      const module = await import('../../src/logging/enhancedConsoleLogger.js');
      logger = module.getEnhancedConsoleLogger();
    } finally {
      global.globalThis = ORIGINAL_GLOBAL_THIS;
    }

    logger.info('Legacy global chalk path engaged', {
      service: 'global-check',
    });
    logger.debug('Colour spectrum');

    expect(globalChalk.blue).toHaveBeenCalledWith('test');
    expect(globalChalk.green).toHaveBeenCalled();
    expect(globalChalk.cyan).toHaveBeenCalled();
    expect(globalChalk.gray.italic).toHaveBeenCalled();

    expect(warnSpy).not.toHaveBeenCalledWith(
      'EnhancedConsoleLogger: Chalk not available, falling back to plain text'
    );

    const infoOutput = infoSpy.mock.calls.at(-1)?.[0] ?? '';
    const debugOutput = debugSpy.mock.calls.at(-1)?.[0] ?? '';
    expect(infoOutput).toContain('green:');
    expect(debugOutput).toContain('cyan:');
  });

  it("accepts CommonJS default exports from require('chalk') without downgrading formatting", async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const chalkDefault = {
      blue: jest.fn((text) => `blue:${text}`),
      green: jest.fn((text) => `green:${text}`),
      yellow: jest.fn((text) => `yellow:${text}`),
      red: Object.assign(
        jest.fn((text) => `red:${text}`),
        { bold: jest.fn((text) => `bold-red:${text}`) }
      ),
      cyan: jest.fn((text) => `cyan:${text}`),
      gray: Object.assign(
        jest.fn((text) => `gray:${text}`),
        { italic: jest.fn((text) => `italic-gray:${text}`) }
      ),
    };

    jest.doMock('chalk', () => ({ default: chalkDefault }));

    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.warn('Default export path check', {
      apiKey: 'sk-test-1234567890',
      nested: { token: 'embedded-secret' },
    });

    expect(chalkDefault.blue).toHaveBeenCalled();
    expect(chalkDefault.yellow).toHaveBeenCalled();
    expect(chalkDefault.gray.italic).toHaveBeenCalled();

    const warnOutput = warnSpy.mock.calls.at(-1)?.[0] ?? '';
    expect(warnOutput).toContain('yellow:WARN');
    expect(warnOutput).not.toContain('sk-test-1234567890');
    expect(warnOutput).not.toContain('embedded-secret');
    expect(warnOutput).toContain('[MASKED]');

    expect(infoSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Chalk not available')
    );
  });
});
