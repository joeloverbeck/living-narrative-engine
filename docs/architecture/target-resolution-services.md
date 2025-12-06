# Target Resolution Services

## Overview

The target resolution pipeline uses specialized services to handle different concerns, following the Single Responsibility Principle. This document describes the three core services extracted during the MULTARRESSTAREF refactoring.

## Service Responsibilities

### TargetResolutionTracingOrchestrator

**Purpose:** Centralize all tracing instrumentation

**Responsibilities:**

- Detect trace capabilities (action-aware vs. standard)
- Capture legacy detection and conversion events
- Capture scope evaluation events
- Capture resolution data and errors
- Capture performance metrics

**Interface:** `ITargetResolutionTracingOrchestrator`
**Location:** `src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js`
**Line Count:** ~200 lines

**Key Methods:**

- `isActionAwareTrace(trace)` - Detect trace capabilities
- `captureLegacyDetection(trace, actionId, data)` - Legacy action detection
- `captureScopeEvaluation(trace, scopeId, data)` - Scope resolution
- `captureResolutionData(trace, data)` - Resolution results
- `captureError(trace, error, context)` - Error conditions

### TargetResolutionResultBuilder

**Purpose:** Centralize result assembly and backward compatibility

**Responsibilities:**

- Build legacy action results
- Build multi-target action results
- Build final pipeline results
- Attach metadata consistently
- Maintain backward compatibility with downstream stages

**Interface:** `ITargetResolutionResultBuilder`
**Location:** `src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js`
**Line Count:** ~150 lines

**Key Methods:**

- `buildLegacyResult(context, targets, targetContexts, conversion, actionDef)` - Legacy path
- `buildMultiTargetResult(context, resolutionResults, actionDef)` - Multi-target path
- `buildFinalResult(context, actions, targetContexts)` - Pipeline result

### TargetResolutionCoordinator

**Purpose:** Coordinate target resolution with dependency handling

**Responsibilities:**

- Determine resolution order based on dependencies
- Resolve independent (primary) targets
- Resolve dependent (contextFrom) targets
- Track detailed resolution results
- Handle resolution errors gracefully

**Interface:** `ITargetResolutionCoordinator`
**Location:** `src/actions/pipeline/services/implementations/TargetResolutionCoordinator.js`
**Line Count:** ~180 lines

**Key Methods:**

- `resolveTargets(context, actionDef, trace)` - Main coordination entry point
- Internal: Dependency order resolution, primary/dependent target handling

## Service Interaction Flow

```
┌─────────────────────────────────────────┐
│   MultiTargetResolutionStage            │
│   (Pure Orchestration - 556 lines)      │
└──┬──────────────┬──────────────┬────────┘
   │              │              │
   │ 1. Trace     │ 2. Resolve   │ 3. Build
   │              │              │
   ▼              ▼              ▼
┌─────────┐  ┌──────────┐  ┌──────────┐
│ Tracing │  │Resolution│  │ Result   │
│Orchestr.│  │Coordina. │  │ Builder  │
│200 lines│  │180 lines │  │150 lines │
└─────────┘  └──────────┘  └──────────┘
   │              │              │
   └──────────────┴──────────────┘
                  │
                  ▼
            Pipeline Result
```

## Extension Patterns

### Adding New Tracing

To add new trace capture:

1. Add method to `ITargetResolutionTracingOrchestrator` interface
2. Implement in `TargetResolutionTracingOrchestrator`
3. Call from stage orchestration logic
4. **No changes needed** to stage internals, coordinator, or result builder

**Example:**

```javascript
// 1. Add to interface
interface ITargetResolutionTracingOrchestrator {
  captureNewEvent(trace, eventData);
}

// 2. Implement
class TargetResolutionTracingOrchestrator {
  captureNewEvent(trace, eventData) {
    if (this.isActionAwareTrace(trace)) {
      trace.captureActionData('new_event', eventData);
    }
  }
}

// 3. Call from stage
this.#tracingOrchestrator.captureNewEvent(trace, data);
```

### Modifying Result Format

To change result structure:

1. Update `TargetResolutionResultBuilder` methods
2. Update tests to verify new format
3. Verify downstream stage compatibility
4. **No changes needed** to stage orchestration or coordinator

**Example:**

```javascript
// Only modify result builder
buildMultiTargetResult(context, results, actionDef) {
  return PipelineResult.success({
    candidateActions: [{
      ...actionDef,
      resolvedTargets: results,
      newMetadata: 'added field' // New field
    }]
  });
}
```

### Adding Resolution Strategies

To add new resolution approach:

1. Update `ITargetResolutionCoordinator` if needed
2. Implement in `TargetResolutionCoordinator`
3. Call from stage if new strategy needed
4. **No changes** to tracing or result building

## Testing Patterns

### Testing Tracing Orchestrator

```javascript
describe('TargetResolutionTracingOrchestrator', () => {
  it('should detect action-aware trace capabilities', () => {
    const trace = { captureActionData: jest.fn() };
    expect(orchestrator.isActionAwareTrace(trace)).toBe(true);
  });

  it('should handle missing trace methods gracefully', () => {
    const trace = {};
    expect(() =>
      orchestrator.captureLegacyDetection(trace, 'id', {})
    ).not.toThrow();
  });
});
```

### Testing Result Builder

```javascript
describe('TargetResolutionResultBuilder', () => {
  it('should build results with backward compatibility', () => {
    const result = builder.buildLegacyResult(
      context,
      targets,
      contexts,
      conversion,
      action
    );
    expect(result.data.targetContexts).toBeDefined(); // Compat field
  });
});
```

### Testing Resolution Coordinator

```javascript
describe('TargetResolutionCoordinator', () => {
  it('should resolve targets in dependency order', async () => {
    const action = {
      targets: [
        { placeholder: 'primary', scope: 'scope1' },
        { placeholder: 'dependent', scope: 'scope2', contextFrom: 'primary' },
      ],
    };
    const result = await coordinator.resolveTargets(context, action, trace);
    expect(result.primary).toBeDefined();
    expect(result.dependent).toBeDefined();
  });
});
```

## Common Pitfalls

### ❌ Don't: Bypass services

```javascript
// Wrong: Direct trace call from stage
trace.captureActionData('event', data);
```

### ✅ Do: Use orchestrator

```javascript
// Right: Delegate to service
this.#tracingOrchestrator.captureLegacyDetection(trace, actionId, data);
```

### ❌ Don't: Mix concerns

```javascript
// Wrong: Build result in coordinator
class TargetResolutionCoordinator {
  resolveTargets() {
    // ... resolution logic
    return PipelineResult.success({ ... }); // Result building!
  }
}
```

### ✅ Do: Single responsibility

```javascript
// Right: Coordinator returns raw data
class TargetResolutionCoordinator {
  resolveTargets() {
    // ... resolution logic
    return { primary: [...], dependent: [...] }; // Raw results
  }
}

// Stage delegates to result builder
const rawResults = await coordinator.resolveTargets(...);
const result = resultBuilder.buildMultiTargetResult(context, rawResults, action);
```
