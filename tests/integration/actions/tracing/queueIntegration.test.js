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
import { createMockActionTraceFilter, createMockIndexedDBStorageAdapter } from '../../../common/mockFactories/actionTracing.js';

describe('Queue Processor Integration', () => {
  let service;
  let mockLogger;
  let mockStorageAdapter;
  let mockActionTraceFilter;
  let mockEventBus;
  let queueConfig;

  beforeEach(() => {
    jest.useFakeTimers();
    
    mockLogger = createMockLogger();
    mockStorageAdapter = createMockIndexedDBStorageAdapter();
    mockActionTraceFilter = createMockActionTraceFilter();
    
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
    };
  });

  afterEach(() => {
    // Skip async shutdown in integration tests - just clear timers
    service = null;
    jest.clearAllTimers();
    jest.useRealTimers();
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
        'ActionTraceOutputService initialized with TraceQueueProcessor'
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
      
      // Allow queue processing
      await jest.runAllTimersAsync();

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

      await jest.runAllTimersAsync();

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
      await jest.runAllTimersAsync();

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

      // Enqueue multiple traces to trigger batch processing
      for (let i = 0; i < 6; i++) {
        const trace = {
          actionId: `batch:${i}`,
          toJSON: () => ({ actionId: `batch:${i}`, index: i }),
        };
        await service.writeTrace(trace);
      }

      await jest.runAllTimersAsync();

      // Check that batch processed event was dispatched
      const eventCalls = mockEventBus.dispatch.mock.calls;
      const batchEvent = eventCalls.find(call => 
        call[0] && call[0].type === QUEUE_EVENTS.BATCH_PROCESSED
      );
      
      expect(batchEvent).toBeDefined();
      expect(batchEvent[0].payload).toHaveProperty('batchSize');
      expect(batchEvent[0].payload).toHaveProperty('processingTime');
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
      
      // Allow retries to complete
      await jest.advanceTimersByTimeAsync(5000);

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
      }

      await jest.advanceTimersByTimeAsync(2000);

      // Circuit breaker should be activated
      const stats = service.getQueueStats();
      expect(stats.circuitBreakerOpen).toBe(true);

      // Circuit breaker event should be dispatched
      const eventCalls = mockEventBus.dispatch.mock.calls;
      const circuitEvent = eventCalls.find(call => 
        call[0] && call[0].type === QUEUE_EVENTS.CIRCUIT_BREAKER
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

      // Enqueue traces
      const traces = [];
      for (let i = 0; i < 3; i++) {
        const trace = {
          actionId: `shutdown:${i}`,
          toJSON: () => ({ actionId: `shutdown:${i}` }),
        };
        traces.push(trace);
        await service.writeTrace(trace);
      }

      // Shutdown should process all remaining traces
      // Need to handle the timers properly during shutdown
      const shutdownPromise = service.shutdown();
      
      // Advance timers to allow the shutdown process to complete
      await jest.runAllTimersAsync();
      
      // Wait for shutdown to complete
      await shutdownPromise;

      // Should have been called at least once to save the traces
      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
      
      // Verify all traces were saved in the final batch
      const lastCall = mockStorageAdapter.setItem.mock.calls[mockStorageAdapter.setItem.mock.calls.length - 1];
      expect(lastCall[0]).toBe('actionTraces');
      expect(lastCall[1]).toEqual(expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            actionId: 'shutdown:0'
          })
        }),
        expect.objectContaining({
          data: expect.objectContaining({
            actionId: 'shutdown:1'
          })
        }),
        expect.objectContaining({
          data: expect.objectContaining({
            actionId: 'shutdown:2'
          })
        })
      ]));
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActionTraceOutputService: Shutting down, flushing queue...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActionTraceOutputService: Shutdown complete'
      );
    }, 30000); // Add longer timeout to the test
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
        'ActionTraceOutputService initialized with simple queue'
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
      
      await jest.runAllTimersAsync();

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