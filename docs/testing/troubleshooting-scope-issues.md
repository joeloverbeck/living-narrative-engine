# Troubleshooting Scope Resolution Issues

This guide helps debug common scope resolution problems using ModTestFixture diagnostics features.

> **See Also**: For ScopeDSL syntax errors and general troubleshooting, see [docs/scopeDsl/troubleshooting.md](../scopeDsl/troubleshooting.md). This guide focuses specifically on using ModTestFixture's tracing and diagnostics features.

## Common Issues

### 1. Action Not Discovered

**Symptom**: Expected action doesn't appear in available actions

**Diagnostic Approach**:
```javascript
it('debug missing action', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
  const actions = testFixture.discoverActions(scenario.actor.id);

  expect(actions.some(a => a.id === 'positioning:sit_down')).toBe(true);
});
```

**Trace Analysis**:
1. Check if scope resolves to empty set
2. Examine filter evaluations per entity
3. Identify which filter clause failed

**Example Output**:
```
3. [FilterResolver] Evaluating 2 entities

   Entity: actor-bob-456
   Result: FAIL ✗
   Breakdown:
     ✗ and
       ✓ ==: var("type") equals "actor"
       ✗ component_present: Component "positioning:sitting" is present
```

**Solution**: Target is missing required component

### 2. Empty Set Mystery

**Symptom**: Scope resolves to empty set unexpectedly

**Diagnostic Approach**:
```javascript
it('debug empty set', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
  testFixture.discoverActions(scenario.actor.id);

  const trace = testFixture.getScopeTrace();
  console.log(trace);
});
```

**What to Check**:
1. **Step output sizes**: Which step produces empty set?
2. **Filter results**: Did all entities fail the filter?
3. **Component presence**: Are required components present?

### 3. Parameter Validation Error

**Symptom**: `ParameterValidationError` thrown

**Example Error**:
```
ParameterValidationError: Expected actorEntity (object with .id), got object
  Source: resolveCustomScope
  💡 Hint: Extract actorEntity from context before passing
```

**Solution**:
```javascript
// ❌ Wrong
const result = scopeEngine.resolve(ast, context, runtimeCtx);

// ✅ Correct
const actorEntity = context.actorEntity || context.actor;
const result = scopeEngine.resolve(ast, actorEntity, runtimeCtx);
```

### 4. Slow Scope Resolution

**Symptom**: Scope resolution takes too long

**Diagnostic Approach**:
```javascript
it('analyze performance bottleneck', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
  testFixture.discoverActions(scenario.actor.id);

  const metrics = testFixture.getScopePerformanceMetrics();

  console.log('Resolver Timing:');
  metrics.resolverStats.forEach(stat => {
    console.log(`  ${stat.resolver}: ${stat.totalTime.toFixed(2)}ms (${stat.percentage.toFixed(1)}%)`);
  });

  console.log('\nSlowest Operations:');
  metrics.slowestOperations.steps.slice(0, 3).forEach((step, i) => {
    console.log(`  ${i + 1}. ${step.resolver}: ${step.duration.toFixed(2)}ms`);
  });
});
```

**What to Look For**:
- Which resolver takes most time?
- Are filter evaluations slow?
- Is overhead percentage high?

## Best Practices

### When to Enable Tracing

✅ **Enable for**:
- Debugging failing tests
- Understanding complex scope behavior
- Performance analysis
- Investigating empty set issues

❌ **Don't enable for**:
- All tests by default (performance overhead)
- Production code
- Passing tests (unnecessary noise)

### Conditional Tracing Pattern

```javascript
it('test with conditional tracing', async () => {
  const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);
  const actions = testFixture.discoverActions(scenario.actor.id);

  // Only trace if test would fail
  if (actions.length === 0) {
    testFixture.enableScopeTracing();
    testFixture.discoverActions(scenario.actor.id);
    console.log(testFixture.getScopeTrace());
  }

  expect(actions).not.toHaveLength(0);
});
```

### Performance Analysis Workflow

1. Enable tracing with performance focus
2. Run action discovery
3. Get performance metrics
4. Identify bottlenecks
5. Optimize slowest operations

```javascript
testFixture.enableScopeTracing();
// ... run operations ...
const perfTrace = testFixture.getScopeTraceWithPerformance();
console.log(perfTrace);
```
