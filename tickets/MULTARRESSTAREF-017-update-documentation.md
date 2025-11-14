# MULTARRESSTAREF-017: Update Documentation and Create Architecture Diagram

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 1.5 days
**Phase:** 5 - Cleanup
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Update all documentation to reflect the refactored architecture, create visual architecture diagrams, and document patterns for future development.

## Background

The refactoring introduces 3 new services and significantly changes the MultiTargetResolutionStage architecture. Documentation must be updated to help developers understand and maintain the new structure.

## Technical Requirements

### Documentation Files to Update/Create

#### 1. Update Stage JSDoc
**File:** `src/actions/pipeline/stages/MultiTargetResolutionStage.js`

**Changes:**
- Update class-level JSDoc to describe orchestration role
- Document service delegation pattern
- List all injected dependencies
- Explain separation of concerns
- Add usage examples

**Example:**
```javascript
/**
 * Pipeline stage responsible for resolving targets for candidate actions.
 *
 * This stage acts as a pure orchestrator, delegating all concerns to specialized services:
 * - **TargetResolutionTracingOrchestrator**: Handles all tracing instrumentation
 * - **TargetResolutionResultBuilder**: Handles result assembly and backward compatibility
 * - **TargetResolutionCoordinator**: Handles target resolution coordination and dependencies
 *
 * The stage's primary responsibility is coordinating these services to:
 * 1. Detect legacy vs. multi-target actions
 * 2. Coordinate target resolution via the coordinator
 * 3. Capture tracing data via the tracing orchestrator
 * 4. Build consistent results via the result builder
 *
 * @example
 * // Stage is injected with all required services
 * const stage = new MultiTargetResolutionStage({
 *   legacyLayer,
 *   tracingOrchestrator,
 *   resultBuilder,
 *   resolutionCoordinator,
 *   logger
 * });
 *
 * // Execute returns pipeline result with resolved targets
 * const result = await stage.execute(context);
 * // result.data.candidateActions - actions with resolvedTargets
 * // result.data.targetContexts - backward compatibility
 */
```

#### 2. Document Service Responsibilities
**File:** `docs/architecture/target-resolution-services.md` (NEW)

**Contents:**
```markdown
# Target Resolution Services

## Overview
The target resolution pipeline uses specialized services to handle different concerns, following the Single Responsibility Principle.

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

## Service Interaction Flow

[Diagram to be added]

## Adding New Tracing
To add new trace capture:
1. Add method to `ITargetResolutionTracingOrchestrator`
2. Implement in `TargetResolutionTracingOrchestrator`
3. Call from stage orchestration logic
4. No changes needed to stage internals

## Modifying Result Format
To change result structure:
1. Update `TargetResolutionResultBuilder` methods
2. Update tests to verify new format
3. Verify downstream stage compatibility
4. No changes needed to stage or coordinator

## Adding Resolution Strategies
To add new resolution approach:
1. Update `ITargetResolutionCoordinator` if needed
2. Implement in `TargetResolutionCoordinator`
3. Call from stage if new strategy needed
4. No changes to tracing or result building
```

#### 3. Create Architecture Diagram
**File:** `docs/architecture/diagrams/multi-target-resolution-architecture.md` (NEW)

**Contents:**
```markdown
# MultiTargetResolutionStage Architecture

## Before Refactoring (1,220 lines)
```
┌─────────────────────────────────────────────┐
│      MultiTargetResolutionStage             │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Orchestration (288 lines)           │   │
│  │ - Candidate iteration               │   │
│  │ - Legacy/multi-target routing       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Tracing Logic (200 lines)           │   │
│  │ - 5 helper methods                  │   │
│  │ - 27 trace calls                    │   │
│  │ - 10 conditionals                   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Result Assembly (80 lines)          │   │
│  │ - 3 assembly locations              │   │
│  │ - Backward compat logic             │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Resolution Coordination (150 lines) │   │
│  │ - Dependency order                  │   │
│  │ - contextFrom handling              │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Diagnostic Logging (30 lines)       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Helper Methods (472 lines)          │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## After Refactoring (150-200 lines)
```
┌─────────────────────────────────────────────────────────────┐
│          MultiTargetResolutionStage (Orchestrator)          │
│                                                             │
│  executeInternal() {                                        │
│    for (action in candidateActions) {                      │
│      result = resolveAction(action)                        │
│    }                                                        │
│    return buildFinalResult()                               │
│  }                                                          │
│                                                             │
│  resolveAction() {                                          │
│    detect legacy → coordinate → trace → build result       │
│  }                                                          │
└─────────────────┬───────────────┬───────────────┬───────────┘
                  │               │               │
         ┌────────▼──────┐ ┌─────▼──────┐ ┌─────▼─────────┐
         │   Tracing     │ │  Result    │ │  Resolution   │
         │ Orchestrator  │ │  Builder   │ │ Coordinator   │
         │  (200 lines)  │ │ (150 lines)│ │  (180 lines)  │
         └───────────────┘ └────────────┘ └───────────────┘
```

