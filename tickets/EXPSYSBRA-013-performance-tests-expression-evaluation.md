# EXPSYSBRA-013: Performance Tests for Expression Evaluation

## Summary

Create performance tests to ensure expression evaluation remains efficient as expression count grows, measuring evaluation time, memory usage, and throughput under various conditions.

## Background

Expression evaluation runs on every turn for every actor, so performance is critical. These tests establish baseline metrics and verify the system scales appropriately with increasing expression counts and complex prerequisites.

## File List (Expected to Touch)

### New Files
- `tests/performance/expressions/expressionEvaluation.performance.test.js`
- `tests/performance/expressions/expressionRegistry.performance.test.js`

### Files to Read (NOT modify)
- `src/expressions/*.js` - Service implementations
- `tests/common/performanceTestUtils.js` - Performance test utilities (if exists)

## Out of Scope (MUST NOT Change)

- `src/expressions/*.js` - Service implementations
- Any existing performance tests
- Production code
- Expression content files

## Implementation Details

### 1. `expressionEvaluation.performance.test.js`

```javascript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Expression Evaluation - Performance', () => {
  describe('evaluation speed', () => {
    it('should evaluate 15 expressions in under 10ms', async () => {
      const startTime = performance.now();

      // Evaluate against 15 expressions (core set)
      const result = await evaluator.evaluateExpressions(context);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10);
    });

    it('should evaluate 50 expressions in under 25ms', async () => {
      // Test with expanded expression set
      const startTime = performance.now();
      const result = await evaluator.evaluateExpressions(context);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(25);
    });

    it('should evaluate 100 expressions in under 50ms', async () => {
      // Test scalability with large expression set
    });
  });

  describe('throughput', () => {
    it('should handle 100 evaluations per second', async () => {
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await evaluator.evaluateExpressions(context);
      }

      const duration = performance.now() - startTime;
      const opsPerSecond = (iterations / duration) * 1000;

      expect(opsPerSecond).toBeGreaterThan(100);
    });

    it('should maintain throughput under concurrent load', async () => {
      // Test with Promise.all for concurrent evaluation
      const actors = createTestActors(10);
      const startTime = performance.now();

      await Promise.all(actors.map(actor =>
        evaluator.evaluateExpressions(buildContext(actor))
      ));

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // 10 actors in under 100ms
    });
  });

  describe('complexity scaling', () => {
    it('should not degrade significantly with complex prerequisites', async () => {
      // Test expression with many AND conditions
      const simpleTime = await measureEvaluation(simpleExpression);
      const complexTime = await measureEvaluation(complexExpression);

      // Complex should be no more than 3x slower
      expect(complexTime).toBeLessThan(simpleTime * 3);
    });

    it('should handle nested JSON Logic efficiently', async () => {
      // Expression with deeply nested conditions
    });
  });

  describe('caching effectiveness', () => {
    it('should be faster on second evaluation (cache warm)', async () => {
      // First evaluation (cold cache)
      await evaluator.evaluateExpressions(context);
      const coldTime = performance.now();

      // Second evaluation (warm cache)
      const warmStart = performance.now();
      await evaluator.evaluateExpressions(context);
      const warmTime = performance.now() - warmStart;

      // Warm should be at least 20% faster
      // (accounts for tag index and expression cache)
    });
  });
});
```

### 2. `expressionRegistry.performance.test.js`

```javascript
describe('Expression Registry - Performance', () => {
  describe('retrieval performance', () => {
    it('should retrieve all expressions in under 5ms', async () => {
      const startTime = performance.now();
      const expressions = registry.getAllExpressions();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(5);
    });

    it('should retrieve by ID in under 1ms', async () => {
      const startTime = performance.now();
      const expression = registry.getExpression('core:suppressed_rage');
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1);
    });

    it('should retrieve by tag in under 2ms', async () => {
      const startTime = performance.now();
      const expressions = registry.getExpressionsByTag('anger');
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(2);
    });
  });

  describe('tag index performance', () => {
    it('should build tag index in under 10ms for 100 expressions');
    it('should maintain constant-time tag lookup after indexing');
  });

  describe('priority sorting performance', () => {
    it('should sort 100 expressions by priority in under 5ms');
    it('should maintain sorted order in cache');
  });

  describe('memory efficiency', () => {
    it('should not leak memory on repeated access', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 1000; i++) {
        registry.getAllExpressions();
        registry.getExpressionsByTag('anger');
        registry.getExpressionsByPriority();
      }

      // Force GC if available
      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Should not grow more than 1MB
      expect(memoryGrowth).toBeLessThan(1024 * 1024);
    });
  });
});
```

### Performance Benchmarks

| Operation | Target | Threshold |
|-----------|--------|-----------|
| Single expression evaluation | < 1ms | 2ms (fail) |
| 15 expression evaluation | < 10ms | 20ms (fail) |
| 50 expression evaluation | < 25ms | 50ms (fail) |
| 100 expression evaluation | < 50ms | 100ms (fail) |
| Registry getAllExpressions | < 5ms | 10ms (fail) |
| Registry getExpression | < 1ms | 2ms (fail) |
| Registry getExpressionsByTag | < 2ms | 5ms (fail) |
| Context building | < 5ms | 10ms (fail) |
| Full turn evaluation (1 actor) | < 20ms | 40ms (fail) |
| Full turn evaluation (10 actors) | < 100ms | 200ms (fail) |

### Test Utilities

```javascript
// Helper for measuring evaluation time
async function measureEvaluation(expression, context, iterations = 100) {
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await evaluator.evaluateSingleExpression(expression, context);
    times.push(performance.now() - start);
  }

  // Return median to reduce outlier impact
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

// Helper for creating test expressions with varying complexity
function createTestExpressions(count, complexityLevel = 'simple') {
  // Generate expressions with controlled complexity
}

// Helper for memory measurement
function measureMemoryUsage(operation, iterations) {
  // Track heap usage across iterations
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **All Performance Tests Pass**
   - Run: `npm run test:performance -- --testPathPattern="expressions"`
   - All benchmarks meet target thresholds

2. **Baseline Established**
   - Core expression set (15) evaluates in < 10ms
   - Single actor full evaluation in < 20ms
   - No memory leaks detected

3. **Scalability Verified**
   - Performance degrades linearly, not exponentially
   - 100 expressions no more than 5x slower than 15 expressions

### Invariants That Must Remain True

1. **Consistent results** - Same context produces same results
2. **No side effects** - Performance tests don't modify state
3. **Realistic scenarios** - Tests reflect actual usage patterns
4. **Isolated measurements** - Each test measures independently
5. **Environment neutral** - Tests pass across different machines (with tolerance)

## Estimated Size

- 2 new test files
- ~200-300 lines each
- ~400-600 lines total

## Dependencies

- Depends on: EXPSYSBRA-011 (unit tests)
- Depends on: EXPSYSBRA-012 (integration tests)
- Should be last test ticket implemented

## Notes

- Use `performance.now()` for high-resolution timing
- Run tests multiple times and use median for stability
- Account for JIT warmup in first measurements
- Consider CI environment differences (allow 2x tolerance)
- Memory tests may require `--expose-gc` flag
- Performance thresholds are targets, not hard requirements
- Document any environment-specific considerations
