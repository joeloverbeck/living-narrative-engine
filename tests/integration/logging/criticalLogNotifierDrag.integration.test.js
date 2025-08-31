/**
 * @file Integration tests for critical log notifier drag functionality
 * @see criticalLogNotifier.js, dragHandler.js
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
  simulateClick,
} from '../../common/helpers/notifierTestHelpers.js';

describe('Critical Log Notifier Drag Integration', () => {
  let dom;
  let document;
  let window;
  let testBed;
  let logger;
  let consoleLogger;
  let remoteLogger;
  let categoryDetector;
  let config;
  let notifier;
  let mockFetch;
  let mockLocalStorage;

  beforeEach(() => {
    // Set up test bed
    testBed = createTestBed();
    
    // Set up DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });

    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;
    global.navigator = {
      sendBeacon: jest.fn(),
      vibrate: jest.fn(),
    };
    mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    global.localStorage = mockLocalStorage;
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

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

    // Create mocks for CriticalLogNotifier
    const mockValidatedEventDispatcher = testBed.createMock('mockValidatedEventDispatcher', [
      'dispatch',
      'subscribe',
    ]);
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
    
    // Create CriticalLogNotifier
    notifier = new CriticalLogNotifier({
      logger: testBed.createMockLogger(),
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      hybridLogger: logger,
      config: config.criticalLogging,
    });

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    
    if (notifier) {
      notifier.dispose();
    }
    
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

  describe('Drag Handler Integration', () => {
    it('should enable drag functionality when notifier is created', async () => {
      // Log a warning to make the badge visible
      logger.warn('Test warning');
      
      // Allow time for update
      jest.advanceTimersByTime(100);
      
      const elements = getNotificationElements(document);
      expect(elements).toBeTruthy();
      expect(elements.badgeContainer).toBeTruthy();
      
      // Check that drag cursor is set
      expect(elements.badgeContainer.style.cursor).toBe('move');
      expect(elements.badgeContainer.getAttribute('title')).toBe('Hold to drag');
    });

    it('should start drag after long press', async () => {
      // Log a warning to make the badge visible
      logger.warn('Test warning');
      jest.advanceTimersByTime(100);
      
      const elements = getNotificationElements(document);
      const badge = elements.badgeContainer;
      
      // Simulate mousedown
      const mousedownEvent = new window.MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      badge.dispatchEvent(mousedownEvent);
      
      // Wait for long press delay
      jest.advanceTimersByTime(500);
      
      // Check dragging class is added
      expect(elements.container.classList.contains('dragging')).toBe(true);
    });








  });

  describe('Position Persistence', () => {
    it('should load custom position from localStorage on initialization', () => {
      // Set up localStorage to return custom position
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'lne-critical-notifier-position-custom') return 'true';
        if (key === 'lne-critical-notifier-position') return 'bottom-left';
        return null;
      });
      
      // Create new notifier
      const mockValidatedEventDispatcher = testBed.createMock('mockValidatedEventDispatcher', [
        'dispatch',
        'subscribe',
      ]);
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
      
      const customNotifier = new CriticalLogNotifier({
        logger: testBed.createMockLogger(),
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        hybridLogger: logger,
        config: config.criticalLogging,
      });
      
      // Log a warning to make the badge visible
      logger.warn('Test warning');
      jest.advanceTimersByTime(100);
      
      const elements = getNotificationElements(document);
      expect(elements.container.getAttribute('data-position')).toBe('bottom-left');
      
      customNotifier.dispose();
    });

    it('should fallback to config position if custom position is invalid', () => {
      // Set up localStorage to return invalid custom position
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'lne-critical-notifier-position-custom') return 'true';
        if (key === 'lne-critical-notifier-position') return 'invalid-position';
        return null;
      });
      
      // Create new notifier
      const mockValidatedEventDispatcher = testBed.createMock('mockValidatedEventDispatcher', [
        'dispatch',
        'subscribe',
      ]);
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
      
      const customNotifier = new CriticalLogNotifier({
        logger: testBed.createMockLogger(),
        documentContext: mockDocumentContext,
        validatedEventDispatcher: mockValidatedEventDispatcher,
        hybridLogger: logger,
        config: config.criticalLogging,
      });
      
      // Log a warning to make the badge visible
      logger.warn('Test warning');
      jest.advanceTimersByTime(100);
      
      const elements = getNotificationElements(document);
      expect(elements.container.getAttribute('data-position')).toBe('top-right'); // Default from config
      
      customNotifier.dispose();
    });

    it('should reset position to default when resetPosition is called', () => {
      // Log a warning to make the badge visible
      logger.warn('Test warning');
      jest.advanceTimersByTime(100);
      
      const elements = getNotificationElements(document);
      
      // Change position via drag
      elements.container.setAttribute('data-position', 'bottom-left');
      
      // Call resetPosition
      notifier.resetPosition();
      
      // Check localStorage was cleared
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('lne-critical-notifier-position');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('lne-critical-notifier-position-custom');
      
      // Check position was reset to config default
      expect(elements.container.getAttribute('data-position')).toBe('top-right');
    });
  });

  describe('Cleanup', () => {
    it('should clean up drag handler on dispose', () => {
      // Log a warning to make the badge visible
      logger.warn('Test warning');
      jest.advanceTimersByTime(100);
      
      const elements = getNotificationElements(document);
      const badge = elements.badgeContainer;
      
      // Start drag to ensure handler is active
      const mousedownEvent = new window.MouseEvent('mousedown', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      });
      badge.dispatchEvent(mousedownEvent);
      
      jest.advanceTimersByTime(500);
      
      expect(elements.container.classList.contains('dragging')).toBe(true);
      
      // Dispose notifier
      notifier.dispose();
      
      // Check drag was cleaned up
      expect(elements.container.classList.contains('dragging')).toBe(false);
      
      // Try to drag after dispose - should not work
      badge.dispatchEvent(mousedownEvent);
      jest.advanceTimersByTime(500);
      
      // Should not be dragging since handler was destroyed
      expect(elements.container.classList.contains('dragging')).toBe(false);
    });
  });


});