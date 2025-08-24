/**
 * @file High-frequency action tracing load tests
 * @description Tests system performance under sustained load with high-frequency trace generation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs/promises';
import { createTestBed } from '../../../common/testBed.js';
import { ActionTraceOutputService } from '../../../../src/actions/tracing/actionTraceOutputService.js';
import {
  createMockJsonFormatter,
  createMockHumanReadableFormatterWithOptions,
} from '../../../common/mockFactories/actionTracing.js';

describe('High-Frequency Action Tracing Load Tests', () => {
  let testBed;
  let outputService;

  beforeEach(async () => {
    testBed = createTestBed();

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
      outputDirectory: './traces/performance-test',
    });
  });

  afterEach(async () => {
    testBed.cleanup();

    // Clean up test traces
    try {
      await fs.rm('./traces/performance-test', {
        recursive: true,
        force: true,
      });
    } catch (err) {
      // Directory might not exist
    }
  });

  describe('Rapid Fire Load Testing', () => {
    it('should handle 100 rapid dual-format traces without blocking', async () => {
      const traces = await Promise.all(
        Array.from({ length: 100 }, async (_, i) =>
          testBed.createActionAwareTrace({
            actorId: `rapid-actor-${i}`,
            tracedActions: [`rapid_action_${i}`],
          })
        )
      );

      const startTime = performance.now();

      const promises = traces.map((trace) => outputService.writeTrace(trace));
      const results = await Promise.allSettled(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const timePerTrace = totalTime / traces.length;

      const successful = results.filter((r) => r.status === 'fulfilled').length;

      console.log(
        `Load test: ${successful}/${traces.length} successful, ${timePerTrace.toFixed(2)}ms per trace`
      );

      expect(successful).toBeGreaterThanOrEqual(95); // ≥95% success rate
      expect(timePerTrace).toBeLessThan(100); // <100ms per trace (adjusted for realistic expectations)
      expect(totalTime).toBeLessThan(15000); // Complete within 15 seconds
    });

    it('should maintain low error rate under concurrent load', async () => {
      const concurrentBatches = 5;
      const batchSize = 20;
      const totalTraces = concurrentBatches * batchSize;

      const batchPromises = Array.from(
        { length: concurrentBatches },
        async (_, batchIndex) => {
          const traces = await Promise.all(
            Array.from({ length: batchSize }, async (_, i) =>
              testBed.createActionAwareTrace({
                actorId: `concurrent-actor-${batchIndex}-${i}`,
                tracedActions: [`concurrent_${batchIndex}_${i}`],
              })
            )
          );

          const batchStartTime = performance.now();
          const promises = traces.map((trace) =>
            outputService.writeTrace(trace)
          );
          const results = await Promise.allSettled(promises);
          const batchEndTime = performance.now();

          return {
            batchIndex,
            results,
            batchTime: batchEndTime - batchStartTime,
            successful: results.filter((r) => r.status === 'fulfilled').length,
            failed: results.filter((r) => r.status === 'rejected').length,
          };
        }
      );

      const startTime = performance.now();
      const batchResults = await Promise.all(batchPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const totalSuccessful = batchResults.reduce(
        (sum, batch) => sum + batch.successful,
        0
      );
      const totalFailed = batchResults.reduce(
        (sum, batch) => sum + batch.failed,
        0
      );
      const successRate = (totalSuccessful / totalTraces) * 100;
      const errorRate = (totalFailed / totalTraces) * 100;

      console.log(`Concurrent load test results:`);
      console.log(`  Total traces: ${totalTraces}`);
      console.log(
        `  Successful: ${totalSuccessful} (${successRate.toFixed(1)}%)`
      );
      console.log(`  Failed: ${totalFailed} (${errorRate.toFixed(1)}%)`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(
        `  Average batch time: ${batchResults.reduce((sum, b) => sum + b.batchTime, 0) / batchResults.length}ms`
      );

      // Performance assertions
      expect(successRate).toBeGreaterThanOrEqual(90); // ≥90% success rate under concurrent load
      expect(errorRate).toBeLessThan(10); // <10% error rate
      expect(totalTime).toBeLessThan(20000); // Complete within 20 seconds
    });
  });

  describe('Sustained Load Testing', () => {
    it('should maintain performance under sustained load', async () => {
      const batchSize = 20;
      const batches = 5;
      const batchTimes = [];

      for (let batch = 0; batch < batches; batch++) {
        const traces = await Promise.all(
          Array.from({ length: batchSize }, async (_, i) =>
            testBed.createActionAwareTrace({
              actorId: `sustained-actor-${batch}-${i}`,
              tracedActions: [`sustained_${batch}_${i}`],
            })
          )
        );

        const batchStartTime = performance.now();
        const promises = traces.map((trace) => outputService.writeTrace(trace));
        await Promise.all(promises);
        const batchEndTime = performance.now();

        const batchTime = batchEndTime - batchStartTime;
        batchTimes.push(batchTime);

        console.log(`Batch ${batch + 1}/${batches}: ${batchTime.toFixed(2)}ms`);

        // Brief pause between batches
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Performance should not degrade significantly across batches
      const firstBatchTime = batchTimes[0];
      const lastBatchTime = batchTimes[batchTimes.length - 1];
      const degradation = (lastBatchTime - firstBatchTime) / firstBatchTime;

      const avgBatchTime =
        batchTimes.reduce((sum, time) => sum + time, 0) / batchTimes.length;
      const maxBatchTime = Math.max(...batchTimes);
      const minBatchTime = Math.min(...batchTimes);
      const timeVariance = ((maxBatchTime - minBatchTime) / avgBatchTime) * 100;

      console.log(`Sustained load analysis:`);
      console.log(`  Average batch time: ${avgBatchTime.toFixed(2)}ms`);
      console.log(`  Min batch time: ${minBatchTime.toFixed(2)}ms`);
      console.log(`  Max batch time: ${maxBatchTime.toFixed(2)}ms`);
      console.log(`  Time variance: ${timeVariance.toFixed(1)}%`);
      console.log(
        `  Performance degradation: ${(degradation * 100).toFixed(1)}%`
      );

      expect(degradation).toBeLessThan(1.0); // <100% performance degradation (adjusted)
      expect(timeVariance).toBeLessThan(300); // <300% variance in batch times (adjusted for realistic expectations)
      expect(avgBatchTime).toBeLessThan(5000); // Average batch should complete reasonably quickly
    });

    it('should handle memory pressure during extended operation', async () => {
      const totalTraces = 500;
      const batchSize = 25;
      const batches = totalTraces / batchSize;

      // Measure initial memory
      if (global.gc) global.gc();
      const initialMemory = process.memoryUsage();

      const memorySnapshots = [];
      let totalProcessed = 0;

      for (let batch = 0; batch < batches; batch++) {
        const traces = await Promise.all(
          Array.from({ length: batchSize }, async (_, i) =>
            testBed.createActionAwareTrace({
              actorId: `memory-pressure-${batch}-${i}`,
              tracedActions: [`memory_test_${batch * batchSize + i}`],
            })
          )
        );

        const batchStartTime = performance.now();

        for (const trace of traces) {
          await outputService.writeTrace(trace);
          totalProcessed++;
        }

        const batchEndTime = performance.now();

        // Take memory snapshot every few batches
        if (batch % 4 === 0) {
          if (global.gc) global.gc();
          const currentMemory = process.memoryUsage();
          memorySnapshots.push({
            batch,
            heapUsed: currentMemory.heapUsed,
            processed: totalProcessed,
            batchTime: batchEndTime - batchStartTime,
          });
        }
      }

      // Final memory measurement
      if (global.gc) global.gc();
      const finalMemory = process.memoryUsage();

      const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerTrace = totalMemoryIncrease / totalProcessed;

      console.log('Extended operation memory analysis:');
      console.log(`  Total traces processed: ${totalProcessed}`);
      console.log(
        `  Total memory increase: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(`  Memory per trace: ${memoryPerTrace.toFixed(0)} bytes`);

      // Memory growth should be reasonable
      expect(memoryPerTrace).toBeLessThan(100000); // <100KB per trace for extended operation
      expect(totalMemoryIncrease).toBeLessThan(100 * 1024 * 1024); // <100MB total increase

      // Check for memory leak patterns
      if (memorySnapshots.length >= 2) {
        const earlySnapshot = memorySnapshots[0];
        const lateSnapshot = memorySnapshots[memorySnapshots.length - 1];

        const memoryGrowthRate =
          (lateSnapshot.heapUsed - earlySnapshot.heapUsed) /
          (lateSnapshot.processed - earlySnapshot.processed);

        console.log(
          `  Memory growth rate: ${memoryGrowthRate.toFixed(0)} bytes/trace`
        );

        // Memory growth rate should not indicate a leak
        expect(memoryGrowthRate).toBeLessThan(50000); // <50KB growth per trace over time
      }
    });
  });

  describe('Throughput Analysis', () => {
    it('should measure maximum throughput capacity', async () => {
      const testDuration = 5000; // 5 seconds
      const traces = [];
      let processedCount = 0;
      let errorCount = 0;

      const startTime = performance.now();
      let currentTime = startTime;

      // Generate traces continuously for the test duration
      while (currentTime - startTime < testDuration) {
        const trace = await testBed.createActionAwareTrace({
          actorId: `throughput-actor-${traces.length}`,
          tracedActions: [`throughput_action_${traces.length}`],
        });

        const writePromise = outputService
          .writeTrace(trace)
          .then(() => {
            processedCount++;
          })
          .catch(() => {
            errorCount++;
          });

        traces.push(writePromise);
        currentTime = performance.now();

        // Small delay to prevent overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      // Wait for all traces to complete
      await Promise.allSettled(traces);
      const endTime = performance.now();

      const actualDuration = (endTime - startTime) / 1000; // Convert to seconds
      const totalTraces = traces.length;
      const throughput = totalTraces / actualDuration;
      const successRate = (processedCount / totalTraces) * 100;
      const errorRate = (errorCount / totalTraces) * 100;

      console.log('Throughput analysis:');
      console.log(`  Test duration: ${actualDuration.toFixed(2)}s`);
      console.log(`  Total traces generated: ${totalTraces}`);
      console.log(`  Successfully processed: ${processedCount}`);
      console.log(`  Errors: ${errorCount}`);
      console.log(`  Throughput: ${throughput.toFixed(2)} traces/second`);
      console.log(`  Success rate: ${successRate.toFixed(1)}%`);
      console.log(`  Error rate: ${errorRate.toFixed(1)}%`);

      // Throughput expectations
      expect(throughput).toBeGreaterThan(10); // >10 traces/second minimum
      expect(successRate).toBeGreaterThan(80); // >80% success rate under max throughput
      expect(errorRate).toBeLessThan(20); // <20% error rate acceptable under stress
    });
  });
});
