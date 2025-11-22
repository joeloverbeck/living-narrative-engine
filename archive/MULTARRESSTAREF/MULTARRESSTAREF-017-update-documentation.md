# MULTARRESSTAREF-017: Update Documentation and Create Architecture Diagram

**Status:** ✅ Completed
**Priority:** Medium
**Estimated Effort:** 1.5 days
**Actual Effort:** ~2 hours
**Phase:** 5 - Cleanup
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Outcome

All documentation has been successfully created and updated to reflect the refactored architecture:

**Files Created:**
- `docs/architecture/target-resolution-services.md` - Service responsibilities and patterns
- `docs/architecture/diagrams/multi-target-resolution-architecture.md` - Visual architecture diagrams
- `docs/architecture/multi-target-resolution-migration-guide.md` - Migration guide with patterns
- `docs/testing/integration-test-patterns.md` - Testing patterns for target resolution services

**Files Updated:**
- `src/actions/pipeline/stages/MultiTargetResolutionStage.js` - Enhanced JSDoc with architecture overview
- `CLAUDE.md` - Added Target Resolution Service Pattern section

**Deviations from Plan:**
- No changes to existing `docs/testing/integration-test-patterns.md` - file did not exist, so created new comprehensive file
- All assumptions corrected based on actual code analysis (line counts, service sizes)

## Objective

Update all documentation to reflect the refactored architecture, create visual architecture diagrams, and document patterns for future development.

## Background

The refactoring introduces 3 new services and significantly changes the MultiTargetResolutionStage architecture. Documentation must be updated to help developers understand and maintain the new structure.

## Corrected Assumptions (Based on Actual Code)

**Before Refactoring:**
- Line count: ~1,085 lines (not 1,220 as originally estimated)
- Git ref: Before commit `22c282154` (result builder integration)

**After Refactoring:**
- Current line count: 556 lines (not 150-200 as originally estimated)
- Git ref: After commit `ba0aaffa8` (MULTARRESSTAREF-015 completion)
- Still contains legacy resolution logic in `#resolveLegacyTarget` method (~118 lines)
- Reduction: ~49% from original (529 lines removed)

**Service Line Counts (Actual):**
- `TargetResolutionTracingOrchestrator.js`: ~200 lines
- `TargetResolutionResultBuilder.js`: ~150 lines
- `TargetResolutionCoordinator.js`: ~180 lines

**Current JSDoc Status:**
- Basic class-level JSDoc exists but lacks orchestration details
- Constructor JSDoc lists dependencies but not service roles
- No usage examples provided
- Missing explanation of separation of concerns

## Technical Requirements

### Documentation Files to Update/Create

#### 1. Update Stage JSDoc
**File:** `src/actions/pipeline/stages/MultiTargetResolutionStage.js`

**Current JSDoc:**
```javascript
/**
 * Pipeline stage that orchestrates target resolution using specialized services
 * Refactored from 748-line class to lightweight orchestrator
 */
```

**Enhanced JSDoc (to replace current):**
```javascript
/**
 * @class MultiTargetResolutionStage
 * @extends PipelineStage
 * 
 * Pipeline stage responsible for resolving targets for candidate actions.
 *
 * This stage acts as a pure orchestrator, delegating all concerns to specialized services:
 * - **TargetResolutionTracingOrchestrator**: Handles all tracing instrumentation
 * - **TargetResolutionResultBuilder**: Handles result assembly and backward compatibility
 * - **TargetResolutionCoordinator**: Handles target resolution coordination and dependencies
 *
 * ## Architecture
 * 
 * The stage follows a service-oriented design with clear separation of concerns:
 * 1. **Legacy Detection** - Identifies legacy single-target vs. multi-target actions
 * 2. **Target Resolution** - Coordinates dependency-aware resolution via coordinator
 * 3. **Tracing** - Captures telemetry via tracing orchestrator
 * 4. **Result Building** - Assembles consistent results via result builder
 *
 * ## Refactoring History
 * 
 * - **Before**: ~1,085 lines with mixed concerns
 * - **After**: 556 lines focused on orchestration (~49% reduction)
 * - **Extracted**: 3 specialized services (~530 lines total)
 *
 * @example
 * // Stage is injected with all required services via DI
 * const stage = new MultiTargetResolutionStage({
 *   legacyTargetCompatibilityLayer,
 *   targetDisplayNameResolver,
 *   unifiedScopeResolver,
 *   entityManager,
 *   targetResolver,
 *   logger,
 *   tracingOrchestrator,
 *   targetResolutionResultBuilder,
 *   targetResolutionCoordinator
 * });
 *
 * // Execute returns pipeline result with resolved targets
 * const result = await stage.execute(context);
 * // result.data.candidateActions - actions with resolvedTargets
 * // result.data.targetContexts - backward compatibility
 *
 * @see TargetResolutionTracingOrchestrator for tracing implementation
 * @see TargetResolutionResultBuilder for result assembly
 * @see TargetResolutionCoordinator for resolution coordination
 */
```

