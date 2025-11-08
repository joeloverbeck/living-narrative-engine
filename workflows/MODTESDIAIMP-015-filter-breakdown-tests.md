# MODTESDIAIMP-015: Write Filter Breakdown Integration Tests

**Phase**: 4 - Filter Clause Breakdown
**Priority**: 🔴 Critical
**Estimated Effort**: 3 hours
**Dependencies**: MODTESDIAIMP-013, MODTESDIAIMP-014

---

## Overview

Create comprehensive integration tests verifying that filter clause breakdown captures detailed per-clause evaluation results and provides actionable debugging information for filter failures.

## Objectives

- Verify breakdown captures all clause types
- Validate breakdown tree structure
- Test formatted output quality
- Verify real-world debugging scenarios
- Test performance impact

## Test Files

### Main Integration Test Suite
**File**: `tests/integration/scopeDsl/filterBreakdownIntegration.test.js` (new)

### Supporting Test Files
- `tests/unit/scopeDsl/analysis/filterClauseAnalyzer.test.js` (from MODTESDIAIMP-013)
- `tests/unit/scopeDsl/nodes/filterResolver.breakdown.test.js` (from MODTESDIAIMP-014)

## Test Specifications

### Suite 1: Complete Breakdown Capture

```javascript
describe('Filter Breakdown Integration', () => {
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

  describe('Complete breakdown capture', () => {
    it('should capture breakdown for simple equality filter', async () => {
      testFixture.enableScopeTracing();

      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
      testFixture.testEnv.getAvailableActions(scenario.actor.id);

      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      expect(breakdown).toBeTruthy();
      expect(breakdown.hasBreakdown).toBe(true);
      expect(breakdown.clauses).toBeDefined();
      expect(breakdown.clauses.length).toBeGreaterThan(0);
    });

    it('should capture breakdown for and operator', async () => {
      // Test filter with multiple and conditions
      // Verify all clauses captured
    });

    it('should capture breakdown for or operator', async () => {
      // Test filter with or conditions
      // Verify short-circuit behavior captured
    });

    it('should capture breakdown for nested conditions', async () => {
      // Test deeply nested and/or combinations
      // Verify tree structure preserved
    });

    it('should capture breakdown for component_present check', async () => {
      // Test component presence filter
      // Verify component status shown
    });

    it('should capture breakdown for condition_ref', async () => {
      // Test condition reference resolution
      // Verify referenced condition evaluated
    });
  });
});
```

### Suite 2: Breakdown Tree Structure

```javascript
describe('Breakdown tree structure', () => {
  it('should have correct tree depth', async () => {
    testFixture.enableScopeTracing();

    // Create scenario with nested filter
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

    const breakdown = testFixture.getFilterBreakdown(scenario.target.id);
    const trace = testFixture.getScopeTraceData();

    const filterStep = trace.steps.find(
      s => s.type === 'FILTER_EVALUATION' && s.entityId === scenario.target.id
    );

    expect(filterStep.breakdown).toBeDefined();
    expect(filterStep.breakdown.type).toBe('operator');
    expect(filterStep.breakdown.children).toBeDefined();
  });

  it('should preserve operator results', () => {
    // Verify each operator node has result
  });

  it('should track variable values', () => {
    // Verify variable nodes show resolved values
  });

  it('should include clause descriptions', () => {
    // Verify descriptions are human-readable
  });
});
```

### Suite 3: Formatted Output Quality

```javascript
describe('Formatted output quality', () => {
  it('should format breakdown with ✓/✗ symbols', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

    const formatted = testFixture.getScopeTrace();

    expect(formatted).toContain('✓'); // Pass symbol
    expect(formatted).toContain('✗'); // Fail symbol
  });

  it('should indent nested clauses', () => {
    // Verify indentation shows tree structure
  });

  it('should show variable values in breakdown', () => {
    // Verify var() values displayed
  });

  it('should show operator descriptions', () => {
    // Verify "All conditions must be true" etc.
  });

  it('should integrate with overall trace output', () => {
    // Verify breakdown appears in full trace
  });
});
```

### Suite 4: Real-World Debugging Scenarios

```javascript
describe('Real-world debugging scenarios', () => {
  it('should help debug "why did this filter fail"', async () => {
    // Reproduce spec example: filter failure investigation
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Setup incorrect state (missing component)
    testFixture.testEnv.entityManager.removeComponent(
      scenario.target.id,
      'positioning:sitting'
    );

    const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);

    if (actions.length === 0) {
      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      // Verify breakdown shows which clause failed
      expect(breakdown.result).toBe(false);
      expect(breakdown.clauses.some(c => !c.result)).toBe(true);

      // Verify failing clause identified
      const failingClause = breakdown.clauses.find(c => !c.result);
      expect(failingClause.description).toContain('component');
    }
  });

  it('should show which and clause failed', async () => {
    // Test and with one failing clause
    // Verify specific clause identified
  });

  it('should show component presence status', async () => {
    // Test component_present filter
    // Verify component status shown
  });

  it('should show variable resolution details', async () => {
    // Test var() in filter
    // Verify variable value shown
  });

  it('should help debug complex nested filters', async () => {
    // Test deeply nested filter
    // Verify can identify failing branch
  });
});
```

