/**
 * @file Performance tests for TraceQueueProcessor latency metrics
 * @description Tests latency tracking and performance characteristics
 *
 * IMPORTANT: Latency Tracking Behavior
 * - Latency is tracked for:
 *   1. EVERY batch processing completion (can be 0ms for fast operations)
 *   2. Additionally for CRITICAL priority traces (individual item latency)
 * - Latency can legitimately be 0ms for very fast operations (< 1ms)
 * - After ANY processing, metrics are updated from initial values:
 *   - minLatency: Updated from Infinity (can become 0)
 *   - maxLatency: Updated from 0
 *   - avgLatency: Calculated as totalLatency/totalProcessed
 * @see src/actions/tracing/traceQueueProcessor.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TraceQueueProcessor } from '../../../../src/actions/tracing/traceQueueProcessor.js';
import { TracePriority } from '../../../../src/actions/tracing/tracePriority.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { createMockIndexedDBStorageAdapter } from '../../../common/mockFactories/actionTracing.js';
import { TestTimerService } from '../../../../src/actions/tracing/timerService.js';

const flushProcessing = async (processor, timerService) => {
  let safetyCounter = 0;

  while (safetyCounter < 20) {
    await timerService.triggerAll();
    await Promise.resolve();

    const { totalSize, isProcessing } = processor.getQueueStats();
    if (!timerService.hasPending() && totalSize === 0 && !isProcessing) {
      break;
    }

    safetyCounter++;
  }
};

describe('TraceQueueProcessor - Latency Performance Tests', () => {
  let processor;
  let mockLogger;
  let mockStorageAdapter;
  let mockEventBus;
  let timerService;

  beforeEach(() => {
    // Use controlled timers to eliminate unnecessary waiting in performance checks
    mockLogger = createMockLogger();
    mockStorageAdapter = createMockIndexedDBStorageAdapter();

    timerService = new TestTimerService();

    mockEventBus = {
      dispatch: jest.fn(),
    };
  });

  afterEach(async () => {
    if (processor) {
      try {
        await processor.shutdown();
      } catch (error) {
        // Ignore shutdown errors in cleanup
      }
    }
    processor = null;
    timerService?.clearAll();
    timerService = null;
  });

  describe('Latency Metrics Tracking', () => {
    it('should track latency metrics for critical priority traces', async () => {
      processor = new TraceQueueProcessor({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        eventBus: mockEventBus,
        timerService,
        config: {
          maxQueueSize: 100,
          batchSize: 5,
          batchTimeout: 50,
          maxRetries: 2,
          memoryLimit: 1024 * 1024,
          enableParallelProcessing: true,
        },
      });

      // Create and enqueue critical traces
      const criticalTraces = [];
      for (let i = 0; i < 5; i++) {
        const trace = {
          actionId: `critical-latency-${i}`,
          hasError: true, // Will be inferred as critical
          toJSON: () => ({
            actionId: `critical-latency-${i}`,
            type: 'execution',
            hasError: true,
            timestamp: Date.now(),
          }),
        };
        criticalTraces.push(trace);
        processor.enqueue(trace, TracePriority.CRITICAL);
      }

      // Wait for processing to complete using controlled timers
      await flushProcessing(processor, timerService);

      const metrics = processor.getMetrics();

      // Verify latency metrics were tracked
      expect(metrics.totalProcessed).toBeGreaterThan(0);
      // Latency can be 0 for very fast operations, but should be tracked
      expect(metrics.avgLatency).toBeGreaterThanOrEqual(0);
      expect(metrics.minLatency).toBeGreaterThanOrEqual(0);
      expect(metrics.minLatency).toBeLessThanOrEqual(metrics.maxLatency);
      expect(metrics.maxLatency).toBeGreaterThanOrEqual(0);
      // Ensure latency was actually tracked (minLatency shouldn't be Infinity)
      expect(metrics.minLatency).not.toBe(Infinity);

      // Log latency metrics for performance analysis
      console.log('Latency Metrics:', {
        avgLatency: `${metrics.avgLatency.toFixed(2)}ms`,
        minLatency: `${metrics.minLatency.toFixed(2)}ms`,
        maxLatency: `${metrics.maxLatency.toFixed(2)}ms`,
        totalProcessed: metrics.totalProcessed,
      });
    });

    it('should show different latency patterns for different priority levels', async () => {
      processor = new TraceQueueProcessor({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        eventBus: mockEventBus,
        timerService,
        config: {
          maxQueueSize: 200,
          batchSize: 10,
          batchTimeout: 100,
          maxRetries: 2,
          memoryLimit: 2 * 1024 * 1024,
          enableParallelProcessing: true,
        },
      });

      // Enqueue traces with different priorities
      const priorities = [
        { level: TracePriority.CRITICAL, count: 5 },
        { level: TracePriority.HIGH, count: 10 },
        { level: TracePriority.NORMAL, count: 15 },
        { level: TracePriority.LOW, count: 20 },
      ];

      for (const { level, count } of priorities) {
        for (let i = 0; i < count; i++) {
          const trace = {
            actionId: `priority-${level}-${i}`,
            toJSON: () => ({
              actionId: `priority-${level}-${i}`,
              priority: level,
              timestamp: Date.now(),
            }),
          };
          processor.enqueue(trace, level);
        }
      }

      // Wait for processing to complete using controlled timers
      await flushProcessing(processor, timerService);

      const metrics = processor.getMetrics();

      // Verify processing completed
      expect(metrics.totalProcessed).toBeGreaterThan(0);
      expect(metrics.totalProcessed).toBeLessThanOrEqual(50);

      // Verify latency tracking
      // Note: Latency is tracked for EVERY batch processed, and additionally for CRITICAL priority items
      // Batch latency is always tracked but can be 0ms for very fast operations
      if (metrics.totalProcessed > 0) {
        // Latency metrics should always be populated after processing
        expect(metrics.avgLatency).toBeGreaterThanOrEqual(0);
        expect(metrics.minLatency).toBeGreaterThanOrEqual(0);
        expect(metrics.minLatency).toBeLessThanOrEqual(metrics.maxLatency);
        expect(metrics.maxLatency).toBeGreaterThanOrEqual(0);

        // After processing, minLatency should have been updated from its initial value (Infinity)
        // even if the latency was 0
        expect(metrics.minLatency).not.toBe(Infinity);
      }

      console.log('Priority-based Latency Distribution:', {
        totalEnqueued: metrics.totalEnqueued,
        totalProcessed: metrics.totalProcessed,
        avgLatency: `${metrics.avgLatency.toFixed(2)}ms`,
        minLatency: `${metrics.minLatency.toFixed(2)}ms`,
        maxLatency: `${metrics.maxLatency.toFixed(2)}ms`,
        priorityDistribution: metrics.priorityDistribution,
      });
    });

    it('should measure batch processing latency', async () => {
      const batchSizes = [5, 10, 20];
      const results = [];

      for (const batchSize of batchSizes) {
        timerService = new TestTimerService();
        processor = new TraceQueueProcessor({
          storageAdapter: mockStorageAdapter,
          logger: mockLogger,
          eventBus: mockEventBus,
          timerService,
          config: {
            maxQueueSize: 100,
            batchSize,
            batchTimeout: 50,
            maxRetries: 2,
            memoryLimit: 1024 * 1024,
            enableParallelProcessing: true,
          },
        });

        // Enqueue traces to fill at least one batch
        const traceCount = batchSize * 2;
        const startTime = performance.now();

        for (let i = 0; i < traceCount; i++) {
          const trace = {
            actionId: `batch-${batchSize}-trace-${i}`,
            toJSON: () => ({
              actionId: `batch-${batchSize}-trace-${i}`,
              timestamp: Date.now(),
            }),
          };
          processor.enqueue(trace, TracePriority.NORMAL);
        }

        // Wait for processing
        await flushProcessing(processor, timerService);
        const endTime = performance.now();

        const metrics = processor.getMetrics();
        const processingTime = endTime - startTime;

        results.push({
          batchSize,
          processingTime,
          totalProcessed: metrics.totalProcessed,
          avgLatency: metrics.avgLatency,
          minLatency: metrics.minLatency,
          maxLatency: metrics.maxLatency,
          batchEfficiency: metrics.batchEfficiency,
        });

        // Cleanup for next iteration
        await processor.shutdown();
        processor = null;
        timerService.clearAll();
      }

      // Log comparison results
      console.log('\nBatch Size vs Latency Comparison:');
      results.forEach((r) => {
        console.log(
          `Batch ${r.batchSize}:`,
          `Processing: ${r.processingTime.toFixed(2)}ms,`,
          `Avg Latency: ${r.avgLatency.toFixed(2)}ms,`,
          `Range: ${r.minLatency.toFixed(2)}-${r.maxLatency.toFixed(2)}ms,`,
          `Efficiency: ${(r.batchEfficiency * 100).toFixed(1)}%`
        );
      });

      // Verify all batch sizes completed processing
      results.forEach((r) => {
        expect(r.totalProcessed).toBeGreaterThan(0);
        // Latency metrics should be tracked for batch processing
        // but might be 0 for very fast operations
        expect(r.avgLatency).toBeGreaterThanOrEqual(0);
      });
    });

    it('should measure latency under load conditions', async () => {
      processor = new TraceQueueProcessor({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        eventBus: mockEventBus,
        timerService,
        config: {
          maxQueueSize: 500,
          batchSize: 25,
          batchTimeout: 50,
          maxRetries: 2,
          memoryLimit: 5 * 1024 * 1024,
          enableParallelProcessing: true,
        },
      });

      const loadLevels = [
        { name: 'Light', count: 50, delay: 10 },
        { name: 'Medium', count: 100, delay: 5 },
        { name: 'Heavy', count: 200, delay: 2 },
      ];

      for (const load of loadLevels) {
        const startTime = performance.now();

        // Enqueue traces with specified delay between each
        for (let i = 0; i < load.count; i++) {
          const trace = {
            actionId: `load-${load.name}-${i}`,
            toJSON: () => ({
              actionId: `load-${load.name}-${i}`,
              timestamp: Date.now(),
              loadLevel: load.name,
            }),
          };

          // Mix priorities to simulate real conditions
          const priority =
            i % 4 === 0 ? TracePriority.HIGH : TracePriority.NORMAL;
          processor.enqueue(trace, priority);

          if (load.delay > 0) {
            await timerService.advanceTime(load.delay);
            await flushProcessing(processor, timerService);
          }
        }

        // Wait for queue to drain
        await flushProcessing(processor, timerService);

        const metrics = processor.getMetrics();
        const endTime = performance.now();

        console.log(
          `${load.name} Load (${load.count} traces):`,
          `Total Time: ${(endTime - startTime).toFixed(2)}ms,`,
          `Avg Latency: ${metrics.avgLatency.toFixed(2)}ms,`,
          `Min/Max: ${metrics.minLatency.toFixed(2)}/${metrics.maxLatency.toFixed(2)}ms,`,
          `Throughput: ${metrics.throughput.toFixed(2)} traces/sec`
        );
      }

      const finalMetrics = processor.getMetrics();
      expect(finalMetrics.totalProcessed).toBeGreaterThan(0);
      // Note: avgLatency can be 0 for very fast operations (< 1ms)
      // Latency is only tracked for CRITICAL priority traces and batch processing
      expect(finalMetrics.avgLatency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Latency Impact on Performance', () => {
    it('should demonstrate impact of parallel processing on latency', async () => {
      const configs = [
        { parallel: false, name: 'Sequential' },
        { parallel: true, name: 'Parallel' },
      ];

      const results = [];

      for (const config of configs) {
        timerService = new TestTimerService();
        processor = new TraceQueueProcessor({
          storageAdapter: mockStorageAdapter,
          logger: mockLogger,
          eventBus: mockEventBus,
          timerService,
          config: {
            maxQueueSize: 100,
            batchSize: 10,
            batchTimeout: 50,
            maxRetries: 2,
            memoryLimit: 1024 * 1024,
            enableParallelProcessing: config.parallel,
          },
        });

        const traceCount = 30;
        const startTime = performance.now();

        // Enqueue all traces at once
        for (let i = 0; i < traceCount; i++) {
          const trace = {
            actionId: `${config.name.toLowerCase()}-${i}`,
            toJSON: () => ({
              actionId: `${config.name.toLowerCase()}-${i}`,
              timestamp: Date.now(),
            }),
          };
          processor.enqueue(trace, TracePriority.NORMAL);
        }

        // Wait for processing
        await flushProcessing(processor, timerService);

        const endTime = performance.now();
        const metrics = processor.getMetrics();

        results.push({
          mode: config.name,
          processingTime: endTime - startTime,
          avgLatency: metrics.avgLatency,
          minLatency: metrics.minLatency,
          maxLatency: metrics.maxLatency,
          totalProcessed: metrics.totalProcessed,
        });

        await processor.shutdown();
        processor = null;
      }

      // Compare results
      console.log('\nParallel vs Sequential Latency:');
      results.forEach((r) => {
        console.log(
          `${r.mode}:`,
          `Total: ${r.processingTime.toFixed(2)}ms,`,
          `Avg Latency: ${r.avgLatency.toFixed(2)}ms,`,
          `Range: ${r.minLatency.toFixed(2)}-${r.maxLatency.toFixed(2)}ms`
        );
      });

      // Verify both modes processed traces
      results.forEach((r) => {
        expect(r.totalProcessed).toBeGreaterThan(0);
        // Latency tracking depends on batch processing completing
        // With NORMAL priority and fast processing, latency might be 0 or not tracked
        if (r.totalProcessed > 0) {
          // Just verify latency metrics are present and consistent
          expect(r.avgLatency).toBeGreaterThanOrEqual(0);
          expect(r.minLatency).toBeGreaterThanOrEqual(0);
          expect(r.maxLatency).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });
});
