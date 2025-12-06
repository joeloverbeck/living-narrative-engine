import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraceExportButton } from '../../../src/domUI/components/traceExportButton.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(message) {
    this.debugMessages.push(message);
  }

  info(message) {
    this.infoMessages.push(message);
  }

  warn(message) {
    this.warnMessages.push(message);
  }

  error(message, context) {
    this.errorMessages.push({ message, context });
  }
}

class TestEventBus {
  constructor() {
    this.listeners = new Map();
  }

  subscribe(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(listener);
  }

  publish(eventName, payload) {
    const listeners = this.listeners.get(eventName);
    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener({ type: eventName, payload });
    }
  }
}

class TestActionTraceOutputService {
  constructor() {
    this.calls = [];
    this.behavior = { type: 'success', result: this.#defaultSuccess() };
  }

  setNextSuccess(result) {
    this.behavior = { type: 'success', result };
  }

  setDeferredSuccess(result) {
    let resolve;
    const promise = new Promise((res) => {
      resolve = () => res({ success: true, ...result });
    });
    this.behavior = { type: 'deferred', promise, resolve };
  }

  resolveDeferred() {
    if (this.behavior.type === 'deferred' && this.behavior.resolve) {
      const { resolve } = this.behavior;
      this.behavior = { type: 'success', result: this.#defaultSuccess() };
      resolve();
    }
  }

  setNextFailure(reason) {
    this.behavior = { type: 'failure', reason };
  }

  setNextError(error) {
    this.behavior = { type: 'error', error };
  }

  async exportTracesToFileSystem(_, format) {
    this.calls.push({ format });

    if (this.behavior.type === 'deferred') {
      return this.behavior.promise;
    }

    if (this.behavior.type === 'error') {
      const error = this.behavior.error || new Error('export failed');
      this.behavior = { type: 'success', result: this.#defaultSuccess() };
      throw error;
    }

    if (this.behavior.type === 'failure') {
      const reason = this.behavior.reason || 'Unknown failure';
      this.behavior = { type: 'success', result: this.#defaultSuccess() };
      return { success: false, reason };
    }

    const result = this.behavior.result || this.#defaultSuccess();
    this.behavior = { type: 'success', result: this.#defaultSuccess() };
    return { success: true, ...result };
  }

  async exportTracesAsDownload() {
    return { success: true };
  }

  #defaultSuccess() {
    return {
      exportedCount: 1,
      exportPath: '/exports/latest',
      method: 'filesystem',
    };
  }
}

/**
 *
 */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('TraceExportButton real integration', () => {
  let logger;
  let eventBus;
  let service;
  let component;

  beforeEach(() => {
    jest.useFakeTimers();
    global.alert = jest.fn();
    document.body.innerHTML = '<div id="trace-root"></div>';

    logger = new TestLogger();
    eventBus = new TestEventBus();
    service = new TestActionTraceOutputService();
    component = new TraceExportButton({
      actionTraceOutputService: service,
      eventBus,
      logger,
    });
  });

  afterEach(() => {
    component?.destroy();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    delete global.alert;
    document.body.innerHTML = '';
  });

  it('renders UI and completes filesystem exports with progress updates', async () => {
    service.setNextSuccess({
      exportedCount: 5,
      exportPath: '/exports/run-1',
      method: 'filesystem',
    });

    component.render('trace-root');

    eventBus.publish('TRACE_EXPORT_PROGRESS', {
      progress: 45.7,
      current: 9,
      total: 20,
    });

    const formatSelector = document.getElementById('trace-export-format');
    formatSelector.value = 'text';

    const button = document.querySelector('.trace-export-btn');
    button.click();

    await flushMicrotasks();

    expect(service.calls).toEqual([{ format: 'text' }]);
    expect(logger.infoMessages).toContain(
      'Starting trace export in text format'
    );
    expect(logger.infoMessages).toContain(
      'Successfully exported 5 traces to /exports/run-1'
    );

    const progressText = document.querySelector('.export-progress-text');
    expect(progressText.textContent).toContain(
      'Successfully exported 5 traces to /exports/run-1'
    );
    expect(progressText.style.color).toBe('rgb(76, 175, 80)');

    const progressFill = document.querySelector('.export-progress-fill');
    expect(progressFill.style.width).toBe('100%');

    expect(global.alert).toHaveBeenCalledWith(
      expect.stringContaining('Location: /exports/run-1')
    );

    jest.runOnlyPendingTimers();
    await flushMicrotasks();

    const progressContainer = progressFill.parentElement.parentElement;
    expect(progressContainer.style.display).toBe('none');
  });

  it('prevents concurrent exports and supports download fallback', async () => {
    service.setDeferredSuccess({
      exportedCount: 2,
      method: 'download',
      fileName: 'trace-export.json',
    });

    component.render('trace-root');

    const button = document.querySelector('.trace-export-btn');
    const clickHandler = button.onclick;
    clickHandler();

    eventBus.publish('TRACE_EXPORT_PROGRESS', {
      progress: 12,
      current: 3,
      total: 25,
    });

    clickHandler();
    await flushMicrotasks();

    expect(logger.warnMessages).toContain('Export already in progress');
    expect(service.calls).toEqual([{ format: 'json' }]);

    service.resolveDeferred();
    await flushMicrotasks();

    expect(global.alert).toHaveBeenCalledWith(
      expect.stringContaining('File: trace-export.json')
    );

    const progressFill = document.querySelector('.export-progress-fill');
    expect(progressFill.style.width).toBe('100%');
  });

  it('logs errors when render container is missing', () => {
    component.render('missing-container');

    expect(logger.errorMessages[0].message).toBe(
      'Container with ID "missing-container" not found'
    );
  });

  it('surfaces export failures and thrown errors', async () => {
    component.render('trace-root');

    service.setNextFailure('No traces available');
    const button = document.querySelector('.trace-export-btn');
    button.click();
    await flushMicrotasks();

    jest.runOnlyPendingTimers();
    await flushMicrotasks();

    expect(global.alert).toHaveBeenCalledWith(
      expect.stringContaining('No traces available')
    );

    const progressText = document.querySelector('.export-progress-text');
    expect(progressText.textContent).toBe('Error: No traces available');
    expect(progressText.style.color).toBe('rgb(244, 67, 54)');

    service.setNextError(new Error('Disk full'));
    button.click();
    await flushMicrotasks();

    jest.runOnlyPendingTimers();
    await flushMicrotasks();

    expect(global.alert).toHaveBeenLastCalledWith(
      expect.stringContaining('Disk full')
    );

    const progressFill = document.querySelector('.export-progress-fill');
    expect(progressFill.style.width).toBe('0%');
  });
});
