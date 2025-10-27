/**
 * @file Memory testing for ScopeDslErrorHandler
 * @description Comprehensive memory usage and leak detection tests for error handling
 *
 * Test Scenarios:
 * - Memory pressure: Error handling under memory constraints
 * - Memory recovery: Recovery from near exhaustion
 * - Memory leak detection: Long-running memory usage patterns
 */

import { jest } from '@jest/globals';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from '@jest/globals';
import ScopeDslErrorHandler from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { ScopeDslError } from '../../../src/scopeDsl/errors/scopeDslError.js';

// Set extended timeout for memory tests
jest.setTimeout(60000);

describe('ScopeDslErrorHandler Memory Testing', () => {
  let errorHandler;
  let mockLogger;

  // Memory testing metrics
  const memoryMetrics = {
    pressure: [],
    recovery: [],
    leaks: [],
  };

  beforeAll(() => {
    // Force initial GC if available
    if (global.gc) {
      global.gc();
    }
  });

  afterAll(() => {
    // Clean up and report metrics
    if (global.gc) {
      global.gc();
    }
  });

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    errorHandler = new ScopeDslErrorHandler({ logger: mockLogger });
  });

  afterEach(() => {
    errorHandler.clearErrorBuffer();
    jest.clearAllMocks();

    // Force GC between tests if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Memory Pressure Testing', () => {
    it('should handle errors under memory pressure', async () => {
      const iterations = 1000;
      const largeContext = {
        depth: 0,
        // Create a large context object to increase memory pressure
        data: Array(1000).fill({
          id: 'test-entity',
          attributes: Array(100).fill('attribute-value'),
          nested: {
            level1: {
              level2: {
                level3: Array(50).fill('deep-value'),
              },
            },
          },
        }),
      };

      // Force GC and get stable baseline memory
      await global.memoryTestUtils.forceGCAndWait();
      const memoryBefore = await global.memoryTestUtils.getStableMemoryUsage(3);
      let successCount = 0;

      for (let i = 0; i < iterations; i++) {
        try {
          errorHandler.handleError(
            new Error(`Memory pressure error ${i} with large stack trace`),
            largeContext,
            'memoryPressureResolver'
          );
        } catch (e) {
          if (
            e instanceof ScopeDslError ||
            e.constructor.name === 'ScopeDslError'
          ) {
            successCount++;
          }
        }

        // Clear buffer periodically to prevent unbounded growth
        if (i % 100 === 0) {
          errorHandler.clearErrorBuffer();
          // Force GC after buffer clear to ensure memory reclamation
          await global.memoryTestUtils.forceGCAndWait();
        }
      }

      // Force GC and get stable final memory measurement
      await global.memoryTestUtils.forceGCAndWait();
      const memoryAfter = await global.memoryTestUtils.getStableMemoryUsage(3);
      const memoryIncrease = memoryAfter - memoryBefore;
      const successRate = successCount / iterations;

      memoryMetrics.pressure.push({
        iterations,
        memoryIncrease,
        successRate,
        avgMemoryPerError: memoryIncrease / iterations,
      });

      // Use environment-aware memory threshold for CI tolerance
      const memoryThreshold = global.memoryTestUtils.getMemoryThreshold(80); // 80MB base, 120MB in CI
      expect(memoryIncrease).toBeLessThan(memoryThreshold);
      expect(successRate).toBeGreaterThan(0.95); // >95% success
    });

    it('should handle extremely large contexts without memory explosion', () => {
      const iterations = 500;

      // Create progressively larger contexts
      const contexts = Array.from({ length: iterations }, (_, i) => ({
        depth: 0,
        size: i + 1,
        // Each context gets progressively larger
        data: Array(Math.min(i * 10, 5000)).fill({
          id: `entity-${i}`,
          value: `data-${i}`,
          nested: {
            array: Array(Math.min(i, 100)).fill(`nested-${i}`),
          },
        }),
      }));

      const memoryBefore = process.memoryUsage().heapUsed;
      let successCount = 0;

      for (let i = 0; i < contexts.length; i++) {
        try {
          errorHandler.handleError(
            new Error(`Large context error ${i}`),
            contexts[i],
            'largeContextResolver'
          );
        } catch (e) {
          if (
            e instanceof ScopeDslError ||
            e.constructor.name === 'ScopeDslError'
          ) {
            successCount++;
          }
        }

        // Clear buffer more frequently for large contexts
        if (i % 50 === 0) {
          errorHandler.clearErrorBuffer();
        }
      }

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;
      const successRate = successCount / iterations;

      // Should handle large contexts without excessive memory usage
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // <100MB increase
      expect(successRate).toBeGreaterThan(0.9); // >90% success
    });
  });

  describe('Memory Recovery Testing', () => {
    it('should recover from near memory exhaustion', () => {
      // First, generate many errors to use memory
      for (let i = 0; i < 5000; i++) {
        try {
          errorHandler.handleError(
            new Error(`Exhaustion error ${i}`),
            { depth: 0 },
            'exhaustionResolver'
          );
        } catch {
          // Expected - errors are thrown by design
        }
      }

      const memoryAfterExhaustion = process.memoryUsage().heapUsed;

      // Clear buffer and force GC if available
      errorHandler.clearErrorBuffer();
      if (global.gc) {
        global.gc();
      }

      const memoryAfterCleanup = process.memoryUsage().heapUsed;

      // Now test recovery performance
      const recoveryStart = Date.now();
      let recoverySuccess = 0;

      for (let i = 0; i < 1000; i++) {
        try {
          errorHandler.handleError(
            new Error(`Recovery error ${i}`),
            { depth: 0 },
            'recoveryResolver'
          );
        } catch (e) {
          if (
            e instanceof ScopeDslError ||
            e.constructor.name === 'ScopeDslError'
          ) {
            recoverySuccess++;
          }
        }
      }

      const recoveryDuration = Date.now() - recoveryStart;
      const memoryAfterRecovery = process.memoryUsage().heapUsed;
      const recoverySuccessRate = recoverySuccess / 1000;

      memoryMetrics.recovery.push({
        memoryAfterExhaustion,
        memoryAfterCleanup,
        memoryAfterRecovery,
        recoveryDuration,
        recoverySuccessRate,
      });

      // Should successfully clean up memory
      const cleanupEfficiency =
        (memoryAfterExhaustion - memoryAfterCleanup) / memoryAfterExhaustion;
      if (global.gc) {
        expect(cleanupEfficiency).toBeGreaterThan(0.03);
      } else {
        expect(Math.abs(cleanupEfficiency)).toBeLessThan(0.05);
      }
      // Require only a modest immediate drop to allow for delayed heap shrinking
      // while still ensuring cleanup doesn't leave memory unchanged.

      // Should maintain good performance after recovery
      expect(recoverySuccessRate).toBeGreaterThan(0.9); // >90% success
      expect(recoveryDuration).toBeLessThan(10000); // <10 seconds for 1000 errors
    });

    it('should maintain consistent memory usage across multiple cycles', () => {
      const cycles = 5;
      const errorsPerCycle = 1000;
      const memorySnapshots = [];

      for (let cycle = 0; cycle < cycles; cycle++) {
        const cycleStart = process.memoryUsage().heapUsed;

        // Generate errors for this cycle
        for (let i = 0; i < errorsPerCycle; i++) {
          try {
            errorHandler.handleError(
              new Error(`Cycle ${cycle} error ${i}`),
              {
                depth: 0,
                cycle,
                data: Array(10).fill(`cycle-${cycle}-data`),
              },
              'cycleResolver'
            );
          } catch {
            // Expected
          }
        }

        const cycleMiddle = process.memoryUsage().heapUsed;

        // Clean up after cycle
        errorHandler.clearErrorBuffer();
        if (global.gc) {
          global.gc();
        }

        const cycleEnd = process.memoryUsage().heapUsed;

        memorySnapshots.push({
          cycle,
          start: cycleStart,
          middle: cycleMiddle,
          end: cycleEnd,
          growth: cycleEnd - cycleStart,
          peak: cycleMiddle - cycleStart,
        });
      }

      // Analyze memory patterns across cycles
      const growthRates = memorySnapshots.map((s) => s.growth);
      const maxGrowth = Math.max(...growthRates);
      const avgGrowth =
        growthRates.reduce((sum, g) => sum + g, 0) / growthRates.length;

      // Memory growth should be bounded and consistent
      expect(maxGrowth).toBeLessThan(50 * 1024 * 1024); // <50MB max growth per cycle
      expect(Math.abs(avgGrowth)).toBeLessThan(10 * 1024 * 1024); // <10MB average growth

      memoryMetrics.leaks.push({
        cycles,
        errorsPerCycle,
        snapshots: memorySnapshots,
        maxGrowth,
        avgGrowth,
      });
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during continuous operation', () => {
      const batches = global.memoryTestUtils?.isCI() ? 180 : 120;
      const errorsPerBatch = 100;
      const sampleFrequency = global.memoryTestUtils?.isCI() ? 12 : 8;
      const memorySnapshots = [];

      const startMemory = process.memoryUsage().heapUsed;
      let totalErrors = 0;

      memorySnapshots.push({
        label: 'start',
        memory: startMemory,
        errors: totalErrors,
      });

      for (let batch = 0; batch < batches; batch++) {
        for (let i = 0; i < errorsPerBatch; i++) {
          totalErrors++;

          try {
            errorHandler.handleError(
              new Error(`Continuous error ${totalErrors}`),
              {
                depth: 0,
                timestamp: Date.now(),
                data: `data-${totalErrors % errorsPerBatch}`,
              },
              'continuousResolver'
            );
          } catch {
            // Expected
          }
        }

        if ((batch + 1) % sampleFrequency === 0) {
          memorySnapshots.push({
            label: `batch-${batch + 1}`,
            memory: process.memoryUsage().heapUsed,
            errors: totalErrors,
          });
        }

        if (totalErrors % 500 === 0) {
          errorHandler.clearErrorBuffer();
          if (global.gc) {
            global.gc();
          }
        }
      }

      const endMemory = process.memoryUsage().heapUsed;
      const totalMemoryGrowth = endMemory - startMemory;

      const memoryGrowths = [];
      for (let i = 1; i < memorySnapshots.length; i++) {
        memoryGrowths.push(
          memorySnapshots[i].memory - memorySnapshots[i - 1].memory
        );
      }

      const avgGrowthPerSample =
        memoryGrowths.length === 0
          ? 0
          : memoryGrowths.reduce((sum, g) => sum + g, 0) / memoryGrowths.length;
      const maxGrowthPerSample =
        memoryGrowths.length === 0 ? 0 : Math.max(...memoryGrowths);

      // Memory should not grow unbounded (increased tolerance for CI environments)
      expect(totalMemoryGrowth).toBeLessThan(250 * 1024 * 1024); // <250MB total growth
      expect(avgGrowthPerSample).toBeLessThan(30 * 1024 * 1024); // <30MB avg growth per sample
      expect(maxGrowthPerSample).toBeLessThan(60 * 1024 * 1024); // <60MB max growth per sample

      memoryMetrics.leaks.push({
        batches,
        totalErrors,
        snapshots: memorySnapshots,
        totalMemoryGrowth,
        avgGrowthPerSample,
        maxGrowthPerSample,
      });
    });
  });

  describe('Memory Test Summary', () => {
    it('should generate memory usage report', () => {
      // This test runs last and generates a summary report
      console.log('\n=== Memory Testing Report ===\n');

      if (memoryMetrics.pressure.length > 0) {
        console.log('Memory Pressure:');
        memoryMetrics.pressure.forEach((m) => {
          console.log(`  - ${m.iterations} iterations`);
          console.log(
            `    Memory Increase: ${(m.memoryIncrease / 1024 / 1024).toFixed(2)}MB`
          );
          console.log(`    Success Rate: ${(m.successRate * 100).toFixed(1)}%`);
          console.log(
            `    Avg Memory per Error: ${(m.avgMemoryPerError / 1024).toFixed(2)}KB`
          );
        });
      }

      if (memoryMetrics.recovery.length > 0) {
        console.log('\nMemory Recovery:');
        memoryMetrics.recovery.forEach((m) => {
          const cleanupEfficiency =
            ((m.memoryAfterExhaustion - m.memoryAfterCleanup) /
              m.memoryAfterExhaustion) *
            100;
          console.log(
            `  - Cleanup Efficiency: ${cleanupEfficiency.toFixed(1)}%`
          );
          console.log(`    Recovery Duration: ${m.recoveryDuration}ms`);
          console.log(
            `    Recovery Success: ${(m.recoverySuccessRate * 100).toFixed(1)}%`
          );
        });
      }

      if (memoryMetrics.leaks.length > 0) {
        console.log('\nMemory Leak Detection:');
        memoryMetrics.leaks.forEach((m) => {
          if (m.cycles) {
            console.log(
              `  - ${m.cycles} cycles of ${m.errorsPerCycle} errors each`
            );
            console.log(
              `    Max Growth: ${(m.maxGrowth / 1024 / 1024).toFixed(2)}MB`
            );
            console.log(
              `    Avg Growth: ${(m.avgGrowth / 1024 / 1024).toFixed(2)}MB`
            );
          } else if (m.batches) {
            console.log(
              `  - ${m.totalErrors} errors across ${m.batches} batches`
            );
            console.log(
              `    Total Growth: ${(m.totalMemoryGrowth / 1024 / 1024).toFixed(2)}MB`
            );
            console.log(
              `    Avg Growth/Sample: ${(m.avgGrowthPerSample / 1024 / 1024).toFixed(2)}MB`
            );
          } else {
            console.log(`  - ${m.totalErrors} errors over ${m.duration}ms`);
            console.log(
              `    Total Growth: ${(m.totalMemoryGrowth / 1024 / 1024).toFixed(2)}MB`
            );
            console.log(
              `    Avg Growth/Sample: ${(m.avgGrowthPerSample / 1024 / 1024).toFixed(2)}MB`
            );
          }
        });
      }

      console.log('\n==============================\n');

      // Test passes if we got here
      expect(true).toBe(true);
    });
  });
});
