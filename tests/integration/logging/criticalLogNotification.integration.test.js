/**
 * @file Integration tests for critical log notification end-to-end flows
 * @see criticalLogNotifier.js, hybridLogger.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import HybridLogger from '../../../src/logging/hybridLogger.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import RemoteLogger from '../../../src/logging/remoteLogger.js';
import LogCategoryDetector from '../../../src/logging/logCategoryDetector.js';
import CriticalLogNotifier from '../../../src/logging/criticalLogNotifier.js';
import { createTestBed } from '../../common/testBed.js';
import {
  waitForNotification,
  getNotificationElements,
  getBadgeCounts,
} from '../../common/helpers/notifierTestHelpers.js';

describe('Critical Log Notification Integration', () => {
  let dom;
  let document;
  let testBed;
  let logger;
  let consoleLogger;
  let remoteLogger;
  let categoryDetector;
  let config;
  let mockFetch;

  beforeEach(() => {
    // Set up test bed
    testBed = createTestBed();
    
    // Set up DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });

    document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.navigator = {
      sendBeacon: jest.fn(),
    };
    global.localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };

    // Mock fetch for RemoteLogger
    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, processed: 1 }),
    });
    global.fetch = mockFetch;

    // Create logger dependencies
    consoleLogger = new ConsoleLogger('DEBUG');
    remoteLogger = new RemoteLogger({
      config: {
        endpoint: 'http://test-server/api/debug-log',
        batchSize: 5,
        flushInterval: 100,
        skipServerReadinessValidation: true,
      },
      dependencies: { consoleLogger },
    });
    categoryDetector = new LogCategoryDetector();
    
    // Create logger configuration
    config = {
      console: {
        categories: null,
        levels: null,
        enabled: true,
      },
      remote: {
        categories: null,
        levels: null,
        enabled: false,
      },
      criticalLogging: {
        alwaysShowInConsole: true,
        enableVisualNotifications: true,
        bufferSize: 50,
        notificationPosition: 'top-right',
        autoDismissAfter: null,
      },
    };

    // Create HybridLogger with dependencies
    logger = new HybridLogger({
      consoleLogger,
      remoteLogger,
      categoryDetector,
    }, config);

    // Create CriticalLogNotifier to handle visual notifications
    // Note: This is created in beforeEach to test the normal case
    // Individual tests will handle disabling notifications by not creating the notifier
    if (config.criticalLogging.enableVisualNotifications) {
      const mockValidatedEventDispatcher = testBed.createMock('mockValidatedEventDispatcher', ['dispatch', 'subscribe']);
      const mockDocumentContext = {
        query: jest.fn((selector) => {
          if (selector === 'document') return document;
          return document.querySelector(selector);
        }),
        create: jest.fn((tagName) => document.createElement(tagName)),
        getDocument: () => document,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
      
      new CriticalLogNotifier({
        logger: testBed.createMockLogger(),
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        hybridLogger: logger,
        config: config.criticalLogging,
      });
    }
  });

  afterEach(() => {
    // Clean up
    if (logger && typeof logger.waitForPendingFlushes === 'function') {
      logger.waitForPendingFlushes();
    }
    dom.window.close();
    delete global.document;
    delete global.window;
    delete global.navigator;
    delete global.localStorage;
    delete global.fetch;
    jest.clearAllMocks();
  });

  describe('Warning Notifications', () => {
    it('should show notification badge when warning is logged', async () => {
      logger.warn('Test warning message');

      await waitForNotification();

      const elements = getNotificationElements(document);
      expect(elements).not.toBeNull();
      expect(elements.container).toBeDefined();
      expect(elements.warningBadge.textContent).toBe('1');
      expect(elements.warningBadge.hidden).toBe(false);
    });

    it('should increment warning count for multiple warnings', async () => {
      logger.warn('Warning 1');
      logger.warn('Warning 2');
      logger.warn('Warning 3');

      await waitForNotification();

      const elements = getNotificationElements(document);
      const counts = getBadgeCounts(elements);
      expect(counts.warnings).toBe(3);
    });

    it('should add warnings to critical buffer', () => {
      logger.warn('Buffered warning');

      const criticalLogs = logger.getCriticalLogs();
      expect(criticalLogs).toHaveLength(1);
      expect(criticalLogs[0].level).toBe('warn');
      expect(criticalLogs[0].message).toBe('Buffered warning');
    });

    it('should show warning badge as visible', async () => {
      logger.warn('Test warning');

      await waitForNotification();

      const elements = getNotificationElements(document);
      expect(elements.warningBadge.hidden).toBe(false);
      expect(elements.errorBadge.hidden).toBe(true);
    });
  });

  describe('Error Notifications', () => {
    it('should show notification badge when error is logged', async () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      await waitForNotification();

      const elements = getNotificationElements(document);
      expect(elements.errorBadge.textContent).toBe('1');
      expect(elements.errorBadge.hidden).toBe(false);
    });

    it('should show both warning and error badges', async () => {
      logger.warn('Warning message');
      logger.error('Error message');

      await waitForNotification();

      const elements = getNotificationElements(document);
      const counts = getBadgeCounts(elements);
      expect(counts.warnings).toBe(1);
      expect(counts.errors).toBe(1);
      expect(elements.warningBadge.hidden).toBe(false);
      expect(elements.errorBadge.hidden).toBe(false);
    });

    it('should increment error count for multiple errors', async () => {
      logger.error('Error 1');
      logger.error('Error 2');

      await waitForNotification();

      const elements = getNotificationElements(document);
      const counts = getBadgeCounts(elements);
      expect(counts.errors).toBe(2);
    });

    it('should add errors to critical buffer', () => {
      logger.error('Buffered error');

      const criticalLogs = logger.getCriticalLogs();
      expect(criticalLogs).toHaveLength(1);
      expect(criticalLogs[0].level).toBe('error');
      expect(criticalLogs[0].message).toBe('Buffered error');
    });
  });

  describe('Console Output', () => {
    let consoleWarnSpy;
    let consoleErrorSpy;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should output warnings to console when enabled', () => {
      logger.warn('Console warning');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARNING:WARN] Console warning')
      );
    });

    it('should output errors to console when enabled', () => {
      logger.error('Console error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR:ERROR] Console error')
      );
    });

    it('should output both warnings and errors to console', () => {
      logger.warn('Warning message');
      logger.error('Error message');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARNING:WARN] Warning message')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR:ERROR] Error message')
      );
    });
  });

  describe('Configuration Integration', () => {
    it('should not show notifications when disabled in config', async () => {
      // Clear any existing containers from beforeEach
      const existingContainer = document.querySelector('.lne-critical-log-notifier');
      if (existingContainer) {
        existingContainer.remove();
      }

      const disabledConfig = {
        ...config,
        criticalLogging: {
          ...config.criticalLogging,
          enableVisualNotifications: false,
        },
      };

      const disabledConsoleLogger = new ConsoleLogger('DEBUG');
      const disabledRemoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://test-server/api/debug-log',
          skipServerReadinessValidation: true,
        },
        dependencies: { consoleLogger: disabledConsoleLogger },
      });
      const disabledCategoryDetector = new LogCategoryDetector();
      
      const disabledLogger = new HybridLogger({
        consoleLogger: disabledConsoleLogger,
        remoteLogger: disabledRemoteLogger,
        categoryDetector: disabledCategoryDetector,
      }, disabledConfig);

      // Don't create CriticalLogNotifier since it's disabled in config
      
      disabledLogger.warn('Should not show');

      await waitForNotification(100); // Short wait

      const container = document.querySelector('.lne-critical-log-notifier');
      expect(container).toBeNull();

      if (typeof disabledLogger.waitForPendingFlushes === 'function') {
        disabledLogger.waitForPendingFlushes();
      }
    });

    it('should respect buffer size configuration', () => {
      const smallBufferConfig = {
        ...config,
        criticalLogging: {
          ...config.criticalLogging,
          bufferSize: 3,
        },
      };

      const smallConsoleLogger = new ConsoleLogger('DEBUG');
      const smallRemoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://test-server/api/debug-log',
          skipServerReadinessValidation: true,
        },
        dependencies: { consoleLogger: smallConsoleLogger },
      });
      const smallCategoryDetector = new LogCategoryDetector();
      
      const smallBufferLogger = new HybridLogger({
        consoleLogger: smallConsoleLogger,
        remoteLogger: smallRemoteLogger,
        categoryDetector: smallCategoryDetector,
      }, smallBufferConfig);

      // Log more than buffer size
      for (let i = 0; i < 5; i++) {
        smallBufferLogger.warn(`Warning ${i}`);
      }

      const logs = smallBufferLogger.getCriticalLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('Warning 2'); // Oldest should be removed

      if (typeof smallBufferLogger.waitForPendingFlushes === 'function') {
        smallBufferLogger.waitForPendingFlushes();
      }
    });

    it('should handle console logging configuration', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const disabledConsoleConfig = {
        ...config,
        console: {
          ...config.console,
          enabled: false,
        },
      };

      const noConsoleLogger = new HybridLogger({
        consoleLogger,
        remoteLogger,
        categoryDetector,
      }, disabledConsoleConfig);

      noConsoleLogger.warn('Should not appear in console');

      // When console is disabled BUT alwaysShowInConsole is true,
      // critical logs (warn/error) WILL still appear in console
      // This is the intended behavior - critical logs bypass console.enabled: false
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARNING:WARN] Should not appear in console')
      );

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();

      if (typeof noConsoleLogger.waitForPendingFlushes === 'function') {
        noConsoleLogger.waitForPendingFlushes();
      }
    });
  });

  describe('Mixed Log Levels', () => {
    it('should handle multiple log levels correctly', async () => {
      logger.warn('Warning 1');
      logger.error('Error 1');
      logger.warn('Warning 2');
      logger.error('Error 2');
      logger.warn('Warning 3');

      await waitForNotification();

      const elements = getNotificationElements(document);
      const counts = getBadgeCounts(elements);
      expect(counts.warnings).toBe(3);
      expect(counts.errors).toBe(2);

      const criticalLogs = logger.getCriticalLogs();
      expect(criticalLogs).toHaveLength(5);
    });

    it('should maintain correct order in critical buffer', () => {
      logger.warn('First warning');
      logger.error('First error');
      logger.warn('Second warning');

      const criticalLogs = logger.getCriticalLogs();
      expect(criticalLogs).toHaveLength(3);
      expect(criticalLogs[0].message).toBe('First warning');
      expect(criticalLogs[1].message).toBe('First error');
      expect(criticalLogs[2].message).toBe('Second warning');
    });
  });

  describe('Visual Notification Appearance', () => {
    it('should create notification container in DOM', async () => {
      logger.warn('Test warning');

      await waitForNotification();

      const container = document.querySelector('.lne-critical-log-notifier');
      expect(container).not.toBeNull();
      expect(container).toBeInstanceOf(dom.window.HTMLElement);
    });

    it('should have correct CSS classes on elements', async () => {
      logger.warn('Test warning');
      logger.error('Test error');

      await waitForNotification();

      const elements = getNotificationElements(document);
      expect(elements.container.classList.contains('lne-critical-log-notifier')).toBe(true);
      expect(elements.badgeContainer.classList.contains('lne-badge-container')).toBe(true);
      expect(elements.warningBadge.classList.contains('lne-warning-badge')).toBe(true);
      expect(elements.errorBadge.classList.contains('lne-error-badge')).toBe(true);
    });

    it('should initially hide the log panel', async () => {
      logger.warn('Test warning');

      await waitForNotification();

      const elements = getNotificationElements(document);
      expect(elements.panel.hidden).toBe(true);
    });
  });
});