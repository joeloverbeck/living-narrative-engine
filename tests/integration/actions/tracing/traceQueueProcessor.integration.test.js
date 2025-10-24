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

/**
 * Helper that creates a unique IndexedDB storage adapter for each test.
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
      const circularTrace = { actionId: 'normal:three' };
      circularTrace.self = circularTrace;

      warnSpy = jest.spyOn(logger, 'warn');

      expect(processor.enqueue(largeTrace, TracePriority.NORMAL)).toBe(true);
      expect(processor.enqueue(anotherLargeTrace, TracePriority.LOW)).toBe(true);
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

  it('opens the circuit breaker after repeated permanent failures and blocks new enqueues', async () => {
    const failureAdapterInfo = await createStorageAdapter(
      logger,
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
      logger,
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
    } finally {
      await breaker.shutdown();
    }
  });
});
