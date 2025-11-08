# MODTESDIAIMP-016: Extend Tracer with Performance Metrics

**Phase**: 5 - Performance Metrics
**Priority**: 🟢 Medium
**Estimated Effort**: 3 hours
**Dependencies**: MODTESDIAIMP-009, MODTESDIAIMP-011

---

## Overview

Extend ScopeEvaluationTracer with detailed performance timing metrics, enabling identification of performance bottlenecks in scope resolution and providing actionable optimization insights.

## Objectives

- Add precise timing to each resolver step
- Track cumulative time per resolver type
- Calculate timing percentages
- Identify slowest operations
- Provide performance summary
- Support performance-focused formatting

## Implementation Details

### File to Modify
- **Path**: `tests/common/mods/scopeEvaluationTracer.js`
- **Class**: `ScopeEvaluationTracer`

### New Private Fields

```javascript
export class ScopeEvaluationTracer {
  #enabled = false;
  #steps = [];
  #startTime = null;
  #performanceMetrics = {
    resolverTimes: new Map(),  // resolver name → total time
    stepTimes: [],             // individual step durations
    filterEvalTimes: [],       // individual filter eval durations
  };
}
```

### Modify enable() Method

```javascript
/**
 * Enable tracing and reset metrics
 */
enable() {
  this.#enabled = true;
  this.#startTime = performance.now();
  this.clear();
}
```

### Modify logStep() Method

```javascript
/**
 * Log a resolver step with timing
 * @param {string} resolverName - Name of resolver
 * @param {string} operation - Operation description
 * @param {*} input - Input value
 * @param {*} output - Output value
 * @param {object} details - Additional details
 */
logStep(resolverName, operation, input, output, details = {}) {
  if (!this.#enabled) return;

  const stepStartTime = performance.now();

  // Measure serialization time (part of step overhead)
  const serializedInput = this.#serializeValue(input);
  const serializedOutput = this.#serializeValue(output);

  const stepEndTime = performance.now();
  const stepDuration = stepEndTime - stepStartTime;

  // Update performance metrics
  const currentTotal = this.#performanceMetrics.resolverTimes.get(resolverName) || 0;
  this.#performanceMetrics.resolverTimes.set(resolverName, currentTotal + stepDuration);
  this.#performanceMetrics.stepTimes.push({
    resolver: resolverName,
    duration: stepDuration,
    timestamp: stepEndTime,
  });

  this.#steps.push({
    timestamp: stepEndTime,
    type: 'RESOLVER_STEP',
    resolver: resolverName,
    operation,
    input: serializedInput,
    output: serializedOutput,
    details,
    duration: stepDuration,  // ADD: duration in milliseconds
  });
}
```

### Modify logFilterEvaluation() Method

```javascript
/**
 * Log filter evaluation with timing
 * @param {string} entityId - Entity being evaluated
 * @param {object} logic - JSON Logic expression
 * @param {boolean} result - Pass/fail result
 * @param {object} evalContext - Evaluation context
 * @param {object|null} breakdown - Clause breakdown analysis
 */
logFilterEvaluation(entityId, logic, result, evalContext, breakdown = null) {
  if (!this.#enabled) return;

  const evalStartTime = performance.now();

  // Measure serialization time
  const serializedLogic = this.#serializeValue(logic);
  const serializedContext = this.#serializeObject(evalContext);
  const serializedBreakdown = breakdown ? this.#serializeBreakdown(breakdown) : null;

  const evalEndTime = performance.now();
  const evalDuration = evalEndTime - evalStartTime;

  // Track filter eval time
  this.#performanceMetrics.filterEvalTimes.push({
    entityId,
    duration: evalDuration,
    timestamp: evalEndTime,
  });

  this.#steps.push({
    timestamp: evalEndTime,
    type: 'FILTER_EVALUATION',
    entityId,
    logic: serializedLogic,
    result,
    context: serializedContext,
    breakdown: serializedBreakdown,
    duration: evalDuration,  // ADD: duration in milliseconds
  });
}
```

### Add Performance Summary Calculation

