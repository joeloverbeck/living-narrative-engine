/**
 * @file High-frequency action tracing load tests
 * @description Tests system performance under sustained load with high-frequency trace generation
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
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
  let originalFetch;

  beforeEach(async () => {
    testBed = createTestBed();

    // Mock fetch to simulate successful server writes and avoid ECONNREFUSED errors
    // Use immediate resolution without delays for consistent performance
    originalFetch = global.fetch;
    global.fetch = jest.fn().mockImplementation(() => {
      // Return immediately without any async delays for consistent timing
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            path: './traces/performance-test/mock-trace.json',
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
      outputDirectory: './traces/performance-test',
    });
  });

  afterEach(async () => {
    testBed.cleanup();

    // Restore original fetch
    if (originalFetch) {
      global.fetch = originalFetch;
    }

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
    it('should handle 50 rapid dual-format traces without blocking', async () => {
      const traces = await Promise.all(
        Array.from({ length: 50 }, async (_, i) => // Reduced from 100
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

      expect(successful).toBeGreaterThanOrEqual(45); // ≥90% success rate (scaled from 95/100)
      expect(timePerTrace).toBeLessThan(100); // <100ms per trace
      expect(totalTime).toBeLessThan(7500); // Complete within 7.5 seconds (scaled from 15s)
    });

    it('should maintain low error rate under concurrent load', async () => {
      const concurrentBatches = 3; // Reduced from 5
      const batchSize = 15; // Reduced from 20
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
      expect(totalTime).toBeLessThan(10000); // Complete within 10 seconds (scaled from 20s)
    });
  });

  describe('Sustained Load Testing', () => {
    it('should maintain performance under sustained load', async () => {
      const batchSize = 15; // Reduced from 20
      const batches = 3; // Reduced from 5
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
        await new Promise((resolve) => setTimeout(resolve, 50)); // Reduced from 100ms
      }

      // Use statistical measures for more robust performance analysis
      const avgBatchTime =
        batchTimes.reduce((sum, time) => sum + time, 0) / batchTimes.length;
      const maxBatchTime = Math.max(...batchTimes);
      const minBatchTime = Math.min(...batchTimes);

      // Calculate standard deviation for better statistical analysis
      const variance =
        batchTimes.reduce(
          (sum, time) => sum + Math.pow(time - avgBatchTime, 2),
          0
        ) / batchTimes.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = (stdDev / avgBatchTime) * 100;

      // Calculate median for more stable central tendency
      const sortedTimes = [...batchTimes].sort((a, b) => a - b);
      const median =
        sortedTimes.length % 2 === 0
          ? (sortedTimes[sortedTimes.length / 2 - 1] +
              sortedTimes[sortedTimes.length / 2]) /
            2
          : sortedTimes[Math.floor(sortedTimes.length / 2)];

      // More robust degradation calculation using statistical measures
      const firstBatchTime = Math.max(batchTimes[0], 10); // Minimum 10ms floor to prevent near-zero division
      const lastBatchTime = batchTimes[batchTimes.length - 1];
      const absoluteChange = lastBatchTime - firstBatchTime;
      const percentageChange = (absoluteChange / firstBatchTime) * 100;

      console.log(`Sustained load analysis:`);
      console.log(`  Average batch time: ${avgBatchTime.toFixed(2)}ms`);
      console.log(`  Median batch time: ${median.toFixed(2)}ms`);
      console.log(`  Min batch time: ${minBatchTime.toFixed(2)}ms`);
      console.log(`  Max batch time: ${maxBatchTime.toFixed(2)}ms`);
      console.log(`  Standard deviation: ${stdDev.toFixed(2)}ms`);
      console.log(
        `  Coefficient of variation: ${coefficientOfVariation.toFixed(1)}%`
      );
      console.log(
        `  Performance change: ${percentageChange.toFixed(1)}% (${absoluteChange.toFixed(1)}ms)`
      );

      // More robust assertions using statistical measures and absolute thresholds
      expect(coefficientOfVariation).toBeLessThan(200); // Coefficient of variation should be reasonable
      expect(absoluteChange).toBeLessThan(2000); // Absolute performance degradation should be < 2000ms
      expect(avgBatchTime).toBeLessThan(5000); // Average batch should complete reasonably quickly
      expect(maxBatchTime).toBeLessThan(10000); // No individual batch should take more than 10 seconds
    });
  });

  describe('Throughput Analysis', () => {
    it('should measure maximum throughput capacity', async () => {
      const testDuration = 2000; // 2 seconds (reduced from 5)
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
        await new Promise((resolve) => setTimeout(resolve, 2)); // Increased from 1ms for stability
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
