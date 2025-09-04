/**
 * @file Integration tests for LoggerStrategy with different logger types
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import LoggerStrategy, {
  LoggerMode,
} from '../../../src/logging/loggerStrategy.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import NoOpLogger from '../../../src/logging/noOpLogger.js';

describe('LoggerStrategy Integration', () => {
  let originalEnv;
  let consoleSpies;
  let originalJestWorkerId;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Save JEST_WORKER_ID specifically since Jest sets it
    originalJestWorkerId = process.env.JEST_WORKER_ID;

    // Mock console methods
    consoleSpies = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
      groupCollapsed: jest
        .spyOn(console, 'groupCollapsed')
        .mockImplementation(() => {}),
      groupEnd: jest.spyOn(console, 'groupEnd').mockImplementation(() => {}),
      table: jest.spyOn(console, 'table').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Restore JEST_WORKER_ID if it was originally set
    if (originalJestWorkerId !== undefined) {
      process.env.JEST_WORKER_ID = originalJestWorkerId;
    }

    // Restore console spies
    Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
  });

  describe('Configuration File Loading', () => {
    it('should load configuration from debug-logging-config.json', () => {
      // Clear all environment variables to test configuration-based mode
      delete process.env.JEST_WORKER_ID;
      delete process.env.DEBUG_LOG_MODE;
      delete process.env.NODE_ENV;

      // Simulate the config content from debug-logging-config.json
      const configContent = {
        enabled: true,
        mode: 'development',
        fallbackToConsole: true,
        logLevel: 'INFO',
        remote: {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 100,
          flushInterval: 1000,
        },
        categories: {
          engine: { enabled: true, level: 'debug' },
          ui: { enabled: true, level: 'info' },
        },
      };

      // Create strategy with loaded config
      const strategy = new LoggerStrategy({ config: configContent });

      // Strategy should initialize successfully
      expect(strategy).toBeDefined();
      expect(strategy.getMode()).toBe(LoggerMode.DEVELOPMENT);
    });

    it('should merge config file with environment variables', () => {
      // Simulate config content
      const configContent = {
        mode: 'development',
        fallbackToConsole: true,
      };

      // Environment should override config file
      process.env.DEBUG_LOG_MODE = 'production';

      const strategy = new LoggerStrategy({ config: configContent });
      expect(strategy.getMode()).toBe(LoggerMode.PRODUCTION);
    });
  });

  describe('Logger Type Integration', () => {
    it('should integrate with ConsoleLogger correctly', () => {
      const consoleLogger = new ConsoleLogger('DEBUG');
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: { consoleLogger },
      });

      // Test all ILogger methods
      strategy.info('info message');
      expect(consoleSpies.info).toHaveBeenCalledWith('info message');

      strategy.warn('warning message');
      expect(consoleSpies.warn).toHaveBeenCalledWith('warning message');

      strategy.error('error message');
      expect(consoleSpies.error).toHaveBeenCalledWith('error message');

      strategy.debug('debug message');
      expect(consoleSpies.debug).toHaveBeenCalledWith('debug message');

      // Test ConsoleLogger specific methods
      strategy.groupCollapsed('Test Group');
      expect(consoleSpies.groupCollapsed).toHaveBeenCalledWith('Test Group');

      strategy.groupEnd();
      expect(consoleSpies.groupEnd).toHaveBeenCalled();

      const data = [{ id: 1, name: 'test' }];
      strategy.table(data);
      expect(consoleSpies.table).toHaveBeenCalledWith(data, undefined);
    });

    it('should integrate with NoOpLogger correctly', () => {
      const strategy = new LoggerStrategy({ mode: LoggerMode.NONE });

      // None of these should produce console output
      strategy.info('info message');
      strategy.warn('warning message');
      strategy.error('error message');
      strategy.debug('debug message');
      strategy.groupCollapsed('Test Group');
      strategy.groupEnd();
      strategy.table([{ test: 'data' }]);

      // Verify no console methods were called (except initialization)
      // Reset counts to ignore initialization
      Object.values(consoleSpies).forEach((spy) => spy.mockClear());

      strategy.info('test');
      strategy.warn('test');
      strategy.error('test');
      strategy.debug('test');

      expect(consoleSpies.info).not.toHaveBeenCalled();
      expect(consoleSpies.warn).not.toHaveBeenCalled();
      expect(consoleSpies.error).not.toHaveBeenCalled();
      expect(consoleSpies.debug).not.toHaveBeenCalled();
    });
  });

  describe('Mode Switching Integration', () => {
    it('should switch between different logger types at runtime', () => {
      const strategy = new LoggerStrategy({ mode: LoggerMode.CONSOLE });

      // Start with ConsoleLogger
      expect(strategy.getCurrentLogger()).toBeInstanceOf(ConsoleLogger);

      // Switch to NoOpLogger
      strategy.setLogLevel('none');
      expect(strategy.getMode()).toBe(LoggerMode.NONE);
      expect(strategy.getCurrentLogger()).toBeInstanceOf(NoOpLogger);

      // Switch back to ConsoleLogger
      strategy.setLogLevel('console');
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);
      expect(strategy.getCurrentLogger()).toBeInstanceOf(ConsoleLogger);

      // Test that logging still works after switching
      consoleSpies.info.mockClear();
      strategy.info('test after switch');
      expect(consoleSpies.info).toHaveBeenCalledWith('test after switch');
    });

    it('should preserve log level when switching between console loggers', () => {
      const strategy = new LoggerStrategy({ mode: LoggerMode.CONSOLE });

      // Set log level to DEBUG
      strategy.setLogLevel('DEBUG');

      // Verify debug messages work
      consoleSpies.debug.mockClear();
      strategy.debug('debug test');
      expect(consoleSpies.debug).toHaveBeenCalled();

      // Switch to none and back
      strategy.setLogLevel('none');
      strategy.setLogLevel('console');

      // Debug should still work (logger cached)
      consoleSpies.debug.mockClear();
      strategy.debug('debug after switch');
      expect(consoleSpies.debug).toHaveBeenCalled();
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from logger creation failures', async () => {
      const eventBus = {
        dispatch: jest.fn(),
      };

      // Start with a broken mock logger
      const brokenLogger = {}; // Missing required methods

      const strategy = new LoggerStrategy({
        mode: LoggerMode.TEST,
        dependencies: {
          mockLogger: brokenLogger,
          eventBus,
        },
      });

      // Wait for the async dispatch to occur
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should have reported the error
      expect(eventBus.dispatch).toHaveBeenCalledWith({
        type: 'LOGGER_CREATION_FAILED',
        payload: expect.objectContaining({
          error: expect.any(String),
          mode: LoggerMode.TEST,
        }),
      });

      // Should still be able to log (using fallback)
      expect(() => {
        strategy.info('test message');
        strategy.warn('warning');
        strategy.error('error');
        strategy.debug('debug');
      }).not.toThrow();
    });

    it('should handle rapid mode switching without issues', () => {
      // Clear environment to have predictable behavior
      delete process.env.DEBUG_LOG_MODE;
      delete process.env.NODE_ENV;

      const strategy = new LoggerStrategy({ mode: LoggerMode.CONSOLE });

      // Rapidly switch modes
      const modes = ['console', 'none', 'test', 'development', 'production'];

      for (let i = 0; i < 20; i++) {
        const mode = modes[i % modes.length];
        strategy.setLogLevel(mode);
      }

      // Should still work correctly
      expect(() => {
        strategy.info('test after rapid switching');
        strategy.debug('debug message');
        strategy.warn('warning');
        strategy.error('error');
      }).not.toThrow();

      // Should be on the last mode set (19 % 5 = 4, so 'production')
      expect(strategy.getMode()).toBe(LoggerMode.PRODUCTION);
    });
  });

  describe('Environment Variable Integration', () => {
    it('should respect DEBUG_LOG_MODE in different environments', () => {
      const testCases = [
        { env: 'production', expected: LoggerMode.PRODUCTION },
        { env: 'development', expected: LoggerMode.DEVELOPMENT },
        { env: 'test', expected: LoggerMode.TEST },
        { env: 'console', expected: LoggerMode.CONSOLE },
        { env: 'none', expected: LoggerMode.NONE },
      ];

      testCases.forEach(({ env, expected }) => {
        process.env.DEBUG_LOG_MODE = env;
        const strategy = new LoggerStrategy();
        expect(strategy.getMode()).toBe(expected);
        delete process.env.DEBUG_LOG_MODE;
      });
    });

    it('should respect NODE_ENV when DEBUG_LOG_MODE is not set', () => {
      delete process.env.DEBUG_LOG_MODE;
      delete process.env.JEST_WORKER_ID; // Clear Jest environment

      const testCases = [
        { env: 'production', expected: LoggerMode.PRODUCTION },
        { env: 'development', expected: LoggerMode.DEVELOPMENT },
        { env: 'test', expected: LoggerMode.TEST },
      ];

      testCases.forEach(({ env, expected }) => {
        process.env.NODE_ENV = env;
        const strategy = new LoggerStrategy();
        expect(strategy.getMode()).toBe(expected);
        delete process.env.NODE_ENV;
      });
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed configuration sources correctly', () => {
      // Clear JEST_WORKER_ID to properly test priority order
      delete process.env.JEST_WORKER_ID;

      // Set different values at different priority levels
      process.env.NODE_ENV = 'production';
      process.env.DEBUG_LOG_MODE = 'test';
      const config = { mode: 'development' };

      // Explicit mode should win
      const strategy1 = new LoggerStrategy({ mode: LoggerMode.NONE });
      expect(strategy1.getMode()).toBe(LoggerMode.NONE);

      // DEBUG_LOG_MODE should win over config
      const strategy2 = new LoggerStrategy({ config });
      expect(strategy2.getMode()).toBe(LoggerMode.TEST);

      // Clear DEBUG_LOG_MODE and JEST_WORKER_ID, config should win over NODE_ENV
      delete process.env.DEBUG_LOG_MODE;
      delete process.env.JEST_WORKER_ID;
      const strategy3 = new LoggerStrategy({ config });
      expect(strategy3.getMode()).toBe(LoggerMode.DEVELOPMENT);

      // Clear config mode, NODE_ENV should be used
      delete config.mode;
      const strategy4 = new LoggerStrategy({ config });
      expect(strategy4.getMode()).toBe(LoggerMode.PRODUCTION);
    });

    it('should handle all logger methods after multiple mode switches', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        groupCollapsed: jest.fn(),
        groupEnd: jest.fn(),
        table: jest.fn(),
        setLogLevel: jest.fn(),
      };

      const strategy = new LoggerStrategy({
        mode: LoggerMode.TEST,
        dependencies: { mockLogger },
      });

      // Switch through various modes
      strategy.setLogLevel('console');
      strategy.setLogLevel('none');
      strategy.setLogLevel('test');

      // All methods should still work
      strategy.info('info');
      strategy.warn('warn');
      strategy.error('error');
      strategy.debug('debug');
      strategy.groupCollapsed('group');
      strategy.groupEnd();
      strategy.table([{ data: 'test' }]);

      expect(mockLogger.info).toHaveBeenCalledWith('info');
      expect(mockLogger.warn).toHaveBeenCalledWith('warn');
      expect(mockLogger.error).toHaveBeenCalledWith('error');
      expect(mockLogger.debug).toHaveBeenCalledWith('debug');
      expect(mockLogger.groupCollapsed).toHaveBeenCalledWith('group');
      expect(mockLogger.groupEnd).toHaveBeenCalled();
      expect(mockLogger.table).toHaveBeenCalledWith(
        [{ data: 'test' }],
        undefined
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing ConsoleLogger usage', () => {
      // Create strategy as drop-in replacement for ConsoleLogger
      // Start with DEBUG level to ensure all methods work
      const consoleLogger = new ConsoleLogger('DEBUG');
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: { consoleLogger },
      });

      // Test all ConsoleLogger methods work identically
      const testMessage = 'Test message';
      const testObject = { key: 'value' };
      const testError = new Error('Test error');

      // Clear previous calls
      Object.values(consoleSpies).forEach((spy) => spy.mockClear());

      // ILogger methods
      strategy.info(testMessage, testObject);
      expect(consoleSpies.info).toHaveBeenCalledWith(testMessage, testObject);

      strategy.warn(testMessage, testObject);
      expect(consoleSpies.warn).toHaveBeenCalledWith(testMessage, testObject);

      strategy.error(testMessage, testError);
      expect(consoleSpies.error).toHaveBeenCalledWith(testMessage, testError);

      strategy.debug(testMessage, testObject);
      expect(consoleSpies.debug).toHaveBeenCalledWith(testMessage, testObject);

      // ConsoleLogger specific methods
      strategy.groupCollapsed('Collapsed Group');
      expect(consoleSpies.groupCollapsed).toHaveBeenCalledWith(
        'Collapsed Group'
      );

      strategy.groupEnd();
      expect(consoleSpies.groupEnd).toHaveBeenCalled();

      const tableData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      strategy.table(tableData, ['id']);
      expect(consoleSpies.table).toHaveBeenCalledWith(tableData, ['id']);

      // setLogLevel method
      strategy.setLogLevel('ERROR');

      // After setting to ERROR, debug and info should not log
      consoleSpies.debug.mockClear();
      consoleSpies.info.mockClear();

      strategy.debug('Should not appear');
      strategy.info('Should not appear');

      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.info).not.toHaveBeenCalled();

      // But error should still log
      consoleSpies.error.mockClear();
      strategy.error('Should appear');
      expect(consoleSpies.error).toHaveBeenCalledWith('Should appear');
    });
  });
});
