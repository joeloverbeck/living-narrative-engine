/**
 * @file Unit tests for enhanced ActionTraceOutputService with queue processing
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
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { createMockActionTraceFilter } from '../../../common/mockFactories/actionTracing.js';

describe('ActionTraceOutputService - Enhanced Features', () => {
  let service;
  let mockLogger;
  let mockStorageAdapter;
  let mockActionTraceFilter;

  // Helper to flush promises
  // const flushPromises = () => new Promise(resolve => setImmediate(resolve));

  // Helper to advance timers safely and flush all promises
  // const advanceTimersAndFlush = async (timeMs) => {
  //   await jest.advanceTimersByTime(timeMs);
  //   await flushPromises();
  //   // Give additional time for any remaining async operations
  //   await new Promise(resolve => setImmediate(resolve));
  // };

  // Helper to wait for real time to elapse (when using real timers)
  const waitRealTime = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockActionTraceFilter = createMockActionTraceFilter();

    // Create mock storage adapter
    mockStorageAdapter = {
      getItem: jest.fn().mockResolvedValue(null),
      setItem: jest.fn().mockResolvedValue(undefined),
      removeItem: jest.fn().mockResolvedValue(undefined),
      getAllKeys: jest.fn().mockResolvedValue([]),
      clear: jest.fn().mockResolvedValue(undefined),
      isAvailable: jest.fn().mockResolvedValue(true),
    };

    // Reset timers
    jest.useFakeTimers();
  });

  afterEach(async () => {
    // Gracefully shutdown the service if it exists
    if (service && typeof service.shutdown === 'function') {
      try {
        // Set a timeout to prevent hanging on shutdown
        await Promise.race([
          service.shutdown(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Shutdown timeout')), 5000)
          ),
        ]);
      } catch {
        // Ignore shutdown errors in test cleanup
      }
    }

    // Clear all timers and run any remaining ones
    jest.clearAllTimers();
    jest.runOnlyPendingTimers();

    // Reset mocks and restore real timers
    jest.clearAllMocks();
    jest.useRealTimers();

    // Clean up service reference
    service = null;
  });

  describe('Constructor and Initialization', () => {
    it('should create instance with storage adapter', () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
      });

      expect(service).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActionTraceOutputService initialized with TraceQueueProcessor'
      );
    });

    it('should create instance without storage adapter (backward compatibility)', () => {
      service = new ActionTraceOutputService({
        logger: mockLogger,
      });

      expect(service).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActionTraceOutputService initialized with simple queue'
      );
    });
  });

  describe('Queue Management', () => {
    beforeEach(() => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
      });
    });

    it('should queue traces for processing', async () => {
      const trace = {
        actionId: 'test:action',
        toJSON: () => ({ action: 'test' }),
      };

      await service.writeTrace(trace);

      // TraceQueueProcessor schedules processing with setTimeout(0)
      // so processing won't start until we advance timers
      let stats = service.getQueueStats();
      expect(stats.queueLength).toBe(1);
      expect(stats.isProcessing).toBe(false);

      // Advance timers to trigger batch processing
      await jest.runOnlyPendingTimersAsync();

      // Now processing should have started and completed
      stats = service.getQueueStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.isProcessing).toBe(false);

      // Verify storage was called
      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
    }, 5000);

    it('should handle null traces gracefully', async () => {
      await service.writeTrace(null);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionTraceOutputService: Null trace provided'
      );
      const stats = service.getQueueStats();
      expect(stats.queueLength).toBe(0);
    });

    it('should enforce maximum queue size', async () => {
      // Block storage adapter to prevent processing
      let resolveStorage;
      const storagePromise = new Promise((resolve) => {
        resolveStorage = resolve;
      });
      mockStorageAdapter.setItem.mockReturnValue(storagePromise);

      // Fill up queue to capacity (1000 items)
      const maxQueueSize = 1000;
      for (let i = 0; i < maxQueueSize; i++) {
        await service.writeTrace({
          actionId: `fill:${i}`,
          toJSON: () => ({ id: i }),
        });
      }

      // Verify queue is at capacity
      let stats = service.getQueueStats();
      expect(stats.queueLength).toBe(maxQueueSize);

      // Try to add one more trace - should be dropped
      await service.writeTrace({
        actionId: 'overflow:1',
        toJSON: () => ({ action: 'overflow' }),
      });

      // Check that TraceQueueProcessor logged the drop warning
      const warnCalls = mockLogger.warn.mock.calls;
      const queueFullLogged = warnCalls.some(
        (call) => call[0] && call[0].includes('Queue full, dropping trace')
      );
      expect(queueFullLogged).toBe(true);

      // Queue size should still be at max
      stats = service.getQueueStats();
      expect(stats.queueLength).toBe(maxQueueSize);

      // Clean up
      resolveStorage();
    }, 10000);

    it('should process queue asynchronously', async () => {
      const traces = [
        { actionId: 'test:1', toJSON: () => ({ id: 1 }) },
        { actionId: 'test:2', toJSON: () => ({ id: 2 }) },
        { actionId: 'test:3', toJSON: () => ({ id: 3 }) },
      ];

      for (const trace of traces) {
        await service.writeTrace(trace);
      }

      // Allow queue processing to run
      await jest.runAllTimersAsync();

      // Check that storage was called for each trace
      expect(mockStorageAdapter.setItem).toHaveBeenCalledTimes(traces.length);
    });
  });

  describe('Storage Integration', () => {
    beforeEach(() => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
      });
    });

    it('should store traces in IndexedDB format', async () => {
      const trace = {
        actionId: 'test:store',
        toJSON: () => ({ action: 'store', data: 'test' }),
      };

      await service.writeTrace(trace);
      await jest.runAllTimersAsync();

      expect(mockStorageAdapter.setItem).toHaveBeenCalledWith(
        'actionTraces',
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringContaining('test-store'),
            timestamp: expect.any(Number),
            priority: expect.any(Number), // TraceQueueProcessor adds priority
            data: expect.objectContaining({
              action: 'store',
              data: 'test',
            }),
          }),
        ])
      );
    });

    it('should handle ActionAwareStructuredTrace format', async () => {
      const tracedActions = new Map();
      tracedActions.set('action1', {
        stages: {
          start: { timestamp: 1000 },
          end: { timestamp: 2000 },
        },
      });

      const trace = {
        getTracedActions: () => tracedActions,
        getSpans: () => ['span1', 'span2'],
      };

      await service.writeTrace(trace);
      await jest.runAllTimersAsync();

      expect(mockStorageAdapter.setItem).toHaveBeenCalledWith(
        'actionTraces',
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String), // TraceQueueProcessor generates different IDs
            timestamp: expect.any(Number),
            priority: expect.any(Number), // TraceQueueProcessor adds priority
            data: expect.objectContaining({
              traceType: 'pipeline',
              spans: ['span1', 'span2'],
              actions: expect.objectContaining({
                action1: expect.objectContaining({
                  totalDuration: 1000,
                }),
              }),
            }),
          }),
        ])
      );
    });

    it('should limit stored traces to 100', async () => {
      // Mock existing traces at limit
      const existingTraces = Array(99)
        .fill(null)
        .map((_, i) => ({
          id: `old-trace-${i}`,
          timestamp: Date.now() - 10000,
          data: { id: i },
        }));

      mockStorageAdapter.getItem.mockResolvedValue(existingTraces);

      const newTrace = {
        actionId: 'new:trace',
        toJSON: () => ({ action: 'new' }),
      };

      await service.writeTrace(newTrace);
      await jest.runAllTimersAsync();

      expect(mockStorageAdapter.setItem).toHaveBeenCalledWith(
        'actionTraces',
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringContaining('new-trace'),
          }),
        ])
      );

      // Check that total is still 100
      const savedTraces = mockStorageAdapter.setItem.mock.calls[0][1];
      expect(savedTraces.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling and Retry Logic', () => {
    beforeEach(() => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
      });
    });

    it('should retry failed storage operations with exponential backoff', async () => {
      let attempts = 0;

      mockStorageAdapter.setItem.mockImplementation(() => {
        attempts++;
        return Promise.reject(new Error('Storage error'));
      });

      const trace = {
        actionId: 'retry:test',
        toJSON: () => ({ action: 'retry' }),
      };

      await service.writeTrace(trace);

      // TraceQueueProcessor retries items within the same batch processing cycle
      // so all attempts (initial + retries) happen in one runAllTimersAsync() call
      await jest.runAllTimersAsync();

      // Should have made initial attempt plus retries (maxRetries = 3)
      expect(attempts).toBe(4); // 1 initial + 3 retries

      // Verify TraceQueueProcessor error logging occurred
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TraceQueueProcessor: Failed to process item',
        expect.any(Error)
      );
    });

    it('should activate circuit breaker after 10 consecutive errors', async () => {
      // Mock storage to always fail to trigger circuit breaker
      mockStorageAdapter.setItem.mockRejectedValue(
        new Error('Persistent error')
      );

      // Add 11 traces at once to ensure they're processed in batches
      // where all items fail consecutively
      for (let i = 0; i < 11; i++) {
        await service.writeTrace({
          actionId: `error:${i}`,
          toJSON: () => ({ id: i }),
        });
      }

      // Process the batch - this will trigger consecutive item failures
      await jest.runAllTimersAsync();

      // TraceQueueProcessor logs circuit breaker message with additional text
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TraceQueueProcessor: Circuit breaker opened due to consecutive failures'
      );
    }, 15000);

    it('should permanently fail after max retries', async () => {
      let attempts = 0;
      mockStorageAdapter.setItem.mockImplementation(() => {
        attempts++;
        return Promise.reject(new Error('Permanent failure'));
      });

      const trace = {
        actionId: 'permanent:fail',
        toJSON: () => ({ action: 'fail' }),
      };

      await service.writeTrace(trace);

      // Allow all processing and retries to complete
      await jest.runAllTimersAsync();

      // Should have made multiple attempts (initial + retries)
      expect(attempts).toBeGreaterThan(1);

      // Verify TraceQueueProcessor logged the permanent failure
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Item permanently failed'),
        expect.objectContaining({
          itemId: expect.any(String),
          retryCount: expect.any(Number),
          error: 'Permanent failure',
        })
      );
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
      });

      // Mock browser APIs
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
    });

    afterEach(() => {
      delete global.Blob;
      delete global.URL;
      delete global.document;
    });

    it('should export traces as JSON', async () => {
      const traces = [
        { id: 'trace1', timestamp: Date.now(), data: { test: 1 } },
        { id: 'trace2', timestamp: Date.now(), data: { test: 2 } },
      ];

      mockStorageAdapter.getItem.mockResolvedValue(traces);

      await service.exportTraces('json');

      expect(global.Blob).toHaveBeenCalledWith(
        [JSON.stringify(traces, null, 2)],
        { type: 'application/json' }
      );
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Exported 2 traces')
      );
    });

    it('should export traces as text', async () => {
      const traces = [
        { id: 'trace1', timestamp: Date.now(), data: { test: 1 } },
      ];

      mockStorageAdapter.getItem.mockResolvedValue(traces);

      await service.exportTraces('text');

      expect(global.Blob).toHaveBeenCalledWith(
        [expect.stringContaining('=== Trace: trace1 ===')],
        { type: 'text/plain' }
      );
    });

    it('should handle empty trace list', async () => {
      mockStorageAdapter.getItem.mockResolvedValue([]);

      await service.exportTraces();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionTraceOutputService: No traces to export'
      );
      expect(global.Blob).not.toHaveBeenCalled();
    });

    it('should warn when no storage adapter available', async () => {
      const serviceNoStorage = new ActionTraceOutputService({
        logger: mockLogger,
      });

      await serviceNoStorage.exportTraces();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionTraceOutputService: No storage adapter available for export'
      );
    });
  });

  describe('Queue Statistics', () => {
    beforeEach(() => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
      });
    });

    it('should provide queue statistics', () => {
      const stats = service.getQueueStats();

      expect(stats).toEqual({
        queueLength: 0,
        isProcessing: false,
        writeErrors: 0,
        maxQueueSize: 1000,
        memoryUsage: 0,
        circuitBreakerOpen: false,
        priorities: {
          0: { size: 0, oldestTimestamp: null },
          1: { size: 0, oldestTimestamp: null },
          2: { size: 0, oldestTimestamp: null },
          3: { size: 0, oldestTimestamp: null },
        },
      });
    });

    it('should update statistics as queue processes', async () => {
      const trace = {
        actionId: 'stats:test',
        toJSON: () => ({ action: 'stats' }),
      };

      await service.writeTrace(trace);

      // Initially, trace should be queued but not processing
      let stats = service.getQueueStats();
      expect(stats.queueLength).toBe(1);
      expect(stats.isProcessing).toBe(false);

      // Advance timers to trigger and complete processing
      await jest.runOnlyPendingTimersAsync();

      // After processing completes
      stats = service.getQueueStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.isProcessing).toBe(false);

      // Verify storage was called
      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
    }, 5000);
  });

  describe('Shutdown and Cleanup', () => {
    beforeEach(() => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
      });
    });

    it('should flush queue on shutdown', async () => {
      const traces = [
        { actionId: 'shutdown:1', toJSON: () => ({ id: 1 }) },
        { actionId: 'shutdown:2', toJSON: () => ({ id: 2 }) },
      ];

      for (const trace of traces) {
        await service.writeTrace(trace);
      }

      const shutdownPromise = service.shutdown();
      await jest.runAllTimersAsync();
      await shutdownPromise;

      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActionTraceOutputService: Shutting down, flushing queue...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActionTraceOutputService: Shutdown complete'
      );

      // TraceQueueProcessor batches all remaining items into a single write during shutdown
      expect(mockStorageAdapter.setItem).toHaveBeenCalledWith(
        'actionTraces',
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringContaining('shutdown-1'),
            data: expect.objectContaining({ id: 1 }),
          }),
          expect.objectContaining({
            id: expect.stringContaining('shutdown-2'),
            data: expect.objectContaining({ id: 2 }),
          }),
        ])
      );
    });

    it('should wait for processing to complete', async () => {
      // Simulate slow processing
      mockStorageAdapter.setItem.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      const trace = {
        actionId: 'slow:trace',
        toJSON: () => ({ slow: true }),
      };

      await service.writeTrace(trace);

      const shutdownPromise = service.shutdown();

      // Advance timers to complete processing
      await jest.advanceTimersByTimeAsync(2000);
      await shutdownPromise;

      expect(mockLogger.info).toHaveBeenCalledWith(
        'ActionTraceOutputService: Shutdown complete'
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('should fall back to legacy behavior without storage adapter', async () => {
      // Use real timers for this test
      jest.useRealTimers();

      const serviceNoStorage = new ActionTraceOutputService({
        logger: mockLogger,
      });

      const trace = {
        actionId: 'legacy:trace',
        toJSON: () => ({ legacy: true }),
        actorId: 'test-actor',
        duration: 100,
        hasError: false,
        isComplete: true,
      };

      // Write the trace and wait for completion
      await serviceNoStorage.writeTrace(trace);

      // Give time for the setTimeout(resolve, 0) in defaultOutputHandler
      await waitRealTime(10);

      // Should use legacy output handler - check for the specific debug call
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ACTION_TRACE',
        expect.objectContaining({
          actionId: 'legacy:trace',
          actorId: 'test-actor',
          duration: 100,
          hasError: false,
        })
      );

      // Restore fake timers
      jest.useFakeTimers();
    }, 5000);

    it('should maintain legacy statistics API', () => {
      const serviceNoStorage = new ActionTraceOutputService({
        logger: mockLogger,
      });

      const stats = serviceNoStorage.getStatistics();

      expect(stats).toHaveProperty('totalWrites');
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('pendingWrites');
      expect(stats).toHaveProperty('errorRate');
    });

    it('should support waitForPendingWrites', async () => {
      const serviceNoStorage = new ActionTraceOutputService({
        logger: mockLogger,
      });

      await serviceNoStorage.waitForPendingWrites();

      // Should complete without error
      expect(true).toBe(true);
    });
  });

  describe('Trace ID Generation', () => {
    beforeEach(() => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
      });
    });

    it('should generate unique IDs for traces', async () => {
      const traces = [
        { actionId: 'test:action1', toJSON: () => ({ id: 1 }) },
        { actionId: 'test:action2', toJSON: () => ({ id: 2 }) },
      ];

      for (const trace of traces) {
        await service.writeTrace(trace);
      }

      await jest.runAllTimersAsync();

      const calls = mockStorageAdapter.setItem.mock.calls;
      const savedIds = new Set();

      for (const call of calls) {
        const savedTraces = call[1];
        for (const trace of savedTraces) {
          savedIds.add(trace.id);
        }
      }

      // All IDs should be unique
      expect(savedIds.size).toBe(traces.length);
    });

    it('should sanitize action IDs in trace IDs', async () => {
      const trace = {
        actionId: 'test:action/with#special@chars',
        toJSON: () => ({ action: 'special' }),
      };

      await service.writeTrace(trace);
      await jest.runAllTimersAsync();

      const savedTraces = mockStorageAdapter.setItem.mock.calls[0][1];
      // TraceQueueProcessor generates IDs with format: sanitized_timestamp_random
      expect(savedTraces[0].id).toMatch(
        /^test-action-with-special-chars_\d+_[a-z0-9]+$/
      );
    });
  });
});
