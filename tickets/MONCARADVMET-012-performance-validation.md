# MONCARADVMET-012: Performance Validation

## Summary

Validate that the advanced metrics implementation meets performance requirements: memory usage at 100k samples stays below 2x baseline, and finalization time increases by less than 5%.

## Priority: High | Effort: Medium

## Rationale

The spec requires that advanced metrics be computed "with minimal overhead." This ticket creates the tests and benchmarks to verify:
- **Memory efficiency**: O(n) violation storage doesn't blow up memory
- **Computation efficiency**: Percentile/analysis calculations are fast
- **Scalability**: Performance remains acceptable at high sample counts

## Dependencies

- **MONCARADVMET-003** - Percentile calculation complete
- **MONCARADVMET-004** - Max observed value tracking complete
- **MONCARADVMET-006** - Near-miss rate calculation complete
- **MONCARADVMET-007** - Last-mile rate calculation complete
- **MONCARADVMET-011** - Integration tests complete (ensures correctness first)

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/memory/advancedMetrics.memory.test.js` | **Create** |
| `tests/performance/advancedMetrics.performance.test.js` | **Create** (if directory exists) |

## Out of Scope

- **DO NOT** modify any source files - this is test-only
- **DO NOT** implement reservoir sampling - that's deferred
- **DO NOT** optimize code - just measure current performance
- **DO NOT** add new metrics or features
- **DO NOT** modify existing performance/memory tests

## Implementation Details

### Memory Tests

Create tests using the existing `npm run test:memory` infrastructure:

```javascript
// tests/memory/advancedMetrics.memory.test.js

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createMemoryTestBed } from '../common/memoryTestBed.js';

