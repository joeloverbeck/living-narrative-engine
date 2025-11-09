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

### Architecture Overview

**Important**: The ScopeEngine uses a **dispatcher pattern**, not direct method dispatch:

- **ScopeEngine** does NOT have a `dispatch()` method
- Instead, `_ensureInitialized()` creates a **dispatcher object** via `createDispatcher(resolvers)`
- The dispatcher is a simple routing mechanism with a `resolve(node, ctx)` method
- Resolvers are **factory functions** (not classes) stored in an array
- The dispatcher finds the appropriate resolver using `canResolve(node)` and calls its `resolve()` method
- **Tracing must be added in `_resolveWithDepthAndCycleChecking()`**, which is the actual execution point

### Files to Modify

1. **ScopeEngine** - `src/scopeDsl/engine.js`
2. **FilterResolver** - `src/scopeDsl/nodes/filterResolver.js`
3. **SourceResolver** - `src/scopeDsl/nodes/sourceResolver.js` (already has trace support)
4. **StepResolver** - `src/scopeDsl/nodes/stepResolver.js` (already has trace helpers)

### 1. ScopeEngine.resolve() - Add Tracer to Context

**File**: `src/scopeDsl/engine.js`
**Method**: `resolve(ast, actorEntity, runtimeCtx, trace = null)`

**Current Implementation**: The context is created within `resolve()` and passed to `_resolveWithDepthAndCycleChecking()`.

```javascript
resolve(ast, actorEntity, runtimeCtx, trace = null) {
  // ...existing validation and initialization...

  // Create resolution context for resolvers with wrapped dispatcher
  const ctx = {
    actorEntity,
    runtimeCtx,
    trace,
    tracer: runtimeCtx?.tracer, // ADD: Extract tracer from runtimeCtx
    dispatcher: {
      resolve: (node, innerCtx) =>
        this._resolveWithDepthAndCycleChecking(
          node,
          innerCtx,
          dispatcher,
          cycleDetector,
          depthGuard
        ),
    },
    depth: 0,
    cycleDetector,
    depthGuard,
  };

  const result = this._resolveWithDepthAndCycleChecking(
    ast,
    ctx,
    dispatcher,
    cycleDetector,
    depthGuard
  );

  return result;
}
```

### 2. ScopeEngine._resolveWithDepthAndCycleChecking() - Log Resolver Steps

**File**: `src/scopeDsl/engine.js`
**Method**: `_resolveWithDepthAndCycleChecking(node, ctx, dispatcher, cycleDetector, depthGuard)`

**Current Implementation**: This is the actual execution point where the dispatcher resolves nodes. The dispatcher is a separate object created by `createDispatcher(resolvers)` in `_ensureInitialized()`.

**Note**: ScopeEngine does NOT have a `dispatch()` method. The `dispatcher` is a separate object with a `resolve()` method.

```javascript
_resolveWithDepthAndCycleChecking(
  node,
  ctx,
  dispatcher,
  cycleDetector,
  depthGuard
) {
  // ...existing depth and cycle checking...

  try {
    // Create new context with incremented depth and wrapped dispatcher
    const newCtx = {
      ...ctx,
      depth: ctx.depth + 1,
      dispatcher: {
        resolve: (innerNode, innerCtx) => {
          const mergedCtx = this.contextMerger.merge(ctx, innerCtx);
          return this._resolveWithDepthAndCycleChecking(
            innerNode,
            mergedCtx,
            dispatcher,
            cycleDetector,
            depthGuard
          );
        },
      },
    };

    // ADD: Tracer integration - Log BEFORE resolution
    const tracer = ctx.tracer || newCtx.tracer;
    if (tracer?.isEnabled()) {
      const input = ctx.currentSet || new Set([ctx.actorEntity.id]);

      // Execute resolution
      const result = dispatcher.resolve(node, newCtx);

      // Build resolver name from node type
      // Note: The dispatcher (created by createDispatcher) doesn't expose its resolvers,
      // so we build the name from the node type instead
      const resolverName = this._getResolverNameFromNode(node);

      // Log step to tracer after resolution
      const operation = this._buildOperationDescription(node);
      tracer.logStep(
        resolverName,
        operation,
        input,
        result,
        { node }
      );

      return result;
    }

    // Normal execution without tracing
    return dispatcher.resolve(node, newCtx);
  } finally {
    cycleDetector.leave();
  }
}

/**
 * Get resolver name from node type.
 * Maps node types to their corresponding resolver names.
 * @private
 */
_getResolverNameFromNode(node) {
  switch (node.type) {
    case 'Source':
      return 'SourceResolver';
    case 'Step':
      // Check if it's a clothing-specific step
      if (node.field === 'items_in_slot' || node.field === 'slot_accessibility') {
        return node.field === 'items_in_slot' ? 'SlotAccessResolver' : 'ClothingStepResolver';
      }
      return 'StepResolver';
    case 'Filter':
      return 'FilterResolver';
    case 'Union':
      return 'UnionResolver';
    case 'ArrayIterationStep':
      return 'ArrayIterationResolver';
    case 'ScopeReference':
      return 'ScopeReferenceResolver';
    default:
      return 'UnknownResolver';
  }
}

/**
 * Build a human-readable operation description from a node.
 * @private
 */
_buildOperationDescription(node) {
  switch (node.type) {
    case 'Source':
      return `resolve(kind='${node.kind}'${node.param ? `, param='${node.param}'` : ''})`;
    case 'Step':
      return `resolve(field='${node.field}')`;
    case 'Filter':
      return 'resolve(filter)';
    case 'Union':
      return 'resolve(union)';
    case 'ArrayIterationStep':
      return 'resolve(array iteration)';
    case 'ScopeReference':
      return `resolve(scopeRef='${node.scopeId}')`;
    default:
      return `resolve(type='${node.type}')`;
  }
}
```