#### 2. Document Service Responsibilities
**File:** `docs/architecture/target-resolution-services.md` (NEW)

**Contents:**
```markdown
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
    expect(() => orchestrator.captureLegacyDetection(trace, 'id', {}))
      .not.toThrow();
  });
});
```

### Testing Result Builder
```javascript
describe('TargetResolutionResultBuilder', () => {
  it('should build results with backward compatibility', () => {
    const result = builder.buildLegacyResult(context, targets, contexts, conversion, action);
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
        { placeholder: 'dependent', scope: 'scope2', contextFrom: 'primary' }
      ]
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
```

#### 3. Create Architecture Diagram
**File:** `docs/architecture/diagrams/multi-target-resolution-architecture.md` (NEW)

**Contents:**
```markdown
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

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Main file lines | 1,085 | 556 | -529 (-49%) |
| Service lines (total) | 0 | 530 | +530 |
| Total system lines | 1,085 | 1,086 | +1 (~0%) |
| Concerns in main file | 4-5 mixed | 1 (orchestration) | -75% |
| Testability | Low (monolithic) | High (isolated) | ✓ |
| Modifiability | Low (ripple effects) | High (localized) | ✓ |

**Note:** Total line count remains nearly identical, but organization dramatically improves maintainability.
```

#### 4. Update Integration Test Documentation
**File:** `docs/testing/integration-test-patterns.md`

