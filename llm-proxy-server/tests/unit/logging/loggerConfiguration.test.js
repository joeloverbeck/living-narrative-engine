import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

describe('LoggerConfiguration', () => {
  let originalEnv;
  let originalStdout;
  let originalStderr;
  let stdoutDescriptor;
  let stderrDescriptor;

  beforeEach(() => {
    // Store original environment and streams
    originalEnv = { ...process.env };
    originalStdout = process.stdout.isTTY;
    originalStderr = process.stderr.isTTY;
    stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    stderrDescriptor = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');

    // Clear require cache to get fresh instances
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment and streams
    process.env = originalEnv;
    if (stdoutDescriptor) {
      Object.defineProperty(process.stdout, 'isTTY', stdoutDescriptor);
    } else {
      process.stdout.isTTY = originalStdout;
    }

    if (stderrDescriptor) {
      Object.defineProperty(process.stderr, 'isTTY', stderrDescriptor);
    } else {
      process.stderr.isTTY = originalStderr;
    }
  });

  describe('Configuration Loading', () => {
    it('should load default configuration in development', async () => {
      process.env.NODE_ENV = 'development';
      process.stdout.isTTY = true;
      process.stderr.isTTY = true;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(true);
      expect(config.isIconsEnabled()).toBe(true);
      expect(config.isPrettyFormatEnabled()).toBe(true);
      expect(config.shouldShowContext()).toBe(true);
      expect(config.isDevelopment()).toBe(true);
      expect(config.isProduction()).toBe(false);
    });

    it('should load production configuration', async () => {
      process.env.NODE_ENV = 'production';
      process.stdout.isTTY = false;
      process.stderr.isTTY = false;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(false);
      expect(config.isIconsEnabled()).toBe(false);
      expect(config.isPrettyFormatEnabled()).toBe(false);
      expect(config.shouldShowContext()).toBe(false);
      expect(config.isDevelopment()).toBe(false);
      expect(config.isProduction()).toBe(true);
    });

    it('should default to development when NODE_ENV is not set', async () => {
      delete process.env.NODE_ENV;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isDevelopment()).toBe(true);
      expect(config.getConfig().environment).toBe('development');
    });
  });

  describe('Color Mode Configuration', () => {
    it('should enable colors with LOG_COLOR_MODE=always', async () => {
      process.env.LOG_COLOR_MODE = 'always';
      process.env.NODE_ENV = 'production';
      process.stdout.isTTY = false;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(true);
    });

    it('should disable colors with LOG_COLOR_MODE=never', async () => {
      process.env.LOG_COLOR_MODE = 'never';
      process.env.NODE_ENV = 'development';
      process.stdout.isTTY = true;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(false);
    });

    it('should auto-detect colors with LOG_COLOR_MODE=auto in development', async () => {
      process.env.LOG_COLOR_MODE = 'auto';
      process.env.NODE_ENV = 'development';
      process.stdout.isTTY = true;
      process.stderr.isTTY = true;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(true);
    });

    it('should auto-detect colors with LOG_COLOR_MODE=auto in production', async () => {
      process.env.LOG_COLOR_MODE = 'auto';
      process.env.NODE_ENV = 'production';
      process.stdout.isTTY = true;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(false);
    });

    it('should handle missing LOG_COLOR_MODE (default to auto)', async () => {
      delete process.env.LOG_COLOR_MODE;
      process.env.NODE_ENV = 'development';
      process.stdout.isTTY = true;
      process.stderr.isTTY = true;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(true);
    });

    it('should disable colors when no TTY available', async () => {
      process.env.NODE_ENV = 'development';
      process.stdout.isTTY = false;
      process.stderr.isTTY = false;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(false);
    });
  });

  describe('TTY detection fallbacks', () => {
    it('should treat missing TTY flags as TTY in development environments', async () => {
      process.env.NODE_ENV = 'development';
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(process.stderr, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(true);
    });

    it('should treat missing TTY flags as non-TTY in production environments', async () => {
      process.env.NODE_ENV = 'production';
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(process.stderr, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(false);
    });

    it('should handle missing stderr TTY when stdout is present', async () => {
      process.env.NODE_ENV = 'development';
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(process.stderr, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(true);
    });

    it('evaluates fallback branch when stderr TTY is undefined but stdout reports TTY', async () => {
      process.env.NODE_ENV = 'production';

      const stdoutSpy = jest.fn(() => true);
      const stderrSpy = jest.fn(() => undefined);

      Object.defineProperty(process.stdout, 'isTTY', {
        get: stdoutSpy,
        configurable: true,
      });

      Object.defineProperty(process.stderr, 'isTTY', {
        get: stderrSpy,
        configurable: true,
      });

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(false);
      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      expect(stderrSpy).toHaveBeenCalledTimes(1);
    });

    it('treats production environment with defined stdout and undefined stderr as non-TTY', async () => {
      process.env.NODE_ENV = 'production';
      process.stdout.isTTY = true;
      process.stderr.isTTY = undefined;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(false);
    });

    it('treats missing TTY descriptors in production as non-TTY for coverage fallback', async () => {
      process.env.NODE_ENV = 'production';

      // Override the descriptors entirely to exercise the fallback branch that
      // defaults to development behaviour unless explicitly in production.
      // The afterEach hook restores the original descriptors from the saved
      // metadata captured during setup.
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(process.stderr, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(false);
      expect(config.isDevelopment()).toBe(false);
      expect(config.isProduction()).toBe(true);
    });

    it('defaults to development mode when NODE_ENV is missing alongside absent TTY descriptors', async () => {
      process.env.NODE_ENV = '';
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(process.stderr, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(process.env.NODE_ENV).toBe('');

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isColorsEnabled()).toBe(true);
      expect(config.isDevelopment()).toBe(true);
      expect(config.isProduction()).toBe(false);
    });
  });

  describe('Boolean Environment Variable Parsing', () => {
    it('should parse LOG_ICON_MODE correctly', async () => {
      // Test true
      process.env.LOG_ICON_MODE = 'true';
      const { getLoggerConfiguration: getConfig1 } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config1 = getConfig1();
      expect(config1.isIconsEnabled()).toBe(true);

      jest.resetModules();

      // Test false
      process.env.LOG_ICON_MODE = 'false';
      const { getLoggerConfiguration: getConfig2 } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config2 = getConfig2();
      expect(config2.isIconsEnabled()).toBe(false);
    });

    it('should parse LOG_ENHANCED_FORMATTING correctly', async () => {
      process.env.LOG_ENHANCED_FORMATTING = 'false';

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.isPrettyFormatEnabled()).toBe(false);
    });

    it('should parse LOG_CONTEXT_PRETTY_PRINT correctly', async () => {
      process.env.LOG_CONTEXT_PRETTY_PRINT = 'false';

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.shouldShowContext()).toBe(false);
    });

    it('should handle undefined boolean environment variables', async () => {
      delete process.env.LOG_ICON_MODE;
      delete process.env.LOG_ENHANCED_FORMATTING;
      process.env.NODE_ENV = 'development';

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      // Should default to development defaults (true)
      expect(config.isIconsEnabled()).toBe(true);
      expect(config.isPrettyFormatEnabled()).toBe(true);
    });

    it('should parse LOG_FORCE_EMOJI and LOG_DISABLE_EMOJI', async () => {
      process.env.LOG_FORCE_EMOJI = 'true';
      process.env.LOG_DISABLE_EMOJI = 'false';

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();
      const fullConfig = config.getConfig();

      expect(fullConfig.forceEmoji).toBe(true);
      expect(fullConfig.disableEmoji).toBe(false);
    });
  });

  describe('Number Environment Variable Parsing', () => {
    it('should parse LOG_MAX_MESSAGE_LENGTH correctly', async () => {
      process.env.LOG_MAX_MESSAGE_LENGTH = '150';

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.getMaxMessageLength()).toBe(150);
    });

    it('should use default for invalid LOG_MAX_MESSAGE_LENGTH', async () => {
      process.env.LOG_MAX_MESSAGE_LENGTH = 'invalid-number';

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.getMaxMessageLength()).toBe(200); // default
    });

    it('should use default for undefined LOG_MAX_MESSAGE_LENGTH', async () => {
      delete process.env.LOG_MAX_MESSAGE_LENGTH;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.getMaxMessageLength()).toBe(200); // default
    });

    it('should handle edge case numeric values', async () => {
      // Test zero
      process.env.LOG_MAX_MESSAGE_LENGTH = '0';
      const { getLoggerConfiguration: getConfig1 } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config1 = getConfig1();
      expect(config1.getMaxMessageLength()).toBe(0);

      jest.resetModules();

      // Test negative number (should parse but might be handled differently)
      process.env.LOG_MAX_MESSAGE_LENGTH = '-100';
      const { getLoggerConfiguration: getConfig2 } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config2 = getConfig2();
      expect(config2.getMaxMessageLength()).toBe(-100);

      jest.resetModules();

      // Test floating point (should be parsed as integer)
      process.env.LOG_MAX_MESSAGE_LENGTH = '150.5';
      const { getLoggerConfiguration: getConfig3 } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config3 = getConfig3();
      expect(config3.getMaxMessageLength()).toBe(150);
    });
  });

  describe('Timestamp Format Configuration', () => {
    it('should use custom LOG_TIMESTAMP_FORMAT', async () => {
      process.env.LOG_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:mm:ss';

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.getTimestampFormat()).toBe('YYYY-MM-DD HH:mm:ss');
    });

    it('should use default timestamp format when not specified', async () => {
      delete process.env.LOG_TIMESTAMP_FORMAT;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      expect(config.getTimestampFormat()).toBe('HH:mm:ss.SSS');
    });
  });

  describe('Configuration Getters', () => {
    let config;

    beforeEach(async () => {
      jest.resetModules();
      process.env.NODE_ENV = 'development';
      process.env.LOG_MAX_MESSAGE_LENGTH = '250';
      process.env.LOG_TIMESTAMP_FORMAT = 'custom-format';
      process.stdout.isTTY = true;
      process.stderr.isTTY = true;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      config = getLoggerConfiguration();
    });

    it('should provide getConfig method returning full configuration', () => {
      const fullConfig = config.getConfig();

      expect(typeof fullConfig).toBe('object');
      expect(fullConfig.environment).toBe('development');
      expect(fullConfig.maxMessageLength).toBe(250);
      expect(fullConfig.timestampFormat).toBe('custom-format');

      // Should return a copy, not the original
      fullConfig.environment = 'modified';
      expect(config.getConfig().environment).toBe('development');
    });

    it('should provide individual getter methods', () => {
      expect(typeof config.isColorsEnabled).toBe('function');
      expect(typeof config.isIconsEnabled).toBe('function');
      expect(typeof config.isPrettyFormatEnabled).toBe('function');
      expect(typeof config.getTimestampFormat).toBe('function');
      expect(typeof config.getMaxMessageLength).toBe('function');
      expect(typeof config.shouldShowContext).toBe('function');
      expect(typeof config.isDevelopment).toBe('function');
      expect(typeof config.isProduction).toBe('function');

      // Test that methods return correct types
      expect(typeof config.isColorsEnabled()).toBe('boolean');
      expect(typeof config.isIconsEnabled()).toBe('boolean');
      expect(typeof config.isPrettyFormatEnabled()).toBe('boolean');
      expect(typeof config.getTimestampFormat()).toBe('string');
      expect(typeof config.getMaxMessageLength()).toBe('number');
      expect(typeof config.shouldShowContext()).toBe('boolean');
      expect(typeof config.isDevelopment()).toBe('boolean');
      expect(typeof config.isProduction()).toBe('boolean');
    });

    it('should handle development/production detection correctly', () => {
      expect(config.isDevelopment()).toBe(true);
      expect(config.isProduction()).toBe(false);
    });
  });

  describe('Configuration Updates', () => {
    let config;

    beforeEach(async () => {
      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      config = getLoggerConfiguration();
    });

    it('should allow runtime configuration updates', () => {
      const originalMax = config.getMaxMessageLength();

      config.updateConfig({ maxMessageLength: 500 });

      expect(config.getMaxMessageLength()).toBe(500);
      expect(config.getMaxMessageLength()).not.toBe(originalMax);
    });

    it('should partially update configuration', () => {
      const originalMax = config.getMaxMessageLength();

      config.updateConfig({ timestampFormat: 'new-format' });

      expect(config.getTimestampFormat()).toBe('new-format');
      expect(config.getMaxMessageLength()).toBe(originalMax); // unchanged
    });

    it('should handle multiple configuration updates', () => {
      config.updateConfig({
        maxMessageLength: 300,
        timestampFormat: 'format1',
      });

      expect(config.getMaxMessageLength()).toBe(300);
      expect(config.getTimestampFormat()).toBe('format1');

      config.updateConfig({
        maxMessageLength: 400,
        environment: 'test',
      });

      expect(config.getMaxMessageLength()).toBe(400);
      expect(config.getTimestampFormat()).toBe('format1'); // preserved
      expect(config.getConfig().environment).toBe('test');
    });

    it('should handle empty configuration updates', () => {
      const originalConfig = config.getConfig();

      config.updateConfig({});

      const newConfig = config.getConfig();
      expect(newConfig).toEqual(originalConfig);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', async () => {
      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );

      const config1 = getLoggerConfiguration();
      const config2 = getLoggerConfiguration();

      expect(config1).toBe(config2);
    });

    it('should maintain state across multiple imports', async () => {
      const { getLoggerConfiguration: getConfig1 } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config1 = getConfig1();

      config1.updateConfig({ maxMessageLength: 999 });

      // Re-import should return the same instance with updated state
      const { getLoggerConfiguration: getConfig2 } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config2 = getConfig2();

      expect(config2.getMaxMessageLength()).toBe(999);
      expect(config1).toBe(config2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed environment variables gracefully', async () => {
      // Reset modules first
      jest.resetModules();

      process.env.LOG_ICON_MODE = 'not-a-boolean';
      process.env.LOG_MAX_MESSAGE_LENGTH = 'not-a-number';
      process.env.NODE_ENV = 'development';
      process.stdout.isTTY = true;
      process.stderr.isTTY = true;

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      // Should fall back to defaults for invalid values
      expect(config.isIconsEnabled()).toBe(false); // 'not-a-boolean' parses to false
      expect(config.getMaxMessageLength()).toBe(200); // numeric default (invalid number uses default)
    });

    it('should handle missing TTY properties', async () => {
      jest.resetModules();

      // Remove TTY properties
      const originalStdout = process.stdout.isTTY;
      const originalStderr = process.stderr.isTTY;

      delete process.stdout.isTTY;
      delete process.stderr.isTTY;

      process.env.NODE_ENV = 'development';

      const { getLoggerConfiguration } = await import(
        '../../../src/logging/loggerConfiguration.js'
      );
      const config = getLoggerConfiguration();

      // Should not crash and should default to colors
      expect(config.isColorsEnabled()).toBe(true);

      // Restore TTY properties
      process.stdout.isTTY = originalStdout;
      process.stderr.isTTY = originalStderr;
    });

    it('should handle various NODE_ENV values', async () => {
      const testEnvironments = ['test', 'staging', 'prod', 'dev', 'local'];

      for (const env of testEnvironments) {
        jest.resetModules();
        process.env.NODE_ENV = env;
        process.stdout.isTTY = true;
        process.stderr.isTTY = true;

        const { getLoggerConfiguration } = await import(
          '../../../src/logging/loggerConfiguration.js'
        );
        const config = getLoggerConfiguration();

        expect(config.getConfig().environment).toBe(env);
        expect(config.isDevelopment()).toBe(env === 'development');
        expect(config.isProduction()).toBe(env === 'production');
      }
    });
  });
});
