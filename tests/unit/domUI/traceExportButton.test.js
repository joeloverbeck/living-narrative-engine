import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import TraceExportButton from '../../../src/domUI/components/traceExportButton.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createActionTraceOutputService = () => ({
  exportTracesToFileSystem: jest.fn(),
  exportTracesAsDownload: jest.fn(),
});

const createEventBus = () => {
  const bus = {
    subscribe: jest.fn((eventName, handler) => {
      bus.lastEvent = eventName;
      bus.handler = handler;
    }),
    lastEvent: null,
    handler: null,
  };
  return bus;
};

const setupDomContainer = () => {
  document.body.innerHTML = '<div id="trace-container"></div>';
  return document.getElementById('trace-container');
};

beforeEach(() => {
  document.body.innerHTML = '';
  global.alert = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = '';
});

describe('TraceExportButton', () => {
  it('logs an error when the target container is missing', () => {
    const logger = createLogger();
    const service = createActionTraceOutputService();
    const component = new TraceExportButton({
      actionTraceOutputService: service,
      logger,
    });

    component.render('unknown-container');

    expect(logger.error).toHaveBeenCalledWith(
      'Container with ID "unknown-container" not found'
    );
  });

  it('renders UI controls and reacts to progress events', () => {
    const logger = createLogger();
    const service = createActionTraceOutputService();
    const eventBus = createEventBus();
    const component = new TraceExportButton({
      actionTraceOutputService: service,
      eventBus,
      logger,
    });

    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'TRACE_EXPORT_PROGRESS',
      expect.any(Function)
    );
    const progressHandler = eventBus.handler;
    expect(progressHandler).toBeInstanceOf(Function);

    // Progress events before rendering should be ignored gracefully
    progressHandler({ payload: { progress: 10, current: 0, total: 10 } });

    const container = setupDomContainer();
    component.render('trace-container');

    const progressBar = container.querySelector('.export-progress-bar');
    const progressText = container.querySelector('.export-progress-text');

    progressHandler({ payload: { progress: 42.6, current: 3, total: 7 } });
    expect(progressBar.querySelector('.export-progress-fill').style.width).toBe(
      '42.6%'
    );
    expect(progressText.textContent).toBe('Exporting: 3/7 traces (43%)');

    progressBar.querySelector('.export-progress-fill').remove();
    progressHandler({ payload: { progress: 12.3, current: 1, total: 9 } });
    expect(progressText.textContent).toBe('Exporting: 1/9 traces (12%)');
  });

  it('handles a successful export using the file system API', async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const service = createActionTraceOutputService();
    service.exportTracesToFileSystem.mockResolvedValue({
      success: true,
      exportedCount: 5,
      exportPath: '/tmp/traces',
      method: 'filesystem',
    });

    const component = new TraceExportButton({
      actionTraceOutputService: service,
      logger,
    });

    const container = setupDomContainer();
    component.render('trace-container');

    const select = document.getElementById('trace-export-format');
    select.value = 'text';

    const button = container.querySelector('.trace-export-btn');
    await button.onclick();

    expect(service.exportTracesToFileSystem).toHaveBeenCalledWith(null, 'text');
    expect(logger.info).toHaveBeenCalledWith(
      'Starting trace export in text format'
    );

    const progressText = container.querySelector('.export-progress-text');
    expect(progressText.textContent).toBe(
      'Successfully exported 5 traces to /tmp/traces'
    );

    const progressFill = container.querySelector('.export-progress-fill');
    expect(progressFill.style.width).toBe('100%');

    expect(alert).toHaveBeenCalledWith(
      'Traces exported successfully!\nLocation: /tmp/traces\nExported: 5 traces'
    );

    const progressContainer = progressFill.parentElement.parentElement;
    expect(progressContainer.style.display).toBe('block');
    jest.advanceTimersByTime(3000);
    expect(progressContainer.style.display).toBe('none');
  });

  it('notifies the user when exporting falls back to download', async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const service = createActionTraceOutputService();
    service.exportTracesToFileSystem.mockResolvedValue({
      success: true,
      exportedCount: 3,
      method: 'download',
      fileName: 'trace-export.json',
    });

    const component = new TraceExportButton({
      actionTraceOutputService: service,
      logger,
    });

    const container = setupDomContainer();
    component.render('trace-container');

    // Remove the fill element to verify graceful handling of missing progress bar fill
    container.querySelector('.export-progress-fill').remove();

    const button = container.querySelector('.trace-export-btn');
    await button.onclick();

    const progressText = container.querySelector('.export-progress-text');
    expect(progressText.textContent).toBe('Successfully exported 3 traces');
    expect(alert).toHaveBeenCalledWith(
      'Traces exported successfully!\nFile: trace-export.json'
    );
  });

  it('reports an error when the export service responds with failure', async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const service = createActionTraceOutputService();
    service.exportTracesToFileSystem.mockResolvedValue({
      success: false,
      reason: 'Permission denied',
    });

    const component = new TraceExportButton({
      actionTraceOutputService: service,
      logger,
    });

    const container = setupDomContainer();
    component.render('trace-container');

    container.querySelector('.export-progress-bar').remove();
    document.getElementById('trace-export-format').remove();

    const button = container.querySelector('.trace-export-btn');
    await button.onclick();

    expect(service.exportTracesToFileSystem).toHaveBeenCalledWith(null, 'json');
    expect(logger.error).toHaveBeenCalledWith(
      'Export error:',
      'Permission denied'
    );

    const progressText = container.querySelector('.export-progress-text');
    expect(progressText.textContent).toBe('Error: Permission denied');
    expect(progressText.style.color).toBe('rgb(244, 67, 54)');
    expect(alert).toHaveBeenCalledWith('Export failed: Permission denied');

    jest.advanceTimersByTime(3000);
  });

  it('handles unexpected errors thrown by the export service', async () => {
    const logger = createLogger();
    const service = createActionTraceOutputService();
    service.exportTracesToFileSystem.mockRejectedValue(new Error('Disk error'));

    const component = new TraceExportButton({
      actionTraceOutputService: service,
      logger,
    });

    const container = setupDomContainer();
    component.render('trace-container');

    container
      .querySelector('.export-progress-bar')
      .querySelector('.export-progress-fill')
      .remove();

    const button = container.querySelector('.trace-export-btn');
    await button.onclick();

    expect(logger.error).toHaveBeenNthCalledWith(
      1,
      'Export failed with error',
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      'Export error:',
      'Export failed: Disk error'
    );

    const progressText = container.querySelector('.export-progress-text');
    expect(progressText.textContent).toBe('Error: Export failed: Disk error');
    expect(alert).toHaveBeenCalledWith(
      'Export failed: Export failed: Disk error'
    );
  });

  it('prevents concurrent export attempts', async () => {
    jest.useFakeTimers();
    const logger = createLogger();
    const service = createActionTraceOutputService();
    let resolveExport;
    const exportPromise = new Promise((resolve) => {
      resolveExport = resolve;
    });
    service.exportTracesToFileSystem.mockReturnValue(exportPromise);

    const component = new TraceExportButton({
      actionTraceOutputService: service,
      logger,
    });

    const container = setupDomContainer();
    component.render('trace-container');

    const button = container.querySelector('.trace-export-btn');

    const firstAttempt = button.onclick();
    await Promise.resolve();

    await button.onclick();
    expect(logger.warn).toHaveBeenCalledWith('Export already in progress');
    expect(service.exportTracesToFileSystem).toHaveBeenCalledTimes(1);

    resolveExport({
      success: true,
      exportedCount: 1,
      method: 'download',
      fileName: 'auto.json',
    });
    await firstAttempt;
    expect(alert).toHaveBeenCalledWith(
      'Traces exported successfully!\nFile: auto.json'
    );
  });

  it('falls back to a default error message when no reason is provided', async () => {
    const logger = createLogger();
    const service = createActionTraceOutputService();
    service.exportTracesToFileSystem.mockResolvedValue({ success: false });

    const component = new TraceExportButton({
      actionTraceOutputService: service,
      logger,
    });

    const container = setupDomContainer();
    component.render('trace-container');

    const button = container.querySelector('.trace-export-btn');
    await button.onclick();

    const progressText = container.querySelector('.export-progress-text');
    expect(progressText.textContent).toBe('Error: Export failed');
    expect(alert).toHaveBeenCalledWith('Export failed: Export failed');
  });

  it('allows destroy to be called before rendering', () => {
    const logger = createLogger();
    const service = createActionTraceOutputService();
    const component = new TraceExportButton({
      actionTraceOutputService: service,
      logger,
    });

    expect(() => component.destroy()).not.toThrow();
  });

  it('destroys DOM nodes when cleaned up', () => {
    const logger = createLogger();
    const service = createActionTraceOutputService();
    const eventBus = createEventBus();
    const component = new TraceExportButton({
      actionTraceOutputService: service,
      eventBus,
      logger,
    });

    const container = setupDomContainer();
    component.render('trace-container');
    component.destroy();

    expect(container.querySelector('.trace-export-btn')).toBeNull();
    expect(container.querySelector('.export-progress-bar')).toBeNull();
    expect(container.querySelector('.export-progress-text')).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith('TraceExportButton destroyed');
  });
});
