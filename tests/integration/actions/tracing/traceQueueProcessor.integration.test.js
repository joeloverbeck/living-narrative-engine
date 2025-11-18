import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraceQueueProcessor } from '../../../../src/actions/tracing/traceQueueProcessor.js';
import { TracePriority } from '../../../../src/actions/tracing/tracePriority.js';
import { QUEUE_EVENTS } from '../../../../src/actions/tracing/actionTraceTypes.js';
import { TestTimerService } from '../../../../src/actions/tracing/timerService.js';
import { IndexedDBStorageAdapter } from '../../../../src/storage/indexedDBStorageAdapter.js';
import ConsoleLogger, {
  LogLevel,
} from '../../../../src/logging/consoleLogger.js';
import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import {
  NamingStrategy,
  TimestampFormat,
} from '../../../../src/actions/tracing/traceIdGenerator.js';

/**
 * Helper that creates a unique IndexedDB storage adapter for each test.
 *
 * @param {ConsoleLogger} logger
 * @param {typeof IndexedDBStorageAdapter} AdapterClass
 * @param {object} options
 * @returns {Promise<{adapter: IndexedDBStorageAdapter, dbName: string, storeName: string}>}
 */
async function createStorageAdapter(
  logger,
  AdapterClass = IndexedDBStorageAdapter,
  options = {}
) {
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const dbName = options.dbName || `TraceQueueIntegration_${uniqueSuffix}`;
  const storeName = options.storeName || 'traces';
  const adapter = new AdapterClass({
    logger,
    dbName,
    storeName,
    ...options,
  });
  await adapter.initialize();
  return { adapter, dbName, storeName };
}

/**
 *
 * @param dbName
 */
