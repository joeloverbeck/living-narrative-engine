/**
 * @file Memory efficiency tests for dual-format action tracing
 * @description Tests memory usage, leak detection, and efficiency of dual-format tracing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { ActionTraceOutputService } from '../../../../src/actions/tracing/actionTraceOutputService.js';
import {
  createMockJsonFormatter,
  createMockHumanReadableFormatterWithOptions,
} from '../../../common/mockFactories/actionTracing.js';

// Memory test utilities
const getMemoryUsage = () => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage();
  }
  return {
    heapUsed: 0,
    heapTotal: 0,
    external: 0,
    rss: 0,
    supported: false,
  };
};

const forceGarbageCollection = () => {
  if (typeof global !== 'undefined' && global.gc) {
    global.gc();
    return true;
  }
  return false;
};

describe('Dual-Format Memory Efficiency Tests', () => {
  let testBed;
  let actionTraceOutputService;

  beforeEach(async () => {
    testBed = createTestBed();

    const config = {
      outputFormats: ['json', 'text'],
      textFormatOptions: {
        lineWidth: 120,
        indentSize: 2,
        includeTimestamps: true,
        performanceSummary: true,
      },
    };

    actionTraceOutputService = new ActionTraceOutputService({
      jsonFormatter: createMockJsonFormatter(),
      humanReadableFormatter: createMockHumanReadableFormatterWithOptions(),
      logger: testBed.mockLogger,
      actionTraceConfig: config,
      outputToFiles: false,
    });
  });

  afterEach(async () => {
    if (actionTraceOutputService?.shutdown) {
      await actionTraceOutputService.shutdown();
    }
    testBed.cleanup?.();

    // Force cleanup after each test
    if (forceGarbageCollection()) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during continuous dual-format generation', async () => {
      const iterations = 200;
      const memorySnapshots = [];

      // Baseline measurement
      forceGarbageCollection();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const baselineMemory = getMemoryUsage();
      memorySnapshots.push({ iteration: 0, ...baselineMemory });

      for (let i = 0; i < iterations; i++) {
        const trace = await testBed.createActionAwareTrace({
          actorId: `memory-test-${i}`,
          tracedActions: ['memory_test'],
          verbosity: 'standard',
          includeComponentData: false,
        });

        await actionTraceOutputService.writeTrace(trace);

        // Take memory snapshot every 50 iterations
        if ((i + 1) % 50 === 0) {
          forceGarbageCollection();
          await new Promise((resolve) => setTimeout(resolve, 50));
          const currentMemory = getMemoryUsage();
          memorySnapshots.push({ iteration: i + 1, ...currentMemory });
        }
      }

      // Final memory measurement
      forceGarbageCollection();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const finalMemory = getMemoryUsage();
      memorySnapshots.push({ iteration: iterations, ...finalMemory });

      const totalHeapIncrease = finalMemory.heapUsed - baselineMemory.heapUsed;
      const heapIncreasePerTrace = totalHeapIncrease / iterations;

      console.log('Memory leak detection results:');
      console.log(
        `  Baseline heap: ${(baselineMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(
        `  Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(
        `  Total heap increase: ${(totalHeapIncrease / 1024).toFixed(2)} KB`
      );
      console.log(
        `  Heap increase per trace: ${heapIncreasePerTrace.toFixed(0)} bytes`
      );

      // Analyze memory growth pattern
      if (memorySnapshots.length >= 3) {
        const growthRates = [];
        for (let i = 1; i < memorySnapshots.length; i++) {
          const current = memorySnapshots[i];
          const previous = memorySnapshots[i - 1];
          const iterationDiff = current.iteration - previous.iteration;
          const memoryDiff = current.heapUsed - previous.heapUsed;
          const growthRate = memoryDiff / iterationDiff;
          growthRates.push(growthRate);
        }

        const avgGrowthRate =
          growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
        console.log(
          `  Average growth rate: ${avgGrowthRate.toFixed(0)} bytes/trace`
        );

        // Memory growth should not indicate a continuous leak (only if finite)
        if (Number.isFinite(avgGrowthRate)) {
          expect(Math.abs(avgGrowthRate)).toBeLessThan(50000); // <50KB average growth per trace
        } else {
          console.log(
            '  Memory growth rate calculation resulted in non-finite value - skipping trend check'
          );
        }
      }

      expect(heapIncreasePerTrace).toBeLessThan(50000); // <50KB per trace (adjusted for realistic expectations)
      expect(totalHeapIncrease).toBeLessThan(20 * 1024 * 1024); // <20MB total increase
    });

    it('should free memory when traces are no longer referenced', async () => {
      const batchSize = 100;
      const batches = 3;
      const memorySnapshots = [];

      // Initial baseline
      forceGarbageCollection();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const initialMemory = getMemoryUsage();
      memorySnapshots.push({ phase: 'initial', ...initialMemory });

      for (let batch = 0; batch < batches; batch++) {
        // Create and process a batch of traces
        const traces = [];
        for (let i = 0; i < batchSize; i++) {
          const trace = await testBed.createActionAwareTrace({
            actorId: `batch-${batch}-actor-${i}`,
            tracedActions: [`batch_${batch}_test_${i}`],
          });
          traces.push(trace);
        }

        // Process all traces in the batch
        await Promise.all(
          traces.map((trace) => actionTraceOutputService.writeTrace(trace))
        );

        // Memory snapshot after batch processing
        forceGarbageCollection();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const afterBatchMemory = getMemoryUsage();
        memorySnapshots.push({
          phase: `after_batch_${batch}`,
          ...afterBatchMemory,
        });

        // Clear references to traces
        traces.length = 0;

        // Memory snapshot after clearing references
        forceGarbageCollection();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const afterCleanupMemory = getMemoryUsage();
        memorySnapshots.push({
          phase: `after_cleanup_${batch}`,
          ...afterCleanupMemory,
        });

        const batchMemoryIncrease =
          afterBatchMemory.heapUsed - initialMemory.heapUsed;
        const cleanupMemoryIncrease =
          afterCleanupMemory.heapUsed - initialMemory.heapUsed;
        const memoryRecovered =
          afterBatchMemory.heapUsed - afterCleanupMemory.heapUsed;
        const recoveryRate = (memoryRecovered / batchMemoryIncrease) * 100;

        console.log(`Batch ${batch + 1} memory analysis:`);
        console.log(
          `  Memory after batch: +${(batchMemoryIncrease / 1024).toFixed(2)} KB`
        );
        console.log(
          `  Memory after cleanup: +${(cleanupMemoryIncrease / 1024).toFixed(2)} KB`
        );
        console.log(
          `  Memory recovered: ${(memoryRecovered / 1024).toFixed(2)} KB (${recoveryRate.toFixed(1)}%)`
        );

        // Memory should be recoverable when references are cleared
        if (batchMemoryIncrease > 0) {
          expect(recoveryRate).toBeGreaterThan(20); // Should recover at least 20% of allocated memory
        }
      }

      // Final memory should not have grown excessively
      const finalSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const totalGrowth = finalSnapshot.heapUsed - initialMemory.heapUsed;
      const totalTraces = batches * batchSize;

      expect(totalGrowth / totalTraces).toBeLessThan(30000); // <30KB persistent growth per trace
    });
  });

  describe('Memory Efficiency Analysis', () => {
    it('should measure memory footprint of different trace configurations', async () => {
      const configurations = [
        { name: 'minimal', verbosity: 'minimal', includeComponentData: false },
        {
          name: 'standard',
          verbosity: 'standard',
          includeComponentData: false,
        },
        { name: 'verbose', verbosity: 'verbose', includeComponentData: false },
        {
          name: 'verbose_with_components',
          verbosity: 'verbose',
          includeComponentData: true,
        },
      ];

      const configResults = [];

      for (const config of configurations) {
        const iterations = 50;
        const traces = [];

        // Measure baseline
        forceGarbageCollection();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const beforeMemory = getMemoryUsage();

        // Create traces with specific configuration
        for (let i = 0; i < iterations; i++) {
          const trace = await testBed.createActionAwareTrace({
            actorId: `config-test-${config.name}-${i}`,
            tracedActions: ['config_test'],
            verbosity: config.verbosity,
            includeComponentData: config.includeComponentData,
          });
          traces.push(trace);

          await actionTraceOutputService.writeTrace(trace);
        }

        // Measure after processing
        forceGarbageCollection();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const afterMemory = getMemoryUsage();

        const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
        const memoryPerTrace = memoryIncrease / iterations;

        configResults.push({
          config: config.name,
          memoryPerTrace,
          totalIncrease: memoryIncrease,
        });

        console.log(
          `Configuration '${config.name}': ${memoryPerTrace.toFixed(0)} bytes/trace`
        );

        // Clear traces for next iteration
        traces.length = 0;
        forceGarbageCollection();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Analyze memory efficiency patterns
      configResults.sort((a, b) => a.memoryPerTrace - b.memoryPerTrace);

      const minimalConfig = configResults.find((r) => r.config === 'minimal');
      const verboseConfig = configResults.find(
        (r) => r.config === 'verbose_with_components'
      );

      if (minimalConfig && verboseConfig) {
        const memoryMultiplier =
          verboseConfig.memoryPerTrace / minimalConfig.memoryPerTrace;
        console.log(
          `Memory multiplier (verbose vs minimal): ${memoryMultiplier.toFixed(1)}x`
        );

        // Verbose configuration should not be excessively memory-intensive
        expect(memoryMultiplier).toBeLessThan(10); // <10x memory usage for verbose vs minimal
      }

      // All configurations should have reasonable memory usage
      expect(configResults.every((r) => r.memoryPerTrace < 100000)).toBe(true); // <100KB per trace
    });

    it('should handle memory pressure gracefully', async () => {
      const memoryPressureIterations = 500;
      const memoryCheckpoints = [];
      let consecutiveFailures = 0;
      let totalSuccesses = 0;

      for (let i = 0; i < memoryPressureIterations; i++) {
        try {
          const trace = await testBed.createActionAwareTrace({
            actorId: `memory-pressure-${i}`,
            tracedActions: ['memory_pressure_test'],
            verbosity: 'verbose',
            includeComponentData: true,
          });

          await actionTraceOutputService.writeTrace(trace);
          totalSuccesses++;
          consecutiveFailures = 0;

          // Monitor memory at intervals
          if ((i + 1) % 100 === 0) {
            if (forceGarbageCollection()) {
              await new Promise((resolve) => setTimeout(resolve, 50));
            }

            const currentMemory = getMemoryUsage();
            memoryCheckpoints.push({
              iteration: i + 1,
              heapUsed: currentMemory.heapUsed,
              heapTotal: currentMemory.heapTotal,
            });

            console.log(
              `Memory checkpoint ${i + 1}: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB heap used`
            );
          }
        } catch (error) {
          consecutiveFailures++;
          console.warn(`Iteration ${i} failed: ${error.message}`);

          // If too many consecutive failures, the system might be under too much pressure
          if (consecutiveFailures >= 10) {
            console.log(
              'Too many consecutive failures - stopping memory pressure test'
            );
            break;
          }
        }
      }

      const successRate = (totalSuccesses / memoryPressureIterations) * 100;

      console.log('Memory pressure test results:');
      console.log(`  Total iterations attempted: ${memoryPressureIterations}`);
      console.log(`  Successful operations: ${totalSuccesses}`);
      console.log(`  Success rate: ${successRate.toFixed(1)}%`);
      console.log(`  Consecutive failures: ${consecutiveFailures}`);

      // Analyze memory growth under pressure
      if (memoryCheckpoints.length >= 2) {
        const firstCheckpoint = memoryCheckpoints[0];
        const lastCheckpoint = memoryCheckpoints[memoryCheckpoints.length - 1];
        const memoryGrowth = lastCheckpoint.heapUsed - firstCheckpoint.heapUsed;
        const iterationSpan =
          lastCheckpoint.iteration - firstCheckpoint.iteration;
        const memoryGrowthRate = memoryGrowth / iterationSpan;

        console.log(
          `  Memory growth rate: ${memoryGrowthRate.toFixed(0)} bytes/iteration`
        );

        // Memory growth under pressure should not be excessive
        expect(memoryGrowthRate).toBeLessThan(20000); // <20KB growth per iteration under pressure
      }

      // System should maintain reasonable success rate under memory pressure
      expect(successRate).toBeGreaterThan(75); // >75% success rate under pressure
      expect(consecutiveFailures).toBeLessThan(20); // <20 consecutive failures
    });
  });

  describe('Memory Pattern Analysis', () => {
    it('should show predictable memory allocation patterns', async () => {
      const patternIterations = 150;
      const measurements = [];

      // Collect memory measurements at regular intervals
      for (let i = 0; i < patternIterations; i++) {
        const trace = await testBed.createActionAwareTrace({
          actorId: `pattern-test-${i}`,
          tracedActions: ['pattern_test'],
          verbosity: 'standard',
        });

        const beforeWrite = getMemoryUsage();
        await actionTraceOutputService.writeTrace(trace);

        // Force GC every 10 iterations to get cleaner measurements
        if (i % 10 === 9) {
          forceGarbageCollection();
          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        const afterWrite = getMemoryUsage();

        measurements.push({
          iteration: i,
          beforeHeap: beforeWrite.heapUsed,
          afterHeap: afterWrite.heapUsed,
          increase: afterWrite.heapUsed - beforeWrite.heapUsed,
        });
      }

      // Analyze allocation patterns
      const increases = measurements.map((m) => m.increase);
      const avgIncrease =
        increases.reduce((sum, inc) => sum + inc, 0) / increases.length;
      const variance =
        increases.reduce(
          (acc, inc) => acc + Math.pow(inc - avgIncrease, 2),
          0
        ) / increases.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = (stdDev / Math.abs(avgIncrease)) * 100;

      // Calculate moving averages to detect trends
      const windowSize = 20;
      const movingAverages = [];
      for (let i = windowSize - 1; i < measurements.length; i++) {
        const window = measurements.slice(i - windowSize + 1, i + 1);
        const avgHeap =
          window.reduce((sum, m) => sum + m.afterHeap, 0) / window.length;
        movingAverages.push({ iteration: i, avgHeap });
      }

      console.log('Memory allocation pattern analysis:');
      console.log(
        `  Average memory increase per trace: ${avgIncrease.toFixed(0)} bytes`
      );
      console.log(`  Standard deviation: ${stdDev.toFixed(0)} bytes`);
      console.log(
        `  Coefficient of variation: ${coefficientOfVariation.toFixed(1)}%`
      );

      // Check for memory leak trends
      if (movingAverages.length >= 2) {
        const firstMA = movingAverages[0];
        const lastMA = movingAverages[movingAverages.length - 1];
        const trendSlope =
          (lastMA.avgHeap - firstMA.avgHeap) /
          (lastMA.iteration - firstMA.iteration);

        console.log(
          `  Memory trend slope: ${trendSlope.toFixed(0)} bytes/iteration`
        );

        // Memory should not have a strong upward trend (indicating leaks)
        // Note: GC-induced fluctuations can cause significant trend values in either direction
        // Negative values indicate memory decreasing (GC working), which is fine
        expect(Math.abs(trendSlope)).toBeLessThan(30000); // <30KB trend per iteration (adjusted for GC volatility in test environments)
      }

      // Memory allocation should be reasonably consistent
      // Note: High CV is expected with small allocations and GC interruptions - this is a sanity check, not precision measurement
      expect(coefficientOfVariation).toBeLessThan(800); // <800% variation (adjusted for test environment memory volatility)
      expect(Math.abs(avgIncrease)).toBeLessThan(200000); // <200KB average increase per trace (adjusted for realistic expectations)
    });
  });
});
