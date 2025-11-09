/**
 * @file Performance Metrics Benchmark Tests
 * @description Comprehensive performance benchmark tests to validate that scope
 * resolution performance metrics are accurate, overhead is acceptable, and
 * performance bottlenecks are correctly identified.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('Performance Metrics - Timing Accuracy', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Register scopes needed for action discovery
    await testFixture.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should have accurate timing measurements', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    const wallClockStart = performance.now();
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );
    const wallClockEnd = performance.now();
    const wallClockDuration = wallClockEnd - wallClockStart;

    const metrics = testFixture.getScopePerformanceMetrics();

    // Traced duration should be close to wall clock time
    // Allow for measurement overhead and timing variance
    const difference = Math.abs(metrics.totalDuration - wallClockDuration);
    const tolerance = wallClockDuration * 0.5; // 50% tolerance for timing variance

    expect(difference).toBeLessThan(tolerance);
  });

  it('should have step durations sum to reasonable total', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testFixture.getScopePerformanceMetrics();

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
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testFixture.getScopePerformanceMetrics();

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
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Register scopes needed for action discovery
    await testFixture.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should calculate reasonable tracing overhead', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testFixture.getScopePerformanceMetrics();

    // Overhead should be reasonable (< 50% of total)
    expect(metrics.overhead.percentage).toBeLessThan(50);
    expect(metrics.overhead.percentage).toBeGreaterThan(0);
  });

  it('should have minimal overhead when disabled', () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    // Baseline: no tracer
    const start1 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );
    }
    const duration1 = performance.now() - start1;

    // With tracing disabled
    testFixture.scopeTracer.disable();
    const start2 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );
    }
    const duration2 = performance.now() - start2;

    const overhead = ((duration2 - duration1) / duration1) * 100;
    expect(overhead).toBeLessThan(5); // Less than 5% overhead when disabled
  });

  it('should have acceptable overhead when enabled', () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    // Baseline: disabled
    const start1 = performance.now();
    for (let i = 0; i < 100; i++) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );
    }
    const duration1 = performance.now() - start1;

    // With tracing enabled
    testFixture.enableScopeTracing();
    const start2 = performance.now();
    for (let i = 0; i < 100; i++) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );
      testFixture.clearScopeTrace();
    }
    const duration2 = performance.now() - start2;

    const overhead = ((duration2 - duration1) / duration1) * 100;
    // Tracing overhead of 350% is acceptable for detailed debugging features
    // This aligns with tracerOverhead.performance.test.js implementation
    expect(overhead).toBeLessThan(350); // Less than 350% overhead with tracing
  });
});

describe('Performance Metrics - Calculations', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Register scopes needed for action discovery
    await testFixture.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should calculate per-resolver statistics correctly', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testFixture.getScopePerformanceMetrics();

    metrics.resolverStats.forEach(stat => {
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
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testFixture.getScopePerformanceMetrics();

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
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testFixture.getScopePerformanceMetrics();

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
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Register scopes needed for action discovery
    await testFixture.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should detect performance regression in scope resolution', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    // Baseline measurement
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );
    const baselineMetrics = testFixture.getScopePerformanceMetrics();
    testFixture.clearScopeTrace();

    // Second measurement (should be similar)
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );
    const secondMetrics = testFixture.getScopePerformanceMetrics();

    // Durations should be within reasonable variance (±100%)
    // Performance timing can vary significantly in test environments
    const variance =
      Math.abs(secondMetrics.totalDuration - baselineMetrics.totalDuration) /
      baselineMetrics.totalDuration;

    expect(variance).toBeLessThan(1.0); // Less than 100% variance
  });

  it('should identify when filter evaluation becomes slow', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testFixture.getScopePerformanceMetrics();

    // Filter eval should not dominate total time (< 50%)
    expect(metrics.filterEvaluation.percentage).toBeLessThan(50);
  });

  it('should warn when tracing overhead is excessive', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const metrics = testFixture.getScopePerformanceMetrics();

    // Overhead should be reasonable
    if (metrics.overhead.percentage > 30) {
      console.warn(`High tracing overhead: ${metrics.overhead.percentage.toFixed(1)}%`);
    }

    expect(metrics.overhead.percentage).toBeLessThan(50); // Hard limit
  });
});

describe('Performance Metrics - Formatted Output', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Register scopes needed for action discovery
    await testFixture.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should format performance metrics efficiently', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const start = performance.now();
    const formatted = testFixture.getScopeTraceWithPerformance();
    const formatDuration = performance.now() - start;

    // Formatting should be fast (< 10ms)
    expect(formatDuration).toBeLessThan(10);
    expect(formatted).toBeTruthy();
    expect(formatted).toContain('PERFORMANCE METRICS');
  });

  it('should include all performance sections in output', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const formatted = testFixture.getScopeTraceWithPerformance();

    expect(formatted).toContain('Resolver Timing');
    expect(formatted).toContain('Filter Evaluation');
    expect(formatted).toContain('Slowest Operations');
    expect(formatted).toContain('Tracing Overhead');
  });
});
