# MODTESDIAIMP-012: Write Scope Tracing Integration Tests

**Phase**: 3 - Scope Evaluation Tracer
**Priority**: 🟡 High
**Estimated Effort**: 3 hours
**Dependencies**: MODTESDIAIMP-009, MODTESDIAIMP-010, MODTESDIAIMP-011

---

## Overview

Create comprehensive integration tests verifying that scope tracing captures complete resolver execution flow and provides useful debugging information for real-world scenarios.

## Critical Production Code Context

### Tracer Integration Requirements

**IMPORTANT**: Scope tracing only works with scopes registered via `registerCustomScope()`. The workflow has been updated to reflect this requirement.

**How Tracer Integration Works:**
1. `ModTestFixture.registerCustomScope(modId, scopeName)` creates a ScopeEngine-based resolver
2. The resolver receives the tracer via `runtimeCtx.tracer` getter (line 2326-2328 in ModTestFixture.js)
3. ScopeEngine passes tracer to resolvers (SourceResolver, StepResolver, FilterResolver, etc.)
4. Resolvers call `tracer.logStep()` and `tracer.logFilterEvaluation()` to capture execution

**What DOESN'T Capture Traces:**
- `ScopeResolverHelpers` simple scope resolvers (e.g., `registerPositioningScopes()`)
- `autoRegisterScopes: true` option (uses simple resolvers, not ScopeEngine)
- Direct calls to `getAvailableActions()` (unless it internally uses registered custom scopes)

### Known Issue in Production Code

**Bug in ModTestFixture.js:2326-2328** - The tracer getter uses incorrect `this` context:
```javascript
get tracer() {
  return this.scopeTracer;  // BUG: 'this' refers to runtimeCtx, not fixture
}
```

**Correct Implementation:**
```javascript
const scopeTracer = this.scopeTracer;  // Capture in closure
const runtimeCtx = {
  // ... other getters
  get tracer() {
    return scopeTracer;  // Use captured variable
  },
};
```

This bug may prevent tracer from working correctly in some scenarios. If tests fail with "tracer is undefined", this is the likely cause.

### Test Setup Pattern

All tests MUST follow this pattern:
```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('modId', 'actionId');

  // CRITICAL: Register scopes with ScopeEngine for tracer integration
  await testFixture.registerCustomScope('modId', 'scopeName');
});

it('test name', () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

  // MUST directly resolve scope (not use getAvailableActions)
  const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(scenario.actor.id);
  testFixture.testEnv.scopeResolver.resolveSync(
    'modId:scopeName',
    { actorEntity }
  );

  const trace = testFixture.getScopeTrace();
  // ... assertions
});
```

## Objectives

- Verify complete trace capture across resolver chain
- Validate trace data completeness and accuracy
- Test formatted output quality
- Verify performance overhead is acceptable
- Test real-world debugging scenarios from spec

## Test Files

### Main Integration Test Suite
**File**: `tests/integration/scopeDsl/scopeTracingIntegration.test.js` (new)

### Performance Benchmark
**File**: `tests/performance/scopeDsl/tracerOverhead.performance.test.js` (new)

## Test Specifications

### Suite 1: Complete Trace Capture

```javascript
describe('Scope Tracing Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // CRITICAL: Register scopes with ScopeEngine for tracer integration
    // Without this, simple scope resolvers are used which don't capture traces
    await testFixture.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Complete trace capture', () => {
    it('should capture SourceResolver step', async () => {
      testFixture.enableScopeTracing();

      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Directly resolve a scope to trigger tracer
      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(scenario.actor.id);
      const result = testFixture.testEnv.scopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );

      const trace = testFixture.getScopeTraceData();
      const sourceSteps = trace.steps.filter(
        s => s.type === 'RESOLVER_STEP' && s.resolver === 'SourceResolver'
      );

      expect(sourceSteps.length).toBeGreaterThan(0);
    });

    it('should capture StepResolver step', async () => {
      testFixture.enableScopeTracing();

      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Resolve scope with step operations
      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(scenario.actor.id);
      testFixture.testEnv.scopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );

      const trace = testFixture.getScopeTraceData();
      const stepSteps = trace.steps.filter(
        s => s.type === 'RESOLVER_STEP' && s.resolver === 'StepResolver'
      );

      expect(stepSteps.length).toBeGreaterThan(0);
    });

    it('should capture FilterResolver step', async () => {
      testFixture.enableScopeTracing();

      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Resolve scope with filter operations
      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(scenario.actor.id);
      testFixture.testEnv.scopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );

      const trace = testFixture.getScopeTraceData();
      const filterSteps = trace.steps.filter(
        s => s.type === 'RESOLVER_STEP' && s.resolver === 'FilterResolver'
      );

      expect(filterSteps.length).toBeGreaterThan(0);
    });

    it('should capture filter evaluations per entity', async () => {
      testFixture.enableScopeTracing();

      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Resolve scope to trigger filter evaluations
      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(scenario.actor.id);
      testFixture.testEnv.scopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );

      const filterEvals = testFixture.getFilterBreakdown();

      expect(filterEvals.length).toBeGreaterThan(0);
      expect(filterEvals[0]).toHaveProperty('entityId');
      expect(filterEvals[0]).toHaveProperty('result');
      expect(filterEvals[0]).toHaveProperty('logic');
    });

    it('should capture complete resolver chain', async () => {
      testFixture.enableScopeTracing();

      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(scenario.actor.id);
      testFixture.testEnv.scopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );

      const trace = testFixture.getScopeTraceData();

      // Verify we have multiple resolver types in the chain
      const resolverTypes = new Set(
        trace.steps
          .filter(s => s.type === 'RESOLVER_STEP')
          .map(s => s.resolver)
      );

      expect(resolverTypes.size).toBeGreaterThan(1);
    });
  });
});
```