describe('Advanced Metrics Memory Usage', () => {
  let testBed;

  beforeAll(() => {
    testBed = createMemoryTestBed();
  });

  afterAll(() => {
    testBed.cleanup();
  });

  /**
   * Measure baseline memory without advanced metrics
   */
  async function measureBaselineMemory(sampleCount) {
    const simulator = testBed.createSimulator({ advancedMetrics: false });
    const expression = testBed.createStandardExpression();

    global.gc && global.gc();  // Force GC if available
    const beforeHeap = process.memoryUsage().heapUsed;

    await simulator.simulate(expression, {
      sampleCount,
      trackClauses: true
    });

    global.gc && global.gc();
    const afterHeap = process.memoryUsage().heapUsed;

    return afterHeap - beforeHeap;
  }

  /**
   * Measure memory with advanced metrics enabled
   */
  async function measureAdvancedMetricsMemory(sampleCount) {
    const simulator = testBed.createSimulator({ advancedMetrics: true });
    const expression = testBed.createStandardExpression();

    global.gc && global.gc();
    const beforeHeap = process.memoryUsage().heapUsed;

    await simulator.simulate(expression, {
      sampleCount,
      trackClauses: true
    });

    global.gc && global.gc();
    const afterHeap = process.memoryUsage().heapUsed;

    return afterHeap - beforeHeap;
  }

  describe('Memory Overhead at Scale', () => {
    it('should stay below 2x baseline at 10k samples', async () => {
      const sampleCount = 10000;

      const baseline = await measureBaselineMemory(sampleCount);
      const withMetrics = await measureAdvancedMetricsMemory(sampleCount);

      const ratio = withMetrics / baseline;

      console.log(`10k samples - Baseline: ${(baseline / 1024).toFixed(2)} KB`);
      console.log(`10k samples - With metrics: ${(withMetrics / 1024).toFixed(2)} KB`);
      console.log(`10k samples - Ratio: ${ratio.toFixed(2)}x`);

      expect(ratio).toBeLessThan(2.0);
    });

    it('should stay below 2x baseline at 50k samples', async () => {
      const sampleCount = 50000;

      const baseline = await measureBaselineMemory(sampleCount);
      const withMetrics = await measureAdvancedMetricsMemory(sampleCount);

      const ratio = withMetrics / baseline;

      console.log(`50k samples - Baseline: ${(baseline / 1024).toFixed(2)} KB`);
      console.log(`50k samples - With metrics: ${(withMetrics / 1024).toFixed(2)} KB`);
      console.log(`50k samples - Ratio: ${ratio.toFixed(2)}x`);

      expect(ratio).toBeLessThan(2.0);
    });

    it('should stay below 2x baseline at 100k samples', async () => {
      const sampleCount = 100000;

      const baseline = await measureBaselineMemory(sampleCount);
      const withMetrics = await measureAdvancedMetricsMemory(sampleCount);

      const ratio = withMetrics / baseline;

      console.log(`100k samples - Baseline: ${(baseline / 1024 / 1024).toFixed(2)} MB`);
      console.log(`100k samples - With metrics: ${(withMetrics / 1024 / 1024).toFixed(2)} MB`);
      console.log(`100k samples - Ratio: ${ratio.toFixed(2)}x`);

      expect(ratio).toBeLessThan(2.0);
    }, 30000);  // Extended timeout for large sample count
  });

  describe('Memory Growth Pattern', () => {
    it('should grow linearly with sample count', async () => {
      const counts = [1000, 5000, 10000, 20000];
      const measurements = [];

      for (const count of counts) {
        const memory = await measureAdvancedMetricsMemory(count);
        measurements.push({ count, memory });
      }

      // Calculate growth rate between consecutive measurements
      const growthRates = [];
      for (let i = 1; i < measurements.length; i++) {
        const countRatio = measurements[i].count / measurements[i - 1].count;
        const memoryRatio = measurements[i].memory / measurements[i - 1].memory;
        growthRates.push(memoryRatio / countRatio);
      }

      console.log('Memory growth analysis:');
      measurements.forEach(m => {
        console.log(`  ${m.count} samples: ${(m.memory / 1024).toFixed(2)} KB`);
      });
      console.log(`  Growth rates: ${growthRates.map(r => r.toFixed(2)).join(', ')}`);

      // Linear growth means ratio should be close to 1
      growthRates.forEach(rate => {
        expect(rate).toBeLessThan(1.5);  // Allow some variation
        expect(rate).toBeGreaterThan(0.5);
      });
    });

    it('should not have memory leaks across multiple simulations', async () => {
      const simulator = testBed.createSimulator({ advancedMetrics: true });
      const expression = testBed.createStandardExpression();

      global.gc && global.gc();
      const initialHeap = process.memoryUsage().heapUsed;

      // Run multiple simulations
      for (let i = 0; i < 10; i++) {
        await simulator.simulate(expression, {
          sampleCount: 5000,
          trackClauses: true
        });
      }

      global.gc && global.gc();
      const finalHeap = process.memoryUsage().heapUsed;

      const growth = finalHeap - initialHeap;
      const growthMB = growth / 1024 / 1024;

      console.log(`Memory after 10 simulations: growth = ${growthMB.toFixed(2)} MB`);

      // Should not accumulate significant memory
      expect(growthMB).toBeLessThan(10);  // Less than 10MB growth
    });
  });

  describe('Per-Clause Memory', () => {
    it('should track memory per clause accurately', async () => {
      const simulator = testBed.createSimulator({ advancedMetrics: true });
      const multiClauseExpression = testBed.createMultiClauseExpression(5);  // 5 clauses

      global.gc && global.gc();
      const beforeHeap = process.memoryUsage().heapUsed;

      const result = await simulator.simulate(multiClauseExpression, {
        sampleCount: 10000,
        trackClauses: true
      });

      global.gc && global.gc();
      const afterHeap = process.memoryUsage().heapUsed;

      const totalMemory = afterHeap - beforeHeap;
      const perClauseMemory = totalMemory / result.clauseFailures.length;

      console.log(`5 clauses @ 10k samples:`);
      console.log(`  Total: ${(totalMemory / 1024).toFixed(2)} KB`);
      console.log(`  Per clause: ${(perClauseMemory / 1024).toFixed(2)} KB`);

      // Reasonable per-clause overhead (< 500KB per clause at 10k samples)
      expect(perClauseMemory).toBeLessThan(500 * 1024);
    });
  });
});
```

### Performance Tests

```javascript
// tests/performance/advancedMetrics.performance.test.js

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createPerformanceTestBed } from '../common/performanceTestBed.js';

