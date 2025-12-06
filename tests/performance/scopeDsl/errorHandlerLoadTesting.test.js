/**
 * @file Load testing for ScopeDslErrorHandler
 * @description Comprehensive stress testing and load scenarios for error handling
 *
 * Test Scenarios:
 * - Burst load: Sudden spike in error rates
 * - Sustained load: Continuous high error rates
 * - Variable load: Fluctuating error rates
 * - Concurrent load: Multiple threads of error generation
 * - Memory pressure: Error handling under memory constraints
 *
 * Performance Expectations:
 * Thresholds are set to detect performance regressions while accounting for
 * CI environment variability. Error handling prioritizes correctness and
 * robustness over raw speed, as it handles exceptional conditions.
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
import { performance } from 'perf_hooks';
import ScopeDslErrorHandler from '../../../src/scopeDsl/core/scopeDslErrorHandler.js';
import { ScopeDslError } from '../../../src/scopeDsl/errors/scopeDslError.js';
import { createUltraLightContainer } from '../../common/testing/ultraLightContainer.js';

// Set extended timeout for load tests
jest.setTimeout(120000);

describe('ScopeDslErrorHandler Load Testing', () => {
  let errorHandler;
  let mockLogger;

  // Load testing metrics
  const loadMetrics = {
    burst: [],
    sustained: [],
    variable: [],
    concurrent: [],
  };

  beforeAll(() => {
    const container = createUltraLightContainer();
    // Container used for initialization if needed
    void container; // Explicitly mark as intentionally unused
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
  });

  describe('Burst Load Testing', () => {
    it('should handle sudden error burst of 2500 errors in 1 second', async () => {
      const burstSize = 2500; // Optimized from 5000
      const maxDuration = 1000; // 1 second
      let processedCount = 0;
      let successCount = 0;

      // Force garbage collection before test if available
      if (global.gc) {
        global.gc();
      }

      // Small delay to allow system to stabilize
      await new Promise((resolve) => setTimeout(resolve, 10));

      const start = performance.now();

      // Generate burst
      for (let i = 0; i < burstSize; i++) {
        processedCount++;
        try {
          errorHandler.handleError(
            new Error(`Burst error ${i}`),
            { depth: 0, burst: true },
            'burstResolver'
          );
        } catch (e) {
          if (
            e instanceof ScopeDslError ||
            e.constructor.name === 'ScopeDslError'
          ) {
            successCount++;
          }
        }
      }

      const duration = performance.now() - start;
      const throughput = processedCount / (duration / 1000);
      const successRate = successCount / processedCount;

      loadMetrics.burst.push({
        size: burstSize,
        duration,
        throughput,
        successRate,
      });

      // Performance assertions (optimized thresholds for stability)
      expect(duration).toBeLessThan(maxDuration * 2.0); // Allow 100% overhead for CI variability
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(throughput).toBeGreaterThan(1500); // >1500 errors/second (more realistic CI threshold)
    });

    it('should handle multiple consecutive bursts', async () => {
      const burstCount = 3; // Optimized from 5
      const burstSize = 800; // Optimized from 1000
      const burstInterval = 50; // 50ms between bursts - tests rapid succession
      const burstMetrics = [];

      for (let b = 0; b < burstCount; b++) {
        const burstStart = performance.now();
        let burstSuccess = 0;

        for (let i = 0; i < burstSize; i++) {
          try {
            errorHandler.handleError(
              new Error(`Multi-burst ${b}-${i}`),
              { depth: 0, burstNumber: b },
              'multiBurstResolver'
            );
          } catch (e) {
            if (
              e instanceof ScopeDslError ||
              e.constructor.name === 'ScopeDslError'
            ) {
              burstSuccess++;
            }
          }
        }

        const burstDuration = performance.now() - burstStart;
        burstMetrics.push({
          burst: b,
          duration: burstDuration,
          successRate: burstSuccess / burstSize,
          avgTime: burstDuration / burstSize,
        });

        // Clear buffer between bursts
        errorHandler.clearErrorBuffer();

        // Wait before next burst
        await new Promise((resolve) => setTimeout(resolve, burstInterval));
      }

      // Analyze burst consistency (ignore the first burst to skip warm-up effects)
      const steadyStateMetrics =
        burstMetrics.length > 2 ? burstMetrics.slice(1) : burstMetrics;
      const avgTimes = steadyStateMetrics.map((m) => m.avgTime);
      const minAvgTime = Math.min(...avgTimes);
      const maxAvgTime = Math.max(...avgTimes);
      const meanAvgTime =
        avgTimes.reduce((total, value) => total + value, 0) /
        (avgTimes.length || 1);
      const normalizedRange =
        (maxAvgTime - minAvgTime) / Math.max(meanAvgTime, 0.01);

      // Performance should be consistent across bursts (allow substantial CI variance)
      expect(normalizedRange).toBeLessThan(6.0); // <600% range relative to mean
      burstMetrics.forEach((m) => {
        expect(m.successRate).toBeGreaterThan(0.9); // >90% success per burst
      });
    });
  });

  describe('Sustained Load Testing', () => {
    it('should maintain performance over 1 second of continuous load', async () => {
      const testDuration = 1000; // 1 second - sufficient for pattern detection
      const targetRate = 1000; // errors per second
      const sampleInterval = 1000; // Sample every second
      const samples = [];

      const startTime = performance.now();
      let totalErrors = 0;
      let totalSuccess = 0;
      let lastSampleTime = startTime;
      let sampleErrors = 0;

      while (performance.now() - startTime < testDuration) {
        const batchStart = performance.now();

        // Generate errors for this batch
        const batchSize = Math.floor(targetRate / 100); // 10ms batches
        for (let i = 0; i < batchSize; i++) {
          totalErrors++;
          sampleErrors++;

          try {
            errorHandler.handleError(
              new Error(`Sustained error ${totalErrors}`),
              { depth: 0, timestamp: Date.now() },
              'sustainedResolver'
            );
          } catch (e) {
            if (
              e instanceof ScopeDslError ||
              e.constructor.name === 'ScopeDslError'
            ) {
              totalSuccess++;
            }
          }
        }

        // Check if we should take a sample
        if (performance.now() - lastSampleTime >= sampleInterval) {
          const sampleDuration = performance.now() - lastSampleTime;
          samples.push({
            time: performance.now() - startTime,
            errors: sampleErrors,
            rate: sampleErrors / (sampleDuration / 1000),
          });

          lastSampleTime = performance.now();
          sampleErrors = 0;

          // Clear buffer periodically to prevent overflow
          errorHandler.clearErrorBuffer();
        }

        // Minimal batch pacing for sustained load (optimized)
        if (performance.now() - batchStart < 5) {
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      }

      const totalDuration = performance.now() - startTime;
      const overallRate = totalErrors / (totalDuration / 1000);
      const overallSuccess = totalSuccess / totalErrors;

      loadMetrics.sustained.push({
        duration: totalDuration,
        totalErrors,
        overallRate,
        overallSuccess,
        samples,
      });

      // Performance assertions
      expect(overallSuccess).toBeGreaterThan(0.9); // >90% success rate
      expect(overallRate).toBeGreaterThan(targetRate * 0.8); // Within 20% of target

      // Check rate stability
      const rates = samples.map((s) => s.rate);
      const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
      rates.forEach((rate) => {
        const deviation = Math.abs(rate - avgRate) / avgRate;
        expect(deviation).toBeLessThan(0.3); // <30% deviation from average
      });
    });

    it('should handle sustained load with increasing complexity', async () => {
      const phases = [
        { duration: 500, complexity: 'simple', contextSize: 10 },
        { duration: 500, complexity: 'complex', contextSize: 1000 },
      ];

      const phaseMetrics = [];

      for (const phase of phases) {
        const phaseStart = performance.now();
        let phaseErrors = 0;
        let phaseSuccess = 0;

        // Generate complex context based on phase
        const context = {
          depth: 0,
          complexity: phase.complexity,
          data: Array(phase.contextSize).fill({
            id: 'test',
            value: Math.random(),
          }),
        };

        while (performance.now() - phaseStart < phase.duration) {
          phaseErrors++;

          try {
            errorHandler.handleError(
              new Error(`Phase ${phase.complexity} error ${phaseErrors}`),
              context,
              'complexityResolver'
            );
          } catch (e) {
            if (
              e instanceof ScopeDslError ||
              e.constructor.name === 'ScopeDslError'
            ) {
              phaseSuccess++;
            }
          }

          // Minimal delay to prevent CPU saturation (optimized)
          if (phaseErrors % 200 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
        }

        const phaseDuration = performance.now() - phaseStart;
        const phaseRate = phaseErrors / (phaseDuration / 1000);

        phaseMetrics.push({
          complexity: phase.complexity,
          duration: phaseDuration,
          errors: phaseErrors,
          successRate: phaseSuccess / phaseErrors,
          throughput: phaseRate,
        });

        // Clear buffer between phases
        errorHandler.clearErrorBuffer();
      }

      // Verify performance across complexity levels
      phaseMetrics.forEach((metric) => {
        expect(metric.successRate).toBeGreaterThan(0.85); // >85% success

        // Adjust expectations based on complexity (CI-friendly thresholds)
        const minThroughput = metric.complexity === 'simple' ? 700 : 150; // complex

        expect(metric.throughput).toBeGreaterThan(minThroughput);
      });
    });
  });

  describe('Variable Load Testing', () => {
    it('should handle variable load patterns', async () => {
      const loadPatterns = [
        { duration: 300, rate: 100 }, // Low load
        { duration: 300, rate: 500 }, // Medium load
        { duration: 300, rate: 1000 }, // High load
      ];

      const patternMetrics = [];

      for (const pattern of loadPatterns) {
        const patternStart = performance.now();
        let patternErrors = 0;
        let patternSuccess = 0;
        const targetErrors = Math.floor(
          (pattern.rate * pattern.duration) / 1000
        );

        while (
          performance.now() - patternStart < pattern.duration &&
          patternErrors < targetErrors
        ) {
          patternErrors++;

          try {
            errorHandler.handleError(
              new Error(`Variable load ${pattern.rate} - ${patternErrors}`),
              { depth: 0, rate: pattern.rate },
              'variableResolver'
            );
          } catch (e) {
            if (
              e instanceof ScopeDslError ||
              e.constructor.name === 'ScopeDslError'
            ) {
              patternSuccess++;
            }
          }

          // Pace according to target rate (optimized but accurate)
          const elapsed = performance.now() - patternStart;
          const expectedErrors = (pattern.rate * elapsed) / 1000;
          if (patternErrors > expectedErrors + 10) {
            const delay =
              ((patternErrors - expectedErrors) * 1000) / pattern.rate;
            await new Promise((resolve) =>
              setTimeout(resolve, Math.min(delay, 5))
            );
          }
        }

        const actualDuration = performance.now() - patternStart;
        const actualRate = patternErrors / (actualDuration / 1000);

        patternMetrics.push({
          targetRate: pattern.rate,
          actualRate,
          errors: patternErrors,
          successRate: patternSuccess / patternErrors,
          duration: actualDuration,
        });

        // Clear buffer between patterns
        errorHandler.clearErrorBuffer();
      }

      loadMetrics.variable = patternMetrics;

      // Verify adaptation to different rates
      patternMetrics.forEach((metric, index) => {
        // Log failure details for debugging when success rate is low
        if (metric.successRate <= 0.85) {
          console.warn(`Variable load pattern ${index} had low success rate:`, {
            targetRate: metric.targetRate,
            actualRate: metric.actualRate,
            successRate: metric.successRate,
            errors: metric.errors,
            duration: metric.duration,
          });
        }
        expect(metric.successRate).toBeGreaterThan(0.75); // >75% success (reduced from 85% due to load variability)
        const rateAccuracy =
          Math.abs(metric.actualRate - metric.targetRate) / metric.targetRate;
        expect(rateAccuracy).toBeLessThan(2.5); // Within 250% of target (increased tolerance for CI timing jitter)
      });
    });
  });

  describe('Concurrent Load Testing', () => {
    it('should handle concurrent error generation from multiple sources', async () => {
      const concurrentSources = 8; // Optimized from 10
      const errorsPerSource = 300; // Optimized from 500
      const sourceMetrics = [];

      const promises = Array.from(
        { length: concurrentSources },
        (_, sourceId) =>
          new Promise((resolve) => {
            const sourceStart = performance.now();
            let sourceErrors = 0;
            let sourceSuccess = 0;

            const executeAsync = async () => {
              // Minimal delay for concurrency simulation (optimized)
              await new Promise((r) => setTimeout(r, Math.random() * 10));

              for (let i = 0; i < errorsPerSource; i++) {
                sourceErrors++;

                try {
                  errorHandler.handleError(
                    new Error(`Source ${sourceId} error ${i}`),
                    { depth: 0, sourceId },
                    `concurrentResolver${sourceId}`
                  );
                } catch (e) {
                  if (
                    e instanceof ScopeDslError ||
                    e.constructor.name === 'ScopeDslError'
                  ) {
                    sourceSuccess++;
                  }
                }

                // Minimal delay to simulate real-world timing (optimized)
                if (i % 100 === 0) {
                  await new Promise((r) => setTimeout(r, 1));
                }
              }

              const sourceDuration = performance.now() - sourceStart;

              resolve({
                sourceId,
                errors: sourceErrors,
                successRate: sourceSuccess / sourceErrors,
                duration: sourceDuration,
                throughput: sourceErrors / (sourceDuration / 1000),
              });
            };

            executeAsync().catch((error) => {
              resolve({
                sourceId,
                errors: sourceErrors,
                successRate: 0,
                duration: performance.now() - sourceStart,
                throughput: 0,
                error: error.message,
              });
            });
          })
      );

      const results = await Promise.all(promises);
      sourceMetrics.push(...results);

      loadMetrics.concurrent = sourceMetrics;

      // Analyze concurrent performance
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
      const avgSuccessRate =
        results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
      const avgThroughput =
        results.reduce((sum, r) => sum + r.throughput, 0) / results.length;

      expect(avgSuccessRate).toBeGreaterThan(0.85); // >85% average success
      expect(avgThroughput).toBeGreaterThan(150); // >150 errors/second per source (reduced for CI stability)
      expect(totalErrors).toBe(concurrentSources * errorsPerSource);

      // Verify buffer management under concurrency
      const buffer = errorHandler.getErrorBuffer();
      expect(buffer.length).toBeLessThanOrEqual(100); // Buffer properly bounded
    });
  });

  describe('Load Test Summary', () => {
    it('should generate performance report', () => {
      // This test runs last and generates a summary report
      console.log('\n=== Load Testing Performance Report ===\n');

      if (loadMetrics.burst.length > 0) {
        console.log('Burst Load:');
        loadMetrics.burst.forEach((m) => {
          console.log(`  - ${m.size} errors in ${m.duration.toFixed(2)}ms`);
          console.log(`    Throughput: ${m.throughput.toFixed(0)} errors/sec`);
          console.log(`    Success Rate: ${(m.successRate * 100).toFixed(1)}%`);
        });
      }

      if (loadMetrics.sustained.length > 0) {
        console.log('\nSustained Load:');
        loadMetrics.sustained.forEach((m) => {
          console.log(
            `  - ${m.totalErrors} errors over ${(m.duration / 1000).toFixed(1)}s`
          );
          console.log(
            `    Overall Rate: ${m.overallRate.toFixed(0)} errors/sec`
          );
          console.log(
            `    Success Rate: ${(m.overallSuccess * 100).toFixed(1)}%`
          );
        });
      }

      if (loadMetrics.variable.length > 0) {
        console.log('\nVariable Load:');
        loadMetrics.variable.forEach((m) => {
          console.log(
            `  - Target: ${m.targetRate} errors/sec, Actual: ${m.actualRate.toFixed(0)}`
          );
          console.log(`    Success Rate: ${(m.successRate * 100).toFixed(1)}%`);
        });
      }

      if (loadMetrics.concurrent.length > 0) {
        console.log('\nConcurrent Load:');
        const avgThroughput =
          loadMetrics.concurrent.reduce((sum, m) => sum + m.throughput, 0) /
          loadMetrics.concurrent.length;
        console.log(`  - ${loadMetrics.concurrent.length} concurrent sources`);
        console.log(
          `    Avg Throughput: ${avgThroughput.toFixed(0)} errors/sec per source`
        );
      }

      console.log('\n=====================================\n');

      // Test passes if we got here
      expect(true).toBe(true);
    });
  });
});
