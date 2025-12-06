import consoleLoggerDefault, {
  ConsoleLogger,
  createConsoleLogger,
} from '../src/consoleLogger.js';

describe('ConsoleLogger', () => {
  let originalInfo;
  let originalWarn;
  let originalError;
  let originalDebug;

  beforeEach(() => {
    originalInfo = console.info;
    originalWarn = console.warn;
    originalError = console.error;
    originalDebug = console.debug;
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    console.debug = jest.fn();
  });

  afterEach(() => {
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
    console.debug = originalDebug;
  });

  describe('Enhanced Logger Integration', () => {
    test('info logs with enhanced formatting', () => {
      const logger = new ConsoleLogger();
      logger.info('hello', { a: 1 });

      // Verify console.info was called
      expect(console.info).toHaveBeenCalledTimes(1);

      // Verify enhanced formatting is applied
      const logOutput = console.info.mock.calls[0][0];
      expect(logOutput).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/); // Timestamp format
      expect(logOutput).toContain('INFO');
      expect(logOutput).toContain('hello');
      expect(logOutput).toContain('System:'); // Service detection

      // Context should be formatted in subsequent lines
      // Skip context check as it's conditional based on formatting
    });

    test('warn logs with enhanced formatting', () => {
      const logger = new ConsoleLogger();
      logger.warn('be careful', 123);

      // Verify console.warn was called
      expect(console.warn).toHaveBeenCalledTimes(1);

      // Verify enhanced formatting is applied
      const logOutput = console.warn.mock.calls[0][0];
      expect(logOutput).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/); // Timestamp format
      expect(logOutput).toContain('WARN');
      expect(logOutput).toContain('be careful');
      expect(logOutput).toContain('System:'); // Service detection

      // Details should be formatted
      expect(logOutput).toContain('Details[0]: 123');
    });

    test('error logs with enhanced formatting', () => {
      const logger = new ConsoleLogger();
      const err = new Error('boom');
      logger.error('failure', err);

      // Verify console.error was called
      expect(console.error).toHaveBeenCalledTimes(1);

      // Verify enhanced formatting is applied
      const logOutput = console.error.mock.calls[0][0];
      expect(logOutput).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/); // Timestamp format
      expect(logOutput).toContain('ERROR');
      expect(logOutput).toContain('failure');
      expect(logOutput).toContain('System:'); // Service detection

      // Context should be present for error objects
      expect(logOutput).toContain('Context:');
    });

    test('debug logs with enhanced formatting', () => {
      const logger = new ConsoleLogger();
      logger.debug('details', 'extra');

      // Verify console.debug was called
      expect(console.debug).toHaveBeenCalledTimes(1);

      // Verify enhanced formatting is applied
      const logOutput = console.debug.mock.calls[0][0];
      expect(logOutput).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/); // Timestamp format
      expect(logOutput).toContain('DEBUG');
      expect(logOutput).toContain('details');
      expect(logOutput).toContain('System:'); // Service detection

      // Details should be formatted
      expect(logOutput).toContain('Details[0]: extra');
    });
  });

  describe('Backward Compatibility', () => {
    test('maintains ILogger interface - info method exists', () => {
      const logger = new ConsoleLogger();
      expect(typeof logger.info).toBe('function');
    });

    test('maintains ILogger interface - warn method exists', () => {
      const logger = new ConsoleLogger();
      expect(typeof logger.warn).toBe('function');
    });

    test('maintains ILogger interface - error method exists', () => {
      const logger = new ConsoleLogger();
      expect(typeof logger.error).toBe('function');
    });

    test('maintains ILogger interface - debug method exists', () => {
      const logger = new ConsoleLogger();
      expect(typeof logger.debug).toBe('function');
    });

    test('accepts multiple arguments like original logger', () => {
      const logger = new ConsoleLogger();

      // Should not throw when called with multiple arguments
      expect(() => {
        logger.info('message', { data: 'test' }, 'extra', 123);
        logger.warn('warning', new Error('test'), { context: true });
        logger.error('error', new Error('test'), { debug: 'info' });
        logger.debug('debug', 'param1', 'param2', { nested: { data: true } });
      }).not.toThrow();
    });
  });

  describe('Enhanced Features', () => {
    test('provides createSecure method for enhanced security', () => {
      const logger = new ConsoleLogger();
      expect(typeof logger.createSecure).toBe('function');

      const secureLogger = logger.createSecure();
      expect(typeof secureLogger.info).toBe('function');
      expect(typeof secureLogger.warn).toBe('function');
      expect(typeof secureLogger.error).toBe('function');
      expect(typeof secureLogger.debug).toBe('function');
    });

    test('provides testEnhancedOutput method for development', () => {
      const logger = new ConsoleLogger();
      expect(typeof logger.testEnhancedOutput).toBe('function');

      // Should not throw when called
      expect(() => {
        logger.testEnhancedOutput();
      }).not.toThrow();
    });

    test('handles API key masking in log output', () => {
      const logger = new ConsoleLogger();
      logger.info('Testing API key', { apiKey: 'sk-test123456789' });

      const logOutput = console.info.mock.calls[0][0];
      expect(logOutput).toContain('[MASKED]');
      expect(logOutput).not.toContain('sk-test123456789');
    });

    test('properly formats complex context objects', () => {
      const logger = new ConsoleLogger();
      const complexObject = {
        llmId: 'test-provider',
        config: {
          temperature: 0.7,
          maxTokens: 150,
        },
        metadata: {
          requestId: 'req-123',
          timestamp: new Date().toISOString(),
        },
      };

      logger.info('Complex object test', complexObject);

      const logOutput = console.info.mock.calls[0][0];
      expect(logOutput).toContain('Context:');
      expect(logOutput).toContain('llmId');
      expect(logOutput).toContain('test-provider');
    });
  });

  describe('Context Detection', () => {
    test('detects startup context', () => {
      const logger = new ConsoleLogger();
      logger.info('LLM Proxy Server: Server initialization complete');

      const logOutput = console.info.mock.calls[0][0];
      expect(logOutput).toContain('LLM Proxy Server:');
    });

    test('detects API key context', () => {
      const logger = new ConsoleLogger();
      logger.debug('ApiKeyService: Retrieving API key for provider');

      const logOutput = console.debug.mock.calls[0][0];
      expect(logOutput).toContain('ApiKeyService:');
    });

    test('detects cache context', () => {
      const logger = new ConsoleLogger();
      logger.info('CacheService: Cache hit for key test-key');

      const logOutput = console.info.mock.calls[0][0];
      expect(logOutput).toContain('CacheService:');
    });

    test('detects request context', () => {
      const logger = new ConsoleLogger();
      logger.debug('LlmRequestController: Processing POST request');

      const logOutput = console.debug.mock.calls[0][0];
      expect(logOutput).toContain('LlmRequestController:');
    });
  });

  describe('Factory helpers', () => {
    test('createConsoleLogger returns a new ConsoleLogger instance', () => {
      const loggerA = createConsoleLogger();
      const loggerB = createConsoleLogger();

      expect(loggerA).toBeInstanceOf(ConsoleLogger);
      expect(loggerB).toBeInstanceOf(ConsoleLogger);
      expect(loggerA).not.toBe(loggerB);
    });

    test('default export is a singleton ConsoleLogger', () => {
      expect(consoleLoggerDefault).toBeInstanceOf(ConsoleLogger);

      // Default export should be distinct from freshly created instances
      const freshLogger = createConsoleLogger();
      expect(freshLogger).not.toBe(consoleLoggerDefault);

      // But they should expose the same public logging API surface
      const publicMethods = [
        'info',
        'warn',
        'error',
        'debug',
        'createSecure',
        'testEnhancedOutput',
      ];
      for (const method of publicMethods) {
        expect(typeof consoleLoggerDefault[method]).toBe('function');
        expect(typeof freshLogger[method]).toBe('function');
      }
    });
  });
});