### Suite 2: Trace Data Quality

```javascript
describe('Trace data quality', () => {
  beforeEach(async () => {
    // Register scope for tracing
    await testFixture.registerCustomScope('positioning', 'close_actors');
  });

  it('should have correct step count', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(scenario.actor.id);
    testFixture.testEnv.scopeResolver.resolveSync(
      'positioning:close_actors',
      { actorEntity }
    );

    const trace = testFixture.getScopeTraceData();

    expect(trace.summary.totalSteps).toBeGreaterThan(0);
    expect(trace.steps).toHaveLength(trace.summary.totalSteps);
  });

  it('should list resolvers used', () => {
    // Verify summary.resolversUsed contains resolver names
  });

  it('should calculate duration', () => {
    // Verify summary.duration is a positive number
  });

  it('should preserve final output', () => {
    // Verify summary.finalOutput matches last step output
  });

  it('should track timestamps', () => {
    // Verify each step has timestamp
    // Verify timestamps are monotonically increasing
  });

  it('should serialize Set values correctly', () => {
    // Verify Set → {type: 'Set', size, values} conversion
  });

  it('should serialize Array values correctly', () => {
    // Verify Array serialization
  });

  it('should limit large collections', () => {
    // Verify collections > 10 items are truncated
  });
});
```

### Suite 3: Formatted Output

```javascript
describe('Formatted output', () => {
  beforeEach(async () => {
    // Register scope for tracing
    await testFixture.registerCustomScope('positioning', 'close_actors');
  });

  it('should format as human-readable text', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(scenario.actor.id);
    testFixture.testEnv.scopeResolver.resolveSync(
      'positioning:close_actors',
      { actorEntity }
    );

    const formatted = testFixture.getScopeTrace();

    expect(formatted).toContain('SCOPE EVALUATION TRACE');
    expect(formatted).toContain('SourceResolver');
    expect(formatted).toContain('Summary:');
  });

  it('should include all resolver steps', () => {
    // Verify all resolvers appear in formatted output
  });

  it('should include filter evaluations', () => {
    // Verify filter results appear with ✓/✗ symbols
  });

  it('should include summary section', () => {
    // Verify summary at end with step count, duration, final size
  });

  it('should use proper formatting symbols', () => {
    // Verify ✓ for pass, ✗ for fail
  });

  it('should indent nested data', () => {
    // Verify proper indentation for readability
  });
});
```

### Suite 4: Real-World Debugging Scenarios

```javascript
describe('Real-world debugging scenarios', () => {
  beforeEach(async () => {
    // Register scope for tracing
    await testFixture.registerCustomScope('positioning', 'actors_im_facing_away_from');
  });

  it('should help debug empty set mystery (spec example)', async () => {
    // Reproduce spec "Example 2: Empty Set Mystery"
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

    // Setup incorrect components (empty facing_away_from)
    testFixture.testEnv.entityManager.addComponent(
      scenario.target.id,
      'positioning:facing_away',
      { facing_away_from: [] }  // BUG: Should have actor ID
    );

    // Directly resolve the scope to trigger tracing
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(scenario.actor.id);
    const result = testFixture.testEnv.scopeResolver.resolveSync(
      'positioning:actors_im_facing_away_from',
      { actorEntity }
    );

    const trace = testFixture.getScopeTrace();

    // Verify trace shows the evaluation details
    expect(trace).toContain('SCOPE EVALUATION TRACE');

    // Check if trace shows filter operations
    const traceData = testFixture.getScopeTraceData();
    const hasFilterSteps = traceData.steps.some(s => s.type === 'FILTER_EVALUATION');

    if (hasFilterSteps) {
      // Verify filter evaluation captured
      const filterEvals = testFixture.getFilterBreakdown();
      expect(filterEvals).toBeDefined();
    }
  });

  it('should show which filter clause failed', async () => {
    // Test that trace identifies specific failing clause
  });

  it('should show component presence status', async () => {
    // Test that trace shows which components exist/missing
  });

  it('should help identify parameter type issues', async () => {
    // Test that trace would help catch context object mistake
  });
});
```