## Service Interaction Flow
```
User Request
     │
     ▼
┌─────────────────────────────────────────┐
│   MultiTargetResolutionStage            │
│   (Pure Orchestration)                  │
└──┬──────────────┬──────────────┬────────┘
   │              │              │
   │ 1. Trace     │ 2. Resolve   │ 3. Build
   │              │              │
   ▼              ▼              ▼
┌─────────┐  ┌──────────┐  ┌──────────┐
│ Tracing │  │Resolution│  │ Result   │
│Orchestr.│  │Coordina. │  │ Builder  │
└─────────┘  └──────────┘  └──────────┘
   │              │              │
   └──────────────┴──────────────┘
                  │
                  ▼
            Pipeline Result
```
```

#### 4. Update Integration Test Documentation
**File:** `docs/testing/integration-test-patterns.md`

**Add section:**
```markdown
## Testing Target Resolution Services

### Testing Tracing Orchestrator
- Mock trace objects with various capabilities
- Verify trace method calls and arguments
- Test error handling (missing trace methods)

### Testing Result Builder
- Verify result format matches downstream expectations
- Test backward compatibility fields
- Test both legacy and multi-target paths

### Testing Resolution Coordinator
- Test dependency order resolution
- Test contextFrom handling
- Test detailed results tracking
```

#### 5. Update CLAUDE.md
**File:** `CLAUDE.md` (project root)

**Add section:**
```markdown
### Target Resolution Service Pattern

When working with action discovery pipeline:

**Services:**
- `TargetResolutionTracingOrchestrator` - All tracing concerns
- `TargetResolutionResultBuilder` - Result assembly and backward compat
- `TargetResolutionCoordinator` - Resolution coordination and dependencies

**Pattern:**
1. Stage orchestrates via simple delegation
2. Each service handles single concern
3. Services are independently testable
4. Changes to one service don't affect others

**Example:**
```javascript
// Adding new tracing - only modify orchestrator
tracingOrchestrator.captureNewEvent(trace, data);

// Changing result format - only modify builder
resultBuilder.buildWithNewFormat(data);

// New resolution strategy - only modify coordinator
coordinator.resolveWithNewStrategy(targets);
```
```

#### 6. Create Migration Guide
**File:** `docs/architecture/multi-target-resolution-migration-guide.md` (NEW)

**Contents:**
- Before/after architecture comparison
- List of extracted services
- How to add new features (tracing, results, resolution)
- Testing patterns for each service
- Common pitfalls to avoid

## Acceptance Criteria

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

- **MULTARRESSTAREF-015** - Stage simplification complete
- **MULTARRESSTAREF-016** - Diagnostic logging removed (optional)

## Deliverables

- [ ] Updated stage JSDoc
- [ ] `docs/architecture/target-resolution-services.md`
- [ ] `docs/architecture/diagrams/multi-target-resolution-architecture.md`
- [ ] `docs/testing/integration-test-patterns.md` update
- [ ] `CLAUDE.md` update
- [ ] `docs/architecture/multi-target-resolution-migration-guide.md`

## Notes

- Use diagrams to show before/after architecture
- Emphasize separation of concerns and single responsibility
- Document how to extend each service
- Provide clear examples for common tasks
- Keep documentation concise but comprehensive
- Include real code examples where helpful