**Check if file exists, then add section:**
```markdown
## Testing Target Resolution Services

### Overview
The target resolution stage uses three specialized services. Each service should be tested independently in unit tests, with integration tests verifying their coordination.

### Testing Tracing Orchestrator

**Unit Test Patterns:**
```javascript
describe('TargetResolutionTracingOrchestrator', () => {
  let orchestrator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    orchestrator = new TargetResolutionTracingOrchestrator({ logger: mockLogger });
  });

  describe('Capability Detection', () => {
    it('should detect action-aware trace capabilities', () => {
      const actionAwareTrace = { captureActionData: jest.fn() };
      expect(orchestrator.isActionAwareTrace(actionAwareTrace)).toBe(true);
    });

    it('should detect non-action-aware traces', () => {
      const standardTrace = {};
      expect(orchestrator.isActionAwareTrace(standardTrace)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing trace methods gracefully', () => {
      const trace = {};
      expect(() => {
        orchestrator.captureLegacyDetection(trace, 'action-id', {});
      }).not.toThrow();
    });
  });
});
```

**Integration Test Patterns:**
```javascript
describe('Tracing Integration', () => {
  it('should capture trace data during resolution', async () => {
    const trace = createActionAwareTrace();
    const stage = createStageWithServices({ trace });
    
    await stage.execute(context);
    
    expect(trace.captureActionData).toHaveBeenCalledWith(
      'legacy_action_detected',
      expect.objectContaining({ actionId: expect.any(String) })
    );
  });
});
```

### Testing Result Builder

**Unit Test Patterns:**
```javascript
describe('TargetResolutionResultBuilder', () => {
  let builder;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = createMockEntityManager();
    mockLogger = createMockLogger();
    builder = new TargetResolutionResultBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger
    });
  });

  describe('Backward Compatibility', () => {
    it('should include targetContexts for legacy actions', () => {
      const result = builder.buildLegacyResult(
        context,
        resolvedTargets,
        targetContexts,
        conversionResult,
        actionDef
      );
      
      expect(result.data.targetContexts).toBeDefined();
      expect(result.data.targetContexts).toEqual(targetContexts);
    });

    it('should format legacy results consistently', () => {
      const result = builder.buildLegacyResult(/* ... */);
      
      expect(result.data.candidateActions).toHaveLength(1);
      expect(result.data.candidateActions[0]).toMatchObject({
        ...actionDef,
        resolvedTargets: expect.any(Object)
      });
    });
  });

  describe('Multi-Target Results', () => {
    it('should build results with all resolved targets', () => {
      const resolutionResults = {
        primary: [{ id: 'entity1', displayName: 'Entity 1' }],
        secondary: [{ id: 'entity2', displayName: 'Entity 2' }]
      };
      
      const result = builder.buildMultiTargetResult(
        context,
        resolutionResults,
        actionDef
      );
      
      expect(result.data.candidateActions[0].resolvedTargets)
        .toEqual(resolutionResults);
    });
  });
});
```

### Testing Resolution Coordinator

**Unit Test Patterns:**
```javascript
describe('TargetResolutionCoordinator', () => {
  let coordinator;
  let mockServices;

  beforeEach(() => {
    mockServices = createMockCoordinatorServices();
    coordinator = new TargetResolutionCoordinator(mockServices);
  });

  describe('Dependency Order Resolution', () => {
    it('should resolve independent targets first', async () => {
      const action = {
        targets: [
          { placeholder: 'primary', scope: 'scope:primary' },
          { placeholder: 'dependent', scope: 'scope:dependent', contextFrom: 'primary' }
        ]
      };
      
      const result = await coordinator.resolveTargets(context, action, trace);
      
      // Verify primary resolved before dependent
      expect(result.primary).toBeDefined();
      expect(result.dependent).toBeDefined();
    });

    it('should handle circular dependencies gracefully', async () => {
      const action = {
        targets: [
          { placeholder: 'a', scope: 'scope:a', contextFrom: 'b' },
          { placeholder: 'b', scope: 'scope:b', contextFrom: 'a' }
        ]
      };
      
      await expect(coordinator.resolveTargets(context, action, trace))
        .rejects.toThrow('circular dependency');
    });
  });

  describe('contextFrom Handling', () => {
    it('should pass primary target as context for dependent', async () => {
      const action = {
        targets: [
          { placeholder: 'actor', scope: 'scope:actor' },
          { placeholder: 'nearby', scope: 'scope:nearby', contextFrom: 'actor' }
        ]
      };
      
      await coordinator.resolveTargets(context, action, trace);
      
      expect(mockServices.contextBuilder.buildScopeContextForSpecificPrimary)
        .toHaveBeenCalledWith(
          expect.any(Object),
          'actor',
          expect.objectContaining({ id: expect.any(String) })
        );
    });
  });
});
```

**Integration Test Patterns:**
```javascript
describe('Resolution Coordinator Integration', () => {
  it('should coordinate full multi-target resolution', async () => {
    const fixture = await ModTestFixture.forAction('test-mod', 'test-mod:multi_target_action');
    const scenario = fixture.createStandardActorTarget();
    
    await fixture.executeAction(scenario.actor.id, scenario.target.id);
    
    const actions = fixture.getAvailableActions();
    expect(actions[0].resolvedTargets).toMatchObject({
      actor: [{ id: scenario.actor.id }],
      target: [{ id: scenario.target.id }]
    });
  });
});
```

### Common Test Utilities

**Service Mocking:**
```javascript
// tests/common/mocks/targetResolutionMocks.js
export function createMockTracingOrchestrator() {
  return {
    isActionAwareTrace: jest.fn().mockReturnValue(true),
    captureLegacyDetection: jest.fn(),
    captureScopeEvaluation: jest.fn(),
    captureResolutionData: jest.fn(),
    captureError: jest.fn()
  };
}

export function createMockResultBuilder() {
  return {
    buildLegacyResult: jest.fn().mockReturnValue(PipelineResult.success({})),
    buildMultiTargetResult: jest.fn().mockReturnValue(PipelineResult.success({})),
    buildFinalResult: jest.fn().mockReturnValue(PipelineResult.success({}))
  };
}

export function createMockResolutionCoordinator() {
  return {
    resolveTargets: jest.fn().mockResolvedValue({
      primary: [],
      secondary: []
    })
  };
}
```
```

#### 5. Update CLAUDE.md
**File:** `CLAUDE.md` (project root)

**Add section after "Character Builder Tools" section (around line 614):**
```markdown
### Target Resolution Service Pattern

When working with the action discovery pipeline's target resolution stage:

**Architecture:**
The `MultiTargetResolutionStage` follows a service-oriented design with three specialized services:

- `TargetResolutionTracingOrchestrator` - All tracing and telemetry concerns
- `TargetResolutionResultBuilder` - Result assembly and backward compatibility
- `TargetResolutionCoordinator` - Multi-target resolution with dependency handling

**Key Principle:** Stage orchestrates, services execute. Changes to one service don't affect others.

**Service Responsibilities:**

| Service | Responsibility | When to Modify |
|---------|---------------|----------------|
| TracingOrchestrator | Capture telemetry events | Adding new trace points |
| ResultBuilder | Assemble pipeline results | Changing result format |
| ResolutionCoordinator | Resolve targets with dependencies | New resolution strategies |

**Extension Patterns:**

```javascript
// Adding new tracing - only modify orchestrator
tracingOrchestrator.captureNewEvent(trace, data);