### Suite 5: Tracer Control

```javascript
describe('Tracer control', () => {
  it('should enable/disable tracing', () => {
    expect(testFixture.scopeTracer.isEnabled()).toBe(false);

    testFixture.enableScopeTracing();
    expect(testFixture.scopeTracer.isEnabled()).toBe(true);

    testFixture.disableScopeTracing();
    expect(testFixture.scopeTracer.isEnabled()).toBe(false);
  });

  it('should clear trace data', async () => {
    testFixture.enableScopeTracing();

    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    testFixture.testEnv.getAvailableActions(scenario.actor.id);

    let trace = testFixture.getScopeTraceData();
    expect(trace.steps.length).toBeGreaterThan(0);

    testFixture.clearScopeTrace();

    trace = testFixture.getScopeTraceData();
    expect(trace.steps.length).toBe(0);
  });

  it('should support conditional enable', () => {
    testFixture.enableScopeTracingIf(false);
    expect(testFixture.scopeTracer.isEnabled()).toBe(false);

    testFixture.enableScopeTracingIf(true);
    expect(testFixture.scopeTracer.isEnabled()).toBe(true);
  });
});
```

## Performance Benchmark Tests

**File**: `tests/performance/scopeDsl/tracerOverhead.performance.test.js`

```javascript
describe('Tracer Performance Overhead', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Register scope for tracing
    await testFixture.registerCustomScope('positioning', 'close_actors');
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should have minimal overhead when disabled', () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(scenario.actor.id);

    // Baseline: no tracer
    const start1 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testFixture.testEnv.scopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );
    }
    const duration1 = performance.now() - start1;

    // With tracer disabled
    testFixture.scopeTracer.disable();
    const start2 = performance.now();
    for (let i = 0; i < 1000; i++) {
      testFixture.testEnv.scopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );
    }
    const duration2 = performance.now() - start2;

    const overhead = ((duration2 - duration1) / duration1) * 100;
    expect(overhead).toBeLessThan(5); // Less than 5% overhead
  });

  it('should have acceptable overhead when enabled', () => {
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(scenario.actor.id);

    // Baseline: disabled
    const start1 = performance.now();
    for (let i = 0; i < 100; i++) {
      testFixture.testEnv.scopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );
    }
    const duration1 = performance.now() - start1;

    // With tracer enabled
    testFixture.enableScopeTracing();
    const start2 = performance.now();
    for (let i = 0; i < 100; i++) {
      testFixture.testEnv.scopeResolver.resolveSync(
        'positioning:close_actors',
        { actorEntity }
      );
      testFixture.clearScopeTrace();
    }
    const duration2 = performance.now() - start2;

    const overhead = ((duration2 - duration1) / duration1) * 100;
    expect(overhead).toBeLessThan(30); // Less than 30% overhead with tracing
  });

  it('should not leak memory with repeated tracing', () => {
    // Run many iterations with clear between
    // Verify no memory growth
  });
});
```

## Acceptance Criteria

### Trace Capture
- ✅ All resolver types captured
- ✅ Filter evaluations captured per entity
- ✅ Input/output captured for each step
- ✅ Timestamps captured

### Trace Data
- ✅ Summary statistics calculated correctly
- ✅ Resolvers used list is accurate
- ✅ Final output preserved
- ✅ Duration calculated

### Formatted Output
- ✅ Human-readable text format
- ✅ All steps included
- ✅ Summary section included
- ✅ Pass/fail indicators (✓/✗)

### Performance
- ✅ < 5% overhead when disabled
- ✅ < 30% overhead when enabled
- ✅ No memory leaks

### Real-World Utility
- ✅ Helps debug empty set mystery
- ✅ Shows filter failures clearly
- ✅ Identifies component issues

## Test Execution

```bash
# Run integration tests
npm run test:integration -- tests/integration/scopeDsl/scopeTracingIntegration.test.js

# Run performance tests
npm run test:performance -- tests/performance/scopeDsl/tracerOverhead.performance.test.js

# Run all scope tracing tests
npm run test -- --testNamePattern="Scope Tracing|Tracer"
```

## Success Metrics

- ✅ All integration tests pass
- ✅ Performance benchmarks within targets
- ✅ No eslint errors
- ✅ Coverage >= 90% for tracer code paths

## References

- **Spec Section**: 7.2 Integration Tests (lines 2406-2466)
- **Spec Section**: 7.3 Performance Benchmarks (lines 2468-2536)
- **Example Section**: 5. Usage Examples, Example 2 (lines 1887-2001)
- **Related Tickets**:
  - MODTESDIAIMP-009 (ScopeEvaluationTracer class)
  - MODTESDIAIMP-010 (ModTestFixture integration)
  - MODTESDIAIMP-011 (ScopeEngine integration)
