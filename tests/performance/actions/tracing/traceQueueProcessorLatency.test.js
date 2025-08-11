/**
 * @file Performance tests for TraceQueueProcessor latency metrics
 * @description Tests latency tracking and performance characteristics
 * @see src/actions/tracing/traceQueueProcessor.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { TraceQueueProcessor } from '../../../../src/actions/tracing/traceQueueProcessor.js';
import { TracePriority } from '../../../../src/actions/tracing/tracePriority.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { createMockIndexedDBStorageAdapter } from '../../../common/mockFactories/actionTracing.js';

describe('TraceQueueProcessor - Latency Performance Tests', () => {
  let processor;
  let mockLogger;
  let mockStorageAdapter;
  let mockEventBus;

  beforeEach(() => {
    // Use real timers for performance measurements
    mockLogger = createMockLogger();
    mockStorageAdapter = createMockIndexedDBStorageAdapter();
    
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
  });

  describe('Latency Metrics Tracking', () => {
    it('should track latency metrics for critical priority traces', async () => {
      processor = new TraceQueueProcessor({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        eventBus: mockEventBus,
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

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = processor.getMetrics();
      
      // Verify latency metrics were tracked
      expect(metrics.totalProcessed).toBeGreaterThan(0);
      expect(metrics.avgLatency).toBeGreaterThan(0);
      expect(metrics.minLatency).toBeGreaterThan(0);
      expect(metrics.minLatency).toBeLessThanOrEqual(metrics.maxLatency);
      expect(metrics.maxLatency).toBeGreaterThan(0);
      
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

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const metrics = processor.getMetrics();
      
      // Verify processing completed
      expect(metrics.totalProcessed).toBeGreaterThan(0);
      expect(metrics.totalProcessed).toBeLessThanOrEqual(50);
      
      // Verify latency tracking
      expect(metrics.avgLatency).toBeGreaterThan(0);
      expect(metrics.minLatency).toBeGreaterThan(0);
      expect(metrics.minLatency).toBeLessThanOrEqual(metrics.maxLatency);
      expect(metrics.maxLatency).toBeGreaterThan(0);
      
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
        processor = new TraceQueueProcessor({
          storageAdapter: mockStorageAdapter,
          logger: mockLogger,
          eventBus: mockEventBus,
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
        await new Promise(resolve => setTimeout(resolve, 200));
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
      }

      // Log comparison results
      console.log('\nBatch Size vs Latency Comparison:');
      results.forEach(r => {
        console.log(`Batch ${r.batchSize}:`,
          `Processing: ${r.processingTime.toFixed(2)}ms,`,
          `Avg Latency: ${r.avgLatency.toFixed(2)}ms,`,
          `Range: ${r.minLatency.toFixed(2)}-${r.maxLatency.toFixed(2)}ms,`,
          `Efficiency: ${(r.batchEfficiency * 100).toFixed(1)}%`
        );
      });

      // Verify all batch sizes completed processing
      results.forEach(r => {
        expect(r.totalProcessed).toBeGreaterThan(0);
        expect(r.avgLatency).toBeGreaterThan(0);
      });
    });

    it('should measure latency under load conditions', async () => {
      processor = new TraceQueueProcessor({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        eventBus: mockEventBus,
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
          const priority = i % 4 === 0 ? TracePriority.HIGH : TracePriority.NORMAL;
          processor.enqueue(trace, priority);
          
          if (load.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, load.delay));
          }
        }
        
        // Wait for queue to drain
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const metrics = processor.getMetrics();
        const endTime = performance.now();
        
        console.log(`${load.name} Load (${load.count} traces):`,
          `Total Time: ${(endTime - startTime).toFixed(2)}ms,`,
          `Avg Latency: ${metrics.avgLatency.toFixed(2)}ms,`,
          `Min/Max: ${metrics.minLatency.toFixed(2)}/${metrics.maxLatency.toFixed(2)}ms,`,
          `Throughput: ${metrics.throughput.toFixed(2)} traces/sec`
        );
      }

      const finalMetrics = processor.getMetrics();
      expect(finalMetrics.totalProcessed).toBeGreaterThan(0);
      expect(finalMetrics.avgLatency).toBeGreaterThan(0);
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
        processor = new TraceQueueProcessor({
          storageAdapter: mockStorageAdapter,
          logger: mockLogger,
          eventBus: mockEventBus,
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
        await new Promise(resolve => setTimeout(resolve, 300));
        
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
      results.forEach(r => {
        console.log(`${r.mode}:`,
          `Total: ${r.processingTime.toFixed(2)}ms,`,
          `Avg Latency: ${r.avgLatency.toFixed(2)}ms,`,
          `Range: ${r.minLatency.toFixed(2)}-${r.maxLatency.toFixed(2)}ms`
        );
      });
      
      // Verify both modes processed traces
      results.forEach(r => {
        expect(r.totalProcessed).toBeGreaterThan(0);
        expect(r.avgLatency).toBeGreaterThan(0);
      });
    });
  });
});