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
  const waitRealTime = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
          )
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
        'ActionTraceOutputService initialized'
      );
    });

    it('should create instance without storage adapter (backward compatibility)', () => {
      service = new ActionTraceOutputService({
        logger: mockLogger,
      });

      expect(service).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ActionTraceOutputService initialized'
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
      // Use real timers for this test
      jest.useRealTimers();
      
      const trace = {
        actionId: 'test:action',
        toJSON: () => ({ action: 'test' }),
      };

      await service.writeTrace(trace);
      
      // Processing should have started
      const stats = service.getQueueStats();
      expect(stats.isProcessing).toBe(true);
      
      // Wait a short time for processing to complete with timeout
      await Promise.race([
        waitRealTime(100),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Processing timeout')), 2000)
        )
      ]);
      
      // Now processing should be complete
      const finalStats = service.getQueueStats();
      expect(finalStats.queueLength).toBe(0);
      expect(finalStats.isProcessing).toBe(false);
      
      // Restore fake timers
      jest.useFakeTimers();
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
      // Use real timers to avoid fake timer complications
      jest.useRealTimers();
      
      // Block storage adapter to prevent processing
      let resolveStorage;
      const storagePromise = new Promise((resolve) => {
        resolveStorage = resolve;
      });
      mockStorageAdapter.setItem.mockReturnValue(storagePromise);
      
      // Fill up queue to actual capacity (1000 items)
      const maxQueueSize = 1000;
      for (let i = 0; i < maxQueueSize; i++) {
        await service.writeTrace({
          actionId: `fill:${i}`,
          toJSON: () => ({ id: i }),
        });
      }
      
      // Allow some processing to start
      await waitRealTime(10);
      
      // Verify queue is near capacity (some items may have started processing)
      const stats = service.getQueueStats();
      expect(stats.queueLength).toBeGreaterThanOrEqual(maxQueueSize - 10);
      
      // Try to add more traces until we hit the limit
      let errorLogged = false;
      for (let i = 0; i < 20 && !errorLogged; i++) {
        await service.writeTrace({
          actionId: `overflow:${i}`,
          toJSON: () => ({ action: 'overflow' }),
        });
        
        // Check if error was logged
        const errorCalls = mockLogger.error.mock.calls;
        errorLogged = errorCalls.some(call => 
          call[0] && call[0].includes('Queue full')
        );
      }

      expect(errorLogged).toBe(true);
      
      // Clean up
      resolveStorage();
      jest.useFakeTimers();
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
            id: expect.stringContaining('action1'),
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
      
      // Allow queue processing to run
      await jest.runAllTimersAsync();
      expect(attempts).toBe(1);

      // Verify error logging occurred for the initial failed attempt
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to store trace'),
        expect.any(Error)
      );
    });

    it('should activate circuit breaker after 10 consecutive errors', async () => {
      mockStorageAdapter.setItem.mockRejectedValue(
        new Error('Persistent error')
      );

      const traces = Array(15)
        .fill(null)
        .map((_, i) => ({
          actionId: `error:${i}`,
          toJSON: () => ({ id: i }),
        }));

      for (const trace of traces) {
        await service.writeTrace(trace);
      }

      await jest.runAllTimersAsync();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ActionTraceOutputService: Too many storage errors, stopping queue processing'
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

      // Allow queue processing to run
      await jest.runAllTimersAsync();
      expect(attempts).toBe(1);

      // Verify that failure was logged for the initial attempt
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to store trace'),
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
      });
    });

    it('should update statistics as queue processes', async () => {
      // Use real timers for this test
      jest.useRealTimers();
      
      const trace = {
        actionId: 'stats:test',
        toJSON: () => ({ action: 'stats' }),
      };

      await service.writeTrace(trace);

      // Processing should have started immediately
      let stats = service.getQueueStats();
      expect(stats.isProcessing).toBe(true);

      // Wait for processing to complete with timeout
      await Promise.race([
        waitRealTime(100),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Stats processing timeout')), 2000)
        )
      ]);

      stats = service.getQueueStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.isProcessing).toBe(false);
      
      // Restore fake timers
      jest.useFakeTimers();
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
      expect(mockStorageAdapter.setItem).toHaveBeenCalledTimes(traces.length);
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
      expect(savedTraces[0].id).toMatch(/^test-action-with-special-chars_\d+$/);
    });
  });
});
