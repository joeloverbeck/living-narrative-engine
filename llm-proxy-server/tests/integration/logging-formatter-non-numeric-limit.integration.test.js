/**
 * @file logging-formatter-non-numeric-limit.integration.test.js
 * @description Ensures the enhanced log formatter gracefully handles runtime
 *              configuration updates that assign non-numeric values to the
 *              maximum message length by exercising the live formatter and
 *              logger configuration singletons together.
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

const importFormatterAndConfig = async () => {
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

describe('log formatter integration with non-numeric max length updates', () => {
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

  it('treats non-numeric maximum length overrides as pass-through without truncation', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_ENHANCED_FORMATTING = 'true';
    process.env.LOG_CONTEXT_PRETTY_PRINT = 'true';
    process.env.LOG_ICON_MODE = 'false';
    process.env.LOG_COLOR_MODE = 'never';
    process.env.LOG_MAX_MESSAGE_LENGTH = '24';

    const { getLogFormatter, getLoggerConfiguration } =
      await importFormatterAndConfig();

    const formatter = getLogFormatter();
    const configuration = getLoggerConfiguration();

    const verboseMessage = `TraceService: ${'Z'.repeat(120)}`;
    const baseline = formatter.formatMessage('info', verboseMessage, {
      subsystem: 'trace',
      action: 'hydrate-cache',
    });

    expect(baseline.message.endsWith('...')).toBe(true);
    expect(
      baseline.contextLines.some((line) => line.includes('↳ Context: {'))
    ).toBe(true);

    configuration.updateConfig({ maxMessageLength: 'non-numeric-length' });

    const preserved = formatter.formatMessage('info', verboseMessage, {
      subsystem: 'trace',
      action: 'hydrate-cache',
    });

    expect(preserved.message).toBe(verboseMessage);
    expect(preserved.contextLines).toEqual(baseline.contextLines);
  });
});
