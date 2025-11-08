# MODTESDIAIMP-017: Write Performance Benchmark Tests

**Phase**: 5 - Performance Metrics
**Priority**: 🟡 High
**Estimated Effort**: 2 hours
**Dependencies**: MODTESDIAIMP-016

---

## Overview

Create comprehensive performance benchmark tests to validate that scope resolution performance metrics are accurate, overhead is acceptable, and performance bottlenecks are correctly identified.

## Objectives

- Verify timing accuracy
- Validate overhead calculations
- Test performance metric calculations
- Benchmark tracer overhead
- Identify performance regression detection

## Test Files

### Main Performance Test Suite
**File**: `tests/performance/scopeDsl/performanceMetrics.performance.test.js` (new)

### Supporting Files
- `tests/performance/scopeDsl/tracerOverhead.performance.test.js` (from MODTESDIAIMP-012)

## Test Specifications

### Suite 1: Timing Accuracy

```javascript
describe('Performance Metrics - Timing Accuracy', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should have accurate timing measurements', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    const wallClockStart = performance.now();
    testFixture.testEnv.getAvailableActions(scenario.actor.id);
    const wallClockEnd = performance.now();
    const wallClockDuration = wallClockEnd - wallClockStart;

    const metrics = testFixture.getScopePerformanceMetrics();

    // Traced duration should be close to wall clock time
    // Allow for measurement overhead
    const difference = Math.abs(metrics.totalDuration - wallClockDuration);
    const tolerance = wallClockDuration * 0.2; // 20% tolerance

    expect(difference).toBeLessThan(tolerance);
  });

  it('should have step durations sum to reasonable total', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

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
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

    const metrics = testFixture.getScopePerformanceMetrics();

    const percentageSum = metrics.resolverStats.reduce(
      (sum, stat) => sum + stat.percentage,
      0
    );

    // Allow for rounding and overhead
    expect(percentageSum).toBeGreaterThan(80);
    expect(percentageSum).toBeLessThan(120);
  });
});
```

### Suite 2: Overhead Validation

```javascript
describe('Performance Metrics - Overhead', () => {
  it('should calculate reasonable tracing overhead', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

    const metrics = testFixture.getScopePerformanceMetrics();

    // Overhead should be reasonable (< 50% of total)
    expect(metrics.overhead.percentage).toBeLessThan(50);
    expect(metrics.overhead.percentage).toBeGreaterThan(0);
  });

  it('should have minimal overhead when disabled', () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Benchmark without tracing
    const start1 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testFixture.testEnv.getAvailableActions(scenario.actor.id);
    }
    const duration1 = performance.now() - start1;

    // With tracing disabled
    testFixture.scopeTracer.disable();
    const start2 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testFixture.testEnv.getAvailableActions(scenario.actor.id);
    }
    const duration2 = performance.now() - start2;

    const overhead = ((duration2 - duration1) / duration1) * 100;
    expect(overhead).toBeLessThan(5); // Less than 5% overhead when disabled
  });

  it('should have acceptable overhead when enabled', () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Baseline: disabled
    const start1 = performance.now();
    for (let i = 0; i < 100; i++) {
      testFixture.testEnv.getAvailableActions(scenario.actor.id);
    }
    const duration1 = performance.now() - start1;

    // With tracing enabled
    testFixture.enableScopeTracing();
    const start2 = performance.now();
    for (let i = 0; i < 100; i++) {
      testFixture.testEnv.getAvailableActions(scenario.actor.id);
      testFixture.clearScopeTrace();
    }
    const duration2 = performance.now() - start2;

    const overhead = ((duration2 - duration1) / duration1) * 100;
    expect(overhead).toBeLessThan(40); // Less than 40% overhead with full tracing
  });
});
```

### Suite 3: Performance Metric Calculations

```javascript
describe('Performance Metrics - Calculations', () => {
  it('should calculate per-resolver statistics correctly', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

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
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

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
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

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
```

### Suite 4: Performance Regression Detection

