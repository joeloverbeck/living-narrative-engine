/**
 * @file logging-formatter-max-length-guards.integration.test.js
 * @description Ensures the log formatter honors guard rails around the
 *              configured maximum message length when working with the real
 *              logger configuration singleton. The suite exercises the
 *              integration between the formatter and configuration to cover
 *              branches that skip truncation when limits are disabled or
 *              invalidated.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

const resetEnv = () => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.LOG_ENHANCED_FORMATTING;
  delete process.env.LOG_CONTEXT_PRETTY_PRINT;
  delete process.env.LOG_ICON_MODE;
  delete process.env.LOG_MAX_MESSAGE_LENGTH;
  delete process.env.LOG_FORCE_EMOJI;
  delete process.env.LOG_DISABLE_EMOJI;
  delete process.env.LOG_COLOR_MODE;
};

const importFormatterWithConfig = async () => {
  jest.resetModules();
  const [formatterModule, configurationModule] = await Promise.all([
    import('../../src/logging/logFormatter.js'),
    import('../../src/logging/loggerConfiguration.js'),
  ]);

  return {
    getLogFormatter: formatterModule.getLogFormatter,
    getLoggerConfiguration: configurationModule.getLoggerConfiguration,
  };
};

describe('log formatter maximum length guard integration', () => {
  beforeEach(() => {
    resetEnv();
    delete global.chalk;
    delete globalThis.chalk;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetEnv();
    delete global.chalk;
    delete globalThis.chalk;
  });

  it('treats a zero configured maximum as pass-through and skips truncation entirely', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'false';
    process.env.LOG_MAX_MESSAGE_LENGTH = '0';

    const { getLogFormatter } = await importFormatterWithConfig();
    const formatter = getLogFormatter();

    const verboseMessage = `CacheService: ${'X'.repeat(250)}`;
    const formatted = formatter.formatMessage(
      'info',
      verboseMessage,
      { subsystem: 'cache', action: 'prime' },
      { debug: true }
    );

    expect(formatted.message).toBe(verboseMessage);
    expect(formatted.contextLines.length).toBeGreaterThan(0);
    expect(
      formatted.contextLines.some((line) => line.includes('↳ Details[0]: {'))
    ).toBe(true);
  });

  it('honors runtime configuration updates that remove numeric limits', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'false';
    process.env.LOG_MAX_MESSAGE_LENGTH = '120';

    const { getLogFormatter, getLoggerConfiguration } =
      await importFormatterWithConfig();
    const formatter = getLogFormatter();
    const configuration = getLoggerConfiguration();

    configuration.updateConfig({ maxMessageLength: undefined });

    const detailedMessage = `TraceRoutes: ${'Y'.repeat(320)}`;
    const formatted = formatter.formatMessage('info', detailedMessage, {
      subsystem: 'trace',
      path: '/traces/batch',
    });

    expect(formatted.message).toBe(detailedMessage);
    expect(formatted.contextLines[0]).toContain('↳ Context: {');
    expect(formatted.contextLines.some((line) => line.includes('path'))).toBe(
      true
    );
  });
});