async function deleteDatabase(dbName) {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

class FlakyIndexedDBAdapter extends IndexedDBStorageAdapter {
  constructor({ failuresBeforeSuccess = 0, alwaysFail = false, ...options }) {
    super(options);
    this.failuresBeforeSuccess = failuresBeforeSuccess;
    this.alwaysFail = alwaysFail;
    this.attempts = 0;
  }

  async setItem(key, value) {
    this.attempts += 1;
    if (this.alwaysFail || this.attempts <= this.failuresBeforeSuccess) {
      throw new Error('Simulated storage failure');
    }
    return super.setItem(key, value);
  }
}

class RetryThenSuccessAdapter extends IndexedDBStorageAdapter {
  constructor(options) {
    super(options);
    this.attempts = 0;
  }

  async setItem(key, value) {
    this.attempts += 1;
    if (this.attempts === 1) {
      throw new Error('Temporary storage failure');
    }
    return super.setItem(key, value);
  }
}

class ShutdownAwareIndexedDBAdapter extends IndexedDBStorageAdapter {
  constructor(options) {
    super(options);
    this.beforeFailure = null;
    this._failureTriggered = false;
  }

  async setItem(key, value) {
    if (!this._failureTriggered) {
      this._failureTriggered = true;
      if (this.beforeFailure) {
        await this.beforeFailure();
      }
      throw new Error('Simulated failure during shutdown');
    }
    return super.setItem(key, value);
  }
}

class FailingGetIndexedDBAdapter extends IndexedDBStorageAdapter {
  constructor(options) {
    super(options);
    this.failOnNextGet = false;
  }

  async getItem(key) {
    if (this.failOnNextGet) {
      this.failOnNextGet = false;
      throw new Error('Forced read failure');
    }
    return super.getItem(key);
  }
}

class ThrowingWaitTimerService extends TestTimerService {
  async waitForCompletion() {
    throw new Error('waitForCompletion forced failure');
  }
}

/**
 *
 * @param processor
 * @param timerService
 * @param maxAttempts
 */
async function waitForProcessingToDrain(processor, timerService, maxAttempts = 25) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (timerService.hasPending()) {
      await timerService.triggerAll();
      continue;
    }

    await timerService.waitForCompletion();

    const stats = processor.getQueueStats();
    if (!stats.isProcessing && stats.totalSize === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('TraceQueueProcessor integration', () => {
  let logger;
  let timerService;
  let eventBus;
  const activeDatabases = [];

  beforeEach(() => {
    logger = new ConsoleLogger(LogLevel.ERROR);
    timerService = new TestTimerService();
    eventBus = { dispatch: jest.fn() };
  });

  afterEach(async () => {
    if (timerService) {
      timerService.clearAll();
    }
    await Promise.all(activeDatabases.splice(0).map((dbName) => deleteDatabase(dbName)));
  });

  const buildExecutionTrace = () => {
    const trace = new ActionExecutionTrace({
      actionId: 'movement:go',
      actorId: 'hero',
      turnAction: { actionDefinitionId: 'movement:go' },
    });
    trace.captureDispatchStart();
    trace.captureEventPayload({ direction: 'north' });
    trace.captureDispatchResult({ success: true, timestamp: Date.now() });
    return trace;
  };

  const buildStructuredTrace = () => {
    const filter = new ActionTraceFilter({ logger });
    const structured = new ActionAwareStructuredTrace({
      actionTraceFilter: filter,
      actorId: 'hero',
      context: { quest: 'dragon-hunt' },
      logger,
    });

    structured.captureActionData('component_filtering', 'movement:go', {
      passed: true,
      metadata: 'stage-1',
    });
    structured.captureActionData('resolution', 'movement:go', {
      outcome: 'success',
      metadata: 'stage-2',
    });
    return structured;
  };

  it('processes prioritized batches and persists formatted traces using real collaborators', async () => {
    const { adapter, dbName } = await createStorageAdapter(logger);
    activeDatabases.push(dbName);

    const processor = new TraceQueueProcessor({
      storageAdapter: adapter,
      logger,
      eventBus,
      timerService,
      config: {
        batchSize: 2,
        batchTimeout: 5,
        storageKey: 'integration-traces',
        enableParallelProcessing: false,
        maxStoredTraces: 10,
      },
    });

    let isShutdown = false;
    try {
      const executionTrace = buildExecutionTrace();
      const structuredTrace = buildStructuredTrace();
      const fallbackTrace = { label: 'misc', detail: { value: 42 } };

      expect(
        processor.enqueue(executionTrace, TracePriority.HIGH)
      ).toBe(true);
      expect(
        processor.enqueue(structuredTrace, TracePriority.NORMAL)
      ).toBe(true);
      expect(processor.enqueue(fallbackTrace, TracePriority.LOW)).toBe(true);

      await waitForProcessingToDrain(processor, timerService);

      await processor.shutdown();
      isShutdown = true;

      const stored = await adapter.getItem('integration-traces');
      const metrics = processor.getMetrics();
      expect(stored).toHaveLength(3);

      const [highPriority, structuredRecord, fallbackRecord] = stored;
      expect(highPriority.priority).toBe(TracePriority.HIGH);
      expect(structuredRecord.data.actions['movement:go'].stageOrder).toEqual([
        'component_filtering',
        'resolution',
      ]);
      expect(fallbackRecord.data.type).toBe('unknown');

      expect(metrics.totalProcessed).toBe(3);
      expect(metrics.fullBatches).toBe(1);
      expect(metrics.priorityDistribution[TracePriority.HIGH]).toBe(1);
      expect(metrics.priorityDistribution[TracePriority.NORMAL]).toBe(1);
      expect(metrics.priorityDistribution[TracePriority.LOW]).toBe(1);

      const stats = processor.getQueueStats();
      expect(stats.totalSize).toBe(0);
      expect(stats.isProcessing).toBe(false);

      expect(eventBus.dispatch).toHaveBeenCalledWith(
        QUEUE_EVENTS.BATCH_PROCESSED,
        expect.objectContaining({
          batchSize: expect.any(Number),
          remainingItems: expect.any(Number),
        })
      );
    } finally {
      if (!isShutdown) {
        await processor.shutdown();
      }
    }
  });

  it('supports parallel batch execution while preserving all trace records', async () => {
    const { adapter, dbName } = await createStorageAdapter(logger);
    activeDatabases.push(dbName);

    const parallelTimer = new TestTimerService();
    const parallelEventBus = { dispatch: jest.fn() };

    const parallelProcessor = new TraceQueueProcessor({
      storageAdapter: adapter,
      logger,
      eventBus: parallelEventBus,
      timerService: parallelTimer,
      config: {
        batchSize: 3,
        batchTimeout: 5,
        storageKey: 'parallel-traces',
        enableParallelProcessing: true,
        maxStoredTraces: 10,
      },
    });

    let isShutdown = false;
    try {
      const execTrace = buildExecutionTrace();
      const structuredTrace = buildStructuredTrace();
      const fallbackTrace = {
        actionId: 'debug:trace',
        toJSON: () => ({ actionId: 'debug:trace' }),
      };

      expect(parallelProcessor.enqueue(execTrace, TracePriority.NORMAL)).toBe(
        true
      );
      expect(parallelProcessor.enqueue(structuredTrace)).toBe(true);
      expect(parallelProcessor.enqueue(fallbackTrace, TracePriority.CRITICAL)).toBe(
        true
      );

      await waitForProcessingToDrain(parallelProcessor, parallelTimer);
      const metrics = parallelProcessor.getMetrics();
      expect(metrics.totalProcessed).toBe(3);
      expect(metrics.totalBatches).toBeGreaterThanOrEqual(1);

      await parallelProcessor.shutdown();
      isShutdown = true;

      const stored = await adapter.getItem('parallel-traces');
      expect(stored.length).toBeGreaterThanOrEqual(1);
      const batchCalls = parallelEventBus.dispatch.mock.calls.filter(
        ([event]) => event === QUEUE_EVENTS.BATCH_PROCESSED
      );
      expect(batchCalls.length).toBeGreaterThanOrEqual(1);
      expect(
        batchCalls.some(([, payload]) => (payload?.batchSize || 0) >= 2)
      ).toBe(true);
    } finally {
      if (!isShutdown) {
        await parallelProcessor.shutdown();
      }
      parallelTimer.clearAll();
    }
  });

  it('applies backpressure when hitting limits and drops lower priority traces', async () => {
    const { adapter, dbName } = await createStorageAdapter(logger);
    activeDatabases.push(dbName);

    const processor = new TraceQueueProcessor({
      storageAdapter: adapter,
      logger,
      eventBus,
      timerService,
      config: {
        maxQueueSize: 3,
        batchSize: 5,
        batchTimeout: 50,
        memoryLimit: 600,
        storageKey: 'backpressure-traces',
        enableParallelProcessing: false,
        maxStoredTraces: 10,
      },
    });

    let isShutdown = false;
    let warnSpy;
    try {
      const largeTrace = { actionId: 'normal:one', payload: 'x'.repeat(150) };
      const anotherLargeTrace = {
        actionId: 'normal:two',
        payload: 'y'.repeat(150),
      };
      const additionalLowPriority = {
        actionId: 'normal:four',
        payload: 'z'.repeat(120),
      };
      const extraLowPriority = {
        actionId: 'normal:five',
        payload: 'w'.repeat(120),
      };
      const circularTrace = { actionId: 'normal:three' };
      circularTrace.self = circularTrace;

      warnSpy = jest.spyOn(logger, 'warn');

      expect(processor.enqueue(largeTrace, TracePriority.NORMAL)).toBe(true);
      expect(processor.enqueue(anotherLargeTrace, TracePriority.LOW)).toBe(true);
      expect(processor.enqueue(additionalLowPriority, TracePriority.LOW)).toBe(true);
      expect(processor.enqueue(extraLowPriority, TracePriority.LOW)).toBe(true);
      expect(processor.enqueue(circularTrace, TracePriority.HIGH)).toBe(false);

      // No processing triggered yet - shutdown will flush remaining items
      await processor.shutdown();
      isShutdown = true;

      expect(warnSpy).toHaveBeenCalled();

      const stored = await adapter.getItem('backpressure-traces');
      expect(stored.length).toBeGreaterThanOrEqual(1);
      const priorities = stored.map((entry) => entry.priority);
      expect(priorities).toContain(TracePriority.NORMAL);
      expect(priorities).not.toContain(TracePriority.HIGH);
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        QUEUE_EVENTS.BACKPRESSURE,
        expect.objectContaining({
          droppedCount: expect.any(Number),
        })
      );

      const metrics = processor.getMetrics();
      expect(metrics.totalDropped).toBeGreaterThan(0);
    } finally {
      warnSpy.mockRestore?.();
      if (!isShutdown) {
        await processor.shutdown();
      }
    }
  });

  it('rejects null traces and drops new entries when the queue stays saturated after mitigation', async () => {
    const { adapter, dbName } = await createStorageAdapter(logger);
    activeDatabases.push(dbName);

    const saturationTimer = new TestTimerService();
    const saturationEventBus = { dispatch: jest.fn() };

    const processor = new TraceQueueProcessor({
      storageAdapter: adapter,
      logger,
      eventBus: saturationEventBus,
      timerService: saturationTimer,
      config: {
        maxQueueSize: 1,
        batchSize: 5,
        batchTimeout: 50,
        memoryLimit: 10_000,
        storageKey: 'saturated-queue',
        enableParallelProcessing: false,
        maxStoredTraces: 5,
      },
    });

    const warnSpy = jest.spyOn(logger, 'warn');

    try {
      expect(processor.enqueue(null)).toBe(false);

      const retainedTrace = { actionId: 'critical:locked' };
      expect(processor.enqueue(retainedTrace, TracePriority.HIGH)).toBe(true);

      const blockedTrace = { actionId: 'critical:blocked' };
      expect(processor.enqueue(blockedTrace, TracePriority.HIGH)).toBe(false);

      expect(warnSpy).toHaveBeenCalledWith(
        'TraceQueueProcessor: Null trace provided'
      );
      expect(warnSpy).toHaveBeenCalledWith(
        'TraceQueueProcessor: Queue full, dropping trace'
      );

      const metrics = processor.getMetrics();
      expect(metrics.totalDropped).toBeGreaterThanOrEqual(1);

      expect(saturationEventBus.dispatch).toHaveBeenCalledWith(
        QUEUE_EVENTS.BACKPRESSURE,
        expect.objectContaining({
          droppedCount: expect.any(Number),
        })
      );
    } finally {
      warnSpy.mockRestore();
      await processor.shutdown();
      saturationTimer.clearAll();
    }
  });

  it('retries transient failures with exponential backoff and persists after recovery', async () => {
    const { adapter, dbName } = await createStorageAdapter(logger, FlakyIndexedDBAdapter, {
      failuresBeforeSuccess: 1,
    });
    activeDatabases.push(dbName);

    const retryTimerService = new TestTimerService();
    const retryEventBus = { dispatch: jest.fn() };

    const processor = new TraceQueueProcessor({
      storageAdapter: adapter,
      logger,
      eventBus: retryEventBus,
      timerService: retryTimerService,
      config: {
        batchSize: 1,
        batchTimeout: 5,
        maxRetries: 2,
        storageKey: 'retry-traces',
        enableParallelProcessing: false,
        maxStoredTraces: 20,
      },
    });

    const scheduledDelays = [];
    const realSetTimeout = retryTimerService.setTimeout.bind(retryTimerService);
    jest
      .spyOn(retryTimerService, 'setTimeout')
      .mockImplementation((callback, delay) => {
        scheduledDelays.push(delay);
        return realSetTimeout(callback, delay);
      });

    try {
      expect(
        processor.enqueue(buildExecutionTrace(), TracePriority.NORMAL)
      ).toBe(true);

      await waitForProcessingToDrain(processor, retryTimerService);

      const retryMetrics = processor.getMetrics();
      expect(retryMetrics.totalProcessed).toBe(1);
      expect(retryMetrics.totalDropped).toBe(0);
      expect(scheduledDelays.some((delay) => delay >= 100)).toBe(true);

      const stored = await adapter.getItem('retry-traces');
      expect(stored).toHaveLength(1);
      expect(adapter.attempts).toBeGreaterThan(1);
    } finally {
      retryTimerService.setTimeout.mockRestore();
      await processor.shutdown();
    }
  });

  it('respects browser memory thresholds when reported heap usage is already near capacity', async () => {
    const originalPerformance = globalThis.performance;
    const originalMemory = originalPerformance?.memory;

    if (!originalPerformance) {
      globalThis.performance = {
        now: () => Date.now(),
      };
    }

    globalThis.performance.memory = {
      usedJSHeapSize: 900,
      jsHeapSizeLimit: 1_000,
    };

    const { adapter, dbName } = await createStorageAdapter(logger);
    activeDatabases.push(dbName);

    const timer = new TestTimerService();
    const memoryEventBus = { dispatch: jest.fn() };

    const processor = new TraceQueueProcessor({
      storageAdapter: adapter,
      logger,
      eventBus: memoryEventBus,
      timerService: timer,
      config: {
        batchSize: 2,
        batchTimeout: 5,
        memoryLimit: 10_000,
        storageKey: 'memory-threshold',
        enableParallelProcessing: false,
        maxStoredTraces: 5,
      },
    });

    const warnSpy = jest.spyOn(logger, 'warn');

    try {
      const heavyTrace = { actionId: 'memory:heavy', payload: 'x'.repeat(1_200) };
      expect(processor.enqueue(heavyTrace, TracePriority.NORMAL)).toBe(false);

      expect(warnSpy).toHaveBeenCalledWith(
        'TraceQueueProcessor: Memory limit still exceeded after backpressure, dropping trace',
        expect.objectContaining({
          limit: expect.any(Number),
        })
      );

      expect(memoryEventBus.dispatch).toHaveBeenCalledWith(
        QUEUE_EVENTS.BACKPRESSURE,
        expect.objectContaining({
          droppedCount: expect.any(Number),
        })
      );

      const metrics = processor.getMetrics();
      expect(metrics.totalDropped).toBe(1);
    } finally {
      warnSpy.mockRestore();
      await processor.shutdown();
      timer.clearAll();
      if (originalPerformance) {
        globalThis.performance.memory = originalMemory;
      } else {
        delete globalThis.performance;
      }
    }
  });

  it('opens the circuit breaker after repeated permanent failures and blocks new enqueues', async () => {
    const breakerLogger = new ConsoleLogger(LogLevel.DEBUG);
    const failureAdapterInfo = await createStorageAdapter(
      breakerLogger,
      FlakyIndexedDBAdapter,
      {
        alwaysFail: true,
      }
    );
    activeDatabases.push(failureAdapterInfo.dbName);

    const breakerTimer = new TestTimerService();
    const breakerEventBus = { dispatch: jest.fn() };
    const breaker = new TraceQueueProcessor({
      storageAdapter: failureAdapterInfo.adapter,
      logger: breakerLogger,
      eventBus: breakerEventBus,
      timerService: breakerTimer,
      config: {
        batchSize: 1,
        batchTimeout: 5,
        maxRetries: 0,
        storageKey: 'breaker-traces',
        enableParallelProcessing: false,
        maxStoredTraces: 5,
      },
    });

    const infoSpy = jest.spyOn(breakerLogger, 'info');
    try {
      for (let i = 0; i < 10; i += 1) {
        expect(
          breaker.enqueue({ actionId: `failure:${i}` }, TracePriority.NORMAL)
        ).toBe(true);
      }

      await waitForProcessingToDrain(breaker, breakerTimer);

      const breakerMetrics = breaker.getMetrics();
      expect(breakerMetrics.totalDropped).toBeGreaterThanOrEqual(1);
      const breakerStats = breaker.getQueueStats();
      expect(breakerStats.circuitBreakerOpen).toBe(true);

      const enqueueAfterBreaker = breaker.enqueue(
        { actionId: 'post-breaker' },
        TracePriority.NORMAL
      );
      expect(enqueueAfterBreaker).toBe(false);

      const wasOpen = breaker.resetCircuitBreaker();
      expect(wasOpen).toBe(true);
      expect(infoSpy).toHaveBeenCalledWith(
        'TraceQueueProcessor: Circuit breaker closed'
      );
    } finally {
      infoSpy.mockRestore();
      await breaker.shutdown();
    }
  });

  it('logs batch processing errors for both immediate and delayed scheduling when dispatch fails', async () => {
    const immediateLogger = new ConsoleLogger(LogLevel.DEBUG);
    const immediateInfo = await createStorageAdapter(immediateLogger);
    activeDatabases.push(immediateInfo.dbName);

    const immediateTimer = new TestTimerService();
    const immediateEventBus = {
      dispatch: jest.fn(() => {
        throw new Error('immediate dispatch failure');
      }),
    };

    const immediateProcessor = new TraceQueueProcessor({
      storageAdapter: immediateInfo.adapter,
      logger: immediateLogger,
      eventBus: immediateEventBus,
      timerService: immediateTimer,
      config: {
        batchSize: 1,
        batchTimeout: 5,
        storageKey: 'immediate-error',
        enableParallelProcessing: false,
        maxStoredTraces: 5,
      },
    });

    const immediateErrorSpy = jest.spyOn(immediateLogger, 'error');

    try {
      expect(
        immediateProcessor.enqueue(
          { actionId: 'critical:dispatch-failure' },
          TracePriority.CRITICAL
        )
      ).toBe(true);

      await immediateTimer.triggerAll();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await waitForProcessingToDrain(immediateProcessor, immediateTimer);

      expect(immediateEventBus.dispatch).toHaveBeenCalled();
      expect(immediateErrorSpy).toHaveBeenCalled();
      expect(
        immediateErrorSpy.mock.calls.some(
          ([message]) => message === 'TraceQueueProcessor: Batch processing error'
        )
      ).toBe(true);
    } finally {
      immediateErrorSpy.mockRestore();
      await immediateProcessor.shutdown();
      immediateTimer.clearAll();
    }

    const delayedLogger = new ConsoleLogger(LogLevel.DEBUG);
    const delayedInfo = await createStorageAdapter(delayedLogger);
    activeDatabases.push(delayedInfo.dbName);

    const delayedTimer = new TestTimerService();
    const delayedEventBus = {
      dispatch: jest.fn(() => {
        throw new Error('delayed dispatch failure');
      }),
    };

    const delayedProcessor = new TraceQueueProcessor({
      storageAdapter: delayedInfo.adapter,
      logger: delayedLogger,
      eventBus: delayedEventBus,
      timerService: delayedTimer,
      config: {
        batchSize: 5,
        batchTimeout: 25,
        storageKey: 'delayed-error',
        enableParallelProcessing: false,
        maxStoredTraces: 5,
      },
    });

    const delayedErrorSpy = jest.spyOn(delayedLogger, 'error');

    try {
      expect(
        delayedProcessor.enqueue(
          { actionId: 'normal:dispatch-failure' },
          TracePriority.NORMAL
        )
      ).toBe(true);

      await delayedTimer.triggerAll();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await waitForProcessingToDrain(delayedProcessor, delayedTimer);

      expect(delayedEventBus.dispatch).toHaveBeenCalled();
      expect(delayedErrorSpy).toHaveBeenCalled();
      expect(
        delayedErrorSpy.mock.calls.some(
          ([message]) => message === 'TraceQueueProcessor: Batch processing error'
        )
      ).toBe(true);
    } finally {
      delayedErrorSpy.mockRestore();
      await delayedProcessor.shutdown();
      delayedTimer.clearAll();
    }
  });

  it('allows manual batch control, dedupes processed traces, and rotates storage when limits are exceeded', async () => {
    const manualLogger = new ConsoleLogger(LogLevel.DEBUG);
    const { adapter, dbName } = await createStorageAdapter(manualLogger);
    activeDatabases.push(dbName);

    const manualTimer = new TestTimerService();
    const manualEventBus = { dispatch: jest.fn() };

    let currentTime = 10_000;
    const dateSpy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => currentTime);

    const processor = new TraceQueueProcessor({
      storageAdapter: adapter,
      logger: manualLogger,
      eventBus: manualEventBus,
      timerService: manualTimer,
      config: {
        batchSize: 5,
        batchTimeout: 5,
        storageKey: 'manual-traces',
        enableParallelProcessing: false,
        maxStoredTraces: 1,
      },
      namingOptions: {
        strategy: NamingStrategy.TIMESTAMP_FIRST,
        timestampFormat: TimestampFormat.UNIX,
        includeHash: false,
      },
    });

    let isShutdown = false;

    try {
      await processor.processNextBatch();

      const structured = buildStructuredTrace();
      currentTime = 11_000;
      structured.captureActionData('component_filtering', 'movement:go', {
        passed: true,
        sequence: 1,
      });
      currentTime = 13_000;
      structured.captureActionData('resolution', 'movement:go', {
        outcome: 'success',
        sequence: 2,
      });

      currentTime = 15_000;
      expect(processor.enqueue(structured, TracePriority.HIGH)).toBe(true);
      await processor.processNextBatch();

      let stored = await adapter.getItem('manual-traces');
      expect(stored).toHaveLength(1);
      expect(
        stored[0].data.actions['movement:go'].stageOrder
      ).toEqual(['component_filtering', 'resolution']);
      expect(
        stored[0].data.actions['movement:go'].totalDuration
      ).toBeGreaterThanOrEqual(0);

      currentTime = 15_000;
      expect(processor.enqueue(structured, TracePriority.HIGH)).toBe(true);
      await processor.processNextBatch();

      stored = await adapter.getItem('manual-traces');
      expect(stored).toHaveLength(1);

      currentTime = 20_000;
      const fallback = { actionId: 'fallback:trace', details: { foo: 'bar' } };
      expect(processor.enqueue(fallback, TracePriority.LOW)).toBe(true);
      await processor.processNextBatch();

      stored = await adapter.getItem('manual-traces');
      expect(stored).toHaveLength(1);
      expect(stored[0].priority).toBe(TracePriority.LOW);

      const metrics = processor.getMetrics();
      expect(metrics.totalProcessed).toBe(2);
      expect(manualEventBus.dispatch).toHaveBeenCalledWith(
        QUEUE_EVENTS.BATCH_PROCESSED,
        expect.objectContaining({ batchSize: expect.any(Number) })
      );

      await processor.shutdown();
      isShutdown = true;

      await processor.processNextBatch();
    } finally {
      dateSpy.mockRestore();
      if (!isShutdown) {
        await processor.shutdown();
      }
    }
  });

  it('serializes structured traces without JSON helpers and computes stage durations', async () => {
    const structuredLogger = new ConsoleLogger(LogLevel.DEBUG);
    const { adapter, dbName } = await createStorageAdapter(structuredLogger);
    activeDatabases.push(dbName);

    const structuredTimer = new TestTimerService();
    const structuredEventBus = { dispatch: jest.fn() };

    const processor = new TraceQueueProcessor({
      storageAdapter: adapter,
      logger: structuredLogger,
      eventBus: structuredEventBus,
      timerService: structuredTimer,
      config: {
        batchSize: 2,
        batchTimeout: 5,
        storageKey: 'structured-without-json',
        enableParallelProcessing: false,
        maxStoredTraces: 5,
      },
    });

    let currentTime = 1_000;
    const dateSpy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => (currentTime += 500));

    const filter = new ActionTraceFilter({ logger: structuredLogger });
    const structuredTrace = new ActionAwareStructuredTrace({
      actionTraceFilter: filter,
      actorId: 'artisan',
      context: { project: 'forge' },
      logger: structuredLogger,
    });

    // Force formatTraceData to use structured path instead of toJSON
    structuredTrace.toJSON = undefined;

    structuredTrace.captureActionData('component_filtering', 'craft:forge', {
      passed: true,
      stage: 'start',
    });
    structuredTrace.captureActionData('resolution', 'craft:forge', {
      outcome: 'complete',
      stage: 'end',
    });

    try {
      expect(processor.enqueue(structuredTrace, TracePriority.NORMAL)).toBe(true);

      await waitForProcessingToDrain(processor, structuredTimer);

      const stored = await adapter.getItem('structured-without-json');
      expect(stored).toHaveLength(1);

      const [record] = stored;
      expect(record.data.traceType).toBe('pipeline');
      expect(record.data.actions['craft:forge'].stageOrder).toEqual([
        'component_filtering',
        'resolution',
      ]);
      expect(record.data.actions['craft:forge'].totalDuration).toBeGreaterThan(0);
    } finally {
      dateSpy.mockRestore();
      await processor.shutdown();
      structuredTimer.clearAll();
    }
  });

  it('stops scheduling retries once shutdown begins during a failure', async () => {
    const shutdownLogger = new ConsoleLogger(LogLevel.DEBUG);
    const { adapter, dbName } = await createStorageAdapter(
      shutdownLogger,
      ShutdownAwareIndexedDBAdapter
    );
    activeDatabases.push(dbName);

    const timer = new TestTimerService();
    const eventBus = { dispatch: jest.fn() };

    const processor = new TraceQueueProcessor({
      storageAdapter: adapter,
      logger: shutdownLogger,
      eventBus,
      timerService: timer,
      config: {
        batchSize: 1,
        batchTimeout: 5,
        maxRetries: 2,
        storageKey: 'shutdown-failure',
        enableParallelProcessing: false,
        maxStoredTraces: 5,
      },
    });

    adapter.beforeFailure = async () => {
      await processor.shutdown();
    };

    const trace = buildExecutionTrace();
    expect(processor.enqueue(trace, TracePriority.NORMAL)).toBe(true);

    await processor.processNextBatch();

    const metrics = processor.getMetrics();
    expect(metrics.totalProcessed).toBe(0);
    const stats = processor.getQueueStats();
    expect(stats.totalSize).toBe(0);
  });

  it('cancels scheduled retries when shutdown happens before retry execution', async () => {
    const retryLogger = new ConsoleLogger(LogLevel.DEBUG);
    const { adapter, dbName } = await createStorageAdapter(
      retryLogger,
      RetryThenSuccessAdapter
    );
    activeDatabases.push(dbName);

    const timer = new TestTimerService();
    const eventBus = { dispatch: jest.fn() };

    const processor = new TraceQueueProcessor({
      storageAdapter: adapter,
      logger: retryLogger,
      eventBus,
      timerService: timer,
      config: {
        batchSize: 1,
        batchTimeout: 5,
        maxRetries: 2,
        storageKey: 'shutdown-retry',
        enableParallelProcessing: false,
        maxStoredTraces: 5,
      },
    });

    const trace = buildExecutionTrace();
    expect(processor.enqueue(trace, TracePriority.NORMAL)).toBe(true);

    await processor.processNextBatch();
    expect(timer.hasPending()).toBe(true);

    await processor.shutdown();

    await timer.triggerAll();

    const stats = processor.getQueueStats();
    expect(stats.totalSize).toBe(0);
    expect(adapter.attempts).toBe(1);
  });

  it('handles shutdown fallback persistence when timers fail and storage read errors occur', async () => {
    const shutdownLogger = new ConsoleLogger(LogLevel.DEBUG);
    const { adapter, dbName } = await createStorageAdapter(
      shutdownLogger,
      FailingGetIndexedDBAdapter
    );
    activeDatabases.push(dbName);

    const timer = new ThrowingWaitTimerService();
    const eventBus = { dispatch: jest.fn() };

    const processor = new TraceQueueProcessor({
      storageAdapter: adapter,
      logger: shutdownLogger,
      eventBus,
      timerService: timer,
      config: {
        batchSize: 5,
        batchTimeout: 50,
        storageKey: 'shutdown-fallback',
        enableParallelProcessing: false,
        maxStoredTraces: 3,
      },
    });

    const warnSpy = jest.spyOn(shutdownLogger, 'warn');
    const debugSpy = jest.spyOn(shutdownLogger, 'debug');

    const firstTrace = { actionId: 'queued:one', payload: { value: 1 } };
    const secondTrace = { actionId: 'queued:two', payload: { value: 2 } };

    expect(processor.enqueue(firstTrace, TracePriority.NORMAL)).toBe(true);
    expect(processor.enqueue(secondTrace, TracePriority.HIGH)).toBe(true);

    adapter.failOnNextGet = true;

    await processor.shutdown();

    expect(warnSpy).toHaveBeenCalledWith(
      'TraceQueueProcessor: Error waiting for timer completion',
      expect.any(Error)
    );

    expect(debugSpy).toHaveBeenCalledWith(
      'TraceQueueProcessor: Could not read existing traces during shutdown'
    );

    const stored = await adapter.getItem('shutdown-fallback');
    expect(stored).toHaveLength(2);

    warnSpy.mockRestore();
    debugSpy.mockRestore();
  });
});
