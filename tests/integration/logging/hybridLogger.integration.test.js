/**
 * @file Integration tests for HybridLogger with real dependencies
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
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import RemoteLogger from '../../../src/logging/remoteLogger.js';
import LogCategoryDetector from '../../../src/logging/logCategoryDetector.js';

// Mock fetch globally for RemoteLogger
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock sendBeacon for RemoteLogger
const mockSendBeacon = jest.fn();

// Store original values
const originalWindow = global.window;
const originalDocument = global.document;
const originalNavigator = global.navigator;

describe('HybridLogger Integration', () => {
  let consoleLogger;
  let remoteLogger;
  let categoryDetector;
  let hybridLogger;
  let originalConsoleLog;
  let originalConsoleWarn;
  let originalConsoleError;
  let originalConsoleDebug;

  beforeEach(() => {
    // Set up browser environment mocks for RemoteLogger
    global.window = {
      addEventListener: jest.fn(),
    };
    global.document = {
      addEventListener: jest.fn(),
      visibilityState: 'visible',
    };
    global.navigator = {
      sendBeacon: mockSendBeacon,
    };

    // Mock console methods to capture calls
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    originalConsoleDebug = console.debug;

    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    console.debug = jest.fn();
    console.groupCollapsed = jest.fn();
    console.groupEnd = jest.fn();
    console.table = jest.fn();

    // Create real instances
    consoleLogger = new ConsoleLogger('DEBUG');
    remoteLogger = new RemoteLogger({
      config: {
        endpoint: 'http://test-server/api/debug-log',
        batchSize: 5,
        flushInterval: 100,
      },
      dependencies: {
        consoleLogger: consoleLogger,
      },
    });
    categoryDetector = new LogCategoryDetector();

    // Mock successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, processed: 1 }),
    });

    // Create HybridLogger with real dependencies and permissive filters for testing
    hybridLogger = new HybridLogger(
      {
        consoleLogger,
        remoteLogger,
        categoryDetector,
      },
      {
        console: { categories: null, levels: null, enabled: true },
        remote: { categories: null, levels: null, enabled: true },
      }
    );

    // Clear mocks after creation to ignore initialization messages
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();

    // Restore original console methods
    console.info = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    console.debug = originalConsoleDebug;

    // Restore global mocks
    global.window = originalWindow;
    global.document = originalDocument;
    global.navigator = originalNavigator;
  });

  describe('Real Logger Integration', () => {
    it('should log to both real console and remote loggers', async () => {
      const testMessage = 'Integration test message';

      hybridLogger.info(testMessage);

      // Should log to console with formatting
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining(testMessage)
      );

      // Wait for remote logger batch processing
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should attempt to send to remote endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-server/api/debug-log',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining(testMessage),
        })
      );
    });

    it('should handle real category detection', () => {
      hybridLogger.info('GameEngine initialization started');

      // Should detect 'engine' category and format console message
      expect(console.info).toHaveBeenCalledWith(
        '[ENGINE:INFO] GameEngine initialization started'
      );
    });

    it('should handle UI-related logs', () => {
      hybridLogger.debug('Renderer updating display elements');

      // Should detect 'ui' category
      expect(console.debug).toHaveBeenCalledWith(
        '[UI:DEBUG] Renderer updating display elements'
      );
    });

    it('should handle error logs with immediate flush', async () => {
      const errorMessage = 'Critical error occurred';

      hybridLogger.error(errorMessage);

      // Console should log immediately
      expect(console.error).toHaveBeenCalledWith(
        '[ERROR:ERROR] Critical error occurred'
      );

      // Remote should flush immediately for errors (no need to wait for batch)
      // Wait a bit for the remote flush
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Filter Integration', () => {
    it('should filter console output based on category in real scenario', () => {
      // Set console to only show 'error' category (not 'errors')
      hybridLogger.setConsoleFilter(['error'], null);

      // This should not appear in console (wrong category)
      hybridLogger.info('GameEngine: Normal operation');
      expect(console.info).not.toHaveBeenCalled();

      // This should appear in console (matches category)
      hybridLogger.error('Database connection failed');
      expect(console.error).toHaveBeenCalled();
    });

    it('should filter by log level effectively', () => {
      // Set console to only show warnings and errors
      hybridLogger.setConsoleFilter(null, ['warn', 'error']);

      // Should not show debug/info
      hybridLogger.debug('Debug information');
      hybridLogger.info('Information message');
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();

      // Should show warnings and errors
      hybridLogger.warn('Warning message');
      hybridLogger.error('Error message');
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it('should maintain remote logging when console is filtered', async () => {
      // Disable console, keep remote
      hybridLogger.updateFilters({
        console: { categories: null, levels: null, enabled: false },
        remote: { categories: null, levels: null, enabled: true },
      });

      hybridLogger.info('Remote-only message');

      // Should not log to console
      expect(console.info).not.toHaveBeenCalled();

      // Should still log to remote
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Console-Specific Methods Integration', () => {
    it('should handle console grouping with real console logger', () => {
      hybridLogger.groupCollapsed('Test Group');
      hybridLogger.info('Message in group');
      hybridLogger.groupEnd();

      expect(console.groupCollapsed).toHaveBeenCalledWith('Test Group');
      expect(console.info).toHaveBeenCalled();
      expect(console.groupEnd).toHaveBeenCalled();
    });

    it('should handle console table with real console logger', () => {
      const testData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];

      hybridLogger.table(testData);

      expect(console.table).toHaveBeenCalledWith(testData, undefined);
    });

    it('should handle log level changes through real console logger', () => {
      hybridLogger.setLogLevel('ERROR');

      // Debug should not show after setting to ERROR level
      hybridLogger.debug('This should not appear');
      expect(console.debug).not.toHaveBeenCalled();

      // Error should still show
      hybridLogger.error('This should appear');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle remote logging failures gracefully', async () => {
      // Make fetch fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      hybridLogger.info('Message during network failure');

      // Console should still work
      expect(console.info).toHaveBeenCalled();

      // Wait for remote failure and fallback logging
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should have attempted the remote call
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should isolate console failures from remote logging', async () => {
      // Make console.info throw
      console.info.mockImplementation(() => {
        throw new Error('Console error');
      });

      hybridLogger.info('Message during console failure');

      // Remote should still work
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Category Detection Integration', () => {
    it('should detect various categories correctly', () => {
      const testCases = [
        { message: 'EntityManager created new actor', expectedCategory: 'ECS' },
        { message: 'AI decision making process', expectedCategory: 'AI' },
        {
          message: 'validation constraint check',
          expectedCategory: 'VALIDATION',
        },
        { message: 'Network request timeout', expectedCategory: 'NETWORK' },
        { message: 'Error occurred in system', expectedCategory: 'ERROR' },
      ];

      testCases.forEach(({ message, expectedCategory }) => {
        jest.clearAllMocks();
        hybridLogger.info(message);

        expect(console.info).toHaveBeenCalledWith(
          `[${expectedCategory}:INFO] ${message}`
        );
      });
    });
  });
});
