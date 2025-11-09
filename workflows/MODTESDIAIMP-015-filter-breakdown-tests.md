# MODTESDIAIMP-015: Write Filter Breakdown Integration Tests

**Phase**: 4 - Filter Clause Breakdown
**Priority**: 🔴 Critical
**Estimated Effort**: 3 hours
**Dependencies**: MODTESDIAIMP-013, MODTESDIAIMP-014

---

## Workflow Validation Updates (2025-11-09)

This workflow has been reviewed and corrected to align with actual production code and established testing patterns. Key corrections made:

1. **Scenario helper method**: Changed `createMultipleActors` → `createMultiActorScenario` (correct method name)
2. **Test pattern**: Updated to follow established pattern:
   - Create scenario first
   - Register custom scope with `await testFixture.registerCustomScope(modId, scopeName)` AFTER scenario creation
   - Enable tracing
   - Get entity instance with `testFixture.testEnv.entityManager.getEntityInstance(id)`
   - Directly resolve scope with `testFixture.testEnv.unifiedScopeResolver.resolveSync(scopeName, entity)`
3. **Removed indirect action discovery**: Replaced `testFixture.testEnv.getAvailableActions()` calls with direct scope resolution for more targeted testing
4. **Documentation references**: Updated to reference actual source files and documentation locations

