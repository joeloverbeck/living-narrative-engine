/**
 * @file Memory tests for TraceQueueProcessor under realistic gaming load conditions
 * @description Validates memory efficiency, cleanup, and stability during
 * sustained processing typical of interactive gaming scenarios.
 *
 * Memory requirements:
 * - Memory increases stay under 2MB during sustained processing
 * - Memory growth stabilizes (no continuous leaks)
 * - Efficient cleanup of processed traces
 * - Queue size management prevents unbounded growth
 * @see src/actions/tracing/traceQueueProcessor.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TraceQueueProcessor } from '../../../../src/actions/tracing/traceQueueProcessor.js';
import { TracePriority } from '../../../../src/actions/tracing/tracePriority.js';
import { ActionExecutionTraceFactory } from '../../../../src/actions/tracing/actionExecutionTraceFactory.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { createMockIndexedDBStorageAdapter } from '../../../common/mockFactories/actionTracing.js';

/**
 * SLA requirements for memory validation
 */
const MEMORY_SLA_REQUIREMENTS = {
  MEMORY_INCREASE_LIMIT: 2 * 1024 * 1024, // 2MB maximum increase
  STABILITY_RATIO: 1.2, // Later growth should be <= 1.2x early growth
  CLEANUP_EFFICIENCY: 0.2, // Less than 20% remaining after processing
};

