# Multi-Target Resolution Migration Guide

This guide documents the refactoring of `MultiTargetResolutionStage` from a monolithic 1,085-line class to a service-oriented architecture.

## Refactoring Overview

### Before (Commits before 22c282154)

- **Structure:** Single 1,085-line class
- **Concerns:** Mixed orchestration, tracing, result building, resolution
- **Testability:** Low (monolithic, hard to isolate)
- **Modifiability:** Low (changes ripple across file)

### After (Commit ba0aaffa8 and later)

- **Structure:** 556-line orchestrator + 3 services (~530 lines)
- **Concerns:** Separated into dedicated services
- **Testability:** High (services independently testable)
- **Modifiability:** High (localized changes)

## Extracted Services

### 1. TargetResolutionTracingOrchestrator (~200 lines)

**Extracted from:** Inline trace calls scattered throughout stage

**Before:**

```javascript
// MultiTargetResolutionStage.js - lines 200-400 (approximate)
if (trace && typeof trace.captureActionData === 'function') {
  trace.captureActionData('legacy_action_detected', {
    actionId,
    legacyFormat: true,
  });
}
// ... 26 more trace calls with similar conditionals
```

**After:**

```javascript
// TargetResolutionTracingOrchestrator.js
captureLegacyDetection(trace, actionId, data) {
  if (this.isActionAwareTrace(trace)) {
    trace.captureActionData('legacy_action_detected', data);
  }
}

// MultiTargetResolutionStage.js
this.#tracingOrchestrator.captureLegacyDetection(trace, actionId, data);
```

**Benefits:**

- Centralized trace capability detection
- Consistent trace call patterns
- Easier to add new trace events
- Testable in isolation

### 2. TargetResolutionResultBuilder (~150 lines)

**Extracted from:** Result assembly logic in 3 locations

**Before:**

```javascript
// MultiTargetResolutionStage.js - result assembly scattered
const legacyResult = PipelineResult.success({
  candidateActions: [
    {
      ...actionDef,
      resolvedTargets: { ...resolvedTargets },
      // ... metadata attachment logic
    },
  ],
  targetContexts: [...targetContexts], // Backward compat
});

// ... similar logic in 2 other places
```

**After:**

```javascript
// TargetResolutionResultBuilder.js
buildLegacyResult(context, targets, targetContexts, conversion, actionDef) {
  return PipelineResult.success({
    candidateActions: [{
      ...actionDef,
      resolvedTargets: this.#formatTargets(targets),
      ...this.#buildMetadata(conversion)
    }],
    targetContexts
  });
}

// MultiTargetResolutionStage.js
const result = this.#resultBuilder.buildLegacyResult(
  context, targets, targetContexts, conversion, actionDef
);
```

**Benefits:**

- Single source of truth for result format
- Consistent metadata attachment
- Backward compatibility in one place
- Easy to modify result structure

### 3. TargetResolutionCoordinator (~180 lines)

**Extracted from:** Multi-target resolution and dependency handling

**Before:**

```javascript
// MultiTargetResolutionStage.js - dependency resolution inline
const dependencyOrder = this.#dependencyResolver.getResolutionOrder(targets);
const resolvedTargets = {};

for (const targetDef of dependencyOrder) {
  if (targetDef.contextFrom) {
    // Resolve dependent target with context
    const primaryTarget = resolvedTargets[targetDef.contextFrom];
    // ... 30+ lines of resolution logic
  } else {
    // Resolve independent target
    // ... 30+ lines of resolution logic
  }
}
```

**After:**

```javascript
// TargetResolutionCoordinator.js
async resolveTargets(context, actionDef, trace) {
  const order = this.#dependencyResolver.getResolutionOrder(actionDef.targets);
  const results = {};

  for (const target of order) {
    results[target.placeholder] = target.contextFrom
      ? await this.#resolveDependent(context, target, results, trace)
      : await this.#resolvePrimary(context, target, trace);
  }

  return results;
}

// MultiTargetResolutionStage.js
const results = await this.#resolutionCoordinator.resolveTargets(
  context, actionDef, trace
);
```

**Benefits:**

- Clear separation of resolution logic
- Easier to add new resolution strategies
- Testable dependency handling
- Reduced complexity in main stage

## Migration Patterns

### Pattern 1: Adding New Trace Events

**Before Refactoring:**

```javascript
// Had to modify MultiTargetResolutionStage.js
if (trace && typeof trace.captureActionData === 'function') {
  trace.captureActionData('new_event', {
    /* data */
  });
}
```

**After Refactoring:**

```javascript
// 1. Add to ITargetResolutionTracingOrchestrator.js interface
captureNewEvent(trace, eventData);

// 2. Implement in TargetResolutionTracingOrchestrator.js
captureNewEvent(trace, eventData) {
  if (this.isActionAwareTrace(trace)) {
    trace.captureActionData('new_event', eventData);
  }
}

// 3. Call from MultiTargetResolutionStage.js
this.#tracingOrchestrator.captureNewEvent(trace, data);
```

**Impact:** Only orchestrator changes, stage/coordinator/builder unchanged

### Pattern 2: Changing Result Format

**Before Refactoring:**

```javascript
// Had to find and update 3 different locations in MultiTargetResolutionStage.js
return PipelineResult.success({
  candidateActions: [
    {
      /* format */
    },
  ],
});
```

