import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

/**
 * @file logging-formatter-string-context.integration.test.js
 * @description Exercises the log formatter's handling of primitive context
 *              values via the enhanced console logger to cover string-focused
 *              formatting branches.
 */

describe('Enhanced console logger string context integration', () => {
  const ORIGINAL_ENV = process.env;
  let infoSpy;
  let warnSpy;
  let originalChalk;

  beforeEach(() => {
    jest.resetModules();

    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'development',
      LOG_ENHANCED_FORMATTING: 'true',
      LOG_CONTEXT_PRETTY_PRINT: 'true',
      LOG_COLOR_MODE: 'never',
      LOG_ICON_MODE: 'false',
    };

    originalChalk = globalThis.chalk;
    const stubChalk = {
      cyan: (value) => String(value),
      green: (value) => String(value),
      yellow: (value) => String(value),
      red: Object.assign((value) => String(value), {
        bold: (value) => String(value),
      }),
      gray: Object.assign((value) => String(value), {
        italic: (value) => String(value),
      }),
      blue: (value) => String(value),
    };
    globalThis.chalk = stubChalk;

    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();

    if (originalChalk === undefined) {
      delete globalThis.chalk;
    } else {
      globalThis.chalk = originalChalk;
    }

    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('renders primitive context strings as inline context annotations', async () => {
    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.info('Context string evaluation', 'trace-id=abc123');

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [output] = infoSpy.mock.calls[0];

    expect(output).toContain('Context string evaluation');
    expect(output).toContain('↳ Details[0]: trace-id=abc123');
    expect(output).not.toContain('Details[0]: {');
  });

  it('masks sensitive tokens inside primitive context strings', async () => {
    const { getEnhancedConsoleLogger } = await import(
      '../../src/logging/enhancedConsoleLogger.js'
    );
    const logger = getEnhancedConsoleLogger();

    logger.info(
      'Masking primitive context',
      'apiKey=sk-1234567890abcdef123456'
    );

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [output] = infoSpy.mock.calls[0];

    expect(output).toContain('Masking primitive context');
    expect(output).toMatch(/Details\[0]: apiK\*+/);
    expect(output).not.toContain('sk-1234567890abcdef123456');
  });
});
