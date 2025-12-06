# MultiTargetResolutionStage Architecture

## Before Refactoring (~1,085 lines)

```
┌─────────────────────────────────────────────┐
│      MultiTargetResolutionStage             │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Orchestration (~300 lines)          │   │
│  │ - Candidate iteration               │   │
│  │ - Legacy/multi-target routing       │   │
│  │ - Service coordination              │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Tracing Logic (~200 lines)          │   │
│  │ - Capability detection              │   │
│  │ - 5 helper methods                  │   │
│  │ - 27 trace call sites               │   │
│  │ - 10 conditionals                   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Result Assembly (~150 lines)        │   │
│  │ - 3 assembly locations              │   │
│  │ - Backward compat logic             │   │
│  │ - Metadata attachment               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Resolution Coordination (~180 lines)│   │
│  │ - Dependency order                  │   │
│  │ - contextFrom handling              │   │
│  │ - Primary/dependent resolution      │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Helper Methods & Utilities          │   │
│  │ (~255 lines)                        │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘

Problems:
- Mixed concerns (orchestration + tracing + results)
- High cognitive load (>1000 lines in one file)
- Difficult to test individual concerns
- Changes ripple across entire file
```

## After Refactoring (556 lines + 3 services)

```
┌─────────────────────────────────────────────────────────────┐
│          MultiTargetResolutionStage (Orchestrator)          │
│                         556 lines                           │
│                                                             │
│  executeInternal(context) {                                 │
│    const { candidateActions, trace } = context.data;       │
│    const resolvedActions = [];                             │
│    const allTargetContexts = [];                           │
│                                                             │
│    for (const action of candidateActions) {                │
│      const result = await this.#resolveActionTargets(      │
│        context, action, trace                              │
│      );                                                     │
│      resolvedActions.push(result.action);                  │
│      allTargetContexts.push(...result.contexts);           │
│    }                                                        │
│                                                             │
│    return this.#resultBuilder.buildFinalResult(            │
│      context, resolvedActions, allTargetContexts           │
│    );                                                       │
│  }                                                          │
│                                                             │
│  #resolveActionTargets(context, action, trace) {           │
│    // 1. Detect legacy vs multi-target                     │
│    // 2. Route to appropriate path                         │
│    // 3. Coordinate services                               │
│    // 4. Return combined results                           │
│  }                                                          │
└─────────────────┬───────────────┬───────────────┬───────────┘
                  │               │               │
         ┌────────▼──────┐ ┌─────▼──────┐ ┌─────▼─────────┐
         │   Tracing     │ │  Result    │ │  Resolution   │
         │ Orchestrator  │ │  Builder   │ │ Coordinator   │
         │               │ │            │ │               │
         │ ~200 lines    │ │ ~150 lines │ │  ~180 lines   │
         │               │ │            │ │               │
         │ - Capability  │ │ - Legacy   │ │ - Dependency  │
         │   detection   │ │   results  │ │   order       │
         │ - Event       │ │ - Multi-   │ │ - Primary     │
         │   capture     │ │   target   │ │   resolution  │
         │ - Telemetry   │ │   results  │ │ - Dependent   │
         │               │ │ - Final    │ │   resolution  │
         │               │ │   assembly │ │               │
         └───────────────┘ └────────────┘ └───────────────┘

Benefits:
✓ Clear separation of concerns
✓ Independent testing of services
✓ Easier to modify individual aspects
✓ Better code organization
✓ 49% reduction in main file size
```

## Service Interaction Flow

### Legacy Action Path

```
User Request (Legacy Action)
     │
     ▼
┌─────────────────────────────────────────┐
│   MultiTargetResolutionStage            │
│   1. Detect legacy action               │
│   2. Convert to multi-target format     │
└──┬──────────────────────────────────────┘
   │
   ├──→ #tracingOrchestrator.captureLegacyDetection()
   │
   ├──→ #legacyLayer.convertToMultiTarget()
   │
   ├──→ #resolveLegacyTarget() [internal method]
   │    ├─→ #unifiedScopeResolver.resolve()
   │    └─→ #nameResolver.resolveDisplayName()
   │
   └──→ #resultBuilder.buildLegacyResult()
        └─→ PipelineResult with backward compat
```

### Multi-Target Action Path

```
User Request (Multi-Target Action)
     │
     ▼
┌─────────────────────────────────────────┐
│   MultiTargetResolutionStage            │
│   1. Detect multi-target action         │
│   2. Coordinate resolution              │
└──┬──────────────────────────────────────┘
   │
   ├──→ #resolutionCoordinator.resolveTargets()
   │    ├─→ Determine dependency order
   │    ├─→ Resolve primary targets
   │    │   ├─→ #contextBuilder.buildScopeContext()
   │    │   └─→ #unifiedScopeResolver.resolve()
   │    └─→ Resolve dependent targets (contextFrom)
   │        ├─→ #contextBuilder.buildScopeContextForSpecificPrimary()
   │        └─→ #unifiedScopeResolver.resolve()
   │
   ├──→ #tracingOrchestrator.captureScopeEvaluation()
   │
   └──→ #resultBuilder.buildMultiTargetResult()
        └─→ PipelineResult with resolvedTargets
```

### Complete Flow Diagram

```
┌──────────────┐
│ Pipeline     │
│ Context      │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│ MultiTargetResolutionStage           │
│ ┌──────────────────────────────────┐ │
│ │ executeInternal()                │ │
│ │ - Iterate candidate actions      │ │
│ │ - Resolve each action's targets  │ │
│ │ - Aggregate results              │ │
│ └──────────────────────────────────┘ │
└──┬───────────────┬──────────────┬────┘
   │               │              │
   │ Legacy?       │ Multi?       │ Build
   ▼               ▼              ▼
┌────────┐    ┌──────────┐   ┌──────────┐
│ Legacy │    │Resolution│   │ Result   │
│ Layer  │    │Coordina. │   │ Builder  │
└────┬───┘    └─────┬────┘   └─────┬────┘
     │              │              │
     │ Trace ◄──────┼──────────────┤
     ▼              ▼              ▼
┌─────────────────────────────────────┐
│ TargetResolutionTracingOrchestrator │
│ - captureLegacyDetection()          │
│ - captureScopeEvaluation()          │
│ - captureResolutionData()           │
└─────────────────────────────────────┘
```

## Metrics Summary

| Metric                | Before               | After             | Change      |
| --------------------- | -------------------- | ----------------- | ----------- |
| Main file lines       | 1,085                | 556               | -529 (-49%) |
| Service lines (total) | 0                    | 530               | +530        |
| Total system lines    | 1,085                | 1,086             | +1 (~0%)    |
| Concerns in main file | 4-5 mixed            | 1 (orchestration) | -75%        |
| Testability           | Low (monolithic)     | High (isolated)   | ✓           |
| Modifiability         | Low (ripple effects) | High (localized)  | ✓           |

**Note:** Total line count remains nearly identical, but organization dramatically improves maintainability.
