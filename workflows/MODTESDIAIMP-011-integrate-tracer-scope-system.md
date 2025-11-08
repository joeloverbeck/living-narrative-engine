# MODTESDIAIMP-011: Integrate Tracer into ScopeEngine and Resolvers

**Phase**: 3 - Scope Evaluation Tracer
**Priority**: 🟡 High
**Estimated Effort**: 4 hours
**Dependencies**: MODTESDIAIMP-009, MODTESDIAIMP-010

---

## Overview

Integrate scope evaluation tracer into `ScopeEngine` and scope resolvers to capture step-by-step execution flow, enabling detailed debugging of scope resolution.

## Objectives

- Add tracer logging to ScopeEngine.dispatch()
- Add tracer logging to FilterResolver.resolve()
- Add tracer logging to SourceResolver.resolve()
- Add tracer logging to StepResolver.resolve()
- Ensure minimal performance impact when disabled
- Preserve existing trace parameter functionality

## Implementation Details

### Files to Modify

1. **ScopeEngine** - `src/scopeDsl/engine.js`
2. **FilterResolver** - `src/scopeDsl/nodes/filterResolver.js`
3. **SourceResolver** - `src/scopeDsl/nodes/sourceResolver.js`
4. **StepResolver** - `src/scopeDsl/nodes/stepResolver.js`

### 1. ScopeEngine.resolve() - Add Tracer to Context

**File**: `src/scopeDsl/engine.js`
**Method**: `resolve(ast, actorEntity, runtimeCtx, trace = null)`

```javascript
resolve(ast, actorEntity, runtimeCtx, trace = null) {
  // ...existing validation...

  const ctx = {
    actorEntity,
    runtimeCtx,
    trace,
    tracer: runtimeCtx.tracer, // ADD: tracer from runtimeCtx
    // ...existing context properties...
  };

  const result = this.dispatch(ast, ctx);
  return result;
}
```

### 2. ScopeEngine.dispatch() - Log Resolver Steps

**File**: `src/scopeDsl/engine.js`
**Method**: `dispatch(node, ctx)`

```javascript
dispatch(node, ctx) {
  const { kind } = node;
  const resolver = this.#resolvers.get(kind);

  if (!resolver) {
    throw new Error(`No resolver for node kind: ${kind}`);
  }

  // ADD: Tracer integration
  if (ctx.tracer?.isEnabled()) {
    const input = ctx.currentSet || ctx.actorEntity;
    const resolverName = resolver.constructor.name;

    const result = resolver.resolve(node, ctx);

    // Log step to tracer after resolution
    ctx.tracer.logStep(
      resolverName,
      `resolve(kind='${kind}')`,
      input,
      result,
      { node }
    );

    return result;
  }

  // Normal execution without tracing
  return resolver.resolve(node, ctx);
}
```

### 3. FilterResolver.resolve() - Log Filter Evaluations

**File**: `src/scopeDsl/nodes/filterResolver.js`
**Method**: `resolve(node, ctx)`

```javascript
resolve(node, ctx) {
  const { actorEntity, dispatcher, trace, tracer } = ctx; // ADD: extract tracer

  // ...existing validation...

  const result = new Set();

  for (const item of currentSet) {
    const entityId = typeof item === 'string' ? item : item?.id;

    // ...build evalCtx...

    const passedFilter = logicEval.evaluate(node.logic, evalCtx);

    // ADD: Log to tracer
    if (tracer?.isEnabled()) {
      tracer.logFilterEvaluation(
        entityId,
        node.logic,
        passedFilter,
        evalCtx
      );
    }

    if (passedFilter) {
      result.add(item);
    }

    // ...existing trace logging...
  }

  return result;
}
```

### 4. SourceResolver.resolve() - Already Captured

**Note**: SourceResolver steps are already captured by ScopeEngine.dispatch().
No additional logging needed unless specific detail required.

### 5. StepResolver.resolve() - Already Captured

**Note**: StepResolver steps are already captured by ScopeEngine.dispatch().
No additional logging needed unless specific detail required.

## Acceptance Criteria

### ScopeEngine
- ✅ Tracer extracted from `runtimeCtx`
- ✅ Tracer passed in context to resolvers
- ✅ `dispatch()` logs resolver steps when enabled
- ✅ Input/output captured for each resolver
- ✅ Resolver name included in log
- ✅ No logging when tracer disabled
- ✅ Minimal overhead when disabled (< 5%)