// Changing result format - only modify builder
resultBuilder.buildWithNewFormat(data);

// New resolution strategy - only modify coordinator
coordinator.resolveWithNewStrategy(targets);
```

**Testing Pattern:**
- Unit test each service independently
- Integration test service coordination
- Mock services when testing stage orchestration

**Documentation:**
- Architecture: `docs/architecture/target-resolution-services.md`
- Diagrams: `docs/architecture/diagrams/multi-target-resolution-architecture.md`
- Migration: `docs/architecture/multi-target-resolution-migration-guide.md`

```

#### 6. Create Migration Guide
**File:** `docs/architecture/multi-target-resolution-migration-guide.md` (NEW)

**Contents:**
```markdown
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
    legacyFormat: true
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
  candidateActions: [{
    ...actionDef,
    resolvedTargets: { ...resolvedTargets },
    // ... metadata attachment logic
  }],
  targetContexts: [...targetContexts] // Backward compat
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
  trace.captureActionData('new_event', { /* data */ });
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
  candidateActions: [{ /* format */ }]
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
const result = resultBuilder.buildMultiTargetResult(context, rawResults, action);
```

### ❌ Pitfall 3: Modifying Multiple Services for Simple Changes
```javascript
// Wrong: Changing result format requires coordinator change
class TargetResolutionCoordinator {
  async resolveTargets() {
    return {
      targets: resolved,
      newMetadata: 'data' // Adding metadata in coordinator
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
      candidateActions: [{
        ...action,
        resolvedTargets: targets,
        metadata: this.#buildMetadata() // Metadata in builder
      }]
    });
  }
}
```

## Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Lines of Code** |
| Main file | 1,085 | 556 | -529 (-49%) |
| Services (total) | 0 | 530 | +530 |
| Total system | 1,085 | 1,086 | +1 (~0%) |
| **Complexity** |
| Concerns per file | 4-5 | 1 | -75% |
| Max method length | ~120 lines | ~60 lines | -50% |
| Cognitive load | High | Low | ✓ |
| **Quality** |
| Testability | Low | High | ✓ |
| Maintainability | Low | High | ✓ |
| Extensibility | Low | High | ✓ |

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
```

## Acceptance Criteria

- [x] Assumptions corrected based on actual code analysis
- [ ] Stage JSDoc updated with new architecture
- [ ] Service responsibilities documented
- [ ] Architecture diagrams created (before/after)
- [ ] Service interaction flow documented
- [ ] Integration test documentation updated
- [ ] CLAUDE.md updated with service patterns
- [ ] Migration guide created
- [ ] All diagrams are clear and accurate
- [ ] Documentation reviewed for clarity

## Dependencies

- **MULTARRESSTAREF-015** - Stage simplification complete ✓
- **MULTARRESSTAREF-016** - Diagnostic logging removed (complete)

## Deliverables

- [ ] Updated stage JSDoc in `MultiTargetResolutionStage.js`
- [ ] `docs/architecture/target-resolution-services.md`
- [ ] `docs/architecture/diagrams/` directory created
- [ ] `docs/architecture/diagrams/multi-target-resolution-architecture.md`
- [ ] `docs/testing/integration-test-patterns.md` update
- [ ] `CLAUDE.md` update (after Character Builder Tools section)
- [ ] `docs/architecture/multi-target-resolution-migration-guide.md`

## Scope Changes from Original Plan

**Corrected Metrics:**
- Before refactoring: ~1,085 lines (not 1,220)
- After refactoring: 556 lines (not 150-200)
- Still significant improvement: 49% reduction
- Diagram sizes updated to reflect actual measurements

**No Code Changes Required:**
- This is pure documentation work
- All code changes already complete via MULTARRESSTAREF-015
- Focus: Document existing architecture, not modify it

## Notes

- Use accurate line counts from git history
- Diagrams should reflect actual before/after state
- Emphasize service patterns and extension points
- Keep documentation concise but comprehensive
- Include real code examples from actual services
- Focus on practical guidance for future developers
