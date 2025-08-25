/**
 * @file Memory tests for action tracing system
 * @description Tests memory usage patterns and leak detection for trace output services
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { ActionTraceOutputService } from '../../../../src/actions/tracing/actionTraceOutputService.js';
import {
  createMockJsonFormatter,
  createMockHumanReadableFormatterWithOptions,
} from '../../../common/mockFactories/actionTracing.js';

describe('Action Tracing - Memory Tests', () => {
  let testBed;
  let outputService;
  let originalFetch;

  beforeEach(async () => {
    testBed = createTestBed();

    // Mock fetch to simulate successful server writes
    originalFetch = global.fetch;
    global.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            path: './traces/memory-test/mock-trace.json',
            size: 1024,
            fileName: 'mock-trace.json',
          }),
      });
    });

    const config = {
      outputFormats: ['json', 'text'],
      textFormatOptions: {
        lineWidth: 120,
        indentSize: 2,
      },
    };

    outputService = new ActionTraceOutputService({
      jsonFormatter: createMockJsonFormatter(),
      humanReadableFormatter: createMockHumanReadableFormatterWithOptions(),
      logger: testBed.mockLogger,
      actionTraceConfig: config,
      outputToFiles: true,
      outputDirectory: './traces/memory-test',
    });

    // Force garbage collection before each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  afterEach(async () => {
    testBed.cleanup();

    // Restore original fetch
    if (originalFetch) {
      global.fetch = originalFetch;
    }

    // Force garbage collection after each test
    await global.memoryTestUtils.forceGCAndWait();
  });

  describe('Extended Operation Memory Management', () => {
    it('should handle memory efficiently during extended trace generation', async () => {
      const totalTraces = global.memoryTestUtils.isCI() ? 300 : 500;
      const batchSize = 25;
      const batches = totalTraces / batchSize;

      // Measure initial memory with stabilization
      await global.memoryTestUtils.forceGCAndWait();
      const initialMemory = await global.memoryTestUtils.getStableMemoryUsage();

      const memorySnapshots = [];
      let totalProcessed = 0;

      for (let batch = 0; batch < batches; batch++) {
        const traces = await Promise.all(
          Array.from({ length: batchSize }, async (_, i) =>
            testBed.createActionAwareTrace({
              actorId: `memory-test-${batch}-${i}`,
              tracedActions: [`memory_action_${batch * batchSize + i}`],
            })
          )
        );

        // Process traces
        for (const trace of traces) {
          await outputService.writeTrace(trace);
          totalProcessed++;
        }

        // Take memory snapshot every few batches
        if (batch % 4 === 0) {
          await global.memoryTestUtils.forceGCAndWait();
          const currentMemory =
            await global.memoryTestUtils.getStableMemoryUsage();
          memorySnapshots.push({
            batch,
            heapUsed: currentMemory,
            processed: totalProcessed,
          });
        }
      }

      // Final memory measurement with stabilization
      await global.memoryTestUtils.forceGCAndWait();
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Calculate memory metrics
      const totalMemoryIncrease = finalMemory - initialMemory;
      const memoryPerTrace = totalMemoryIncrease / totalProcessed;

      console.log('Extended operation memory analysis:');
      console.log(`  Total traces processed: ${totalProcessed}`);
      console.log(
        `  Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(
        `  Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(
        `  Total memory increase: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(`  Memory per trace: ${memoryPerTrace.toFixed(0)} bytes`);

      // Memory efficiency assertions with CI-aware thresholds
      const maxMemoryPerTrace = global.memoryTestUtils.isCI() ? 150000 : 100000; // 150KB/100KB per trace
      const maxTotalIncrease = global.memoryTestUtils.getMemoryThreshold(100); // 100MB base threshold

      expect(Math.abs(memoryPerTrace)).toBeLessThan(maxMemoryPerTrace);
      expect(Math.abs(totalMemoryIncrease)).toBeLessThan(maxTotalIncrease);

      // Check for memory leak patterns using snapshots
      if (memorySnapshots.length >= 2) {
        const earlySnapshot = memorySnapshots[0];
        const lateSnapshot = memorySnapshots[memorySnapshots.length - 1];

        const memoryGrowthRate =
          (lateSnapshot.heapUsed - earlySnapshot.heapUsed) /
          (lateSnapshot.processed - earlySnapshot.processed);

        console.log(
          `  Memory growth rate: ${memoryGrowthRate.toFixed(0)} bytes/trace`
        );

        // Memory growth rate check - handle both positive and negative values
        // Negative values indicate memory was freed (good!)
        // Only positive values above threshold indicate potential leaks
        const maxGrowthRate = global.memoryTestUtils.isCI() ? 100000 : 50000; // 100KB/50KB growth per trace

        if (memoryGrowthRate > 0) {
          expect(memoryGrowthRate).toBeLessThan(maxGrowthRate);
        }
        // Negative growth rate is always acceptable (memory being freed)
      }
    });

    it('should not accumulate memory when processing traces in batches', async () => {
      const batchCount = global.memoryTestUtils.isCI() ? 5 : 10;
      const tracesPerBatch = 50;

      // Establish baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      const batchMemories = [];

      for (let i = 0; i < batchCount; i++) {
        // Create and process batch
        const traces = await Promise.all(
          Array.from({ length: tracesPerBatch }, async (_, j) =>
            testBed.createActionAwareTrace({
              actorId: `batch-${i}-actor-${j}`,
              tracedActions: [`batch_${i}_action_${j}`],
            })
          )
        );

        await Promise.all(
          traces.map((trace) => outputService.writeTrace(trace))
        );

        // Measure memory after each batch
        await global.memoryTestUtils.forceGCAndWait();
        const batchMemory = await global.memoryTestUtils.getStableMemoryUsage();
        batchMemories.push(batchMemory);

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Check that memory doesn't continuously grow
      const firstBatchMemory = batchMemories[0];
      const lastBatchMemory = batchMemories[batchMemories.length - 1];
      const memoryGrowth = lastBatchMemory - firstBatchMemory;

      console.log('Batch processing memory analysis:');
      console.log(
        `  Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(
        `  First batch: ${(firstBatchMemory / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(
        `  Last batch: ${(lastBatchMemory / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(`  Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);

      // Memory should not grow significantly between batches
      const maxBatchGrowth = global.memoryTestUtils.getMemoryThreshold(25); // 25MB base threshold
      expect(Math.abs(memoryGrowth)).toBeLessThan(maxBatchGrowth);
    });

    it('should release memory after trace processing completes', async () => {
      const traceCount = global.memoryTestUtils.isCI() ? 200 : 400;

      // Baseline
      await global.memoryTestUtils.forceGCAndWait();
      const baselineMemory =
        await global.memoryTestUtils.getStableMemoryUsage();

      // Create and hold references to traces
      const traces = await Promise.all(
        Array.from({ length: traceCount }, async (_, i) =>
          testBed.createActionAwareTrace({
            actorId: `release-test-${i}`,
            tracedActions: [`release_action_${i}`],
          })
        )
      );

      // Process all traces
      await Promise.all(traces.map((trace) => outputService.writeTrace(trace)));

      // Measure peak memory
      const peakMemory = await global.memoryTestUtils.getStableMemoryUsage();

      // Clear references and wait for cleanup
      traces.length = 0;
      await outputService.waitForPendingWrites();
      await global.memoryTestUtils.forceGCAndWait();

      // Measure final memory
      const finalMemory = await global.memoryTestUtils.getStableMemoryUsage();

      const peakGrowth = peakMemory - baselineMemory;
      const residualMemory = finalMemory - baselineMemory;
      const memoryReleased = peakGrowth - residualMemory;

      console.log('Memory release analysis:');
      console.log(
        `  Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(`  Peak: ${(peakMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Final: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Peak growth: ${(peakGrowth / 1024 / 1024).toFixed(2)} MB`);
      console.log(
        `  Residual: ${(residualMemory / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(
        `  Released: ${(memoryReleased / 1024 / 1024).toFixed(2)} MB`
      );

      // Most memory should be released after cleanup
      const maxResidual = global.memoryTestUtils.getMemoryThreshold(20); // 20MB base threshold
      expect(Math.abs(residualMemory)).toBeLessThan(maxResidual);

      // At least 40% of peak memory should be released
      // Note: JavaScript's garbage collection may retain memory for performance
      if (peakGrowth > 0) {
        const releaseRatio = memoryReleased / peakGrowth;
        expect(releaseRatio).toBeGreaterThan(0.4);
      }
    });
  });
});