### Suite 5: Multiple Entity Evaluation

```javascript
describe('Multiple entity evaluation', () => {
  it('should capture breakdown for each entity', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createMultipleActors(['Alice', 'Bob', 'Charlie']);
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

    const allBreakdowns = testFixture.getFilterBreakdown();

    expect(allBreakdowns.length).toBeGreaterThan(0);
    allBreakdowns.forEach(breakdown => {
      expect(breakdown.hasBreakdown).toBe(true);
      expect(breakdown.clauses).toBeDefined();
    });
  });

  it('should show different results per entity', () => {
    // Verify entities can have different clause results
  });

  it('should format multiple entity breakdowns', () => {
    // Verify readable output for multiple entities
  });
});
```

### Suite 6: Performance Impact

```javascript
describe('Performance impact', () => {
  it('should have no overhead when tracer disabled', () => {
    // Benchmark with tracer off
    // Verify breakdown not analyzed
  });

  it('should have acceptable overhead when tracer enabled', () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Baseline: tracer disabled
    const start1 = performance.now();
    for (let i = 0; i < 100; i++) {
      testFixture.testEnv.getAvailableActions(scenario.actor.id);
    }
    const duration1 = performance.now() - start1;

    // With breakdown enabled
    testFixture.enableScopeTracing();
    const start2 = performance.now();
    for (let i = 0; i < 100; i++) {
      testFixture.testEnv.getAvailableActions(scenario.actor.id);
      testFixture.clearScopeTrace();
    }
    const duration2 = performance.now() - start2;

    const overhead = ((duration2 - duration1) / duration1) * 100;
    expect(overhead).toBeLessThan(30); // Less than 30% overhead
  });

  it('should not leak memory with repeated breakdown', () => {
    // Run many iterations
    // Verify no memory growth
  });
});
```

## Acceptance Criteria

### Breakdown Capture
- ✅ All operator types captured
- ✅ Variable values captured
- ✅ Tree structure preserved
- ✅ Clause descriptions included

### Data Quality
- ✅ Results accurate per clause
- ✅ Paths tracked correctly
- ✅ Descriptions human-readable
- ✅ Tree depth matches filter complexity

### Formatted Output
- ✅ ✓/✗ symbols used
- ✅ Indentation shows structure
- ✅ Variable values shown
- ✅ Operator descriptions clear

### Performance
- ✅ No overhead when disabled
- ✅ < 30% overhead when enabled
- ✅ No memory leaks

### Real-World Utility
- ✅ Helps debug filter failures
- ✅ Shows failing clauses clearly
- ✅ Identifies component issues
- ✅ Explains variable resolution

## Test Execution

```bash
# Run filter breakdown integration tests
npm run test:integration -- tests/integration/scopeDsl/filterBreakdownIntegration.test.js

# Run with verbose output to see breakdown
npm run test:integration -- tests/integration/scopeDsl/filterBreakdownIntegration.test.js --verbose

# Run all scopeDsl integration tests
npm run test:integration -- tests/integration/scopeDsl/

# Run performance tests
npm run test:performance -- tests/performance/scopeDsl/
```

## Documentation Requirements

Add examples to:
- JSDoc in `FilterClauseAnalyzer` class
- Breakdown usage guide in `docs/testing/mod-testing-guide.md`
- Troubleshooting section with breakdown examples

## Success Metrics

- ✅ All tests pass
- ✅ 100% coverage of breakdown code paths
- ✅ No eslint errors
- ✅ Breakdown output verified as helpful (human review)

## Example Test Output

```javascript
✓ should capture breakdown for simple filter
✓ should capture breakdown for and operator
✓ should capture breakdown for nested conditions
✓ should format breakdown with ✓/✗ symbols
✓ should help debug filter failures

Breakdown example:
Entity: actor-bob-456
Result: FAIL ✗
  ✗ and: All conditions must be true
    ✓ ==: var("type") equals "actor"
    ✗ component_present: Component "positioning:sitting" is present
      var("component") = "positioning:sitting"
      component_exists = false
```

## References

- **Spec Section**: 7. Testing Strategy (lines 2298-2402)
- **Example Section**: 5. Usage Examples, Example 3 (lines 2003-2086)
- **Related Tickets**:
  - MODTESDIAIMP-013 (FilterClauseAnalyzer class)
  - MODTESDIAIMP-014 (FilterResolver integration)
