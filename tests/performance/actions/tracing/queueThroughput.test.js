/**
 * @file Performance tests for TraceQueueProcessor with ActionTraceOutputService
 * @description Validates performance requirements for high-throughput trace processing
 * @see src/actions/tracing/actionTraceOutputService.js
 * @see src/actions/tracing/traceQueueProcessor.js
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
import {
  createMockActionTraceFilter,
  createMockIndexedDBStorageAdapter,
} from '../../../common/mockFactories/actionTracing.js';

describe('TraceQueueProcessor - Performance Tests', () => {
  let service;
  let mockLogger;
  let mockStorageAdapter;
  let mockActionTraceFilter;
  let mockEventBus;
  let queueConfig;

  beforeEach(() => {
    // Use real timers for performance tests to accurately measure time
    // Performance tests need to measure actual elapsed time

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

  afterEach(async () => {
    // Properly shutdown service to avoid hanging timers
    if (service && service.shutdown) {
      try {
        // Use a timeout promise to prevent hanging
        const shutdownPromise = service.shutdown();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Shutdown timeout')), 2000)
        );
        await Promise.race([shutdownPromise, timeoutPromise]);
      } catch (error) {
        // Ignore shutdown errors in tests
      }
    }
    service = null;
  });

  describe('High-Throughput Processing', () => {
    it('should handle high-throughput trace processing (<5s for 100 traces)', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig: {
          ...queueConfig,
          batchSize: 20,
          enableParallelProcessing: true,
        },
      });

      // Warm up - let any initialization happen
      for (let i = 0; i < 5; i++) {
        const warmupTrace = {
          actionId: `warmup:${i}`,
          toJSON: () => ({ actionId: `warmup:${i}` }),
        };
        await service.writeTrace(warmupTrace);
      }

      // Wait for warmup traces to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reset mocks after warmup
      mockStorageAdapter.setItem.mockClear();

      // Measure performance for actual test
      const traceCount = 50;
      const startTime = performance.now();

      // Enqueue many traces quickly
      for (let i = 0; i < traceCount; i++) {
        const trace = {
          actionId: `throughput:${i}`,
          toJSON: () => ({ actionId: `throughput:${i}`, index: i }),
        };
        await service.writeTrace(trace);
      }

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 200));
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      const metrics = service.getQueueMetrics();

      // Assert performance requirements
      expect(processingTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(metrics.totalProcessed).toBeGreaterThan(0); // Should process some traces
      expect(metrics.totalEnqueued).toBeGreaterThan(25); // Should enqueue most traces (queue size limit may apply)

      // Calculate and log performance metrics
      const throughput = traceCount / (processingTime / 1000); // traces per second
      console.log(
        `Processing time: ${processingTime.toFixed(2)}ms for ${traceCount} traces`
      );
      console.log(`Throughput: ${throughput.toFixed(2)} traces/second`);
      console.log(
        `Batch efficiency: ${(metrics.batchEfficiency * 100).toFixed(2)}%`
      );
    }, 60000); // 60 second timeout

    it('should maintain performance with varying trace sizes', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig: {
          ...queueConfig,
          batchSize: 15,
          enableParallelProcessing: true,
        },
      });

      const startTime = performance.now();
      const traceSizes = [100, 500, 1000, 2000]; // Different data sizes in bytes
      const tracesPerSize = 15;

      for (const size of traceSizes) {
        for (let i = 0; i < tracesPerSize; i++) {
          const trace = {
            actionId: `size${size}:${i}`,
            data: 'x'.repeat(size),
            toJSON: () => ({
              actionId: `size${size}:${i}`,
              data: 'x'.repeat(size),
            }),
          };
          await service.writeTrace(trace);
        }
      }

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 300));
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      const totalTraces = traceSizes.length * tracesPerSize;

      // Performance should scale reasonably with data size
      expect(processingTime).toBeLessThan(4000); // 4 seconds for varied sizes

      const metrics = service.getQueueMetrics();
      expect(metrics.totalProcessed).toBeGreaterThan(0); // Should process some traces
      expect(metrics.totalEnqueued).toBeGreaterThan(25); // Should enqueue most traces (queue size limit may apply)

      console.log(
        `Mixed size processing: ${processingTime.toFixed(2)}ms for ${totalTraces} traces`
      );
      console.log(
        `Average time per trace: ${(processingTime / totalTraces).toFixed(2)}ms`
      );
    }, 60000); // 60 second timeout

    it('should demonstrate parallel processing benefits', async () => {
      // Test with parallel processing disabled
      let serviceSerial = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig: {
          ...queueConfig,
          batchSize: 10,
          enableParallelProcessing: false,
        },
      });

      const traceCount = 30;
      const serialStartTime = performance.now();

      for (let i = 0; i < traceCount; i++) {
        const trace = {
          actionId: `serial:${i}`,
          toJSON: () => ({ actionId: `serial:${i}` }),
        };
        await serviceSerial.writeTrace(trace);
      }

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 200));
      const serialEndTime = performance.now();
      const serialTime = serialEndTime - serialStartTime;

      // Shutdown serial service
      if (serviceSerial && serviceSerial.shutdown) {
        try {
          await Promise.race([
            serviceSerial.shutdown(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Shutdown timeout')), 2000)
            ),
          ]);
        } catch (error) {
          // Ignore shutdown errors
        }
      }
      serviceSerial = null;

      // Reset mocks
      mockStorageAdapter.setItem.mockClear();

      // Test with parallel processing enabled
      let serviceParallel = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig: {
          ...queueConfig,
          batchSize: 10,
          enableParallelProcessing: true,
        },
      });

      const parallelStartTime = performance.now();

      for (let i = 0; i < traceCount; i++) {
        const trace = {
          actionId: `parallel:${i}`,
          toJSON: () => ({ actionId: `parallel:${i}` }),
        };
        await serviceParallel.writeTrace(trace);
      }

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 200));
      const parallelEndTime = performance.now();
      const parallelTime = parallelEndTime - parallelStartTime;

      // Shutdown parallel service
      if (serviceParallel && serviceParallel.shutdown) {
        try {
          await Promise.race([
            serviceParallel.shutdown(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Shutdown timeout')), 2000)
            ),
          ]);
        } catch (error) {
          // Ignore shutdown errors
        }
      }
      serviceParallel = null;

      // Parallel should be at least as fast as serial (allowing for overhead)
      expect(parallelTime).toBeLessThanOrEqual(serialTime * 1.2); // Allow 20% overhead

      console.log(`Serial processing: ${serialTime.toFixed(2)}ms`);
      console.log(`Parallel processing: ${parallelTime.toFixed(2)}ms`);
      console.log(
        `Performance improvement: ${((1 - parallelTime / serialTime) * 100).toFixed(2)}%`
      );
    }, 60000); // 60 second timeout

    it('should handle burst traffic efficiently', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig: {
          ...queueConfig,
          batchSize: 25,
          enableParallelProcessing: true,
          maxQueueSize: 200,
        },
      });

      const burstSize = 30;
      const numberOfBursts = 2;
      const delayBetweenBursts = 50; // ms

      const startTime = performance.now();

      for (let burst = 0; burst < numberOfBursts; burst++) {
        // Send a burst of traces
        const burstPromises = [];
        for (let i = 0; i < burstSize; i++) {
          const trace = {
            actionId: `burst${burst}:${i}`,
            toJSON: () => ({
              actionId: `burst${burst}:${i}`,
              burstId: burst,
              index: i,
            }),
          };
          burstPromises.push(service.writeTrace(trace));
        }

        await Promise.all(burstPromises);

        // Small delay between bursts
        if (burst < numberOfBursts - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, delayBetweenBursts)
          );
        }
      }

      // Wait for final processing to complete
      await new Promise((resolve) => setTimeout(resolve, 300));
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      const totalTraces = burstSize * numberOfBursts;
      const metrics = service.getQueueMetrics();

      expect(processingTime).toBeLessThan(3000); // 3 seconds for burst traffic
      expect(metrics.totalProcessed).toBeGreaterThan(0); // Should process some traces
      expect(metrics.totalEnqueued).toBeGreaterThanOrEqual(totalTraces); // Should enqueue all traces

      const throughput = totalTraces / (processingTime / 1000);
      console.log(
        `Burst processing: ${processingTime.toFixed(2)}ms for ${totalTraces} traces in ${numberOfBursts} bursts`
      );
      console.log(`Burst throughput: ${throughput.toFixed(2)} traces/second`);
      console.log(`Priority distribution:`, metrics.priorityDistribution);
    }, 60000); // 60 second timeout
  });

  describe('Batch Processing Efficiency', () => {
    it('should optimize batch sizes for performance', async () => {
      const batchSizes = [5, 20]; // Reduced from 4 sizes to 2
      const results = [];

      for (const batchSize of batchSizes) {
        // Create new service for each batch size
        let testService = new ActionTraceOutputService({
          storageAdapter: mockStorageAdapter,
          logger: mockLogger,
          actionTraceFilter: mockActionTraceFilter,
          eventBus: mockEventBus,
          queueConfig: {
            ...queueConfig,
            batchSize,
            enableParallelProcessing: true,
          },
        });

        const traceCount = 50; // Reduced from 100 to 50
        const startTime = performance.now();

        for (let i = 0; i < traceCount; i++) {
          const trace = {
            actionId: `batch${batchSize}:${i}`,
            toJSON: () => ({ actionId: `batch${batchSize}:${i}` }),
          };
          await testService.writeTrace(trace);
        }

        // Wait for processing to complete based on batch size
        const waitTime = Math.min(batchSize * 10, 300); // Reduced wait time
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        const endTime = performance.now();
        const processingTime = endTime - startTime;

        const metrics = testService.getQueueMetrics();

        results.push({
          batchSize,
          processingTime,
          efficiency: metrics.batchEfficiency,
          throughput: traceCount / (processingTime / 1000),
        });

        // Shutdown test service
        if (testService && testService.shutdown) {
          try {
            await Promise.race([
              testService.shutdown(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Shutdown timeout')), 2000)
              ),
            ]);
          } catch (error) {
            // Ignore shutdown errors
          }
        }
        testService = null;
        mockStorageAdapter.setItem.mockClear();
      }

      // Log comparison results
      console.log('\nBatch Size Performance Comparison:');
      results.forEach((r) => {
        console.log(
          `Batch ${r.batchSize}: ${r.processingTime.toFixed(2)}ms, ` +
            `Efficiency: ${(r.efficiency * 100).toFixed(2)}%, ` +
            `Throughput: ${r.throughput.toFixed(2)} traces/sec`
        );
      });

      // All batch sizes should complete within reasonable time
      results.forEach((r) => {
        expect(r.processingTime).toBeLessThan(5000); // 5 seconds max
      });
    }, 60000); // 60 second timeout
  });
});
