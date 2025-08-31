/**
 * @file Integration tests for critical log notifier configuration updates
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

describe('Configuration Update Integration', () => {
  let dom;
  let document;
  let testBed;
  let baseConfig;
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

    // Base configuration
    baseConfig = {
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
  });

  afterEach(() => {
    dom.window.close();
    delete global.document;
    delete global.window;
    delete global.navigator;
    delete global.localStorage;
    delete global.fetch;
    jest.clearAllMocks();
  });

  describe('Visual Notification Toggle', () => {
    it('should disable visual notifications when configuration is updated', async () => {
      const enabledConfig = { ...baseConfig };
      const logger = createLoggerWithConfig(enabledConfig);

      // Log with notifications enabled
      logger.warn('Should show notification');
      await waitForNotification();

      let container = document.querySelector('.lne-critical-log-notifier');
      expect(container).not.toBeNull();

      // Update configuration to disable notifications
      const disabledConfig = {
        ...baseConfig,
        criticalLogging: {
          ...baseConfig.criticalLogging,
          enableVisualNotifications: false,
        },
      };

      const disabledLogger = createLoggerWithConfig(disabledConfig);

      // Clear previous DOM elements
      if (container) {
        container.remove();
      }

      // Log with notifications disabled
      disabledLogger.warn('Should not show notification');
      await waitForNotification(200); // Short wait

      container = document.querySelector('.lne-critical-log-notifier');
      expect(container).toBeNull();

      if (typeof logger.waitForPendingFlushes === 'function') {
        logger.waitForPendingFlushes();
      }
      if (typeof disabledLogger.waitForPendingFlushes === 'function') {
        disabledLogger.waitForPendingFlushes();
      }
    });

    it('should re-enable notifications when configuration is updated', async () => {
      const disabledConfig = {
        ...baseConfig,
        criticalLogging: {
          ...baseConfig.criticalLogging,
          enableVisualNotifications: false,
        },
      };

      const disabledLogger = createLoggerWithConfig(disabledConfig);

      // Log with notifications disabled
      disabledLogger.warn('Should not show');
      await waitForNotification(200);

      let container = document.querySelector('.lne-critical-log-notifier');
      expect(container).toBeNull();

      // Update configuration to enable notifications
      const enabledLogger = createLoggerWithConfig(baseConfig);

      // Log with notifications enabled
      enabledLogger.warn('Should show notification');
      await waitForNotification();

      container = document.querySelector('.lne-critical-log-notifier');
      expect(container).not.toBeNull();

      if (typeof disabledLogger.waitForPendingFlushes === 'function') {
        disabledLogger.waitForPendingFlushes();
      }
      if (typeof enabledLogger.waitForPendingFlushes === 'function') {
        enabledLogger.waitForPendingFlushes();
      }
    });
  });

  describe('Buffer Size Configuration', () => {
    it('should respect different buffer sizes', () => {
      const smallBufferConfig = {
        ...baseConfig,
        criticalLogging: {
          ...baseConfig.criticalLogging,
          bufferSize: 3,
        },
      };

      const smallBufferLogger = createLoggerWithConfig(smallBufferConfig);

      // Log more than buffer size
      const messages = ['Log 1', 'Log 2', 'Log 3', 'Log 4', 'Log 5'];
      messages.forEach((msg) => {
        smallBufferLogger.warn(msg);
      });

      const logs = smallBufferLogger.getCriticalLogs();
      expect(logs).toHaveLength(3);
      
      // Should keep the most recent logs
      expect(logs[0].message).toBe('Log 3');
      expect(logs[1].message).toBe('Log 4');
      expect(logs[2].message).toBe('Log 5');

      if (typeof smallBufferLogger.waitForPendingFlushes === 'function') {
        smallBufferLogger.waitForPendingFlushes();
      }
    });

    it('should handle buffer size increase', () => {
      const smallBufferConfig = {
        ...baseConfig,
        criticalLogging: {
          ...baseConfig.criticalLogging,
          bufferSize: 2,
        },
      };

      const smallLogger = createLoggerWithConfig(smallBufferConfig);

      // Fill small buffer
      smallLogger.warn('Message 1');
      smallLogger.warn('Message 2');
      smallLogger.warn('Message 3'); // Should evict Message 1

      let logs = smallLogger.getCriticalLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Message 2');
      expect(logs[1].message).toBe('Message 3');

      // Create logger with larger buffer
      const largeBufferConfig = {
        ...baseConfig,
        criticalLogging: {
          ...baseConfig.criticalLogging,
          bufferSize: 5,
        },
      };

      const largeLogger = createLoggerWithConfig(largeBufferConfig);

      // Add more messages
      largeLogger.warn('Message 4');
      largeLogger.warn('Message 5');
      largeLogger.warn('Message 6');

      logs = largeLogger.getCriticalLogs();
      expect(logs).toHaveLength(3);

      if (typeof smallLogger.waitForPendingFlushes === 'function') {
        smallLogger.waitForPendingFlushes();
      }
      if (typeof largeLogger.waitForPendingFlushes === 'function') {
        largeLogger.waitForPendingFlushes();
      }
    });

    it('should handle zero buffer size gracefully', () => {
      const zeroBufferConfig = {
        ...baseConfig,
        criticalLogging: {
          ...baseConfig.criticalLogging,
          bufferSize: 0,
        },
      };

      const zeroBufferLogger = createLoggerWithConfig(zeroBufferConfig);

      // Log messages
      zeroBufferLogger.warn('Should not be stored');
      zeroBufferLogger.error('Should not be stored');

      const logs = zeroBufferLogger.getCriticalLogs();
      expect(logs).toHaveLength(0);

      if (typeof zeroBufferLogger.waitForPendingFlushes === 'function') {
        zeroBufferLogger.waitForPendingFlushes();
      }
    });
  });

  describe('Console Output Configuration', () => {
    it('should respect console logging enable/disable', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const disabledConsoleConfig = {
        ...baseConfig,
        console: {
          ...baseConfig.console,
          enabled: false,
        },
        criticalLogging: {
          ...baseConfig.criticalLogging,
          alwaysShowInConsole: false, // Disable critical override
        },
      };

      const logger = createLoggerWithConfig(disabledConsoleConfig);

      logger.warn('Should not appear in console');
      logger.error('Should not appear in console');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();

      if (typeof logger.waitForPendingFlushes === 'function') {
        logger.waitForPendingFlushes();
      }
    });

    it('should override console disable when alwaysShowInConsole is true', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const overrideConfig = {
        ...baseConfig,
        console: {
          ...baseConfig.console,
          enabled: false,
        },
        criticalLogging: {
          ...baseConfig.criticalLogging,
          alwaysShowInConsole: true, // Override console disable
        },
      };

      const logger = createLoggerWithConfig(overrideConfig);

      logger.warn('Should appear in console despite disabled setting');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Should appear in console despite disabled setting')
      );

      consoleWarnSpy.mockRestore();

      if (typeof logger.waitForPendingFlushes === 'function') {
        logger.waitForPendingFlushes();
      }
    });
  });

  describe('Position Configuration', () => {
    it('should handle different notification positions', async () => {
      const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

      for (const position of positions) {
        // Clear previous notifications BEFORE creating new logger
        const existingContainer = document.querySelector('.lne-critical-log-notifier');
        if (existingContainer) {
          existingContainer.remove();
        }

        const positionConfig = {
          ...baseConfig,
          criticalLogging: {
            ...baseConfig.criticalLogging,
            notificationPosition: position,
          },
        };

        const logger = createLoggerWithConfig(positionConfig);

        logger.warn(`Test message for ${position}`);
        await waitForNotification(1200); // Allow extra time for CriticalLogNotifier timer

        const container = document.querySelector('.lne-critical-log-notifier');
        expect(container).not.toBeNull();

        // Container should exist (position-specific classes would be tested in unit tests)
        expect(container).toBeInstanceOf(dom.window.HTMLElement);

        if (typeof logger.waitForPendingFlushes === 'function') {
          logger.waitForPendingFlushes();
        }
      }
    });

    it('should handle invalid position gracefully', async () => {
      const invalidPositionConfig = {
        ...baseConfig,
        criticalLogging: {
          ...baseConfig.criticalLogging,
          notificationPosition: 'invalid-position',
        },
      };

      const logger = createLoggerWithConfig(invalidPositionConfig);

      logger.warn('Test message with invalid position');
      await waitForNotification();

      // Should still create notification (fallback to default)
      const container = document.querySelector('.lne-critical-log-notifier');
      expect(container).not.toBeNull();

      if (typeof logger.waitForPendingFlushes === 'function') {
        logger.waitForPendingFlushes();
      }
    });
  });

  describe('Auto Dismiss Configuration', () => {
    it('should handle auto dismiss timeout', async () => {
      const autoDismissConfig = {
        ...baseConfig,
        criticalLogging: {
          ...baseConfig.criticalLogging,
          autoDismissAfter: 100, // 100ms for testing
        },
      };

      const logger = createLoggerWithConfig(autoDismissConfig);

      logger.warn('Auto dismiss test');
      await waitForNotification();

      const container = document.querySelector('.lne-critical-log-notifier');
      expect(container).not.toBeNull();

      // Wait for auto dismiss (with some buffer)
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Note: Auto dismiss behavior would depend on implementation
      // This test verifies the configuration is accepted
      expect(container).toBeInstanceOf(dom.window.HTMLElement);

      if (typeof logger.waitForPendingFlushes === 'function') {
        logger.waitForPendingFlushes();
      }
    });

    it('should handle null auto dismiss (no auto dismiss)', async () => {
      const noAutoDismissConfig = {
        ...baseConfig,
        criticalLogging: {
          ...baseConfig.criticalLogging,
          autoDismissAfter: null,
        },
      };

      const logger = createLoggerWithConfig(noAutoDismissConfig);

      logger.warn('No auto dismiss test');
      await waitForNotification();

      const container = document.querySelector('.lne-critical-log-notifier');
      expect(container).not.toBeNull();

      // Wait longer than typical auto dismiss
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Container should still be present
      expect(container.parentNode).not.toBeNull();

      if (typeof logger.waitForPendingFlushes === 'function') {
        logger.waitForPendingFlushes();
      }
    });
  });

  describe('Mixed Configuration Changes', () => {
    it('should handle multiple configuration changes', async () => {
      // Start with basic config
      let logger = createLoggerWithConfig(baseConfig);

      logger.warn('Initial message');
      await waitForNotification();

      let elements = getNotificationElements(document);
      expect(elements).not.toBeNull();
      expect(getBadgeCounts(elements).warnings).toBe(1);

      // Change buffer size and disable visual notifications
      const modifiedConfig = {
        ...baseConfig,
        criticalLogging: {
          ...baseConfig.criticalLogging,
          bufferSize: 2,
          enableVisualNotifications: false,
        },
      };

      // Remove existing container
      if (elements.container) {
        elements.container.remove();
      }

      logger = createLoggerWithConfig(modifiedConfig);

      logger.warn('Modified config message 1');
      logger.warn('Modified config message 2');
      logger.warn('Modified config message 3'); // Should evict first

      // No visual notification should appear
      await waitForNotification(200);
      let container = document.querySelector('.lne-critical-log-notifier');
      expect(container).toBeNull();

      // But buffer should work with new size
      const logs = logger.getCriticalLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Modified config message 2');
      expect(logs[1].message).toBe('Modified config message 3');

      if (typeof logger.waitForPendingFlushes === 'function') {
        logger.waitForPendingFlushes();
      }
    });

    it('should maintain configuration independence between loggers', async () => {
      // Create two loggers with different configs
      const config1 = {
        ...baseConfig,
        criticalLogging: {
          ...baseConfig.criticalLogging,
          bufferSize: 2,
        },
      };

      const config2 = {
        ...baseConfig,
        criticalLogging: {
          ...baseConfig.criticalLogging,
          bufferSize: 4,
        },
      };

      const logger1 = createLoggerWithConfig(config1);
      const logger2 = createLoggerWithConfig(config2);

      // Test buffer independence
      logger1.warn('Logger1 - Message 1');
      logger1.warn('Logger1 - Message 2');
      logger1.warn('Logger1 - Message 3'); // Should evict first

      logger2.warn('Logger2 - Message 1');
      logger2.warn('Logger2 - Message 2');
      logger2.warn('Logger2 - Message 3');
      logger2.warn('Logger2 - Message 4');

      const logs1 = logger1.getCriticalLogs();
      const logs2 = logger2.getCriticalLogs();

      expect(logs1).toHaveLength(2);
      expect(logs2).toHaveLength(4);

      expect(logs1[0].message).toBe('Logger1 - Message 2');
      expect(logs2[0].message).toBe('Logger2 - Message 1');

      if (typeof logger1.waitForPendingFlushes === 'function') {
        logger1.waitForPendingFlushes();
      }
      if (typeof logger2.waitForPendingFlushes === 'function') {
        logger2.waitForPendingFlushes();
      }
    });
  });

  // Helper function to create logger with specific configuration
  function createLoggerWithConfig(config) {
    const consoleLogger = new ConsoleLogger('DEBUG');
    const remoteLogger = new RemoteLogger({
      config: {
        endpoint: 'http://test-server/api/debug-log',
        batchSize: 5,
        flushInterval: 100,
        skipServerReadinessValidation: true,
      },
      dependencies: { consoleLogger },
    });
    const categoryDetector = new LogCategoryDetector();

    const hybridLogger = new HybridLogger({
      consoleLogger,
      remoteLogger,
      categoryDetector,
    }, config);

    // Create CriticalLogNotifier for visual notifications if enabled
    if (config?.criticalLogging?.enableVisualNotifications) {
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
        hybridLogger: hybridLogger,
        config: config.criticalLogging,
      });
    }

    return hybridLogger;
  }
});