/**
 * @file Unit tests for LoggerStrategy runtime switching functionality
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
import { LogLevel } from '../../../src/logging/consoleLogger.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('LoggerStrategy - Runtime Switching', () => {
  let originalEnv;
  let consoleSpies;
  let mockEventBus;
  let mockDependencies;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear environment to test in isolation
    delete process.env.DEBUG_LOG_MODE;
    delete process.env.NODE_ENV;
    delete process.env.JEST_WORKER_ID;

    // Mock console methods to prevent output during tests
    consoleSpies = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    };

    // Create mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
    };

    // Create mock dependencies
    mockDependencies = {
      eventBus: mockEventBus,
      consoleLogger: createMockLogger(),
      remoteLogger: createMockLogger(),
      hybridLogger: createMockLogger(),
    };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Restore console spies
    Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
  });

  describe('Backward Compatibility', () => {
    it('should handle traditional log level strings', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      strategy.setLogLevel('DEBUG');
      expect(mockDependencies.consoleLogger.setLogLevel).toHaveBeenCalledWith(
        'DEBUG'
      );

      strategy.setLogLevel('ERROR');
      expect(mockDependencies.consoleLogger.setLogLevel).toHaveBeenCalledWith(
        'ERROR'
      );
    });

    it('should handle LogLevel enum values', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      strategy.setLogLevel(LogLevel.DEBUG);
      expect(mockDependencies.consoleLogger.setLogLevel).toHaveBeenCalledWith(
        LogLevel.DEBUG
      );

      strategy.setLogLevel(LogLevel.ERROR);
      expect(mockDependencies.consoleLogger.setLogLevel).toHaveBeenCalledWith(
        LogLevel.ERROR
      );
    });

    it('should handle NONE log level', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      // Note: 'NONE' (uppercase) now switches to none mode
      // while 'none' (lowercase) also switches mode
      // This is a breaking change from pure backward compatibility
      // but provides consistent behavior
      strategy.setLogLevel('NONE');

      // Should switch to none mode rather than setting log level
      expect(strategy.getMode()).toBe(LoggerMode.NONE);
    });
  });

  describe('Mode Switching', () => {
    it('should switch from console to remote mode', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      strategy.setLogLevel('remote');
      expect(strategy.getMode()).toBe(LoggerMode.PRODUCTION);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'logger.mode.changed',
          payload: expect.objectContaining({
            from: LoggerMode.CONSOLE,
            to: LoggerMode.PRODUCTION,
            reason: 'runtime-switch',
          }),
        })
      );
    });

    it('should switch from remote to hybrid mode', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.PRODUCTION,
        dependencies: mockDependencies,
      });

      strategy.setLogLevel('hybrid');
      expect(strategy.getMode()).toBe(LoggerMode.DEVELOPMENT);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'logger.mode.changed',
          payload: expect.objectContaining({
            from: LoggerMode.PRODUCTION,
            to: LoggerMode.DEVELOPMENT,
          }),
        })
      );
    });

    it('should switch from hybrid to console mode', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.DEVELOPMENT,
        dependencies: mockDependencies,
      });

      strategy.setLogLevel('console');
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'logger.mode.changed',
          payload: expect.objectContaining({
            from: LoggerMode.DEVELOPMENT,
            to: LoggerMode.CONSOLE,
          }),
        })
      );
    });

    it('should switch to none mode', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      // Debug: Check initial state
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);

      strategy.setLogLevel('none');

      // The mode should now be NONE
      expect(strategy.getMode()).toBe(LoggerMode.NONE);
    });

    it('should not switch when already in target mode', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      mockEventBus.dispatch.mockClear();
      strategy.setLogLevel('console');
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Objects', () => {
    it('should apply mode configuration', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      strategy.setLogLevel({
        mode: 'hybrid',
      });

      expect(strategy.getMode()).toBe(LoggerMode.DEVELOPMENT);
    });

    it('should apply category configuration', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      strategy.setLogLevel({
        categories: {
          engine: { level: 'debug', enabled: true },
          ui: { level: 'info', enabled: false },
        },
      });

      // Categories should be updated in config
      const status = strategy.setLogLevel('status');
      expect(status.config.categories).toContain('engine');
      expect(status.config.categories).toContain('ui');
    });

    it('should apply combined configuration', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      strategy.setLogLevel({
        mode: 'hybrid',
        logLevel: 'DEBUG',
        categories: {
          engine: { level: 'debug' },
        },
      });

      expect(strategy.getMode()).toBe(LoggerMode.DEVELOPMENT);
      expect(mockDependencies.hybridLogger.setLogLevel).toHaveBeenCalledWith(
        'DEBUG'
      );
    });

    it('should validate configuration and reject invalid values', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      // Invalid mode
      strategy.setLogLevel({
        mode: 'invalid',
      });
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE); // Should not change

      // Invalid log level in category
      strategy.setLogLevel({
        categories: {
          test: { level: 'invalid' },
        },
      });
      expect(mockDependencies.consoleLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid log level for category test')
      );
    });

    it('should handle null and invalid configuration objects', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      // Should not throw
      expect(() => strategy.setLogLevel(null)).not.toThrow();
      expect(() => strategy.setLogLevel(undefined)).not.toThrow();
      expect(() => strategy.setLogLevel('not-an-object')).not.toThrow();
    });
  });

  describe('Special Commands', () => {
    it('should handle reload command', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      // Clear any initialization calls
      mockDependencies.consoleLogger.info.mockClear();

      strategy.setLogLevel('reload');
      expect(mockDependencies.consoleLogger.info).toHaveBeenCalledWith(
        '[LoggerStrategy] Configuration reloaded'
      );
    });

    it('should handle reset command', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.PRODUCTION,
        dependencies: mockDependencies,
      });

      // Clear any initialization calls
      mockDependencies.consoleLogger.info.mockClear();
      mockDependencies.hybridLogger.info.mockClear();

      strategy.setLogLevel('reset');
      // Reset uses default mode detection
      // The default config has mode: 'development' which maps to DEVELOPMENT
      expect(strategy.getMode()).toBe(LoggerMode.DEVELOPMENT);

      // Check that reset was logged (will be on hybrid logger due to development mode)
      expect(mockDependencies.hybridLogger.info).toHaveBeenCalledWith(
        '[LoggerStrategy] Configuration reset to defaults'
      );
    });

    it('should handle flush command', () => {
      // Create mock logger with flush method
      const mockLoggerWithFlush = createMockLogger();
      mockLoggerWithFlush.flush = jest.fn();

      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: {
          ...mockDependencies,
          consoleLogger: mockLoggerWithFlush,
        },
      });

      strategy.setLogLevel('flush');
      expect(mockLoggerWithFlush.flush).toHaveBeenCalled();
    });

    it('should handle status command', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      const status = strategy.setLogLevel('status');
      expect(status).toMatchObject({
        mode: LoggerMode.CONSOLE,
        logLevel: 'INFO',
        bufferedLogs: 0,
        config: {
          enabled: true,
          fallbackToConsole: true,
        },
        logger: {
          type: expect.any(String),
        },
      });
    });

    it('should warn on unknown command', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      strategy.setLogLevel('unknown');
      expect(mockDependencies.consoleLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid setLogLevel input')
      );
    });
  });

  describe('State Preservation', () => {
    it('should preserve log level across mode switches', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      // Set log level
      strategy.setLogLevel('DEBUG');

      // Switch mode
      strategy.setLogLevel('remote');

      // Log level should be preserved
      expect(mockDependencies.remoteLogger.setLogLevel).toHaveBeenCalledWith(
        'DEBUG'
      );
    });

    it('should transfer buffered logs during transition', () => {
      // Create mock logger with buffer support
      const mockLoggerWithBuffer = createMockLogger();
      mockLoggerWithBuffer.getBuffer = jest.fn().mockReturnValue([
        { level: 'info', message: 'Test log 1', args: [] },
        { level: 'error', message: 'Test log 2', args: ['error'] },
      ]);

      const mockRemoteWithBatch = createMockLogger();
      mockRemoteWithBatch.processBatch = jest.fn();

      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: {
          ...mockDependencies,
          consoleLogger: mockLoggerWithBuffer,
          remoteLogger: mockRemoteWithBatch,
        },
      });

      // Switch mode (should transfer buffer)
      strategy.setLogLevel('remote');

      // Buffer should be transferred
      expect(mockRemoteWithBatch.processBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Test log 1' }),
          expect.objectContaining({ message: 'Test log 2' }),
        ])
      );
    });
  });

  describe('Error Handling', () => {
    it('should not throw on setLogLevel errors', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      // Mock setLogLevel to throw
      mockDependencies.consoleLogger.setLogLevel.mockImplementation(() => {
        throw new Error('Test error');
      });

      // Should not throw
      expect(() => strategy.setLogLevel('DEBUG')).not.toThrow();
      expect(consoleSpies.error).toHaveBeenCalledWith(
        '[LoggerStrategy] Error in setLogLevel:',
        expect.any(Error)
      );
    });

    it('should handle logger creation failures gracefully', () => {
      // Remove mock loggers to force creation failures
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: {},
      });

      // Should not throw when switching modes
      expect(() => strategy.setLogLevel('remote')).not.toThrow();
      expect(() => strategy.setLogLevel('hybrid')).not.toThrow();
    });

    it('should validate configuration errors without breaking', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      // Invalid configuration
      strategy.setLogLevel({
        mode: 123, // Invalid type
        categories: 'not-an-object', // Invalid type
        logLevel: [], // Invalid type
      });

      // Should remain in console mode
      expect(strategy.getMode()).toBe(LoggerMode.CONSOLE);
    });
  });

  describe('Mode Transition Matrix', () => {
    const testTransition = (fromMode, toMode, switchValue) => {
      it(`should transition from ${fromMode} to ${toMode}`, () => {
        const strategy = new LoggerStrategy({
          mode: fromMode,
          dependencies: mockDependencies,
        });

        strategy.setLogLevel(switchValue);
        expect(strategy.getMode()).toBe(toMode);
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'logger.mode.changed',
            payload: expect.objectContaining({
              from: fromMode,
              to: toMode,
            }),
          })
        );
      });
    };

    // Test all transition combinations
    testTransition(LoggerMode.CONSOLE, LoggerMode.PRODUCTION, 'remote');
    testTransition(LoggerMode.CONSOLE, LoggerMode.DEVELOPMENT, 'hybrid');
    testTransition(LoggerMode.CONSOLE, LoggerMode.NONE, 'none');
    testTransition(LoggerMode.PRODUCTION, LoggerMode.CONSOLE, 'console');
    testTransition(LoggerMode.PRODUCTION, LoggerMode.DEVELOPMENT, 'hybrid');
    testTransition(LoggerMode.PRODUCTION, LoggerMode.NONE, 'none');
    testTransition(LoggerMode.DEVELOPMENT, LoggerMode.CONSOLE, 'console');
    testTransition(LoggerMode.DEVELOPMENT, LoggerMode.PRODUCTION, 'remote');
    testTransition(LoggerMode.DEVELOPMENT, LoggerMode.NONE, 'none');
    testTransition(LoggerMode.NONE, LoggerMode.CONSOLE, 'console');
    testTransition(LoggerMode.NONE, LoggerMode.PRODUCTION, 'remote');
    testTransition(LoggerMode.NONE, LoggerMode.DEVELOPMENT, 'hybrid');
  });

  describe('Integration Scenarios', () => {
    it('should handle rapid mode switching', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      // Rapid switches
      strategy.setLogLevel('remote');
      strategy.setLogLevel('hybrid');
      strategy.setLogLevel('console');
      strategy.setLogLevel('none');
      strategy.setLogLevel('hybrid');

      expect(strategy.getMode()).toBe(LoggerMode.DEVELOPMENT);
      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed operations', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      // Mix of different operations
      strategy.setLogLevel('DEBUG'); // Traditional log level
      strategy.setLogLevel('remote'); // Mode switch
      strategy.setLogLevel({
        // Configuration object
        categories: { test: { level: 'info' } },
      });
      strategy.setLogLevel('flush'); // Special command
      strategy.setLogLevel(LogLevel.ERROR); // LogLevel enum

      expect(strategy.getMode()).toBe(LoggerMode.PRODUCTION);
    });

    it('should maintain functionality during active logging', () => {
      const strategy = new LoggerStrategy({
        mode: LoggerMode.CONSOLE,
        dependencies: mockDependencies,
      });

      // Log while switching
      strategy.info('Test log 1');
      strategy.setLogLevel('remote');
      strategy.error('Test log 2');
      strategy.setLogLevel('hybrid');
      strategy.debug('Test log 3');

      // All loggers should have received appropriate calls
      expect(mockDependencies.consoleLogger.info).toHaveBeenCalled();
      expect(mockDependencies.remoteLogger.error).toHaveBeenCalled();
      expect(mockDependencies.hybridLogger.debug).toHaveBeenCalled();
    });
  });
});