describe('Advanced Metrics Performance', () => {
  let testBed;

  beforeAll(() => {
    testBed = createPerformanceTestBed();
  });

  afterAll(() => {
    testBed.cleanup();
  });

  /**
   * Measure simulation time without advanced metrics
   */
  async function measureBaselineTime(sampleCount, iterations = 5) {
    const simulator = testBed.createSimulator({ advancedMetrics: false });
    const expression = testBed.createStandardExpression();

    const times = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await simulator.simulate(expression, {
        sampleCount,
        trackClauses: true
      });
      times.push(performance.now() - start);
    }

    // Return median time
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
  }

  /**
   * Measure simulation time with advanced metrics
   */
  async function measureAdvancedMetricsTime(sampleCount, iterations = 5) {
    const simulator = testBed.createSimulator({ advancedMetrics: true });
    const expression = testBed.createStandardExpression();

    const times = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await simulator.simulate(expression, {
        sampleCount,
        trackClauses: true
      });
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
  }

  describe('Simulation Loop Overhead', () => {
    it('should add less than 5% overhead at 10k samples', async () => {
      const sampleCount = 10000;

      const baseline = await measureBaselineTime(sampleCount);
      const withMetrics = await measureAdvancedMetricsTime(sampleCount);

      const overhead = (withMetrics - baseline) / baseline;

      console.log(`10k samples - Baseline: ${baseline.toFixed(2)} ms`);
      console.log(`10k samples - With metrics: ${withMetrics.toFixed(2)} ms`);
      console.log(`10k samples - Overhead: ${(overhead * 100).toFixed(2)}%`);

      expect(overhead).toBeLessThan(0.05);  // Less than 5%
    });

    it('should add less than 5% overhead at 50k samples', async () => {
      const sampleCount = 50000;

      const baseline = await measureBaselineTime(sampleCount);
      const withMetrics = await measureAdvancedMetricsTime(sampleCount);

      const overhead = (withMetrics - baseline) / baseline;

      console.log(`50k samples - Baseline: ${baseline.toFixed(2)} ms`);
      console.log(`50k samples - With metrics: ${withMetrics.toFixed(2)} ms`);
      console.log(`50k samples - Overhead: ${(overhead * 100).toFixed(2)}%`);

      expect(overhead).toBeLessThan(0.05);
    });

    it('should add less than 5% overhead at 100k samples', async () => {
      const sampleCount = 100000;

      const baseline = await measureBaselineTime(sampleCount, 3);  // Fewer iterations for speed
      const withMetrics = await measureAdvancedMetricsTime(sampleCount, 3);

      const overhead = (withMetrics - baseline) / baseline;

      console.log(`100k samples - Baseline: ${baseline.toFixed(2)} ms`);
      console.log(`100k samples - With metrics: ${withMetrics.toFixed(2)} ms`);
      console.log(`100k samples - Overhead: ${(overhead * 100).toFixed(2)}%`);

      expect(overhead).toBeLessThan(0.05);
    }, 60000);  // Extended timeout
  });

  describe('Finalization Time', () => {
    it('should finalize results quickly at 10k samples', async () => {
      const simulator = testBed.createSimulator({ advancedMetrics: true });
      const expression = testBed.createStandardExpression();

      // Run simulation to populate data
      await simulator.simulate(expression, {
        sampleCount: 10000,
        trackClauses: true
      });

      // Measure finalization only
      const start = performance.now();
      simulator.finalizeClauseResults();
      const finalizationTime = performance.now() - start;

      console.log(`10k samples - Finalization: ${finalizationTime.toFixed(2)} ms`);

      // Finalization should be fast (< 50ms)
      expect(finalizationTime).toBeLessThan(50);
    });

    it('should finalize results quickly at 100k samples', async () => {
      const simulator = testBed.createSimulator({ advancedMetrics: true });
      const expression = testBed.createStandardExpression();

      await simulator.simulate(expression, {
        sampleCount: 100000,
        trackClauses: true
      });

      const start = performance.now();
      simulator.finalizeClauseResults();
      const finalizationTime = performance.now() - start;

      console.log(`100k samples - Finalization: ${finalizationTime.toFixed(2)} ms`);

      // Finalization at 100k should still be < 500ms
      expect(finalizationTime).toBeLessThan(500);
    }, 60000);
  });

  describe('Percentile Calculation Performance', () => {
    it('should calculate percentiles efficiently', async () => {
      const simulator = testBed.createSimulator({ advancedMetrics: true });
      const expression = testBed.createStandardExpression();

      const result = await simulator.simulate(expression, {
        sampleCount: 50000,
        trackClauses: true
      });

      const clause = result.clauseFailures[0];
      const violationCount = clause.failureCount;

      // Measure percentile calculation (already done, but we can time it)
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        clause.getViolationPercentile(0.5);
        clause.getViolationPercentile(0.9);
      }
      const percentileTime = (performance.now() - start) / 100;

      console.log(`Percentile calculation (${violationCount} violations): ${percentileTime.toFixed(3)} ms`);

      // Each percentile calculation should be < 1ms
      expect(percentileTime).toBeLessThan(1);
    });
  });

  describe('Multi-Clause Performance', () => {
    it('should scale well with number of clauses', async () => {
      const clauseCounts = [1, 3, 5, 10];
      const times = [];

      for (const count of clauseCounts) {
        const simulator = testBed.createSimulator({ advancedMetrics: true });
        const expression = testBed.createMultiClauseExpression(count);

        const start = performance.now();
        await simulator.simulate(expression, {
          sampleCount: 10000,
          trackClauses: true
        });
        times.push({ count, time: performance.now() - start });
      }

      console.log('Multi-clause performance:');
      times.forEach(t => {
        console.log(`  ${t.count} clauses: ${t.time.toFixed(2)} ms`);
      });

      // Time should scale roughly linearly with clause count
      const singleClauseTime = times[0].time;
      const tenClauseTime = times[3].time;
      const scalingFactor = tenClauseTime / (singleClauseTime * 10);

      // Should be less than 2x the linear expectation
      expect(scalingFactor).toBeLessThan(2);
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid successive simulations', async () => {
      const simulator = testBed.createSimulator({ advancedMetrics: true });
      const expression = testBed.createStandardExpression();

      const start = performance.now();
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        await simulator.simulate(expression, {
          sampleCount: 1000,
          trackClauses: true
        });
      }

      const totalTime = performance.now() - start;
      const avgTime = totalTime / iterations;

      console.log(`${iterations} rapid simulations: avg ${avgTime.toFixed(2)} ms each`);

      // Each small simulation should complete quickly
      expect(avgTime).toBeLessThan(100);
    });
  });
});
```

### Test Bed Helpers

```javascript
// tests/common/memoryTestBed.js (additions)

