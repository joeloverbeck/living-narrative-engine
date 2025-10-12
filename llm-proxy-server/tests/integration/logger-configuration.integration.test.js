/**
 * @file logger-configuration.integration.test.js
 * @description Exercises the logger configuration singleton together with the
 *              enhanced console logger and formatter to provide near-complete
 *              integration coverage for environment driven logging behavior.
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterEach,
  jest,
} from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };
let originalStdoutIsTTY;
let originalStderrIsTTY;

const resetEnvironment = () => {
  process.env = { ...ORIGINAL_ENV };
  process.stdout.isTTY = originalStdoutIsTTY;
  process.stderr.isTTY = originalStderrIsTTY;
};

const loadConfiguration = async ({ env = {}, stdoutTTY, stderrTTY } = {}) => {
  jest.resetModules();

  process.env = { ...ORIGINAL_ENV, ...env };

  if (stdoutTTY !== undefined) {
    process.stdout.isTTY = stdoutTTY;
  }

  if (stderrTTY !== undefined) {
    process.stderr.isTTY = stderrTTY;
  }

  const { getLoggerConfiguration } = await import(
    '../../src/logging/loggerConfiguration.js'
  );

  return getLoggerConfiguration();
};

const loadLoggerWithConfiguration = async ({
  env = {},
  stdoutTTY,
  stderrTTY,
} = {}) => {
  jest.resetModules();

  process.env = { ...ORIGINAL_ENV, ...env };

  if (stdoutTTY !== undefined) {
    process.stdout.isTTY = stdoutTTY;
  }

  if (stderrTTY !== undefined) {
    process.stderr.isTTY = stderrTTY;
  }

  const { getLoggerConfiguration } = await import(
    '../../src/logging/loggerConfiguration.js'
  );
  const { getEnhancedConsoleLogger } = await import(
    '../../src/logging/enhancedConsoleLogger.js'
  );

  return {
    configuration: getLoggerConfiguration(),
    logger: getEnhancedConsoleLogger(),
  };
};

describe('logger configuration integration coverage', () => {
  beforeAll(() => {
    originalStdoutIsTTY = process.stdout.isTTY;
    originalStderrIsTTY = process.stderr.isTTY;
  });

  afterEach(() => {
    resetEnvironment();
    jest.resetModules();
  });

  test('derives rich configuration when TTY is available in development', async () => {
    const config = await loadConfiguration({
      env: {
        NODE_ENV: 'development',
        LOG_COLOR_MODE: 'auto',
      },
      stdoutTTY: true,
      stderrTTY: true,
    });

    expect(config.isDevelopment()).toBe(true);
    expect(config.isProduction()).toBe(false);
    expect(config.isColorsEnabled()).toBe(true);
    expect(config.isIconsEnabled()).toBe(true);
    expect(config.shouldShowContext()).toBe(true);
    expect(config.getConfig().environment).toBe('development');
  });

  test('disables rich options when running headless in production', async () => {
    const config = await loadConfiguration({
      env: {
        NODE_ENV: 'production',
        LOG_COLOR_MODE: 'auto',
        LOG_ICON_MODE: 'false',
        LOG_ENHANCED_FORMATTING: 'false',
        LOG_CONTEXT_PRETTY_PRINT: 'false',
      },
      stdoutTTY: false,
      stderrTTY: false,
    });

    expect(config.isProduction()).toBe(true);
    expect(config.isColorsEnabled()).toBe(false);
    expect(config.isIconsEnabled()).toBe(false);
    expect(config.isPrettyFormatEnabled()).toBe(false);
    expect(config.shouldShowContext()).toBe(false);
    expect(config.getMaxMessageLength()).toBe(200);
  });

  test('respects explicit color mode overrides regardless of TTY', async () => {
    const alwaysConfig = await loadConfiguration({
      env: {
        NODE_ENV: 'production',
        LOG_COLOR_MODE: 'always',
      },
      stdoutTTY: false,
      stderrTTY: false,
    });

    expect(alwaysConfig.isColorsEnabled()).toBe(true);

    const neverConfig = await loadConfiguration({
      env: {
        NODE_ENV: 'development',
        LOG_COLOR_MODE: 'never',
      },
      stdoutTTY: true,
      stderrTTY: true,
    });

    expect(neverConfig.isColorsEnabled()).toBe(false);
  });

  test('falls back based on environment when TTY metadata is missing', async () => {
    const devConfig = await loadConfiguration({
      env: {
        NODE_ENV: 'staging',
        LOG_COLOR_MODE: 'auto',
      },
      stdoutTTY: undefined,
      stderrTTY: undefined,
    });

    expect(devConfig.isColorsEnabled()).toBe(true);

    const prodConfig = await loadConfiguration({
      env: {
        NODE_ENV: 'production',
        LOG_COLOR_MODE: 'auto',
      },
      stdoutTTY: undefined,
      stderrTTY: undefined,
    });

    expect(prodConfig.isColorsEnabled()).toBe(false);
  });

  test('parses boolean and numeric environment values with fallbacks', async () => {
    const config = await loadConfiguration({
      env: {
        NODE_ENV: 'development',
        LOG_ICON_MODE: 'TRUE',
        LOG_ENHANCED_FORMATTING: 'false',
        LOG_CONTEXT_PRETTY_PRINT: 'true',
        LOG_TIMESTAMP_FORMAT: 'YYYY-MM-DD HH:mm',
        LOG_MAX_MESSAGE_LENGTH: '512',
        LOG_FORCE_EMOJI: 'true',
        LOG_DISABLE_EMOJI: 'false',
      },
      stdoutTTY: true,
      stderrTTY: true,
    });

    expect(config.isIconsEnabled()).toBe(true);
    expect(config.isPrettyFormatEnabled()).toBe(false);
    expect(config.shouldShowContext()).toBe(true);
    expect(config.getTimestampFormat()).toBe('YYYY-MM-DD HH:mm');
    expect(config.getMaxMessageLength()).toBe(512);

    const snapshot = config.getConfig();
    expect(snapshot.forceEmoji).toBe(true);
    expect(snapshot.disableEmoji).toBe(false);

    const fallbackConfig = await loadConfiguration({
      env: {
        NODE_ENV: 'production',
        LOG_MAX_MESSAGE_LENGTH: 'not-a-number',
      },
      stdoutTTY: true,
      stderrTTY: true,
    });

    expect(fallbackConfig.getMaxMessageLength()).toBe(200);
  });

  test('supports runtime configuration updates and immutable snapshots', async () => {
    const config = await loadConfiguration({
      env: {
        NODE_ENV: 'development',
        LOG_ICON_MODE: 'true',
      },
      stdoutTTY: true,
      stderrTTY: true,
    });

    config.updateConfig({
      enableIcons: false,
      prettyFormat: false,
      showContext: false,
      enableColors: false,
      customFlag: true,
    });

    expect(config.isIconsEnabled()).toBe(false);
    expect(config.isPrettyFormatEnabled()).toBe(false);
    expect(config.shouldShowContext()).toBe(false);
    expect(config.isColorsEnabled()).toBe(false);

    const snapshot = config.getConfig();
    expect(snapshot.customFlag).toBe(true);

    snapshot.enableIcons = true;
    expect(config.isIconsEnabled()).toBe(false);
  });

  test('enhanced console logger reflects configuration toggles end-to-end', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { configuration, logger } = await loadLoggerWithConfiguration({
      env: {
        NODE_ENV: 'development',
        LOG_COLOR_MODE: 'never',
        LOG_ENHANCED_FORMATTING: 'true',
        LOG_CONTEXT_PRETTY_PRINT: 'true',
        LOG_ICON_MODE: 'true',
        LOG_FORCE_EMOJI: 'false',
        LOG_DISABLE_EMOJI: 'true',
      },
      stdoutTTY: true,
      stderrTTY: true,
    });

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    logger.info('Integration log message', {
      requestId: 'abc123',
      nested: { example: true },
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const prettyOutput = infoSpy.mock.calls[0][0];
    expect(prettyOutput).toContain('Integration log message');
    expect(prettyOutput).toContain('requestId');
    expect(prettyOutput).toContain('\n');

    configuration.updateConfig({ prettyFormat: false, showContext: false });

    infoSpy.mockClear();
    logger.info('Second log entry', { requestId: 'abc123' });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const simpleOutput = infoSpy.mock.calls[0][0];
    expect(simpleOutput).toContain('Second log entry');
    expect(simpleOutput).not.toContain('\n');
    expect(simpleOutput).toContain('{"requestId":"abc123"}');

    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
