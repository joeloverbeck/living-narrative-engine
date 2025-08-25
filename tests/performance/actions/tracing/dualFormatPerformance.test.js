/**
 * @file Dual-format action tracing performance tests
 * @description Tests performance of dual-format trace generation with <10ms overhead requirement
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { ActionTraceOutputService } from '../../../../src/actions/tracing/actionTraceOutputService.js';
import {
  createMockJsonFormatter,
  createMockHumanReadableFormatterWithOptions,
} from '../../../common/mockFactories/actionTracing.js';

describe('Dual-Format Action Tracing Performance', () => {
  let testBed;
  let actionTraceOutputService;
  let performanceResults = [];

  beforeEach(async () => {
    testBed = createTestBed();

    // Configure for dual-format output
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

  afterEach(() => {
    testBed.cleanup?.();
    performanceResults = [];
  });

  describe('Format Generation Performance', () => {
    it('should generate dual format within performance threshold', async () => {
      const trace = await testBed.createActionAwareTrace({
        actorId: 'perf-test-actor',
        tracedActions: ['*'],
        verbosity: 'verbose',
        includeComponentData: true,
      });

      const iterations = 100;
      const times = [];

      // Warm-up phase
      for (let i = 0; i < 10; i++) {
        await actionTraceOutputService.writeTrace(trace);
      }

      // Actual measurement
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await actionTraceOutputService.writeTrace(trace);
        const endTime = performance.now();

        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const p95Time = times.sort((a, b) => a - b)[
        Math.floor(times.length * 0.95)
      ];

      console.log(
        `Performance metrics: avg=${avgTime.toFixed(2)}ms, p95=${p95Time.toFixed(2)}ms`
      );

      // Adjusted performance expectations based on current system capabilities
      expect(avgTime).toBeLessThan(5); // Dual format generation <5ms average
      expect(p95Time).toBeLessThan(15); // P95 <15ms

      performanceResults.push(avgTime);
    });

    it('should have acceptable overhead for dual-format vs JSON-only', async () => {
      const trace = await testBed.createActionAwareTrace({
        actorId: 'perf-test-actor',
        tracedActions: ['*'],
        verbosity: 'verbose',
        includeComponentData: true,
      });

      const iterations = 50;
      const dualTimes = [];
      const jsonOnlyTimes = [];

      // Test dual-format service
      const dualConfig = { outputFormats: ['json', 'text'] };
      const dualService = new ActionTraceOutputService({
        jsonFormatter: createMockJsonFormatter(),
        humanReadableFormatter: createMockHumanReadableFormatterWithOptions(),
        logger: testBed.mockLogger,
        actionTraceConfig: dualConfig,
        outputToFiles: false,
      });

      // Test JSON-only service
      const jsonConfig = { outputFormats: ['json'] };
      const jsonService = new ActionTraceOutputService({
        jsonFormatter: createMockJsonFormatter(),
        logger: testBed.mockLogger,
        actionTraceConfig: jsonConfig,
        outputToFiles: false,
      });

      // Benchmark dual-format
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await dualService.writeTrace(trace);
        const endTime = performance.now();
        dualTimes.push(endTime - startTime);
      }

      // Benchmark JSON-only
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await jsonService.writeTrace(trace);
        const endTime = performance.now();
        jsonOnlyTimes.push(endTime - startTime);
      }

      const avgDualTime =
        dualTimes.reduce((a, b) => a + b, 0) / dualTimes.length;
      const avgJsonTime =
        jsonOnlyTimes.reduce((a, b) => a + b, 0) / jsonOnlyTimes.length;
      const overhead = avgDualTime - avgJsonTime;

      console.log(
        `Dual: ${avgDualTime.toFixed(2)}ms, JSON: ${avgJsonTime.toFixed(2)}ms, Overhead: ${overhead.toFixed(2)}ms`
      );

      // Realistic overhead expectations
      expect(overhead).toBeLessThan(10); // <10ms additional overhead per spec
      expect(avgDualTime).toBeLessThan(20); // Total time should be reasonable
    });
  });

  describe('Statistical Analysis', () => {
    it('should provide percentile analysis of performance data', async () => {
      const trace = await testBed.createActionAwareTrace({
        actorId: 'stats-test-actor',
        tracedActions: ['*'],
        verbosity: 'standard',
      });

      const iterations = 100;
      const times = [];

      // Collect performance data
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await actionTraceOutputService.writeTrace(trace);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      // Calculate percentiles
      const sortedTimes = times.sort((a, b) => a - b);
      const p50 = sortedTimes[Math.floor(times.length * 0.5)];
      const p90 = sortedTimes[Math.floor(times.length * 0.9)];
      const p95 = sortedTimes[Math.floor(times.length * 0.95)];
      const p99 = sortedTimes[Math.floor(times.length * 0.99)];
      const min = Math.min(...times);
      const max = Math.max(...times);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;

      console.log('Performance Distribution:');
      console.log(`  Min: ${min.toFixed(2)}ms`);
      console.log(`  P50: ${p50.toFixed(2)}ms`);
      console.log(`  P90: ${p90.toFixed(2)}ms`);
      console.log(`  P95: ${p95.toFixed(2)}ms`);
      console.log(`  P99: ${p99.toFixed(2)}ms`);
      console.log(`  Max: ${max.toFixed(2)}ms`);
      console.log(`  Avg: ${avg.toFixed(2)}ms`);

      // Validate statistical characteristics
      expect(p50).toBeLessThan(10); // Median should be reasonable
      expect(p95).toBeLessThan(20); // 95% of operations should be fast
      expect(p99).toBeLessThan(50); // Even outliers should be acceptable
      expect(max).toBeLessThan(100); // Maximum should not be excessive
    });

    it('should show performance consistency across multiple runs', async () => {
      const runs = 5;
      const runResults = [];

      for (let run = 0; run < runs; run++) {
        const trace = await testBed.createActionAwareTrace({
          actorId: `consistency-test-${run}`,
          tracedActions: ['*'],
        });

        const iterations = 50;
        const times = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          await actionTraceOutputService.writeTrace(trace);
          const endTime = performance.now();
          times.push(endTime - startTime);
        }

        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        runResults.push(avg);
      }

      const overallAvg =
        runResults.reduce((a, b) => a + b, 0) / runResults.length;
      const variance =
        runResults.reduce(
          (acc, val) => acc + Math.pow(val - overallAvg, 2),
          0
        ) / runResults.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = (stdDev / overallAvg) * 100;

      console.log(
        `Run averages: ${runResults.map((r) => r.toFixed(2)).join(', ')}ms`
      );
      console.log(`Overall average: ${overallAvg.toFixed(2)}ms`);
      console.log(`Standard deviation: ${stdDev.toFixed(2)}ms`);
      console.log(
        `Coefficient of variation: ${coefficientOfVariation.toFixed(1)}%`
      );

      // Performance should be consistent (low coefficient of variation)
      expect(coefficientOfVariation).toBeLessThan(50); // <50% variation between runs
      expect(overallAvg).toBeLessThan(10); // Overall performance should be good
    });
  });
});
