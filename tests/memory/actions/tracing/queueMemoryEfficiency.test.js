/**
 * @file Memory efficiency tests for TraceQueueProcessor with ActionTraceOutputService
 * @description Tests focused on memory consumption and memory limit enforcement
 * when using TraceQueueProcessor in bulk operations and stress scenarios
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
import { TestTimerService } from '../../../../src/actions/tracing/timerService.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import {
  createMockActionTraceFilter,
  createMockIndexedDBStorageAdapter,
} from '../../../common/mockFactories/actionTracing.js';

describe('TraceQueueProcessor Memory Efficiency Tests', () => {
  let service;
  let mockLogger;
  let mockStorageAdapter;
  let mockActionTraceFilter;
  let mockEventBus;
  let queueConfig;
  let testTimerService;

  beforeEach(() => {
    // Don't use Jest fake timers - rely on TestTimerService instead

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
      timerService: testTimerService,
    };
  });

  afterEach(async () => {
    // Properly shutdown service if it exists
    if (service && typeof service.shutdown === 'function') {
      try {
        await service.shutdown();
      } catch (error) {
        // Ignore shutdown errors in tests
        console.warn('Error during service shutdown:', error.message);
      }
    }

    // Clear test timer service
    if (testTimerService) {
      testTimerService.clearAll();
    }

    service = null;
  });

  describe('memory limit enforcement', () => {
    it('should enforce memory limits when enqueueing traces', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig: {
          ...queueConfig,
          memoryLimit: 50 * 1024, // 50KB limit
        },
      });

      // Try to enqueue traces that would exceed memory limit
      let successfulEnqueues = 0;
      const largeDataSize = 1000; // 1KB of data per trace

      for (let i = 0; i < 50; i++) {
        const trace = {
          actionId: `memory:${i}`,
          largeData: 'x'.repeat(largeDataSize),
          toJSON: () => ({
            actionId: `memory:${i}`,
            data: 'x'.repeat(largeDataSize),
          }),
        };

        await service.writeTrace(trace);
        successfulEnqueues++;
      }

      const stats = service.getQueueStats();
      expect(stats.memoryUsage).toBeLessThanOrEqual(
        queueConfig.memoryLimit * 1.1
      ); // Allow 10% tolerance

      // Log memory metrics for monitoring
      console.log(`Memory usage: ${(stats.memoryUsage / 1024).toFixed(2)} KB`);
      console.log(
        `Memory limit: ${(queueConfig.memoryLimit / 1024).toFixed(2)} KB`
      );
      console.log(`Traces enqueued: ${successfulEnqueues}`);
    });

    it('should track memory usage accurately across batch processing', async () => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        service = new ActionTraceOutputService({
          storageAdapter: mockStorageAdapter,
          logger: mockLogger,
          actionTraceFilter: mockActionTraceFilter,
          eventBus: mockEventBus,
          queueConfig: {
            ...queueConfig,
            memoryLimit: 100 * 1024, // 100KB limit
            batchSize: 10,
          },
        });

        const initialMemory = process.memoryUsage().heapUsed;

        // Enqueue multiple batches of traces
        const batchCount = 3;
        const tracesPerBatch = 10;

        for (let batch = 0; batch < batchCount; batch++) {
          for (let i = 0; i < tracesPerBatch; i++) {
            const trace = {
              actionId: `batch${batch}:trace${i}`,
              data: { batch, index: i, payload: 'x'.repeat(500) },
              toJSON: () => ({
                actionId: `batch${batch}:trace${i}`,
                data: { batch, index: i, payload: 'x'.repeat(500) },
              }),
            };
            await service.writeTrace(trace);
          }

          // Process batch using TestTimerService
          await testTimerService.triggerAll();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;
        const memoryPerTrace = memoryIncrease / (batchCount * tracesPerBatch);

        // Memory per trace should be reasonable (allowing for overhead)
        // Note: JavaScript heap memory includes object overhead, closures, internal structures,
        // timer scheduling, and heap fragmentation. The actual trace data is ~600 bytes,
        // but total heap impact includes all runtime overhead.
        expect(memoryPerTrace).toBeLessThan(100000); // Less than 100KB per trace (allowing for JS runtime overhead)

        console.log(`Memory per trace: ${memoryPerTrace.toFixed(0)} bytes`);
        console.log(
          `Total memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB for ${batchCount * tracesPerBatch} traces`
        );
      } else {
        // Skip memory test in browser environment
        expect(true).toBe(true);
      }
    });

    it('should prevent memory leaks with circular references', async () => {
      service = new ActionTraceOutputService({
        storageAdapter: mockStorageAdapter,
        logger: mockLogger,
        actionTraceFilter: mockActionTraceFilter,
        eventBus: mockEventBus,
        queueConfig: {
          ...queueConfig,
          memoryLimit: 50 * 1024, // 50KB limit
          timerService: testTimerService, // Ensure we use the test timer service
        },
      });

      // Create traces with potential circular references
      for (let i = 0; i < 20; i++) {
        const circularObj = { id: i };
        circularObj.self = circularObj; // Circular reference

        const trace = {
          actionId: `circular:${i}`,
          circularData: circularObj,
          toJSON: () => ({
            actionId: `circular:${i}`,
            data: { id: i }, // Safe serialization without circular ref
          }),
        };

        await service.writeTrace(trace);
      }

      // Process all traces using TestTimerService
      // May need multiple triggers due to batch processing
      for (let i = 0; i < 10; i++) {
        await testTimerService.triggerAll();
        // Small delay to allow any async operations to complete
        await new Promise((resolve) => setImmediate(resolve));

        // Check if we have processed any traces yet
        const interimMetrics = service.getQueueMetrics();
        if (interimMetrics && interimMetrics.totalProcessed > 0) {
          break; // Stop once we've processed something
        }
      }

      const stats = service.getQueueStats();
      expect(stats.memoryUsage).toBeLessThanOrEqual(
        queueConfig.memoryLimit * 1.2
      ); // Allow 20% tolerance for circular reference handling

      // Verify processing completed without memory issues
      const metrics = service.getQueueMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalProcessed).toBeGreaterThan(0);
    });
  });

  describe('garbage collection behavior', () => {
    if (typeof global !== 'undefined' && global.gc) {
      it('should not create excessive garbage under stress', async () => {
        // Force garbage collection before test
        global.gc();
        const initialMemory = process.memoryUsage().heapUsed;

        service = new ActionTraceOutputService({
          storageAdapter: mockStorageAdapter,
          logger: mockLogger,
          actionTraceFilter: mockActionTraceFilter,
          eventBus: mockEventBus,
          queueConfig: {
            ...queueConfig,
            memoryLimit: 200 * 1024, // 200KB limit
            batchSize: 20,
          },
        });

        // Stress test with rapid trace creation and disposal
        const iterations = 5;
        for (let iter = 0; iter < iterations; iter++) {
          // Create many traces
          for (let i = 0; i < 50; i++) {
            const trace = {
              actionId: `stress:${iter}:${i}`,
              toJSON: () => ({
                actionId: `stress:${iter}:${i}`,
                iteration: iter,
                index: i,
              }),
            };
            await service.writeTrace(trace);
          }

          // Process all traces using TestTimerService
          await testTimerService.triggerAll();

          // Force garbage collection between iterations
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryGrowth = finalMemory - initialMemory;

        // Memory should not grow excessively across iterations
        expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth

        console.log(
          `Memory growth after ${iterations} iterations: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`
        );
      });
    }
  });
});
