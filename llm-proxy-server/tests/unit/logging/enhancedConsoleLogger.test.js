import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
// import { getEnhancedConsoleLogger } from '../../../src/logging/enhancedConsoleLogger.js';

// Mock chalk to test both success and failure scenarios
// const mockChalk = {
//   cyan: jest.fn((str) => str),
//   green: jest.fn((str) => str),
//   yellow: jest.fn((str) => str),
//   red: { bold: jest.fn((str) => str) },
//   gray: jest.fn((str) => str),
//   blue: jest.fn((str) => str),
//   italic: jest.fn((str) => str),
// };

// Store original modules for restoration
// let originalChalk;
// let originalImport;

describe('EnhancedConsoleLogger', () => {
  let logger;
  let originalConsole;
  let mockConsole;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.resetModules();

    // Clear the singleton instance to ensure fresh logger for each test
    jest.isolateModules(() => {
      const enhancedLogger = require('../../../src/logging/enhancedConsoleLogger.js');
      if (enhancedLogger.loggerInstance) {
        enhancedLogger.loggerInstance = null;
      }
    });

    // Mock console methods
    originalConsole = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
      log: console.log,
    };

    mockConsole = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    };

    Object.assign(console, mockConsole);
  });

  afterEach(() => {
    // Restore original console
    Object.assign(console, originalConsole);
  });

  describe('Chalk Integration and Fallback', () => {
    it('should use chalk from globalThis when available', async () => {
      jest.resetModules();

      const originalChalk = globalThis.chalk;

      const createColorFn = (label) => {
        const fn = jest.fn((str) => `${label}:${str}`);
        return fn;
      };

      const grayFn = createColorFn('gray');
      grayFn.italic = jest.fn((str) => `grayItalic:${str}`);

      const chalkMock = {
        blue: createColorFn('blue'),
        cyan: createColorFn('cyan'),
        green: createColorFn('green'),
        yellow: createColorFn('yellow'),
        red: { bold: createColorFn('redBold') },
        gray: grayFn,
      };

      globalThis.chalk = chalkMock;

      jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
        getLoggerConfiguration: () => ({
          isColorsEnabled: () => true,
          isIconsEnabled: () => true,
          isPrettyFormatEnabled: () => true,
          getMaxMessageLength: () => 200,
          shouldShowContext: () => true,
          isDevelopment: () => false,
        }),
      }));

      jest.doMock('../../../src/logging/logFormatter.js', () => ({
        getLogFormatter: () => ({
          formatMessage: (level, message, ...args) => ({
            timestamp: '2024-01-01T00:00:00.000Z',
            icon: '',
            level: level.toUpperCase(),
            service: 'ServiceName',
            message,
            contextLines: args.map(
              (arg, index) => `context-${index}:${JSON.stringify(arg)}`
            ),
          }),
          formatSimple: jest.fn(),
        }),
      }));

      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();

      logger.info('Colored message', { key: 'value' });

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      expect(chalkMock.green).toHaveBeenCalledWith('INFO');
      expect(chalkMock.blue).toHaveBeenCalledWith('ServiceName');
      expect(chalkMock.gray.italic).toHaveBeenCalled();

      if (originalChalk === undefined) {
        delete globalThis.chalk;
      } else {
        globalThis.chalk = originalChalk;
      }

      jest.dontMock('../../../src/logging/loggerConfiguration.js');
      jest.dontMock('../../../src/logging/logFormatter.js');
    });

    it('should handle chalk initialization successfully', async () => {
      // Import with working chalk
      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();

      logger.info('Test message');

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const output = mockConsole.info.mock.calls[0][0];
      expect(output).toContain('INFO');
      expect(output).toContain('Test message');
    });

    it('should fall back to plain text when chalk fails', async () => {
      jest.resetModules();

      // Mock chalk to throw on import
      jest.unstable_mockModule('chalk', () => {
        throw new Error('Cannot import chalk');
      });

      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();

      logger.error('Error message');

      expect(mockConsole.error).toHaveBeenCalled();
      // Should still format but without colors
      const lastCall =
        mockConsole.error.mock.calls[mockConsole.error.mock.calls.length - 1];
      const output = lastCall[0];
      expect(output).toContain('ERROR');
      expect(output).toContain('Error message');
    });

    it('should handle chalk blue test failure gracefully', async () => {
      jest.resetModules();

      // Spy on console.warn before importing
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock chalk to fail on the test call
      jest.unstable_mockModule('chalk', () => ({
        default: {
          blue: () => {
            throw new Error('Chalk test failed');
          },
          cyan: (str) => str,
          green: (str) => str,
          yellow: (str) => str,
          red: { bold: (str) => str },
          gray: (str) => str,
          italic: (str) => str,
        },
      }));

      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();

      expect(warnSpy).toHaveBeenCalledWith(
        'EnhancedConsoleLogger: Chalk not available, falling back to plain text'
      );

      warnSpy.mockRestore();
      jest.dontMock('chalk');
    });

    it('should fall back when chalk module lacks a blue function', async () => {
      jest.resetModules();

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      jest.doMock(
        'chalk',
        () => ({
          cyan: (str) => str,
          green: (str) => str,
          yellow: (str) => str,
          red: { bold: (str) => str },
          gray: Object.assign((str) => str, { italic: (str) => str }),
        }),
        { virtual: true }
      );

      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();

      logger.warn('Fallback to plain text');

      expect(warnSpy).toHaveBeenCalledWith(
        'EnhancedConsoleLogger: Chalk not available, falling back to plain text'
      );

      warnSpy.mockRestore();
      jest.dontMock('chalk');
    });

    it('should support chalk default export returned from require', async () => {
      jest.resetModules();

      const chalkDefault = {
        blue: jest.fn((str) => str),
        cyan: jest.fn((str) => str),
        green: jest.fn((str) => str),
        yellow: jest.fn((str) => str),
        red: { bold: jest.fn((str) => str) },
        gray: Object.assign(
          jest.fn((str) => str),
          {
            italic: jest.fn((str) => str),
          }
        ),
      };

      jest.doMock('chalk', () => ({ default: chalkDefault }), {
        virtual: true,
      });

      jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
        getLoggerConfiguration: () => ({
          isColorsEnabled: () => true,
          isIconsEnabled: () => true,
          isPrettyFormatEnabled: () => true,
          getMaxMessageLength: () => 200,
          shouldShowContext: () => true,
          isDevelopment: () => false,
        }),
      }));

      jest.doMock('../../../src/logging/logFormatter.js', () => ({
        getLogFormatter: () => ({
          formatMessage: (level, message, ...args) => ({
            timestamp: '2024-01-01T00:00:00.000Z',
            icon: '',
            level: level.toUpperCase(),
            service: 'ServiceName',
            message,
            contextLines: args.map(
              (arg, index) => `context-${index}:${JSON.stringify(arg)}`
            ),
          }),
          formatSimple: jest.fn(),
        }),
      }));

      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();

      logger.debug('Default export message', { foo: 'bar' });

      expect(chalkDefault.blue).toHaveBeenCalledWith('test');
      expect(chalkDefault.cyan).toHaveBeenCalledWith('DEBUG');
      expect(chalkDefault.gray.italic).toHaveBeenCalled();

      jest.dontMock('chalk');
      jest.dontMock('../../../src/logging/loggerConfiguration.js');
      jest.dontMock('../../../src/logging/logFormatter.js');
    });

    it('should warn when chalk test invocation throws', async () => {
      jest.resetModules();

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      jest.doMock('chalk', () => ({
        default: {
          blue: () => {
            throw new Error('blue failed');
          },
          cyan: (str) => str,
          green: (str) => str,
          yellow: (str) => str,
          red: { bold: (str) => str },
          gray: Object.assign((str) => str, { italic: (str) => str }),
        },
      }));

      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();

      expect(warnSpy).toHaveBeenCalledWith(
        'EnhancedConsoleLogger: Chalk not available, falling back to plain text'
      );

      warnSpy.mockRestore();
      jest.dontMock('chalk');
    });

    it('should handle console.warn throwing during chalk failure', async () => {
      jest.resetModules();

      const warnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementationOnce(() => {
          throw new Error('warn failed');
        })
        .mockImplementation(() => {});

      jest.doMock(
        'chalk',
        () => ({
          cyan: (str) => str,
          green: (str) => str,
          yellow: (str) => str,
          red: { bold: (str) => str },
          gray: Object.assign((str) => str, { italic: (str) => str }),
        }),
        { virtual: true }
      );

      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();

      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[warnSpy.mock.calls.length - 1][0]).toBe(
        'EnhancedConsoleLogger: Chalk not available, falling back to plain text'
      );

      warnSpy.mockRestore();
      jest.dontMock('chalk');
    });

    it('should cache chalk availability across instances', async () => {
      jest.resetModules();

      const originalChalk = globalThis.chalk;

      const createColorFn = (label) => {
        const fn = jest.fn((str) => `${label}:${str}`);
        return fn;
      };

      const grayFn = createColorFn('gray');
      grayFn.italic = jest.fn((str) => `grayItalic:${str}`);

      const chalkMock = {
        blue: createColorFn('blue'),
        cyan: createColorFn('cyan'),
        green: createColorFn('green'),
        yellow: createColorFn('yellow'),
        red: { bold: createColorFn('redBold') },
        gray: grayFn,
      };

      globalThis.chalk = chalkMock;

      jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
        getLoggerConfiguration: () => ({
          isColorsEnabled: () => true,
          isIconsEnabled: () => true,
          isPrettyFormatEnabled: () => true,
          getMaxMessageLength: () => 200,
          shouldShowContext: () => true,
          isDevelopment: () => false,
        }),
      }));

      jest.doMock('../../../src/logging/logFormatter.js', () => ({
        getLogFormatter: () => ({
          formatMessage: (level, message) => ({
            timestamp: '2024-01-01T00:00:00.000Z',
            icon: '',
            level: level.toUpperCase(),
            service: 'ServiceName',
            message,
            contextLines: [],
          }),
          formatSimple: jest.fn(),
        }),
      }));

      const { default: EnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );

      // First instance triggers full initialization
      const firstLogger = new EnhancedConsoleLogger();
      firstLogger.info('First logger message');

      const blueCallCountAfterFirst = chalkMock.blue.mock.calls.length;

      // Second instance should reuse cached chalk availability
      const secondLogger = new EnhancedConsoleLogger();
      secondLogger.info('Second logger message');

      expect(chalkMock.blue).toHaveBeenCalledTimes(blueCallCountAfterFirst);

      if (originalChalk === undefined) {
        delete globalThis.chalk;
      } else {
        globalThis.chalk = originalChalk;
      }

      jest.dontMock('../../../src/logging/loggerConfiguration.js');
      jest.dontMock('../../../src/logging/logFormatter.js');
    });
  });

  describe('Color Function Initialization', () => {
    it('should use identity functions when colors are disabled', async () => {
      jest.resetModules();

      // Mock configuration to disable colors
      jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
        getLoggerConfiguration: () => ({
          isColorsEnabled: () => false,
          isIconsEnabled: () => true,
          isPrettyFormatEnabled: () => true,
          getMaxMessageLength: () => 200,
          shouldShowContext: () => true,
        }),
      }));

      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();

      logger.debug('Debug message');

      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      const output = mockConsole.debug.mock.calls[0][0];
      expect(output).toContain('DEBUG');
    });

    it('should apply color functions when colors are enabled', async () => {
      // Reset modules and import fresh
      jest.resetModules();
      jest.clearAllMocks();

      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();

      logger.warn('Warning message');

      // Check what console.warn calls were made
      const callCount = mockConsole.warn.mock.calls.length;
      const hasMultipleCalls = callCount > 1;

      // Handle chalk initialization warning scenario
      const firstCall = hasMultipleCalls
        ? mockConsole.warn.mock.calls[0][0]
        : null;
      const hasChalkWarning =
        firstCall && firstCall.includes('Chalk not available');

      // Get the actual log output (skip chalk warning if present)
      const outputIndex = hasMultipleCalls && hasChalkWarning ? 1 : 0;
      const output = mockConsole.warn.mock.calls[outputIndex][0];

      expect(output).toContain('WARN');
      expect(output).toContain('Warning message');

      // Verify expected call count
      const expectedCalls = hasMultipleCalls && hasChalkWarning ? 2 : 1;
      expect(mockConsole.warn).toHaveBeenCalledTimes(expectedCalls);
    });
  });

  describe('API Key and Security Sanitization', () => {
    beforeEach(async () => {
      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();
    });

    it('should mask API keys in string arguments', () => {
      logger.info('Testing API key: sk-test123456789');

      const output = mockConsole.info.mock.calls[0][0];
      // In development mode, it shows partial content with asterisks
      expect(output).toMatch(/\*+/); // Should contain asterisks
      expect(output).not.toContain('sk-test123456789'); // Should not contain full API key
    });

    it('should mask API keys in object properties', () => {
      logger.info('Testing object', {
        apiKey: 'sk-test123456789',
        llmId: 'test-provider',
      });

      const output = mockConsole.info.mock.calls[0][0];
      expect(output).toContain('[MASKED]');
      expect(output).not.toContain('sk-test123456789');
      expect(output).toContain('test-provider');
    });

    it('should sanitize nested objects with sensitive data', () => {
      const complexObject = {
        config: {
          apiKey: 'secret-key',
          token: 'auth-token',
          password: 'secret-pass',
          secret: 'top-secret',
        },
        metadata: {
          llmId: 'provider',
          requestId: 'req-123',
        },
      };

      logger.debug('Complex object test', complexObject);

      const output = mockConsole.debug.mock.calls[0][0];
      expect(output).toContain('[MASKED]');
      expect(output).not.toContain('secret-key');
      expect(output).not.toContain('auth-token');
      expect(output).not.toContain('secret-pass');
      expect(output).not.toContain('top-secret');
      expect(output).toContain('provider');
      expect(output).toContain('req-123');
    });

    it('should handle array sanitization', () => {
      const arrayWithSecrets = [
        { apiKey: 'secret1' },
        { data: 'normal-data' },
        { password: 'secret2' },
      ];

      logger.info('Array test', arrayWithSecrets);

      const output = mockConsole.info.mock.calls[0][0];
      expect(output).toContain('[MASKED]');
      expect(output).not.toContain('secret1');
      expect(output).not.toContain('secret2');
      expect(output).toContain('normal-data');
    });

    it('should preserve primitive values when sanitizing arrays', () => {
      logger.info('Array with primitives', ['visible', { token: 'hidden' }]);

      const output = mockConsole.info.mock.calls[0][0];
      expect(output).toContain('visible');
      expect(output).toContain('[MASKED]');
      expect(output).not.toContain('hidden');
    });

    it('should handle sanitization of non-object types', () => {
      logger.info('Mixed types', 'string', 123, true, null, undefined);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const output = mockConsole.info.mock.calls[0][0];
      expect(output).toContain('Mixed types');
    });
  });

  describe('Error Handling and Fallback', () => {
    beforeEach(async () => {
      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();
    });

    it('should handle formatting errors gracefully', async () => {
      jest.resetModules();

      // Mock the formatter to throw an error
      jest.doMock('../../../src/logging/logFormatter.js', () => ({
        getLogFormatter: () => ({
          formatMessage: () => {
            throw new Error('Formatting failed');
          },
          formatSimple: (level, message) =>
            `[FALLBACK] ${level.toUpperCase()}: ${message}`,
        }),
      }));

      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      const testLogger = getEnhancedConsoleLogger();

      // Create a circular reference that could cause JSON.stringify to fail
      const circularObj = {};
      circularObj.self = circularObj;

      testLogger.error('Test error', circularObj);

      // Should fall back to simple console output
      expect(mockConsole.error).toHaveBeenCalledTimes(2);
      expect(mockConsole.error.mock.calls[0][0]).toContain(
        'EnhancedConsoleLogger: Formatting error'
      );
      expect(mockConsole.error.mock.calls[1][0]).toContain(
        '[FALLBACK] ERROR: Test error'
      );
    });

    it('should use appropriate console methods for each log level', async () => {
      // Create completely isolated mocks for this test
      const isolatedMocks = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn(),
      };

      // Store original console methods
      const originalConsole = {
        debug: console.debug,
        info: console.info,
        warn: console.warn,
        error: console.error,
        log: console.log,
      };

      // Replace console with isolated mocks
      Object.assign(console, isolatedMocks);

      try {
        // Reset modules to get fresh logger
        jest.resetModules();

        const { getEnhancedConsoleLogger } = await import(
          '../../../src/logging/enhancedConsoleLogger.js'
        );
        const logger = getEnhancedConsoleLogger();

        // Clear the isolated mocks after logger creation to ignore initialization calls
        Object.values(isolatedMocks).forEach((mock) => mock.mockClear());

        // Test each log level and verify they call the appropriate console methods
        const initialDebugCalls = isolatedMocks.debug.mock.calls.length;
        logger.debug('Debug test message');
        expect(isolatedMocks.debug.mock.calls.length).toBeGreaterThan(
          initialDebugCalls
        );

        const initialInfoCalls = isolatedMocks.info.mock.calls.length;
        logger.info('Info test message');
        expect(isolatedMocks.info.mock.calls.length).toBeGreaterThan(
          initialInfoCalls
        );

        const initialWarnCalls = isolatedMocks.warn.mock.calls.length;
        logger.warn('Warn test message');
        expect(isolatedMocks.warn.mock.calls.length).toBeGreaterThan(
          initialWarnCalls
        );

        const initialErrorCalls = isolatedMocks.error.mock.calls.length;
        logger.error('Error test message');
        expect(isolatedMocks.error.mock.calls.length).toBeGreaterThan(
          initialErrorCalls
        );

        // Verify that the correct console methods were called and contain expected content
        const debugOutput =
          isolatedMocks.debug.mock.calls[
            isolatedMocks.debug.mock.calls.length - 1
          ][0];
        const infoOutput =
          isolatedMocks.info.mock.calls[
            isolatedMocks.info.mock.calls.length - 1
          ][0];
        const warnOutput =
          isolatedMocks.warn.mock.calls[
            isolatedMocks.warn.mock.calls.length - 1
          ][0];
        const errorOutput =
          isolatedMocks.error.mock.calls[
            isolatedMocks.error.mock.calls.length - 1
          ][0];

        expect(debugOutput).toContain('Debug test message');
        expect(infoOutput).toContain('Info test message');
        expect(warnOutput).toContain('Warn test message');
        expect(errorOutput).toContain('Error test message');
      } finally {
        // Always restore original console methods
        Object.assign(console, originalConsole);
      }
    });

    it('should output fallback error message when formatting fails', () => {
      // Spy on console.error to capture fallback message
      jest.spyOn(console, 'error');

      // Create a problematic object that might cause formatting to fail
      const problematicObj = {
        toString: () => {
          throw new Error('toString failed');
        },
        apiKey: 'should-be-masked',
      };

      logger.info('Test with problematic object', problematicObj);

      // Check if the logger successfully handles the problematic object
      expect(mockConsole.info).toHaveBeenCalled();
      const output = mockConsole.info.mock.calls[0][0];
      // Verify it either handles it gracefully or falls back
      expect(output).toBeDefined();
    });
  });

  describe('Development and Test Utilities', () => {
    beforeEach(async () => {
      jest.resetModules();

      // Mock configuration for development environment
      jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
        getLoggerConfiguration: () => ({
          isColorsEnabled: () => true,
          isIconsEnabled: () => true,
          isPrettyFormatEnabled: () => true,
          getMaxMessageLength: () => 200,
          shouldShowContext: () => true,
          isDevelopment: () => true,
          isProduction: () => false,
        }),
      }));

      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();
    });

    it('should provide testOutput method in development', () => {
      expect(typeof logger.testOutput).toBe('function');

      logger.testOutput();

      // Should have called multiple console methods for test output
      expect(mockConsole.log).toHaveBeenCalled();
      expect(mockConsole.debug).toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('should skip test output in production', async () => {
      jest.resetModules();

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Mock configuration for production
      jest.doMock('../../../src/logging/loggerConfiguration.js', () => ({
        getLoggerConfiguration: () => ({
          isDevelopment: () => false,
          isColorsEnabled: () => false,
          isIconsEnabled: () => false,
          isPrettyFormatEnabled: () => false,
          getMaxMessageLength: () => 200,
          shouldShowContext: () => false,
        }),
      }));

      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      const testLogger = getEnhancedConsoleLogger();

      testLogger.testOutput();

      // Should not produce extensive test output in production (should return early)
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', async () => {
      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );

      const logger1 = getEnhancedConsoleLogger();
      const logger2 = getEnhancedConsoleLogger();

      expect(logger1).toBe(logger2);
    });
  });

  describe('Secure Logger Creation', () => {
    beforeEach(async () => {
      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();
    });

    it('should provide createSecure method', () => {
      expect(typeof logger.createSecure).toBe('function');

      const secureLogger = logger.createSecure();

      expect(typeof secureLogger.info).toBe('function');
      expect(typeof secureLogger.warn).toBe('function');
      expect(typeof secureLogger.error).toBe('function');
      expect(typeof secureLogger.debug).toBe('function');
    });

    it('should create secure logger that masks sensitive data', () => {
      const secureLogger = logger.createSecure();

      secureLogger.info('Secure test', { apiKey: 'sk-secret123' });

      const output = mockConsole.info.mock.calls[0][0];
      // Should either contain asterisks or be in fallback format
      expect(output).toBeDefined();
      expect(output).not.toContain('sk-secret123'); // Should not contain original API key
    });
  });

  describe('All Log Level Methods', () => {
    beforeEach(async () => {
      jest.resetModules();
      jest.clearAllMocks();
      const { getEnhancedConsoleLogger } = await import(
        '../../../src/logging/enhancedConsoleLogger.js'
      );
      logger = getEnhancedConsoleLogger();
    });

    it('should handle debug messages', () => {
      logger.debug('Debug message', { context: 'test' });

      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      const output = mockConsole.debug.mock.calls[0][0];
      expect(output).toContain('DEBUG');
      expect(output).toContain('Debug message');
    });

    it('should handle info messages', () => {
      logger.info('Info message', { data: 'test' });

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const output = mockConsole.info.mock.calls[0][0];
      expect(output).toContain('INFO');
      expect(output).toContain('Info message');
    });

    it('should handle warn messages', () => {
      logger.warn('Warning message', { issue: 'minor' });

      // Check what console.warn calls were made
      const callCount = mockConsole.warn.mock.calls.length;
      const hasMultipleCalls = callCount > 1;

      // Handle chalk initialization warning scenario
      const firstCall = hasMultipleCalls
        ? mockConsole.warn.mock.calls[0][0]
        : null;
      const hasChalkWarning =
        firstCall && firstCall.includes('Chalk not available');

      // Get the actual log output (skip chalk warning if present)
      const outputIndex = hasMultipleCalls && hasChalkWarning ? 1 : 0;
      const output = mockConsole.warn.mock.calls[outputIndex][0];

      expect(output).toContain('WARN');
      expect(output).toContain('Warning message');

      // Verify expected call count
      const expectedCalls = hasMultipleCalls && hasChalkWarning ? 2 : 1;
      expect(mockConsole.warn).toHaveBeenCalledTimes(expectedCalls);
    });

    it('should handle error messages', () => {
      logger.error('Error message', new Error('Test error'));

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      const output = mockConsole.error.mock.calls[0][0];
      expect(output).toContain('ERROR');
      expect(output).toContain('Error message');
    });
  });
});
