import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import LogExporter from '../../../src/logging/logExporter.js';
import CriticalLogNotifier from '../../../src/logging/criticalLogNotifier.js';
import DocumentContext from '../../../src/domUI/documentContext.js';

class TestLogger {
  constructor() {
    this.debugCalls = [];
    this.infoCalls = [];
    this.warnCalls = [];
    this.errorCalls = [];
  }

  debug = (message, ...args) => {
    this.debugCalls.push({ message, args });
  };

  info = (message, ...args) => {
    this.infoCalls.push({ message, args });
  };

  warn = (message, ...args) => {
    this.warnCalls.push({ message, args });
  };

  error = (message, ...args) => {
    this.errorCalls.push({ message, args });
  };

  groupCollapsed = () => {};
  groupEnd = () => {};
  table = () => {};
}

class TestEventDispatcher {
  constructor() {
    this.events = [];
    this.handlers = new Map();
  }

  dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
    const handlers = this.handlers.get(eventName);
    if (handlers) {
      handlers.forEach((handler) => handler({ eventName, payload }));
    }
    return true;
  }

  subscribe(eventName, handler) {
    const handlers = this.handlers.get(eventName) ?? [];
    handlers.push(handler);
    this.handlers.set(eventName, handlers);
    return () => {
      const current = this.handlers.get(eventName);
      if (!current) return;
      const index = current.indexOf(handler);
      if (index >= 0) {
        current.splice(index, 1);
      }
    };
  }
}