**After Refactoring:**

```javascript
// Only modify TargetResolutionResultBuilder.js
buildMultiTargetResult(context, results, actionDef) {
  return PipelineResult.success({
    candidateActions: [{
      ...actionDef,
      resolvedTargets: results,
      newField: 'new data' // Add new field
    }]
  });
}
```

**Impact:** Only result builder changes, stage/orchestrator/coordinator unchanged

### Pattern 3: New Resolution Strategy

**Before Refactoring:**

```javascript
// Had to modify resolution logic embedded in MultiTargetResolutionStage.js
// Mixed with tracing and result building
```

**After Refactoring:**

```javascript
// Only modify TargetResolutionCoordinator.js
async resolveWithNewStrategy(context, target, trace) {
  // Implement new strategy
  const resolved = await this.#newStrategy(context, target);

  // Tracing handled by orchestrator (separation)
  this.#tracingOrchestrator.captureResolutionData(trace, resolved);

  return resolved;
}
```

**Impact:** Only coordinator changes, stage/orchestrator/builder unchanged

## Testing Strategy Migration

### Before: Monolithic Testing

```javascript
describe('MultiTargetResolutionStage', () => {
  it('should resolve targets and trace and build results', () => {
    // Test had to verify all concerns at once
    // Hard to isolate failures
    // Complex setup
  });
});
```

### After: Service-Based Testing

```javascript
// Unit test each service
describe('TargetResolutionTracingOrchestrator', () => {
  it('should capture legacy detection', () => {
    // Test only tracing concern
  });
});

describe('TargetResolutionResultBuilder', () => {
  it('should build results with backward compat', () => {
    // Test only result building concern
  });
});

describe('TargetResolutionCoordinator', () => {
  it('should resolve in dependency order', () => {
    // Test only resolution concern
  });
});

// Integration test coordination
describe('MultiTargetResolutionStage Integration', () => {
  it('should coordinate all services', () => {
    // Test service interaction
    // Mock services for isolation
  });
});
```

## Common Pitfalls

### ❌ Pitfall 1: Bypassing Services

```javascript
// Wrong: Direct operation that should use service
if (trace && trace.captureActionData) {
  trace.captureActionData('event', data);
}
```

**Fix:** Always delegate to appropriate service

```javascript
// Right: Use service
this.#tracingOrchestrator.captureEvent(trace, data);
```

### ❌ Pitfall 2: Mixing Concerns

```javascript
// Wrong: Building results in coordinator
class TargetResolutionCoordinator {
  async resolveTargets() {
    const resolved = await this.#resolve();
    return PipelineResult.success({ resolved }); // Result building!
  }
}
```

**Fix:** Return raw data, delegate result building

```javascript
// Right: Coordinator returns raw data
class TargetResolutionCoordinator {
  async resolveTargets() {
    return await this.#resolve(); // Raw results
  }
}

// Stage delegates to result builder
const rawResults = await coordinator.resolveTargets();
const result = resultBuilder.buildMultiTargetResult(
  context,
  rawResults,
  action
);
```

### ❌ Pitfall 3: Modifying Multiple Services for Simple Changes

```javascript
// Wrong: Changing result format requires coordinator change
class TargetResolutionCoordinator {
  async resolveTargets() {
    return {
      targets: resolved,
      newMetadata: 'data', // Adding metadata in coordinator
    };
  }
}
```

**Fix:** Keep services focused on single responsibility

```javascript
// Right: Coordinator returns targets only
class TargetResolutionCoordinator {
  async resolveTargets() {
    return resolved; // Just targets
  }
}

// Result builder adds metadata
class TargetResolutionResultBuilder {
  buildMultiTargetResult(context, targets, action) {
    return PipelineResult.success({
      candidateActions: [
        {
          ...action,
          resolvedTargets: targets,
          metadata: this.#buildMetadata(), // Metadata in builder
        },
      ],
    });
  }
}
```

## Metrics

| Metric            | Before     | After     | Change      |
| ----------------- | ---------- | --------- | ----------- |
| **Lines of Code** |
| Main file         | 1,085      | 556       | -529 (-49%) |
| Services (total)  | 0          | 530       | +530        |
| Total system      | 1,085      | 1,086     | +1 (~0%)    |
| **Complexity**    |
| Concerns per file | 4-5        | 1         | -75%        |
| Max method length | ~120 lines | ~60 lines | -50%        |
| Cognitive load    | High       | Low       | ✓           |
| **Quality**       |
| Testability       | Low        | High      | ✓           |
| Maintainability   | Low        | High      | ✓           |
| Extensibility     | Low        | High      | ✓           |

## Key Takeaways

1. **No Functional Changes:** Refactoring preserved all existing behavior
2. **Better Organization:** Same code, better structure
3. **Easier Maintenance:** Changes localized to specific services
4. **Improved Testing:** Services independently testable
5. **Clear Responsibilities:** Each service has single concern

## Related Documentation

- **Architecture:** `docs/architecture/target-resolution-services.md`
- **Diagrams:** `docs/architecture/diagrams/multi-target-resolution-architecture.md`
- **Testing:** `docs/testing/integration-test-patterns.md` (Target Resolution section)
- **Project Guide:** `CLAUDE.md` (Target Resolution Service Pattern section)