### FilterResolver
- ✅ Tracer extracted from context
- ✅ Filter evaluations logged per entity
- ✅ Entity ID included in log
- ✅ Logic expression included
- ✅ Pass/fail result included
- ✅ Eval context included
- ✅ No logging when tracer disabled

### Performance
- ✅ Tracer check is fast (isEnabled() guard)
- ✅ Logging only happens when enabled
- ✅ No performance regression when disabled

### Compatibility
- ✅ Existing trace parameter still works
- ✅ Backward compatible with tests

## Testing Requirements

### Unit Tests

**File**: `tests/unit/scopeDsl/engine.tracer.test.js` (new)

```javascript
describe('ScopeEngine - Tracer Integration', () => {
  describe('Tracer in context', () => {
    it('should pass tracer from runtimeCtx to context')
    it('should work when tracer is undefined')
  });

  describe('Dispatch logging', () => {
    it('should log resolver step when tracer enabled')
    it('should not log when tracer disabled')
    it('should include resolver name')
    it('should include input/output')
    it('should include node in details')
  });

  describe('Performance', () => {
    it('should have minimal overhead when disabled')
    it('should not call logStep when disabled')
  });
});
```

**File**: `tests/unit/scopeDsl/nodes/filterResolver.tracer.test.js` (new)

```javascript
describe('FilterResolver - Tracer Integration', () => {
  describe('Filter evaluation logging', () => {
    it('should log filter evaluation when tracer enabled')
    it('should not log when tracer disabled')
    it('should include entity ID')
    it('should include logic expression')
    it('should include pass/fail result')
    it('should include eval context')
  });

  describe('Multiple entities', () => {
    it('should log evaluation for each entity')
    it('should track pass/fail for each')
  });
});
```

### Integration Tests

**File**: `tests/integration/scopeDsl/scopeTracingIntegration.test.js` (new)

```javascript
describe('Scope Tracing Integration', () => {
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

  describe('Complete trace capture', () => {
    it('should capture SourceResolver step')
    it('should capture StepResolver step')
    it('should capture FilterResolver step')
    it('should capture filter evaluations')
  });

  describe('Trace data', () => {
    it('should have correct step count')
    it('should list resolvers used')
    it('should calculate duration')
    it('should preserve final output')
  });

  describe('Formatted output', () => {
    it('should format as human-readable text')
    it('should include all steps')
    it('should include summary')
  });
});
```

## Migration Impact

### Breaking Changes
- **None** - Tracer is optional

### Backward Compatibility
- Existing code works without tracer
- Tests without tracer in runtimeCtx continue to work

## Performance Testing

**File**: `tests/performance/scopeDsl/tracerOverhead.performance.test.js`

Verify:
- < 5% overhead when disabled
- < 30% overhead when enabled
- No memory leaks with repeated tracing

## Usage Example

```javascript
it('debug with scope tracing', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
  const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);

  if (actions.length === 0) {
    console.log(testFixture.getScopeTrace());
  }

  expect(actions).not.toHaveLength(0);
});
```

**Expected Output**:
```
SCOPE EVALUATION TRACE:
================================================================================

1. [SourceResolver] resolve(kind='actor')
   Input: Context object
   Output: Set (1 item) ['actor-alice-123']

2. [StepResolver] resolve(field='components.positioning:closeness.partners')
   Input: Set (1 item) ['actor-alice-123']
   Output: Set (1 item) ['actor-bob-456']

3. [FilterResolver] Evaluating 1 entities

   Entity: actor-bob-456
   Result: PASS ✓

   Output: Set (1 item) ['actor-bob-456']

================================================================================
Summary: 3 steps, 12ms, Final size: 1
```

## References

- **Spec Section**: 3.3 Integration with ScopeEngine (lines 1079-1131)
- **Spec Section**: 3.3 Integration with FilterResolver (lines 1133-1173)
- **Related Tickets**:
  - MODTESDIAIMP-009 (ScopeEvaluationTracer class)
  - MODTESDIAIMP-010 (ModTestFixture integration)
  - MODTESDIAIMP-012 (Integration tests)
