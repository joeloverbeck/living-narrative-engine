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
import { TestTimerService } from '../../../../src/actions/tracing/timerService.js';

describe('ActionTraceOutputService - Enhanced Features', () => {
  let service;
  let mockLogger;
  let mockStorageAdapter;
  let mockActionTraceFilter;
  let testTimerService;

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

  // Helper to wait for queue processing to complete
  const waitForProcessingComplete = async () => {
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      // Trigger any pending timers
      await testTimerService.triggerAll();
      
      // Wait for any running callbacks to complete
      if (testTimerService.waitForCompletion) {
        await testTimerService.waitForCompletion();
      }
      
      // Small delay to allow new operations to be scheduled
      await new Promise(resolve => setImmediate(resolve));
      
      // If no more pending timers and no operations running, we're done
      if (!testTimerService.hasPending() && !testTimerService.isProcessing()) {
        break;
      }
      
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      console.warn(`waitForProcessingComplete: Max attempts reached, pending: ${testTimerService.hasPending()}, processing: ${testTimerService.isProcessing()}`);
    }
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockActionTraceFilter = createMockActionTraceFilter();
    testTimerService = new TestTimerService();

    // Create mock storage adapter
    mockStorageAdapter = {
      getItem: jest.fn().mockResolvedValue(null),
      setItem: jest.fn().mockResolvedValue(undefined),
      removeItem: jest.fn().mockResolvedValue(undefined),
      getAllKeys: jest.fn().mockResolvedValue([]),
      clear: jest.fn().mockResolvedValue(undefined),
      isAvailable: jest.fn().mockResolvedValue(true),
    };

    // Clear test timer service
    testTimerService.clearAll();
    // Keep Jest fake timers for backward compatibility tests
    jest.useFakeTimers();
  });

  afterEach(async () => {
    // Gracefully shutdown the service if it exists
    if (service && typeof service.shutdown === 'function') {
      try {
        // Wait for any pending test timer operations to complete first
        if (testTimerService && testTimerService.waitForCompletion) {
          await testTimerService.waitForCompletion();
        }

        // Set a timeout to prevent hanging on shutdown
        await Promise.race([
          service.shutdown(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Shutdown timeout')), 3000)
          ),
        ]);
      } catch (error) {
        // Log shutdown errors for debugging but don't fail tests
        console.warn('Test cleanup - shutdown error:', error.message);
      }
    }

    // Clear test timer service first
    if (testTimerService) {
      testTimerService.clearAll();
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
        queueConfig: {
          timerService: testTimerService,
        },
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
        queueConfig: {
          timerService: testTimerService,
        },
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

      // Trigger timer-based batch processing
      await testTimerService.triggerAll();

      // Now processing should have started and the queue should be empty
      stats = service.getQueueStats();
      expect(stats.queueLength).toBe(0);
      
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
      // Use a smaller queue size for faster testing
      const testMaxQueueSize = 10;
      
      // Create service with smaller max queue size  
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        queueConfig: {
          timerService: testTimerService,
          maxQueueSize: testMaxQueueSize,
        },
      });

      // Make storage operations very slow to keep items in queue
      mockStorageAdapter.setItem.mockImplementation(() => {
        return new Promise(resolve => {
          // Use a real setTimeout to create actual delay since TestTimerService won't delay this
          setTimeout(resolve, 100);
        });
      });

      // Fill up queue to capacity - do this quickly without triggering processing
      const fillPromises = [];
      for (let i = 0; i < testMaxQueueSize + 5; i++) {
        fillPromises.push(service.writeTrace({
          actionId: `fill:${i}`,
          toJSON: () => ({ id: i }),
        }));
      }

      await Promise.all(fillPromises);

      // Try to add more traces - these should be dropped due to queue being full
      const overflowPromises = [];
      for (let i = 0; i < 5; i++) {
        overflowPromises.push(service.writeTrace({
          actionId: `overflow:${i}`,
          toJSON: () => ({ action: 'overflow', id: i }),
        }));
      }

      await Promise.all(overflowPromises);

      // Check that TraceQueueProcessor logged the drop warning
      const warnCalls = mockLogger.warn.mock.calls;
      const queueFullLogged = warnCalls.some(
        (call) => call[0] && call[0].includes('Queue full, dropping trace')
      );
      expect(queueFullLogged).toBe(true);

      // Clean up by triggering processing to finish
      await testTimerService.triggerAll();
      await testTimerService.waitForCompletion();
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

      // Trigger queue processing to run
      await testTimerService.triggerAll();

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
        queueConfig: {
          timerService: testTimerService,
        },
      });
    });

    it('should store traces in IndexedDB format', async () => {
      const trace = {
        actionId: 'test:store',
        toJSON: () => ({ action: 'store', data: 'test' }),
      };

      await service.writeTrace(trace);
      await testTimerService.triggerAll();

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
      await testTimerService.triggerAll();

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
      await testTimerService.triggerAll();

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
        queueConfig: {
          timerService: testTimerService,
        },
      });
    });

    it('should handle storage operation failures', async () => {
      // Mock storage to fail initially
      mockStorageAdapter.setItem.mockRejectedValueOnce(
        new Error('Storage error')
      );

      const trace = {
        actionId: 'error:test',
        toJSON: () => ({ action: 'error' }),
      };

      await service.writeTrace(trace);

      // Trigger initial processing
      await testTimerService.triggerAll();

      // Verify TraceQueueProcessor error logging occurred for the failure
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

      // Add traces one by one to ensure individual processing and consecutive failures
      for (let i = 0; i < 12; i++) {
        await service.writeTrace({
          actionId: `error:${i}`,
          toJSON: () => ({ id: i }),
        });
        
        // Trigger processing after each write to ensure individual failures
        await testTimerService.triggerAll();
      }

      // Wait for all operations to complete
      await testTimerService.waitForCompletion();

      // TraceQueueProcessor logs circuit breaker message 
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TraceQueueProcessor: Circuit breaker opened due to consecutive failures'
      );
    }, 15000);

    it('should handle permanent storage failures', async () => {
      // Mock storage to always fail
      mockStorageAdapter.setItem.mockRejectedValue(
        new Error('Permanent failure')
      );

      const trace = {
        actionId: 'permanent:fail',
        toJSON: () => ({ action: 'fail' }),
      };

      await service.writeTrace(trace);

      // Trigger initial processing
      await testTimerService.triggerAll();

      // Verify TraceQueueProcessor logged the failure
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TraceQueueProcessor: Failed to process item',
        expect.any(Error)
      );
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        queueConfig: {
          timerService: testTimerService,
        },
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
        queueConfig: {
          timerService: testTimerService,
        },
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

      // Initially, trace should be queued
      let stats = service.getQueueStats();
      expect(stats.queueLength).toBe(1);

      // Trigger processing
      await testTimerService.triggerAll();

      // After processing, queue should be empty
      stats = service.getQueueStats();
      expect(stats.queueLength).toBe(0);

      // Verify storage was called
      expect(mockStorageAdapter.setItem).toHaveBeenCalled();
    });
  });

  describe('Shutdown and Cleanup', () => {
    beforeEach(() => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        queueConfig: {
          timerService: testTimerService,
        },
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
      await testTimerService.triggerAll();
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

    it('should complete shutdown process', async () => {
      const trace = {
        actionId: 'shutdown:trace',
        toJSON: () => ({ shutdown: true }),
      };

      await service.writeTrace(trace);

      // Process the trace first
      await testTimerService.triggerAll();

      // Now shutdown should complete quickly
      await service.shutdown();

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
        queueConfig: {
          timerService: testTimerService,
        },
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

      await testTimerService.triggerAll();

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
      await testTimerService.triggerAll();

      const savedTraces = mockStorageAdapter.setItem.mock.calls[0][1];
      // TraceQueueProcessor generates IDs with format: sanitized_timestamp_random
      expect(savedTraces[0].id).toMatch(
        /^test-action-with-special-chars_\d+_[a-z0-9]+$/
      );
    });
  });
});