```javascript
describe('Performance Metrics - Regression Detection', () => {
  it('should detect performance regression in scope resolution', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Baseline measurement
    testFixture.testEnv.getAvailableActions(scenario.actor.id);
    const baselineMetrics = testFixture.getScopePerformanceMetrics();
    testFixture.clearScopeTrace();

    // Second measurement (should be similar)
    testFixture.testEnv.getAvailableActions(scenario.actor.id);
    const secondMetrics = testFixture.getScopePerformanceMetrics();

    // Durations should be within reasonable variance (±50%)
    const variance =
      Math.abs(secondMetrics.totalDuration - baselineMetrics.totalDuration) /
      baselineMetrics.totalDuration;

    expect(variance).toBeLessThan(0.5); // Less than 50% variance
  });

  it('should identify when filter evaluation becomes slow', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

    const metrics = testFixture.getScopePerformanceMetrics();

    // Filter eval should not dominate total time (< 50%)
    expect(metrics.filterEvaluation.percentage).toBeLessThan(50);
  });

  it('should warn when tracing overhead is excessive', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

    const metrics = testFixture.getScopePerformanceMetrics();

    // Overhead should be reasonable
    if (metrics.overhead.percentage > 30) {
      console.warn(`High tracing overhead: ${metrics.overhead.percentage.toFixed(1)}%`);
    }

    expect(metrics.overhead.percentage).toBeLessThan(50); // Hard limit
  });
});
```

### Suite 5: Formatted Output Performance

```javascript
describe('Performance Metrics - Formatted Output', () => {
  it('should format performance metrics efficiently', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

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
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

    const formatted = testFixture.getScopeTraceWithPerformance();

    expect(formatted).toContain('Resolver Timing');
    expect(formatted).toContain('Filter Evaluation');
    expect(formatted).toContain('Slowest Operations');
    expect(formatted).toContain('Tracing Overhead');
  });
});
```

## Acceptance Criteria

### Timing Accuracy
- ✅ Measurements within 20% of wall clock time
- ✅ Step durations sum to reasonable total
- ✅ Percentages sum to ~100%

### Overhead Validation
- ✅ < 5% overhead when disabled
- ✅ < 40% overhead when enabled
- ✅ Overhead calculation reasonable

### Metric Calculations
- ✅ Per-resolver stats accurate
- ✅ Filter eval stats accurate
- ✅ Slowest operations identified correctly
- ✅ Averages calculated correctly

### Regression Detection
- ✅ Performance variance < 50%
- ✅ Filter eval time reasonable
- ✅ Overhead warnings triggered

### Output Performance
- ✅ Formatting completes < 10ms
- ✅ All sections included
- ✅ Output is readable

## Test Execution

```bash
# Run performance metric tests
npm run test:performance -- tests/performance/scopeDsl/performanceMetrics.performance.test.js

# Run with extended timeout
npm run test:performance -- tests/performance/scopeDsl/performanceMetrics.performance.test.js --testTimeout=10000

# Run all scopeDsl performance tests
npm run test:performance -- tests/performance/scopeDsl/
```

## Success Metrics

- ✅ All tests pass
- ✅ No performance regressions detected
- ✅ Overhead within acceptable limits
- ✅ Timing measurements accurate
- ✅ No eslint errors

## Example Test Output

```javascript
✓ should have accurate timing measurements (125ms)
✓ should calculate reasonable tracing overhead (230ms)
✓ should have minimal overhead when disabled (1850ms)
✓ should have acceptable overhead when enabled (980ms)
✓ should calculate per-resolver statistics correctly (95ms)
✓ should identify slowest operations (110ms)

Performance Summary:
  Total Duration: 45.23ms
  Resolver Overhead: 4.2%
  Filter Eval Time: 8.5%
  Tracing Overhead: 12.1%

Regression Check: PASS (variance: 8.3%)
```

## References

- **Spec Section**: 7.4 Performance Profiling (lines 2538-2604)
- **Spec Section**: 5. Performance Metrics (lines 1609-1714)
- **Related Tickets**:
  - MODTESDIAIMP-016 (Performance metrics implementation)
  - MODTESDIAIMP-012 (Tracer overhead tests)