### 3. FilterResolver.resolve() - Log Filter Evaluations

**File**: `src/scopeDsl/nodes/filterResolver.js`
**Method**: `resolve(node, ctx)`

**Current Implementation**: FilterResolver is a factory function (not a class), created by `createFilterResolver()`.

**Note**: The tracer needs to be extracted from `ctx` and checked for each entity evaluation.

```javascript
resolve(node, ctx) {
  const { actorEntity, dispatcher, trace } = ctx;
  const tracer = ctx.tracer; // ADD: Extract tracer from context
  const logger = ctx?.runtimeCtx?.logger || null;

  // ...existing validation and preprocessing...

  const result = new Set();
  const filterEvaluations = []; // Existing trace collection

  for (const item of parentResult) {
    // ...skip null/undefined items...

    if (Array.isArray(item)) {
      // ...handle array elements...
    } else {
      // Handle single items (entity IDs or objects)
      let evalCtx = null;
      try {
        evalCtx = createEvaluationContext(
          item,
          actorEntity,
          entitiesGateway,
          locationProvider,
          trace,
          ctx.runtimeCtx,
          processedActor
        );

        if (!evalCtx) {
          continue;
        }

        const evalResult = logicEval.evaluate(node.logic, evalCtx);

        // ADD: Log to tracer (in addition to existing trace logging)
        if (tracer?.isEnabled()) {
          const entityId = typeof item === 'string' ? item : item?.id;
          tracer.logFilterEvaluation(
            entityId,
            node.logic,
            evalResult,
            evalCtx
          );
        }

        // Existing trace capture (keep this)
        if (trace) {
          const itemEntity =
            typeof item === 'string' ? entitiesGateway.getEntityInstance(item) : item;
          filterEvaluations.push({
            entityId: typeof item === 'string' ? item : item?.id,
            passedFilter: evalResult,
            evaluationContext: {
              // ...existing context details...
            },
          });
        }

        if (evalResult) {
          result.add(item);
        }
      } catch (error) {
        // ...existing error handling...
      }
    }
  }

  // ...existing trace logging...

  return result;
}
```

### 4. SourceResolver.resolve() - Already Captured

**Note**: SourceResolver steps are already captured by `ScopeEngine._resolveWithDepthAndCycleChecking()`.
No additional logging needed unless specific detail required.

**Current Implementation**: SourceResolver already has trace logging when `trace` is provided in context.

### 5. StepResolver.resolve() - Already Captured

**Note**: StepResolver steps are already captured by `ScopeEngine._resolveWithDepthAndCycleChecking()`.
No additional logging needed unless specific detail required.

**Current Implementation**: StepResolver has minimal trace logging via `logStepResolution()` helper (currently no-op).

## Acceptance Criteria

