/**
 * @file Integration tests for ActionTraceOutputService uncovered branches
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createEnhancedMockLogger } from '../../../common/mockFactories/loggerMocks.js';

class InMemoryStorageAdapter {
  constructor() {
    this.store = { actionTraces: [] };
  }

  async getItem(key) {
    return this.store[key];
  }

  async setItem(key, value) {
    this.store[key] = value;
  }

  async removeItem(key) {
    delete this.store[key];
  }

  async getAllKeys() {
    return Object.keys(this.store);
  }
}

/**
 *
 * @param root0
 * @param root0.beforeImport
 * @param root0.disableQueueProcessor
 */
async function loadService({ beforeImport, disableQueueProcessor = false } = {}) {
  jest.resetModules();

  if (disableQueueProcessor) {
    await jest.unstable_mockModule(
      '../../../../src/actions/tracing/traceQueueProcessor.js',
      () => ({
        __esModule: true,
        TraceQueueProcessor: undefined,
        default: undefined,
      })
    );
  }

  if (beforeImport) {
    await beforeImport();
  }

  const module = await import(
    '../../../../src/actions/tracing/actionTraceOutputService.js'
  );
  return module.ActionTraceOutputService;
}

describe('ActionTraceOutputService additional integration coverage', () => {
  let originalShowDirectoryPicker;

  beforeEach(() => {
    originalShowDirectoryPicker = window.showDirectoryPicker;
  });

  afterEach(() => {
    window.showDirectoryPicker = originalShowDirectoryPicker;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('schedules queue resume when simple queue has pending items', async () => {
    const ActionTraceOutputService = await loadService({
      disableQueueProcessor: true,
    });

    const logger = createEnhancedMockLogger();
    const storageAdapter = {
      getItem: jest.fn(async () => []),
      setItem: jest.fn(async () => {}),
      removeItem: jest.fn(async () => {}),
      getAllKeys: jest.fn(async () => []),
    };
    const scheduledTasks = [];
    const timerService = {
      setTimeout: jest.fn((callback, delay) => {
        scheduledTasks.push({ callback, delay });
      }),
    };

    const service = new ActionTraceOutputService({
      storageAdapter,
      logger,
      timerService,
    });

    const trace = {
      actionId: 'queued-trace',
      actorId: 'actor-queued',
      toJSON: () => ({ actionId: 'queued-trace', actorId: 'actor-queued' }),
    };

    await service.writeTrace(trace);
    service.__TEST_ONLY_scheduleQueueResume();

    expect(timerService.setTimeout).toHaveBeenCalledWith(
      expect.any(Function),
      1000
    );

    await service.waitForFileOperations();

    for (const task of scheduledTasks) {
      await task.callback();
    }
  });

  it('returns null rotation statistics when rotation manager is unavailable', async () => {
    const ActionTraceOutputService = await loadService();
    const logger = createEnhancedMockLogger();

    const service = new ActionTraceOutputService({ logger });
    await expect(service.getRotationStatistics()).resolves.toBeNull();
  });

  it('writes structured traces in multiple formats and handles text formatter failures', async () => {
    const writes = [];
    const ActionTraceOutputService = await loadService({
      beforeImport: async () => {
        const fileModule = await import(
          '../../../../src/actions/tracing/fileTraceOutputHandler.js'
        );
        jest
          .spyOn(fileModule.default.prototype, 'initialize')
          .mockResolvedValue(true);
        jest
          .spyOn(fileModule.default.prototype, 'writeTrace')
          .mockImplementation(async (data, trace) => {
            writes.push({ data, trace });
            return true;
          });
      },
    });

    const logger = createEnhancedMockLogger();

    const service = new ActionTraceOutputService({
      logger,
      outputToFiles: true,
      actionTraceConfig: { outputFormats: ['json', 'text'] },
      humanReadableFormatter: {
        format: () => {
          throw new Error('text fail');
        },
      },
    });

    const structuredTrace = {
      actionId: 'structured-action',
      actorId: 'structured-actor',
      getTracedActions: () =>
        new Map([
          [
            'structured-action',
            {
              actorId: 'structured-actor',
              stages: {
                begin: { timestamp: 5 },
                end: { timestamp: 15 },
              },
            },
          ],
        ]),
      getSpans: () => [null],
    };

    await service.writeTrace(structuredTrace);
    await new Promise((resolve) => setImmediate(resolve));

    expect(writes).toHaveLength(2);
    expect(writes[0].data).toHaveProperty('actions');
    expect(writes[1].trace._outputFormat).toBe('text');
    expect(writes[1].trace.actionId).toBe('structured-action');
    expect(typeof writes[1].data).toBe('string');
    expect(
      logger.warn.mock.calls.some(([message]) =>
        message === 'Failed to use human-readable formatter, falling back'
      )
    ).toBe(true);
  });

  it('falls back to empty trace list when no storage adapter is present during export', async () => {
    const ActionTraceOutputService = await loadService();
    const logger = createEnhancedMockLogger();
    const traceDirectoryManager = {
      selectDirectory: jest.fn(async () => ({})),
      ensureSubdirectoryExists: jest.fn(async () => ({})),
    };

    window.showDirectoryPicker = jest.fn();

    const service = new ActionTraceOutputService({
      logger,
      traceDirectoryManager,
    });

    const result = await service.exportTracesToFileSystem();
    expect(result.success).toBe(false);
    expect(result.reason).toBe('No traces found to export');
  });

  it('logs individual export failures and rethrows unexpected export errors', async () => {
    const ActionTraceOutputService = await loadService({
      disableQueueProcessor: true,
    });
    const logger = createEnhancedMockLogger();
    const storageAdapter = new InMemoryStorageAdapter();

    const failingDirectory = {
      getFileHandle: jest.fn(async () => ({
        createWritable: jest.fn(async () => {
          throw new Error('write failure');
        }),
      })),
    };

    const traceDirectoryManager = {
      selectDirectory: jest.fn(async () => failingDirectory),
      ensureSubdirectoryExists: jest.fn(async () => failingDirectory),
    };

    const service = new ActionTraceOutputService({
      logger,
      storageAdapter,
      traceDirectoryManager,
    });

    window.showDirectoryPicker = jest.fn();

    await service.__TEST_ONLY_storeTrace({
      actionId: 'export-me',
      actorId: 'actor-export',
      toJSON: () => ({ actionType: 'export-test' }),
    });

    const failureResult = await service.exportTracesToFileSystem();
    expect(failureResult.failedCount).toBeGreaterThan(0);
    expect(
      logger.error.mock.calls.some(([message]) =>
        message.startsWith('Failed to export trace')
      )
    ).toBe(true);

    traceDirectoryManager.ensureSubdirectoryExists.mockRejectedValueOnce(
      new Error('directory boom')
    );

    await expect(service.exportTracesToFileSystem()).rejects.toThrow(
      'directory boom'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Export failed',
      expect.any(Error)
    );
  });

  it('enforces export locking for download fallback and handles empty storage', async () => {
    const ActionTraceOutputService = await loadService({
      disableQueueProcessor: true,
    });
    const logger = createEnhancedMockLogger();

    let resolveGetItem;
    const storageAdapter = new InMemoryStorageAdapter();
    storageAdapter.getItem = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveGetItem = resolve;
        })
    );

    const service = new ActionTraceOutputService({
      logger,
      storageAdapter,
    });

    const pending = service.exportTracesAsDownload('json');
    await expect(service.exportTracesAsDownload('json')).rejects.toThrow(
      'Export already in progress'
    );

    resolveGetItem([]);
    await pending;

    storageAdapter.getItem.mockResolvedValue([]);
    const emptyResult = await service.exportTracesAsDownload('json');
    expect(emptyResult.success).toBe(false);
    expect(emptyResult.reason).toBe('No traces to export');

    const noAdapterService = new ActionTraceOutputService({ logger });
    const noAdapterResult = await noAdapterService.exportTracesAsDownload('json');
    expect(noAdapterResult.success).toBe(false);
    expect(noAdapterResult.reason).toBe('No storage adapter available');
  });

  it('awaits simple queue shutdown loop while processing traces', async () => {
    const ActionTraceOutputService = await loadService({
      disableQueueProcessor: true,
    });
    const logger = createEnhancedMockLogger();

    let resolveSetItem;
    const storageAdapter = new InMemoryStorageAdapter();
    storageAdapter.setItem = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveSetItem = resolve;
        })
    );

    const service = new ActionTraceOutputService({
      logger,
      storageAdapter,
      timerService: {
        setTimeout: (callback) => {
          callback();
        },
      },
    });

    const trace = {
      actionId: 'shutdown-trace',
      actorId: 'actor-shutdown',
      toJSON: () => ({ actionId: 'shutdown-trace' }),
    };

    jest.useFakeTimers();

    await service.writeTrace(trace);
    const shutdownPromise = service.shutdown();

    jest.advanceTimersByTime(1000);
    resolveSetItem();
    await shutdownPromise;
  });

  it('warns when advanced queue shutdown exceeds timeout', async () => {
    const ActionTraceOutputService = await loadService({
      beforeImport: async () => {
        const queueModule = await import(
          '../../../../src/actions/tracing/traceQueueProcessor.js'
        );
        jest
          .spyOn(queueModule.TraceQueueProcessor.prototype, 'shutdown')
          .mockReturnValue(new Promise(() => {}));
      },
    });

    const logger = createEnhancedMockLogger();
    const storageAdapter = new InMemoryStorageAdapter();

    const service = new ActionTraceOutputService({
      logger,
      storageAdapter,
    });

    jest.useFakeTimers();

    const shutdownPromise = service.shutdown();
    jest.advanceTimersByTime(2000);
    await shutdownPromise;

    expect(
      logger.warn.mock.calls.some(
        ([message]) =>
          message ===
          'ActionTraceOutputService: Shutdown timeout, forcing completion'
      )
    ).toBe(true);
  });
});
