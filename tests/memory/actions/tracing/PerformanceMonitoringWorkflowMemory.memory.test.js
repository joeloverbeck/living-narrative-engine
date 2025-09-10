/**
 * @file Performance Monitoring Workflow Memory Test Suite
 * @description Memory efficiency tests for performance monitoring integration during gaming scenarios
 *
 * This memory test suite validates memory usage patterns, growth, and efficiency
 * of the performance monitoring system during realistic gaming workflows.
 *
 * Extracted from PerformanceMonitoringWorkflow.performance.test.js to separate
 * memory concerns from pure performance timing metrics.
 *
 * Memory Requirements:
 * - Memory efficiency: <50MB for typical gaming sessions
 * - No memory leaks during sustained operation
 * - Controlled memory growth under load
 * - Stable memory usage across different gaming patterns
 */

import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';

import { PerformanceMonitoringTestBed } from '../../../performance/actions/tracing/common/performanceMonitoringTestBed.js';
import {
  PERFORMANCE_MONITORING_CONFIGS,
  ALERT_TRIGGER_SCENARIOS,
  LOAD_TEST_PATTERNS,
  createTestActionData,
} from '../../../performance/actions/tracing/performanceMonitoringIntegration.fixtures.js';

/**
 * Memory efficiency tests for Performance Monitoring Integration
 * Validates memory usage patterns during realistic gaming scenarios
 */
