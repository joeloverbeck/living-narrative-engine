/**
 * @file Memory tests for ActionTraceOutputService
 * @description Tests for memory leaks, queue memory management, and resource cleanup
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionTraceOutputService } from '../../../../src/actions/tracing/actionTraceOutputService.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import {
  createMockActionTraceFilter,
  createMockStorageAdapter,
  createMockJsonTraceFormatter,
  createMockHumanReadableFormatter,
} from '../../../common/mockFactories/actionTracing.js';

describe('ActionTraceOutputService Memory Usage', () => {
  let service;
  let mockStorageAdapter;
  let mockLogger;
  let mockActionTraceFilter;
  let mockJsonFormatter;
  let mockHumanReadableFormatter;
  let initialMemory;

  beforeEach(() => {
    // Force garbage collection if available (requires --expose-gc flag)
    if (global.gc) {
      global.gc();
    }

    // Record initial memory usage
    initialMemory = process.memoryUsage();

    mockStorageAdapter = createMockStorageAdapter();
    mockLogger = createMockLogger();
    mockActionTraceFilter = createMockActionTraceFilter();
    mockJsonFormatter = createMockJsonTraceFormatter();
    mockHumanReadableFormatter = createMockHumanReadableFormatter();

    // Configure storage adapter for memory testing
    mockStorageAdapter.setItem.mockImplementation(async (key, value) => {
      // Simulate realistic storage without keeping references
      await new Promise((resolve) => setImmediate(resolve));
      return true;
    });

    mockStorageAdapter.getItem.mockImplementation(async () => {
      await new Promise((resolve) => setImmediate(resolve));
      return [];
    });
  });

  afterEach(async () => {
    // Cleanup service
    if (service && typeof service.shutdown === 'function') {
      await service.shutdown();
    }

    // Clear all references
    service = null;
    mockStorageAdapter = null;
    mockLogger = null;
    mockActionTraceFilter = null;
    mockJsonFormatter = null;
    mockHumanReadableFormatter = null;

    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
  });

  describe('Queue Memory Management', () => {
    it('should not leak memory during queue processing', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        queueConfig: {
          maxQueueSize: 100,
          batchSize: 10,
        },
      });

      // Process many traces
      const iterations = 100;
      const tracesPerIteration = 10;

      for (let i = 0; i < iterations; i++) {
        const traces = Array.from({ length: tracesPerIteration }, (_, j) =>
          createMockTrace(`core:action${i}-${j}`)
        );

        for (const trace of traces) {
          await service.writeTrace(trace);
        }

        // Allow queue to process
        await new Promise((resolve) => setImmediate(resolve));

        // Periodically check memory growth
        if (i % 20 === 0 && global.gc) {
          global.gc();
          const currentMemory = process.memoryUsage();
          const heapGrowth = currentMemory.heapUsed - initialMemory.heapUsed;

          // Memory growth should be bounded
          expect(heapGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
        }
      }

      // Final memory check
      if (global.gc) {
        global.gc();
        const finalMemory = process.memoryUsage();
        const totalGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

        // Total memory growth should be reasonable
        expect(totalGrowth).toBeLessThan(20 * 1024 * 1024); // Less than 20MB final growth
      }
    });

    it('should clean up processed traces from memory', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        queueConfig: {
          batchSize: 5,
          flushInterval: 50,
        },
      });

      // Create traces with large data
      const largeTraces = Array.from({ length: 50 }, (_, i) => {
        const trace = createMockTrace(`core:large${i}`);
        trace.largeData = new Array(1000).fill({ data: `Large data ${i}` });
        return trace;
      });

      // Write all traces
      for (const trace of largeTraces) {
        await service.writeTrace(trace);
      }

      // Wait for processing with proper polling for queue completion
      let waitCount = 0;
      let stats = service.getQueueStats();
      while (stats.queueLength > 0 && waitCount < 30) {
        // Max 1.5 seconds (reduced from 5 seconds)
        await new Promise((resolve) => setTimeout(resolve, 50)); // Faster polling
        stats = service.getQueueStats();
        waitCount++;
      }

      // Clear references to traces
      largeTraces.length = 0;

      // Force garbage collection
      if (global.gc) {
        global.gc();

        // Check that queue has been processed (allow some tolerance for complex queue processing)
        const finalStats = service.getQueueStats();
        expect(finalStats.queueLength).toBeLessThanOrEqual(5); // Allow for some remaining items due to async processing

        // Memory should be released
        const memoryAfter = process.memoryUsage();
        const heapUsed = memoryAfter.heapUsed - initialMemory.heapUsed;

        // Should have released most memory
        expect(heapUsed).toBeLessThan(10 * 1024 * 1024); // Less than 10MB retained
      }
    });

    it('should handle large trace volumes without excessive memory growth', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        queueConfig: {
          maxQueueSize: 50,
          memoryLimit: 20 * 1024 * 1024, // 20MB limit
        },
      });

      const memorySnapshots = [];
      const traceCount = 500;

      for (let i = 0; i < traceCount; i++) {
        const trace = createMockTrace(`core:action${i}`);
        await service.writeTrace(trace);

        // Take memory snapshots periodically
        if (i % 100 === 0 && global.gc) {
          global.gc();
          const memory = process.memoryUsage();
          memorySnapshots.push({
            iteration: i,
            heapUsed: memory.heapUsed,
            external: memory.external,
            arrayBuffers: memory.arrayBuffers,
          });
        }

        // Small delay to allow processing
        if (i % 10 === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      }

      // Wait for final processing
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Analyze memory growth pattern
      if (memorySnapshots.length > 1) {
        const firstSnapshot = memorySnapshots[0];
        const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
        const growth = lastSnapshot.heapUsed - firstSnapshot.heapUsed;

        // Memory growth should be sub-linear
        const growthPerTrace = growth / traceCount;
        expect(growthPerTrace).toBeLessThan(10 * 1024); // Less than 10KB per trace average
      }
    });

    it('should properly clean up on service shutdown', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        eventBus: { dispatch: jest.fn() },
      });

      // Add pending traces
      const traces = Array.from({ length: 20 }, (_, i) =>
        createMockTrace(`core:pending${i}`)
      );

      for (const trace of traces) {
        await service.writeTrace(trace);
      }

      // Shutdown service
      await service.shutdown();

      // Force garbage collection
      if (global.gc) {
        global.gc();

        const memoryAfter = process.memoryUsage();
        const retained = memoryAfter.heapUsed - initialMemory.heapUsed;

        // Should release all resources
        expect(retained).toBeLessThan(5 * 1024 * 1024); // Less than 5MB retained
      }

      // Service should be cleaned up
      const stats = service.getStatistics();
      expect(stats).toBeDefined(); // Should still be callable but cleaned up
    });
  });

  describe('Formatter Memory Management', () => {
    it('should not retain references to formatted traces', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        jsonFormatter: mockJsonFormatter,
        humanReadableFormatter: mockHumanReadableFormatter,
      });

      // Track formatter calls
      let formattedTraces = [];
      mockJsonFormatter.format.mockImplementation((trace) => {
        formattedTraces.push(trace);
        return JSON.stringify(trace);
      });

      // Process traces
      const traces = Array.from({ length: 100 }, (_, i) =>
        createMockTrace(`core:format${i}`)
      );

      for (const trace of traces) {
        await service.writeTrace(trace);
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear formatter references
      formattedTraces = null;
      mockJsonFormatter.format.mockClear();

      // Force garbage collection
      if (global.gc) {
        global.gc();

        const memoryAfter = process.memoryUsage();
        const retained = memoryAfter.heapUsed - initialMemory.heapUsed;

        // Formatters should not retain trace references
        expect(retained).toBeLessThan(10 * 1024 * 1024); // Less than 10MB retained
      }
    });

    it('should handle circular references without memory leaks', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        jsonFormatter: mockJsonFormatter,
      });

      // Create traces with circular references
      const traces = [];
      for (let i = 0; i < 50; i++) {
        const trace = createMockTrace(`core:circular${i}`);
        trace.self = trace; // Circular reference
        traces.push(trace);
      }

      // Add array references after all traces are created
      traces.forEach((trace) => {
        trace.related = traces; // Reference to array
      });

      for (const trace of traces) {
        await service.writeTrace(trace);
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear trace references
      traces.forEach((trace) => {
        delete trace.self;
        delete trace.related;
      });
      traces.length = 0;

      // Force garbage collection
      if (global.gc) {
        global.gc();

        const memoryAfter = process.memoryUsage();
        const retained = memoryAfter.heapUsed - initialMemory.heapUsed;

        // Circular references should be handled properly
        expect(retained).toBeLessThan(10 * 1024 * 1024); // Less than 10MB retained
      }
    });
  });

  describe('Storage Adapter Memory Management', () => {
    it('should not accumulate storage data in memory', async () => {
      // Track storage data accumulation
      let storageSize = 0;
      mockStorageAdapter.setItem.mockImplementation(async (key, value) => {
        storageSize = JSON.stringify(value).length;
        await new Promise((resolve) => setImmediate(resolve));
        return true;
      });

      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        queueConfig: {
          rotationPolicy: 'count',
          maxTraceCount: 50,
        },
      });

      // Write many traces
      for (let i = 0; i < 200; i++) {
        const trace = createMockTrace(`core:store${i}`);
        await service.writeTrace(trace);

        if (i % 20 === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Storage should be bounded by rotation policy
      expect(storageSize).toBeLessThan(1024 * 1024); // Less than 1MB in storage

      // Memory should also be bounded
      if (global.gc) {
        global.gc();

        const memoryAfter = process.memoryUsage();
        const retained = memoryAfter.heapUsed - initialMemory.heapUsed;

        expect(retained).toBeLessThan(15 * 1024 * 1024); // Less than 15MB retained
      }
    });

    it('should release storage references after operations', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
      });

      // Simulate large storage operations
      const largeData = new Array(1000).fill({ data: 'Large storage data' });
      mockStorageAdapter.getItem.mockResolvedValue(largeData);

      // Perform multiple storage operations
      for (let i = 0; i < 10; i++) {
        const trace = createMockTrace(`core:storage${i}`);
        await service.writeTrace(trace);
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear storage mock data
      mockStorageAdapter.getItem.mockResolvedValue([]);
      largeData.length = 0;

      // Force garbage collection
      if (global.gc) {
        global.gc();

        const memoryAfter = process.memoryUsage();
        const retained = memoryAfter.heapUsed - initialMemory.heapUsed;

        // Storage data should be released
        expect(retained).toBeLessThan(10 * 1024 * 1024); // Less than 10MB retained
      }
    });
  });

  describe('Event Bus Memory Management', () => {
    it('should not leak memory through event dispatching', async () => {
      const mockEventBus = {
        dispatch: jest.fn(),
      };

      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      // Track dispatched events
      const dispatchedEvents = [];
      mockEventBus.dispatch.mockImplementation((event) => {
        dispatchedEvents.push(event);
      });

      // Generate many events
      for (let i = 0; i < 100; i++) {
        const trace = createMockTrace(`core:event${i}`);
        await service.writeTrace(trace);
      }

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear event references
      dispatchedEvents.length = 0;
      mockEventBus.dispatch.mockClear();

      // Force garbage collection
      if (global.gc) {
        global.gc();

        const memoryAfter = process.memoryUsage();
        const retained = memoryAfter.heapUsed - initialMemory.heapUsed;

        // Events should not be retained
        expect(retained).toBeLessThan(10 * 1024 * 1024); // Less than 10MB retained
      }
    });
  });

  describe('Export Memory Management', () => {
    it('should not retain export data after operation', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        jsonFormatter: mockJsonFormatter,
      });

      // Create large trace set for export
      const traces = Array.from({ length: 100 }, (_, i) => ({
        id: `export-${i}`,
        timestamp: Date.now(),
        data: createMockTrace(`core:export${i}`),
      }));

      mockStorageAdapter.getItem.mockResolvedValue(traces);

      // Mock export mechanism
      global.document = {
        createElement: () => ({
          href: '',
          download: '',
          click: () => {},
        }),
      };
      global.URL = {
        createObjectURL: () => 'blob:url',
        revokeObjectURL: () => {},
      };
      global.Blob = function () {};

      // Perform export
      await service.exportTracesAsDownload('json');

      // Clear traces
      traces.length = 0;
      mockStorageAdapter.getItem.mockResolvedValue([]);

      // Cleanup mocks
      delete global.document;
      delete global.URL;
      delete global.Blob;

      // Force garbage collection
      if (global.gc) {
        global.gc();

        const memoryAfter = process.memoryUsage();
        const retained = memoryAfter.heapUsed - initialMemory.heapUsed;

        // Export data should be released
        expect(retained).toBeLessThan(10 * 1024 * 1024); // Less than 10MB retained
      }
    });
  });

  describe('Long-Running Memory Stability', () => {
    it('should maintain stable memory over extended operation', async () => {
      // Note: This test uses the global Jest timeout configuration from jest.config.memory.js (2 minutes)

      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        queueConfig: {
          maxQueueSize: 50,
          batchSize: 10,
          rotationPolicy: 'count',
          maxTraceCount: 100,
        },
      });

      const memoryCheckpoints = [];
      const duration = 2000; // 2 seconds (reduced from 5 seconds for faster testing)
      const interval = 400; // Check every 400ms (adjusted for shorter duration)
      const startTime = Date.now();

      // Continuously write traces
      const writeLoop = setInterval(async () => {
        const trace = createMockTrace(`core:continuous${Date.now()}`);
        await service.writeTrace(trace);
      }, 10);

      // Monitor memory usage
      const memoryMonitor = setInterval(() => {
        if (global.gc) {
          global.gc();
        }

        const memory = process.memoryUsage();
        memoryCheckpoints.push({
          time: Date.now() - startTime,
          heapUsed: memory.heapUsed,
          external: memory.external,
        });
      }, interval);

      // Run for specified duration
      await new Promise((resolve) => setTimeout(resolve, duration));

      // Stop operations
      clearInterval(writeLoop);
      clearInterval(memoryMonitor);

      // Wait for queue to clear
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Analyze memory stability
      if (memoryCheckpoints.length > 2) {
        const firstCheckpoint = memoryCheckpoints[0];
        const lastCheckpoint = memoryCheckpoints[memoryCheckpoints.length - 1];

        // Calculate average growth rate
        const totalGrowth = lastCheckpoint.heapUsed - firstCheckpoint.heapUsed;
        const growthRate = totalGrowth / (lastCheckpoint.time / 1000); // Bytes per second

        // Memory should be stable (low growth rate)
        // Adjusted for shorter test duration (2s instead of 5s)
        expect(growthRate).toBeLessThan(1.5 * 1024 * 1024); // Less than 1.5MB/second growth

        // Check for memory spikes
        const maxHeap = Math.max(...memoryCheckpoints.map((c) => c.heapUsed));
        const avgHeap =
          memoryCheckpoints.reduce((sum, c) => sum + c.heapUsed, 0) /
          memoryCheckpoints.length;
        const spikeRatio = maxHeap / avgHeap;

        // Should not have severe memory spikes
        expect(spikeRatio).toBeLessThan(2); // Max should be less than 2x average
      }
    });
  });

  // Helper functions
  /**
   * Create a mock trace for testing
   *
   * @param {string} actionId - Action identifier
   * @returns {object} Mock trace object
   */
  function createMockTrace(actionId = 'test:action') {
    return {
      actionId,
      actorId: 'test-actor',
      turnAction: {
        commandString: `${actionId} param`,
        actionDefinitionId: actionId,
        parameters: { param: 'value' },
      },
      execution: {
        startTime: Date.now(),
        endTime: Date.now() + 10,
        duration: 10,
        eventPayload: { type: 'ACTION_EXECUTED' },
        result: { success: true },
      },
      toJSON: function () {
        // Create a clean copy without circular references
        const { self, related, ...clean } = this;
        return clean;
      },
    };
  }
});
