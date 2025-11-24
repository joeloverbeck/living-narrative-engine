# PERTESFLAANA-006: Add Percentile-Based Assertions to Performance Tests

**Reference**: [Performance Test Flakiness Analysis](../docs/analysis/performance-test-flakiness-analysis.md)

## Summary

Implement a reusable percentile-based performance testing utility to provide more stable and statistically sound performance assertions. This addresses test flakiness caused by environmental variability (GC pauses, CPU spikes, JIT warmup) by using statistical measures (median, p95, p99) instead of single-run measurements.

## Problem Statement

Current performance tests use single-run measurements that are susceptible to:
- JIT compiler warmup effects
- Garbage collection pauses
- CPU scheduling variability
- CI runner resource contention

**Example of flakiness**:
- SlotGenerator test: Expected <15ms, got 29.66ms (2x variance)
- GOAP tests: Occasional spikes due to GC

**Statistical approach benefits**:
- Median (p50): Robust against outliers
- p95/p99: Catch tail latency issues
- Multiple samples: Reduce measurement noise
- Warmup phase: Account for JIT effects

## Files Expected to Touch

### New Files
- `tests/helpers/performanceAssertions.js` - New utility for percentile-based testing
- `tests/unit/helpers/performanceAssertions.test.js` - Unit tests for utility

### Modified Files (Optional - for demonstration)
- `tests/performance/anatomy/slotGenerator.performance.test.js`
  - Add example using new percentile assertions
  
### Documentation
- `docs/testing/performance-testing-guide.md` - Document best practices (if exists)

## Out of Scope

**DO NOT CHANGE**:
- Existing performance test thresholds (separate ticket: PERTESFLAANA-005)
- GOAP memory leak fixes (separate tickets: PERTESFLAANA-001-004)
- Production code in `src/` directory
- Test structure for existing tests (migrations are opt-in)
- Any breaking changes to existing test utilities

## Implementation Details

### PerformanceAssertions API

```javascript
class PerformanceAssertions {
  /**
   * Measure performance with multiple samples and statistical analysis
   * 
   * @param {Function} fn - Function to measure
   * @param {Object} options
   * @param {number} options.samples - Number of samples (default: 5)
   * @param {number} options.iterations - Iterations per sample (default: 1000)
   * @param {number} options.warmup - Warmup iterations (default: 100)
   * @returns {PerformanceResult}
   */
  static measure(fn, options = {});
  
  /**
   * Assert that median time is below threshold
   * 
   * @param {PerformanceResult} result
   * @param {number} thresholdMs
   * @param {string} label - Description for error message
   */
  static assertMedianBelow(result, thresholdMs, label);
  
  /**
   * Assert that p95 time is below threshold
   * 
   * @param {PerformanceResult} result
   * @param {number} thresholdMs
   * @param {string} label
   */
  static assertP95Below(result, thresholdMs, label);
  
  /**
   * Assert that p99 time is below threshold
   * 
   * @param {PerformanceResult} result
   * @param {number} thresholdMs
   * @param {string} label
   */
  static assertP99Below(result, thresholdMs, label);
  
  /**
   * Get percentile from array of measurements
   * 
   * @param {number[]} timings - Sorted array of timings
   * @param {number} percentile - 0-100
   * @returns {number}
   */
  static getPercentile(timings, percentile);
}

/**
 * Result object from measure()
 * @typedef {Object} PerformanceResult
 * @property {number[]} samples - Raw sample timings (ms)
 * @property {number} median - Median time (ms)
 * @property {number} p95 - 95th percentile (ms)
 * @property {number} p99 - 99th percentile (ms)
 * @property {number} min - Minimum time (ms)
 * @property {number} max - Maximum time (ms)
 * @property {number} mean - Average time (ms)
 * @property {number} stdDev - Standard deviation (ms)
 * @property {number} iterations - Iterations per sample
 */
```

### Implementation Example

```javascript
// tests/helpers/performanceAssertions.js

class PerformanceAssertions {
  static measure(fn, options = {}) {
    const {
      samples = 5,
      iterations = 1000,
      warmup = 100,
    } = options;
    
    // Warmup phase
    for (let i = 0; i < warmup; i++) {
      fn();
    }
    
    // Measurement phase
    const timings = [];
    
    for (let sample = 0; sample < samples; sample++) {
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        fn();
      }
      
      const elapsed = performance.now() - start;
      timings.push(elapsed);
    }
    
    // Sort for percentile calculations
    timings.sort((a, b) => a - b);
    
    // Calculate statistics
    const median = this.getPercentile(timings, 50);
    const p95 = this.getPercentile(timings, 95);
    const p99 = this.getPercentile(timings, 99);
    const min = timings[0];
    const max = timings[timings.length - 1];
    const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
    const stdDev = Math.sqrt(
      timings.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / timings.length
    );
    
    return {
      samples: timings,
      median,
      p95,
      p99,
      min,
      max,
      mean,
      stdDev,
      iterations,
    };
  }
  
  static getPercentile(sortedTimings, percentile) {
    const index = Math.ceil((percentile / 100) * sortedTimings.length) - 1;
    return sortedTimings[Math.max(0, index)];
  }
  
  static assertMedianBelow(result, thresholdMs, label = 'Operation') {
    expect(result.median).toBeLessThan(thresholdMs);
    
    // Also log statistics for debugging
    if (result.median >= thresholdMs * 0.9) {
      console.warn(`${label} approaching threshold:`, {
        median: result.median,
        threshold: thresholdMs,
        p95: result.p95,
        p99: result.p99,
      });
    }
  }
  
  static assertP95Below(result, thresholdMs, label = 'Operation') {
    expect(result.p95).toBeLessThan(thresholdMs);
  }
  
  static assertP99Below(result, thresholdMs, label = 'Operation') {
    expect(result.p99).toBeLessThan(thresholdMs);
  }
}

export default PerformanceAssertions;
```

