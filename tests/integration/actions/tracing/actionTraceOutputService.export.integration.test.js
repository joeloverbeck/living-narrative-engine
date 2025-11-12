/**
 * @file Integration tests focused on ActionTraceOutputService export and shutdown coverage
 * @description Covers advanced formatting, export flows, and shutdown coordination branches
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createEnhancedMockLogger } from '../../../common/mockFactories/loggerMocks.js';

class InMemoryStorageAdapter {
  constructor(initial = {}) {
    this.store = { ...initial };
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

async function loadService({
  disableQueueProcessor = false,
  rotationManagerMock,
  beforeImport,
} = {}) {
  jest.resetModules();

  if (beforeImport) {
    await beforeImport();
  }

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

  if (rotationManagerMock) {
    await jest.unstable_mockModule(
      '../../../../src/actions/tracing/storageRotationManager.js',
      () => ({ StorageRotationManager: rotationManagerMock })
    );
  }

  const module = await import(
    '../../../../src/actions/tracing/actionTraceOutputService.js'
  );
  return module.ActionTraceOutputService;
}

describe('ActionTraceOutputService export coverage integration', () => {
  let originalShowDirectoryPicker;

  beforeEach(() => {
    jest.useRealTimers();
    originalShowDirectoryPicker = window.showDirectoryPicker;
  });

  afterEach(() => {
    window.showDirectoryPicker = originalShowDirectoryPicker;
    jest.restoreAllMocks();
  });

  it('should validate dependencies and surface file output initialization branches', async () => {
    let initializeSpy;
    let writeSpy;
    const ActionTraceOutputService = await loadService({
      beforeImport: async () => {
        const module = await import(
          '../../../../src/actions/tracing/fileTraceOutputHandler.js'
        );
        initializeSpy = jest
          .spyOn(module.default.prototype, 'initialize')
          .mockImplementationOnce(() => Promise.resolve(false))
          .mockImplementationOnce(() => Promise.reject(new Error('init boom')));
        writeSpy = jest
          .spyOn(module.default.prototype, 'writeTrace')
          .mockResolvedValue(true);
      },
    });

    const logger = createEnhancedMockLogger();
    const storageAdapter = new InMemoryStorageAdapter();
    const traceDirectoryManager = {
      selectDirectory: jest.fn(async () => ({})),
      ensureSubdirectoryExists: jest.fn(async () => ({})),
    };
    const actionTraceFilter = {
      shouldTrace: () => true,
      getVerbosityLevel: () => 'detailed',
      getInclusionConfig: () => ({ allowAll: true }),
    };
    const jsonFormatter = { format: (value) => JSON.stringify(value) };
    const humanReadableFormatter = { format: () => 'formatted' };

    // First instantiation resolves initialize() as false to trigger warning branch
    new ActionTraceOutputService({
      storageAdapter,
      logger,
      traceDirectoryManager,
      actionTraceFilter,
      jsonFormatter,
      humanReadableFormatter,
      outputToFiles: true,
      testMode: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(logger.warn).toHaveBeenCalledWith(
      'FileTraceOutputHandler initialization failed'
    );

    // Second instantiation rejects initialize() to trigger error logging
    const errorLogger = createEnhancedMockLogger();
    new ActionTraceOutputService({
      storageAdapter,
      logger: errorLogger,
      traceDirectoryManager,
      actionTraceFilter,
      jsonFormatter,
      humanReadableFormatter,
      outputDirectory: './alt-traces',
      outputToFiles: true,
      testMode: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(errorLogger.error).toHaveBeenCalledWith(
      'Error initializing FileTraceOutputHandler',
      expect.any(Error)
    );

    expect(initializeSpy).toHaveBeenCalledTimes(2);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('should use queue processor when available and handle enqueue failures', async () => {
    const ActionTraceOutputService = await loadService();
    const logger = createEnhancedMockLogger();
    const storageAdapter = new InMemoryStorageAdapter();

    const module = await import(
      '../../../../src/actions/tracing/traceQueueProcessor.js'
    );
    const enqueueSpy = jest
      .spyOn(module.TraceQueueProcessor.prototype, 'enqueue')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    const service = new ActionTraceOutputService({
      storageAdapter,
      logger,
    });

    await service.writeTrace(null);
    expect(logger.warn).toHaveBeenCalledWith(
      'ActionTraceOutputService: Null trace provided'
    );

    const trace = { toJSON: () => ({ id: 'queued-trace' }) };
    await service.writeTrace(trace);
    expect(enqueueSpy).toHaveBeenCalledWith(trace, undefined);
    expect(logger.warn).toHaveBeenCalledWith(
      'ActionTraceOutputService: Failed to enqueue trace'
    );

    // Second call to ensure success path does not warn again
    await service.writeTrace(trace);
    expect(logger.warn).toHaveBeenCalledTimes(2);

    enqueueSpy.mockRestore();
  });

  it('should surface serialization errors when traces lack export methods', async () => {
    const ActionTraceOutputService = await loadService();
    const logger = createEnhancedMockLogger();
    const outputHandler = jest.fn();

    const service = new ActionTraceOutputService({
      logger,
      outputHandler,
    });

    await expect(service.writeTrace({})).rejects.toThrow(
      'Trace must have either toJSON() or getTracedActions() method'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to write trace',
      expect.objectContaining({ error: expect.stringContaining('Trace must have either') })
    );
    expect(service.getStatistics()).toMatchObject({ totalErrors: 1 });
  });

  it('should exercise default output handler file success, warning, and error paths', async () => {
    let writeSpy;
    const ActionTraceOutputService = await loadService({
      beforeImport: async () => {
        const module = await import(
          '../../../../src/actions/tracing/fileTraceOutputHandler.js'
        );
        jest
          .spyOn(module.default.prototype, 'initialize')
          .mockResolvedValue(true);
        writeSpy = jest
          .spyOn(module.default.prototype, 'writeTrace')
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false)
          .mockRejectedValueOnce(new Error('file failure'));
      },
    });

    const logger = createEnhancedMockLogger();
    const traceDirectoryManager = {
      selectDirectory: jest.fn(async () => ({})),
      ensureSubdirectoryExists: jest.fn(async () => ({})),
    };

    const service = new ActionTraceOutputService({
      logger,
      traceDirectoryManager,
      outputToFiles: true,
      testMode: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const baseWriteData = {
      writeMetadata: { writeSequence: 1 },
    };
    const trace = {
      actionId: 'default-trace',
      actorId: 'actor-200',
      duration: 10,
      getExecutionPhases: () => ['phase-1'],
    };

    await service.__TEST_ONLY_defaultOutputHandler(baseWriteData, trace);
    await service.__TEST_ONLY_defaultOutputHandler(baseWriteData, trace);
    await service.__TEST_ONLY_defaultOutputHandler(baseWriteData, trace).catch(() => {});

    expect(writeSpy).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(
      'File output failed, falling back to console logging',
      expect.objectContaining({ actionId: 'default-trace' })
    );
    expect(logger.error).toHaveBeenCalledWith(
      'File output error, falling back to console logging',
      expect.objectContaining({ error: 'file failure' })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'ACTION_TRACE',
      expect.objectContaining({ actionId: 'default-trace' })
    );
  });

  it('should export traces via File System Access API with formatter fallbacks', async () => {
    const ActionTraceOutputService = await loadService({
      disableQueueProcessor: true,
    });
    const logger = createEnhancedMockLogger();
    const storageAdapter = new InMemoryStorageAdapter();
    const eventBus = { dispatch: jest.fn() };
    const writtenFiles = [];
    const directoryHandle = {
      getFileHandle: jest.fn(async (fileName) => ({
        createWritable: jest.fn(async () => ({
          write: async (content) => {
            writtenFiles.push({ fileName, content });
          },
          close: async () => {},
        })),
      })),
    };
    const traceDirectoryManager = {
      selectDirectory: jest.fn(async () => directoryHandle),
      ensureSubdirectoryExists: jest.fn(async () => directoryHandle),
    };

    const jsonFormatter = {
      format: jest.fn((value) => {
        if (value && typeof value.toJSON === 'function') {
          throw new Error('trace object formatting not supported');
        }
        if (value && value.throwDuringExport) {
          throw new Error('formatter failure');
        }
        return JSON.stringify({ ...value, formatted: true });
      }),
    };

    const humanReadableFormatter = {
      format: jest.fn((value) => {
        if (value && value.forceTextError) {
          throw new Error('text format error');
        }
        return `Human readable trace for ${value.actionType || value.type}`;
      }),
    };

    const service = new ActionTraceOutputService({
      storageAdapter,
      logger,
      jsonFormatter,
      humanReadableFormatter,
      eventBus,
      traceDirectoryManager,
    });

    window.showDirectoryPicker = jest.fn();

    const baseTimestamp = Date.now();
    await service.__TEST_ONLY_storeTrace({
      actionId: 'alpha-action',
      actorId: 'actor-1',
      toJSON: () => ({
        actionType: 'alpha',
        details: { stage: 1, timestamp: baseTimestamp },
      }),
    });

    await service.__TEST_ONLY_storeTrace({
      actionId: 'beta-action',
      actorId: 'actor-2',
      toJSON: () => ({
        actionType: 'beta',
        forceTextError: true,
        throwDuringExport: true,
        timestamp: baseTimestamp - 5000,
      }),
    });

    const textResult = await service.exportTracesToFileSystem(null, 'text');
    expect(textResult.success).toBe(true);
    expect(textResult.exportedCount).toBe(2);
    expect(eventBus.dispatch).toHaveBeenCalledTimes(2);
    expect(writtenFiles).toHaveLength(2);
    expect(writtenFiles[1].content).toContain('"forceTextError"');

    writtenFiles.length = 0;
    const jsonResult = await service.exportTracesToFileSystem(null, 'json');
    expect(jsonResult.exportedCount).toBe(2);
    expect(jsonFormatter.format).toHaveBeenCalled();
    expect(writtenFiles[0].content).toContain('"formatted":true');
    expect(writtenFiles[1].content).toContain('"throwDuringExport"');
  });

  it('should export traces as downloads when File System Access API is unavailable', async () => {
    const ActionTraceOutputService = await loadService({
      disableQueueProcessor: true,
    });
    const logger = createEnhancedMockLogger();
    const storageAdapter = new InMemoryStorageAdapter();

    const jsonFormatter = {
      format: jest.fn((value) => {
        if (value && typeof value.toJSON === 'function') {
          throw new Error('trace object formatting not supported');
        }
        if (value && value.shouldThrowDuringJson) {
          throw new Error('json export failure');
        }
        return JSON.stringify({ ...value, formatted: true });
      }),
    };

    const service = new ActionTraceOutputService({
      storageAdapter,
      logger,
      jsonFormatter,
    });

    await service.__TEST_ONLY_storeTrace({
      actionId: 'download-alpha',
      actorId: 'actor-3',
      toJSON: () => ({ type: 'alpha' }),
    });
    await service.__TEST_ONLY_storeTrace({
      actionId: 'download-beta',
      actorId: 'actor-4',
      toJSON: () => ({ type: 'beta', shouldThrowDuringJson: true }),
    });

    window.showDirectoryPicker = undefined;

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => '';
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {};
    }
    const createObjectURLSpy = jest
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:download');
    const revokeObjectURLSpy = jest
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    const anchorClick = jest.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName) => {
        if (tagName === 'a') {
          return {
            click: anchorClick,
            set href(value) {
              this._href = value;
            },
            get href() {
              return this._href;
            },
            set download(value) {
              this._download = value;
            },
            get download() {
              return this._download;
            },
          };
        }
        return originalCreateElement(tagName);
      });

    const textResult = await service.exportTracesAsDownload('text');
    expect(textResult.success).toBe(true);
    expect(textResult.method).toBe('download');
    expect(anchorClick).toHaveBeenCalled();

    const jsonResult = await service.exportTracesAsDownload('json');
    expect(jsonResult.exportedCount).toBe(2);
    expect(jsonFormatter.format).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'beta', shouldThrowDuringJson: true })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to format trace during export',
      expect.any(Error)
    );

    createElementSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('should handle export directory fallbacks and enforce export locking', async () => {
    const ActionTraceOutputService = await loadService({
      disableQueueProcessor: true,
    });
    const logger = createEnhancedMockLogger();
    const storageAdapter = new InMemoryStorageAdapter({ actionTraces: [] });
    const traceDirectoryManager = {
      selectDirectory: jest.fn(),
      ensureSubdirectoryExists: jest.fn(),
    };

    const service = new ActionTraceOutputService({
      storageAdapter,
      logger,
      traceDirectoryManager,
    });

    window.showDirectoryPicker = jest.fn();

    traceDirectoryManager.selectDirectory.mockResolvedValueOnce(null);
    const cancelled = await service.exportTracesToFileSystem();
    expect(cancelled).toEqual(
      expect.objectContaining({
        success: false,
        reason: 'User cancelled directory selection',
      })
    );

    traceDirectoryManager.selectDirectory.mockResolvedValueOnce({});
    traceDirectoryManager.ensureSubdirectoryExists.mockResolvedValueOnce(null);
    const dirFailure = await service.exportTracesToFileSystem();
    expect(dirFailure.reason).toBe('Failed to create export directory');

    traceDirectoryManager.selectDirectory.mockResolvedValueOnce({});
    traceDirectoryManager.ensureSubdirectoryExists.mockResolvedValueOnce({});
    const noTraces = await service.exportTracesToFileSystem();
    expect(noTraces.reason).toBe('No traces found to export');

    let resolveSelection;
    traceDirectoryManager.selectDirectory.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSelection = resolve;
        })
    );
    const pendingExport = service.exportTracesToFileSystem();
    await expect(service.exportTracesToFileSystem()).rejects.toThrow(
      'Export already in progress'
    );
    resolveSelection({});
    traceDirectoryManager.ensureSubdirectoryExists.mockResolvedValueOnce({});
    await pendingExport;

    const directoryHandle = {
      __files: [],
      getFileHandle: jest.fn(async (fileName) => ({
        createWritable: jest.fn(async () => ({
          write: async (content) => directoryHandle.__files.push({ fileName, content }),
          close: async () => {},
        })),
      })),
    };

    await service.__TEST_ONLY_storeTrace({
      toJSON: () => ({ actionType: 'alpha' }),
    });
    await service.__TEST_ONLY_storeTrace({
      toJSON: () => ({ actionType: 'beta' }),
    });

    const storedTraces = Object.values(storageAdapter.store).find(
      (value) => Array.isArray(value) && value.length > 0
    );
    const targetId = storedTraces[1].id;

    traceDirectoryManager.selectDirectory.mockResolvedValueOnce(directoryHandle);
    traceDirectoryManager.ensureSubdirectoryExists.mockResolvedValueOnce(
      directoryHandle
    );

    const selective = await service.exportTracesToFileSystem([targetId], 'json');
    expect(selective.exportedCount).toBe(1);
    expect(directoryHandle.__files).toHaveLength(1);
    expect(directoryHandle.__files[0].fileName).toContain('beta');
  });

  it('should delegate legacy exportTraces to the download fallback', async () => {
    const ActionTraceOutputService = await loadService({
      disableQueueProcessor: true,
    });
    const logger = createEnhancedMockLogger();
    const storageAdapter = new InMemoryStorageAdapter({ actionTraces: [] });

    const service = new ActionTraceOutputService({
      storageAdapter,
      logger,
    });

    await service.__TEST_ONLY_storeTrace({
      toJSON: () => ({ actionType: 'legacy', details: { step: 1 } }),
    });

    window.showDirectoryPicker = undefined;

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);

    if (!URL.createObjectURL) {
      URL.createObjectURL = () => 'blob:trace';
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {};
    }

    const clickSpy = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return {
          set href(value) {
            this._href = value;
          },
          set download(value) {
            this._download = value;
          },
          click: clickSpy,
        };
      }
      return originalCreateElement(tag);
    });

    const exportResult = await service.exportTraces('text');
    expect(exportResult.success).toBe(true);
    expect(exportResult.method).toBe('download');
    expect(clickSpy).toHaveBeenCalled();

    document.createElement.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('should format structured traces and compute statistics with fallbacks', async () => {
    const ActionTraceOutputService = await loadService();
    const logger = createEnhancedMockLogger();
    const outputHandler = jest.fn(async () => {});
    const jsonFormatter = {
      format: jest.fn(() => '{not valid json}'),
    };
    const humanReadableFormatter = {
      format: jest.fn(() => 'structured trace summary'),
    };

    const service = new ActionTraceOutputService({
      logger,
      jsonFormatter,
      humanReadableFormatter,
      outputHandler,
    });

    const tracedActions = new Map();
    tracedActions.set('primary-action', {
      actorId: 'actor-99',
      stages: {
        initialization: { timestamp: 100 },
        enhanced_scope_evaluation: {
          data: {
            scope: 'global',
            timestamp: 200,
            entityDiscovery: [
              { foundEntities: 2 },
              { foundEntities: 3 },
            ],
            filterEvaluations: [
              { filterPassed: true },
              { filterPassed: false },
            ],
          },
        },
        completion: { timestamp: 450 },
      },
    });
    tracedActions.set('_current_scope_evaluation', {
      stages: {
        operator_evaluations: {
          timestamp: 500,
          data: {
            evaluations: [
              { operator: 'alpha', verdict: 'pass' },
              { operator: 'beta', verdict: 'fail' },
            ],
          },
        },
      },
    });

    const spans = [
      {
        operation: 'primary',
        startTime: 300,
        endTime: 200,
        attributes: { key: 'value' },
      },
    ];

    const trace = {
      actionId: 'trace-action',
      actorId: 'actor-99',
      isComplete: true,
      hasError: false,
      getTracedActions: () => tracedActions,
      getSpans: () => spans,
    };

    await service.writeTrace(trace);
    expect(outputHandler).toHaveBeenCalledTimes(1);

    const writtenData = outputHandler.mock.calls[0][0];
    expect(writtenData.actions['primary-action'].enhancedScopeEvaluation.summary)
      .toMatchObject({
        entitiesDiscovered: 5,
        entitiesPassed: 1,
        entitiesFailed: 1,
      });
    expect(writtenData.operatorEvaluations.totalCount).toBe(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Span "primary" has negative duration')
    );

    const stats = service.getStatistics();
    expect(stats.totalWrites).toBe(1);
    expect(service.getQueueStats().queueLength).toBe(0);
    expect(service.getQueueMetrics()).toBeNull();

    service.resetStatistics();
    expect(service.getStatistics().totalWrites).toBe(0);

    service.setOutputDirectory('./unused-directory');
    expect(logger.warn).toHaveBeenCalledWith(
      'ActionTraceOutputService: Cannot set output directory - file output not enabled'
    );

    expect(service.enableFileOutput('./traces')).toBe(true);
    service.setOutputDirectory('./alternate-traces');
    expect(logger.info).toHaveBeenCalledWith(
      'ActionTraceOutputService: Output directory set to ./alternate-traces'
    );
  });

  it('should wait for pending writes and surface failures', async () => {
    const ActionTraceOutputService = await loadService();
    const logger = createEnhancedMockLogger();
    const slowOutputHandler = jest.fn(
      () => new Promise((resolve) => setTimeout(resolve, 20))
    );

    const service = new ActionTraceOutputService({
      logger,
      outputHandler: slowOutputHandler,
    });

    const trace = {
      toJSON: () => ({ id: 'pending-trace' }),
    };

    const pending = service.writeTrace(trace);
    await service.waitForPendingWrites();
    await pending;

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Waiting for 1 pending trace writes')
    );
    expect(logger.info).toHaveBeenCalledWith(
      'All pending trace writes completed'
    );

    const failingOutputHandler = jest.fn(
      () =>
        new Promise((_, reject) => setTimeout(() => reject(new Error('fail')), 5))
    );

    const failingLogger = createEnhancedMockLogger();
    const failingService = new ActionTraceOutputService({
      logger: failingLogger,
      outputHandler: failingOutputHandler,
    });

    const failingTrace = {
      toJSON: () => ({ id: 'failing-trace' }),
    };

    failingService.writeTrace(failingTrace).catch(() => {});
    await failingService.waitForPendingWrites();
    expect(failingLogger.error).toHaveBeenCalledWith(
      'Error waiting for pending writes',
      expect.any(Error)
    );
    expect(failingService.getStatistics().totalErrors).toBe(1);
    expect(failingService.getStatistics().pendingWrites).toBe(0);
  });

  it('should process simple queue shutdown when advanced processor is unavailable', async () => {
    const ActionTraceOutputService = await loadService({
      disableQueueProcessor: true,
    });
    const logger = createEnhancedMockLogger();
    const storageAdapter = new InMemoryStorageAdapter();

    const service = new ActionTraceOutputService({
      storageAdapter,
      logger,
    });

    const trace = {
      toJSON: () => ({ id: 'queued-trace' }),
    };

    await service.__TEST_ONLY_storeTrace(trace);

    const stats = service.getQueueStats();
    expect(stats.queueLength).toBe(0);
    expect(stats.maxQueueSize).toBeGreaterThan(0);

    await service.shutdown();
    expect(logger.info).toHaveBeenCalledWith(
      'ActionTraceOutputService: Shutdown complete'
    );
  });

  it('should handle rotation manager shutdown errors and wait for file operations', async () => {
    let shutdownSpy;
    const ActionTraceOutputService = await loadService({
      beforeImport: async () => {
        const module = await import(
          '../../../../src/actions/tracing/storageRotationManager.js'
        );
        shutdownSpy = jest
          .spyOn(module.StorageRotationManager.prototype, 'shutdown')
          .mockImplementation(() => {
            throw new Error('rotation failure');
          });
      },
    });

    const logger = createEnhancedMockLogger();
    const storageAdapter = new InMemoryStorageAdapter();
    const traceDirectoryManager = {
      selectDirectory: jest.fn(async () => ({})),
      ensureSubdirectoryExists: jest.fn(async () => ({})),
    };

    const service = new ActionTraceOutputService({
      storageAdapter,
      logger,
      traceDirectoryManager,
      outputDirectory: './virtual-traces',
      outputToFiles: true,
      testMode: true,
    });

    service.updateConfiguration({
      outputFormats: ['json', 'text'],
      textFormatOptions: { indent: 2 },
    });

    const metrics = service.getQueueMetrics();
    expect(metrics).not.toBeNull();
    const rotationStatsBefore = await service.getRotationStatistics();
    expect(rotationStatsBefore).not.toBeNull();

    const trace = {
      toJSON: () => ({ id: 'file-trace' }),
    };

    const pendingWrite = service.writeTraceWithPriority(trace);
    const shutdownPromise = service.shutdown();

    await Promise.all([pendingWrite, shutdownPromise]);

    expect(shutdownSpy).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'ActionTraceOutputService: Error shutting down rotation manager',
      expect.any(Error)
    );

    const rotationStats = await service.getRotationStatistics();
    expect(rotationStats).not.toBeNull();

    await service.waitForFileOperations();

    shutdownSpy.mockRestore();
  });

  it('should warn when setting directory before enabling and forward updates to handler', async () => {
    let setDirectorySpy;
    const ActionTraceOutputService = await loadService({
      beforeImport: async () => {
        const module = await import(
          '../../../../src/actions/tracing/fileTraceOutputHandler.js'
        );
        jest
          .spyOn(module.default.prototype, 'initialize')
          .mockResolvedValue(true);
        setDirectorySpy = jest.spyOn(
          module.default.prototype,
          'setOutputDirectory'
        );
      },
    });

    const logger = createEnhancedMockLogger();
    const traceDirectoryManager = {
      selectDirectory: jest.fn(async () => ({})),
      ensureSubdirectoryExists: jest.fn(async () => ({})),
    };

    const service = new ActionTraceOutputService({
      logger,
      traceDirectoryManager,
    });

    service.setOutputDirectory('./unused');
    expect(logger.warn).toHaveBeenCalledWith(
      'ActionTraceOutputService: Cannot set output directory - file output not enabled'
    );

    const enabled = service.enableFileOutput('./primary');
    expect(enabled).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      'ActionTraceOutputService: File output mode enabled',
      expect.objectContaining({ outputDirectory: './primary' })
    );

    service.setOutputDirectory('./secondary');
    expect(setDirectorySpy).toHaveBeenCalledWith('./secondary');
  });

  it('should report enableFileOutput failures when handler updates throw', async () => {
    let setDirectorySpy;
    const ActionTraceOutputService = await loadService({
      beforeImport: async () => {
        const module = await import(
          '../../../../src/actions/tracing/fileTraceOutputHandler.js'
        );
        jest
          .spyOn(module.default.prototype, 'initialize')
          .mockResolvedValue(true);
        setDirectorySpy = jest
          .spyOn(module.default.prototype, 'setOutputDirectory')
          .mockImplementation(() => {
            throw new Error('directory failure');
          });
      },
    });

    const logger = createEnhancedMockLogger();
    const traceDirectoryManager = {
      selectDirectory: jest.fn(async () => ({})),
      ensureSubdirectoryExists: jest.fn(async () => ({})),
    };

    const service = new ActionTraceOutputService({
      logger,
      traceDirectoryManager,
      outputToFiles: true,
      testMode: true,
    });

    const enabled = service.enableFileOutput('./broken');
    expect(enabled).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'ActionTraceOutputService: Failed to enable file output',
      expect.any(Error)
    );
    expect(setDirectorySpy).toHaveBeenCalled();
  });

  it('should warn when file operations fail to drain within the timeout window', async () => {
    const ActionTraceOutputService = await loadService({
      beforeImport: async () => {
        const module = await import(
          '../../../../src/actions/tracing/fileTraceOutputHandler.js'
        );
        jest
          .spyOn(module.default.prototype, 'initialize')
          .mockResolvedValue(true);
        jest
          .spyOn(module.default.prototype, 'isQueueEmpty')
          .mockImplementation(() => false);
      },
    });

    jest.useFakeTimers();
    const logger = createEnhancedMockLogger();
    const service = new ActionTraceOutputService({
      logger,
      outputToFiles: true,
      testMode: true,
    });

    const waitPromise = service.waitForFileOperations();
    await jest.advanceTimersByTimeAsync(5000);
    await waitPromise;

    expect(logger.warn).toHaveBeenCalledWith(
      'File operations may not have completed within timeout'
    );
    jest.useRealTimers();
  });

  it('should confirm file operations completion when the handler queue drains', async () => {
    let callCount = 0;
    const ActionTraceOutputService = await loadService({
      beforeImport: async () => {
        const module = await import(
          '../../../../src/actions/tracing/fileTraceOutputHandler.js'
        );
        jest
          .spyOn(module.default.prototype, 'initialize')
          .mockResolvedValue(true);
        jest
          .spyOn(module.default.prototype, 'isQueueEmpty')
          .mockImplementation(() => {
            callCount++;
            return callCount > 2;
          });
      },
    });

    jest.useFakeTimers();
    const logger = createEnhancedMockLogger();
    const service = new ActionTraceOutputService({
      logger,
      outputToFiles: true,
      testMode: true,
    });

    const waitPromise = service.waitForFileOperations();
    await jest.advanceTimersByTimeAsync(400);
    await waitPromise;

    expect(logger.debug).toHaveBeenCalledWith(
      'File operations completed successfully'
    );
    jest.useRealTimers();
  });

  it('should handle aborted directory access and missing storage during exports', async () => {
    const ActionTraceOutputService = await loadService({
      disableQueueProcessor: true,
    });
    const logger = createEnhancedMockLogger();
    const storageAdapter = new InMemoryStorageAdapter();
    const traceDirectoryManager = {
      selectDirectory: jest.fn(),
      ensureSubdirectoryExists: jest.fn(),
    };

    const service = new ActionTraceOutputService({
      storageAdapter,
      logger,
      traceDirectoryManager,
    });

    await service.__TEST_ONLY_storeTrace({
      toJSON: () => ({ type: 'abort' }),
    });

    window.showDirectoryPicker = jest.fn();
    const abortError = new Error('permission denied');
    abortError.name = 'AbortError';
    traceDirectoryManager.selectDirectory.mockImplementation(() => {
      throw abortError;
    });

    const abortResult = await service.exportTracesToFileSystem();
    expect(abortResult).toEqual(
      expect.objectContaining({
        success: false,
        reason: 'User denied file system access',
      })
    );

    const downloadOnlyService = new ActionTraceOutputService({
      logger: createEnhancedMockLogger(),
    });

    const downloadResult = await downloadOnlyService.exportTracesAsDownload();
    expect(downloadResult).toEqual(
      expect.objectContaining({
        success: false,
        reason: 'No storage adapter available',
      })
    );
    expect(downloadOnlyService.getStatistics()).toMatchObject({
      totalWrites: 0,
      totalErrors: 0,
    });
  });

  it('should persist traces lacking serializers using fallback formatting', async () => {
    const ActionTraceOutputService = await loadService({
      disableQueueProcessor: true,
    });
    const logger = createEnhancedMockLogger();
    class RecordingStorageAdapter extends InMemoryStorageAdapter {
      constructor() {
        super({ actionTraces: [] });
        this.lastSet = null;
      }

      async setItem(key, value) {
        this.lastSet = value;
        return super.setItem(key, value);
      }
    }

    const storageAdapter = new RecordingStorageAdapter();

    const service = new ActionTraceOutputService({
      storageAdapter,
      logger,
    });

    await service.__TEST_ONLY_storeTrace({ arbitrary: 'data' });

    expect(Array.isArray(storageAdapter.lastSet)).toBe(true);
    expect(storageAdapter.lastSet[0].data).toEqual(
      expect.objectContaining({ type: 'unknown' })
    );
  });
});
