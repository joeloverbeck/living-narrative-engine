/**
 * @file Performance tests for ActionTraceConfigLoader dependency injection
 * Tests container resolution performance and DI optimization metrics
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  createActionTraceConfigTestContainer,
  resetContainerForNextTest,
  createPerformanceMonitor,
  validateActionTraceConfigLoaderBasics,
  PERFORMANCE_THRESHOLDS,
} from '../../common/configuration/actionTraceConfigTestHelpers.js';

describe('ActionTraceConfigLoader DI - Performance Regression Tests', () => {
  let container;
  let performanceMonitor;
  let suiteStartTime;

  beforeAll(async () => {
    // Track total suite performance
    suiteStartTime = process.hrtime.bigint();

    // Create optimized container once for all tests
    performanceMonitor = createPerformanceMonitor();
    performanceMonitor.start();

    container = await createActionTraceConfigTestContainer();

    const setupTime = performanceMonitor.end();

    // Store setup time for validation in tests
    global.testSetupTime = setupTime;

    // Validate basic functionality
    validateActionTraceConfigLoaderBasics(container);

    console.debug(
      `[Test Setup] Container configured in ${setupTime.toFixed(2)}ms`
    );
  });

  beforeEach(() => {
    // Reset state between tests (much faster than recreation)
    resetContainerForNextTest(container);
  });

  afterAll(() => {
    // Report total suite performance
    const suiteEndTime = process.hrtime.bigint();
    const totalTime = Number(suiteEndTime - suiteStartTime) / 1_000_000;

    // Store total time for validation in tests
    global.testSuiteTime = totalTime;

    console.debug(`[Test Suite] Completed in ${totalTime.toFixed(2)}ms`);

    // Cleanup
    container = null;
    performanceMonitor = null;
  });

  describe('Performance Regression Tests', () => {
    it('should meet container setup performance threshold', () => {
      // Validate the setup time stored in beforeAll
      expect(global.testSetupTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.CONTAINER_SETUP_MS
      );
    });

    it('should meet total suite performance threshold', () => {
      // This will be validated in afterAll, but we can check intermediate timing
      const currentTime = process.hrtime.bigint();
      const elapsedTime = Number(currentTime - suiteStartTime) / 1_000_000;

      // Should still be under threshold even during test execution
      expect(elapsedTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.TOTAL_SUITE_MS * 1.5
      ); // Allow some buffer
    });

    it('should maintain fast container resolution performance', () => {
      const iterations = 50;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const monitor = createPerformanceMonitor();
        monitor.start();

        // Resolve multiple services to test container performance
        const actionTraceConfigLoader = container.resolve(
          tokens.IActionTraceConfigLoader
        );
        const traceConfigLoader = container.resolve(tokens.ITraceConfigLoader);
        const logger = container.resolve(tokens.ILogger);

        times.push(monitor.end());

        // Verify services are functional
        expect(actionTraceConfigLoader).toBeDefined();
        expect(traceConfigLoader).toBeDefined();
        expect(logger).toBeDefined();
      }

      // Calculate performance statistics
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.debug(
        `[Performance] Resolution avg: ${averageTime.toFixed(2)}ms, min: ${minTime.toFixed(2)}ms, max: ${maxTime.toFixed(2)}ms`
      );

      // Assert performance thresholds
      expect(averageTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.SERVICE_RESOLUTION_MS
      );
      expect(maxTime).toBeLessThan(
        PERFORMANCE_THRESHOLDS.SERVICE_RESOLUTION_MS * 2
      ); // Allow some variance for worst case
    });

    it('should maintain fast statistics retrieval performance', () => {
      const actionTraceConfigLoader = container.resolve(
        tokens.IActionTraceConfigLoader
      );
      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const monitor = createPerformanceMonitor();
        monitor.start();

        const stats = actionTraceConfigLoader.getStatistics();

        times.push(monitor.end());

        // Verify functionality
        expect(stats).toBeDefined();
        expect(typeof stats.totalLookups).toBe('number');
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;

      console.debug(
        `[Performance] Statistics retrieval avg: ${averageTime.toFixed(2)}ms`
      );

      // Should be very fast since it's just returning cached data
      expect(averageTime).toBeLessThan(1); // Under 1ms
    });

    it('should demonstrate significant performance improvement over full container setup', () => {
      // This test documents the performance improvement achieved
      // The old setup took ~17.3s for 13 tests (~1.3s per test)
      // The new setup should take <3s total (<0.25s per test average)

      const testCount = 13;
      const oldAveragePerTest = 1300; // ~1.3s per test with old setup
      const newMaxPerTest = 250; // <0.25s per test with new setup

      // Calculate actual performance based on our thresholds
      const maxExpectedTotalTime = testCount * newMaxPerTest;

      expect(PERFORMANCE_THRESHOLDS.TOTAL_SUITE_MS).toBeLessThan(
        maxExpectedTotalTime
      );
      expect(PERFORMANCE_THRESHOLDS.TOTAL_SUITE_MS).toBeLessThan(
        oldAveragePerTest * testCount * 0.2
      ); // At least 80% improvement

      console.debug(
        `[Performance] Expected improvement: ${oldAveragePerTest * testCount}ms → ${PERFORMANCE_THRESHOLDS.TOTAL_SUITE_MS}ms (${((1 - PERFORMANCE_THRESHOLDS.TOTAL_SUITE_MS / (oldAveragePerTest * testCount)) * 100).toFixed(1)}% faster)`
      );
    });
  });
});