### Usage Example - SlotGenerator Test

```javascript
// tests/performance/anatomy/slotGenerator.performance.test.js
import PerformanceAssertions from '../../helpers/performanceAssertions.js';

describe('SlotGenerator Performance - Percentile-Based', () => {
  it('should generate slots efficiently (median <40ms, p95 <60ms)', () => {
    const result = PerformanceAssertions.measure(
      () => slotGenerator.generateBlueprintSlots(template),
      {
        samples: 10,      // 10 sample runs
        iterations: 1000, // 1000 iterations per sample
        warmup: 100,      // 100 warmup iterations
      }
    );
    
    // Median should be fast (typical performance)
    PerformanceAssertions.assertMedianBelow(
      result,
      40, // 40ms for 1000 iterations = 0.04ms per call
      'SlotGenerator.generateBlueprintSlots'
    );
    
    // p95 should handle occasional GC pauses
    PerformanceAssertions.assertP95Below(
      result,
      60, // 60ms for 1000 iterations = 0.06ms per call
      'SlotGenerator.generateBlueprintSlots'
    );
    
    // Optional: Log statistics for monitoring
    console.log('SlotGenerator performance:', {
      median: result.median,
      p95: result.p95,
      p99: result.p99,
      stdDev: result.stdDev,
    });
  });
});
```

### Usage Example - GOAP Planning

```javascript
// tests/performance/goap/planning.performance.test.js
import PerformanceAssertions from '../../helpers/performanceAssertions.js';

describe('GOAP Planning Performance - Percentile-Based', () => {
  it('should plan efficiently (median <50ms, p95 <100ms)', async () => {
    const result = PerformanceAssertions.measure(
      async () => {
        await goapController.decideTurn(actor, world);
      },
      {
        samples: 20,     // More samples for async operations
        iterations: 100, // Fewer iterations (planning is slower)
        warmup: 10,
      }
    );
    
    // Assertions
    PerformanceAssertions.assertMedianBelow(result, 50, 'GOAP Planning');
    PerformanceAssertions.assertP95Below(result, 100, 'GOAP Planning');
    
    // Tail latency check
    expect(result.p99).toBeLessThan(150); // Allow some outliers
  });
});
```

## Acceptance Criteria

### Specific Tests That Must Pass

1. **Unit Tests** (`tests/unit/helpers/performanceAssertions.test.js`):
   - ✅ Should calculate median correctly
   - ✅ Should calculate p95 correctly
   - ✅ Should calculate p99 correctly
   - ✅ Should handle edge cases (1 sample, all same values)
   - ✅ Should calculate statistics (mean, stdDev) correctly
   - ✅ Should perform warmup before measurements
   - ✅ Should handle async functions

2. **Integration** (optional demonstration):
   - ✅ SlotGenerator test using percentile assertions passes
   - ✅ Shows reduced flakiness compared to single-run
   - ✅ Catches genuine performance regressions

3. **System Tests**:
   - ✅ Full test suite: `npm run test:ci`
   - ✅ Linting: `npx eslint tests/helpers/performanceAssertions.js`
   - ✅ All existing performance tests unchanged

### Invariants That Must Remain True

1. **Backward Compatibility**:
   - Existing tests continue to work
   - New utility is opt-in, not mandatory
   - No breaking changes to test infrastructure

2. **Performance**:
   - Measurement overhead acceptable (warmup + samples)
   - Results reproducible across runs
   - No impact on non-performance tests

3. **Usability**:
   - API is simple and intuitive
   - Error messages are clear and helpful
   - Documentation is complete

4. **Statistical Validity**:
   - Percentile calculations are accurate
   - Warmup effectively reduces JIT noise
   - Sample sizes are configurable

## Testing Strategy

### Unit Testing

