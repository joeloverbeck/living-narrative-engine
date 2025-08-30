/**
 * @file Unit tests for HybridLogger class
 * @see src/logging/hybridLogger.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import HybridLogger from '../../../src/logging/hybridLogger.js';

describe('HybridLogger', () => {
  let mockConsoleLogger;
  let mockRemoteLogger;
  let mockCategoryDetector;
  let hybridLogger;

  beforeEach(() => {
    // Mock console logger
    mockConsoleLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      groupCollapsed: jest.fn(),
      groupEnd: jest.fn(),
      table: jest.fn(),
      setLogLevel: jest.fn(),
    };

    // Mock remote logger
    mockRemoteLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock category detector
    mockCategoryDetector = {
      detectCategory: jest.fn(() => 'engine'),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create HybridLogger with default filter configuration', () => {
      hybridLogger = new HybridLogger({
        consoleLogger: mockConsoleLogger,
        remoteLogger: mockRemoteLogger,
        categoryDetector: mockCategoryDetector,
      });

      expect(hybridLogger).toBeInstanceOf(HybridLogger);
      expect(mockConsoleLogger.info).toHaveBeenCalledWith(
        '[HybridLogger] Initialized with console and remote logging'
      );
    });

    it('should create HybridLogger with custom filter configuration', () => {
      const customFilters = {
        console: {
          categories: ['test'],
          levels: ['debug'],
          enabled: true,
        },
        remote: {
          categories: null,
          levels: null,
          enabled: false,
        },
      };

      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        customFilters
      );

      const filters = hybridLogger.getFilters();
      expect(filters.console.categories).toEqual(['test']);
      expect(filters.console.levels).toEqual(['debug']);
      expect(filters.remote.enabled).toBe(false);
    });

    it('should throw error for invalid console logger', () => {
      expect(
        () =>
          new HybridLogger({
            consoleLogger: {},
            remoteLogger: mockRemoteLogger,
            categoryDetector: mockCategoryDetector,
          })
      ).toThrow();
    });

    it('should throw error for invalid remote logger', () => {
      expect(
        () =>
          new HybridLogger({
            consoleLogger: mockConsoleLogger,
            remoteLogger: {},
            categoryDetector: mockCategoryDetector,
          })
      ).toThrow();
    });

    it('should throw error for invalid category detector', () => {
      expect(
        () =>
          new HybridLogger({
            consoleLogger: mockConsoleLogger,
            remoteLogger: mockRemoteLogger,
            categoryDetector: {},
          })
      ).toThrow();
    });
  });

  describe('Dual Logging Behavior', () => {
    beforeEach(() => {
      // Set up with filters that allow all logging
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: { categories: null, levels: null, enabled: true },
          remote: { categories: null, levels: null, enabled: true },
        }
      );
    });

    it('should log to both console and remote for debug level', () => {
      const message = 'Debug message';
      const args = ['arg1', 'arg2'];

      hybridLogger.debug(message, ...args);

      expect(mockCategoryDetector.detectCategory).toHaveBeenCalledWith(message);
      expect(mockConsoleLogger.debug).toHaveBeenCalledWith(
        '[ENGINE:DEBUG] Debug message',
        ...args
      );
      expect(mockRemoteLogger.debug).toHaveBeenCalledWith(message, ...args);
    });

    it('should log to both console and remote for info level', () => {
      const message = 'Info message';
      const args = [{ key: 'value' }];

      hybridLogger.info(message, ...args);

      expect(mockConsoleLogger.info).toHaveBeenCalledWith(
        '[ENGINE:INFO] Info message',
        ...args
      );
      expect(mockRemoteLogger.info).toHaveBeenCalledWith(message, ...args);
    });

    it('should log to both console and remote for warn level', () => {
      const message = 'Warning message';
      hybridLogger.warn(message);

      expect(mockConsoleLogger.warn).toHaveBeenCalledWith(
        '[ENGINE:WARN] Warning message'
      );
      expect(mockRemoteLogger.warn).toHaveBeenCalledWith(message);
    });

    it('should log to both console and remote for error level', () => {
      const message = 'Error message';
      const error = new Error('Test error');

      hybridLogger.error(message, error);

      expect(mockConsoleLogger.error).toHaveBeenCalledWith(
        '[ENGINE:ERROR] Error message',
        error
      );
      expect(mockRemoteLogger.error).toHaveBeenCalledWith(message, error);
    });

    it('should detect category only once per log call', () => {
      hybridLogger.info('Test message');

      expect(mockCategoryDetector.detectCategory).toHaveBeenCalledTimes(1);
      expect(mockCategoryDetector.detectCategory).toHaveBeenCalledWith(
        'Test message'
      );
    });
  });

  describe('Console Message Formatting', () => {
    beforeEach(() => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: { categories: null, levels: null, enabled: true },
          remote: { categories: null, levels: null, enabled: false },
        }
      );
    });

    it('should format console message with detected category', () => {
      mockCategoryDetector.detectCategory.mockReturnValue('ui');

      hybridLogger.info('UI update message');

      expect(mockConsoleLogger.info).toHaveBeenCalledWith(
        '[UI:INFO] UI update message'
      );
    });

    it('should format console message with GENERAL when no category', () => {
      mockCategoryDetector.detectCategory.mockReturnValue(undefined);

      hybridLogger.info('Generic message');

      expect(mockConsoleLogger.info).toHaveBeenCalledWith(
        '[GENERAL:INFO] Generic message'
      );
    });

    it('should preserve original message for remote logger', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: { categories: null, levels: null, enabled: false },
          remote: { categories: null, levels: null, enabled: true },
        }
      );

      const originalMessage = 'Original message';
      hybridLogger.info(originalMessage);

      expect(mockRemoteLogger.info).toHaveBeenCalledWith(originalMessage);
    });
  });

  describe('Filtering Logic', () => {
    it('should filter console logs by category', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: { categories: ['ui'], levels: null, enabled: true },
          remote: { categories: null, levels: null, enabled: true },
        }
      );

      // Should log to console (category matches)
      mockCategoryDetector.detectCategory.mockReturnValue('ui');
      hybridLogger.info('UI message');
      expect(mockConsoleLogger.info).toHaveBeenCalled();
      expect(mockRemoteLogger.info).toHaveBeenCalled();

      jest.clearAllMocks();

      // Should not log to console (category doesn't match)
      mockCategoryDetector.detectCategory.mockReturnValue('engine');
      hybridLogger.info('Engine message');
      expect(mockConsoleLogger.info).not.toHaveBeenCalled();
      expect(mockRemoteLogger.info).toHaveBeenCalled();
    });

    it('should filter console logs by level', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: {
            categories: null,
            levels: ['warn', 'error'],
            enabled: true,
          },
          remote: { categories: null, levels: null, enabled: true },
        }
      );

      // Should log to console (level matches)
      hybridLogger.warn('Warning message');
      expect(mockConsoleLogger.warn).toHaveBeenCalled();
      expect(mockRemoteLogger.warn).toHaveBeenCalled();

      jest.clearAllMocks();

      // Should not log to console (level doesn't match)
      hybridLogger.info('Info message');
      expect(mockConsoleLogger.info).not.toHaveBeenCalled();
      expect(mockRemoteLogger.info).toHaveBeenCalled();
    });

    it('should filter remote logs independently', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: { categories: null, levels: null, enabled: true },
          remote: { categories: ['errors'], levels: ['error'], enabled: true },
        }
      );

      mockCategoryDetector.detectCategory.mockReturnValue('ui');

      // Should log to console but not remote
      hybridLogger.info('Info message');
      expect(mockConsoleLogger.info).toHaveBeenCalled();
      expect(mockRemoteLogger.info).not.toHaveBeenCalled();

      jest.clearAllMocks();

      mockCategoryDetector.detectCategory.mockReturnValue('errors');

      // Should log to both when conditions match
      hybridLogger.error('Error message');
      expect(mockConsoleLogger.error).toHaveBeenCalled();
      expect(mockRemoteLogger.error).toHaveBeenCalled();
    });

    it('should respect enabled flag for console', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: { categories: null, levels: null, enabled: false },
          remote: { categories: null, levels: null, enabled: true },
        }
      );

      // Clear initialization call
      jest.clearAllMocks();

      hybridLogger.info('Test message');

      expect(mockConsoleLogger.info).not.toHaveBeenCalled();
      expect(mockRemoteLogger.info).toHaveBeenCalled();
    });

    it('should respect enabled flag for remote', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: { categories: null, levels: null, enabled: true },
          remote: { categories: null, levels: null, enabled: false },
        }
      );

      hybridLogger.info('Test message');

      expect(mockConsoleLogger.info).toHaveBeenCalled();
      expect(mockRemoteLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('Critical Logging Bypass', () => {
    it('should bypass console filters for warnings when criticalLogging.alwaysShowInConsole is true', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: {
            categories: ['ui'], // Only UI category allowed
            levels: ['info'], // Only info level allowed
            enabled: true,
          },
          remote: { categories: null, levels: null, enabled: true },
          criticalLogging: {
            alwaysShowInConsole: true,
          },
        }
      );

      // Clear initialization call
      jest.clearAllMocks();

      // Mock category as 'engine' (not in allowed categories)
      mockCategoryDetector.detectCategory.mockReturnValue('engine');

      // Warning should bypass filters and appear in console
      hybridLogger.warn('Critical warning');

      expect(mockConsoleLogger.warn).toHaveBeenCalled();
      expect(mockConsoleLogger.warn).toHaveBeenCalledWith(
        '[ENGINE:WARN] Critical warning'
      );
    });

    it('should bypass console filters for errors when criticalLogging.alwaysShowInConsole is true', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: {
            categories: ['ui'], // Only UI category allowed
            levels: ['debug'], // Only debug level allowed
            enabled: true,
          },
          remote: { categories: null, levels: null, enabled: true },
          criticalLogging: {
            alwaysShowInConsole: true,
          },
        }
      );

      // Clear initialization call
      jest.clearAllMocks();

      // Mock category as 'engine' (not in allowed categories)
      mockCategoryDetector.detectCategory.mockReturnValue('engine');

      // Error should bypass filters and appear in console
      hybridLogger.error('Critical error');

      expect(mockConsoleLogger.error).toHaveBeenCalled();
      expect(mockConsoleLogger.error).toHaveBeenCalledWith(
        '[ENGINE:ERROR] Critical error'
      );
    });

    it('should still respect filters for info logs even with criticalLogging enabled', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: {
            categories: ['ui'], // Only UI category allowed
            levels: ['warn', 'error'], // Only warn/error allowed
            enabled: true,
          },
          remote: { categories: null, levels: null, enabled: true },
          criticalLogging: {
            alwaysShowInConsole: true,
          },
        }
      );

      // Clear initialization call
      jest.clearAllMocks();

      // Mock category as 'engine' (not in allowed categories)
      mockCategoryDetector.detectCategory.mockReturnValue('engine');

      // Info should still be filtered out
      hybridLogger.info('Regular info message');

      expect(mockConsoleLogger.info).not.toHaveBeenCalled();
      expect(mockRemoteLogger.info).toHaveBeenCalled();
    });

    it('should still respect filters for debug logs even with criticalLogging enabled', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: {
            categories: ['ui'], // Only UI category allowed
            levels: ['warn', 'error'], // Only warn/error allowed
            enabled: true,
          },
          remote: { categories: null, levels: null, enabled: true },
          criticalLogging: {
            alwaysShowInConsole: true,
          },
        }
      );

      // Clear initialization call
      jest.clearAllMocks();

      // Mock category as 'engine' (not in allowed categories)
      mockCategoryDetector.detectCategory.mockReturnValue('engine');

      // Debug should still be filtered out
      hybridLogger.debug('Debug message');

      expect(mockConsoleLogger.debug).not.toHaveBeenCalled();
      expect(mockRemoteLogger.debug).toHaveBeenCalled();
    });

    it('should restore original behavior when criticalLogging.alwaysShowInConsole is false', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: {
            categories: ['ui'], // Only UI category allowed
            levels: ['info'], // Only info level allowed
            enabled: true,
          },
          remote: { categories: null, levels: null, enabled: true },
          criticalLogging: {
            alwaysShowInConsole: false, // Disabled
          },
        }
      );

      // Clear initialization call
      jest.clearAllMocks();

      // Mock category as 'engine' (not in allowed categories)
      mockCategoryDetector.detectCategory.mockReturnValue('engine');

      // Warning should be filtered out when critical bypass is disabled
      hybridLogger.warn('Warning message');

      expect(mockConsoleLogger.warn).not.toHaveBeenCalled();
      expect(mockRemoteLogger.warn).toHaveBeenCalled();
    });

    it('should use default critical logging config when not provided', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: {
            categories: ['ui'], // Only UI category allowed
            levels: ['info'], // Only info level allowed
            enabled: true,
          },
          remote: { categories: null, levels: null, enabled: true },
          // No criticalLogging config provided
        }
      );

      // Clear initialization call
      jest.clearAllMocks();

      // Mock category as 'engine' (not in allowed categories)
      mockCategoryDetector.detectCategory.mockReturnValue('engine');

      // Should use default (alwaysShowInConsole: true)
      hybridLogger.error('Error with default config');

      expect(mockConsoleLogger.error).toHaveBeenCalled();
      expect(mockConsoleLogger.error).toHaveBeenCalledWith(
        '[ENGINE:ERROR] Error with default config'
      );
    });

    it('should handle partial critical logging config', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: {
            categories: ['ui'], // Only UI category allowed
            levels: ['info'], // Only info level allowed
            enabled: true,
          },
          remote: { categories: null, levels: null, enabled: true },
          criticalLogging: {
            alwaysShowInConsole: true,
            // Other properties will use defaults
          },
        }
      );

      // Clear initialization call
      jest.clearAllMocks();

      mockCategoryDetector.detectCategory.mockReturnValue('engine');

      // Should work with partial config
      hybridLogger.warn('Warning with partial config');

      expect(mockConsoleLogger.warn).toHaveBeenCalled();
    });

    it('should not affect remote logging filters', () => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: {
            categories: ['ui'],
            levels: ['info'],
            enabled: true,
          },
          remote: {
            categories: ['ui'], // Remote also has filters
            levels: ['info'],
            enabled: true,
          },
          criticalLogging: {
            alwaysShowInConsole: true,
          },
        }
      );

      // Clear initialization call
      jest.clearAllMocks();

      mockCategoryDetector.detectCategory.mockReturnValue('engine');

      // Error should bypass console filters but not remote filters
      hybridLogger.error('Error message');

      expect(mockConsoleLogger.error).toHaveBeenCalled(); // Bypassed console filter
      expect(mockRemoteLogger.error).not.toHaveBeenCalled(); // Still filtered for remote
    });
  });

  describe('Console-Specific Methods', () => {
    beforeEach(() => {
      hybridLogger = new HybridLogger({
        consoleLogger: mockConsoleLogger,
        remoteLogger: mockRemoteLogger,
        categoryDetector: mockCategoryDetector,
      });
    });

    it('should pass through groupCollapsed to console logger', () => {
      const label = 'Test Group';
      hybridLogger.groupCollapsed(label);

      expect(mockConsoleLogger.groupCollapsed).toHaveBeenCalledWith(label);
    });

    it('should pass through groupEnd to console logger', () => {
      hybridLogger.groupEnd();

      expect(mockConsoleLogger.groupEnd).toHaveBeenCalled();
    });

    it('should pass through table to console logger', () => {
      const data = [{ id: 1, name: 'test' }];
      const columns = ['id', 'name'];

      hybridLogger.table(data, columns);

      expect(mockConsoleLogger.table).toHaveBeenCalledWith(data, columns);
    });

    it('should pass through setLogLevel to console logger', () => {
      const logLevel = 'DEBUG';
      hybridLogger.setLogLevel(logLevel);

      expect(mockConsoleLogger.setLogLevel).toHaveBeenCalledWith(logLevel);
    });

    it('should not call console methods when console is disabled', () => {
      hybridLogger.updateFilters({
        console: { categories: null, levels: null, enabled: false },
      });

      hybridLogger.groupCollapsed('Test');
      hybridLogger.groupEnd();
      hybridLogger.table([]);

      expect(mockConsoleLogger.groupCollapsed).not.toHaveBeenCalled();
      expect(mockConsoleLogger.groupEnd).not.toHaveBeenCalled();
      expect(mockConsoleLogger.table).not.toHaveBeenCalled();
    });

    it('should handle missing console methods gracefully', () => {
      const limitedConsoleLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        // Missing optional methods
      };

      hybridLogger = new HybridLogger({
        consoleLogger: limitedConsoleLogger,
        remoteLogger: mockRemoteLogger,
        categoryDetector: mockCategoryDetector,
      });

      expect(() => {
        hybridLogger.groupCollapsed('Test');
        hybridLogger.groupEnd();
        hybridLogger.table([]);
        hybridLogger.setLogLevel('INFO');
      }).not.toThrow();
    });
  });

  describe('Filter Configuration Methods', () => {
    beforeEach(() => {
      hybridLogger = new HybridLogger({
        consoleLogger: mockConsoleLogger,
        remoteLogger: mockRemoteLogger,
        categoryDetector: mockCategoryDetector,
      });
    });

    it('should update console filter via setConsoleFilter', () => {
      const categories = ['ui', 'engine'];
      const levels = ['warn', 'error'];

      hybridLogger.setConsoleFilter(categories, levels);

      const filters = hybridLogger.getFilters();
      expect(filters.console.categories).toEqual(categories);
      expect(filters.console.levels).toEqual(levels);
    });

    it('should update remote filter via setRemoteFilter', () => {
      const categories = ['network'];
      const levels = ['debug'];

      hybridLogger.setRemoteFilter(categories, levels);

      const filters = hybridLogger.getFilters();
      expect(filters.remote.categories).toEqual(categories);
      expect(filters.remote.levels).toEqual(levels);
    });

    it('should update entire filter configuration', () => {
      const newFilters = {
        console: { categories: ['test'], levels: ['info'], enabled: false },
        remote: { categories: null, levels: ['error'], enabled: true },
      };

      hybridLogger.updateFilters(newFilters);

      const filters = hybridLogger.getFilters();
      expect(filters.console.enabled).toBe(false);
      expect(filters.remote.levels).toEqual(['error']);
    });

    it('should return deep copy of filters via getFilters', () => {
      const filters = hybridLogger.getFilters();
      filters.console.enabled = false;

      const originalFilters = hybridLogger.getFilters();
      expect(originalFilters.console.enabled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      hybridLogger = new HybridLogger(
        {
          consoleLogger: mockConsoleLogger,
          remoteLogger: mockRemoteLogger,
          categoryDetector: mockCategoryDetector,
        },
        {
          console: { categories: null, levels: null, enabled: true },
          remote: { categories: null, levels: null, enabled: true },
        }
      );
    });

    it('should continue remote logging when console logging fails', () => {
      mockConsoleLogger.info.mockImplementation(() => {
        throw new Error('Console logging failed');
      });

      // Mock global console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();

      hybridLogger.info('Test message');

      expect(mockRemoteLogger.info).toHaveBeenCalledWith('Test message');
      expect(console.error).toHaveBeenCalledWith(
        '[HybridLogger] Console logging failed:',
        expect.any(Error)
      );

      // Restore original console.error
      console.error = originalConsoleError;
    });

    it('should continue console logging when remote logging fails', () => {
      mockRemoteLogger.info.mockImplementation(() => {
        throw new Error('Remote logging failed');
      });

      hybridLogger.info('Test message');

      expect(mockConsoleLogger.info).toHaveBeenCalledWith(
        '[ENGINE:INFO] Test message'
      );
      expect(mockConsoleLogger.error).toHaveBeenCalledWith(
        '[HybridLogger] Remote logging failed:',
        expect.any(Error)
      );
    });

    it('should handle category detection failure gracefully', () => {
      mockCategoryDetector.detectCategory.mockImplementation(() => {
        throw new Error('Category detection failed');
      });

      // Mock global console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();

      hybridLogger.info('Test message');

      expect(console.error).toHaveBeenCalledWith(
        '[HybridLogger] Critical logging failure:',
        expect.any(Error),
        'Original message:',
        'Test message'
      );

      // Restore original console.error
      console.error = originalConsoleError;
    });

    it('should handle complete failure gracefully when console.error is available', () => {
      // Make everything throw
      mockCategoryDetector.detectCategory.mockImplementation(() => {
        throw new Error('Category detection failed');
      });

      // Mock global console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();

      hybridLogger.info('Test message');

      expect(console.error).toHaveBeenCalled();

      // Restore original console.error
      console.error = originalConsoleError;
    });
  });

  describe('Filter Matching Edge Cases', () => {
    beforeEach(() => {
      hybridLogger = new HybridLogger({
        consoleLogger: mockConsoleLogger,
        remoteLogger: mockRemoteLogger,
        categoryDetector: mockCategoryDetector,
      });
    });

    it('should handle null category with category filter', () => {
      hybridLogger.updateFilters({
        console: { categories: ['ui'], levels: null, enabled: true },
        remote: { categories: null, levels: null, enabled: false },
      });

      // Clear initialization call
      jest.clearAllMocks();

      mockCategoryDetector.detectCategory.mockReturnValue(null);

      hybridLogger.info('Message with no category');

      expect(mockConsoleLogger.info).not.toHaveBeenCalled();
    });

    it('should handle undefined category with category filter', () => {
      hybridLogger.updateFilters({
        console: { categories: ['ui'], levels: null, enabled: true },
        remote: { categories: null, levels: null, enabled: false },
      });

      // Clear initialization call
      jest.clearAllMocks();

      mockCategoryDetector.detectCategory.mockReturnValue(undefined);

      hybridLogger.info('Message with undefined category');

      expect(mockConsoleLogger.info).not.toHaveBeenCalled();
    });

    it('should pass through when category filter is null', () => {
      hybridLogger.updateFilters({
        console: { categories: null, levels: null, enabled: true },
        remote: { categories: null, levels: null, enabled: false },
      });

      mockCategoryDetector.detectCategory.mockReturnValue(undefined);

      hybridLogger.info('Message with no category restrictions');

      expect(mockConsoleLogger.info).toHaveBeenCalled();
    });

    it('should pass through when level filter is null', () => {
      hybridLogger.updateFilters({
        console: { categories: null, levels: null, enabled: true },
        remote: { categories: null, levels: null, enabled: false },
      });

      hybridLogger.debug('Debug message with no level restrictions');

      expect(mockConsoleLogger.debug).toHaveBeenCalled();
    });
  });
});