```javascript
/**
 * Calculate performance metrics summary
 * @returns {object} Performance summary
 */
getPerformanceMetrics() {
  if (!this.#enabled && this.#steps.length === 0) {
    return null;
  }

  const endTime = performance.now();
  const totalDuration = endTime - this.#startTime;

  // Calculate per-resolver timing
  const resolverStats = [];
  for (const [resolver, time] of this.#performanceMetrics.resolverTimes) {
    resolverStats.push({
      resolver,
      totalTime: time,
      percentage: (time / totalDuration) * 100,
      stepCount: this.#performanceMetrics.stepTimes.filter(
        s => s.resolver === resolver
      ).length,
      averageTime: time / this.#performanceMetrics.stepTimes.filter(
        s => s.resolver === resolver
      ).length,
    });
  }

  // Sort by total time (slowest first)
  resolverStats.sort((a, b) => b.totalTime - a.totalTime);

  // Calculate filter evaluation stats
  const filterEvalCount = this.#performanceMetrics.filterEvalTimes.length;
  const totalFilterTime = this.#performanceMetrics.filterEvalTimes.reduce(
    (sum, f) => sum + f.duration,
    0
  );

  // Identify slowest operations
  const slowestSteps = [...this.#performanceMetrics.stepTimes]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5);

  const slowestFilters = [...this.#performanceMetrics.filterEvalTimes]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5);

  return {
    totalDuration,
    resolverStats,
    filterEvaluation: {
      count: filterEvalCount,
      totalTime: totalFilterTime,
      averageTime: filterEvalCount > 0 ? totalFilterTime / filterEvalCount : 0,
      percentage: (totalFilterTime / totalDuration) * 100,
    },
    slowestOperations: {
      steps: slowestSteps,
      filters: slowestFilters,
    },
    overhead: {
      tracingTime: this.#calculateTracingOverhead(),
      percentage: (this.#calculateTracingOverhead() / totalDuration) * 100,
    },
  };
}

/**
 * Calculate tracing overhead (serialization time)
 * @private
 */
#calculateTracingOverhead() {
  // Sum of all step durations (includes serialization overhead)
  const stepOverhead = this.#performanceMetrics.stepTimes.reduce(
    (sum, s) => sum + s.duration,
    0
  );
  const filterOverhead = this.#performanceMetrics.filterEvalTimes.reduce(
    (sum, f) => sum + f.duration,
    0
  );
  return stepOverhead + filterOverhead;
}
```

### Enhance format() Method

```javascript
/**
 * Format trace with optional performance focus
 * @param {object} options - Formatting options
 * @returns {string} Formatted trace
 */
format(options = {}) {
  const { performanceFocus = false } = options;

  if (this.#steps.length === 0) {
    return 'No trace data available';
  }

  let output = 'SCOPE EVALUATION TRACE:\n';
  output += '='.repeat(80) + '\n\n';

  if (performanceFocus) {
    // Performance-focused output
    const metrics = this.getPerformanceMetrics();

    output += '📊 PERFORMANCE METRICS:\n\n';

    output += 'Resolver Timing:\n';
    metrics.resolverStats.forEach(stat => {
      output += `  ${stat.resolver.padEnd(20)} ${stat.totalTime.toFixed(2)}ms `;
      output += `(${stat.percentage.toFixed(1)}%) `;
      output += `[${stat.stepCount} steps, avg: ${stat.averageTime.toFixed(2)}ms]\n`;
    });

    output += '\nFilter Evaluation:\n';
    output += `  Count: ${metrics.filterEvaluation.count}\n`;
    output += `  Total Time: ${metrics.filterEvaluation.totalTime.toFixed(2)}ms\n`;
    output += `  Average: ${metrics.filterEvaluation.averageTime.toFixed(2)}ms\n`;
    output += `  Percentage: ${metrics.filterEvaluation.percentage.toFixed(1)}%\n`;

    if (metrics.slowestOperations.steps.length > 0) {
      output += '\nSlowest Operations:\n';
      metrics.slowestOperations.steps.slice(0, 3).forEach((step, i) => {
        output += `  ${i + 1}. ${step.resolver}: ${step.duration.toFixed(2)}ms\n`;
      });
    }

    output += '\nTracing Overhead:\n';
    output += `  Time: ${metrics.overhead.tracingTime.toFixed(2)}ms\n`;
    output += `  Percentage: ${metrics.overhead.percentage.toFixed(1)}%\n`;

    output += '\n';
  }

  // Standard step-by-step output
  let stepNumber = 1;

  for (const step of this.#steps) {
    if (step.type === 'RESOLVER_STEP') {
      output += `${stepNumber}. [${step.resolver}] ${step.operation}`;
      if (performanceFocus) {
        output += ` (${step.duration.toFixed(2)}ms)`;
      }
      output += '\n';
      output += `   Input: ${this.#formatValue(step.input)}\n`;
      output += `   Output: ${this.#formatValue(step.output)}\n\n`;
      stepNumber++;
    } else if (step.type === 'FILTER_EVALUATION') {
      output += `   Entity: ${step.entityId}`;
      if (performanceFocus) {
        output += ` (${step.duration.toFixed(2)}ms)`;
      }
      output += '\n';
      output += `   Result: ${step.result ? 'PASS ✓' : 'FAIL ✗'}\n`;

      if (step.breakdown) {
        output += this.#formatBreakdown(step.breakdown, '   ');
      }

      output += '\n';
    }
  }

  // Summary section
  const summary = this.#calculateSummary();
  output += '='.repeat(80) + '\n';
  output += `Summary: ${summary.totalSteps} steps, ${summary.duration}ms, `;
  output += `Final size: ${summary.finalOutput?.size ?? 0}\n`;

  return output;
}
```

### Add ModTestFixture Methods

**File**: `tests/common/mods/ModTestFixture.js`

```javascript
/**
 * Get performance metrics from tracer
 * @returns {object|null} Performance metrics
 */
