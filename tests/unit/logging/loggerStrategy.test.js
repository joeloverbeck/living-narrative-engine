/**
 * @file Unit tests for LoggerStrategy
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
import RemoteLogger from '../../../src/logging/remoteLogger.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('LoggerStrategy', () => {
  let originalEnv;
  let consoleSpies;
  let originalJestWorkerId;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Save JEST_WORKER_ID specifically since Jest sets it
    originalJestWorkerId = process.env.JEST_WORKER_ID;

    // Mock console methods to prevent output during tests
    consoleSpies = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
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

  describe('Mode Detection', () => {
    it('should default to console mode when no configuration provided', () => {
      // Clear environment to test true defaults
      delete process.env.DEBUG_LOG_MODE;
      delete process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID; // Clear Jest environment

      const strategy = new LoggerStrategy();
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);
    });

    it('should use explicitly provided mode', () => {
      const strategy = new LoggerStrategy({ mode: LoggerMode.PRODUCTION });
      expect(strategy.getMode()).toBe(LoggerMode.PRODUCTION);
    });

    it('should respect DEBUG_LOG_MODE environment variable', () => {
      process.env.DEBUG_LOG_MODE = 'test';
      const strategy = new LoggerStrategy();
      expect(strategy.getMode()).toBe(LoggerMode.TEST);
    });

    it('should prioritize explicit mode over environment variable', () => {
      process.env.DEBUG_LOG_MODE = 'test';
      const strategy = new LoggerStrategy({ mode: LoggerMode.DEVELOPMENT });
      expect(strategy.getMode()).toBe(LoggerMode.DEVELOPMENT);
    });

    it('should map NODE_ENV to appropriate mode', () => {
      // Clear any existing DEBUG_LOG_MODE and JEST_WORKER_ID to test NODE_ENV fallback
      delete process.env.DEBUG_LOG_MODE;
      delete process.env.JEST_WORKER_ID;

      // Test each NODE_ENV value in isolation with fresh config
      process.env.NODE_ENV = 'production';
      const strategy = new LoggerStrategy({ config: {} });
      expect(strategy.getMode()).toBe(LoggerMode.PRODUCTION);

      process.env.NODE_ENV = 'development';
      const strategy2 = new LoggerStrategy({ config: {} });
      expect(strategy2.getMode()).toBe(LoggerMode.DEVELOPMENT);

      process.env.NODE_ENV = 'test';
      const strategy3 = new LoggerStrategy({ config: {} });
      expect(strategy3.getMode()).toBe(LoggerMode.TEST);
    });

    it('should use config mode when no explicit mode or env vars', () => {
      // Clear all environment variables that could affect mode detection
      delete process.env.DEBUG_LOG_MODE;
      delete process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID;
      
      const config = { mode: LoggerMode.NONE };
      const strategy = new LoggerStrategy({ config });
      expect(strategy.getMode()).toBe(LoggerMode.NONE);
    });

    it('should handle invalid mode gracefully', () => {
      // Clear environment to test fallback behavior
      delete process.env.DEBUG_LOG_MODE;
      delete process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID;

      const strategy = new LoggerStrategy({ mode: 'invalid' });
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);
    });

    it('should detect test mode when JEST_WORKER_ID is set', () => {
      // Clear other environment variables to isolate JEST_WORKER_ID detection
      delete process.env.DEBUG_LOG_MODE;
      delete process.env.NODE_ENV;
      process.env.JEST_WORKER_ID = '1';
      
      const strategy = new LoggerStrategy();
      expect(strategy.getMode()).toBe(LoggerMode.TEST);
      
      // Clean up
      delete process.env.JEST_WORKER_ID;
    });

    it('should detect test mode with either NODE_ENV or JEST_WORKER_ID', () => {
      delete process.env.DEBUG_LOG_MODE;
      
      // Test with only JEST_WORKER_ID
      delete process.env.NODE_ENV;
      process.env.JEST_WORKER_ID = '2';
      let strategy = new LoggerStrategy();
      expect(strategy.getMode()).toBe(LoggerMode.TEST);
      
      // Test with both
      process.env.NODE_ENV = 'test';
      strategy = new LoggerStrategy();
      expect(strategy.getMode()).toBe(LoggerMode.TEST);
      
      // Clean up
      delete process.env.JEST_WORKER_ID;
    });
  });

  describe('Logger Creation', () => {
    it('should create ConsoleLogger for console mode', () => {
      const strategy = new LoggerStrategy({ mode: LoggerMode.CONSOLE });
      const logger = strategy.getCurrentLogger();
      expect(logger).toBeInstanceOf(ConsoleLogger);
    });

    it('should create NoOpLogger for none mode', () => {
      const strategy = new LoggerStrategy({ mode: LoggerMode.NONE });
      const logger = strategy.getCurrentLogger();
      expect(logger).toBeInstanceOf(NoOpLogger);
    });

    it('should use provided consoleLogger dependency', () => {
      const mockConsoleLogger = new ConsoleLogger();
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: { consoleLogger: mockConsoleLogger },
      });
      expect(strategy.getCurrentLogger()).toBe(mockConsoleLogger);
    });

    it('should use mockLogger in test mode when provided', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const strategy = new LoggerStrategy({
        mode: LoggerMode.TEST,
        dependencies: { mockLogger },
      });
      expect(strategy.getCurrentLogger()).toBe(mockLogger);
    });

    it('should create remote logger when remote logger not available', () => {
      const strategy = new LoggerStrategy({ mode: LoggerMode.PRODUCTION });
      const logger = strategy.getCurrentLogger();
      expect(logger).toBeInstanceOf(RemoteLogger);
    });

    it('should fallback to console logger when hybrid logger not available', () => {
      const strategy = new LoggerStrategy({ mode: LoggerMode.DEVELOPMENT });
      const logger = strategy.getCurrentLogger();
      expect(logger).toBeInstanceOf(ConsoleLogger);
    });

    it('should demonstrate genuine fallback scenario documentation', () => {
      // This test documents the actual fallback behavior:
      // RemoteLogger creation succeeds with default config even without dependencies
      const strategy = new LoggerStrategy({ mode: LoggerMode.PRODUCTION });
      const logger = strategy.getCurrentLogger();

      // Production mode creates RemoteLogger successfully
      expect(logger).toBeInstanceOf(RemoteLogger);

      // Fallback to ConsoleLogger only occurs when RemoteLogger constructor throws,
      // which requires internal failure (e.g., CircuitBreaker creation failure)
      // or when the created logger lacks required methods
    });

    it('should cache logger instances', () => {
      const strategy = new LoggerStrategy({ mode: LoggerMode.CONSOLE });
      const logger1 = strategy.getCurrentLogger();

      // Switch to another mode and back
      strategy.setLogLevel('none');
      strategy.setLogLevel('console');

      const logger2 = strategy.getCurrentLogger();
      expect(logger1).toBe(logger2); // Should be the same instance
    });
  });

  describe('ILogger Interface Methods', () => {
    let strategy;
    let mockLogger;

    beforeEach(() => {
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      strategy = new LoggerStrategy({
        mode: LoggerMode.TEST,
        dependencies: { mockLogger },
      });
    });

    it('should delegate info method to current logger', () => {
      strategy.info('test message', 'arg1');
      expect(mockLogger.info).toHaveBeenCalledWith('test message', 'arg1');
    });

    it('should delegate warn method to current logger', () => {
      strategy.warn('warning', { data: 'test' });
      expect(mockLogger.warn).toHaveBeenCalledWith('warning', { data: 'test' });
    });

    it('should delegate error method to current logger', () => {
      const error = new Error('test');
      strategy.error('error occurred', error);
      expect(mockLogger.error).toHaveBeenCalledWith('error occurred', error);
    });

    it('should delegate debug method to current logger', () => {
      strategy.debug('debug info', 123);
      expect(mockLogger.debug).toHaveBeenCalledWith('debug info', 123);
    });
  });

  describe('ConsoleLogger Compatibility Methods', () => {
    let strategy;
    let mockLogger;

    beforeEach(() => {
      mockLogger = createMockLogger();
      strategy = new LoggerStrategy({
        mode: LoggerMode.TEST,
        dependencies: { mockLogger },
      });
    });

    it('should delegate groupCollapsed to current logger', () => {
      strategy.groupCollapsed('Test Group');
      expect(mockLogger.groupCollapsed).toHaveBeenCalledWith('Test Group');
    });

    it('should handle groupCollapsed when method not available', () => {
      const minimalLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const strategy = new LoggerStrategy({
        mode: LoggerMode.TEST,
        dependencies: { mockLogger: minimalLogger },
      });

      expect(() => strategy.groupCollapsed('Test')).not.toThrow();
    });

    it('should delegate groupEnd to current logger', () => {
      strategy.groupEnd();
      expect(mockLogger.groupEnd).toHaveBeenCalled();
    });

    it('should delegate table to current logger', () => {
      const data = [{ id: 1 }];
      const columns = ['id'];
      strategy.table(data, columns);
      expect(mockLogger.table).toHaveBeenCalledWith(data, columns);
    });
  });

  describe('Runtime Mode Switching', () => {
    let strategy;

    beforeEach(() => {
      strategy = new LoggerStrategy({ mode: LoggerMode.CONSOLE });
    });

    it('should switch mode using special setLogLevel values', () => {
      strategy.setLogLevel('remote');
      expect(strategy.getMode()).toBe(LoggerMode.PRODUCTION);

      strategy.setLogLevel('console');
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);

      strategy.setLogLevel('hybrid');
      expect(strategy.getMode()).toBe(LoggerMode.DEVELOPMENT);

      strategy.setLogLevel('none');
      expect(strategy.getMode()).toBe(LoggerMode.NONE);
    });

    it('should switch mode using direct mode names', () => {
      strategy.setLogLevel('production');
      expect(strategy.getMode()).toBe(LoggerMode.PRODUCTION);

      strategy.setLogLevel('development');
      expect(strategy.getMode()).toBe(LoggerMode.DEVELOPMENT);

      strategy.setLogLevel('test');
      expect(strategy.getMode()).toBe(LoggerMode.TEST);
    });

    it('should delegate regular log levels to current logger', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        setLogLevel: jest.fn(),
      };
      const strategy = new LoggerStrategy({
        mode: LoggerMode.TEST,
        dependencies: { mockLogger },
      });

      strategy.setLogLevel('DEBUG');
      expect(mockLogger.setLogLevel).toHaveBeenCalledWith('DEBUG');

      strategy.setLogLevel(2);
      expect(mockLogger.setLogLevel).toHaveBeenCalledWith(2);
    });

    it('should not switch mode for invalid values', () => {
      const initialMode = strategy.getMode();
      strategy.setLogLevel('invalid-mode');
      expect(strategy.getMode()).toBe(initialMode);
    });

    it('should handle switching to same mode gracefully', () => {
      strategy.setLogLevel('console');
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);

      // Switch to same mode
      strategy.setLogLevel('console');
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);
    });
  });

  describe('Configuration Validation', () => {
    it('should handle invalid configuration gracefully', () => {
      expect(() => new LoggerStrategy({ config: null })).not.toThrow();
      expect(() => new LoggerStrategy({ config: 'invalid' })).not.toThrow();
      expect(() => new LoggerStrategy({ config: 123 })).not.toThrow();
    });

    it('should merge partial configuration with defaults', () => {
      // Clear environment to test config defaults
      delete process.env.DEBUG_LOG_MODE;
      delete process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID;

      const config = { logLevel: 'DEBUG' };
      const strategy = new LoggerStrategy({ config });
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);
    });

    it('should validate mode in configuration', () => {
      // Clear environment to test config fallback
      delete process.env.DEBUG_LOG_MODE;
      delete process.env.NODE_ENV;
      delete process.env.JEST_WORKER_ID;

      const config = { mode: 'invalid-mode' };
      const strategy = new LoggerStrategy({ config });
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE); // Should fall back to default
    });

    it('should ensure remote config exists', () => {
      const config = { remote: null };
      const strategy = new LoggerStrategy({ config });
      expect(() => strategy.info('test')).not.toThrow();
    });

    it('should ensure categories config exists', () => {
      const config = { categories: null };
      const strategy = new LoggerStrategy({ config });
      expect(() => strategy.info('test')).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should fallback to console logger on creation failure', () => {
      // Create a broken logger that lacks required methods
      const brokenLogger = {}; // Missing info, warn, error, debug methods

      // Spy on console.error to verify fallback message
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Use TEST mode to trigger the broken logger without affecting console fallback
      const strategy = new LoggerStrategy({
        mode: LoggerMode.TEST,
        dependencies: { mockLogger: brokenLogger },
      });

      // Should have logged an error about the failure
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create logger'),
        expect.any(Error)
      );

      // Should still work despite the error (fallback to console logger)
      expect(() => strategy.info('test')).not.toThrow();

      // The logger should be ConsoleLogger (fallback when logger creation fails)
      const logger = strategy.getCurrentLogger();
      expect(logger).toBeInstanceOf(ConsoleLogger);

      errorSpy.mockRestore();
    });

    it('should create remote logger even when fallback is disabled', () => {
      const config = { fallbackToConsole: false };
      const strategy = new LoggerStrategy({
        mode: LoggerMode.PRODUCTION,
        config,
      });

      const logger = strategy.getCurrentLogger();
      // Production mode creates RemoteLogger instance, fallback only occurs on creation failure
      expect(logger).toBeInstanceOf(RemoteLogger);
    });

    it('should report error via event bus when available', () => {
      const eventBus = {
        dispatch: jest.fn(),
      };

      // Force an error by providing broken logger (missing required methods)
      const brokenLogger = {}; // Missing info, warn, error, debug methods

      const strategy = new LoggerStrategy({
        mode: LoggerMode.TEST,
        dependencies: {
          mockLogger: brokenLogger,
          eventBus,
        },
      });

      // The error should be reported via event bus
      expect(eventBus.dispatch).toHaveBeenCalledWith({
        type: 'LOGGER_CREATION_FAILED',
        payload: expect.objectContaining({
          error: expect.any(String),
          mode: LoggerMode.TEST,
        }),
      });

      // Strategy should still work (with fallback logger)
      expect(strategy.getMode()).toBe(LoggerMode.TEST);
      expect(() => strategy.info('test')).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined arguments gracefully', () => {
      const strategy = new LoggerStrategy();
      expect(() => strategy.info(undefined)).not.toThrow();
      expect(() => strategy.warn(null)).not.toThrow();
      expect(() => strategy.error()).not.toThrow();
      expect(() => strategy.debug(undefined, null)).not.toThrow();
    });

    it('should handle complex objects in logging', () => {
      const strategy = new LoggerStrategy({ mode: LoggerMode.NONE });

      const circularRef = { name: 'test' };
      circularRef.self = circularRef;

      expect(() => strategy.info('circular', circularRef)).not.toThrow();
      expect(() => strategy.debug('function', () => {})).not.toThrow();
      expect(() => strategy.error('symbol', Symbol('test'))).not.toThrow();
    });

    it('should handle rapid mode switching', () => {
      const strategy = new LoggerStrategy();

      // Rapidly switch modes
      for (let i = 0; i < 10; i++) {
        strategy.setLogLevel('none');
        strategy.setLogLevel('console');
        strategy.setLogLevel('test');
        strategy.setLogLevel('development');
      }

      // Should still work correctly
      expect(() => strategy.info('test')).not.toThrow();
    });
  });

  describe('Integration with Different Logger Types', () => {
    it('should work with ConsoleLogger instance', () => {
      const consoleLogger = new ConsoleLogger('DEBUG');
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: { consoleLogger },
      });

      expect(strategy.getCurrentLogger()).toBe(consoleLogger);
      expect(() => strategy.info('test')).not.toThrow();
    });

    it('should work with NoOpLogger for none mode', () => {
      const strategy = new LoggerStrategy({ mode: LoggerMode.NONE });
      const logger = strategy.getCurrentLogger();

      expect(logger).toBeInstanceOf(NoOpLogger);

      // Should not throw and not produce output
      const infoSpy = jest.spyOn(console, 'info');
      strategy.info('test');
      expect(infoSpy).not.toHaveBeenCalled();
      infoSpy.mockRestore();
    });

    it('should work with custom mock logger', () => {
      const customLogger = createMockLogger();

      const strategy = new LoggerStrategy({
        mode: LoggerMode.TEST,
        dependencies: { mockLogger: customLogger },
      });

      strategy.info('test message');
      expect(customLogger.info).toHaveBeenCalledWith('test message');
    });
  });
});