### ScopeEngine
- ✅ Tracer extracted from `runtimeCtx` and added to context in `resolve()`
- ✅ Tracer passed in context to all resolvers
- ✅ `_resolveWithDepthAndCycleChecking()` logs resolver steps when tracer enabled
- ✅ Input/output captured for each resolver execution
- ✅ Resolver name correctly identified via `_getResolverNameFromNode()` helper
- ✅ No logging when tracer disabled or not present
- ✅ Minimal overhead when disabled (< 5%)
- ✅ Helper method `_getResolverNameFromNode()` maps node types to resolver names
- ✅ Helper method `_buildOperationDescription()` creates human-readable operation strings

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
    it('should work when runtimeCtx does not have tracer')
  });

  describe('Resolution logging', () => {
    it('should log resolver step when tracer enabled')
    it('should not log when tracer disabled')
    it('should include correct resolver name')
    it('should include input/output sets')
    it('should include node in details')
    it('should build correct operation description for Source nodes')
    it('should build correct operation description for Step nodes')
    it('should build correct operation description for Filter nodes')
  });

  describe('Helper method: _getResolverNameFromNode', () => {
    it('should return "SourceResolver" for Source nodes')
    it('should return "StepResolver" for Step nodes')
    it('should return "SlotAccessResolver" for items_in_slot field')
    it('should return "ClothingStepResolver" for slot_accessibility field')
    it('should return "FilterResolver" for Filter nodes')
    it('should return "UnionResolver" for Union nodes')
    it('should return "ArrayIterationResolver" for ArrayIterationStep nodes')
    it('should return "ScopeReferenceResolver" for ScopeReference nodes')
    it('should return "UnknownResolver" for unknown node types')
  });

  describe('Helper method: _buildOperationDescription', () => {
    it('should format Source nodes with kind and param')
    it('should format Step nodes with field name')
    it('should format Filter, Union, ArrayIteration nodes')
    it('should format ScopeReference nodes with scopeId')
  });

  describe('Performance', () => {
    it('should have minimal overhead when disabled')
    it('should not call logStep when disabled')
    it('should not call logStep when tracer is undefined')
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

## Key Corrections from Codebase Analysis

This workflow has been updated to reflect the actual production code structure:

### ✅ **Corrected Assumptions**

1. **ScopeEngine Architecture**:
   - ❌ OLD: "ScopeEngine has a `dispatch()` method"
   - ✅ NEW: "ScopeEngine uses `_resolveWithDepthAndCycleChecking()` which calls a separate `dispatcher` object"

2. **Dispatcher Pattern**:
   - ❌ OLD: "Resolvers stored in `this.#resolvers` Map"
   - ✅ NEW: "Dispatcher is created by `createDispatcher(resolvers)` with resolvers in an array"

3. **Resolver Implementation**:
   - ❌ OLD: "Resolvers are classes with constructor.name"
   - ✅ NEW: "Resolvers are factory functions returning objects with `canResolve()` and `resolve()` methods"

4. **Resolver Name Resolution**:
   - ❌ OLD: "Extract resolver name from `resolver.constructor.name`"
   - ✅ NEW: "Map node type to resolver name via `_getResolverNameFromNode()` helper"

5. **Integration Point**:
   - ❌ OLD: "Add tracing in `ScopeEngine.dispatch()`"
   - ✅ NEW: "Add tracing in `ScopeEngine._resolveWithDepthAndCycleChecking()`"

### 📋 **Implementation Changes**

- Added `_getResolverNameFromNode()` helper to map node types to resolver names
- Added `_buildOperationDescription()` helper to format operation strings
- Updated context creation in `resolve()` to include `tracer: runtimeCtx?.tracer`
- Modified `_resolveWithDepthAndCycleChecking()` to log steps when tracer is enabled
- FilterResolver extracts tracer from context and logs individual entity evaluations

## References

- **Spec Section**: 3.3 Integration with ScopeEngine (lines 1079-1131)
- **Spec Section**: 3.3 Integration with FilterResolver (lines 1133-1173)
- **Related Tickets**:
  - MODTESDIAIMP-009 (ScopeEvaluationTracer class)
  - MODTESDIAIMP-010 (ModTestFixture integration)
  - MODTESDIAIMP-012 (Integration tests)
- **Codebase Files Analyzed**:
  - `src/scopeDsl/engine.js` (ScopeEngine implementation)
  - `src/scopeDsl/nodes/dispatcher.js` (Dispatcher factory)
  - `src/scopeDsl/nodes/filterResolver.js` (FilterResolver factory)
  - `src/scopeDsl/nodes/sourceResolver.js` (SourceResolver factory)
  - `src/scopeDsl/nodes/stepResolver.js` (StepResolver factory)
  - `tests/common/mods/scopeEvaluationTracer.js` (Tracer class)