getScopePerformanceMetrics() {
  return this.scopeTracer.getPerformanceMetrics();
}

/**
 * Get formatted trace with performance focus
 * @returns {string} Performance-focused trace
 */
getScopeTraceWithPerformance() {
  return this.scopeTracer.format({ performanceFocus: true });
}
```

## Acceptance Criteria

### Timing Capture
- ✅ Each step has duration in milliseconds
- ✅ Filter evaluations have duration
- ✅ Timestamps preserved
- ✅ High-resolution timing (performance.now())

### Performance Metrics
- ✅ Per-resolver total time calculated
- ✅ Per-resolver percentages calculated
- ✅ Filter eval statistics calculated
- ✅ Slowest operations identified
- ✅ Tracing overhead calculated

### Formatted Output
- ✅ Performance-focused format option
- ✅ Resolver timing table
- ✅ Filter eval statistics
- ✅ Slowest operations list
- ✅ Overhead percentage shown

### Accuracy
- ✅ Timing measurements accurate
- ✅ Percentages sum correctly
- ✅ Overhead calculation reasonable

### Backward Compatibility
- ✅ Standard format still works
- ✅ Existing tests pass
- ✅ Optional performance focus

## Testing Requirements

**Test File**: `tests/unit/common/mods/scopeEvaluationTracer.performance.test.js` (new)

### Test Cases

```javascript
describe('ScopeEvaluationTracer - Performance Metrics', () => {
  describe('Timing capture', () => {
    it('should capture step duration')
    it('should capture filter eval duration')
    it('should use high-resolution timer')
  });

  describe('Performance metrics calculation', () => {
    it('should calculate per-resolver totals')
    it('should calculate percentages')
    it('should identify slowest operations')
    it('should calculate filter eval stats')
    it('should calculate tracing overhead')
  });

  describe('Performance-focused formatting', () => {
    it('should format resolver timing table')
    it('should format filter eval stats')
    it('should show slowest operations')
    it('should show overhead percentage')
  });

  describe('Accuracy', () => {
    it('should have accurate timing measurements')
    it('should have percentages sum to ~100%')
    it('should have reasonable overhead calculation')
  });
});
```

## Usage Example

```javascript
it('analyze scope resolution performance', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
  testFixture.testEnv.getAvailableActions(scenario.actor.id);

  const metrics = testFixture.getScopePerformanceMetrics();

  console.log('Performance Metrics:');
  console.log(`Total Duration: ${metrics.totalDuration.toFixed(2)}ms`);
  console.log('\nResolver Timing:');
  metrics.resolverStats.forEach(stat => {
    console.log(
      `  ${stat.resolver}: ${stat.totalTime.toFixed(2)}ms (${stat.percentage.toFixed(1)}%)`
    );
  });

  // Or get formatted output
  console.log(testFixture.getScopeTraceWithPerformance());
});
```

**Expected Output**:
```
📊 PERFORMANCE METRICS:

Resolver Timing:
  FilterResolver       12.45ms (45.2%) [3 steps, avg: 4.15ms]
  StepResolver         8.30ms (30.1%) [2 steps, avg: 4.15ms]
  SourceResolver       6.80ms (24.7%) [1 steps, avg: 6.80ms]

Filter Evaluation:
  Count: 5
  Total Time: 2.15ms
  Average: 0.43ms
  Percentage: 7.8%

Slowest Operations:
  1. FilterResolver: 5.20ms
  2. StepResolver: 4.80ms
  3. SourceResolver: 6.80ms

Tracing Overhead:
  Time: 1.25ms
  Percentage: 4.5%
```

## Performance Considerations

- High-resolution timing adds minimal overhead (< 0.1ms per step)
- Serialization is main overhead source (measured and reported)
- Performance metrics only calculated when requested
- Map-based storage for O(1) resolver time lookups

## References

- **Spec Section**: 5. Performance Metrics (lines 1609-1714)
- **Spec Section**: 7.4 Performance Profiling (lines 2538-2604)
- **Related Tickets**:
  - MODTESDIAIMP-009 (ScopeEvaluationTracer class)
  - MODTESDIAIMP-017 (Performance benchmark tests)