```javascript
describe('PerformanceAssertions', () => {
  describe('getPercentile', () => {
    it('should calculate median (p50) correctly', () => {
      const timings = [1, 2, 3, 4, 5];
      const median = PerformanceAssertions.getPercentile(timings, 50);
      expect(median).toBe(3);
    });
    
    it('should calculate p95 correctly', () => {
      const timings = Array.from({ length: 100 }, (_, i) => i + 1);
      const p95 = PerformanceAssertions.getPercentile(timings, 95);
      expect(p95).toBe(95);
    });
    
    it('should handle single sample', () => {
      const timings = [42];
      expect(PerformanceAssertions.getPercentile(timings, 50)).toBe(42);
      expect(PerformanceAssertions.getPercentile(timings, 95)).toBe(42);
    });
  });
  
  describe('measure', () => {
    it('should perform warmup before measurement', () => {
      let callCount = 0;
      const fn = () => callCount++;
      
      const result = PerformanceAssertions.measure(fn, {
        samples: 2,
        iterations: 10,
        warmup: 5,
      });
      
      // 5 warmup + (2 samples × 10 iterations) = 25 calls
      expect(callCount).toBe(25);
    });
    
    it('should calculate statistics correctly', () => {
      const result = PerformanceAssertions.measure(
        () => {
          // Simulate work
          for (let i = 0; i < 1000; i++) {}
        },
        { samples: 10, iterations: 100, warmup: 10 }
      );
      
      expect(result.samples).toHaveLength(10);
      expect(result.median).toBeGreaterThan(0);
      expect(result.p95).toBeGreaterThanOrEqual(result.median);
      expect(result.p99).toBeGreaterThanOrEqual(result.p95);
      expect(result.max).toBeGreaterThanOrEqual(result.p99);
      expect(result.min).toBeLessThanOrEqual(result.median);
    });
  });
  
  describe('assertions', () => {
    it('should pass when below threshold', () => {
      const result = { median: 10, p95: 15, p99: 20 };
      
      expect(() => {
        PerformanceAssertions.assertMedianBelow(result, 20, 'test');
      }).not.toThrow();
    });
    
    it('should fail when above threshold', () => {
      const result = { median: 30, p95: 35, p99: 40 };
      
      expect(() => {
        PerformanceAssertions.assertMedianBelow(result, 20, 'test');
      }).toThrow();
    });
  });
});
```

### Comparison Testing

Create a test that demonstrates reduced flakiness:

```javascript
describe('Flakiness Comparison', () => {
  it('single-run approach shows high variance', () => {
    const timings = [];
    
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      slotGenerator.generateBlueprintSlots(template);
      timings.push(performance.now() - start);
    }
    
    const max = Math.max(...timings);
    const min = Math.min(...timings);
    const variance = max / min;
    
    // Single-run variance can be 2-5x
    expect(variance).toBeGreaterThan(2);
  });
  
  it('percentile approach is more stable', () => {
    const results = [];
    
    for (let i = 0; i < 10; i++) {
      const result = PerformanceAssertions.measure(
        () => slotGenerator.generateBlueprintSlots(template),
        { samples: 5, iterations: 100 }
      );
      results.push(result.median);
    }
    
    const max = Math.max(...results);
    const min = Math.min(...results);
    const variance = max / min;
    
    // Median variance should be <1.5x
    expect(variance).toBeLessThan(1.5);
  });
});
```

## Implementation Notes

1. **Async Support**: Use `await` in measurement loop for async functions

2. **Memory Considerations**: For memory tests, disable GC during measurement or force GC between samples

3. **Warmup Benefits**: Reduces JIT compilation effects, improves measurement stability

4. **Sample Size**: 5-10 samples for most tests, 20+ for critical paths

5. **Documentation**: Add JSDoc comments for IDE support

6. **Future Extensions**: Could add confidence intervals, outlier detection, trend analysis

## Dependencies

None - this ticket is standalone and provides optional utility for other tests.

## Estimated Effort

- Implementation: 2-3 hours
- Testing: 2 hours
- Documentation: 1 hour
- Example migrations: 1 hour
- Total: 6-7 hours

## Validation Checklist

Before marking complete:
- [ ] PerformanceAssertions utility implemented
- [ ] Unit tests pass with 100% coverage
- [ ] Example usage in at least one performance test
- [ ] Comparison test demonstrates reduced variance
- [ ] Documentation added (JSDoc + README if applicable)
- [ ] All tests pass: `npm run test:ci`
- [ ] ESLint passes on all new files
- [ ] Code review completed
- [ ] Consider adding to project testing guide

## Migration Guide (For Future Use)

To migrate existing performance tests:

**Before:**
```javascript
it('should be fast', () => {
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    fn();
  }
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(50);
});
```

**After:**
```javascript
it('should be fast (median)', () => {
  const result = PerformanceAssertions.measure(fn, {
    samples: 5,
    iterations: 1000,
  });
  PerformanceAssertions.assertMedianBelow(result, 40, 'Function');
  PerformanceAssertions.assertP95Below(result, 60, 'Function');
});
```

## Future Enhancements

Consider for future work (not this ticket):
- Automatic outlier detection and reporting
- Performance regression detection (compare to baseline)
- Confidence intervals for statistical significance
- Integration with CI to track performance over time
- Visualization of performance distributions
- Adaptive sample sizing based on variance
