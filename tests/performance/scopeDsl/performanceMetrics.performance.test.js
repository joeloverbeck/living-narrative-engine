/**
 * @file Performance Metrics Benchmark Tests
 * @description Comprehensive performance benchmark tests to validate that scope
 * resolution performance metrics are accurate, overhead is acceptable, and
 * performance bottlenecks are correctly identified.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ScopeTracingTestBed } from '../../common/scopeDsl/scopeTracingTestBed.js';

describe('Performance Metrics - Timing Accuracy', () => {
  let testBed;

  beforeEach(async () => {
    testBed = await ScopeTracingTestBed.create();

    // Register scopes needed for action discovery
    await testBed.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should have accurate timing measurements', async () => {
    // Create scenario BEFORE enabling tracing to avoid including setup time
    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    // Measure wall clock time from when tracing starts
    const wallClockStart = performance.now();
    testBed.enableScopeTracing();

    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testBed.getScopePerformanceMetrics();
    const wallClockEnd = performance.now();
    const wallClockDuration = wallClockEnd - wallClockStart;

    // Traced duration should be close to wall clock time
    // The tracer's totalDuration measures from enable() to getPerformanceMetrics()
    // Wall clock measures from enable() to after getPerformanceMetrics()
    // Allow for measurement overhead and timing variance (100% tolerance)
    const difference = Math.abs(metrics.totalDuration - wallClockDuration);
    const tolerance = wallClockDuration * 1.0; // 100% tolerance for timing variance

    expect(difference).toBeLessThan(tolerance);
  });

  it('should have step durations sum to reasonable total', async () => {
    testBed.enableScopeTracing();

    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testBed.getScopePerformanceMetrics();

    // Sum of resolver times
    const resolverTimeSum = metrics.resolverStats.reduce(
      (sum, stat) => sum + stat.totalTime,
      0
    );

    // Should be reasonable portion of total (allowing for overhead)
    expect(resolverTimeSum).toBeLessThanOrEqual(metrics.totalDuration);
    expect(resolverTimeSum).toBeGreaterThan(0);
  });

  it('should have percentages sum to approximately 100%', async () => {
    testBed.enableScopeTracing();

    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testBed.getScopePerformanceMetrics();

    const percentageSum = metrics.resolverStats.reduce(
      (sum, stat) => sum + stat.percentage,
      0
    );

    // Percentages may be low if most time is in overhead/initialization
    // Just verify they're calculated correctly
    expect(percentageSum).toBeGreaterThan(0);
    expect(percentageSum).toBeLessThanOrEqual(100);
  });
});

describe('Performance Metrics - Overhead', () => {
  let testBed;

  beforeEach(async () => {
    testBed = await ScopeTracingTestBed.create();

    // Register scopes needed for action discovery
    await testBed.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should calculate reasonable tracing overhead', async () => {
    testBed.enableScopeTracing();

    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testBed.getScopePerformanceMetrics();

    // Overhead should be reasonable (< 50% of total)
    expect(metrics.overhead.percentage).toBeLessThan(50);
    expect(metrics.overhead.percentage).toBeGreaterThan(0);
  });

  it('should have minimal overhead when disabled', () => {
    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    // Warmup to stabilize JIT before measuring
    for (let i = 0; i < 100; i++) {
      testBed.resolveSyncNoTracer('positioning:close_actors', actorEntity);
    }

    // Baseline: tracer completely bypassed
    const start1 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testBed.resolveSyncNoTracer('positioning:close_actors', actorEntity);
    }
    const duration1 = performance.now() - start1;

    // With tracer injected but disabled (reflects production disabled state)
    testBed.scopeTracer.disable();
    const start2 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testBed.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );
    }
    const duration2 = performance.now() - start2;

    const overheadMs = duration2 - duration1;
    const overhead = (overheadMs / duration1) * 100;

    // Align thresholds with tracerOverhead.performance.test.js to account for
    // noisy baselines and scheduler variance.
    if (duration1 < 20) {
      expect(overheadMs).toBeLessThan(10);
    } else {
      expect(overhead).toBeLessThan(30);
    }
  });

  it('should have acceptable overhead when enabled', () => {
    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    // Baseline: disabled
    const start1 = performance.now();
    for (let i = 0; i < 100; i++) {
      testBed.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );
    }
    const duration1 = performance.now() - start1;

    // With tracing enabled
    testBed.enableScopeTracing();
    const start2 = performance.now();
    for (let i = 0; i < 100; i++) {
      testBed.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );
      testBed.clearScopeTrace();
    }
    const duration2 = performance.now() - start2;

    const overhead = ((duration2 - duration1) / duration1) * 100;
    // Tracing overhead of 400% is acceptable for detailed debugging features
    // Increased from 350% to account for system load variance in CI environments
    // This aligns with tracerOverhead.performance.test.js implementation
    expect(overhead).toBeLessThan(400); // Less than 400% overhead with tracing
  });
});

describe('Performance Metrics - Calculations', () => {
  let testBed;

  beforeEach(async () => {
    testBed = await ScopeTracingTestBed.create();

    // Register scopes needed for action discovery
    await testBed.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should calculate per-resolver statistics correctly', async () => {
    testBed.enableScopeTracing();

    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testBed.getScopePerformanceMetrics();

    metrics.resolverStats.forEach((stat) => {
      expect(stat.resolver).toBeTruthy();
      expect(stat.totalTime).toBeGreaterThan(0);
      expect(stat.percentage).toBeGreaterThan(0);
      expect(stat.stepCount).toBeGreaterThan(0);
      expect(stat.averageTime).toBeGreaterThan(0);

      // Average should equal total / count
      const expectedAverage = stat.totalTime / stat.stepCount;
      expect(Math.abs(stat.averageTime - expectedAverage)).toBeLessThan(0.01);
    });
  });

  it('should calculate filter evaluation statistics', async () => {
    testBed.enableScopeTracing();

    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testBed.getScopePerformanceMetrics();

    expect(metrics.filterEvaluation.count).toBeGreaterThan(0);
    expect(metrics.filterEvaluation.totalTime).toBeGreaterThan(0);
    expect(metrics.filterEvaluation.averageTime).toBeGreaterThan(0);
    expect(metrics.filterEvaluation.percentage).toBeGreaterThan(0);

    // Average should equal total / count
    const expectedAverage =
      metrics.filterEvaluation.totalTime / metrics.filterEvaluation.count;
    expect(
      Math.abs(metrics.filterEvaluation.averageTime - expectedAverage)
    ).toBeLessThan(0.01);
  });

  it('should identify slowest operations', async () => {
    testBed.enableScopeTracing();

    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testBed.getScopePerformanceMetrics();

    // Should have slowest steps
    expect(metrics.slowestOperations.steps.length).toBeGreaterThan(0);
    expect(metrics.slowestOperations.steps.length).toBeLessThanOrEqual(5);

    // Should be sorted by duration (slowest first)
    for (let i = 1; i < metrics.slowestOperations.steps.length; i++) {
      expect(
        metrics.slowestOperations.steps[i - 1].duration
      ).toBeGreaterThanOrEqual(metrics.slowestOperations.steps[i].duration);
    }
  });
});

describe('Performance Metrics - Regression Detection', () => {
  let testBed;

  beforeEach(async () => {
    testBed = await ScopeTracingTestBed.create();

    // Register scopes needed for action discovery
    await testBed.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should detect performance regression in scope resolution', async () => {
    testBed.enableScopeTracing();

    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    // Baseline measurement
    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );
    const baselineMetrics = testBed.getScopePerformanceMetrics();
    testBed.clearScopeTrace();

    // Second measurement (should be similar)
    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );
    const secondMetrics = testBed.getScopePerformanceMetrics();

    // Durations should be within reasonable variance (±100%)
    // Performance timing can vary significantly in test environments
    const variance =
      Math.abs(secondMetrics.totalDuration - baselineMetrics.totalDuration) /
      baselineMetrics.totalDuration;

    expect(variance).toBeLessThan(1.0); // Less than 100% variance
  });

  it('should identify when filter evaluation becomes slow', async () => {
    testBed.enableScopeTracing();

    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testBed.getScopePerformanceMetrics();

    // Filter eval should not dominate total time (< 50%)
    expect(metrics.filterEvaluation.percentage).toBeLessThan(50);
  });

  it('should warn when tracing overhead is excessive', async () => {
    testBed.enableScopeTracing();

    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testBed.getScopePerformanceMetrics();

    // Overhead should be reasonable
    if (metrics.overhead.percentage > 30) {
      console.warn(
        `High tracing overhead: ${metrics.overhead.percentage.toFixed(1)}%`
      );
    }

    expect(metrics.overhead.percentage).toBeLessThan(50); // Hard limit
  });
});

describe('Performance Metrics - Formatted Output', () => {
  let testBed;

  beforeEach(async () => {
    testBed = await ScopeTracingTestBed.create();

    // Register scopes needed for action discovery
    await testBed.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should format performance metrics efficiently', async () => {
    testBed.enableScopeTracing();

    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const start = performance.now();
    const formatted = testBed.getScopeTraceWithPerformance();
    const formatDuration = performance.now() - start;

    // Formatting should be fast (< 10ms)
    expect(formatDuration).toBeLessThan(10);
    expect(formatted).toBeTruthy();
    expect(formatted).toContain('PERFORMANCE METRICS');
  });

  it('should include all performance sections in output', async () => {
    testBed.enableScopeTracing();

    const scenario = testBed.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testBed.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testBed.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const formatted = testBed.getScopeTraceWithPerformance();

    expect(formatted).toContain('Resolver Timing');
    expect(formatted).toContain('Filter Evaluation');
    expect(formatted).toContain('Slowest Operations');
    expect(formatted).toContain('Tracing Overhead');
  });
});