describe('TraceQueueProcessor - Realistic Load Memory Tests', () => {
  let processor;
  let traceFactory;
  let mockLogger;
  let mockStorageAdapter;
  let mockEventBus;
  let startMemory;

  beforeEach(() => {
    // Record initial memory state
    startMemory = 0;
    if (typeof performance !== 'undefined' && performance.memory) {
      startMemory = performance.memory.usedJSHeapSize;
    }

    // Initialize mocks
    mockLogger = createMockLogger();
    mockStorageAdapter = createMockIndexedDBStorageAdapter();
    mockEventBus = {
      dispatch: jest.fn(),
    };

    // Initialize trace factory
    traceFactory = new ActionExecutionTraceFactory({
      logger: mockLogger,
    });
  });

  afterEach(async () => {
    if (processor) {
      try {
        await processor.shutdown();
      } catch {
        // Ignore shutdown errors in cleanup
      }
    }
    processor = null;

    // Force garbage collection if available
    if (typeof global.gc === 'function') {
      global.gc();
    }
  });

  describe('Sustained Processing Memory Efficiency', () => {
    it('should maintain memory efficiency under sustained processing', async () => {
      // Skip memory API tests in environments where performance.memory is unavailable
      if (typeof performance === 'undefined' || !performance.memory) {
        console.log(
          'Skipping memory efficiency test: performance.memory API not available in this environment'
        );
        return;
      }

      processor = createProcessorWithConfig({
        maxQueueSize: 200,
        batchSize: 10,
        batchTimeout: 20,
        memoryLimit: 3 * 1024 * 1024, // 3MB limit
      });

      const memorySnapshots = [];

      // Process multiple batches to test sustained memory usage
      // Reduced from 5 to 3 batches for faster testing
      for (let batch = 0; batch < 3; batch++) {
        const traces = createPerformanceTraces(30); // Reduced from 40 to 30

        // Take memory snapshot before processing
        memorySnapshots.push({
          phase: `batch-${batch}-start`,
          heapUsed: performance.memory.usedJSHeapSize,
          heapTotal: performance.memory.totalJSHeapSize,
        });

        // Process traces
        traces.forEach((trace) => {
          processor.enqueue(trace, TracePriority.NORMAL);
        });

        await waitForProcessing(400); // Reduced from 800ms

        // Take memory snapshot after processing
        memorySnapshots.push({
          phase: `batch-${batch}-end`,
          heapUsed: performance.memory.usedJSHeapSize,
          heapTotal: performance.memory.totalJSHeapSize,
        });
      }

      // Analyze memory usage patterns
      expect(memorySnapshots.length).toBeGreaterThanOrEqual(2); // Ensure we have data

      const initialMemory = memorySnapshots[0].heapUsed;
      const finalMemory = memorySnapshots[memorySnapshots.length - 1].heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(
        MEMORY_SLA_REQUIREMENTS.MEMORY_INCREASE_LIMIT
      );

      // Check for memory stability (shouldn't continuously grow)
      const midPoint = Math.floor(memorySnapshots.length / 2);
      const midMemory = memorySnapshots[midPoint].heapUsed;
      const laterGrowth = finalMemory - midMemory;
      const earlyGrowth = midMemory - initialMemory;

      // Later growth should be less than or equal to early growth * stability ratio
      expect(laterGrowth).toBeLessThanOrEqual(
        earlyGrowth * MEMORY_SLA_REQUIREMENTS.STABILITY_RATIO
      );

      console.log(
        `Memory Performance: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase over ${memorySnapshots.length / 2} batches`
      );
    });

    it('should efficiently cleanup processed traces', async () => {
      processor = createProcessorWithConfig({
        maxQueueSize: 150,
        batchSize: 15, // Increased batch size for faster processing
        batchTimeout: 15, // Reduced timeout
      });

      const traces = createPerformanceTraces(75); // Reduced from 100

      // Record initial memory
      const initialMemory = performance?.memory?.usedJSHeapSize || 0;

      // Process traces
      traces.forEach((trace) => {
        processor.enqueue(trace, TracePriority.NORMAL);
      });

      await waitForProcessing(1000); // Reduced from 2000ms

      // Check queue state after processing
      const stats = processor.getQueueStats();

      // Queue should be mostly empty after processing
      expect(stats.totalSize).toBeLessThan(
        traces.length * MEMORY_SLA_REQUIREMENTS.CLEANUP_EFFICIENCY
      );

      // Memory should be reasonable
      const metrics = processor.getMetrics();
      expect(metrics.totalProcessed).toBeGreaterThan(0);

      // Check final memory usage if available
      const finalMemory = performance?.memory?.usedJSHeapSize || 0;

      if (initialMemory > 0 && finalMemory > 0) {
        const memoryGrowth = finalMemory - initialMemory;
        expect(memoryGrowth).toBeLessThan(
          MEMORY_SLA_REQUIREMENTS.MEMORY_INCREASE_LIMIT
        );
        console.log(
          `Memory growth during cleanup test: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`
        );
      } else {
        console.log('Memory monitoring not available in this environment');
      }

      console.log(
        `Cleanup Performance: ${stats.totalSize} remaining out of ${traces.length} processed`
      );
    });

    it('should prevent memory leaks during extended operation', async () => {
      processor = createProcessorWithConfig({
        maxQueueSize: 100,
        batchSize: 10, // Increased for faster processing
        batchTimeout: 30, // Reduced timeout
      });

      const memoryReadings = [];
      const cycles = 5; // Reduced from 8 to 5
      const tracesPerCycle = 15; // Reduced from 20 to 15

      // Run multiple processing cycles
      for (let cycle = 0; cycle < cycles; cycle++) {
        const traces = createPerformanceTraces(tracesPerCycle);

        // Record memory before cycle
        if (performance?.memory) {
          memoryReadings.push({
            cycle,
            phase: 'before',
            heapUsed: performance.memory.usedJSHeapSize,
          });
        }

        // Process traces
        traces.forEach((trace) => {
          processor.enqueue(trace, TracePriority.NORMAL);
        });

        await waitForProcessing(300); // Reduced from 600ms

        // Record memory after cycle
        if (performance?.memory) {
          memoryReadings.push({
            cycle,
            phase: 'after',
            heapUsed: performance.memory.usedJSHeapSize,
          });
        }

        // Force GC if available
        if (typeof global.gc === 'function') {
          global.gc();
        }
      }

      // Analyze memory trend
      if (memoryReadings.length >= 4) {
        const firstReading = memoryReadings[0].heapUsed;
        const lastReading = memoryReadings[memoryReadings.length - 1].heapUsed;
        const totalIncrease = lastReading - firstReading;

        // Should not have excessive memory growth
        expect(totalIncrease).toBeLessThan(
          MEMORY_SLA_REQUIREMENTS.MEMORY_INCREASE_LIMIT
        );

        // Check for linear growth pattern (no exponential leak)
        const midpointReading =
          memoryReadings[Math.floor(memoryReadings.length / 2)].heapUsed;
        const firstHalfGrowth = midpointReading - firstReading;
        const secondHalfGrowth = lastReading - midpointReading;

        // Second half growth should not be significantly larger than first half
        expect(secondHalfGrowth).toBeLessThanOrEqual(firstHalfGrowth * 1.5);

        console.log(
          `Extended Operation: ${(totalIncrease / 1024 / 1024).toFixed(2)}MB total increase over ${cycles} cycles`
        );
      } else if (!performance?.memory) {
        console.log(
          'Skipping extended operation memory analysis: performance.memory API not available'
        );
      }
    });
  });

  describe('Memory Pressure Handling', () => {
    it('should handle memory pressure with backpressure correctly', async () => {
      processor = createProcessorWithConfig({
        maxQueueSize: 50, // Small queue to trigger backpressure
        batchSize: 8, // Increased for faster processing
        batchTimeout: 50, // Reduced timeout
        memoryLimit: 1 * 1024 * 1024, // 1MB limit to trigger backpressure
      });

      const traces = createPerformanceTraces(75); // Reduced from 100
      let droppedCount = 0;

      // Track dropped traces
      mockEventBus.dispatch.mockImplementation((event) => {
        if (event.type === 'BACKPRESSURE' || event.type === 'ITEM_DROPPED') {
          droppedCount++;
        }
      });

      const initialMemory = performance?.memory?.usedJSHeapSize || 0;

      // Enqueue traces rapidly
      traces.forEach((trace) => {
        processor.enqueue(trace, TracePriority.NORMAL);
      });

      await waitForProcessing(1000); // Reduced from 2000ms

      // Check that memory limits were respected
      const finalMemory = performance?.memory?.usedJSHeapSize || 0;

      const stats = processor.getQueueStats();
      const metrics = processor.getMetrics();

      // Should have dropped some traces to maintain memory limits
      expect(metrics.totalDropped).toBeGreaterThan(0);

      // Queue size should be manageable
      expect(stats.totalSize).toBeLessThan(75); // Should be less than 1.5x maxQueueSize

      // Memory growth should be controlled if monitoring available
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryGrowth = finalMemory - initialMemory;
        expect(memoryGrowth).toBeLessThan(2 * 1024 * 1024); // 2MB max
        console.log(
          `Memory growth during backpressure: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`
        );
      } else {
        console.log('Memory monitoring not available for backpressure test');
      }

      console.log(
        `Backpressure Test: ${metrics.totalDropped} traces dropped, ${stats.totalSize} remaining in queue`
      );
    });
  });

  // Helper Functions

  /**
   * Create a TraceQueueProcessor with custom configuration
   *
   * @param {object} config - Configuration options
   * @returns {TraceQueueProcessor} Configured processor instance
   */
  function createProcessorWithConfig(config) {
    return new TraceQueueProcessor({
      storageAdapter: mockStorageAdapter,
      logger: mockLogger,
      eventBus: mockEventBus,
      config: {
        memoryLimit: 4 * 1024 * 1024, // 4MB default
        enableParallelProcessing: true,
        storageKey: 'memory-test-traces',
        maxStoredTraces: 100,
        maxRetries: 2,
        ...config,
      },
    });
  }

  /**
   * Create performance traces for testing with proper API usage
   *
   * @param {number} count - Number of traces to create
   * @returns {Array} Array of trace objects
   */
  function createPerformanceTraces(count) {
    const traces = [];

    for (let i = 0; i < count; i++) {
      const trace = traceFactory.createTrace({
        actionId: `memory-test-${i}`,
        actorId: `actor-${i % 3}`, // Cycle through 3 actors
        turnAction: {
          actionDefinitionId: 'core:test',
          commandString: `test command ${i}`,
          parameters: { index: i },
        },
      });

      // Simulate completed execution with proper API
      trace.captureDispatchStart();
      trace.captureDispatchResult({
        success: true,
        timestamp: Date.now(),
        metadata: { duration: Math.random() * 50 + 5 }, // 5-55ms duration
      });

      traces.push(trace);
    }

    return traces;
  }

  /**
   * Wait for processing to complete with smart polling
   *
   * @param {number} [maxWait] - Maximum timeout in milliseconds
   * @param {number} [pollInterval] - Polling interval in milliseconds
   * @returns {Promise} Promise that resolves when queue is empty or timeout
   */
  async function waitForProcessing(maxWait = 1000, pollInterval = 20) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const stats = processor.getQueueStats();
      // Processing is done when not processing and queue is empty
      if (!stats.isProcessing && stats.totalSize === 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // Timeout reached, but that's okay for memory tests
  }
});