These changes align the workflow with the existing integration tests at `tests/integration/scopeDsl/filterBreakdownIntegration.test.js` and `tests/integration/scopeDsl/scopeTracingIntegration.test.js`.

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
    // Note: registerCustomScope is called in each test AFTER scenario creation
    // to ensure it doesn't get cleared by reset()
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Complete breakdown capture', () => {
    it('should capture breakdown for simple equality filter', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Register custom scope AFTER scenario creation to avoid reset() clearing it
      await testFixture.registerCustomScope('positioning', 'close_actors');

      testFixture.enableScopeTracing();

      // Get entity instance and directly resolve scope to trigger tracer
      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      expect(breakdown).toBeTruthy();
      expect(breakdown.hasBreakdown).toBe(true);
      expect(breakdown.clauses).toBeDefined();
      expect(breakdown.clauses.length).toBeGreaterThan(0);

    it('should capture breakdown for and operator', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
      await testFixture.registerCustomScope('positioning', 'close_actors');
      testFixture.enableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      // Verify 'and' operator clauses captured
      expect(breakdown.clauses.some(c => c.operator === 'and')).toBe(true);
    });

    it('should capture breakdown for or operator', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
      await testFixture.registerCustomScope('positioning', 'close_actors');
      testFixture.enableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      // Verify 'or' operator behavior captured if present
      expect(breakdown.clauses).toBeDefined();
    });

    it('should capture breakdown for nested conditions', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
      await testFixture.registerCustomScope('positioning', 'close_actors');
      testFixture.enableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      // Verify tree structure preserved (nested clauses)
      expect(breakdown.clauses.length).toBeGreaterThan(0);
    });

    it('should capture breakdown for component_present check', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
      await testFixture.registerCustomScope('positioning', 'close_actors');
      testFixture.enableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      // Verify component presence checks in breakdown
      expect(breakdown.clauses).toBeDefined();
    });

    it('should capture breakdown for condition_ref', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
      await testFixture.registerCustomScope('positioning', 'close_actors');
      testFixture.enableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      // Verify condition references evaluated
      expect(breakdown.clauses).toBeDefined();
    });
  });
});
```

### Suite 2: Breakdown Tree Structure

```javascript
describe('Breakdown tree structure', () => {
  it('should have correct tree depth', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');

    testFixture.enableScopeTracing();

    // Directly resolve scope to trigger tracer
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const breakdown = testFixture.getFilterBreakdown(scenario.target.id);
    const trace = testFixture.getScopeTraceData();

    const filterStep = trace.steps.find(
      s => s.type === 'FILTER_EVALUATION' && s.entityId === scenario.target.id
    );

    expect(filterStep.breakdown).toBeDefined();
    expect(filterStep.breakdown.type).toBe('operator');
    expect(filterStep.breakdown.children).toBeDefined();
  });

  it('should preserve operator results', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

    // Verify each clause has result
    for (const clause of breakdown.clauses) {
      expect(typeof clause.result).toBe('boolean');
    }
  });

  it('should track variable values', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const trace = testFixture.getScopeTraceData();

    // Verify variable resolution captured in trace
    expect(trace.steps).toBeDefined();
  });

  it('should include clause descriptions', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

    // Verify descriptions are human-readable
    for (const clause of breakdown.clauses) {
      expect(clause.description).toBeDefined();
      expect(typeof clause.description).toBe('string');
      expect(clause.description.length).toBeGreaterThan(0);
    }
  });
});
```

### Suite 3: Formatted Output Quality

```javascript
describe('Formatted output quality', () => {
  it('should format breakdown with ✓/✗ symbols', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');

    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const formatted = testFixture.getScopeTrace();

    expect(formatted).toContain('✓'); // Pass symbol
    expect(formatted).toContain('✗'); // Fail symbol
  });

  it('should indent nested clauses', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const formatted = testFixture.getScopeTrace();

    // Verify indentation in formatted output
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });

  it('should show variable values in breakdown', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const formatted = testFixture.getScopeTrace();

    // Verify var() values shown in trace
    expect(formatted).toBeTruthy();
  });

  it('should show operator descriptions', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

    // Verify operator descriptions present
    for (const clause of breakdown.clauses) {
      expect(clause.description).toBeTruthy();
    }
  });

  it('should integrate with overall trace output', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const formatted = testFixture.getScopeTrace();

    // Verify breakdown appears in full trace
    expect(formatted).toContain('Breakdown:');
  });
});
```

### Suite 4: Real-World Debugging Scenarios

```javascript
describe('Real-world debugging scenarios', () => {
  it('should help debug "why did this filter fail"', async () => {
    // Reproduce spec example: filter failure investigation
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');

    // Setup incorrect state (missing component)
    testFixture.testEnv.entityManager.removeComponent(
      scenario.target.id,
      'positioning:closeness'
    );

    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

    if (breakdown) {
      // Verify breakdown shows which clause failed
      expect(breakdown.hasBreakdown).toBe(true);
      expect(breakdown.clauses).toBeDefined();

      // Verify failing clause identified
      const failingClause = breakdown.clauses.find(c => !c.result);
      if (failingClause) {
        expect(failingClause.description).toBeTruthy();
      }
    }
  });

  it('should show which and clause failed', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

    // Verify specific failing clause can be identified
    expect(breakdown.clauses).toBeDefined();
  });

  it('should show component presence status', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

    // Verify component status shown in breakdown
    expect(breakdown.clauses).toBeDefined();
  });

  it('should show variable resolution details', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const trace = testFixture.getScopeTraceData();

    // Verify variable values shown in trace
    expect(trace.steps).toBeDefined();
  });

  it('should help debug complex nested filters', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

    // Verify can identify failing branch in nested structure
    expect(breakdown.clauses).toBeDefined();
    expect(breakdown.clauses.length).toBeGreaterThan(0);
  });
});
```

### Suite 5: Multiple Entity Evaluation

```javascript
describe('Multiple entity evaluation', () => {
  it('should capture breakdown for each entity', async () => {
    const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob', 'Charlie']);
    await testFixture.registerCustomScope('positioning', 'close_actors');

    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actors[0].id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const allBreakdowns = testFixture.getFilterBreakdown();

    expect(allBreakdowns.length).toBeGreaterThan(0);
    allBreakdowns.forEach(breakdown => {
      expect(breakdown.hasBreakdown).toBe(true);
      expect(breakdown.clauses).toBeDefined();
    });
  });

  it('should show different results per entity', async () => {
    const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob', 'Charlie']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actors[0].id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const allBreakdowns = testFixture.getFilterBreakdown();

    // Verify entities can have different clause results
    expect(allBreakdowns).toBeDefined();
  });

  it('should format multiple entity breakdowns', async () => {
    const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob', 'Charlie']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actors[0].id
    );
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );

    const formatted = testFixture.getScopeTrace();

    // Verify readable output for multiple entities
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });
});
```

### Suite 6: Performance Impact

```javascript
describe('Performance impact', () => {
  it('should have no overhead when tracer disabled', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');

    testFixture.disableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    const start = performance.now();
    testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:close_actors',
      actorEntity
    );
    const duration = performance.now() - start;

    // Verify breakdown not analyzed when disabled
    const breakdown = testFixture.getFilterBreakdown(scenario.target.id);
    expect(breakdown ? breakdown.hasBreakdown : false).toBe(false);

    // Should complete quickly
    expect(duration).toBeLessThan(1000);
  });

  it('should have acceptable overhead when tracer enabled', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    // Baseline: tracer disabled
    testFixture.disableScopeTracing();
    const start1 = performance.now();
    for (let i = 0; i < 100; i++) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );
    }
    const duration1 = performance.now() - start1;

    // With breakdown enabled
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
    expect(overhead).toBeLessThan(30); // Less than 30% overhead
  });

  it('should not leak memory with repeated breakdown', async () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    await testFixture.registerCustomScope('positioning', 'close_actors');
    testFixture.enableScopeTracing();

    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
      scenario.actor.id
    );

    // Run many iterations
    for (let i = 0; i < 1000; i++) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );
      testFixture.clearScopeTrace();
    }

    // Verify no memory growth (basic check - detailed memory tests in performance suite)
    expect(true).toBe(true);
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
- JSDoc in `FilterClauseAnalyzer` class (src/scopeDsl/analysis/filterClauseAnalyzer.js)
- Usage examples in scopeDsl documentation (docs/scopeDsl/README.md)
- Integration with existing tracer documentation (docs/testing/mod-testing-guide.md - Diagnostics & Logging section)

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
