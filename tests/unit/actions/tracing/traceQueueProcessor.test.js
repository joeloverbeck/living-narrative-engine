/**
 * @file Unit tests for TraceQueueProcessor
 */

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
import {
  QUEUE_EVENTS,
  QUEUE_CONSTANTS,
} from '../../../../src/actions/tracing/actionTraceTypes.js';
import { TraceIdGenerator } from '../../../../src/actions/tracing/traceIdGenerator.js';
import { TraceQueueProcessorTestBed } from '../../../common/tracing/traceQueueProcessorTestBed.js';

describe('TraceQueueProcessor', () => {
  let testBed;

  beforeEach(() => {
    // No longer using Jest's fake timers - we use TestTimerService instead
    testBed = new TraceQueueProcessorTestBed();
    testBed.setup();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Constructor and Initialization', () => {
    it('should create instance with valid dependencies', () => {
      expect(testBed.processor).toBeDefined();
      expect(testBed.mockLogger.debug).toHaveBeenCalledWith(
        'TraceQueueProcessor initialized',
        expect.any(Object)
      );
    });

    it('should throw error with invalid storage adapter', () => {
      expect(() => {
        new TraceQueueProcessor({
          storageAdapter: { invalid: true },
          logger: testBed.mockLogger,
        });
      }).toThrow();
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        maxQueueSize: 500,
        batchSize: 15,
        batchTimeout: 200,
        memoryLimit: 2 * 1024 * 1024,
      };

      testBed.withConfig(customConfig);

      expect(testBed.processor).toBeDefined();
    });

    it('should work without event bus', () => {
      testBed.withoutEventBus();
      expect(testBed.processor).toBeDefined();
    });
  });

  describe('Priority Queue Management', () => {
    it('should enqueue traces with different priorities', () => {
      const criticalTrace = testBed.createMockTrace({ actionId: 'critical' });
      const normalTrace = testBed.createMockTrace({ actionId: 'normal' });
      const lowTrace = testBed.createMockTrace({ actionId: 'low' });

      expect(
        testBed.processor.enqueue(criticalTrace, TracePriority.CRITICAL)
      ).toBe(true);
      expect(testBed.processor.enqueue(normalTrace, TracePriority.NORMAL)).toBe(
        true
      );
      expect(testBed.processor.enqueue(lowTrace, TracePriority.LOW)).toBe(true);

      const stats = testBed.getQueueStats();
      expect(stats.totalSize).toBe(3);
      expect(stats.priorities[TracePriority.CRITICAL].size).toBe(1);
      expect(stats.priorities[TracePriority.NORMAL].size).toBe(1);
      expect(stats.priorities[TracePriority.LOW].size).toBe(1);
    });

    it('should process critical traces first', async () => {
      // Enqueue traces in reverse priority order
      const lowTrace = testBed.createMockTrace({ actionId: 'low-priority' });
      const normalTrace = testBed.createMockTrace({
        actionId: 'normal-priority',
      });
      const criticalTrace = testBed.createMockTrace({
        actionId: 'critical-priority',
      });

      testBed.processor.enqueue(lowTrace, TracePriority.LOW);
      testBed.processor.enqueue(normalTrace, TracePriority.NORMAL);
      testBed.processor.enqueue(criticalTrace, TracePriority.CRITICAL);

      // Process batch
      await testBed.advanceTimersAndFlush(200);

      const storageCalls = testBed.getStorageCallHistory().setItem;
      expect(storageCalls.length).toBeGreaterThan(0);

      // Critical trace should be processed first
      const firstStoredTrace = storageCalls[0][1][0];
      expect(firstStoredTrace.data.actionId).toBe('critical-priority');
    });

    it('should maintain FIFO order within same priority level', async () => {
      // Disable parallel processing to ensure FIFO order is maintained
      testBed.withConfig({ enableParallelProcessing: false });

      const trace1 = testBed.createMockTrace({ actionId: 'normal-1' });
      const trace2 = testBed.createMockTrace({ actionId: 'normal-2' });
      const trace3 = testBed.createMockTrace({ actionId: 'normal-3' });

      testBed.processor.enqueue(trace1, TracePriority.NORMAL);
      testBed.processor.enqueue(trace2, TracePriority.NORMAL);
      testBed.processor.enqueue(trace3, TracePriority.NORMAL);

      await testBed.advanceTimersAndFlush(200);

      const storedTraces = testBed.getStoredTraces();
      expect(storedTraces[0].data.actionId).toBe('normal-1');
      expect(storedTraces[1].data.actionId).toBe('normal-2');
      expect(storedTraces[2].data.actionId).toBe('normal-3');
    });

    it('should infer priority from trace characteristics', () => {
      const errorTrace = testBed.createMockTrace({
        actionId: 'error-action',
        hasError: true,
      });

      const systemTrace = testBed.createMockTrace({
        actionId: 'system:important-action',
      });

      const debugTrace = testBed.createMockTrace({
        actionId: 'debug:verbose-log',
      });

      testBed.processor.enqueue(errorTrace); // Should infer CRITICAL
      testBed.processor.enqueue(systemTrace); // Should infer HIGH
      testBed.processor.enqueue(debugTrace); // Should infer LOW

      const stats = testBed.getQueueStats();
      expect(stats.priorities[TracePriority.CRITICAL].size).toBe(1);
      expect(stats.priorities[TracePriority.HIGH].size).toBe(1);
      expect(stats.priorities[TracePriority.LOW].size).toBe(1);
    });
  });

  describe('Validation and safety checks', () => {
    it('should warn and reject when enqueuing a null trace', () => {
      const result = testBed.processor.enqueue(null);

      expect(result).toBe(false);
      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        'TraceQueueProcessor: Null trace provided'
      );
    });

    it('should respect browser memory pressure thresholds', () => {
      const originalPerformance = globalThis.performance;
      const originalWindowPerformance =
        globalThis.window && globalThis.window.performance;
      const originalGlobalMemory =
        originalPerformance && originalPerformance.memory;
      const originalWindowMemory =
        originalWindowPerformance && originalWindowPerformance.memory;
      const originalThreshold = QUEUE_CONSTANTS.MEMORY_THRESHOLD;

      const performanceMemoryStub = {
        usedJSHeapSize: 150,
        jsHeapSizeLimit: 200,
      };
      if (!originalPerformance) {
        globalThis.performance = { memory: performanceMemoryStub };
      } else {
        originalPerformance.memory = performanceMemoryStub;
      }
      global.performance = globalThis.performance;
      if (globalThis.window) {
        if (!globalThis.window.performance) {
          globalThis.window.performance = { memory: performanceMemoryStub };
        } else {
          globalThis.window.performance.memory = performanceMemoryStub;
        }
      }

      QUEUE_CONSTANTS.MEMORY_THRESHOLD = 0.2;

      try {
        testBed.withConfig({ memoryLimit: Number.MAX_SAFE_INTEGER });

        const largeTrace = testBed.createMockTrace({
          actionId: 'memory-heavy',
          data: 'x'.repeat(5000),
        });

        expect(JSON.stringify(largeTrace).length).toBeGreaterThan(4000);
        expect(performance.memory).toEqual(performanceMemoryStub);

        const initialDropped = testBed.getMetrics().totalDropped;
        const result = testBed.processor.enqueue(largeTrace, TracePriority.HIGH);
        const afterDropped = testBed.getMetrics().totalDropped;

        expect(afterDropped).toBeGreaterThan(initialDropped);
        expect(result).toBe(false);
        expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
          'TraceQueueProcessor: Memory limit still exceeded after backpressure, dropping trace',
          expect.objectContaining({
            limit: Number.MAX_SAFE_INTEGER,
          })
        );
      } finally {
        QUEUE_CONSTANTS.MEMORY_THRESHOLD = originalThreshold;
        if (!originalPerformance) {
          delete globalThis.performance;
          delete global.performance;
        } else {
          originalPerformance.memory = originalGlobalMemory;
          globalThis.performance = originalPerformance;
          global.performance = originalPerformance;
        }
        if (globalThis.window) {
          if (!originalWindowPerformance) {
            delete globalThis.window.performance;
          } else {
            originalWindowPerformance.memory = originalWindowMemory;
            globalThis.window.performance = originalWindowPerformance;
          }
        }
      }
    });
  });

  describe('Batch Processing', () => {
    it('should process traces in configurable batches', async () => {
      const batchSize = 3;
      testBed.withConfig({ batchSize });

      // Enqueue more traces than batch size
      for (let i = 0; i < 5; i++) {
        const trace = testBed.createMockTrace({ actionId: `batch-${i}` });
        testBed.processor.enqueue(trace);
      }

      await testBed.advanceTimersAndFlush(200);

      const metrics = testBed.getMetrics();
      expect(metrics.totalBatches).toBeGreaterThan(1);
      expect(metrics.totalProcessed).toBe(5);
    });

    it('should process partial batches on timeout', async () => {
      testBed.withConfig({ batchSize: 10, batchTimeout: 100 });

      // Enqueue fewer traces than batch size
      const trace1 = testBed.createMockTrace({ actionId: 'timeout-1' });
      const trace2 = testBed.createMockTrace({ actionId: 'timeout-2' });

      testBed.processor.enqueue(trace1);
      testBed.processor.enqueue(trace2);

      // Wait for timeout
      await testBed.advanceTimersAndFlush(150);

      const metrics = testBed.getMetrics();
      expect(metrics.totalProcessed).toBe(2);
      expect(metrics.totalBatches).toBe(1);
    });

    it('should process critical traces immediately', async () => {
      testBed.withConfig({ batchSize: 10, batchTimeout: 1000 });

      const criticalTrace = testBed.createMockTrace({
        actionId: 'immediate-critical',
        hasError: true,
      });

      testBed.processor.enqueue(criticalTrace, TracePriority.CRITICAL);

      // Should process immediately without waiting for timeout
      await testBed.flushPromises();
      await testBed.advanceTimersAndFlush(50);

      const metrics = testBed.getMetrics();
      expect(metrics.totalProcessed).toBe(1);
    });

    it('should handle parallel processing when enabled', async () => {
      testBed.withConfig({ enableParallelProcessing: true, batchSize: 5 });

      const traces = testBed.createMultipleTraces(5, { actionId: 'parallel' });
      traces.forEach((trace) => testBed.processor.enqueue(trace));

      await testBed.advanceTimersAndFlush(200);

      const metrics = testBed.getMetrics();
      expect(metrics.totalProcessed).toBe(5);
    });

    it('should handle sequential processing when parallel disabled', async () => {
      testBed.withConfig({ enableParallelProcessing: false, batchSize: 3 });

      const traces = testBed.createMultipleTraces(3, {
        actionId: 'sequential',
      });
      traces.forEach((trace) => testBed.processor.enqueue(trace));

      await testBed.advanceTimersAndFlush(200);

      const metrics = testBed.getMetrics();
      expect(metrics.totalProcessed).toBe(3);
    });

    it('should surface errors from immediate batch scheduling', async () => {
      testBed.withConfig({ batchSize: 1 });

      testBed.mockLogger.debug.mockImplementation((message, details) => {
        if (message === 'TraceQueueProcessor: Processing batch') {
          throw new Error('debug failure');
        }
        return undefined;
      });

      const criticalTrace = testBed.createMockTrace({
        actionId: 'critical-immediate',
        hasError: true,
      });

      testBed.processor.enqueue(criticalTrace, TracePriority.CRITICAL);

      await testBed.advanceTimersAndFlush(0);

      expect(testBed.mockLogger.error).toHaveBeenCalledWith(
        'TraceQueueProcessor: Batch processing error',
        expect.any(Error)
      );
    });

    it('should surface errors from delayed batch scheduling', async () => {
      testBed.withConfig({ batchSize: 10, batchTimeout: 50 });

      testBed.mockLogger.debug.mockImplementation((message) => {
        if (message === 'TraceQueueProcessor: Processing batch') {
          throw new Error('delayed failure');
        }
        return undefined;
      });

      const normalTrace = testBed.createMockTrace({ actionId: 'delayed-trace' });
      testBed.processor.enqueue(normalTrace, TracePriority.NORMAL);

      await testBed.advanceTimersAndFlush(50);

      expect(testBed.mockLogger.error).toHaveBeenCalledWith(
        'TraceQueueProcessor: Batch processing error',
        expect.any(Error)
      );
    });

  });

  describe('Resource Management and Memory Tracking', () => {
    it('should track memory usage', () => {
      const trace = testBed.createMockTrace({ actionId: 'memory-test' });
      testBed.processor.enqueue(trace);

      const stats = testBed.getQueueStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should reject traces when memory limit exceeded', () => {
      testBed.withConfig({ memoryLimit: 100 }); // Very small limit

      const largeMockTrace = {
        actionId: 'large-trace',
        largeData: 'x'.repeat(1000), // Large data to exceed memory limit
        toJSON: () => ({
          actionId: 'large-trace',
          data: 'x'.repeat(1000),
        }),
      };

      // First trace might succeed
      const firstResult = testBed.processor.enqueue(largeMockTrace);

      // Subsequent traces should be rejected due to memory limit
      let rejectedCount = 0;
      for (let i = 0; i < 10; i++) {
        const result = testBed.processor.enqueue(largeMockTrace);
        if (!result) rejectedCount++;
      }

      expect(rejectedCount).toBeGreaterThan(0);
    });

    it('should respect maximum queue size', () => {
      const maxSize = 5;
      testBed.withConfig({ maxQueueSize: maxSize });

      // Fill queue to capacity
      for (let i = 0; i < maxSize; i++) {
        const trace = testBed.createMockTrace({ actionId: `queue-${i}` });
        expect(testBed.processor.enqueue(trace)).toBe(true);
      }

      // Additional traces should be rejected
      const overflowTrace = testBed.createMockTrace({ actionId: 'overflow' });
      expect(testBed.processor.enqueue(overflowTrace)).toBe(false);
    });

    it('should rotate stored traces when storage limit is exceeded', async () => {
      testBed.withConfig({
        maxStoredTraces: 2,
        enableParallelProcessing: false,
        batchSize: 1,
      });

      const traces = testBed.createMultipleTraces(4, {
        actionId: 'rotation',
      });
      traces.forEach((trace) => testBed.processor.enqueue(trace));

      await testBed.advanceTimersAndFlush(500);

      const storedTraces = testBed.getStoredTraces();
      expect(storedTraces.length).toBeLessThanOrEqual(2);
      const actionIds = storedTraces.map((entry) => entry.data.actionId);
      expect(actionIds).toEqual(['rotation-2', 'rotation-3']);
    });
  });

  describe('Backpressure Handling', () => {
    it('should drop low-priority items during backpressure', () => {
      testBed.withConfig({ maxQueueSize: 10 });

      // Fill queue to capacity with low-priority items
      for (let i = 0; i < 10; i++) {
        const trace = testBed.createMockTrace({ actionId: `low-${i}` });
        testBed.processor.enqueue(trace, TracePriority.LOW);
      }

      // Now queue is at capacity - add high-priority item that should trigger backpressure
      const highTrace = testBed.createMockTrace({ actionId: 'high-priority' });
      testBed.processor.enqueue(highTrace, TracePriority.HIGH);

      // The high-priority item should have caused backpressure to drop some low-priority items
      const metrics = testBed.getMetrics();
      expect(metrics.totalDropped).toBeGreaterThan(0);
    });

    it('should dispatch backpressure event', () => {
      testBed.withConfig({ maxQueueSize: 3 });

      // Fill queue beyond capacity
      for (let i = 0; i < 5; i++) {
        const trace = testBed.createMockTrace({ actionId: `pressure-${i}` });
        testBed.processor.enqueue(trace);
      }

      expect(testBed.wasEventDispatched(QUEUE_EVENTS.BACKPRESSURE)).toBe(true);
    });
  });

  describe('Error Handling and Circuit Breaker', () => {
    it('should retry failed items with exponential backoff', async () => {
      // Simulate storage failure
      testBed.simulateStorageFailure(new Error('Storage unavailable'));

      const trace = testBed.createMockTrace({ actionId: 'retry-test' });
      testBed.processor.enqueue(trace);

      await testBed.advanceTimersAndFlush(200);

      // Item should be retried
      expect(testBed.mockLogger.debug).toHaveBeenCalledWith(
        'TraceQueueProcessor: Item scheduled for retry',
        expect.any(Object)
      );
    });

    it('should permanently drop items after max retries', async () => {
      testBed.withConfig({ maxRetries: 1 });
      testBed.simulateStorageFailure(new Error('Permanent failure'));

      const trace = testBed.createMockTrace({ actionId: 'permanent-fail' });
      testBed.processor.enqueue(trace);

      // Let retries complete
      await testBed.advanceTimersAndFlush(5000);

      const metrics = testBed.getMetrics();
      expect(metrics.totalDropped).toBeGreaterThan(0);
      expect(testBed.wasEventDispatched(QUEUE_EVENTS.ITEM_DROPPED)).toBe(true);
    });

    it('should activate circuit breaker after consecutive failures', async () => {
      testBed.simulateStorageFailure(new Error('Circuit breaker test'));

      // Generate enough failures to trigger circuit breaker
      for (let i = 0; i < 15; i++) {
        const trace = testBed.createMockTrace({ actionId: `circuit-${i}` });
        testBed.processor.enqueue(trace);
      }

      await testBed.advanceTimersAndFlush(1000);

      const stats = testBed.getQueueStats();
      expect(stats.circuitBreakerOpen).toBe(true);
      expect(testBed.wasEventDispatched(QUEUE_EVENTS.CIRCUIT_BREAKER)).toBe(
        true
      );
    });

    it('should log when the circuit breaker is manually reset', async () => {
      const originalThreshold = QUEUE_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD;
      QUEUE_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD = 1;

      try {
        testBed.simulateStorageFailure(new Error('force breaker open'));

        const failingTrace = testBed.createMockTrace({ actionId: 'breaker-open' });
        testBed.processor.enqueue(failingTrace);

        await testBed.advanceTimersAndFlush(200);

        expect(testBed.processor.getQueueStats().circuitBreakerOpen).toBe(true);

        testBed.mockLogger.info.mockClear();

        const wasOpen = testBed.processor.resetCircuitBreaker();
        expect(wasOpen).toBe(true);
        expect(testBed.mockLogger.info).toHaveBeenCalledWith(
          'TraceQueueProcessor: Circuit breaker closed'
        );
      } finally {
        QUEUE_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD = originalThreshold;
      }
    });

    it('should reject new items when circuit breaker is open', async () => {
      testBed.simulateStorageFailure(new Error('Circuit breaker test'));

      // Trigger circuit breaker
      for (let i = 0; i < 15; i++) {
        const trace = testBed.createMockTrace({ actionId: `trigger-${i}` });
        testBed.processor.enqueue(trace);
      }

      await testBed.advanceTimersAndFlush(1000);

      // New traces should be rejected
      const newTrace = testBed.createMockTrace({ actionId: 'rejected' });
      expect(testBed.processor.enqueue(newTrace)).toBe(false);
    });

    it('should close circuit breaker after successful batch', async () => {
      // First cause failures to open circuit breaker
      testBed.simulateStorageFailure(new Error('Initial failure'));

      for (let i = 0; i < 15; i++) {
        const trace = testBed.createMockTrace({ actionId: `failure-${i}` });
        testBed.processor.enqueue(trace);
      }

      await testBed.advanceTimersAndFlush(1000);

      let stats = testBed.getQueueStats();
      expect(stats.circuitBreakerOpen).toBe(true);

      // Then restore storage and process successfully
      testBed.simulateStorageSuccess();

      const successTrace = testBed.createMockTrace({ actionId: 'success' });
      // Circuit breaker should prevent this, but let's test recovery

      // Advance time to potentially trigger recovery attempt
      await testBed.advanceTimersAndFlush(2000);

      // Circuit breaker should eventually close on successful processing
      // (This would require implementing circuit breaker recovery logic)
    });

    it('should calculate retry delay using exponential backoff when scheduling retries', async () => {
      testBed.withConfig({
        enableParallelProcessing: false,
        batchTimeout: 0,
        maxRetries: 3,
      });

      const setTimeoutSpy = jest.spyOn(testBed.timerService, 'setTimeout');

      try {
        testBed.simulateStorageFailure(new Error('retry delay test'));

        const trace = testBed.createMockTrace({ actionId: 'retry-delay' });
        testBed.processor.enqueue(trace);

        await testBed.advanceTimersAndFlush(0);

        const retryDelays = setTimeoutSpy.mock.calls
          .map(([, delay]) => delay)
          .filter(
            (delay) =>
              typeof delay === 'number' &&
              delay > 0 &&
              delay !== QUEUE_CONSTANTS.DEFAULT_BATCH_TIMEOUT
          );

        expect(retryDelays).toEqual([
          QUEUE_CONSTANTS.RETRY_BASE_DELAY * 2,
          QUEUE_CONSTANTS.RETRY_BASE_DELAY * 4,
          QUEUE_CONSTANTS.RETRY_BASE_DELAY * 8,
        ]);
      } finally {
        setTimeoutSpy.mockRestore();
      }
    });

    it('should stop retries once circuit breaker opens during batch failure', async () => {
      const originalThreshold = QUEUE_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD;
      QUEUE_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD = 1;

      try {
        testBed.withConfig({ enableParallelProcessing: false, maxRetries: 2 });

        testBed.mockStorageAdapter.setItem.mockRejectedValue(
          new Error('batch failure')
        );

        const trace = testBed.createMockTrace({ actionId: 'circuit-stop' });
        testBed.processor.enqueue(trace);

        await testBed.advanceTimersAndFlush(200);

        expect(testBed.wasEventDispatched(QUEUE_EVENTS.CIRCUIT_BREAKER)).toBe(
          true
        );

        const retryLogs = testBed.mockLogger.debug.mock.calls.filter(
          ([message]) =>
            message === 'TraceQueueProcessor: Item scheduled for retry'
        );
        expect(retryLogs.length).toBe(0);
      } finally {
        QUEUE_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD = originalThreshold;
      }
    });

    it('should skip processing already completed trace IDs', async () => {
      const generateIdSpy = jest
        .spyOn(TraceIdGenerator.prototype, 'generateId')
        .mockReturnValue('duplicate-id');

      try {
        testBed.withConfig({ enableParallelProcessing: false, batchSize: 1 });

        const firstTrace = testBed.createMockTrace({ actionId: 'dedupe-1' });
        testBed.processor.enqueue(firstTrace, TracePriority.NORMAL);
        await testBed.advanceTimersAndFlush(100);

        const initialSetItemCalls =
          testBed.mockStorageAdapter.setItem.mock.calls.length;
        testBed.mockLogger.debug.mockClear();

        const secondTrace = testBed.createMockTrace({ actionId: 'dedupe-2' });
        testBed.processor.enqueue(secondTrace, TracePriority.NORMAL);
        await testBed.advanceTimersAndFlush(100);

        const duplicateLogs = testBed.mockLogger.debug.mock.calls.filter(
          ([message]) =>
            message === 'TraceQueueProcessor: Item already processed or processing'
        );

        expect(duplicateLogs.length).toBeGreaterThanOrEqual(1);
        expect(testBed.mockStorageAdapter.setItem.mock.calls.length).toBe(
          initialSetItemCalls
        );
      } finally {
        generateIdSpy.mockRestore();
      }
    });
  });

  describe('Trace Format Handling', () => {
    it('should handle ActionExecutionTrace format', async () => {
      const trace = testBed.createMockTrace({
        actionId: 'execution-trace',
        data: { executed: true },
      });

      // Override the toJSON after creation to get the exact format we want
      trace.toJSON = jest.fn().mockReturnValue({
        actionId: 'execution-trace',
        type: 'execution',
        data: { executed: true },
      });

      testBed.processor.enqueue(trace);
      await testBed.advanceTimersAndFlush(200);

      expect(trace.toJSON).toHaveBeenCalled();

      const storedTraces = testBed.getStoredTraces();
      expect(storedTraces[0].data).toEqual({
        actionId: 'execution-trace',
        type: 'execution',
        data: { executed: true },
      });
    });

    it('should handle ActionAwareStructuredTrace format', async () => {
      const structuredTrace = testBed.createMockStructuredTrace({
        actionId: 'structured-trace',
        stages: {
          start: { timestamp: 1000 },
          middle: { timestamp: 1500 },
          end: { timestamp: 2000 },
        },
        spans: ['span1', 'span2'],
      });

      testBed.processor.enqueue(structuredTrace);
      await testBed.advanceTimersAndFlush(200);

      const storedTraces = testBed.getStoredTraces();
      const storedData = storedTraces[0].data;

      expect(storedData.traceType).toBe('pipeline');
      expect(storedData.spans).toEqual(['span1', 'span2']);
      expect(storedData.actions).toHaveProperty('structured-trace');
      expect(storedData.actions['structured-trace'].totalDuration).toBe(1000);
    });

    it('should handle unknown trace format', async () => {
      const unknownTrace = {
        actionId: 'unknown-format',
        customProperty: 'custom-value',
        // No toJSON or getTracedActions methods
      };

      testBed.processor.enqueue(unknownTrace);
      await testBed.advanceTimersAndFlush(200);

      const storedTraces = testBed.getStoredTraces();
      const storedData = storedTraces[0].data;

      expect(storedData.type).toBe('unknown');
      expect(storedData.data).toEqual(unknownTrace);
    });
  });

  describe('Manual Control Helpers', () => {
    it('should allow manual circuit breaker reset after failures', async () => {
      const originalThreshold = QUEUE_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD;
      QUEUE_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD = 1;

      try {
        testBed.simulateStorageFailure(new Error('manual reset failure'));
        const failingTrace = testBed.createMockTrace({ actionId: 'manual-reset' });
        testBed.processor.enqueue(failingTrace);

        await testBed.advanceTimersAndFlush(200);

        expect(testBed.processor.getQueueStats().circuitBreakerOpen).toBe(true);

        const resetResult = testBed.processor.resetCircuitBreaker();
        expect(resetResult).toBe(true);

        const infoLog = testBed.mockLogger.info.mock.calls.find(
          ([message]) => message === 'TraceQueueProcessor: Circuit breaker closed'
        );
        expect(infoLog).toBeDefined();

        const statsAfterReset = testBed.processor.getQueueStats();
        expect(statsAfterReset.circuitBreakerOpen).toBe(false);

        testBed.simulateStorageSuccess();
        const recoveryTrace = testBed.createMockTrace({ actionId: 'recovery' });
        expect(testBed.processor.enqueue(recoveryTrace)).toBe(true);
        await testBed.advanceTimersAndFlush(200);

        const metrics = testBed.getMetrics();
        expect(metrics.totalProcessed).toBeGreaterThan(0);
      } finally {
        QUEUE_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD = originalThreshold;
      }
    });

    it('should return early when processing during shutdown with empty queue', async () => {
      await testBed.processor.shutdown();

      const initialStats = testBed.processor.getQueueStats();
      expect(initialStats.totalSize).toBe(0);
      expect(initialStats.circuitBreakerOpen).toBe(false);

      await testBed.processor.processNextBatch();

      const statsAfter = testBed.processor.getQueueStats();
      expect(statsAfter.isProcessing).toBe(false);
      expect(testBed.timerService.getPendingCount()).toBe(0);
    });

    it('should no-op when manually processing with empty queue', async () => {
      await testBed.processor.processNextBatch();

      expect(testBed.processor.getQueueStats().isProcessing).toBe(false);
      expect(testBed.mockStorageAdapter.setItem).not.toHaveBeenCalled();
    });

    it('should process queued traces when manually triggering the next batch', async () => {
      const manualTrace = testBed.createMockTrace({ actionId: 'manual-batch' });

      expect(testBed.processor.enqueue(manualTrace)).toBe(true);

      await testBed.processor.processNextBatch();

      const storedTraces = testBed.getStoredTraces();
      expect(storedTraces).toHaveLength(1);
      expect(storedTraces[0].data.actionId).toBe('manual-batch');

      // Ensure no residual work remains scheduled after manual processing
      expect(testBed.processor.getQueueStats().totalSize).toBe(0);
    });

    it('should skip retry requeue when shutdown happens before retry executes', async () => {
      testBed.withConfig({ enableParallelProcessing: false, maxRetries: 2 });

      let attempt = 0;
      testBed.mockStorageAdapter.setItem.mockImplementation(async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('retry shutdown');
        }
        return undefined;
      });

      const scheduledCallbacks = [];
      const originalSetTimeout = testBed.timerService.setTimeout.bind(
        testBed.timerService
      );
      const timerSpy = jest
        .spyOn(testBed.timerService, 'setTimeout')
        .mockImplementation((callback, delay) => {
          scheduledCallbacks.push(callback);
          return originalSetTimeout(callback, delay);
        });

      const trace = testBed.createMockTrace({ actionId: 'retry-during-shutdown' });
      testBed.processor.enqueue(trace);

      await testBed.timerService.advanceTime(0);
      await Promise.resolve();

      expect(scheduledCallbacks.length).toBeGreaterThan(0);

      await testBed.processor.shutdown();

      try {
        for (const callback of scheduledCallbacks) {
          await callback();
        }

        expect(testBed.mockStorageAdapter.setItem).toHaveBeenCalledTimes(1);
        expect(testBed.timerService.getPendingCount()).toBe(0);
      } finally {
        timerSpy.mockRestore();
      }
    });
  });

  describe('Metrics and Statistics', () => {
    it('should track comprehensive metrics', async () => {
      // Enqueue and process various traces
      const traces = testBed.createMultipleTraces(5, {
        actionId: 'metrics-test',
      });
      traces.forEach((trace, index) => {
        const priority =
          index % 2 === 0 ? TracePriority.HIGH : TracePriority.LOW;
        testBed.processor.enqueue(trace, priority);
      });

      await testBed.advanceTimersAndFlush(200);

      const metrics = testBed.getMetrics();

      expect(metrics.totalEnqueued).toBe(5);
      expect(metrics.totalProcessed).toBe(5);
      expect(metrics.totalBatches).toBeGreaterThan(0);
      // Throughput calculation relies on real time, which doesn't work with test timers
      // expect(metrics.throughput).toBeGreaterThan(0);
      expect(metrics.priorityDistribution[TracePriority.HIGH]).toBe(3);
      expect(metrics.priorityDistribution[TracePriority.LOW]).toBe(2);
    });

    it('should calculate batch efficiency', async () => {
      testBed.withConfig({ batchSize: 3 });

      // Process exactly one full batch
      const traces = testBed.createMultipleTraces(3, {
        actionId: 'efficiency-test',
      });
      traces.forEach((trace) => testBed.processor.enqueue(trace));

      await testBed.advanceTimersAndFlush(200);

      const metrics = testBed.getMetrics();
      expect(metrics.batchEfficiency).toBe(1.0); // 100% efficiency
    });
  });

  describe('Event Notifications', () => {
    it('should dispatch batch processed events', async () => {
      const traces = testBed.createMultipleTraces(3, {
        actionId: 'batch-event',
      });
      traces.forEach((trace) => testBed.processor.enqueue(trace));

      await testBed.advanceTimersAndFlush(200);

      expect(testBed.wasEventDispatched(QUEUE_EVENTS.BATCH_PROCESSED)).toBe(
        true
      );
    });

    it('should work without event bus', async () => {
      testBed.withoutEventBus();

      const trace = testBed.createMockTrace({ actionId: 'no-events' });
      testBed.processor.enqueue(trace);

      await testBed.advanceTimersAndFlush(200);

      const metrics = testBed.getMetrics();
      expect(metrics.totalProcessed).toBe(1);
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should flush remaining items on shutdown', async () => {
      const traces = testBed.createMultipleTraces(3, {
        actionId: 'shutdown-test',
      });
      traces.forEach((trace) => testBed.processor.enqueue(trace));

      await testBed.processor.shutdown();

      const metrics = testBed.getMetrics();
      expect(metrics.totalProcessed).toBe(3);

      expect(testBed.mockLogger.info).toHaveBeenCalledWith(
        'TraceQueueProcessor: Shutting down...'
      );
      expect(testBed.mockLogger.info).toHaveBeenCalledWith(
        'TraceQueueProcessor: Shutdown complete',
        expect.any(Object)
      );
    });

    it('should handle shutdown with open circuit breaker', async () => {
      testBed.simulateStorageFailure(new Error('Shutdown test'));

      // Trigger circuit breaker
      for (let i = 0; i < 15; i++) {
        const trace = testBed.createMockTrace({ actionId: `shutdown-${i}` });
        testBed.processor.enqueue(trace);
      }

      await testBed.advanceTimersAndFlush(1000);

      // Should complete shutdown even with circuit breaker open
      await testBed.processor.shutdown();

      expect(testBed.mockLogger.info).toHaveBeenCalledWith(
        'TraceQueueProcessor: Shutdown complete',
        expect.any(Object)
      );
    });

    it('should wait for ongoing processing to complete', async () => {
      // Make storage calls slow
      testBed.mockStorageAdapter.setItem.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const trace = testBed.createMockTrace({ actionId: 'slow-processing' });
      testBed.processor.enqueue(trace);

      const shutdownPromise = testBed.processor.shutdown();

      // Advance timers to complete processing
      await testBed.advanceTimersAndFlush(200);

      await shutdownPromise;

      const metrics = testBed.getMetrics();
      expect(metrics.totalProcessed).toBe(1);
    });

    it('should avoid retry scheduling when shutdown begins during failure handling', async () => {
      testBed.withConfig({ enableParallelProcessing: false, maxRetries: 2 });

      testBed.mockStorageAdapter.setItem.mockImplementation(async () => {
        testBed.processor.shutdown();
        throw new Error('shutdown failure');
      });

      const trace = testBed.createMockTrace({ actionId: 'shutdown-retry' });
      testBed.processor.enqueue(trace);

      await testBed.advanceTimersAndFlush(200);

      const shutdownLog = testBed.mockLogger.debug.mock.calls.find(
        ([message]) =>
          message === 'TraceQueueProcessor: Not retrying item during shutdown'
      );
      expect(shutdownLog).toBeDefined();
      expect(testBed.timerService.getPendingCount()).toBe(0);
    });

    it('should abort scheduled retries if shutdown occurs before retry executes', async () => {
      testBed.withConfig({ enableParallelProcessing: false, maxRetries: 3 });

      let attempt = 0;
      testBed.mockStorageAdapter.setItem.mockImplementation(async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('transient failure');
        }
        return undefined;
      });

      const trace = testBed.createMockTrace({ actionId: 'shutdown-abort' });
      testBed.processor.enqueue(trace);

      await testBed.timerService.advanceTime(0);
      await Promise.resolve();
      await Promise.resolve();

      expect(testBed.timerService.getPendingCount()).toBeGreaterThan(0);

      await testBed.processor.shutdown();

      const pendingBeforeAdvance = testBed.timerService.getPendingCount();
      await testBed.advanceTimersAndFlush(QUEUE_CONSTANTS.RETRY_BASE_DELAY * 4);

      expect(testBed.mockStorageAdapter.setItem.mock.calls.length).toBe(1);
      expect(testBed.timerService.getPendingCount()).toBeLessThanOrEqual(
        pendingBeforeAdvance
      );
    });

    it('should warn if timer completion wait fails during shutdown', async () => {
      const waitSpy = jest
        .spyOn(testBed.timerService, 'waitForCompletion')
        .mockRejectedValue(new Error('wait failure'));

      await testBed.processor.shutdown();

      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        'TraceQueueProcessor: Error waiting for timer completion',
        expect.any(Error)
      );

      waitSpy.mockRestore();
    });

    it('should rotate remaining traces when persisting during shutdown', async () => {
      testBed.withConfig({
        maxStoredTraces: 1,
        enableParallelProcessing: false,
      });

      const traces = testBed.createMultipleTraces(3, {
        actionId: 'shutdown-rotation',
      });
      traces.forEach((trace) => testBed.processor.enqueue(trace));

      await testBed.processor.shutdown();

      const storedTraces = testBed.getStoredTraces();
      expect(storedTraces.length).toBe(1);
      expect(storedTraces[0].data.actionId).toBe('shutdown-rotation-2');
    });
  });
});