describe('LogExporter integration coverage', () => {
  let originalClipboard;
  let originalExecCommand;
  let originalSecureContext;
  let rafSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '';

    originalClipboard = navigator.clipboard;
    originalExecCommand = document.execCommand;
    originalSecureContext = globalThis.isSecureContext;

    navigator.clipboard = {
      writeText: jest.fn().mockResolvedValue(undefined),
    };
    document.execCommand = jest.fn(() => true);
    globalThis.isSecureContext = true;

    rafSpy = jest
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb();
        return 0;
      });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();

    if (rafSpy) {
      rafSpy.mockRestore();
    }

    if (originalClipboard === undefined) {
      delete navigator.clipboard;
    } else {
      navigator.clipboard = originalClipboard;
    }

    document.execCommand = originalExecCommand;
    globalThis.isSecureContext = originalSecureContext;
  });

  it('exports notifier-captured logs across formats and clipboard using the real exporter', async () => {
    const logger = new TestLogger();
    const dispatcher = new TestEventDispatcher();
    const documentContext = new DocumentContext(document);

    const downloadCalls = [];
    const originalDownload = LogExporter.prototype.downloadAsFile;
    const downloadSpy = jest
      .spyOn(LogExporter.prototype, 'downloadAsFile')
      .mockImplementation(function (...args) {
        downloadCalls.push(args);
        return originalDownload.call(this, ...args);
      });

    const createObjectUrlSpy = jest
      .spyOn(URL, 'createObjectURL')
      .mockImplementation(() => 'blob:mock-url');
    const revokeObjectUrlSpy = jest
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    const clickSpy = jest
      .spyOn(window.HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    const notifier = new CriticalLogNotifier({
      logger,
      documentContext,
      validatedEventDispatcher: dispatcher,
      config: {
        enableVisualNotifications: true,
        soundEnabled: false,
        autoDismissAfter: null,
      },
    });

    logger.warn('Inventory warning: capacity exceeded, check "sacks"', {
      category: 'inventory',
    });
    logger.error('Engine fault | overheating [_critical_]', {
      category: 'engine-room',
    });

    jest.advanceTimersByTime(1100);

    await notifier.exportLogs('json', { filtered: true });
    await notifier.exportLogs('csv', { filtered: true });
    await notifier.exportLogs('text', { filtered: true });
    await notifier.exportLogs('markdown', { filtered: true });
    await notifier.exportLogs('clipboard', { filtered: true });

    // Allow download cleanup timers to execute
    jest.advanceTimersByTime(200);

    expect(downloadCalls).toHaveLength(4);
    const [jsonArgs, csvArgs, textArgs, markdownArgs] = downloadCalls;

    expect(jsonArgs[1]).toMatch(/^critical-logs_.*\.json$/);
    expect(csvArgs[2]).toBe('text/csv');
    expect(textArgs[2]).toBe('text/plain');
    expect(markdownArgs[2]).toBe('text/markdown');

    const exportSummary = JSON.parse(jsonArgs[0]);
    expect(exportSummary.metadata.exportFormat).toBe('json');
    expect(exportSummary.logs).toHaveLength(2);
    expect(exportSummary.logs[0]).toEqual(
      expect.objectContaining({ level: 'warn', message: expect.any(String) })
    );
    expect(exportSummary.summary.total).toBe(2);
    expect(exportSummary.summary.errors).toBe(1);
    expect(exportSummary.summary.warnings).toBe(1);

    expect(csvArgs[0]).toContain('Timestamp,ISO Time,Level,Category,Message');
    expect(textArgs[0]).toContain('CRITICAL LOGS EXPORT');
    expect(markdownArgs[0]).toContain('# Critical Logs Export');

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(
      dispatcher.events.filter(
        (event) => event.eventName === 'core:export_notification'
      )
    ).toHaveLength(5);

    notifier.dispose();

    downloadSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('sanitizes metadata and escapes formats when exporting without the notifier', () => {
    const logger = new TestLogger();
    const exporter = new LogExporter({
      logger,
      appInfo: { name: 'Test Harness', version: '9.9.9' },
    });

    const baseTimestamp = Date.now();
    const logs = [
      {
        timestamp: baseTimestamp,
        level: 'warn',
        message: 'Brace for impact, "captain"',
        category: 'bridge',
        metadata: {
          stack: 'Stack line 1\nStack line 2',
          errorName: 'WarningError',
          errorMessage: 'Subsystem failure',
          userId: 'user-42',
          action: 'stabilize',
          secret: 'redacted',
        },
      },
      {
        timestamp: baseTimestamp + 2000,
        level: 'error',
        message: 'Main reactor offline | code [E-77] <critical>',
        category: 'engine',
        metadata: {
          stack: 'Error stack',
          debug: 'omit-me',
        },
      },
    ];

    const jsonExport = exporter.exportAsJSON(logs, {
      filters: { level: 'all' },
      totalLogs: logs.length,
      format: 'json',
    });

    const parsed = JSON.parse(jsonExport);
    expect(parsed.metadata.application.name).toBe('Test Harness');
    expect(parsed.logs[0].metadata).toEqual(
      expect.objectContaining({
        stack: 'Stack line 1\nStack line 2',
        errorName: 'WarningError',
        errorMessage: 'Subsystem failure',
        userId: 'user-42',
        action: 'stabilize',
      })
    );
    expect(parsed.logs[0].metadata.secret).toBeUndefined();

    const csv = exporter.exportAsCSV(logs);
    expect(csv).toContain('"Brace for impact, ""captain"""');

    const text = exporter.exportAsText(logs);
    expect(text).toContain('WARNINGS (1):');
    expect(text).toContain('ERRORS (1):');

    const markdown = exporter.exportAsMarkdown(logs);
    expect(markdown).toContain('| Level | Category | Message |');
    expect(markdown).toContain('❌ ERROR');
  });

  it('falls back to execCommand copy when Clipboard API is unavailable', async () => {
    delete navigator.clipboard;
    document.execCommand = jest.fn(() => true);

    const logger = new TestLogger();
    const exporter = new LogExporter({ logger });

    const success = await exporter.copyToClipboard('fallback copy payload');
    expect(success).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('reports clipboard copy failures and returns false', async () => {
    navigator.clipboard = {
      writeText: jest.fn().mockRejectedValue(new Error('copy denied')),
    };

    const logger = new TestLogger();
    const exporter = new LogExporter({ logger });

    const success = await exporter.copyToClipboard('will fail');
    expect(success).toBe(false);
    expect(logger.errorCalls[0].message).toBe('Failed to copy to clipboard');
  });

  it('logs and rethrows download errors', () => {
    const logger = new TestLogger();
    const exporter = new LogExporter({ logger });

    const createSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation(() => {
        throw new Error('cannot create element');
      });

    expect(() =>
      exporter.downloadAsFile('payload', 'failing.txt', 'text/plain')
    ).toThrow('cannot create element');
    expect(logger.errorCalls[0].message).toBe('Failed to download logs');

    createSpy.mockRestore();
  });
});
