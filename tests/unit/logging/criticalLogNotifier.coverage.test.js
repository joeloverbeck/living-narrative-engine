/**
 * @file Additional coverage-focused tests for CriticalLogNotifier.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

let mockDragHandlerCallbacks;
const mockDragHandlerEnable = jest.fn();
const mockDragHandlerDestroy = jest.fn();

jest.mock('../../../src/logging/dragHandler.js', () => {
  return jest.fn().mockImplementation(({ callbacks }) => {
    mockDragHandlerCallbacks = callbacks;
    return {
      enable: mockDragHandlerEnable,
      destroy: mockDragHandlerDestroy,
    };
  });
});

let mockLogFilterInstance;

jest.mock('../../../src/logging/logFilter.js', () =>
  jest.fn(({ callbacks }) => {
    let logs = [];
    let categories = ['all'];
    const filterState = {
      level: 'all',
      category: 'all',
      timeRange: 'all',
      searchText: '',
    };

    mockLogFilterInstance = {
      setFilter: jest.fn((updates) => {
        Object.assign(filterState, updates);
        callbacks?.onFilterChange?.(logs, {
          filtered: logs.length,
          total: logs.length,
          warnings: logs.filter((log) => log.level === 'warn').length,
          errors: logs.filter((log) => log.level === 'error').length,
        });
      }),
      setLogs: jest.fn((newLogs) => {
        logs = newLogs;
      }),
      getFilter: jest.fn(() => ({ ...filterState })),
      getCategories: jest.fn(() => categories),
      setCategories: (newCategories) => {
        categories = newCategories;
      },
      getFilteredLogs: jest.fn(() => logs),
      triggerFilterChange: (filtered, stats) =>
        callbacks?.onFilterChange?.(filtered, stats),
    };

    return mockLogFilterInstance;
  })
);

let keyboardActionCallback;
const mockKeyboardEnable = jest.fn();
const mockKeyboardDestroy = jest.fn();
const mockSetActionCallback = jest.fn((callback) => {
  keyboardActionCallback = callback;
});

jest.mock('../../../src/logging/keyboardShortcutsManager.js', () => {
  return jest.fn().mockImplementation(() => ({
    setActionCallback: mockSetActionCallback,
    enable: mockKeyboardEnable,
    destroy: mockKeyboardDestroy,
  }));
});

let mockExporterInstance;

jest.mock('../../../src/logging/logExporter.js', () => {
  return jest.fn().mockImplementation(() => {
    mockExporterInstance = {
      exportAsJSON: jest.fn(() => '{"logs":[]}'),
      exportAsCSV: jest.fn(() => 'csv-data'),
      exportAsText: jest.fn(() => 'text-data'),
      exportAsMarkdown: jest.fn(() => 'markdown-data'),
      generateFilename: jest.fn((base, ext) => `${base}.${ext}`),
      copyToClipboard: jest.fn(() => Promise.resolve(true)),
      downloadAsFile: jest.fn(),
    };
    return mockExporterInstance;
  });
});

import CriticalLogNotifier from '../../../src/logging/criticalLogNotifier.js';

const advanceAllTimers = async () => {
  jest.runOnlyPendingTimers();
  await Promise.resolve();
};

describe('CriticalLogNotifier additional coverage', () => {
  let notifier;
  let mockLogger;
  let mockDocumentContext;
  let mockEventDispatcher;
  let eventSubscriptions;
  let localStorageMock;
  let originalLocalStorageDescriptor;
  let originalRequestAnimationFrame;

  beforeEach(() => {
    mockDragHandlerCallbacks = undefined;
    mockLogFilterInstance = undefined;
    keyboardActionCallback = undefined;
    mockExporterInstance = undefined;

    mockDragHandlerEnable.mockClear();
    mockDragHandlerDestroy.mockClear();
    mockKeyboardEnable.mockClear();
    mockKeyboardDestroy.mockClear();
    mockSetActionCallback.mockClear();

    jest.useFakeTimers();
    originalRequestAnimationFrame = global.requestAnimationFrame;
    global.requestAnimationFrame = (cb) => cb();

    document.body.innerHTML = '';
    document.head.innerHTML = '';

    const storage = new Map();
    localStorageMock = {
      getItem: jest.fn((key) => (storage.has(key) ? storage.get(key) : null)),
      setItem: jest.fn((key, value) => storage.set(key, String(value))),
      removeItem: jest.fn((key) => storage.delete(key)),
      clear: jest.fn(() => storage.clear()),
    };

    originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
      window,
      'localStorage'
    );

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    eventSubscriptions = [];
    mockEventDispatcher = {
      subscribe: jest.fn((eventName, handler) => {
        const subscription = { eventName, handler };
        eventSubscriptions.push(subscription);
        return () => {
          subscription.unsubscribed = true;
        };
      }),
      dispatch: jest.fn(),
    };

    mockDocumentContext = {
      query: jest.fn((selector) => {
        if (selector === 'body') return document.body;
        if (selector === 'head') return document.head;
        if (selector === 'document') return document;
        return document.querySelector(selector);
      }),
      create: jest.fn((tag) => document.createElement(tag)),
      document,
    };
  });

  afterEach(async () => {
    if (notifier) {
      notifier.dispose();
      notifier = undefined;
    }
    await advanceAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();

    if (originalLocalStorageDescriptor) {
      Object.defineProperty(window, 'localStorage', originalLocalStorageDescriptor);
    } else {
      delete window.localStorage;
    }

    global.requestAnimationFrame = originalRequestAnimationFrame;
  });

  it('manages log lifecycle, filtering UI, and clearing behaviour', () => {
    const warnMock = mockLogger.warn;
    const errorMock = mockLogger.error;

    notifier = new CriticalLogNotifier({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockEventDispatcher,
      config: {
        enableVisualNotifications: true,
        notificationPosition: 'top-right',
        maxRecentLogs: 5,
        maxBufferSize: 5,
        soundEnabled: true,
        autoDismissAfter: 1000,
      },
    });

    expect(mockDragHandlerEnable).toHaveBeenCalledTimes(1);
    expect(mockKeyboardEnable).toHaveBeenCalledTimes(1);
    expect(typeof keyboardActionCallback).toBe('function');

    const longMessage = 'x'.repeat(210);

    mockLogger.warn('Network hiccup');
    expect(warnMock).toHaveBeenCalledWith('Network hiccup');

    jest.advanceTimersByTime(1000);

    mockLogger.error(`<script>${longMessage}</script>`);
    expect(errorMock).toHaveBeenCalledWith(`<script>${longMessage}</script>`);

    jest.advanceTimersByTime(1000);

    expect(mockLogFilterInstance.setLogs).toHaveBeenCalled();

    const container = document.querySelector('.lne-critical-log-notifier');
    expect(container.hidden).toBe(false);

    const warningBadge = container.querySelector('.lne-warning-badge');
    const errorBadge = container.querySelector('.lne-error-badge');
    expect(warningBadge.textContent).toBe('1');
    expect(errorBadge.textContent).toBe('1');

    expect(
      mockEventDispatcher.dispatch.mock.calls.some(
        ([eventName, payload]) =>
          eventName === 'core:critical_notification_shown' &&
          payload?.level === 'warning'
      )
    ).toBe(true);

    const badge = container.querySelector('.lne-badge-container');
    badge.click();

    const panel = container.querySelector('.lne-log-panel');
    expect(panel.hidden).toBe(false);

    mockLogFilterInstance.setCategories(['all', 'network']);
    const categoryFilter = panel.querySelector('.lne-category-filter');
    categoryFilter.value = 'all';

    const filteredLogs = [
      {
        level: 'warn',
        message: '<script>alert(1)</script>' + longMessage,
        category: 'network',
        timestamp: new Date('2024-01-01T12:34:56Z').getTime(),
      },
    ];

    mockLogFilterInstance.triggerFilterChange(filteredLogs, {
      filtered: 1,
      total: 2,
      warnings: 1,
      errors: 1,
    });

    const stats = panel.querySelector('.lne-filter-stats').textContent;
    expect(stats).toContain('1 of 2 logs');
    expect(stats).toContain('1 warnings');
    expect(stats).toContain('1 errors');

    expect(categoryFilter.value).toBe('all');
    expect(Array.from(categoryFilter.options).map((opt) => opt.value)).toEqual(['all', 'network']);

    const logEntries = panel.querySelectorAll('.lne-log-entry');
    expect(logEntries).toHaveLength(1);

    const message = logEntries[0].querySelector('.lne-log-message').textContent;
    expect(message.startsWith('[network]')).toBe(true);
    expect(message.endsWith('...')).toBe(true);

    const timeText = logEntries[0]
      .querySelector('.lne-log-time')
      .textContent;
    expect(timeText).toMatch(/\d{2}:\d{2}:\d{2}/);

    const styleElement = document.head.querySelector('#lne-log-animations');
    expect(styleElement).not.toBeNull();

    keyboardActionCallback('filter-errors');
    expect(mockLogFilterInstance.setFilter).toHaveBeenCalledWith({ level: 'error' });
    expect(panel.querySelector('.lne-level-filter').value).toBe('error');

    keyboardActionCallback('filter-all');
    expect(panel.querySelector('.lne-level-filter').value).toBe('all');

    keyboardActionCallback('focus-search');
    expect(document.activeElement).toBe(panel.querySelector('.lne-search-input'));

    keyboardActionCallback('export');
    const exportMenu = panel.querySelector('.lne-export-menu');
    expect(exportMenu.hidden).toBe(false);

    keyboardActionCallback('toggle-panel');
    jest.advanceTimersByTime(200);
    expect(panel.hidden).toBe(true);

    const clearButton = container.querySelector('.lne-clear-btn');
    clearButton.click();

    jest.advanceTimersByTime(300);

    expect(container.hidden).toBe(true);
    expect(
      mockEventDispatcher.dispatch.mock.calls.some(
        ([eventName, payload]) =>
          eventName === 'core:critical_logs_cleared' &&
          payload && Object.keys(payload).length === 0
      )
    ).toBe(true);
  });

  it('handles keyboard shortcuts, dismissal flows, dragging, and position persistence', () => {
    localStorageMock.setItem('lne-critical-notifier-position-custom', 'true');
    localStorageMock.setItem('lne-critical-notifier-position', 'bottom-left');

    const warnMock = mockLogger.warn;

    notifier = new CriticalLogNotifier({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockEventDispatcher,
      config: {
        enableVisualNotifications: true,
        notificationPosition: 'top-right',
        maxRecentLogs: 3,
        maxBufferSize: 3,
        autoDismissAfter: 500,
      },
    });

    const container = document.querySelector('.lne-critical-log-notifier');
    expect(container.getAttribute('data-position')).toBe('bottom-left');

    mockLogger.warn('first');
    jest.advanceTimersByTime(1000);
    expect(container.hidden).toBe(false);

    const setLogsCallsBeforeDismiss = mockLogFilterInstance.setLogs.mock.calls.length;

    keyboardActionCallback('dismiss');
    jest.advanceTimersByTime(300);
    expect(container.hidden).toBe(true);

    mockLogger.warn('second');
    jest.advanceTimersByTime(1000);
    expect(mockLogFilterInstance.setLogs.mock.calls.length).toBe(
      setLogsCallsBeforeDismiss
    );

    jest.advanceTimersByTime(30000);

    mockLogger.warn('third');
    jest.advanceTimersByTime(1000);
    expect(container.hidden).toBe(false);

    keyboardActionCallback('clear-all');
    jest.advanceTimersByTime(300);
    expect(container.hidden).toBe(true);

    const clearCall = mockEventDispatcher.subscribe.mock.calls.find(
      ([eventName]) => eventName === 'CRITICAL_LOG_ADDED'
    );
    expect(clearCall).toBeTruthy();

    clearCall[1]();
    jest.advanceTimersByTime(500);
    expect(
      mockEventDispatcher.dispatch.mock.calls.some(
        ([eventName, payload]) =>
          eventName === 'core:critical_notifications_dismissed' &&
          payload && Object.keys(payload).length === 0
      )
    ).toBe(true);

    expect(typeof mockDragHandlerCallbacks.onDragStart).toBe('function');
    expect(typeof mockDragHandlerCallbacks.onDragEnd).toBe('function');

    mockDragHandlerCallbacks.onDragStart();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('User started dragging notification')
    );

    mockDragHandlerCallbacks.onDragEnd('bottom-right');
    expect(container.getAttribute('data-position')).toBe('bottom-right');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'lne-critical-notifier-position-custom',
      'true'
    );

    const previousWarnCalls = warnMock.mock.calls.length;
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('storage failure');
    });

    notifier.updatePosition('top-left');
    expect(warnMock.mock.calls.length).toBeGreaterThan(previousWarnCalls);

    mockDragHandlerCallbacks.onDragEnd('top-right');
    expect(warnMock.mock.calls.length).toBeGreaterThan(previousWarnCalls);

    localStorageMock.setItem.mockImplementation(() => {});

    notifier.resetPosition();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      'lne-critical-notifier-position'
    );
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      'lne-critical-notifier-position-custom'
    );

    notifier.dispose();
    notifier = undefined;

    expect(mockDragHandlerDestroy).toHaveBeenCalledTimes(1);
    expect(mockKeyboardDestroy).toHaveBeenCalledTimes(1);
  });

  it('supports exporting logs, buffer limits, and error handling paths', async () => {
    const errorMock = mockLogger.error;

    notifier = new CriticalLogNotifier({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockEventDispatcher,
      config: {
        enableVisualNotifications: true,
        notificationPosition: 'top-right',
        maxRecentLogs: 2,
        maxBufferSize: 2,
      },
    });

    mockLogger.warn('alpha');
    jest.advanceTimersByTime(1000);

    mockLogger.warn('beta');
    jest.advanceTimersByTime(1000);

    mockLogger.warn('gamma');
    jest.advanceTimersByTime(1000);

    const latestLogs =
      mockLogFilterInstance.setLogs.mock.calls[
        mockLogFilterInstance.setLogs.mock.calls.length - 1
      ][0];
    expect(latestLogs.map((log) => log.message)).toEqual(['beta', 'gamma']);

    mockLogFilterInstance.getFilteredLogs.mockReturnValue([
      { message: 'filtered', level: 'warn' },
    ]);

    await notifier.exportLogs('json', { filtered: true });
    expect(mockExporterInstance.exportAsJSON).toHaveBeenCalled();
    expect(mockExporterInstance.downloadAsFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('critical-logs'),
      'application/json'
    );

    await notifier.exportLogs('csv');
    expect(mockExporterInstance.exportAsCSV).toHaveBeenCalled();

    mockExporterInstance.exportAsText.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await notifier.exportLogs('text');
    expect(
      mockEventDispatcher.dispatch.mock.calls.some(
        ([eventName, payload]) =>
          eventName === 'core:export_notification' && payload?.type === 'error'
      )
    ).toBe(true);

    await notifier.exportLogs('markdown');
    expect(mockExporterInstance.exportAsMarkdown).toHaveBeenCalled();

    mockExporterInstance.copyToClipboard.mockResolvedValueOnce(true);
    await notifier.exportLogs('clipboard');
    expect(mockExporterInstance.copyToClipboard).toHaveBeenCalled();

    mockExporterInstance.copyToClipboard.mockResolvedValueOnce(false);
    await notifier.exportLogs('clipboard');

    await notifier.exportLogs('unknown');
    expect(errorMock).toHaveBeenCalledWith(
      'Unknown export format: unknown'
    );

    notifier.dispose();
    notifier = undefined;
  });

  it('does not dispatch notifications when disabled and honours dismissal state', () => {
    notifier = new CriticalLogNotifier({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockEventDispatcher,
      config: {
        enableVisualNotifications: false,
        notificationPosition: 'top-right',
      },
    });

    mockLogger.warn('disabled');
    expect(
      mockEventDispatcher.dispatch.mock.calls.some(
        ([eventName]) => eventName === 'core:critical_notification_shown'
      )
    ).toBe(false);

    notifier.dispose();
    mockEventDispatcher.dispatch.mockClear();

    notifier = new CriticalLogNotifier({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockEventDispatcher,
    });

    const container = document.querySelector('.lne-critical-log-notifier');
    container
      .querySelector('.lne-badge-container')
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    jest.advanceTimersByTime(0);

    mockLogger.warn('after-dismiss');
    expect(
      mockEventDispatcher.dispatch.mock.calls.some(
        ([eventName]) => eventName === 'core:critical_notification_shown'
      )
    ).toBe(false);
  });
});