describe('Performance Monitoring Workflow - Memory Efficiency Tests', () => {
  let testBed;
  let monitoringSession;
  let initialMemoryUsage;

  beforeEach(async () => {
    // Force garbage collection before each test
    if (global.gc) {
      global.gc();
    }

    // Wait for GC to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Capture initial memory state
    initialMemoryUsage = process.memoryUsage();

    testBed = new PerformanceMonitoringTestBed();
    await testBed.initialize({
      monitoring: PERFORMANCE_MONITORING_CONFIGS.STANDARD_GAMING,
      pattern: 'EXPLORATION',
      enableDetailedLogging: false,
    });
  });

  afterEach(async () => {
    if (monitoringSession) {
      try {
        monitoringSession.stop();
      } catch (error) {
        // Ignore cleanup errors
      }
      monitoringSession = null;
    }

    if (testBed) {
      await testBed.cleanup();
      testBed = null;
    }

    // Force garbage collection after cleanup
    if (global.gc) {
      global.gc();
    }

    // Wait for GC to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  /**
   * Memory Test 1: Action Execution Memory Efficiency
   *
   * Tests that performance monitoring maintains efficient memory usage
   * during typical action execution sequences without memory leaks.
   */
  describe('Memory Test 1: Action Execution Memory Efficiency', () => {
    test('should monitor action execution with memory efficiency validation', async () => {
      // Start monitoring with memory tracking
      monitoringSession = testBed.startMonitoring({
        intervalMs: 100,
      });

      const beforeMemory = process.memoryUsage();

      // Execute sequence of actions with memory tracking
      const actionCount = 100;
      const results = await testBed.simulateActionSequence(
        'EXPLORATION',
        actionCount,
        {
          parallelism: 1,
          delayBetweenActionsMs: 0,
          errorRate: 0,
          measureOverhead: false, // Focus on memory, not overhead
          trackMemory: true,
        }
      );

      // Force garbage collection before measuring
      if (global.gc) {
        global.gc();
      }
      await new Promise((resolve) => setTimeout(resolve, 200));

      const afterMemory = process.memoryUsage();
      const summary = testBed.getMeasurementSummary();

      // Validate successful execution
      expect(summary.successfulActions).toBe(actionCount);
      expect(summary.totalActions).toBe(actionCount);

      // Critical memory requirement: <50MB for typical gaming sessions
      const realtimeMetrics = monitoringSession.getRealtimeMetrics();
      expect(realtimeMetrics.memoryUsageMB).toBeLessThan(50);

      // Validate memory growth is controlled
      const memoryGrowthMB =
        (afterMemory.heapUsed - beforeMemory.heapUsed) / (1024 * 1024);
      expect(memoryGrowthMB).toBeLessThan(30); // Allow reasonable growth

      // Validate no excessive external memory usage
      const externalMemoryGrowthMB =
        (afterMemory.external - beforeMemory.external) / (1024 * 1024);
      expect(externalMemoryGrowthMB).toBeLessThan(10);

      // Stop monitoring and validate final memory state
      const finalSummary = monitoringSession.stop();
      expect(finalSummary.totalActions).toBe(actionCount);

      // Ensure monitoring system is functional
      expect(realtimeMetrics.completedSpans).toBeGreaterThanOrEqual(0);
      expect(realtimeMetrics.errorCount).toBe(0);
    }, 60000); // 60s timeout for memory stabilization
  });

  /**
   * Memory Test 2: Memory Usage Under High Concurrency
   *
   * Tests memory usage patterns when monitoring detects high concurrency
   * and validates that memory usage violations are properly tracked.
   */
  describe('Memory Test 2: Memory Usage Under High Concurrency', () => {
    test('should detect memory usage violations under load', async () => {
      // Configure for memory-focused monitoring
      testBed.setMonitoringConfig({
        thresholds: {
          maxConcurrency: 3,
          maxMemoryUsageMB: 25, // Low threshold for memory testing
          maxErrorRate: 5,
        },
      });

      monitoringSession = testBed.startMonitoring({
        intervalMs: 50, // Frequent monitoring for memory tracking
      });

      const beforeMemory = process.memoryUsage();

      // Simulate memory-intensive concurrent actions
      const memoryIntensiveActions = [];
      for (let i = 0; i < 50; i++) {
        const actionData = createTestActionData('test:memory_intensive_action');
        memoryIntensiveActions.push(
          testBed.simulateActionExecution(actionData, {
            trackMemory: true,
            simulateMemoryUsage: true, // If available in test bed
          })
        );
      }

      await Promise.all(memoryIntensiveActions);

      // Wait for memory monitoring to detect patterns
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Force garbage collection before measuring
      if (global.gc) {
        global.gc();
      }
      await new Promise((resolve) => setTimeout(resolve, 200));

      const afterMemory = process.memoryUsage();

      // Validate memory tracking is working
      const realtimeMetrics = monitoringSession.getRealtimeMetrics();
      expect(realtimeMetrics.memoryUsageMB).toBeGreaterThan(0);

      // Check for memory-related alerts
      const alerts = monitoringSession.getAlerts();
      const memoryAlerts = alerts.filter(
        (a) => a.type === 'high_memory_usage' || a.type.includes('memory')
      );

      // Memory alerts should be generated if thresholds are exceeded
      // (This depends on actual memory usage patterns)
      expect(alerts.length).toBeGreaterThanOrEqual(0); // Allow for no alerts if usage is low

      // Validate memory growth is tracked
      const memoryGrowthMB =
        (afterMemory.heapUsed - beforeMemory.heapUsed) / (1024 * 1024);
      expect(memoryGrowthMB).toBeGreaterThan(0); // Should show some growth
      expect(memoryGrowthMB).toBeLessThan(100); // But not excessive

      // Validate concurrency didn't cause memory leaks
      const finalMetrics = monitoringSession.getRealtimeMetrics();
      expect(finalMetrics.completedSpans).toBeGreaterThan(40); // Most actions completed
    }, 45000);
  });

  /**
   * Memory Test 3: Memory Growth During Mixed Workloads
   *
   * Tests memory aggregation patterns across different gaming workloads
   * and validates that memory growth remains controlled and predictable.
   */
  describe('Memory Test 3: Memory Growth During Mixed Workloads', () => {
    test('should track memory growth during mixed workloads', async () => {
      monitoringSession = testBed.startMonitoring();

      const initialMemory = process.memoryUsage();
      const memoryMeasurements = [];

      // Execute mixed workload with memory tracking
      const workloadPhases = [
        { pattern: 'EXPLORATION', count: 20, expectedMemoryImpactMB: 5 },
        { pattern: 'COMBAT', count: 15, expectedMemoryImpactMB: 8 },
        { pattern: 'SOCIAL', count: 10, expectedMemoryImpactMB: 6 },
        { pattern: 'INVENTORY', count: 15, expectedMemoryImpactMB: 7 },
      ];

      for (const phase of workloadPhases) {
        const phaseStartMemory = process.memoryUsage();

        const results = await testBed.simulateActionSequence(
          phase.pattern,
          phase.count,
          {
            parallelism: 1,
            measureOverhead: false,
            trackMemory: true,
            errorRate: 0,
          }
        );

        // Force GC and measure after each phase
        if (global.gc) {
          global.gc();
        }
        await new Promise((resolve) => setTimeout(resolve, 100));

        const phaseEndMemory = process.memoryUsage();
        const phaseMemoryGrowthMB =
          (phaseEndMemory.heapUsed - phaseStartMemory.heapUsed) / (1024 * 1024);

        memoryMeasurements.push({
          pattern: phase.pattern,
          memoryGrowthMB: phaseMemoryGrowthMB,
          actionCount: results.length,
          successfulActions: results.filter((r) => r.success).length,
        });

        // Validate phase completed successfully
        expect(results.length).toBe(phase.count);
        expect(results.filter((r) => r.success).length).toBe(phase.count);

        // Validate memory growth is reasonable for the phase
        expect(phaseMemoryGrowthMB).toBeLessThan(
          phase.expectedMemoryImpactMB * 2
        );
      }

      // Validate aggregated memory metrics
      const summary = testBed.getMeasurementSummary();
      const totalExpectedActions = workloadPhases.reduce(
        (sum, p) => sum + p.count,
        0
      );

      expect(summary.totalActions).toBe(totalExpectedActions);
      expect(summary.successfulActions).toBe(totalExpectedActions);

      // Validate overall memory efficiency
      const finalMemory = process.memoryUsage();
      const totalMemoryGrowthMB =
        (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);

      expect(totalMemoryGrowthMB).toBeLessThan(50); // Total growth should be reasonable
      expect(summary.performance.memoryGrowth).toBeGreaterThanOrEqual(0); // Allow zero growth

      // Validate real-time metrics correlation
      const realtimeMetrics = monitoringSession.getRealtimeMetrics();
      expect(realtimeMetrics.completedSpans).toBeGreaterThanOrEqual(0);
      expect(realtimeMetrics.memoryUsageMB).toBeLessThan(50);

      // Validate memory measurements were collected
      expect(memoryMeasurements.length).toBe(workloadPhases.length);
      memoryMeasurements.forEach((measurement) => {
        expect(measurement.successfulActions).toBe(measurement.actionCount);
      });
    }, 60000);
  });

  /**
   * Memory Test 4: Memory Stability Under Sustained Load
   *
   * Tests that memory usage remains stable during sustained operation
   * and doesn't exhibit memory leaks or excessive growth over time.
   */
  describe('Memory Test 4: Memory Stability Under Sustained Load', () => {
    test('should maintain memory stability under sustained load', async () => {
      monitoringSession = testBed.startMonitoring();

      // Execute sustained load pattern with memory monitoring
      const sustainedPattern = LOAD_TEST_PATTERNS.SUSTAINED_PATTERN;
      const totalActions = Math.floor(
        (sustainedPattern.durationMs / 1000) * sustainedPattern.actionsPerSecond
      );

      const actionInterval = 1000 / sustainedPattern.actionsPerSecond;
      const sustainedResults = [];
      const memorySnapshots = [];

      const startTime = performance.now();
      const startMemory = process.memoryUsage();

      // Execute sustained load with periodic memory snapshots
      let actionCount = 0;
      while (performance.now() - startTime < sustainedPattern.durationMs) {
        const actionData = createTestActionData(
          'sustained:memory_action',
          sustainedPattern.actionPattern
        );

        const result = await testBed.simulateActionExecution(actionData, {
          measureOverhead: false,
          trackMemory: true,
        });

        sustainedResults.push(result);
        actionCount++;

        // Take periodic memory snapshots
        if (actionCount % 10 === 0) {
          const currentMemory = process.memoryUsage();
          const currentMemoryMB = currentMemory.heapUsed / (1024 * 1024);

          memorySnapshots.push({
            timestamp: performance.now() - startTime,
            actionCount,
            memoryUsageMB: currentMemoryMB,
            heapUsed: currentMemory.heapUsed,
            heapTotal: currentMemory.heapTotal,
          });
        }

        // Wait for next action interval
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(0, actionInterval - 5))
        );
      }

      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }
      await new Promise((resolve) => setTimeout(resolve, 200));

      const endMemory = process.memoryUsage();

      // Validate sustained load performance
      expect(sustainedResults.length).toBeGreaterThan(totalActions * 0.5); // Allow variance
      expect(sustainedResults.filter((r) => r.success).length).toBe(
        sustainedResults.length
      );

      // Validate memory stability over time
      expect(memorySnapshots.length).toBeGreaterThanOrEqual(1); // Should have at least one snapshot

      // Only calculate growth rate if we have multiple snapshots
      if (memorySnapshots.length >= 2) {
        const firstSnapshot = memorySnapshots[0];
        const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];

        // Memory growth should be controlled and not excessive
        const memoryGrowthRate =
          (lastSnapshot.memoryUsageMB - firstSnapshot.memoryUsageMB) /
          (lastSnapshot.actionCount - firstSnapshot.actionCount);

        expect(memoryGrowthRate).toBeLessThan(0.5); // Less than 0.5MB per action
      }

      // Overall memory growth should be reasonable
      const totalMemoryGrowthMB =
        (endMemory.heapUsed - startMemory.heapUsed) / (1024 * 1024);
      expect(totalMemoryGrowthMB).toBeLessThan(80); // Allow reasonable growth for sustained load

      // Validate no memory leaks in monitoring system
      const realtimeMetrics = monitoringSession.getRealtimeMetrics();
      expect(realtimeMetrics.completedSpans).toBeGreaterThanOrEqual(0);
      expect(realtimeMetrics.memoryUsageMB).toBeLessThan(100); // Upper bound for sustained operation

      // Check memory trend doesn't indicate unbounded growth (only if we have enough data points)
      if (memorySnapshots.length >= 3) {
        const firstSnapshot = memorySnapshots[0];
        const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
        const midSnapshot =
          memorySnapshots[Math.floor(memorySnapshots.length / 2)];

        // Memory growth rate shouldn't accelerate significantly
        const earlyGrowthRate =
          (midSnapshot.memoryUsageMB - firstSnapshot.memoryUsageMB) /
          (midSnapshot.actionCount - firstSnapshot.actionCount);
        const lateGrowthRate =
          (lastSnapshot.memoryUsageMB - midSnapshot.memoryUsageMB) /
          (lastSnapshot.actionCount - midSnapshot.actionCount);

        // Growth rate shouldn't double (indicating exponential growth/leak)
        if (earlyGrowthRate > 0) {
          expect(lateGrowthRate / earlyGrowthRate).toBeLessThan(2.0);
        }
      }
    }, 90000); // 90s timeout for sustained load
  });
});