export function createMemoryTestBed() {
  return {
    createSimulator(options = {}) {
      // Create simulator with configurable advanced metrics
      return new MonteCarloSimulator({
        advancedMetricsEnabled: options.advancedMetrics ?? true,
        // ... other dependencies
      });
    },

    createStandardExpression() {
      return {
        id: 'test:memory_benchmark',
        prerequisites: {
          operator: 'AND',
          conditions: [
            { '>=': [{ 'var': 'actor.components.emotions.joy' }, 0.5] }
          ]
        }
      };
    },

    createMultiClauseExpression(clauseCount) {
      const conditions = [];
      const emotions = ['joy', 'anger', 'fear', 'sadness', 'surprise'];

      for (let i = 0; i < clauseCount; i++) {
        conditions.push({
          '>=': [
            { 'var': `actor.components.emotions.${emotions[i % emotions.length]}` },
            0.5
          ]
        });
      }

      return {
        id: 'test:multi_clause_benchmark',
        prerequisites: { operator: 'AND', conditions }
      };
    },

    cleanup() {
      // Force garbage collection if available
      global.gc && global.gc();
    }
  };
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Memory tests
npm run test:memory -- tests/memory/advancedMetrics.memory.test.js --verbose

# Performance tests (if separate runner)
npm run test:performance -- tests/performance/advancedMetrics.performance.test.js --verbose
```

### Performance Thresholds

| Metric | Threshold | Measurement |
|--------|-----------|-------------|
| Memory overhead (100k samples) | < 2x baseline | Heap usage ratio |
| Simulation loop overhead | < 5% | Time ratio |
| Finalization time (100k samples) | < 500ms | Absolute time |
| Percentile calculation | < 1ms | Per-call time |
| Memory growth | Linear (±50%) | Growth rate ratio |

### Invariants That Must Remain True

1. **No memory leaks** - Heap usage stable across repeated simulations
2. **Linear scaling** - Memory and time scale linearly with sample count
3. **Multi-clause scaling** - Performance scales reasonably with clause count
4. **Rapid execution** - Small simulations complete quickly

## Verification Commands

```bash
# Run memory tests with garbage collection exposed
node --expose-gc node_modules/.bin/jest tests/memory/advancedMetrics.memory.test.js --verbose

# Alternative: Use npm script if configured
npm run test:memory -- tests/memory/advancedMetrics.memory.test.js --verbose

# Run performance tests
npm run test:performance -- tests/performance/advancedMetrics.performance.test.js --verbose

# Run all performance/memory tests
npm run test:memory
npm run test:performance

# Generate performance report
npm run test:memory -- --json --outputFile=memory-report.json

# Type check
npm run typecheck
```

## Definition of Done

- [ ] Memory test file created in `tests/memory/`
- [ ] Performance test file created in `tests/performance/`
- [ ] Baseline memory measurement implemented
- [ ] Advanced metrics memory measurement implemented
- [ ] Memory ratio tests at 10k, 50k, 100k samples
- [ ] Memory growth pattern analysis
- [ ] Memory leak detection test
- [ ] Per-clause memory tracking
- [ ] Simulation loop overhead tests
- [ ] Finalization time tests
- [ ] Percentile calculation performance test
- [ ] Multi-clause scaling test
- [ ] Rapid successive simulation test
- [ ] All tests pass with defined thresholds
- [ ] Performance report generated
- [ ] No memory leaks detected
- [ ] Linear scaling verified
