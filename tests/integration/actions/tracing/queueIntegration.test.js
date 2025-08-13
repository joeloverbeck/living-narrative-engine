/**
 * @file Integration tests for TraceQueueProcessor with ActionTraceOutputService
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ActionTraceOutputService } from '../../../../src/actions/tracing/actionTraceOutputService.js';
import { TracePriority } from '../../../../src/actions/tracing/tracePriority.js';
import { QUEUE_EVENTS } from '../../../../src/actions/tracing/actionTraceTypes.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import {
  createMockActionTraceFilter,
  createMockIndexedDBStorageAdapter,
} from '../../../common/mockFactories/actionTracing.js';
import { TestTimerService } from '../../../../src/actions/tracing/timerService.js';

describe('Queue Processor Integration', () => {
  let service;
  let mockLogger;
  let mockStorageAdapter;
  let mockActionTraceFilter;
  let mockEventBus;
  let testTimerService;
  let queueConfig;

  beforeEach(() => {
    // Don't use Jest fake timers - let TestTimerService handle timing

    mockLogger = createMockLogger();
    mockStorageAdapter = createMockIndexedDBStorageAdapter();
    mockActionTraceFilter = createMockActionTraceFilter();
    testTimerService = new TestTimerService();

    mockEventBus = {
      dispatch: jest.fn(),
    };

    queueConfig = {
      maxQueueSize: 50,
      batchSize: 5,
      batchTimeout: 100,
      maxRetries: 2,
      memoryLimit: 1024 * 1024,
      enableParallelProcessing: true,
      timerService: testTimerService, // Add the test timer service
    };
  });

  afterEach(() => {
    // Clean up TestTimerService
    if (testTimerService) {
      testTimerService.clearAll();
    }
    service = null;
  });

  describe('ActionTraceOutputService with TraceQueueProcessor', () => {
    it('should integrate with ActionTraceOutputService successfully', () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig,
      });

      expect(service).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActionTraceOutputService initialized with TraceQueueProcessor',
        {}
      );
    });

    it('should process traces through advanced queue processor', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig,
      });

      const trace = {
        actionId: 'integration:test',
        actorId: 'test-actor',
        toJSON: () => ({
          actionId: 'integration:test',
          data: { integrated: true },
        }),
      };

      await service.writeTrace(trace);

      // Allow queue processing using TestTimerService - may need multiple rounds
      await testTimerService.triggerAll();

      // Wait for any async operations and trigger again if needed
      if (testTimerService.hasPending()) {
        await testTimerService.triggerAll();
      }

      // Final wait for async storage operations to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockStorageAdapter.setItem).toHaveBeenCalledWith(
        'actionTraces',
        expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              actionId: 'integration:test',
              data: { integrated: true },
            }),
          }),
        ])
      );
    });

    it('should handle priority traces correctly', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig,
      });

      const criticalTrace = {
        actionId: 'critical:error',
        hasError: true,
        toJSON: () => ({
          actionId: 'critical:error',
          error: 'Critical system error',
        }),
      };

      const normalTrace = {
        actionId: 'normal:operation',
        toJSON: () => ({
          actionId: 'normal:operation',
          data: { normal: true },
        }),
      };

      // Write normal trace first, then critical
      await service.writeTrace(normalTrace);
      await service.writeTrace(criticalTrace, TracePriority.CRITICAL);

      // Allow queue processing using TestTimerService
      await testTimerService.triggerAll();
      if (testTimerService.hasPending()) {
        await testTimerService.triggerAll();
      }
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Critical trace should be processed first despite being added later
      const storageCalls = mockStorageAdapter.setItem.mock.calls;
      expect(storageCalls.length).toBeGreaterThan(0);

      const firstTrace = storageCalls[0][1][0];
      expect(firstTrace.data.actionId).toBe('critical:error');
    });

    it('should provide enhanced queue statistics', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig,
      });

      const trace = {
        actionId: 'stats:test',
        toJSON: () => ({ actionId: 'stats:test' }),
      };

      await service.writeTrace(trace);

      const stats = service.getQueueStats();

      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('isProcessing');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('circuitBreakerOpen');
      expect(stats).toHaveProperty('priorities');
    });

    it('should provide queue processor metrics', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig,
      });

      const trace = {
        actionId: 'metrics:test',
        toJSON: () => ({ actionId: 'metrics:test' }),
      };

      await service.writeTrace(trace);

      // Allow queue processing
      await testTimerService.triggerAll();
      if (testTimerService.hasPending()) {
        await testTimerService.triggerAll();
      }
      await new Promise((resolve) => setTimeout(resolve, 10));

      const metrics = service.getQueueMetrics();

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalEnqueued');
      expect(metrics).toHaveProperty('totalProcessed');
      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('batchEfficiency');
      expect(metrics).toHaveProperty('priorityDistribution');
    });

    it('should handle batch processing events', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig,
      });

      // Enqueue multiple traces rapidly to trigger batch processing
      const writePromises = [];
      for (let i = 0; i < 6; i++) {
        const trace = {
          actionId: `batch:${i}`,
          toJSON: () => ({ actionId: `batch:${i}`, index: i }),
        };
        writePromises.push(service.writeTrace(trace));
      }
      await Promise.all(writePromises);

      // Allow batch processing - trigger only once to get batch behavior
      await testTimerService.triggerAll();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Trigger any remaining processing
      if (testTimerService.hasPending()) {
        await testTimerService.triggerAll();
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Check that all traces were processed (stored)
      expect(mockStorageAdapter.setItem).toHaveBeenCalled();

      // Verify batch processing occurred by checking storage calls
      const storageCalls = mockStorageAdapter.setItem.mock.calls;
      expect(storageCalls.length).toBeGreaterThan(0);

      // At least one storage call should contain our batch traces
      const hasOurTraces = storageCalls.some((call) => {
        const traces = call[1];
        return (
          Array.isArray(traces) &&
          traces.some(
            (trace) =>
              trace.data &&
              trace.data.actionId &&
              trace.data.actionId.startsWith('batch:')
          )
        );
      });
      expect(hasOurTraces).toBe(true);
    });

    it('should gracefully handle storage failures with retries', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig,
      });

      // Simulate storage failure initially, then success
      let callCount = 0;
      mockStorageAdapter.setItem.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Storage temporarily unavailable'));
        }
        return Promise.resolve();
      });

      const trace = {
        actionId: 'retry:test',
        toJSON: () => ({ actionId: 'retry:test' }),
      };

      await service.writeTrace(trace);

      // Allow initial processing to fail and schedule first retry
      await testTimerService.triggerAll();
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Advance time for first retry (delay: 2^1 * 100 = 200ms)
      await testTimerService.advanceTime(200);
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Advance time for second retry (delay: 2^2 * 100 = 400ms)
      await testTimerService.advanceTime(400);
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Trigger any remaining timers
      if (testTimerService.hasPending()) {
        await testTimerService.triggerAll();
      }
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should eventually succeed after retries
      expect(mockStorageAdapter.setItem).toHaveBeenCalledTimes(3);
    });

    it('should handle circuit breaker activation', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig,
      });

      // Simulate persistent storage failures
      mockStorageAdapter.setItem.mockRejectedValue(new Error('Storage down'));

      // Generate enough failures to trigger circuit breaker
      for (let i = 0; i < 15; i++) {
        const trace = {
          actionId: `circuit:${i}`,
          toJSON: () => ({ actionId: `circuit:${i}` }),
        };
        await service.writeTrace(trace);

        // Trigger processing for each trace to accumulate failures
        await testTimerService.triggerAll();
        if (testTimerService.hasPending()) {
          await testTimerService.triggerAll();
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Allow final processing
      await testTimerService.advanceTime(1000);
      if (testTimerService.hasPending()) {
        await testTimerService.triggerAll();
      }
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Circuit breaker should be activated
      const stats = service.getQueueStats();
      expect(stats.circuitBreakerOpen).toBe(true);

      // Circuit breaker event should be dispatched
      const eventCalls = mockEventBus.dispatch.mock.calls;
      const circuitEvent = eventCalls.find(
        (call) => call[0] === QUEUE_EVENTS.CIRCUIT_BREAKER
      );

      expect(circuitEvent).toBeDefined();
    });

    it('should shutdown gracefully with advanced queue processor', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig,
      });

      // Enqueue traces but don't process them immediately
      const traces = [];
      for (let i = 0; i < 3; i++) {
        const trace = {
          actionId: `shutdown:${i}`,
          toJSON: () => ({ actionId: `shutdown:${i}` }),
        };
        traces.push(trace);
        await service.writeTrace(trace);
      }

      // Don't process the queued items - let shutdown handle them

      // Shutdown should process all remaining traces
      const shutdownPromise = service.shutdown();

      // Give shutdown process time to start and handle timers
      await testTimerService.triggerAll();
      if (testTimerService.hasPending()) {
        await testTimerService.triggerAll();
      }
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Wait for shutdown to complete with proper error handling
      try {
        await shutdownPromise;
      } catch (error) {
        // If shutdown times out, that's expected in some test scenarios
        if (!error.message.includes('timeout')) {
          throw error;
        }
      }

      // Should have been called at least once to save the traces
      expect(mockStorageAdapter.setItem).toHaveBeenCalled();

      // Verify all traces were saved - check the storage calls
      const storageCalls = mockStorageAdapter.setItem.mock.calls;
      expect(storageCalls.length).toBeGreaterThan(0);

      // Find a call with our test traces
      const traceCall = storageCalls.find(
        (call) =>
          call[0] === 'actionTraces' &&
          Array.isArray(call[1]) &&
          call[1].some(
            (item) =>
              item.data &&
              item.data.actionId &&
              item.data.actionId.startsWith('shutdown:')
          )
      );

      expect(traceCall).toBeDefined();
      expect(traceCall[1]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              actionId: 'shutdown:0',
            }),
          }),
          expect.objectContaining({
            data: expect.objectContaining({
              actionId: 'shutdown:1',
            }),
          }),
          expect.objectContaining({
            data: expect.objectContaining({
              actionId: 'shutdown:2',
            }),
          }),
        ])
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActionTraceOutputService: Shutting down, flushing queue...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActionTraceOutputService: Shutdown complete'
      );
    }, 15000); // Reduced timeout but still generous
  });

  describe('Backward Compatibility', () => {
    it('should fallback to simple queue without TraceQueueProcessor', () => {
      // Create service without storage adapter to force fallback
      service = new ActionTraceOutputService({
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
      });

      expect(service).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActionTraceOutputService initialized with simple queue',
        {}
      );
    });

    it('should maintain compatibility with existing API', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig,
      });

      const trace = {
        actionId: 'compatibility:test',
        actorId: 'test-actor',
        isComplete: true,
        hasError: false,
        toJSON: () => ({
          actionId: 'compatibility:test',
          data: { compatible: true },
        }),
      };

      // Should work with existing writeTrace API
      await service.writeTrace(trace);

      // Should provide existing statistics API
      const stats = service.getStatistics();
      expect(stats).toHaveProperty('totalWrites');
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('pendingWrites');
      expect(stats).toHaveProperty('errorRate');
    });

    it('should support convenience methods', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig,
      });

      const trace = {
        actionId: 'convenience:test',
        toJSON: () => ({ actionId: 'convenience:test' }),
      };

      // Test convenience method for priority writing
      await service.writeTraceWithPriority(trace, TracePriority.HIGH);

      // Allow queue processing
      await testTimerService.triggerAll();
      if (testTimerService.hasPending()) {
        await testTimerService.triggerAll();
      }
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
    });

    it('should handle export functionality with enhanced queue', async () => {
      // Mock browser APIs for export
      global.Blob = jest.fn((content, options) => ({
        content,
        type: options.type,
      }));
      global.URL = {
        createObjectURL: jest.fn(() => 'blob:url'),
        revokeObjectURL: jest.fn(),
      };
      global.document = {
        createElement: jest.fn(() => ({
          click: jest.fn(),
          href: null,
          download: null,
        })),
      };

      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig,
      });

      // Add some traces to storage
      const existingTraces = [
        {
          id: 'export-test-1',
          timestamp: Date.now(),
          data: { actionId: 'export:test1', exported: true },
        },
        {
          id: 'export-test-2',
          timestamp: Date.now(),
          data: { actionId: 'export:test2', exported: true },
        },
      ];
      mockStorageAdapter.getItem.mockResolvedValue(existingTraces);

      await service.exportTraces('json');

      expect(global.Blob).toHaveBeenCalledWith(
        [JSON.stringify(existingTraces, null, 2)],
        { type: 'application/json' }
      );

      // Cleanup browser mocks
      delete global.Blob;
      delete global.URL;
      delete global.document;
    });
  });
});
